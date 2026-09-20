/**
 * Cordis Plugin: Patze Jev System 1 Decision Layer
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

  console.log('\x1b[35m%s\x1b[0m', '🧠 [Patze] Jev System 1 Decision & Routing Layer active')
}
