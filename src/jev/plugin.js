/**
 * Cordis Plugin: Patze Jev System 1 Decision & Active Guardrail Layer
 * 
 * Native high-performance ESM plugin:
 * 1. Active Sub-millisecond Safety Guardrails for all tool executions (blocks rm -rf /, disk wipes, protected git force push)
 * 2. Active System 1 Fast Intent Routing & Log Observation for user prompts
 * 3. Registered Cordis Service `ctx.jev`
 */

import { JevEngine } from './engine.js'

export const name = 'patze-jev'

export function apply(ctx, config = {}) {
  const engine = new JevEngine(config)

  const service = {
    engine,
    routeSkill: (prompt) => engine.routeSkill(prompt),
    checkSafety: (command) => engine.checkSafety(command),
    evaluateProof: (output, contract) => engine.evaluateProof(output, contract),
  }

  if (typeof ctx?.provide === 'function') {
    ctx.provide('jev', service)
  }

  // Active Hook 1: Real-time System 1 Safety Guardrail on Tool Executions
  if (typeof ctx?.on === 'function') {
    ctx.on('tools/execute', async (exec, next) => {
      let commandToInspect = ''
      if (exec?.arguments && typeof exec.arguments === 'object') {
        const args = exec.arguments
        commandToInspect = args.command || args.text || args.code || args.cmd || ''
      } else if (typeof exec?.arguments === 'string') {
        commandToInspect = exec.arguments
      }

      if (commandToInspect && typeof commandToInspect === 'string') {
        const safety = await engine.checkSafety(commandToInspect)
        if (!safety.safe) {
          console.warn('\x1b[31m%s\x1b[0m', `🛡️ [Patze Jev Guardrail Blocked]: ${safety.reason} | Command: "${commandToInspect}"`)
          return {
            content: [{
              type: 'text',
              text: `🛡️ [Patze Jev System 1 Guardrail Blocked]: Execution prevented. Reason: ${safety.reason}`
            }],
            isError: true,
            error: {
              message: safety.reason,
              info: { name: 'JevSecurityGuardrailError', code: 'JEV_BLOCKED' }
            }
          }
        }
      }

      return next()
    })

    // Active Hook 2: Real-time System 1 Fast Intent Routing & Observation
    ctx.on('agent/pre-step', async ({ agent, messages, signal }, next) => {
      const decision = await next()
      if (decision?.kind === 'reject') return decision

      try {
        if (Array.isArray(messages)) {
          const userMsg = typeof messages.findLast === 'function'
            ? messages.findLast(m => m?.source?.kind === 'user' || m?.role === 'user')
            : messages[messages.length - 1]

          let userText = ''
          if (Array.isArray(userMsg?.content)) {
            userText = userMsg.content.map(c => c?.text || '').join(' ')
          } else if (typeof userMsg?.content === 'string') {
            userText = userMsg.content
          }

          if (userText && userText.trim().length > 3 && !userText.trim().startsWith('/')) {
            const route = await engine.routeSkill(userText)
            if (route && route.confidence >= 0.90 && route.skill) {
              console.log('\x1b[35m%s\x1b[0m', `⚡ [Patze Jev System 1 Route]: Inferred "${route.skill}" (Confidence: ${route.confidence}, Latency: ${route.latencyMs}ms)`)
            }
          }
        }
      } catch {
        // Non-blocking telemetry
      }

      return decision
    })
  }

  console.log('\x1b[35m%s\x1b[0m', '🧠 [Patze] Jev System 1 Decision & Active Guardrail Layer online')
}
