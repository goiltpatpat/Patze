/**
 * Adversarial Test Suite for Patze Control Plane & Jev System 1 Architecture.
 *
 * Covers:
 * 1. Intent Safety (Negative intent, Explanation intent, Planning without execution)
 * 2. Closed-Set Dispatcher (False dispatches, Ambiguous multi-action collisions, Operational signals)
 * 3. Provider Failure & Cascade (Timeout, 429, 500, 503, Malformed, Unavailable TypeSafe/LLM)
 * 4. Tool Router Integrity (Turn changes, Agent isolation, Catalog mutation, Eviction, Fail-open)
 * 5. Control-Loop Integrity (Preservation of FRAME -> INSPECT -> PROOF -> ACT -> VERIFY)
 * 6. Latency & Token Economy Benchmarks (Local Jev vs Remote TypeSafe vs LLM, Tool reduction)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateRequestGate,
  resolveClosedSetAction,
  handleProviderFailure,
  CLOSED_SET_ACTIONS,
} from './cascade.js'
import {
  routeTools,
  classifyTurnIntent,
  clearTurnCache,
  getTurnCacheSize,
  CORE_TOOLS,
} from './router.js'
import { JevEngine } from './engine.js'

// Realistic full catalog of tools in DeepSeek Harness / Patze
const FULL_CATALOG = [
  { name: 'read', description: 'Read file contents' },
  { name: 'write', description: 'Write file contents' },
  { name: 'edit', description: 'Edit file contents' },
  { name: 'bash', description: 'Execute shell command' },
  { name: 'glob', description: 'Find files matching pattern' },
  { name: 'grep', description: 'Search text patterns in files' },
  { name: 'present', description: 'Present artifacts to user' },
  { name: 'ask_user_question', description: 'Prompt user for choices' },
  { name: 'job_output', description: 'Read background job output' },
  { name: 'job_kill', description: 'Terminate background job' },
  { name: 'web_search', description: 'Search the public web' },
  { name: 'fetch_web_page', description: 'Scrape web page' },
  { name: 'xai_imagine_image', description: 'Generate photo/art via xAI' },
  { name: 'xai_imagine_video', description: 'Generate video via xAI' },
  { name: 'ast_grep', description: 'AST structural search' },
]

/* ========================================================================= */
/* 1. INTENT SAFETY                                                          */
/* ========================================================================= */

test('1.1 Negative Intent: prevents execution on explicit prohibitions (Thai & English)', async () => {
  const negativeCases = [
    'อย่ารัน test',
    'ห้ามรันเทสเด็ดขาด',
    'ไม่ต้องรัน test',
    'สร้างแผน ไม่ต้อง execute',
    'อย่าวาดรูป',
    'ห้ามบิลด์โปรเจกต์',
    'don\'t run tests',
    'do not run tests',
    'never run tests',
    'skip tests and do not execute',
    'create a plan without executing',
    'don\'t build, just review the config',
  ]

  for (const input of negativeCases) {
    const gate = await evaluateRequestGate({ request: input })
    const dispatch = resolveClosedSetAction(input)
    const card = await handleProviderFailure({ request: input, providerError: '503 Provider Outage' })

    // Invariant: Gate must NEVER mark explicit negative commands as requiresExecution
    assert.equal(gate.requiresExecution, false, `Gate failed to block negative intent: "${input}"`)
    assert.ok(gate.proseSuffices >= 0.80, `proseSuffices too low for negative intent: "${input}"`)

    // Invariant: Dispatcher must refuse closed-set action on negative intent
    assert.equal(dispatch.dispatchable, false, `Dispatcher falsely dispatched negative intent: "${input}"`)
    assert.equal(dispatch.action, null, `Action not null for negative intent: "${input}"`)
    assert.equal(dispatch.refusalReason, 'negative_intent', `Refusal reason mismatch for: "${input}"`)

    // Invariant: Provider failure fallback must NEVER yield action_dispatched
    assert.notEqual(card.mode, 'action_dispatched', `Fallback card dispatched negative intent: "${input}"`)
    assert.equal(card.requiresLLM, true, `requiresLLM must remain true for: "${input}"`)
  }
})

