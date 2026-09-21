import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

import { JevEngine } from '../jev/engine.js'
import {
  VIDEO_MODEL,
  VIDEO_GENERATIONS_URL,
  generateImagineVideo,
  registerImagineTools,
  safeFilename,
} from './xai-imagine.js'

const mp4 = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x20]),
  Buffer.from('ftypisom'),
  Buffer.alloc(24, 0),
])

const tmpFiles = []

after(() => {
  for (const file of tmpFiles) {
    try { rmSync(file) } catch { /* already gone */ }
  }
})

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(body)).buffer,
  }
}

function binaryResponse(status, buf) {
  const copy = Uint8Array.from(buf)
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => Buffer.from(copy).toString('binary'),
    arrayBuffer: async () => copy.buffer,
  }
}

test('video prompts route to xai_imagine_video, not image or a Patpat skill', async () => {
  const engine = new JevEngine({ apiKey: '' })
  const video = await engine.routeSkill('สร้างวิดีโอแมววิ่งเล่นในสวน')
  assert.equal(video.intentCategory, 'video-generation')
  assert.equal(video.skill, null)
  assert.match(video.reasoning, /xai_imagine_video/)
  assert.match(video.reasoning, /grok-imagine-video-1.5/)

  const image = await engine.routeSkill('สร้างรูปแมวน่ารัก')
  assert.equal(image.intentCategory, 'image-generation')
  assert.equal(image.skill, null)
})

test('registerImagineTools exposes xai_imagine_video on the host registry', () => {
  const names = []
  const ok = registerImagineTools({
    tools: { register: (tool) => names.push(tool.name) },
  })
  assert.equal(ok, true)
  assert.deepEqual(names, ['xai_imagine_image', 'xai_imagine_video'])
})

test('generateImagineVideo posts grok-imagine-video-1.5, polls HTTP 202, and writes an mp4 under artifacts/videos', async () => {
  const calls = []
  const requestId = 'ff95ff20-2152-95d9-b9c8-cd7b46b291e5'
  const videoUrl = `https://vidgen.x.ai/xai-vidgen-bucket/xai-video-${requestId}.mp4`
  let polls = 0
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body })
    if (String(url) === VIDEO_GENERATIONS_URL) {
      return jsonResponse(200, { request_id: requestId })
    }
    if (String(url) === `https://api.x.ai/v1/videos/${requestId}`) {
      polls += 1
      if (polls === 1) {
        return jsonResponse(202, { status: 'pending', progress: 10 })
      }
      return jsonResponse(200, {
        status: 'done',
        video: { url: videoUrl, duration: 1, respect_moderation: true },
        model: VIDEO_MODEL,
        progress: 100,
      })
    }
    if (String(url) === videoUrl) {
      return binaryResponse(200, mp4)
    }
    throw new Error(`unexpected url ${url}`)
  }

  const filename = `test_video_${Date.now()}.mp4`
  const result = await generateImagineVideo({
    prompt: 'A red balloon floating slowly upward against a blue sky',
    duration_seconds: 1,
    aspect_ratio: '16:9',
    resolution: '480p',
    output_filename: filename,
    apiKey: 'test-key',
    fetchImpl,
    sleepImpl: async () => {},
  })

  tmpFiles.push(result.local_path)

  assert.equal(calls[0].url, VIDEO_GENERATIONS_URL)
  assert.equal(calls[0].method, 'POST')
  const posted = JSON.parse(calls[0].body)
  assert.equal(posted.model, 'grok-imagine-video-1.5')
  assert.equal(posted.duration, 1)
  assert.equal(posted.resolution, '480p')
  assert.equal(result.success, true)
  assert.equal(result.model, 'grok-imagine-video-1.5')
  assert.equal(result.request_id, requestId)
  assert.ok(result.local_path.endsWith(`/artifacts/videos/${filename}`), result.local_path)
  const saved = readFileSync(result.local_path)
  assert.equal(saved.subarray(4, 8).toString('ascii'), 'ftyp')
})

test('generateImagineVideo fails closed when the completed model is not grok-imagine-video-1.5', async () => {
  const fetchImpl = async (url) => {
    if (String(url) === VIDEO_GENERATIONS_URL) {
      return jsonResponse(200, { request_id: 'abc' })
    }
    if (String(url).includes('/v1/videos/abc')) {
      return jsonResponse(200, {
        status: 'done',
        video: { url: 'https://vidgen.x.ai/wrong.mp4', duration: 1, respect_moderation: true },
        model: 'some-other-video-model',
      })
    }
    throw new Error(`unexpected url ${url}`)
  }

  const result = await generateImagineVideo({
    prompt: 'A cat runs',
    apiKey: 'test-key',
    fetchImpl,
    sleepImpl: async () => {},
  })
  assert.equal(result.success, false)
  assert.match(result.message, /Expected model grok-imagine-video-1.5/)
})

test('safeFilename strips path traversal', () => {
  assert.equal(safeFilename('../etc/passwd', 'x.mp4'), 'passwd')
})

test('cwd isolation: output path does not follow process.cwd()', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'patze-cwd-'))
  const prev = process.cwd()
  process.chdir(dir)
  try {
    const fetchImpl = async (url) => {
      if (String(url) === VIDEO_GENERATIONS_URL) {
        return jsonResponse(200, { request_id: 'cwd' })
      }
      if (String(url).includes('/v1/videos/cwd')) {
        return jsonResponse(200, {
          status: 'done',
          video: { url: 'https://vidgen.x.ai/cwd.mp4', duration: 1, respect_moderation: true },
          model: VIDEO_MODEL,
        })
      }
      return binaryResponse(200, mp4)
    }
    const filename = `cwd_${Date.now()}.mp4`
    const result = await generateImagineVideo({
      prompt: 'cwd check',
      duration_seconds: 1,
      output_filename: filename,
      apiKey: 'test-key',
      fetchImpl,
      sleepImpl: async () => {},
    })
    tmpFiles.push(result.local_path)
    assert.equal(result.success, true)
    assert.ok(result.local_path.includes('/artifacts/videos/'))
    assert.equal(result.local_path.includes(dir), false)
  } finally {
    process.chdir(prev)
    rmSync(dir, { recursive: true, force: true })
  }
})

