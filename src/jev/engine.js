/**
 * Jev (TypeSafe AI) System 1 Decision & Control Engine for Patze.
 * 
 * Native high-performance ESM engine:
 * 1. Fast Skill Routing (22 Patpat skills)
 * 2. Execution Safety Guardrails
 * 3. Proof Contract & Loop Evaluation
 */

export class JevEngine {
  /**
   * @param {import('./types.js').JevConfig} [config]
   */
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.JEV_API_KEY || ''
    this.baseUrl = config.baseUrl || process.env.JEV_BASE_URL || 'https://api.typesafe.ai/v1'
    this.timeoutMs = config.timeoutMs || 2500
  }

  /**
   * Fast Skill Router: Classifies user prompt into the optimal Patpat engineering skill.
   * @param {string} prompt
   * @returns {Promise<import('./types.js').SkillRouteResult>}
   */
  async routeSkill(prompt) {
    const startTime = performance.now()
    const lower = prompt.toLowerCase()

    // 1. If remote Jev API key is configured, call remote Jev endpoint
    if (this.apiKey) {
      try {
        const remoteResult = await this.queryRemoteJev('skill-route', {
          prompt,
          availableSkills: [
            'patpat-architect', 'patpat-plan', 'patpat-change', 'patpat-engineer',
            'patpat-debug', 'patpat-inspect', 'patpat-verify', 'patpat-verifier',
            'patpat-review', 'patpat-ship', 'patpat-perf', 'patpat-arena',
            'patpat-swarm', 'patpat-run', 'patpat-learn', 'patpat-skill',
            'patpat-setup', 'patpat-automation', 'patpat-impact', 'patpat-eval',
            'patpat-loop'
          ]
        })
        if (remoteResult) {
          return {
            ...remoteResult,
            latencyMs: Math.round(performance.now() - startTime),
          }
        }
      } catch (err) {
        // Fall through to heuristic classifier
      }
    }

    // 2. High-speed System 1 Heuristic Pattern Matcher (<5ms)
    let selectedSkill = 'patpat-loop'
    let confidence = 0.85
    let category = 'general-engineering'
    let reasoning = 'Default evidence-driven loop'

    if (/\b(debug|fix|bug|error|exception|crash|fail|traceback|defect|issue|broken)\b/i.test(lower)) {
      selectedSkill = 'patpat-debug'
      confidence = 0.96
      category = 'diagnostics'
      reasoning = 'Detected defect diagnosis or error fixing intent'
    } else if (/\b(architect|design|contract|boundary|schema|migration|interface|architecture)\b/i.test(lower)) {
      selectedSkill = 'patpat-architect'
      confidence = 0.95
      category = 'architecture'
      reasoning = 'Detected architectural or contract design intent'
    } else if (/\b(review|audit|challenge|inspect-diff|critique|sanity)\b/i.test(lower)) {
      selectedSkill = 'patpat-review'
      confidence = 0.94
      category = 'review'
      reasoning = 'Detected independent review or verification challenge intent'
    } else if (/\b(ship|land|merge|publish|deploy|pr|pull request|release)\b/i.test(lower)) {
      selectedSkill = 'patpat-ship'
      confidence = 0.97
      category = 'delivery'
      reasoning = 'Detected release, PR merge, or shipping intent'
    } else if (/\b(verify|prove|proof|test|evidence|acceptance|assert)\b/i.test(lower)) {
      selectedSkill = 'patpat-verify'
      confidence = 0.93
      category = 'verification'
      reasoning = 'Detected proof contract or verification execution intent'
    } else if (/\b(perf|performance|latency|memory|cpu|optimize|benchmark|speed up|hillclimb)\b/i.test(lower)) {
      selectedSkill = 'patpat-perf'
      confidence = 0.95
      category = 'optimization'
      reasoning = 'Detected performance tuning or profiling intent'
    } else if (/\b(plan|workflow|roadmap|phases|step-by-step)\b/i.test(lower)) {
      selectedSkill = 'patpat-plan'
      confidence = 0.92
      category = 'planning'
      reasoning = 'Detected multi-phase workflow planning intent'
    } else if (/\b(explain|how|why|understand|inspect|explore|overview|where is)\b/i.test(lower)) {
      selectedSkill = 'patpat-inspect'
      confidence = 0.91
      category = 'exploration'
      reasoning = 'Detected read-only repository understanding intent'
    } else if (/\b(arena|compete|competing|alternative|compare implementations)\b/i.test(lower)) {
      selectedSkill = 'patpat-arena'
      confidence = 0.96
      category = 'synthesis'
      reasoning = 'Detected competing attempts or synthesis intent'
    } else if (/\b(swarm|parallel|fan out|matrix|distributed)\b/i.test(lower)) {
      selectedSkill = 'patpat-swarm'
      confidence = 0.94
      category = 'scaling'
      reasoning = 'Detected parallel fan-out or matrix execution intent'
    } else if (/\b(add|create|implement|feature|build|scaffold)\b/i.test(lower)) {
      selectedSkill = 'patpat-change'
      confidence = 0.90
      category = 'implementation'
      reasoning = 'Detected bounded feature implementation intent'
    }

    const latencyMs = Math.round(performance.now() - startTime)
    return {
      skill: selectedSkill,
      confidence,
      intentCategory: category,
      reasoning,
      latencyMs,
    }
  }

  /**
   * Fast Safety Guardrail: Evaluates tool calls and shell operations for destructive risk.
   * @param {string} command
   * @returns {Promise<import('./types.js').SafetyCheckResult>}
   */
  async checkSafety(command) {
    const startTime = performance.now()
    const trimmed = command.trim()

    // High-risk patterns
    const criticalPatterns = [
      /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+|\s+-[a-zA-Z]*r[a-zA-Z]*)\s*(\/|\*|~\/)/i, // rm -rf / or *
      /\bmkfs\b/i,
      /\bdd\s+if=/i,
      /\bchmod\s+(-R\s+)?777\s+\//i,
      /\b(DROP|TRUNCATE)\s+(DATABASE|TABLE)\b/i,
      /\bgit\s+push\s+.*--force.*main\b/i,
    ]

    const highRiskPatterns = [
      /\bgit\s+reset\s+--hard\b/i,
      /\bgit\s+clean\s+-fdx\b/i,
      /\bkill\s+-9\s+1\b/i,
      /\bpkill\s+-9\b/i,
      /\bshutdown\b/i,
      /\breboot\b/i,
    ]

    for (const pat of criticalPatterns) {
      if (pat.test(trimmed)) {
        return {
          safe: false,
          riskLevel: 'critical',
          requiresConfirmation: true,
          reason: 'Critical destructive command detected',
          latencyMs: Math.round(performance.now() - startTime),
        }
      }
    }

    for (const pat of highRiskPatterns) {
      if (pat.test(trimmed)) {
        return {
          safe: false,
          riskLevel: 'high',
          requiresConfirmation: true,
          reason: 'Irreversible repository state modification detected',
          latencyMs: Math.round(performance.now() - startTime),
        }
      }
    }

    return {
      safe: true,
      riskLevel: 'low',
      requiresConfirmation: false,
      reason: 'Safe execution parameters validated',
      latencyMs: Math.round(performance.now() - startTime),
    }
  }

  /**
   * Proof Contract Evaluator: Fast rubric evaluation of task outputs.
   * @param {string} output
   * @param {string} contract
   * @returns {Promise<import('./types.js').ProofEvaluationResult>}
   */
  async evaluateProof(output, contract) {
    const startTime = performance.now()
    const lowerOutput = output.toLowerCase()

    const contractClauses = contract
      .split('\n')
      .map(c => c.trim())
      .filter(c => c.length > 0 && !c.startsWith('#'))

    const passed = []
    const failed = []

    for (const clause of contractClauses) {
      const keywords = clause
        .split(/\s+/)
        .filter(w => w.length > 3)
        .map(w => w.toLowerCase())

      const hasMatch = keywords.some(k => lowerOutput.includes(k))
      if (hasMatch) {
        passed.push(clause)
      } else {
        failed.push(clause)
      }
    }

    const total = contractClauses.length || 1
    const score = passed.length / total
    const satisfied = score >= 0.75 && !lowerOutput.includes('error:') && !lowerOutput.includes('failed:')

    return {
      satisfied,
      score: Math.round(score * 100) / 100,
      passedAssertions: passed,
      failedAssertions: failed,
      feedback: satisfied
        ? 'Proof contract satisfied with sufficient empirical evidence.'
        : `Unsatisfied assertions: ${failed.join('; ')}`,
      latencyMs: Math.round(performance.now() - startTime),
    }
  }

  async queryRemoteJev(action, payload) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(`${this.baseUrl}/decisions/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
    }
  }
}