test('1.2 Explanation Intent: prevents execution on how-to and tutorial inquiries', async () => {
  const explanationCases = [
    'อธิบายวิธีรัน test',
    'สอนวิธีบิลด์โปรเจกต์หน่อย',
    'คำสั่งสำหรับรันเทสคืออะไร',
    'how to run test without executing',
    'explain how to build the project',
    'what is the command to test',
    'show me how to generate an image',
    'tutorial on running integration tests',
  ]

  for (const input of explanationCases) {
    const gate = await evaluateRequestGate({ request: input })
    const dispatch = resolveClosedSetAction(input)
    const card = await handleProviderFailure({ request: input, providerError: '429 Rate Limit' })

    // Invariant: Explanation must not force execution
    assert.equal(gate.requiresExecution, false, `Gate failed to identify explanation intent: "${input}"`)
    assert.equal(dispatch.dispatchable, false, `Dispatcher falsely dispatched explanation inquiry: "${input}"`)
    assert.ok(
      ['explanation_request', 'negative_intent'].includes(dispatch.refusalReason),
      `Refusal reason mismatch for: "${input}" (got ${dispatch.refusalReason})`
    )

    // Invariant: Card must indicate prose/reasoning required
    assert.equal(card.mode, 'prose_unavailable', `Card should be prose_unavailable for: "${input}"`)
  }
})

test('1.3 Ambiguous & Mixed Intent: requests with mixed signals do not false-dispatch', async () => {
  const mixedCases = [
    'อธิบายโค้ดนี้แล้วก็รันเทสให้ด้วยถ้าว่าง',
    'อาจจะรัน test หรือไม่อาจจะไม่รัน',
    'maybe test or maybe just think about it',
  ]

  for (const input of mixedCases) {
    const dispatch = resolveClosedSetAction(input)
    // Invariant: Ambiguous mixed intent must not blindly dispatch
    assert.equal(dispatch.dispatchable, false, `Dispatcher dispatched ambiguous input: "${input}"`)
  }
})

/* ========================================================================= */
/* 2. CLOSED-SET DISPATCHER INTEGRITY                                        */
/* ========================================================================= */

test('2.1 Multi-Action Collision: refusing dispatch when multiple actions match', () => {
  const collisionInputs = [
    'เช็ค git status แล้วก็รัน test ด้วย',
    'บิลด์โปรเจกต์แล้วรันเทส',
    'build project and run tests',
    'check git status and imagine image',
  ]

  for (const input of collisionInputs) {
    const dispatch = resolveClosedSetAction(input)
    assert.equal(dispatch.dispatchable, false, `Colliding actions must not dispatch: "${input}"`)
    assert.equal(dispatch.refusalReason, 'ambiguous_multiple_actions', `Expected ambiguous_multiple_actions for: "${input}"`)
    assert.ok(dispatch.matchedActions && dispatch.matchedActions.length > 1, `matchedActions must list collisions for: "${input}"`)
  }
})

test('2.2 Operational Signal Metadata: confidence values labeled as heuristic_operational', () => {
  const dispatch = resolveClosedSetAction('รัน unit test เดี๋ยวนี้')
  assert.equal(dispatch.dispatchable, true)
  assert.equal(dispatch.action, 'run_tests')
  assert.equal(dispatch.parameters.target, 'unit')
  assert.equal(dispatch.signalType, 'heuristic_operational', 'Confidence must be declared as operational signal, NOT calibrated probability')
})

test('2.3 Unknown Actions: requests outside closed set remain undispatched', () => {
  const unknownInputs = [
    'เขียนเกม 3d ด้วย Three.js',
    'แปลเอกสารนี้เป็นภาษาเยอรมัน',
    'compose a piano sonata in c minor',
    'calculate pi to 100 decimal places',
  ]

  for (const input of unknownInputs) {
    const dispatch = resolveClosedSetAction(input)
    assert.equal(dispatch.dispatchable, false)
    assert.equal(dispatch.action, null)
    assert.equal(dispatch.refusalReason, 'no_matching_action')
  }
})

