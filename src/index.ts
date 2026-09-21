/**
 * Patze: Evidence-Driven Autonomous Agent Engineering Platform
 * 
 * Core platform orchestration and custom Cordis plugins.
 */

import * as JevPlugin from './jev/plugin.js'
import { JevEngine } from './jev/engine.js'
import { IMAGINE_SYSTEM_PROMPT, registerImagineTools } from './tools/xai-imagine.js'

export const name = 'patze-core'
export const inject = ['tools']

export interface PatzeConfig {
  version: string
  evidenceDriven: boolean
}

function mountImaginePrompt(target: any) {
  if (target?.systemPrompt && typeof target.systemPrompt.section === 'function') {
    target.systemPrompt.section({
      name: 'tool:xai-imagine',
      order: 3200,
      interpolate: false,
      text: IMAGINE_SYSTEM_PROMPT,
    })
  }
}

export function apply(ctx: any) {
  console.log('\x1b[36m%s\x1b[0m', '⚡ [Patze] Initialized Patze Autonomous Agent Platform')
  JevPlugin.apply(ctx as JevPlugin.CordisContext)

  const registered = registerImagineTools(ctx)
  if (registered) {
    console.log('\x1b[32m%s\x1b[0m', '🎨 [Patze] Registered xAI Imagine Suite (xai_imagine_image, xai_imagine_video)')
  } else {
    console.warn('\x1b[33m%s\x1b[0m', '⚠️ [Patze] tools registry unavailable; Imagine Suite not registered')
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['systemPrompt'], (inner: any) => mountImaginePrompt(inner))
  } else {
    mountImaginePrompt(ctx)
  }
}

export * from './jev/types.js'
export { JevEngine, JevPlugin }
export { routeTools, CORE_TOOLS, IMPLIES, PROB_KEEP } from './jev/router.js'
export { rerankCandidates, verifyCitation, DEFAULT_POLICIES } from './jev/rerank.js'

