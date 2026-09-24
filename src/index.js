/**
 * Patze: Evidence-Driven Autonomous Agent Engineering Platform
 * 
 * Core platform orchestration and custom Cordis plugins.
 */

import * as JevPlugin from './jev/plugin.js'
import { JevEngine } from './jev/engine.js'
import { IMAGINE_SYSTEM_PROMPT, registerImagineTools } from './tools/xai-imagine.js'
import { PatzeSearchProvider, PATZE_SEARCH_PROVIDER_ID } from './web/search.js'

export const name = 'patze-core'
export const inject = ['tools']

function mountImaginePrompt(target) {
  if (target?.systemPrompt && typeof target.systemPrompt.section === 'function') {
    target.systemPrompt.section({
      name: 'tool:xai-imagine',
      order: 3200,
      interpolate: false,
      text: IMAGINE_SYSTEM_PROMPT,
    })
  }
}

export function apply(ctx) {
  console.log('\x1b[36m%s\x1b[0m', '⚡ [Patze] Initialized Patze Autonomous Agent Platform')

  // Infallible Safeguard: Ensure TOOL_RUNTIME_SCHEDULER symbol interoperability
  if (ctx.tools) {
    const symFor = Symbol.for('@deepseek-ai/dsh-tools.scheduler')
    const symbols = Object.getOwnPropertySymbols(ctx.tools)
    const schedulerSym = symbols.find(s => String(s).includes('scheduler'))
    if (schedulerSym && ctx.tools[schedulerSym]) {
      ctx.tools[symFor] ??= ctx.tools[schedulerSym]
    }
  }

  JevPlugin.apply(ctx)

  const registered = registerImagineTools(ctx)
  if (registered) {
    console.log('\x1b[32m%s\x1b[0m', '🎨 [Patze] Registered xAI Imagine Suite (xai_imagine_image, xai_imagine_video)')
  } else {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ [Patze] tools registry unavailable; Imagine Suite not registered')
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['systemPrompt'], (inner) => mountImaginePrompt(inner))
    ctx.inject(['web'], (webCtx) => {
      try {
        webCtx.web.registerSearchProvider(new PatzeSearchProvider())
        console.log('\x1b[32m%s\x1b[0m', '🌐 [Patze] Registered Universal Web Search Provider (patze-search)')
      } catch (err) {
        // Silently skip if already registered or unavailable
      }
    })
  } else {
    mountImaginePrompt(ctx)
    if (ctx.web && typeof ctx.web.registerSearchProvider === 'function') {
      try {
        ctx.web.registerSearchProvider(new PatzeSearchProvider())
        console.log('\x1b[32m%s\x1b[0m', '🌐 [Patze] Registered Universal Web Search Provider (patze-search)')
      } catch {}
    }
  }
}

export { JevEngine, JevPlugin }
export { PatzeSearchProvider, PATZE_SEARCH_PROVIDER_ID } from './web/search.js'
export { routeTools, CORE_TOOLS, IMPLIES, PROB_KEEP } from './jev/router.js'
export { rerankCandidates, verifyCitation, DEFAULT_POLICIES } from './jev/rerank.js'
export { evaluateRequestGate, resolveClosedSetAction, handleProviderFailure, CLOSED_SET_ACTIONS } from './jev/cascade.js'


