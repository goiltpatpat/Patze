/**
 * Patze xAI Imagine tools.
 *
 * Image: grok-imagine-image-2.0 via POST /v1/images/generations
 * Video: grok-imagine-video-1.5 via POST /v1/videos/generations then GET /v1/videos/{request_id}
 *
 * Artifacts are written under the Patze repo root. The engine process cwd is
 * engine/deepseek-harness, so process.cwd() is the wrong output root.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const IMAGE_MODEL = 'grok-imagine-image-2.0'
export const VIDEO_MODEL = 'grok-imagine-video-1.5'
export const IMAGE_GENERATIONS_URL = 'https://api.x.ai/v1/images/generations'
export const VIDEO_GENERATIONS_URL = 'https://api.x.ai/v1/videos/generations'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const VIDEO_POLL_INTERVAL_MS = 3000
const VIDEO_POLL_ATTEMPTS = 80

/**
 * @param {string} [name]
 * @param {string} fallback
 */
export function safeFilename(name, fallback) {
  const raw = String(name || fallback).split(/[/\\]/).pop() || fallback
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, '_')
  return cleaned || fallback
}

/**
 * @param {'images' | 'videos'} kind
 */
export function artifactsDir(kind) {
  return resolve(REPO_ROOT, 'artifacts', kind)
}

function sleep(ms, signal) {
  return new Promise((resolveSleep, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'))
      return
    }
    const timer = setTimeout(resolveSleep, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason ?? new Error('aborted'))
    }, { once: true })
  })
}

function readApiKey() {
  return process.env.XAI_API_KEY || ''
}

/**
 * @param {object} args
 * @param {string} args.prompt
 * @param {string} [args.aspect_ratio]
 * @param {string} [args.output_filename]
 * @param {typeof fetch} [args.fetchImpl]
 * @param {string} [args.apiKey]
 */
export async function generateImagineImage(args) {
  const prompt = String(args.prompt || '').trim()
  const apiKey = args.apiKey ?? readApiKey()
  const fetchImpl = args.fetchImpl || fetch
  if (!prompt) {
    return { success: false, prompt, message: 'prompt is required' }
  }
  if (!apiKey) {
    return { success: false, prompt, message: 'XAI_API_KEY is not configured in .env.' }
  }

  const payload = {
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    response_format: 'url',
  }
  if (args.aspect_ratio) payload.aspect_ratio = args.aspect_ratio

  const response = await fetchImpl(IMAGE_GENERATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })
  const bodyText = await response.text()
  if (!response.ok) {
    return { success: false, prompt, message: `xAI Image API returned status ${response.status}: ${bodyText}` }
  }

  let data
  try {
    data = JSON.parse(bodyText)
  } catch {
    return { success: false, prompt, message: 'xAI Image API returned non-JSON.' }
  }

  const imageUrl = data?.data?.[0]?.url || data?.data?.[0]?.b64_json
  if (!imageUrl) {
    return { success: false, prompt, message: 'xAI Image API did not return an image URL.' }
  }

  const outDir = artifactsDir('images')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const filename = safeFilename(args.output_filename, `xai_image_${Date.now()}.png`)
  const localPath = resolve(outDir, filename)

  if (String(imageUrl).startsWith('http')) {
    const imgRes = await fetchImpl(imageUrl)
    if (!imgRes.ok) {
      return {
        success: false,
        prompt,
        url: imageUrl,
        model: IMAGE_MODEL,
        message: `Image download failed with status ${imgRes.status}.`,
      }
    }
    writeFileSync(localPath, Buffer.from(await imgRes.arrayBuffer()))
  } else {
    writeFileSync(localPath, Buffer.from(imageUrl, 'base64'))
  }

  return {
    success: true,
    url: String(imageUrl).startsWith('http') ? imageUrl : undefined,
    local_path: localPath,
    prompt,
    model: IMAGE_MODEL,
    message: `Image generated with ${IMAGE_MODEL}.`,
  }
}

function videoStatusUrl(requestId) {
  return `https://api.x.ai/v1/videos/${requestId}`
}

