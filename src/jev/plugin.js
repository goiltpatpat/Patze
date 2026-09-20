/**
 * Cordis Plugin: Patze Jev System 1 Decision, Active Guardrail & Adaptive Routing Layer
 * 
 * Native high-performance ESM plugin:
 * 1. Active Pre-Tool Execution Guardrail (tools/pre-execute waterfall gate: blocks destructive mutations, fork-bombs, secret exfiltration)
 * 2. Active Post-Tool Proof Evaluation (tools/post-execute: detects compiler diagnostics and silent failures)
 * 3. Active System 1 Intent Steering (agent/pre-step: injects Patpat skill guidance and risk signals into agent context)
 * 4. Registered Cordis Microkernel Service `ctx.jev`
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

  if (typeof ctx?.on === 'function') {
    // 🛡️ Active Hook 1: Canonical Pre-Tool Execution Gate (AgentShield Waterfall)
    ctx.on('tools/pre-execute', async (exec, next) => {
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
          console.warn('\x1b[31m%s\x1b[0m', `🛡️ [Patze Jev AgentShield Denied]: ${safety.reason} | Command: "${commandToInspect}"`)
          return {
            kind: 'deny',
            reason: `[Patze Jev AgentShield Security Policy] Execution denied: ${safety.reason}`,
          }
        }
      }

      return next()
    })

    // ⚖️ Active Hook 2: Post-Tool Proof & Diagnostic Watcher
    ctx.on('tools/post-execute', async (exec, result, next) => {
      const decision = await next()
      try {
        if (result?.content && Array.isArray(result.content)) {
          const text = result.content
            .map(b => b?.type === 'text' ? b.text : '')
            .filter(Boolean)
            .join('\n')

          if (text && (/TS[0-9]{4,5}:/.test(text) || /SyntaxError:/.test(text) || /UnhandledPromiseRejection/i.test(text))) {
            const proof = await engine.evaluateProof(text, 'clean execution without compiler diagnostics or unhandled exceptions')
            if (!proof.satisfied && proof.failedAssertions.length > 0) {
              console.warn('\x1b[33m%s\x1b[0m', `⚠️ [Patze Jev Proof Watcher]: Diagnostic issues detected in tool output: ${proof.failedAssertions.join(', ')}`)
            }
          }
        }
      } catch {
        // Non-blocking telemetry
      }
      return decision
    })

    // ⚡ Active Hook 3: Real-time System 1 Fast Intent Routing & Context Steering
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

          if (userText && userText.trim().length > 5 && !userText.trim().startsWith('/')) {
            const route = await engine.routeSkill(userText)
            if (route && route.confidence >= 0.85 && route.skill) {
              console.log('\x1b[35m%s\x1b[0m', `⚡ [Patze Jev System 1 Route]: Inferred "${route.skill}" (Confidence: ${route.confidence}, Latency: ${route.latencyMs}ms)`)

              // Inject System 1 skill context directly into agent if available
              if (agent && typeof agent.inject === 'function') {
                agent.inject({
                  content: [{
                    type: 'text',
                    text: `[Patze Jev System 1 Recommendation]\n• Intent Skill: ${route.skill} (Confidence: ${Math.round(route.confidence * 100)}%)\n• Protocol: Apply "${route.skill}" evidence loop. Always verify changes on authoritative runtime surfaces before claiming completion.`,
                  }],
                  source: { kind: 'plugin', plugin: 'patze-jev' },
                })
              }
            }
          }
        }
      } catch {
        // Non-blocking telemetry
      }

      return decision
    })
  }

  console.log('\x1b[35m%s\x1b[0m', '🧠 [Patze] Jev System 1 Decision, AgentShield & Proof Watcher online')
}
