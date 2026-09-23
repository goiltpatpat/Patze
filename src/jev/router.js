/**
 * Patze Jev System 1 Turn-Level Tool Router.
 *
 * Inspired by Daniel Farina's Nitro architecture (daniel-farina/nitro):
 * - Turn-held caching: tool list is evaluated once on step 1 and held constant
 *   for the entire turn, preserving prompt-cache prefixes (-40% cost, -43% tokens).
 * - Core floor: core editing, inspecting, and interaction tools are NEVER stripped.
 * - Implication closure: tool dependencies (e.g. bash => job_output, job_kill)
 *   are automatically satisfied.
 * - Fail-open: any routing error, timeout, or ambiguity falls back safely to
 *   the complete tool catalog so the agent is never stranded.
 */

/**
 * Foundational tool floor that is always retained regardless of turn intent.
 */
export const CORE_TOOLS = new Set([
  'read',
  'write',
  'edit',
  'bash',
  'glob',
  'grep',
  'present',
  'ask_user_question',
])

/**
 * Dependency graph: if tool X is kept, all tools in IMPLIES[X] must also be kept.
 */
export const IMPLIES = {
  bash: ['job_output', 'job_kill'],
  job_output: ['bash'],
  job_kill: ['bash'],
  web_search: ['fetch_web_page'],
  fetch_web_page: ['web_search'],
  xai_imagine_image: ['present'],
  xai_imagine_video: ['present'],
}

/**
 * Probability retention floor for TypeSafe / Jev Noul queries (Nitro standard: 0.30).
 */
export const PROB_KEEP = 0.30

/**
 * Maximum turn cache entries to keep before eviction.
 */
const MAX_CACHE_ENTRIES = 100

/**
 * Turn cache: maps `${agentId}:${turn}` to cached tool schema array.
 * @type {Map<string, any[]>}
 */
const turnCache = new Map()

/**
 * Clear or prune turn cache entries.
 */
export function clearTurnCache() {
  turnCache.clear()
}

/**
 * Get active cache size (for metrics/testing).
 */
export function getTurnCacheSize() {
  return turnCache.size
}

/**
 * Check whether a tool name matches any core tool variant.
 * @param {string} name
 * @returns {boolean}
 */
export function isCoreTool(name) {
  if (!name || typeof name !== 'string') return false
  if (CORE_TOOLS.has(name)) return true
  const stripped = name.replace(/^tools?:|^tool_/, '')
  return CORE_TOOLS.has(stripped)
}

/**
 * Expand tool set with all implied dependencies recursively.
 * @param {Set<string>} keptSet
 * @returns {Set<string>}
 */
export function applyImplications(keptSet) {
  let changed = true
  while (changed) {
    changed = false
    for (const tool of Array.from(keptSet)) {
      const deps = IMPLIES[tool]
      if (deps) {
        for (const dep of deps) {
          if (!keptSet.has(dep)) {
            keptSet.add(dep)
            changed = true
          }
        }
      }
    }
  }
  return keptSet
}

/**
 * Ensure all core tools present in available tools are preserved.
 * @param {Set<string>} keptSet
 * @param {string[]} availableNames
 * @returns {Set<string>}
 */
export function applyCoreFloor(keptSet, availableNames) {
  for (const name of availableNames) {
    if (isCoreTool(name)) {
      keptSet.add(name)
    }
  }
  return keptSet
}

/**
 * Fast-path turn intent classifier for local System 1 routing.
 * @param {string} text
 * @returns {'conversational' | 'image-generation' | 'video-generation' | 'web-research' | 'coding' | 'broad'}
 */