/**
 * @param {object} args
 * @param {string} args.prompt
 * @param {number} [args.duration_seconds]
 * @param {string} [args.aspect_ratio]
 * @param {string} [args.resolution]
 * @param {string} [args.output_filename]
 * @param {typeof fetch} [args.fetchImpl]
 * @param {string} [args.apiKey]
 * @param {AbortSignal} [args.signal]
 * @param {(ms: number, signal?: AbortSignal) => Promise<void>} [args.sleepImpl]
 */
export async function generateImagineVideo(args) {
  const prompt = String(args.prompt || '').trim()
  const apiKey = args.apiKey ?? readApiKey()
  const fetchImpl = args.fetchImpl || fetch
  const sleepImpl = args.sleepImpl || sleep
  const signal = args.signal
  if (!prompt) {
    return { success: false, prompt, message: 'prompt is required' }
  }
  if (!apiKey) {
    return { success: false, prompt, message: 'XAI_API_KEY is not configured in .env.' }
  }

  const duration = Math.min(Math.max(Number(args.duration_seconds ?? 8), 1), 15)
  const payload = {
    model: VIDEO_MODEL,
    prompt,
    duration,
    resolution: args.resolution || '480p',
  }
  if (args.aspect_ratio) payload.aspect_ratio = args.aspect_ratio

  const response = await fetchImpl(VIDEO_GENERATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal,
  })
  const bodyText = await response.text()
  if (!response.ok) {
    return { success: false, prompt, message: `xAI Video API returned status ${response.status}: ${bodyText}` }
  }

  let data
  try {
    data = JSON.parse(bodyText)
  } catch {
    return { success: false, prompt, message: 'xAI Video API returned non-JSON.' }
  }

  const requestId = data?.request_id || data?.id
  let videoUrl = data?.video?.url || data?.url
  let model = data?.model || VIDEO_MODEL

  if (!videoUrl && requestId) {
    for (let attempt = 1; attempt <= VIDEO_POLL_ATTEMPTS; attempt++) {
      await sleepImpl(VIDEO_POLL_INTERVAL_MS, signal)
      const pollRes = await fetchImpl(videoStatusUrl(requestId), {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      })
      const pollText = await pollRes.text()
      let pollData
      try {
        pollData = JSON.parse(pollText)
      } catch {
        continue
      }
      const status = String(pollData?.status || '').toLowerCase()
      if (status === 'failed' || status === 'error') {
        return {
          success: false,
          prompt,
          request_id: requestId,
          message: `xAI Video generation failed: ${pollData?.error?.message || pollData?.error || pollData?.message || pollText}`,
        }
      }
      if (status === 'done' || pollData?.video?.url) {
        videoUrl = pollData?.video?.url || pollData?.url
        model = pollData?.model || model
        if (pollData?.video?.respect_moderation === false && !videoUrl) {
          return {
            success: false,
            prompt,
            request_id: requestId,
            model,
            message: 'Video was generated but blocked by moderation.',
          }
        }
        break
      }
    }
  }

  if (!videoUrl) {
    return {
      success: false,
      prompt,
      request_id: requestId,
      message: requestId
        ? `Video job ${requestId} did not return a URL after polling.`
        : 'xAI Video API did not return a video URL or request_id.',
    }
  }

  if (model && model !== VIDEO_MODEL) {
    return {
      success: false,
      prompt,
      video_url: videoUrl,
      model,
      message: `Expected model ${VIDEO_MODEL} but API completed with ${model}.`,
    }
  }

  const outDir = artifactsDir('videos')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const filename = safeFilename(args.output_filename, `xai_video_${Date.now()}.mp4`)
  const localPath = resolve(outDir, filename)

  const vidRes = await fetchImpl(videoUrl, { signal })
  if (!vidRes.ok) {
    return {
      success: false,
      prompt,
      video_url: videoUrl,
      request_id: requestId,
      model: VIDEO_MODEL,
      message: `Video download failed with status ${vidRes.status}.`,
    }
  }
  const buf = Buffer.from(await vidRes.arrayBuffer())
  const magic = buf.subarray(4, 8).toString('ascii')
  if (buf.length < 32 || magic !== 'ftyp') {
    return {
      success: false,
      prompt,
      video_url: videoUrl,
      request_id: requestId,
      model: VIDEO_MODEL,
      message: `Downloaded bytes are not a valid mp4 (len=${buf.length}, magic=${magic}).`,
    }
  }
  writeFileSync(localPath, buf)

  return {
    success: true,
    video_url: videoUrl,
    local_path: localPath,
    prompt,
    request_id: requestId,
    model: VIDEO_MODEL,
    message: `Video generated with ${VIDEO_MODEL}.`,
  }
}