/* ========================================================================= */
/* 3. PROVIDER FAILURE / CASCADE HANDLING                                    */
/* ========================================================================= */

test('3.1 Provider Failure Modes: handles timeouts, 429, 500, 503, and malformed errors', async () => {
  const errorVariations = [
    new Error('ETIMEDOUT: Connection timed out after 30000ms'),
    new Error('429 Too Many Requests: Rate limit exceeded for organization'),
    new Error('500 Internal Server Error from upstream gateway'),
    new Error('503 Service Unavailable: High load / failover'),
    new SyntaxError('Unexpected token < in JSON at position 0'),
    'Unknown raw string error without Error instance',
    null,
    undefined,
  ]

  for (const err of errorVariations) {
    // Sub-case A: Deterministic actionable command still dispatches safely
    const actionCard = await handleProviderFailure({
      request: 'รัน test',
      providerError: err,
    })
    assert.equal(actionCard.mode, 'action_dispatched', `Deterministic action failed to dispatch under error: ${err}`)
    assert.equal(actionCard.suggestedAction, 'run_tests')
    assert.equal(actionCard.requiresLLM, false)

    // Sub-case B: Generative reasoning query correctly blocked and flagged
    const proseCard = await handleProviderFailure({
      request: 'ช่วยแต่งกลอนเกี่ยวกับท้องฟ้ายามเย็น',
      providerError: err,
    })
    assert.equal(proseCard.mode, 'prose_unavailable', `Generative query was not blocked under error: ${err}`)
    assert.equal(proseCard.requiresLLM, true)
  }
})

/* ========================================================================= */
/* 4. TOOL ROUTER INTEGRITY                                                  */
/* ========================================================================= */

test('4.1 Turn and Step Caching: holds toolset constant across steps of same turn', async () => {
  clearTurnCache()

  // Step 1: conversational prompt
  const step1 = await routeTools({
    userText: 'สวัสดีครับ',
    tools: FULL_CATALOG,
    turn: 10,
    step: 1,
    agentId: 'agent-alpha',
  })

  // Step 2: userText differs or is empty during assistant loop steps
  const step2 = await routeTools({
    userText: '',
    tools: FULL_CATALOG,
    turn: 10,
    step: 2,
    agentId: 'agent-alpha',
  })

  assert.equal(step1.length, step2.length, 'Toolset must remain frozen across steps of the same turn')
  assert.deepEqual(step1.map(t => t.name), step2.map(t => t.name))
  assert.equal(getTurnCacheSize(), 1)
})

test('4.2 Agent Isolation: distinct agent IDs do not collide in turn cache', async () => {
  clearTurnCache()

  const agent1 = await routeTools({
    userText: 'สวัสดีครับ', // conversational -> core tools only
    tools: FULL_CATALOG,
    turn: 1,
    step: 1,
    agentId: 'parent-agent',
  })

  const agent2 = await routeTools({
    userText: 'สร้างวิดีโอผีเสื้อบิน', // video -> xai_imagine_video + core
    tools: FULL_CATALOG,
    turn: 1,
    step: 1,
    agentId: 'specialist-subagent',
  })

  assert.equal(agent1.some(t => t.name === 'xai_imagine_video'), false)
  assert.equal(agent2.some(t => t.name === 'xai_imagine_video'), true)
  assert.equal(getTurnCacheSize(), 2, 'Cache should isolate distinct agents on the same turn')
})