export function classifyTurnIntent(text) {
  if (!text || typeof text !== 'string') return 'broad'
  const trimmed = text.trim()
  if (trimmed.length === 0) return 'broad'
  const lower = trimmed.toLowerCase()

  // 1. Conversational greetings and casual acknowledgments:
  const stripped = lower.replace(/[!?.,;~_]/g, ' ').replace(/\s+/g, ' ').trim()
  const noSpace = lower.replace(/[^a-z0-9\u0E00-\u0E7F]/g, '')

  const isThaiGreeting = /^((สวัสดี|หวัดดี|ดีครับ|ดีค่ะ|ฮัลโหล|ขอบคุณ|แต๊งกิ้ว|บาย|ลาก่อน|สบายดีไหม|เป็นไงบ้าง|มีอะไรให้ช่วยไหม|แนะนำตัว|คุณคือใคร|คุณทำอะไรได้บ้าง|ครับ|ค่ะ|นะครับ|นะคะ|นะ|จ้า|เลย|ด้วย|ที|ครับผม|ค่ะคุณ|เพื่อน|มาก|หลาย|บอท|bot)+)$/i.test(noSpace)

  const isEnglishGreeting = /^(hello|hi|hey|greetings|howdy|good\s+(morning|afternoon|evening|night)|thanks|thank\s+you|bye|goodbye)(\s+(there|all|everyone|friend|bot|mate))*\s*$/i.test(stripped)
    || /^(hello|hi|hey)\s+(how\s+are\s+you|there|everyone|all|friend|bot)\s*$/i.test(stripped)
    || /^(who\s+are\s+you|what\s+can\s+you\s+do|how\s+are\s+you|test|testing)\s*$/i.test(stripped)

  if (isThaiGreeting || isEnglishGreeting) {
    return 'conversational'
  }

  // 2. Video generation intent:
  const isVideo = /(สร้างวิดีโอ|ทำวิดีโอ|เจนวิดีโอ|เจนคลิป|สร้างคลิป|ทำคลิป|\b(generate video|create video|imagine video|make a video|make video|text-to-video|image-to-video)\b)/i.test(lower)
  if (isVideo) {
    return 'video-generation'
  }

  // 3. Image generation intent:
  const isImage = /(สร้างรูป|วาดรูป|เจนภาพ|สร้างภาพ|ทำภาพ|วาดภาพ|\b(generate image|create image|imagine image|draw image|make an image)\b)/i.test(lower)
  if (isImage) {
    return 'image-generation'
  }

  // 4. Web research / fetch intent:
  const isWeb = /(ค้นหาเว็บ|เสิร์ชเว็บ|หาข้อมูลจากเว็บ|\b(web search|google search|search the web|search web|fetch url|fetch web|read url)\b)/i.test(lower)
  if (isWeb) {
    return 'web-research'
  }

  // 5. Explicit coding / diagnostics:
  const isCoding = /(เขียนโค้ด|แก้โค้ด|แก้บั๊ก|รันเทส|รันคำสั่ง|\b(code|debug|fix|refactor|test|compile|build|git|commit|push|bash|terminal|diff)\b)/i.test(lower)
  if (isCoding) {
    return 'coding'
  }

  return 'broad'
}

/**
 * Route tools for a given agent turn using Nitro-inspired System 1 heuristics
 * and optional TypeSafe / Jev Noul evaluation.
 *
 * @param {object} params
 * @param {import('./engine.js').JevEngine} [params.engine]
 * @param {string} [params.userText]
 * @param {any[]} params.tools - Available tool schemas
 * @param {number|string} [params.turn] - Current turn index
 * @param {number|string} [params.step] - Current step index within turn
 * @param {string} [params.agentId] - Unique identifier for the calling agent
 * @param {boolean} [params.bypassCache] - Force re-computation (for tests)
 * @returns {Promise<any[]>} Filtered tool schemas
 */
