/**
 * Patze: Evidence-Driven Autonomous Agent Engineering Platform
 * 
 * Core platform orchestration and custom Cordis plugins.
 */

import * as JevPlugin from './jev/plugin.js'
import { JevEngine } from './jev/engine.js'

export const name = 'patze-core'

export interface PatzeConfig {
  version: string
  evidenceDriven: boolean
}

export function apply(ctx: unknown) {
  console.log('\x1b[36m%s\x1b[0m', '⚡ [Patze] Initialized Patze Autonomous Agent Platform')
  // Mount Jev System 1 Decision Layer
  JevPlugin.apply(ctx as JevPlugin.CordisContext)
}

export * from './jev/types.js'
export { JevEngine, JevPlugin }