test('4.3 Dynamic Catalog Invalidation: catalog changes within same turn update safely', async () => {
  clearTurnCache()

  // First invocation with 10 tools
  const subset = FULL_CATALOG.slice(0, 10)
  const res1 = await routeTools({
    userText: 'รันเทสและเขียนโค้ด',
    tools: subset,
    turn: 5,
    step: 1,
    agentId: 'agent-beta',
  })

  // Second invocation dynamically adds xai_imagine_video
  const res2 = await routeTools({
    userText: 'สร้างวิดีโอผีเสื้อบิน',
    tools: FULL_CATALOG, // Full 15 tools
    turn: 5,
    step: 1,
    agentId: 'agent-beta',
  })

  assert.equal(res2.some(t => t.name === 'xai_imagine_video'), true)
  assert.equal(getTurnCacheSize(), 2, 'Distinct catalog fingerprints must not return stale subset')
})

test('4.4 Fail-Open Robustness: malformed tools, undefined entries, and errors do not crash router', async () => {
  const malformedCatalog = [
    null,
    undefined,
    {},
    { name: 12345 },
    { name: 'read', description: 'valid read' },
    { name: 'write' },
  ]

  const routed = await routeTools({
    userText: 'สวัสดีครับ',
    tools: malformedCatalog,
    turn: 99,
    step: 1,
    bypassCache: true,
  })

  assert.ok(Array.isArray(routed))
  assert.equal(routed.some(t => t.name === 'read'), true)
  assert.equal(routed.some(t => t === null || t === undefined), false, 'Malformed elements must be cleanly filtered')
})

test('4.5 Cache Eviction Boundary: oldest entry evicted when exceeding MAX_CACHE_ENTRIES', async () => {
  clearTurnCache()

  for (let i = 0; i < 110; i++) {
    await routeTools({
      userText: 'สวัสดี',
      tools: FULL_CATALOG,
      turn: i,
      step: 1,
      agentId: `agent-${i}`,
    })
  }

  assert.ok(getTurnCacheSize() <= 100, `Cache size (${getTurnCacheSize()}) must not exceed MAX_CACHE_ENTRIES (100)`)
})

/* ========================================================================= */
/* 5. CONTROL-LOOP INTEGRITY & SAFETY GATES                                   */
/* ========================================================================= */

test('5.1 Pre-Execute AgentShield Guardrail: destructive commands blocked regardless of tool routing', async () => {
  const engine = new JevEngine()

  const dangerousCommands = [
    'rm -rf /',
    'rm -rf /usr/bin',
    ':(){ :|:& };:',
    'cat /dev/urandom > /dev/sda',
  ]

  for (const cmd of dangerousCommands) {
    const safety = await engine.checkSafety(cmd)
    assert.equal(safety.safe, false, `Dangerous command was not caught: "${cmd}"`)
    assert.ok(safety.reason.length > 0)
  }

  const safeCommands = [
    'git status',
    'pnpm test',
    'node --version',
  ]

  for (const cmd of safeCommands) {
    const safety = await engine.checkSafety(cmd)
    assert.equal(safety.safe, true, `Benign command was falsely blocked: "${cmd}"`)
  }
})

test('5.2 Proof Diagnostic Gate: detects unhandled exceptions and compiler errors in tool output', async () => {
  const engine = new JevEngine()

  const brokenOutput = `
    src/index.ts(32,5): error TS2304: Cannot find name 'unresolvedIdentifier'.
    at Object.run (/workspace/app.js:45:12)
    AssertionError [ERR_ASSERTION]: Expected true but got false
  `

  const proof = await engine.evaluateProof(brokenOutput, 'clean execution without compiler errors or assertions')
  assert.equal(proof.satisfied, false, 'Proof must fail when compiler diagnostics or AssertionError present')
  assert.ok(proof.failedAssertions.length > 0)

  const cleanOutput = '✔ 24 tests passed in 12ms (0 failed)'
  const cleanProof = await engine.evaluateProof(cleanOutput, 'clean test run')
  assert.equal(cleanProof.satisfied, true, 'Clean output must satisfy proof')
})

/* ========================================================================= */
/* 6. MEASUREMENT & BENCHMARKS                                               */
/* ========================================================================= */

