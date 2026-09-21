import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateRequestGate,
  resolveClosedSetAction,
  handleProviderFailure,
  CLOSED_SET_ACTIONS,
} from './cascade.js'

test('evaluateRequestGate classifies action requests vs prose requests', async () => {
  const actionRes = await evaluateRequestGate({ request: 'ช่วยรัน unit test ทั้งหมดที' })
  assert.equal(actionRes.requiresExecution, true)
  assert.ok(actionRes.actionScore > 0.70)
  assert.ok(actionRes.proseSuffices < 0.30)

  const proseRes = await evaluateRequestGate({ request: 'อธิบายว่า monad ใน functional programming คืออะไร' })
  assert.equal(proseRes.requiresExecution, false)
  assert.ok(proseRes.proseSuffices > 0.70)
})

test('resolveClosedSetAction maps natural language to typed functions without LLM', () => {
  const t1 = resolveClosedSetAction('รัน unit test')
  assert.equal(t1.dispatchable, true)
  assert.equal(t1.action, 'run_tests')
  assert.equal(t1.parameters.target, 'unit')

  const t2 = resolveClosedSetAction('สร้างรูป Cyberpunk city skyline at night')
  assert.equal(t2.dispatchable, true)
  assert.equal(t2.action, 'imagine_image')
  assert.equal(t2.parameters.prompt, 'Cyberpunk city skyline at night')

  const t3 = resolveClosedSetAction('สวัสดีครับ วันนี้อากาศดีจัง')
  assert.equal(t3.dispatchable, false)
  assert.equal(t3.action, null)
})

test('handleProviderFailure yields action_dispatched card when action is closed-set', async () => {
  const card = await handleProviderFailure({
    request: 'รัน test ทั้งหมด',
    providerError: new Error('DeepSeek 503 Service Unavailable'),
  })

  assert.equal(card.mode, 'action_dispatched')
  assert.equal(card.requiresLLM, false)
  assert.equal(card.suggestedAction, 'run_tests')
  assert.ok(card.summary.includes('503 Service Unavailable'))
})

test('handleProviderFailure yields prose_unavailable card when query requires generative reasoning', async () => {
  const card = await handleProviderFailure({
    request: 'ช่วยอธิบายความแตกต่างระหว่าง TCP และ UDP ให้ฟังหน่อย',
    providerError: 'Anthropic 429 Rate Limit Exceeded',
  })

  assert.equal(card.mode, 'prose_unavailable')
  assert.equal(card.requiresLLM, true)
  assert.ok(card.summary.includes('exceeds System 1 decision boundaries'))
})
