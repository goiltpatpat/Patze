import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  CORE_TOOLS,
  IMPLIES,
  PROB_KEEP,
  isCoreTool,
  classifyTurnIntent,
  applyImplications,
  applyCoreFloor,
  routeTools,
  clearTurnCache,
  getTurnCacheSize,
} from './router.js'

beforeEach(() => {
  clearTurnCache()
})

const sampleCatalog = [
  { name: 'read', description: 'Read file' },
  { name: 'write', description: 'Write file' },
  { name: 'edit', description: 'Edit file' },
  { name: 'bash', description: 'Run bash' },
  { name: 'glob', description: 'Glob files' },
  { name: 'grep', description: 'Grep files' },
  { name: 'present', description: 'Present file' },
  { name: 'ask_user_question', description: 'Ask question' },
  { name: 'job_output', description: 'Get background job output' },
  { name: 'job_kill', description: 'Kill background job' },
  { name: 'web_search', description: 'Search web' },
  { name: 'fetch_web_page', description: 'Fetch URL' },
  { name: 'xai_imagine_image', description: 'Generate image' },
  { name: 'xai_imagine_video', description: 'Generate video' },
  { name: 'ast_grep', description: 'AST code search' },
  { name: 'lsp_definitions', description: 'LSP definition search' },
]

test('CORE_TOOLS contains baseline interaction and file tools', () => {
  for (const name of ['read', 'write', 'edit', 'bash', 'glob', 'grep', 'present', 'ask_user_question']) {
    assert.equal(CORE_TOOLS.has(name), true, `Missing core tool: ${name}`)
  }
})

test('isCoreTool identifies core tools with prefixes', () => {
  assert.equal(isCoreTool('read'), true)
  assert.equal(isCoreTool('tool_read'), true)
  assert.equal(isCoreTool('tools:bash'), true)
  assert.equal(isCoreTool('xai_imagine_video'), false)
  assert.equal(isCoreTool(''), false)
  assert.equal(isCoreTool(null), false)
})

test('classifyTurnIntent correctly segments intents', () => {
  assert.equal(classifyTurnIntent('สวัสดีครับ'), 'conversational')
  assert.equal(classifyTurnIntent('Hello how are you?'), 'conversational')
  assert.equal(classifyTurnIntent('ขอบคุณมากครับ'), 'conversational')

  assert.equal(classifyTurnIntent('สร้างวิดีโอนกบิน'), 'video-generation')
  assert.equal(classifyTurnIntent('generate video of flying drone'), 'video-generation')

  assert.equal(classifyTurnIntent('วาดรูปแมวใส่แว่น'), 'image-generation')
  assert.equal(classifyTurnIntent('generate image of sunset on mars'), 'image-generation')

  assert.equal(classifyTurnIntent('ค้นหาเว็บ ข่าว ai ล่าสุด'), 'web-research')
  assert.equal(classifyTurnIntent('search the web for typescript 5.8 features'), 'web-research')

  assert.equal(classifyTurnIntent('แก้บั๊กใน src/index.ts'), 'coding')
  assert.equal(classifyTurnIntent('refactor helper and run tests'), 'coding')

  assert.equal(classifyTurnIntent(''), 'broad')
})

test('applyImplications transitively expands tool dependencies', () => {
  const set = new Set(['bash'])
  applyImplications(set)
  assert.equal(set.has('job_output'), true)
  assert.equal(set.has('job_kill'), true)

  const webSet = new Set(['web_search'])
  applyImplications(webSet)
  assert.equal(webSet.has('fetch_web_page'), true)

  const imagineSet = new Set(['xai_imagine_video'])
  applyImplications(imagineSet)
  assert.equal(imagineSet.has('present'), true)
})

test('applyCoreFloor preserves all core tools', () => {
  const kept = new Set()
  const available = sampleCatalog.map(t => t.name)
  applyCoreFloor(kept, available)
  for (const tool of CORE_TOOLS) {
    assert.equal(kept.has(tool), true)
  }
  assert.equal(kept.has('xai_imagine_video'), false)
  assert.equal(kept.has('web_search'), false)
})

test('routeTools on conversational intent preserves core floor and strips heavy media tools', async () => {
  const routed = await routeTools({
    userText: 'สวัสดีครับผม มีอะไรให้ช่วยไหม',
    tools: sampleCatalog,
    turn: 1,
    step: 1,
    bypassCache: true,
  })

  const names = routed.map(t => t.name)
  assert.equal(names.includes('read'), true)
  assert.equal(names.includes('write'), true)
  assert.equal(names.includes('bash'), true)
  assert.equal(names.includes('xai_imagine_video'), false)
  assert.equal(names.includes('xai_imagine_image'), false)
  assert.equal(names.includes('web_search'), false)
  // Check token reduction: only core tools retained
  assert.ok(routed.length < sampleCatalog.length)
})