function imageTool() {
  return {
    name: 'xai_imagine_image',
    description: 'Generate an image with xAI Grok Imagine Image 2.0 (grok-imagine-image-2.0). '
      + 'Use this when the user asks for an image, artwork, photo, or still frame. '
      + 'Do not use this tool for video, animation, or motion clips.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Detailed image prompt.' },
        aspect_ratio: { type: 'string', description: 'Aspect ratio such as 1:1, 16:9, 9:16.' },
        output_filename: { type: 'string', description: 'Optional filename under artifacts/images.' },
      },
      required: ['prompt'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          success: { type: 'boolean' },
          url: { type: 'string' },
          local_path: { type: 'string' },
          prompt: { type: 'string' },
          model: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['success', 'prompt', 'message'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.success
          ? `🎨 **${value.model || IMAGE_MODEL}**\n\n![${value.prompt}](${value.url || value.local_path})\n\n- Prompt: ${value.prompt}\n- Saved: \`${value.local_path || 'remote'}\``
          : `❌ Image generation failed: ${value.message}`,
      }],
    },
    execute: async (args) => generateImagineImage(args),
  }
}

function videoTool() {
  return {
    name: 'xai_imagine_video',
    description: 'Generate a short video with xAI Grok Imagine Video 1.5 (grok-imagine-video-1.5) via POST /v1/videos/generations. '
      + 'Use this whenever the user asks to create, animate, or generate a video or motion clip. '
      + 'Never substitute xai_imagine_image or a text-only reply for a video request.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Scene, action, and camera motion.' },
        duration_seconds: { type: 'number', description: 'Duration in seconds from 1 to 15. Defaults to 8.' },
        aspect_ratio: { type: 'string', description: 'Aspect ratio such as 16:9, 9:16, 1:1.' },
        resolution: { type: 'string', description: '480p, 720p, or 1080p. Defaults to 480p.' },
        output_filename: { type: 'string', description: 'Optional filename under artifacts/videos.' },
      },
      required: ['prompt'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          success: { type: 'boolean' },
          video_url: { type: 'string' },
          local_path: { type: 'string' },
          prompt: { type: 'string' },
          request_id: { type: 'string' },
          model: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['success', 'prompt', 'message'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.success
          ? `🎬 **${value.model || VIDEO_MODEL}**\n\n- Prompt: ${value.prompt}\n- Model: ${value.model || VIDEO_MODEL}\n- Video URL: ${value.video_url || 'N/A'}\n- Local Path: \`${value.local_path}\``
          : `❌ Video generation failed: ${value.message}`,
      }],
    },
    execute: async (args, exec) => generateImagineVideo({ ...args, signal: exec?.signal }),
  }
}

/**
 * Register Imagine tools on the host tools registry (visible to every agent).
 * @param {object} ctx
 */
export function registerImagineTools(ctx) {
  if (!ctx || !ctx.tools || typeof ctx.tools.register !== 'function') {
    return false
  }
  ctx.tools.register(imageTool())
  ctx.tools.register(videoTool())
  return true
}

export const IMAGINE_SYSTEM_PROMPT = `## xAI Imagine Generative Media Suite
You have native xAI Imagine tools. Call them; do not claim you are text-only.
- Image / art / photo / still frame: call \`xai_imagine_image\` (model grok-imagine-image-2.0).
- Video / animation / motion clip: call \`xai_imagine_video\` (model grok-imagine-video-1.5). Never use the image tool or a chat-model description as a substitute for video.`
