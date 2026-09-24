import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Minimal Secure Authentication & Session Store for Patze Online (Alpha)
 *
 * Supports:
 * - Username & Password authentication
 * - Bounded HttpOnly session cookies
 * - One-time short-lived bootstrap exchange
 * - Zero token leakage in browser history/URLs
 */

export const ALPHA_USERS = {
  pat: {
    id: 'pat',
    name: 'Pat',
    email: 'pat@example.com',
    password: process.env.PATZE_PAT_PASSWORD,
    pairingSecret: process.env.PATZE_PAT_PAIRING_SECRET,
  },
  peat: {
    id: 'peat',
    name: 'Peat',
    email: 'peat@example.com',
    password: process.env.PATZE_PEAT_PASSWORD,
    pairingSecret: process.env.PATZE_PEAT_PAIRING_SECRET,
  },
}

// Brother remains a separate account; it shares no default credentials with Peat.
ALPHA_USERS.brother = {
  id: 'brother',
  name: 'Peat (Brother)',
  email: 'brother@example.com',
  password: process.env.PATZE_BROTHER_PASSWORD,
  pairingSecret: process.env.PATZE_BROTHER_PAIRING_SECRET,
}

export class AuthService {
  constructor(users = ALPHA_USERS) {
    this.users = users
    /** @type {Map<string, { userId: string, createdAt: number, expiresAt: number }>} */
    this.sessions = new Map()

    /** @type {Map<string, { userId: string, expiresAt: number }>} */
    this.oneTimeBootstrapTokens = new Map()

  }

  hasConfiguredCredentials() {
    return Object.values(this.users).some(user =>
      typeof user.password === 'string' && user.password.trim().length >= 12
      && typeof user.pairingSecret === 'string' && user.pairingSecret.trim().length >= 32)
  }

  /**
   * Verify username & password
   * @param {string} username
   * @param {string} password
   * @returns {{ id: string, name: string, email: string } | null}
   */
  verifyCredentials(username, password) {
    if (!username || !password) return null
    const user = this.users[username.trim().toLowerCase()]
    if (!user) return null

    const validPasswords = [user.password].filter(value => typeof value === 'string' && value.trim().length >= 12)
    const testBuf = Buffer.from(password)
    for (const valid of validPasswords) {
      const validBuf = Buffer.from(valid)
      if (testBuf.length === validBuf.length && timingSafeEqual(testBuf, validBuf)) {
        return { id: user.id, name: user.name, email: user.email }
      }
    }
    return null
  }

  /**
   * Create a new session token
   * @param {string} userId
   * @param {string} [customToken]
   * @param {number} [ttlMs]
   */
  createSession(userId, customToken, ttlMs = 30 * 24 * 60 * 60 * 1000) {
    const user = this.users[userId]
    if (!user) return null

    const token = customToken || `patze_sess_${randomBytes(24).toString('hex')}`
    const now = Date.now()
    this.sessions.set(token, {
      userId,
      createdAt: now,
      expiresAt: now + ttlMs,
    })
    return { token, user: { id: user.id, name: user.name, email: user.email } }
  }

  /**
   * Invalidate a session
   * @param {string} token
   */
  destroySession(token) {
    if (!token) return false
    return this.sessions.delete(token)
  }

  /**
   * Create a short-lived, one-time bootstrap token (valid for 5 minutes)
   * @param {string} userId
   * @param {number} [ttlMs]
   */
  createBootstrapToken(userId, ttlMs = 5 * 60 * 1000) {
    const user = this.users[userId]
    if (!user) return null
    const token = `boot_${randomBytes(24).toString('hex')}`
    this.oneTimeBootstrapTokens.set(token, {
      userId,
      expiresAt: Date.now() + ttlMs,
    })
    return token
  }

  /**
   * Consume a one-time bootstrap token and return a real persistent session
   * @param {string} token
   */
  consumeBootstrapToken(token) {
    if (!token) return null
    const entry = this.oneTimeBootstrapTokens.get(token)
    if (!entry) return null

    this.oneTimeBootstrapTokens.delete(token) // Immediately invalidate (one-time use)

    if (Date.now() > entry.expiresAt) {
      return null
    }

    return this.createSession(entry.userId)
  }

  /**
   * Verify session token
   * @param {string} token
   * @returns {{ id: string, name: string, email: string } | null}
   */
  verifySession(token) {
    if (!token) return null
    const sess = this.sessions.get(token)
    if (!sess) return null
    if (Date.now() > sess.expiresAt) {
      this.sessions.delete(token)
      return null
    }
    const user = this.users[sess.userId]
    if (!user) return null
    return { id: user.id, name: user.name, email: user.email }
  }

  /**
   * Verify pairing secret for device registration
   * @param {string} userId
   * @param {string} secret
   */
  verifyPairingSecret(userId, secret) {
    if (!userId || !secret) return false
    const user = this.users[userId.trim().toLowerCase()]
    if (!user) return false

    const validSecrets = [user.pairingSecret].filter(value => typeof value === 'string' && value.trim().length >= 32)
    const testBuf = Buffer.from(secret)
    for (const valid of validSecrets) {
      const validBuf = Buffer.from(valid)
      if (testBuf.length === validBuf.length && timingSafeEqual(testBuf, validBuf)) {
        return true
      }
    }
    return false
  }

  /**
   * Extract and verify session from HTTP Request
   * @param {import('node:http').IncomingMessage} req
   */
  authenticateRequest(req) {
    // 1. Authorization header: Bearer <token>
    const authHeader = req.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim()
      const user = this.verifySession(token)
      if (user) return { user, token }
    }

    // 2. Cookie header: patze_session=<token>
    const cookieHeader = req.headers['cookie']
    if (cookieHeader) {
      const match = cookieHeader.match(/patze_session=([^;]+)/)
      if (match) {
        const token = match[1].trim()
        const user = this.verifySession(token)
        if (user) return { user, token }
      }
    }

    return null
  }
}
