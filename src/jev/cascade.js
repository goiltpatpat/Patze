/**
 * Patze Jev System 1 Cascade & Closed-Set Action Dispatcher.
 *
 * Implements the 3 core TypeSafe AI architectural cookbooks:
 * 1. skill_suggestion: 2-stage progressive gating (acts_on_user_system, would_follow_documented_procedure, prose_suffices)
 * 2. function_calling: closed-set argument resolution and direct execution without generative LLM
 * 3. sde_cascade: cascade fallback & circuit breaker when provider LLM is unavailable
 */

export const GATE_QUESTIONS = {
  acts_on_user_system: 'Is the user asking the system to act on files, run commands, generate media, or perform an operation, rather than only asking for an explanation or prose answer?',
  would_follow_documented_procedure: 'Would a careful engineer execute a specific tool or documented command rather than answering from general conversational memory?',
  prose_suffices: 'Could this request be satisfied purely in text or prose explanation without running any tools, tests, files, or external services?',
}

export const CLOSED_SET_ACTIONS = {
  run_tests: {
    description: 'Run project unit or integration test suite',
    keywords: ['test', 'run test', 'unit test', 'ทดสอบ', 'รันเทส', 'ตรวจเทส'],
    targets: ['unit', 'jev', 'imagine', 'all'],
  },
  build_project: {
    description: 'Compile or build project assets',
    keywords: ['build', 'compile', 'บิลด์', 'คอมไพล์'],
  },
  git_status: {
    description: 'Inspect repository git status or branch',
    keywords: ['git status', 'branch status', 'สถานะ git', 'เช็ค git'],
  },
  imagine_image: {
    description: 'Generate an image via xAI Grok Imagine',
    keywords: ['create image', 'generate image', 'imagine image', 'สร้างรูป', 'วาดรูป', 'เจนภาพ'],
  },
  imagine_video: {
    description: 'Generate a video via xAI Grok Imagine',
    keywords: ['create video', 'generate video', 'imagine video', 'สร้างวิดีโอ', 'ทำคลิป', 'เจนคลิป'],
  },
  rerank_docs: {
    description: 'Rerank candidate passages under citation policy',
    keywords: ['rerank', 'rank docs', 'จัดลำดับเอกสาร'],
  },
  verify_citation: {
    description: 'Verify whether a passage supports or contradicts a claim',
    keywords: ['verify citation', 'check stance', 'ตรวจอ้างอิง'],
  },
  safety_guard: {
    description: 'Inspect command safety before execution',
    keywords: ['check safety', 'guard command', 'เช็คความปลอดภัย', 'ตรวจคำสั่ง'],
  },
}

/**
 * Classify whether a request requires execution action or pure prose explanation.
 * Based on TypeSafe skill_suggestion cookbook gate nouls.
 *
 * @param {object} params
 * @param {import('./engine.js').JevEngine} [params.engine]
 * @param {string} params.request
 * @returns {Promise<{
 *   actionScore: number,
 *   proseSuffices: number,
 *   requiresExecution: boolean,
 *   latencyMs: number
 * }>}
 */
