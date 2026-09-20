/**
 * Patze: Evidence-Driven Autonomous Agent Engineering Platform
 * 
 * Core platform orchestration and custom Cordis plugins.
 */

import * as JevPlugin from './jev/plugin.js'
import { JevEngine } from './jev/engine.js'

export const name = 'patze-core'

export function apply(ctx) {
  console.log('\x1b[36m%s\x1b[0m', '⚡ [Patze] Initialized Patze Autonomous Agent Platform')
  JevPlugin.apply(ctx)
}

export { JevEngine, JevPlugin }
