/**
 * Cordis Plugin: Patze Jev System 1 Decision, Active Guardrail & Adaptive Routing Layer
 * 
 * Native high-performance ESM plugin:
 * 1. Active Pre-Tool Execution Guardrail (tools/pre-execute waterfall gate: blocks destructive mutations, fork-bombs, secret exfiltration)
 * 2. Active Post-Tool Proof Evaluation (tools/post-execute: detects compiler diagnostics and silent failures)
 * 3. System 1 route on agent/pre-step (once per turn; media stays silent)
 * 4. Registered Cordis Microkernel Service `ctx.jev`
 */

import { JevEngine } from './engine.js'
import { latestUserText, shouldSteer, steerMode } from './steer.js'
import { routeTools } from './router.js'
import { rerankCandidates, verifyCitation, DEFAULT_POLICIES } from './rerank.js'

export const name = 'patze-jev'

export function apply(ctx, config = {}) {
  const engine = new JevEngine(config)
  const steered = new WeakMap()
  const pendingTurnText = new Map()

  const service = {
    engine,
    routeSkill: (prompt) => engine.routeSkill(prompt),
    checkSafety: (command) => engine.checkSafety(command),
    evaluateProof: (output, contract) => engine.evaluateProof(output, contract),
    routeTools: (params) => routeTools({ engine, ...params }),
    rerankCandidates: (query, candidates, options) => engine.rerankCandidates(query, candidates, options),
    verifyCitation: (claim, sourceText) => engine.verifyCitation(claim, sourceText),
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

          if (text && (/TS[0-9]{4,5}:/.test(text) || /SyntaxError:/.test(text) || /UnhandledPromiseRejection/i.test(text) || /AssertionError/i.test(text))) {
            const proof = await engine.evaluateProof(text, 'clean execution without compiler diagnostics or unhandled exceptions')
            if (!proof.satisfied && proof.failedAssertions.length > 0) {
              console.warn('\x1b[33m%s\x1b[0m', `⚠️ [Patze Jev Proof Watcher]: Diagnostic issues detected in tool output: ${proof.failedAssertions.join(', ')}`)
              if (exec?.agent && typeof exec.agent.inject === 'function') {
                exec.agent.inject({
                  content: [{
                    type: 'text',
                    text: `[Patze Jev Diagnostic Gate] Warning: Tool execution produced diagnostics (${proof.failedAssertions.join('; ')}). Focus on resolving this failure before advancing.`,
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

    // 🎯 Active Hook 4: Turn-Held Tool Routing & Prompt-Cache Preservation (Nitro Architecture)
    ctx.on('agent/inbox/claimed', ({ message, turn, agent }) => {
      try {
        const text = latestUserText([message])
        if (text && agent?.id) {
          pendingTurnText.set(`${agent.id}:${turn}`, text)
        }
      } catch {
        // Non-blocking telemetry
      }
    })

    ctx.on('system-prompt/assemble', async (assembly, context, next) => {
      const result = await next()
      try {
        const agent = context?.agent || context?.scope
        const agentId = agent?.id || 'agent'
        const turn = agent?.phase?.turn ?? 1
        const turnKey = `${agentId}:${turn}`
        let userText = pendingTurnText.get(turnKey) || ''

        if (!userText && agent?.session?.log) {
          for (let i = agent.session.log.length - 1; i >= 0; i--) {
            const ev = agent.session.log[i]
            if (ev?.type === 'user/message') {
              userText = latestUserText([ev.data])
              if (userText) break
            }
          }
        }

        if (Array.isArray(result?.tools) && result.tools.length > 0) {
          const routedTools = await routeTools({
            engine,
            userText,
            tools: result.tools,
            turn,
            agentId,
          })
          return {
            ...result,
            tools: routedTools,
          }
        }
      } catch {
        // Fail-open: keep full tools on any router exception
      }
      return result
    })

    ctx.on('agent/pre-step', async ({ agent, messages, turn, step }, next) => {
      const decision = await next()
      if (decision?.kind === 'reject') return decision

      try {
        const userText = latestUserText(messages)
        if (!userText || userText.length <= 3 || userText.startsWith('/')) return decision
        if (!shouldSteer({ step, turn, fingerprint: userText, prior: agent ? steered.get(agent) : undefined })) {
          return decision
        }
        if (agent) steered.set(agent, { turn, fingerprint: userText })

        const route = await engine.routeSkill(userText)
        const mode = steerMode(route)
        if (route?.intentCategory === 'video-generation' || route?.intentCategory === 'image-generation') {
          const toolName = route.intentCategory === 'video-generation' ? 'xai_imagine_video' : 'xai_imagine_image'
          const modelName = route.intentCategory === 'video-generation' ? 'grok-imagine-video-1.5' : 'grok-imagine-image-2.0'
          console.log('\x1b[35m%s\x1b[0m', `🎨 [Patze Jev]: ${toolName} (${modelName})`)
        } else if (mode === 'skill') {
          console.log('\x1b[35m%s\x1b[0m', `⚡ [Patze Jev]: ${route.skill} (${Math.round(route.confidence * 100)}%)`)
          if (agent && typeof agent.inject === 'function') {
            agent.inject({
              content: [{
                type: 'text',
                text: `[Patze Jev]\n• Skill: ${route.skill}\n• Verify on the authoritative runtime surface before claiming completion.`,
              }],
              source: { kind: 'plugin', plugin: 'patze-jev' },
            })
          }
        }
      } catch {
        // Non-blocking telemetry
      }

      return decision
    })
  }

  console.log('\x1b[35m%s\x1b[0m', '🧠 [Patze] Jev System 1 Decision, Tool Router & Proof Watcher online')
}

export { routeTools }
export { rerankCandidates, verifyCitation, DEFAULT_POLICIES }