export async function evaluateRequestGate({ engine, request }) {
  const startTime = performance.now()
  const trimmed = (request || '').trim()
  const lower = trimmed.toLowerCase()

  if (engine?.apiKey) {
    try {
      const state = { request: trimmed }
      const res = await engine.querySystemOne(state, {
        acts_on_system: {
          type: 'noul',
          instructions: GATE_QUESTIONS.acts_on_user_system,
        },
        documented_procedure: {
          type: 'noul',
          instructions: GATE_QUESTIONS.would_follow_documented_procedure,
        },
        prose_suffices: {
          type: 'noul',
          instructions: GATE_QUESTIONS.prose_suffices,
        },
      })

      const acts = res?.answers?.acts_on_system?.noul ?? 0.5
      const proc = res?.answers?.documented_procedure?.noul ?? 0.5
      const prose = res?.answers?.prose_suffices?.noul ?? 0.5

      // Inverted logic from cookbook: high prose_suffices points away from execution
      const actionScore = Math.round(((acts + proc + (1.0 - prose)) / 3) * 100) / 100
      return {
        actionScore,
        proseSuffices: Math.round(prose * 100) / 100,
        requiresExecution: actionScore >= 0.40,
        latencyMs: Math.round(performance.now() - startTime),
      }
    } catch {
      // Fall through to deterministic heuristics
    }
  }

  // Deterministic Gate Heuristic: Negative & Explanation Intent Boundaries
  const negativeRegex = /(อย่า|ห้าม|ไม่ต้อง|ไม่ให้|ระวังอย่า|\b(don'?t|do not|never|stop|skip|without\s+(executing|running)|no\s+(exec|execution))\b)/i
  const explanationRegex = /(วิธี|อธิบาย|สอน|แนวทาง|คำสั่ง.*คืออะไร|\b(how\s+to|how\s+do|how\s+can|explain|show\s+me\s+how|what\s+is\s+the\s+command|tell\s+me\s+how|tutorial|guide)\b)/i
  const actionRegex = /(รัน|สร้าง|ทำ|บิลด์|แก้|เช็ค|เทส|ทดสอบ|ลบ|เพิ่ม|push|commit|merge|\b(run|build|test|create|make|generate|git|clean|debug|fix|exec|bash|rerank|verify)\b)/i
  const proseRegex = /(อธิบาย|แปล|คืออะไร|ทำไม|ช่วยเล่า|เขียนกลอน|\b(how\s+does|explain|what\s+is|tell\s+me|why\s+is|define)\b)/i

  const hasNegative = negativeRegex.test(lower)
  const hasExplanation = explanationRegex.test(lower)
  const hasAction = actionRegex.test(lower)
  const hasProse = proseRegex.test(lower)

  let actionScore = 0.20
  let proseSuffices = 0.80

  if (hasNegative) {
    // Explicit negative intent against execution: "อย่ารัน", "don't run", "สร้างแผน ไม่ต้อง execute"
    actionScore = 0.05
    proseSuffices = 0.95
  } else if (hasExplanation) {
    // Inquiry or explanation request: "อธิบายวิธีรัน test", "how to run test"
    actionScore = 0.15
    proseSuffices = 0.85
  } else if (hasAction && !hasProse) {
    actionScore = 0.88
    proseSuffices = 0.12
  } else if (hasAction && hasProse) {
    actionScore = 0.35
    proseSuffices = 0.65
  } else if (hasProse) {
    actionScore = 0.10
    proseSuffices = 0.90
  }

  return {
    actionScore,
    proseSuffices,
    requiresExecution: actionScore >= 0.40,
    latencyMs: Math.round(performance.now() - startTime),
  }
}

/**
 * Dispatch closed-set action from natural language request without invoking generative LLM.
 * Based on TypeSafe function_calling cookbook.
 *
 * @param {string} request
 * @returns {{
 *   action: string | null,
 *   confidence: number,
 *   signalType: 'heuristic_operational',
 *   parameters: Record<string, unknown>,
 *   dispatchable: boolean,
 *   refusalReason?: string,
 *   matchedActions?: string[]
 * }}
 */
export function resolveClosedSetAction(request) {
  const trimmed = (request || '').trim()
  const lower = trimmed.toLowerCase()

  if (!lower) {
    return {
      action: null,
      confidence: 0.0,
      signalType: 'heuristic_operational',
      parameters: {},
      dispatchable: false,
      refusalReason: 'empty_request',
    }
  }

  // 1. Negative Intent Barrier: never dispatch if user asked NOT to execute
  const negativeRegex = /(อย่า|ห้าม|ไม่ต้อง|ไม่ให้|ระวังอย่า|\b(don'?t|do not|never|stop|skip|without\s+(executing|running)|no\s+(exec|execution))\b)/i
  if (negativeRegex.test(lower)) {
    return {
      action: null,
      confidence: 0.0,
      signalType: 'heuristic_operational',
      parameters: {},
      dispatchable: false,
      refusalReason: 'negative_intent',
    }
  }

  // 2. Speculative & Uncertainty Barrier: never dispatch on hesitant, speculative, or uncertain phrasing
  const speculativeRegex = /(อาจจะ|น่าจะ|ลองคิดดู|หรือไม่อาจ|ไม่แน่ใจ|\b(maybe|perhaps|unclear|undecided|might|could\s+be)\b)/i
  if (speculativeRegex.test(lower)) {
    return {
      action: null,
      confidence: 0.0,
      signalType: 'heuristic_operational',
      parameters: {},
      dispatchable: false,
      refusalReason: 'speculative_or_uncertain',
    }
  }

  // 3. Explanation / Inquiry Barrier: never dispatch if user asked for an explanation/guide
  const explanationRegex = /(วิธี|อธิบาย|สอน|แนวทาง|คำสั่ง.*คืออะไร|\b(how\s+to|how\s+do|how\s+can|explain|show\s+me\s+how|what\s+is\s+the\s+command|tell\s+me\s+how|tutorial|guide)\b)/i
  if (explanationRegex.test(lower)) {
    return {
      action: null,
      confidence: 0.0,
      signalType: 'heuristic_operational',
      parameters: {},
      dispatchable: false,
      refusalReason: 'explanation_request',
    }
  }

  // 3. Scan for matching closed-set actions
  const matchedActions = []
  for (const [actionName, def] of Object.entries(CLOSED_SET_ACTIONS)) {
    const matched = def.keywords.some(kw => lower.includes(kw.toLowerCase()))
    if (matched) {
      matchedActions.push(actionName)
    }
  }

  // 4. Ambiguity / Multiple Actions Barrier:
  // If multiple distinct actions matched (e.g. "เช็ค git status แล้วก็รัน test ด้วย"),
  // a single closed-set dispatch is ambiguous and unsafe.
  if (matchedActions.length > 1) {
    return {
      action: null,
      confidence: 0.0,
      signalType: 'heuristic_operational',
      parameters: {},
      dispatchable: false,
      refusalReason: 'ambiguous_multiple_actions',
      matchedActions,
    }
  }

  if (matchedActions.length === 1) {
    const actionName = matchedActions[0]
    const params = {}
    if (actionName === 'run_tests') {
      if (lower.includes('unit')) params.target = 'unit'
      else if (lower.includes('jev')) params.target = 'jev'
      else if (lower.includes('imagine')) params.target = 'imagine'
      else params.target = 'all'
    } else if (actionName === 'imagine_image' || actionName === 'imagine_video') {
      // Extract prompt safely
      const cleaned = request.replace(/(สร้างรูป|วาดรูป|เจนภาพ|สร้างวิดีโอ|ทำคลิป|generate image|create video|imagine video)\s*/i, '').trim()
      params.prompt = cleaned || request
    }

    return {
      action: actionName,
      // Operational signal: note that this is an operational heuristic threshold, NOT a calibrated Bayesian probability
      confidence: 0.92,
      signalType: 'heuristic_operational',
      parameters: params,
      dispatchable: true,
    }
  }

  return {
    action: null,
    confidence: 0.0,
    signalType: 'heuristic_operational',
    parameters: {},
    dispatchable: false,
    refusalReason: 'no_matching_action',
  }
}

/**
 * Generate Structured Fallback Card when LLM provider fails.
 * Adheres to sde_cascade & System 1 philosophy:
 * Jev does NOT generate text; it yields a typed, actionable diagnostic card for the Web UI.
 *
 * @param {object} params
 * @param {string} params.request
 * @param {Error | string} params.providerError
 * @param {import('./engine.js').JevEngine} [params.engine]
 * @returns {Promise<{
 *   mode: 'action_dispatched' | 'prose_unavailable' | 'provider_error',
 *   title: string,
 *   summary: string,
 *   suggestedAction?: string,
 *   actionResult?: unknown,
 *   requiresLLM: boolean,
 *   system1Details: Record<string, unknown>
 * }>}
 */
export async function handleProviderFailure({ request, providerError, engine }) {
  const gate = await evaluateRequestGate({ engine, request })
  const dispatch = resolveClosedSetAction(request)

  const errMessage = providerError instanceof Error ? providerError.message : String(providerError || 'Unknown provider failure')

  // Case 1: The request is a validated closed-set actionable task AND the gate confirmed execution is required
  if (dispatch.dispatchable && dispatch.action && gate.requiresExecution) {
    return {
      mode: 'action_dispatched',
      title: '⚡ Jev System 1 Direct Dispatch',
      summary: `Primary LLM provider offline (${errMessage}). Jev resolved intent to closed-set action: "${dispatch.action}".`,
      suggestedAction: dispatch.action,
      requiresLLM: false,
      system1Details: {
        action: dispatch.action,
        parameters: dispatch.parameters,
        confidence: dispatch.confidence,
        signalType: dispatch.signalType,
        gate,
      },
    }
  }

  // Case 2: The request strictly requires generative prose, explanation, or negative constraint
  if (gate.proseSuffices >= 0.60 || !gate.requiresExecution) {
    return {
      mode: 'prose_unavailable',
      title: '⚠️ Generative Reasoning LLM Required',
      summary: `Primary LLM provider is unavailable (${errMessage}). This query requires generative prose, explanation, or planning (prose_suffices: ${gate.proseSuffices}), which exceeds System 1 decision boundaries.`,
      suggestedAction: 'Switch to secondary LLM provider or verify upstream API credentials.',
      requiresLLM: true,
      system1Details: {
        gate,
        dispatchRefusal: dispatch.refusalReason,
        explanation: 'TypeSafe Jev is a System 1 Decision Model (Choices, Nouls, Scores) and deliberately does not synthesize long prose.',
      },
    }
  }

  // Case 3: Ambiguous or general engineering task
  return {
    mode: 'provider_error',
    title: '🛡️ Jev System 1 Circuit Breaker',
    summary: `Primary LLM failed: ${errMessage}. System 1 action gate: ${gate.actionScore}.`,
    suggestedAction: 'Execute workflow via Patze CLI or retry with alternative model route.',
    requiresLLM: true,
    system1Details: {
      gate,
      dispatch,
    },
  }
}