test('6.1 Latency Separation Benchmark: measure local Jev System 1 overhead', async () => {
  const N = 100

  // Benchmark Local Intent Classification
  const t0 = performance.now()
  for (let i = 0; i < N; i++) {
    classifyTurnIntent('แก้บั๊กใน src/jev/router.js และรันเทส unit')
  }
  const localIntentLatencyMs = (performance.now() - t0) / N

  // Benchmark Closed-Set Dispatcher
  const t1 = performance.now()
  for (let i = 0; i < N; i++) {
    resolveClosedSetAction('รัน unit test')
  }
  const localDispatchLatencyMs = (performance.now() - t1) / N

  // Benchmark Request Gate
  const t2 = performance.now()
  for (let i = 0; i < N; i++) {
    await evaluateRequestGate({ request: 'อธิบายวิธีรัน test' })
  }
  const localGateLatencyMs = (performance.now() - t2) / N

  // Benchmark Tool Router
  const t3 = performance.now()
  for (let i = 0; i < N; i++) {
    await routeTools({
      userText: 'สวัสดีครับ',
      tools: FULL_CATALOG,
      turn: 1,
      step: 1,
      bypassCache: true,
    })
  }
  const localRouterLatencyMs = (performance.now() - t3) / N

  console.log('\n📊 [Patze Jev System 1 Latency Measurements]:')
  console.log(`  • Local Intent Classifier Latency:  ${localIntentLatencyMs.toFixed(4)} ms/op`)
  console.log(`  • Local Closed-Set Dispatch Latency: ${localDispatchLatencyMs.toFixed(4)} ms/op`)
  console.log(`  • Local Request Gate Latency:        ${localGateLatencyMs.toFixed(4)} ms/op`)
  console.log(`  • Local Turn Tool Router Latency:    ${localRouterLatencyMs.toFixed(4)} ms/op`)

  // Invariants: Local System 1 heuristics must execute under 1ms per operation
  assert.ok(localIntentLatencyMs < 1.0, 'Intent classifier must execute in < 1ms')
  assert.ok(localDispatchLatencyMs < 1.0, 'Closed-set dispatcher must execute in < 1ms')
  assert.ok(localGateLatencyMs < 1.0, 'Request gate must execute in < 1ms')
  assert.ok(localRouterLatencyMs < 2.0, 'Tool router must execute in < 2ms')
})

test('6.2 Tool-Surface & Token Reduction Measurement', async () => {
  const fullJsonChars = JSON.stringify(FULL_CATALOG).length
  const fullToolCount = FULL_CATALOG.length

  // Scenario A: Conversational turn (greetings)
  const conversationalTools = await routeTools({
    userText: 'สวัสดีครับ เป็นไงบ้าง',
    tools: FULL_CATALOG,
    turn: 1,
    step: 1,
    bypassCache: true,
  })
  const convJsonChars = JSON.stringify(conversationalTools).length
  const convToolCount = conversationalTools.length

  const toolReductionPct = ((fullToolCount - convToolCount) / fullToolCount) * 100
  const charReductionPct = ((fullJsonChars - convJsonChars) / fullJsonChars) * 100

  console.log('\n📉 [Patze Jev Tool-Surface & Token Economy Measurements]:')
  console.log(`  • Available Catalog:     ${fullToolCount} tools (${fullJsonChars} JSON chars)`)
  console.log(`  • Conversational Active:  ${convToolCount} tools (${convJsonChars} JSON chars)`)
  console.log(`  • Tool Surface Reduction: -${toolReductionPct.toFixed(1)}%`)
  console.log(`  • Estimated Token Delta:  -${charReductionPct.toFixed(1)}% prompt schema tokens`)

  // Verify tangible reduction
  assert.ok(convToolCount < fullToolCount, 'Conversational turn must reduce tool count')
  assert.ok(convJsonChars < fullJsonChars, 'Conversational turn must reduce schema characters')
  assert.ok(toolReductionPct >= 30.0, `Must achieve at least 30% tool reduction on casual conversational turns (got ${toolReductionPct.toFixed(1)}%)`)
})
