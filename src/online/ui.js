/**
 * Patze Web Interface — Modern, High-End Developer Agent Platform
 *
 * Designed with bespoke architectural geometry, Linear/Cursor/Raycast aesthetics,
 * zero AI-slop cliches, and seamless zero-configuration local execution.
 */

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '')
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Bespoke Designer Brand Mark for Patze:
 * Precision Geometric Architectural Monogram "P" with an embedded Quantum Signal Core.
 * Represents: Authoritative Physical Host + Local Foundation + Edge Handshake.
 */
function getPatzeLogoSvg({ size = 36 } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pz-pillar" x1="8" y1="4" x2="18" y2="32" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="60%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#3730a3"/>
    </linearGradient>
    <linearGradient id="pz-cantilever" x1="16" y1="4" x2="32" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="pz-core" x1="18" y1="10" x2="24" y2="16" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <filter id="pz-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <!-- Base Chassis -->
  <rect width="36" height="36" rx="9" fill="#090d16" stroke="rgba(255,255,255,0.08)"/>

  <!-- Isometric Left Structural Pillar -->
  <path d="M9 7.5C9 6.67157 9.67157 6 10.5 6H15.5C16.3284 6 17 6.67157 17 7.5V28.5C17 29.3284 16.3284 30 15.5 30H10.5C9.67157 30 9 29.3284 9 28.5V7.5Z" fill="url(#pz-pillar)"/>

  <!-- Architectural Cantilever Head (Forming the Monogram 'P') -->
  <path d="M17 6H23C27.1421 6 30 8.91015 30 13C30 17.0899 27.1421 20 23 20H17V6Z" fill="url(#pz-cantilever)"/>

  <!-- Inner Aperture Cutout -->
  <path d="M17 10.5H22.5C24.1569 10.5 25.5 11.6193 25.5 13C25.5 14.3807 24.1569 15.5 22.5 15.5H17V10.5Z" fill="#07090e"/>

  <!-- Kinetic Signal Diamond Core (Local Host <-> Edge Handshake) -->
  <circle cx="21.5" cy="13" r="2.2" fill="url(#pz-core)" filter="url(#pz-glow)"/>

  <!-- Specular Hairline Highlights -->
  <path d="M10.5 6.5H15.5M17 6.5H23C26.5 6.5 29.2 9 29.2 13C29.2 17 26.5 19.5 23 19.5H17" stroke="rgba(255,255,255,0.35)" stroke-width="0.75" stroke-linecap="round"/>
</svg>`
}

export function renderLoginHtml({ error = null } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — Patze Control Plane</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #06080d;
      --card-bg: rgba(13, 17, 27, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --card-highlight: rgba(255, 255, 255, 0.04);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-glow: rgba(99, 102, 241, 0.25);
      --red: #f43f5e;
      --red-bg: rgba(244, 63, 94, 0.1);
      --green: #10b981;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      background-image:
        radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.16) 0%, transparent 55%),
        radial-gradient(circle at 100% 100%, rgba(56, 189, 248, 0.08) 0%, transparent 40%);
      color: var(--text-main);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }

    .login-container {
      width: 100%;
      max-width: 420px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .brand-mark {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 28px;
    }

    .brand-title {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 20px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #a5b4fc;
      letter-spacing: 0.02em;
    }

    .login-card {
      background: var(--card-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 38px 32px;
      width: 100%;
      box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.65), inset 0 1px 0 var(--card-highlight);
    }

    .card-header {
      margin-bottom: 28px;
      text-align: left;
    }

    .card-title {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin-bottom: 6px;
    }

    .card-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .error-banner {
      background: var(--red-bg);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fecdd3;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 8px;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-icon {
      position: absolute;
      left: 14px;
      color: var(--text-dim);
      pointer-events: none;
      display: flex;
    }

    .form-input {
      width: 100%;
      height: 44px;
      padding: 0 14px 0 42px;
      background: rgba(8, 11, 18, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #ffffff;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .form-input:focus {
      outline: none;
      border-color: var(--accent);
      background: rgba(11, 15, 25, 0.95);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }

    .form-input::placeholder {
      color: var(--text-dim);
    }

    .btn-submit {
      width: 100%;
      height: 44px;
      margin-top: 10px;
      background: linear-gradient(180deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff;
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
      transition: all 0.2s ease;
    }

    .btn-submit:hover {
      background: linear-gradient(180deg, #6d70f5 0%, #5850ec 100%);
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.45);
      transform: translateY(-1px);
    }

    .btn-submit:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
    }

    .trust-footer {
      margin-top: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .security-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-dim);
    }

    .edge-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #6ee7b7;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 3px 10px;
      border-radius: 20px;
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 8px var(--green);
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="brand-mark">
      ${getPatzeLogoSvg({ size: 42 })}
      <div class="brand-title">
        Patze
        <span class="brand-badge">Alpha</span>
      </div>
    </div>

    <div class="login-card">
      <div class="card-header">
        <h1 class="card-title">Sign in to Patze</h1>
        <p class="card-subtitle">Connect to your private online control plane and route tasks to your physical local hosts.</p>
      </div>

      ${error ? `
        <div class="error-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>${escapeHtml(error)}</span>
        </div>
      ` : ''}

      <form method="POST" action="/api/auth/login">
        <div class="form-group">
          <label class="form-label" for="username">User Account</label>
          <div class="input-wrapper">
            <div class="input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <input
              type="text"
              id="username"
              name="username"
              class="form-input"
              placeholder="e.g. brother or pat"
              autocomplete="username"
              required
              autofocus
            >
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="password">Password</label>
          <div class="input-wrapper">
            <div class="input-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <input
              type="password"
              id="password"
              name="password"
              class="form-input"
              placeholder="Enter your account password"
              autocomplete="current-password"
              required
            >
          </div>
        </div>

        <button type="submit" class="btn-submit">
          <span>Sign In to Agent Workspace</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </form>
    </div>

    <div class="trust-footer">
      <div class="edge-status">
        <span class="pulse-dot"></span>
        <span>Cloudflare Edge Active</span>
      </div>
      <div class="security-badge">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span>End-to-End Encrypted Reverse Tunnel • Zero Cloud Execution</span>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function renderDashboardHtml({ user, devices = [], activeDeviceId = null }) {
  const activeDevice = devices.find(d => d.deviceId === activeDeviceId) ||
                       devices.find(d => d.status === 'online') ||
                       devices[0] || null

  const isOnline = activeDevice?.status === 'online'
  const activeWorkspace = activeDevice?.allowedWorkspaces?.[0] || 'Local Project Directory'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Patze — Local Agent Studio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --sidebar-bg: #0a0d15;
      --chat-bg: #07090e;
      --surface: rgba(18, 22, 34, 0.7);
      --surface-border: rgba(255, 255, 255, 0.08);
      --surface-hover: rgba(26, 32, 48, 0.8);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-glow: rgba(99, 102, 241, 0.25);
      --green: #10b981;
      --green-glow: rgba(16, 185, 129, 0.2);
      --red: #f43f5e;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      -webkit-font-smoothing: antialiased;
    }

    /* Top Global Header */
    .app-header {
      height: 56px;
      border-bottom: 1px solid var(--surface-border);
      background: rgba(10, 13, 21, 0.9);
      backdrop-filter: blur(16px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 50;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 12px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.25);
      color: #a5b4fc;
    }

    .header-center {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .model-selector {
      background: rgba(18, 22, 34, 0.8);
      border: 1px solid var(--surface-border);
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 500;
      padding: 6px 12px;
      border-radius: 8px;
      outline: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .model-selector:focus {
      border-color: var(--accent);
    }

    .host-status-pill {
      background: rgba(18, 22, 34, 0.8);
      border: 1px solid var(--surface-border);
      padding: 4px 10px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: ${isOnline ? 'var(--green)' : 'var(--red)'};
      box-shadow: 0 0 8px ${isOnline ? 'var(--green)' : 'var(--red)'};
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .workspace-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.04);
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      max-width: 260px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .workspace-indicator svg { color: #818cf8; flex-shrink: 0; }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #ffffff;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-logout {
      color: var(--text-dim);
      text-decoration: none;
      font-size: 12px;
      padding: 5px 9px;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .btn-logout:hover {
      color: var(--red);
      background: rgba(244, 63, 94, 0.1);
    }

    /* Main Workspace Shell */
    .app-body {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    /* Left Sidebar */
    .app-sidebar {
      width: 260px;
      background: var(--sidebar-bg);
      border-right: 1px solid var(--surface-border);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 16px 12px;
      flex-shrink: 0;
    }

    .btn-new-chat {
      width: 100%;
      height: 38px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #c7d2fe;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn-new-chat:hover {
      background: rgba(99, 102, 241, 0.2);
      color: #ffffff;
    }

    .sidebar-section {
      margin-top: 20px;
      flex: 1;
      overflow-y: auto;
    }

    .sidebar-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
      padding: 0 8px 8px;
    }

    .session-item {
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 13px;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 2px;
      transition: all 0.15s;
    }

    .session-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
    }

    .session-item.active {
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      font-weight: 500;
    }

    /* Host Specs Card in Sidebar */
    .host-card {
      background: rgba(14, 18, 28, 0.7);
      border: 1px solid var(--surface-border);
      border-radius: 10px;
      padding: 12px;
      font-size: 12px;
    }

    .host-card-title {
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .host-spec-row {
      display: flex;
      justify-content: space-between;
      color: var(--text-dim);
      margin-top: 4px;
    }

    .host-spec-val {
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
    }

    /* Center Agent Chat View */
    .app-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--chat-bg);
      position: relative;
      overflow: hidden;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px 20%;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    @media (max-width: 1200px) {
      .chat-messages { padding: 24px 10%; }
    }

    @media (max-width: 768px) {
      .chat-messages { padding: 16px; }
      .app-sidebar { display: none; }
    }

    .message {
      display: flex;
      gap: 14px;
      animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .msg-avatar {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
    }

    .msg-avatar.user {
      background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
      color: #ffffff;
    }

    .msg-avatar.assistant {
      background: #090d16;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .msg-content {
      flex: 1;
      background: var(--surface);
      border: 1px solid var(--surface-border);
      border-radius: 12px;
      padding: 14px 18px;
      font-size: 14px;
      line-height: 1.6;
      color: #e2e8f0;
    }

    .message.user .msg-content {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.25);
    }

    .jev-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: #a5b4fc;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      padding: 2px 8px;
      border-radius: 12px;
      margin-bottom: 8px;
    }

    .proof-card {
      margin-top: 12px;
      background: rgba(5, 7, 12, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }

    .proof-fact {
      color: var(--text-dim);
      display: flex;
      gap: 8px;
      margin-top: 2px;
    }

    .proof-fact span { color: #6ee7b7; }

    /* Input Bar */
    .chat-input-container {
      padding: 16px 20% 24px;
      background: linear-gradient(180deg, transparent 0%, rgba(7, 9, 14, 0.95) 50%);
      flex-shrink: 0;
    }

    @media (max-width: 1200px) {
      .chat-input-container { padding: 16px 10% 24px; }
    }
    @media (max-width: 768px) {
      .chat-input-container { padding: 12px 16px 16px; }
    }

    .quick-chips {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .chip-btn {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--text-muted);
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 16px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }

    .chip-btn:hover {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.35);
      color: #ffffff;
    }

    .input-box {
      background: rgba(14, 18, 28, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
      transition: all 0.2s;
    }

    .input-box:focus-within {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow), 0 10px 30px -10px rgba(0, 0, 0, 0.5);
    }

    .chat-textarea {
      width: 100%;
      background: transparent;
      border: none;
      color: #ffffff;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      resize: none;
      min-height: 48px;
      max-height: 160px;
      line-height: 1.5;
    }

    .chat-textarea::placeholder {
      color: var(--text-dim);
    }

    .input-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .execution-mode-tag {
      font-size: 11px;
      color: #6ee7b7;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .btn-send {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--accent);
      border: none;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-send:hover:not(:disabled) {
      background: var(--accent-hover);
      transform: scale(1.05);
    }

    .btn-send:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header class="app-header">
    <div class="header-left">
      <div class="brand-title">
        ${getPatzeLogoSvg({ size: 28 })}
        <span>Patze</span>
        <span class="brand-badge">Alpha</span>
      </div>

      <div class="host-status-pill">
        <span class="status-dot"></span>
        <span><strong>${escapeHtml(activeDevice?.deviceName || 'Local Machine')}</strong> ${isOnline ? '(Online)' : '(Offline)'}</span>
      </div>
    </div>

    <div class="header-center">
      <select id="modelSelector" class="model-selector">
        <option value="deepseek-v3">DeepSeek V3 (Local Engine)</option>
        <option value="deepseek-r1">DeepSeek R1 (Local Reasoning)</option>
        <option value="kimi-k2.5">Kimi Moonshot K2.5 (Thinking)</option>
        <option value="kimi-k2.7-code">Kimi K2.7 Code</option>
        <option value="moonshot-v1-32k">Kimi Moonshot V1 (32K)</option>
        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
        <option value="claude-3.7-sonnet">Claude 3.7 Sonnet</option>
        <option value="jev-system-1">Jev System 1 (Calibrated Decision)</option>
      </select>
    </div>

    <div class="header-right">
      <a href="/" style="color:var(--accent);text-decoration:none;font-size:12.5px;font-weight:600;padding:5px 12px;background:rgba(99,102,241,0.12);border-radius:8px;border:1px solid rgba(99,102,241,0.25);">DeepSeek Studio</a>
      <a href="/monitor" style="color:#06b6d4;text-decoration:none;font-size:12.5px;font-weight:600;padding:5px 12px;background:rgba(6,182,212,0.12);border-radius:8px;border:1px solid rgba(6,182,212,0.25);">Live Monitor</a>

      <div class="workspace-indicator" title="${escapeHtml(activeWorkspace)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>${escapeHtml(activeWorkspace)}</span>
      </div>

      <div class="user-profile">
        <div class="user-avatar">${escapeHtml(user.name.charAt(0).toUpperCase())}</div>
        <span><strong>${escapeHtml(user.name)}</strong></span>
      </div>

      <a href="/logout" class="btn-logout">Sign Out</a>
    </div>
  </header>

  <!-- Workspace Body -->
  <div class="app-body">
    <!-- Left Sidebar -->
    <aside class="app-sidebar">
      <div>
        <button class="btn-new-chat" onclick="resetChat()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>New Session</span>
        </button>

        <div class="sidebar-section">
          <div class="sidebar-label">Active Session</div>
          <div class="session-item active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>Local Agent Workspace</span>
          </div>
        </div>
      </div>

      <!-- Local Host Card in Sidebar -->
      <div class="host-card">
        <div class="host-card-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span>Local Host Specs</span>
        </div>
        <div class="host-spec-row">
          <span>Device ID</span>
          <span class="host-spec-val">${escapeHtml(activeDevice?.deviceId || 'dev_local')}</span>
        </div>
        <div class="host-spec-row">
          <span>Platform</span>
          <span class="host-spec-val">${escapeHtml(activeDevice?.platform || 'linux')} (${escapeHtml(activeDevice?.arch || 'x64')})</span>
        </div>
        <div class="host-spec-row">
          <span>Execution</span>
          <span class="host-spec-val" style="color: #6ee7b7;">Physical PC</span>
        </div>
      </div>
    </aside>

    <!-- Center Agent Chat Screen -->
    <main class="app-main">
      <div class="chat-messages" id="chatMessages">
        <!-- Assistant Welcome Message -->
        <div class="message assistant">
          <div class="msg-avatar assistant">
            ${getPatzeLogoSvg({ size: 24 })}
          </div>
          <div class="msg-content">
            <div class="jev-tag">
              <span>🧠 Jev System 1 Core Online</span>
            </div>
            <p>
              Hello <strong>${escapeHtml(user.name)}</strong>! I'm <strong>Patze</strong> — your local-first agent running directly on <strong>${escapeHtml(activeDevice?.deviceName || 'your computer')}</strong>.
            </p>
            <p style="margin-top: 8px; color: #94a3b8; font-size: 13px;">
              All terminal commands, code inspection, and file changes execute locally on your physical machine within <code>${escapeHtml(activeWorkspace)}</code>. Zero agent code runs in the cloud.
            </p>
          </div>
        </div>
      </div>

      <!-- Input Bar -->
      <div class="chat-input-container">
        <div class="quick-chips">
          <button class="chip-btn" onclick="sendPrompt('Inspect this workspace. Create a file: patze-local-proof.txt containing: Patze local execution verified on ${escapeHtml(user.name)} PC. Then report: hostname, OS/platform, current working directory, Node version, Git user name, absolute path of the created file. Finally show the git diff.')">
            ⚡ Run Local Proof & Git Diff
          </button>
          <button class="chip-btn" onclick="sendPrompt('Inspect workspace files, git repository status, and report current working directory.')">
            🔍 Inspect Workspace Status
          </button>
          <button class="chip-btn" onclick="sendPrompt('Run Jev System 1 intent classifier and turn-held tool routing check.')">
            🧠 Test Jev System 1 Tool Routing
          </button>
        </div>

        <div class="input-box">
          <textarea
            id="promptInput"
            class="chat-textarea"
            placeholder="Ask Patze to edit files, inspect repository, or execute tasks on your local PC... (Enter to send, Shift+Enter for new line)"
            rows="2"
          ></textarea>

          <div class="input-controls">
            <div class="execution-mode-tag">
              <span class="status-dot"></span>
              <span>Direct Reverse Tunnel to Local Machine</span>
            </div>

            <button id="sendBtn" class="btn-send" onclick="submitMessage()" title="Send task to local host">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    const targetDeviceId = ${JSON.stringify(activeDevice?.deviceId || '')};
    const defaultWorkspace = ${JSON.stringify(activeWorkspace)};
    const userName = ${JSON.stringify(user.name)};

    const promptInput = document.getElementById('promptInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');

    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitMessage();
      }
    });

    function sendPrompt(text) {
      promptInput.value = text;
      submitMessage();
    }

    function resetChat() {
      window.location.reload();
    }

    async function submitMessage() {
      const prompt = promptInput.value.trim();
      if (!prompt) return;

      promptInput.value = '';
      promptInput.disabled = true;
      sendBtn.disabled = true;

      // 1. Append User Message
      appendMessage('user', prompt);

      // 2. Append Assistant Thinking Placeholder
      const thinkingEl = appendThinking();

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: targetDeviceId,
            workspace: defaultWorkspace,
            prompt,
            model: document.getElementById('modelSelector').value
          })
        });

        const data = await res.json();
        thinkingEl.remove();

        if (!res.ok) {
          appendMessage('assistant', '<div style="color:#f43f5e;">❌ Execution Error (' + res.status + '): ' + (data.error || data.message || 'Unknown error') + '</div>');
        } else {
          renderExecutionResult(data);
        }
      } catch (err) {
        thinkingEl.remove();
        appendMessage('assistant', '<div style="color:#f43f5e;">❌ Network / Dispatch Error: ' + err.message + '</div>');
      } finally {
        promptInput.disabled = false;
        sendBtn.disabled = false;
        promptInput.focus();
      }
    }

    function appendMessage(role, html) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message ' + role;

      const avatarDiv = document.createElement('div');
      avatarDiv.className = 'msg-avatar ' + role;
      avatarDiv.innerHTML = role === 'user' ? userName.charAt(0).toUpperCase() : \`${getPatzeLogoSvg({ size: 24 })}\`;

      const contentDiv = document.createElement('div');
      contentDiv.className = 'msg-content';
      contentDiv.innerHTML = typeof html === 'string' && html.startsWith('<') ? html : escapeHtml(html);

      msgDiv.appendChild(avatarDiv);
      msgDiv.appendChild(contentDiv);
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return msgDiv;
    }

    function appendThinking() {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message assistant';
      msgDiv.innerHTML = \`
        <div class="msg-avatar assistant">
          ${getPatzeLogoSvg({ size: 24 })}
        </div>
        <div class="msg-content">
          <div style="display:flex; align-items:center; gap:8px; color:#94a3b8; font-size:13px;">
            <span class="status-dot" style="background:#818cf8; box-shadow:0 0 8px #818cf8;"></span>
            <span>Routing through encrypted tunnel to local machine...</span>
          </div>
        </div>
      \`;
      chatMessages.appendChild(msgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return msgDiv;
    }

    function renderExecutionResult(data) {
      let factsHtml = '';
      if (data.facts) {
        factsHtml = \`
          <div class="proof-card">
            <div style="color:#94a3b8; font-weight:600; margin-bottom:4px;">💻 Physical Execution Proof Facts:</div>
            <div class="proof-fact">• Hostname: <span>\${escapeHtml(data.facts.hostname)}</span></div>
            <div class="proof-fact">• Workspace: <span>\${escapeHtml(data.facts.currentWorkingDirectory)}</span></div>
            <div class="proof-fact">• Node.js: <span>\${escapeHtml(data.facts.nodeVersion)}</span></div>
            <div class="proof-fact">• Git User: <span>\${escapeHtml(data.facts.gitUserName)}</span></div>
            \${data.gitDiff ? \`<div class="proof-fact" style="margin-top:6px;">• Git Diff: <pre style="margin-top:4px; color:#cbd5e1; background:#000; padding:6px; border-radius:4px;">\${escapeHtml(data.gitDiff)}</pre></div>\` : ''}
          </div>
        \`;
      }

      let actionsHtml = '';
      if (data.executedActions && data.executedActions.length) {
        actionsHtml = data.executedActions.map(a => \`
          <div style="margin-top:6px; color:#6ee7b7; font-size:12px;">
            ✓ Action: <strong>\${escapeHtml(a.action)}</strong> (\${escapeHtml(a.file)})
          </div>
        \`).join('');
      }

      const bodyHtml = \`
        <div class="jev-tag">
          <span>✨ Execution Completed on \${escapeHtml(data.deviceName || 'Local Machine')}</span>
        </div>
        <p>I have executed your request directly on your physical hardware.</p>
        \${actionsHtml}
        \${factsHtml}
      \`;

      appendMessage('assistant', bodyHtml);
    }
  </script>
</body>
</html>`
}
