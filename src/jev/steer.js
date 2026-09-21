/**
 * Jev System 1 steer policy.
 *
 * TypeSafe: code owns the workflow; Jev returns a typed route, not chat prose.
 * agent/pre-step fires on every model step. Re-injecting after step 1 restates
 * a completed tool as a new order (observed: duplicate xai_imagine_video).
 */

/**
 * @param {unknown} step
 * @returns {boolean}
 */
export function isOpeningStep(step) {
  if (step === undefined || step === null) return true
  const n = Number(step)
  if (!Number.isFinite(n)) return true
  return n <= 1
}

/**
 * @param {unknown[]} messages
 * @returns {string}
 */
export function latestUserText(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return ''
  const userMsg = typeof messages.findLast === 'function'
    ? messages.findLast((m) => m?.source?.kind === 'user' || m?.role === 'user')
    : messages[messages.length - 1]
  if (Array.isArray(userMsg?.content)) {
    return userMsg.content.map((c) => c?.text || '').join(' ').trim()
  }
  if (typeof userMsg?.content === 'string') return userMsg.content.trim()
  return ''
}

/**
 * @param {{ intentCategory?: string, skill?: string | null, confidence?: number }} route
 * @returns {'silent' | 'skill'}
 */
export function steerMode(route) {
  if (!route) return 'silent'
  if (route.intentCategory === 'video-generation' || route.intentCategory === 'image-generation') {
    return 'silent'
  }
  if (route.intentCategory === 'conversational') return 'silent'
  if (route.skill && (route.confidence ?? 0) >= 0.90) return 'skill'
  return 'silent'
}

/**
 * @param {object} input
 * @param {unknown} input.step
 * @param {unknown} [input.turn]
 * @param {string} input.fingerprint
 * @param {{ turn?: unknown, fingerprint?: string } | undefined} input.prior
 */
export function shouldSteer({ step, turn, fingerprint, prior }) {
  if (!fingerprint) return false
  if (!isOpeningStep(step)) return false
  if (prior && prior.turn === turn && prior.fingerprint === fingerprint) return false
  return true
}