test('routeTools on video request keeps xai_imagine_video and core floor', async () => {
  const routed = await routeTools({
    userText: 'สร้างวิดีโอนักบินอวกาศเดินบนดวงจันทร์ 8 วินาที',
    tools: sampleCatalog,
    turn: 1,
    step: 1,
    bypassCache: true,
  })

  const names = routed.map(t => t.name)
  assert.equal(names.includes('xai_imagine_video'), true)
  assert.equal(names.includes('present'), true) // from implication closure
  assert.equal(names.includes('read'), true)    // from core floor
  assert.equal(names.includes('bash'), true)    // from core floor
  assert.equal(names.includes('xai_imagine_image'), false)
})

test('routeTools on image request keeps xai_imagine_image and core floor', async () => {
  const routed = await routeTools({
    userText: 'สร้างรูปภาพ พระอาทิตย์ตกดินเหนือแม่น้ำเจ้าพระยา',
    tools: sampleCatalog,
    turn: 1,
    step: 1,
    bypassCache: true,
  })

  const names = routed.map(t => t.name)
  assert.equal(names.includes('xai_imagine_image'), true)
  assert.equal(names.includes('present'), true)
  assert.equal(names.includes('read'), true)
  assert.equal(names.includes('xai_imagine_video'), false)
})

test('turn-held caching holds toolset constant across turn steps (Nitro prefix caching)', async () => {
  clearTurnCache()
  const turn = 42

  // Step 1: conversational turn computes core-only tools
  const step1 = await routeTools({
    userText: 'สวัสดีครับ',
    tools: sampleCatalog,
    turn,
    step: 1,
    agentId: 'test-session',
  })
  assert.equal(getTurnCacheSize(), 1)
  assert.equal(step1.some(t => t.name === 'xai_imagine_video'), false)

  // Step 2: even if userText differs or is empty, the cached toolset is returned
  const step2 = await routeTools({
    userText: 'something else entirely',
    tools: sampleCatalog,
    turn,
    step: 2,
    agentId: 'test-session',
  })

  // Must be identical reference/set from cache
  assert.equal(step1, step2)
  assert.equal(step2.some(t => t.name === 'xai_imagine_video'), false)
})

test('fail-open fallback: returns full toolset on empty result or error', async () => {
  // Empty tools array
  const empty = await routeTools({ userText: 'test', tools: [] })
  assert.deepEqual(empty, [])

  // When filtering would yield empty, it safely returns the original tools
  const onlyExotic = [{ name: 'exotic_custom_tool' }]
  const result = await routeTools({
    userText: 'สวัสดี',
    tools: onlyExotic,
    turn: 99,
    step: 1,
    bypassCache: true,
  })
  assert.deepEqual(result, onlyExotic)
})

test('remote Jev Noul query: keeps tool if probability >= 0.30 (PROB_KEEP)', async () => {
  const mockEngine = {
    apiKey: 'mock-key',
    querySystemOne: async (_prompt, questions) => {
      const answers = {}
      if (questions.need_video) answers.need_video = { noul: 0.85 }
      if (questions.need_web) answers.need_web = { noul: 0.15 } // below 0.30
      return { answers }
    },
  }

  const routed = await routeTools({
    engine: mockEngine,
    userText: 'โปรดช่วยประมวลผลคลิปนี้หน่อย',
    tools: sampleCatalog,
    turn: 101,
    step: 1,
    bypassCache: true,
  })

  const names = routed.map(t => t.name)
  assert.equal(names.includes('xai_imagine_video'), true) // kept (0.85 >= 0.30)
  assert.equal(names.includes('web_search'), false)       // dropped (0.15 < 0.30)
  assert.equal(names.includes('read'), true)             // core floor
})

test('JevPlugin hooks filter tools via system-prompt/assemble waterfall', async () => {
  const { apply } = await import('./plugin.js')
  const listeners = new Map()

  const mockCtx = {
    provide: (_name, _svc) => {},
    on: (event, handler) => {
      listeners.set(event, handler)
    },
  }

  apply(mockCtx, { apiKey: '' })

  assert.ok(listeners.has('agent/inbox/claimed'))
  assert.ok(listeners.has('system-prompt/assemble'))

  const claimedHandler = listeners.get('agent/inbox/claimed')
  const assembleHandler = listeners.get('system-prompt/assemble')

  const agent = { id: 'agent-session-test', phase: { turn: 1 } }

  // 1. User submits casual greeting
  claimedHandler({
    message: { role: 'user', content: [{ type: 'text', text: 'สวัสดีครับ' }] },
    turn: 1,
    agent,
  })

  // 2. system-prompt/assemble fires with sample catalog
  const assemblyInput = { tools: sampleCatalog, sections: [], contexts: [], variables: {} }
  const next = async () => ({ ...assemblyInput })

  const assembled = await assembleHandler(assemblyInput, { agent }, next)

  const toolNames = assembled.tools.map((t) => t.name)
  assert.equal(toolNames.includes('xai_imagine_video'), false)
  assert.equal(toolNames.includes('read'), true)
  assert.equal(toolNames.includes('bash'), true)
})