export async function routeTools({
  engine,
  userText = '',
  tools = [],
  turn = 1,
  step = 1,
  agentId = 'agent',
  bypassCache = false,
}) {
  const validTools = tools.filter(t => t && typeof t.name === 'string')
  if (validTools.length === 0) {
    return []
  }

  // 1. Turn-held caching: if already computed for this turn and catalog composition,
  // return cached toolset directly. This preserves prefix prompt cache hits across
  // steps 1, 2, 3... of the same turn while safely adapting if the catalog is modified.
  const catalogFingerprint = validTools.map(t => t.name).sort().join(',')
  const cacheKey = `${agentId}:${turn}:${catalogFingerprint}`
  if (!bypassCache && turnCache.has(cacheKey)) {
    return turnCache.get(cacheKey)
  }

  try {
    const availableNames = validTools.map(t => t.name)
    const nameMap = new Map()
    for (const tool of validTools) {
      nameMap.set(tool.name, tool)
    }

    const intent = classifyTurnIntent(userText)
    const keptNames = new Set()

    // 2. Intent-guided initial set
    switch (intent) {
      case 'conversational': {
        // Casual greetings: leanest possible prompt, strictly CORE_TOOLS floor
        for (const name of availableNames) {
          if (isCoreTool(name)) keptNames.add(name)
        }
        break
      }

      case 'video-generation': {
        if (nameMap.has('xai_imagine_video')) keptNames.add('xai_imagine_video')
        break
      }

      case 'image-generation': {
        if (nameMap.has('xai_imagine_image')) keptNames.add('xai_imagine_image')
        break
      }

      case 'web-research': {
        if (nameMap.has('web_search')) keptNames.add('web_search')
        if (nameMap.has('fetch_web_page')) keptNames.add('fetch_web_page')
        break
      }

      case 'coding': {
        // Core tools + jobs + terminal tools
        for (const name of availableNames) {
          if (isCoreTool(name) || name.startsWith('job_') || name.startsWith('lsp_') || name === 'ast_grep') {
            keptNames.add(name)
          }
        }
        break
      }

      case 'broad':
      default: {
        // Broad or complex: if Jev engine is not available, retain full catalog
        if (!engine?.apiKey) {
          for (const name of availableNames) {
            keptNames.add(name)
          }
        }
        break
      }
    }

    // 3. Remote TypeSafe Jev System 1 Noul evaluation (when apiKey is configured)
    if (engine?.apiKey && intent !== 'conversational') {
      try {
        const questions = {}
        if (nameMap.has('xai_imagine_video') && !keptNames.has('xai_imagine_video')) {
          questions.need_video = {
            type: 'noul',
            instructions: 'Does `request` ask to generate or animate video or motion clip?',
          }
        }
        if (nameMap.has('xai_imagine_image') && !keptNames.has('xai_imagine_image')) {
          questions.need_image = {
            type: 'noul',
            instructions: 'Does `request` ask to generate, draw, or synthesize an image or art?',
          }
        }
        if (nameMap.has('web_search') && !keptNames.has('web_search')) {
          questions.need_web = {
            type: 'noul',
            instructions: 'Does `request` require searching the live web or fetching external URLs?',
          }
        }

        if (Object.keys(questions).length > 0) {
          const evalResult = await engine.querySystemOne(userText, questions)
          if (evalResult?.answers) {
            if ((evalResult.answers.need_video?.noul ?? 0) >= PROB_KEEP) keptNames.add('xai_imagine_video')
            if ((evalResult.answers.need_image?.noul ?? 0) >= PROB_KEEP) keptNames.add('xai_imagine_image')
            if ((evalResult.answers.need_web?.noul ?? 0) >= PROB_KEEP) keptNames.add('web_search')
          }
        }
      } catch {
        // Fall through cleanly on API failure
      }
    }

    // 4. Implication closure: ensure dependencies are met
    applyImplications(keptNames)

    // 5. Core Floor: always preserve all core tools
    applyCoreFloor(keptNames, availableNames)

    // 6. Filter tool list
    const filteredTools = validTools.filter(t => keptNames.has(t.name))

    // 7. Fail-open: never return empty toolset
    const finalTools = filteredTools.length > 0 ? filteredTools : validTools

    // Cache the turn's decision
    if (!bypassCache) {
      if (turnCache.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = turnCache.keys().next().value
        if (oldestKey) turnCache.delete(oldestKey)
      }
      turnCache.set(cacheKey, finalTools)
    }

    return finalTools
  } catch (err) {
    // Fail-open: on any error, return all available tools
    console.warn('⚠️ [Patze Jev Router] Fallback to full tool catalog due to error:', err)
    return tools
  }
}
