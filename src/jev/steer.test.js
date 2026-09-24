import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isOpeningStep, latestUserText, shouldSteer, steerMode } from './steer.js'
import { JevEngine } from './engine.js'

test('isOpeningStep treats missing and first steps as the only steer window', () => {
  assert.equal(isOpeningStep(undefined), true)
  assert.equal(isOpeningStep(0), true)
  assert.equal(isOpeningStep(1), true)
  assert.equal(isOpeningStep(2), false)
  assert.equal(isOpeningStep(3), false)
})

test('shouldSteer fires once per turn fingerprint and never on later steps', () => {
  const fingerprint = 'สร้างวิดีโอสั้น 1 วินาที'
  assert.equal(shouldSteer({ step: 1, turn: 1, fingerprint, prior: undefined }), true)
  assert.equal(shouldSteer({
    step: 1,
    turn: 1,
    fingerprint,
    prior: { turn: 1, fingerprint },
  }), false)
  assert.equal(shouldSteer({ step: 2, turn: 1, fingerprint, prior: undefined }), false)
  assert.equal(shouldSteer({
    step: 1,
    turn: 2,
    fingerprint,
    prior: { turn: 1, fingerprint },
  }), true)
})

test('steerMode keeps media and chat silent so Jev is not a second agent in the transcript', () => {
  assert.equal(steerMode({ intentCategory: 'video-generation' }), 'silent')
  assert.equal(steerMode({ intentCategory: 'image-generation' }), 'silent')
  assert.equal(steerMode({ intentCategory: 'conversational' }), 'silent')
  assert.equal(steerMode({ intentCategory: 'diagnostics', skill: 'patpat-debug', confidence: 0.96 }), 'skill')
  assert.equal(steerMode({ intentCategory: 'diagnostics', skill: 'patpat-debug', confidence: 0.5 }), 'silent')
})

test('latestUserText prefers the last human message over plugin injections', () => {
  const text = latestUserText([
    { source: { kind: 'user' }, content: 'สร้างวิดีโอแมว' },
    { source: { kind: 'plugin:patze-jev' }, content: 'Call xai_imagine_video now' },
  ])
  assert.equal(text, 'สร้างวิดีโอแมว')
})

test('video prompts still classify as video-generation for telemetry', async () => {
  const engine = new JevEngine({ apiKey: '' })
  const route = await engine.routeSkill('สร้างวิดีโอสั้น 1 วินาที: ลูกโป่งแดง')
  assert.equal(route.intentCategory, 'video-generation')
  assert.equal(steerMode(route), 'silent')
})

test('injected message sources satisfy Harness V4 producer-owned admission rules', () => {
  const checkSource = (source) => {
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
      throw new Error('source must be an object')
    }
    if (typeof source.kind !== 'string' || source.kind.length === 0 || source.kind === 'plugin') {
      throw new Error('format v4 message requires a producer-owned source kind')
    }
  }

  // Retired V3 wrapper must fail
  assert.throws(() => checkSource({ kind: 'plugin', plugin: 'patze-jev' }), /format v4 message requires a producer-owned source kind/)

  // Producer-owned V4 source must succeed
  assert.doesNotThrow(() => checkSource({ kind: 'plugin:patze-jev' }))
})
