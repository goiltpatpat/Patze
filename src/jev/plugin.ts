/**
 * Cordis Plugin: Patze Jev System 1 Decision Layer
 */

import { JevEngine } from './engine.js'
import type { JevConfig } from './types.js'

export const name = 'patze-jev'

export interface JevService {
  engine: JevEngine
  routeSkill: JevEngine['routeSkill']
  checkSafety: JevEngine['checkSafety']
  evaluateProof: JevEngine['evaluateProof']
}

// Any generic Cordis context
export interface CordisContext {
  set?(name: string, value: unknown): void
  provide?(name: string): void
  on?(event: string, listener: (...args: unknown[]) => unknown): void
}

export function apply(ctx: CordisContext, config: JevConfig = {}) {
  const engine = new JevEngine(config)

  const service: JevService = {
    engine,
    routeSkill: (prompt) => engine.routeSkill(prompt),
    checkSafety: (command) => engine.checkSafety(command),
    evaluateProof: (output, contract) => engine.evaluateProof(output, contract),
  }

  if (typeof ctx?.set === 'function') {
    ctx.set('patze.jev', service)
  }

  console.log('\x1b[35m%s\x1b[0m', '🧠 [Patze] Jev System 1 Decision & Routing Layer active')
}
