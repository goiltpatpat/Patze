/**
 * Jev (TypeSafe AI) System 1 Decision & Control Engine for Patze.
 * 
 * Native high-performance ESM engine:
 * 1. Comprehensive Skill Routing (covers all 22 Patpat skills)
 * 2. Hardened Token-Based Safety Guardrails
 * 3. High-Precision Proof Contract & Test Suite Evaluator
 */

export class JevEngine {
  /**
   * @param {import('./types.js').JevConfig} [config]
   */
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.JEV_API_KEY || process.env.TYPESAFE_API_KEY || ''
    this.baseUrl = config.baseUrl || process.env.JEV_BASE_URL || process.env.TYPESAFE_BASE_URL || 'https://api.typesafe.ai/v1'
    this.timeoutMs = config.timeoutMs || 2500
    this.model = config.model || 'jev-latest'
  }

  /**
   * Fast Skill Router: Classifies user prompt into the optimal Patpat engineering skill (all 22 skills).
   * @param {string} prompt
   * @returns {Promise<import('./types.js').SkillRouteResult>}
   */
  async routeSkill(prompt) {
    const startTime = performance.now()
    const lower = prompt.toLowerCase()

    // 1. If remote Jev / TypeSafe API key is configured, call official TypeSafe System One endpoint
    if (this.apiKey) {
      try {
        const remoteResult = await this.querySystemOne(prompt, {
          skill: {
            type: 'choice',
            instructions: 'Select the optimal Patpat autonomous engineering skill for this user request',
            criteria: {
              'patpat-debug': 'Investigate and fix bugs, errors, regressions, memory leaks, or failing tests',
              'patpat-architect': 'Design architecture, data models, schema migrations, or public contracts',
              'patpat-review': 'Conduct skeptical independent code review and challenge PR diffs',
              'patpat-ship': 'Commit, land, or merge pull requests with verified changes',
              'patpat-verify': 'Run acceptance verification against primary runtime surface and test artifacts',
              'patpat-perf': 'Resource optimization, benchmarks, latency, memory, or CPU performance',
              'patpat-plan': 'Multi-phase workflow planning or multi-contract sequence design',
              'patpat-change': 'Bounded feature implementation, refactoring, or minimal diff additions',
              'patpat-loop': 'General evidence-driven engineering workflow',
            },
          },
        })

        const skillAnswer = remoteResult?.answers?.skill
        if (skillAnswer?.choice) {
          return {
            skill: skillAnswer.choice,
            confidence: skillAnswer.confidence ?? 0.95,
            intentCategory: 'typesafe-systemone',
            reasoning: `Selected by TypeSafe Jev (${remoteResult.model || 'jev'}) with calibrated probability ${skillAnswer.probabilities?.[skillAnswer.choice] ?? 1.0}`,
            latencyMs: Math.round(performance.now() - startTime),
          }
        }
      } catch {
        // Fall through seamlessly to local heuristic classifier
      }
    }

    // 2. High-speed System 1 Heuristic Pattern Matcher covering all 22 Patpat skills
    let selectedSkill = 'patpat-loop'
    let confidence = 0.85
    let category = 'general-engineering'
    let reasoning = 'Default evidence-driven loop'

    if (/\b(debug|fix|bug|error|exception|crash|fail|traceback|defect|issue|broken|failing test)\b/i.test(lower)) {
      selectedSkill = 'patpat-debug'
      confidence = 0.96
      category = 'diagnostics'
      reasoning = 'Detected defect diagnosis or error fixing intent'
    } else if (/\b(architect|system design|data model|public contract|boundary|schema migration|architecture)\b/i.test(lower)) {
      selectedSkill = 'patpat-architect'
      confidence = 0.95
      category = 'architecture'
      reasoning = 'Detected architectural, schema migration, or public contract design intent'
    } else if (/\b(review|audit|challenge|inspect-diff|critique|sanity check|skeptical)\b/i.test(lower)) {
      selectedSkill = 'patpat-review'
      confidence = 0.95
      category = 'review'
      reasoning = 'Detected independent skeptical review or verification challenge intent'
    } else if (/\b(ship|land|merge|publish|deploy|open pr|create pr|pull request|release)\b/i.test(lower)) {
      selectedSkill = 'patpat-ship'
      confidence = 0.97
      category = 'delivery'
      reasoning = 'Detected release, PR merge, or shipping intent'
    } else if (/\b(create verifier|project verifier|maintain verifier|authoritative verifier script)\b/i.test(lower)) {
      selectedSkill = 'patpat-verifier'
      confidence = 0.95
      category = 'verification'
      reasoning = 'Detected automated project verifier creation or maintenance intent'
    } else if (/\b(verify|prove|proof contract|evidence|acceptance check|assert real behavior)\b/i.test(lower)) {
      selectedSkill = 'patpat-verify'
      confidence = 0.94
      category = 'verification'
      reasoning = 'Detected proof contract or authoritative surface verification intent'
    } else if (/\b(perf|performance|latency|memory|cpu|throughput|startup time|optimize|benchmark|hillclimb)\b/i.test(lower)) {
      selectedSkill = 'patpat-perf'
      confidence = 0.95
      category = 'optimization'
      reasoning = 'Detected resource optimization or performance benchmarking intent'
    } else if (/\b(arena|competing attempts|alternative designs|pick base|graft|race)\b/i.test(lower)) {
      selectedSkill = 'patpat-arena'
      confidence = 0.96
      category = 'synthesis'
      reasoning = 'Detected competing attempts or design synthesis intent'
    } else if (/\b(swarm|parallel workers|fan out|matrix|coverage matrix|parallel checks)\b/i.test(lower)) {
      selectedSkill = 'patpat-swarm'
      confidence = 0.95
      category = 'scaling'
      reasoning = 'Detected parallel fan-out or matrix execution intent'
    } else if (/\b(state machine|checkpoint|resume|multi-phase run|long work|survive context loss)\b/i.test(lower)) {
      selectedSkill = 'patpat-run'
      confidence = 0.95
      category = 'orchestration'
      reasoning = 'Detected resumable state-machine run or checkpointing intent'
    } else if (/\b(blast radius|downstream regression|contract consumers|trace impact|risky diff)\b/i.test(lower)) {
      selectedSkill = 'patpat-impact'
      confidence = 0.94
      category = 'impact'
      reasoning = 'Detected blast radius tracing or regression risk analysis intent'
    } else if (/\b(learn|encode lesson|recurring failure|durable constraint|prevent mistake)\b/i.test(lower)) {
      selectedSkill = 'patpat-learn'
      confidence = 0.94
      category = 'learning'
      reasoning = 'Detected recurring failure conversion into durable constraint intent'
    } else if (/\b(create skill|new skill|edit skill|skill\.md|agent skill workflow)\b/i.test(lower)) {
      selectedSkill = 'patpat-skill'
      confidence = 0.95
      category = 'meta-skill'
      reasoning = 'Detected reusable agent skill creation or modification intent'
    } else if (/\b(eval skill|skill trigger trial|evaluate routing|test skill)\b/i.test(lower)) {
      selectedSkill = 'patpat-eval'
      confidence = 0.93
      category = 'evaluation'
      reasoning = 'Detected agent skill evaluation or trial execution intent'
    } else if (/\b(setup|install patpat|plugin manager|validate plugin|host compatibility)\b/i.test(lower)) {
      selectedSkill = 'patpat-setup'
      confidence = 0.95
      category = 'setup'
      reasoning = 'Detected Patpat host installation or setup validation intent'
    } else if (/\b(automation|webhook|external automation|kill-switch|trigger idempotency)\b/i.test(lower)) {
      selectedSkill = 'patpat-automation'
      confidence = 0.94
      category = 'automation'
      reasoning = 'Detected external automation or trigger design intent'
    } else if (/\b(delegated slice|integration owner|worker slice|forbidden scope)\b/i.test(lower)) {
      selectedSkill = 'patpat-engineer'
      confidence = 0.93
      category = 'execution'
      reasoning = 'Detected delegated implementation slice execution intent'
    } else if (/\b(plan|workflow design|multi-phase|roadmap|phased sequence)\b/i.test(lower)) {
      selectedSkill = 'patpat-plan'
      confidence = 0.92
      category = 'planning'
      reasoning = 'Detected multi-phase workflow planning intent'
    } else if (/\b(explain|how|why|understand|inspect|explore repo|placement|history)\b/i.test(lower)) {
      selectedSkill = 'patpat-inspect'
      confidence = 0.92
      category = 'exploration'
      reasoning = 'Detected read-only repository understanding intent'
    } else if (/\b(add|create|implement|feature|scaffold|refactor|build)\b/i.test(lower)) {
      selectedSkill = 'patpat-change'
      confidence = 0.91
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
   * Hardened Safety Guardrail: Position-insensitive tokenized inspection of shell commands
   * with full pipeline splitting, wrapper unwrapping (sudo, eval, sh -c), and quote normalization.
   * @param {string} command
   * @returns {Promise<import('./types.js').SafetyCheckResult>}
   */
  async checkSafety(command) {
    const startTime = performance.now()
    const trimmed = command.trim()

    // 1. Split compound command pipelines (;, &&, ||, |, &, newlines)
    const rawSegments = trimmed.split(/(?:;|&&|\|\||&|\n)/).map(s => s.trim()).filter(Boolean)

    for (const segment of rawSegments) {
      const segResult = this._evaluateCommandSegment(segment)
      if (!segResult.safe) {
        return {
          ...segResult,
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
   * Internal segment evaluator that recursively unwraps execution prefixes.
   * @param {string} segment
   * @returns {{ safe: boolean, riskLevel: string, requiresConfirmation: boolean, reason: string }}
   */
  _evaluateCommandSegment(segment) {
    const trimmed = segment.trim()
    const lower = trimmed.toLowerCase()

    // Global Regex Pattern Checks (AgentShield & Obfuscation)
    if (
      /(curl|wget)\s+.*\|\s*(ba|z)?sh\b/i.test(trimmed) ||
      /(curl|wget)\s+.*\|\s*python\b/i.test(trimmed) ||
      /base64\s+(-d|--decode)\s*\|\s*(ba|z)?sh\b/i.test(trimmed) ||
      /:\(\)\s*\{\s*:\|:&\s*\};:/i.test(trimmed) // Fork bomb
    ) {
      return {
        safe: false,
        riskLevel: 'critical',
        requiresConfirmation: true,
        reason: 'Untrusted pipe-to-shell or obfuscated execution pattern detected',
      }
    }

    // Secret and credential exfiltration guardrail (precision hardened against .env templates)
    if (
      /\b(cat|head|tail|more|less|grep)\s+.*(\.ssh\/id_|(?<![\w-])\.pem\b|(?<![\w-])\.key\b|\.env(\.(local|prod|production|dev|development))?\b(?!\.(example|sample|template)))/i.test(trimmed) ||
      /(curl|wget|nc|ncat)\s+.*(@.*\.env|(\$|%)(DEEPSEEK|OPENAI|ANTHROPIC|API_KEY|SECRET|TOKEN))/i.test(trimmed)
    ) {
      return {
        safe: false,
        riskLevel: 'critical',
        requiresConfirmation: true,
        reason: 'Potential credential or secret exfiltration detected',
      }
    }

    // Privileged system path mutation
    if (
      /(>\s*|tee\s+(-\w+\s+)?)\/(etc\/(passwd|shadow|sudoers)|boot|sys|proc)/i.test(trimmed) ||
      /\bchmod\s+[0-7]{3,4}\s+\/etc\/(passwd|shadow|sudoers)\b/i.test(trimmed)
    ) {
      return {
        safe: false,
        riskLevel: 'critical',
        requiresConfirmation: true,
        reason: 'Privileged system path mutation or permission tampering detected',
      }
    }

    // Database drop/truncate
    if (/\b(drop|truncate)\s+(database|schema|table)\b/i.test(trimmed)) {
      return {
        safe: false,
        riskLevel: 'critical',
        requiresConfirmation: true,
        reason: 'Database destruction statement detected',
      }
    }

    // Tokenized Analysis with wrapper unwrapping
    let tokens = lower.split(/\s+/).filter(Boolean).map(t => t.replace(/^["'](.*)["']$/, '$1'))

    // Strip execution wrappers (sudo, nohup, exec, eval, command, builtin, env vars)
    while (tokens.length > 0 && (
      tokens[0] === 'sudo' ||
      tokens[0] === 'nohup' ||
      tokens[0] === 'exec' ||
      tokens[0] === 'eval' ||
      tokens[0] === 'command' ||
      tokens[0] === 'builtin' ||
      tokens[0] === 'xargs' ||
      /^[a-z_][a-z0-9_]*=/.test(tokens[0])
    )) {
      tokens.shift()
    }

    // If subshell call: sh -c "...", bash -c "...", zsh -c "...", recursively unwrap inner command
    if (tokens.length >= 3 && (tokens[0] === 'sh' || tokens[0] === 'bash' || tokens[0] === 'zsh') && tokens[1] === '-c') {
      const inner = tokens.slice(2).join(' ').replace(/^["'](.*)["']$/, '$1')
      return this._evaluateCommandSegment(inner)
    }

    // Strip path prefix from binary: /bin/rm -> rm, /usr/bin/git -> git
    if (tokens.length > 0) {
      tokens[0] = tokens[0].replace(/^.*[\\/]/, '')
    }

    // Check: Critical destructive file deletion
    if (tokens[0] === 'rm') {
      const hasRecursive = tokens.some(t => t === '-r' || t === '-R' || (t.startsWith('-') && t.includes('r')))
      const hasForce = tokens.some(t => t === '-f' || (t.startsWith('-') && t.includes('f')))
      const targets = tokens.filter(t => !t.startsWith('-'))
      const dangerousTargets = targets.some(t => t === '/' || t === '/*' || t.startsWith('/etc') || t.startsWith('/var') || t === '~' || t === '~/' || t === '*' || t === './*' || t === '.')

      if (hasRecursive && hasForce && dangerousTargets) {
        return {
          safe: false,
          riskLevel: 'critical',
          requiresConfirmation: true,
          reason: 'Catastrophic destructive recursive deletion detected',
        }
      }
    }

    // Check: Destructive disk/filesystem formatting
    if (tokens.some(t => t === 'mkfs' || t.startsWith('mkfs.') || (t === 'dd' && lower.includes('if=')))) {
      return {
        safe: false,
        riskLevel: 'critical',
        requiresConfirmation: true,
        reason: 'Raw disk write or formatting command detected',
      }
    }

    // Check: Git force push to default/main branch
    if (tokens[0] === 'git' && tokens.includes('push')) {
      const hasForceFlag = tokens.some(t => t === '--force' || t === '-f' || t.startsWith('--force-with-lease'))
      const targetsMain = tokens.some(t => t === 'main' || t === 'master' || t === 'HEAD')
      if (hasForceFlag && targetsMain) {
        return {
          safe: false,
          riskLevel: 'critical',
          requiresConfirmation: true,
          reason: 'Force push to protected primary branch detected',
        }
      }
    }

    // Check: Hard git resets or clean that destroy uncommitted work
    if (tokens[0] === 'git' && (lower.includes('reset --hard') || lower.includes('clean -fdx') || lower.includes('clean -dfx'))) {
      return {
        safe: false,
        riskLevel: 'high',
        requiresConfirmation: true,
        reason: 'Irreversible destruction of uncommitted local working tree changes',
      }
    }

    return {
      safe: true,
      riskLevel: 'low',
      requiresConfirmation: false,
      reason: 'Safe execution parameters validated',
    }
  }

  /**
   * High-Precision Proof Contract Evaluator:
   * Handles exit codes, test summaries (e.g. "Failed: 0"), assertion phrases, and positive/negative evidence.
   * @param {string | { stdout?: string, stderr?: string, exitCode?: number }} output
   * @param {string | string[]} contract
   * @returns {Promise<import('./types.js').ProofEvaluationResult>}
   */
  async evaluateProof(output, contract) {
    const startTime = performance.now()

    let textOutput = ''
    let exitCode = 0
    if (typeof output === 'string') {
      textOutput = output
    } else if (output && typeof output === 'object') {
      textOutput = `${output.stdout ?? ''}\n${output.stderr ?? ''}`
      if (typeof output.exitCode === 'number') {
        exitCode = output.exitCode
      }
    } else {
      textOutput = String(output ?? '')
    }

    const lowerOutput = textOutput.toLowerCase()

    // 1. Detect explicit test execution success summaries and active failures
    const hasZeroFailures = /\bfailed:\s*0\b/i.test(textOutput) || /\b0\s+failed\b/i.test(textOutput) || /\b0\s+errors\b/i.test(textOutput)
    const hasActiveFailures = exitCode !== 0
      || /\bfailed:\s*[1-9]\d*\b/i.test(textOutput)
      || /\b[1-9]\d*\s+failed\b/i.test(textOutput)
      || /\b[1-9]\d*\s+error(s)?\b/i.test(textOutput)
      || /\bassertionerror\b/i.test(textOutput)
      || /\bpanic:\s+/i.test(textOutput)
      || /\bfail:\s+/i.test(textOutput)
      || /\bunhandled(promiserejection|exception)\b/i.test(textOutput)
      || /\b(typeerror|syntaxerror|referenceerror):\s+/i.test(textOutput)
      || /\bts[0-9]{4,5}:\s+/i.test(textOutput)
      || /\bcompilation failed\b/i.test(textOutput)
      || /\bsegmentation fault\b/i.test(textOutput)

    // 2. Parse contract clauses
    let contractClauses = []
    if (Array.isArray(contract)) {
      contractClauses = contract
        .map(c => String(c).trim())
        .filter(c => c.length > 0 && !c.startsWith('#'))
    } else if (typeof contract === 'string') {
      contractClauses = contract
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0 && !c.startsWith('#'))
    } else {
      contractClauses = [String(contract ?? '').trim()]
    }

    if (contractClauses.length === 0) {
      contractClauses = ['execution succeeds without errors']
    }

    const passed = []
    const failed = []

    for (const clause of contractClauses) {
      const lowerClause = clause.toLowerCase()

      // Check negation clauses (e.g. "without error", "0 failures", "no regressions")
      if (lowerClause.includes('without error') || lowerClause.includes('0 failure') || lowerClause.includes('no error')) {
        if (!hasActiveFailures && (hasZeroFailures || lowerOutput.includes('success') || lowerOutput.includes('passed') || exitCode === 0)) {
          passed.push(clause)
        } else {
          failed.push(clause)
        }
        continue
      }

      // Check multi-word phrase matching
      const keywords = clause
        .split(/\s+/)
        .filter(w => w.length > 2)
        .map(w => w.toLowerCase())

      const matchedCount = keywords.filter(k => lowerOutput.includes(k)).length
      const matchRatio = keywords.length > 0 ? matchedCount / keywords.length : 0

      if (matchRatio >= 0.5 && !hasActiveFailures) {
        passed.push(clause)
      } else {
        failed.push(clause)
      }
    }

    const total = contractClauses.length || 1
    const score = passed.length / total
    let satisfied = score >= 0.75 && !hasActiveFailures

    // Optional: TypeSafe Jev Semantic Verification Layer (when apiKey is available)
    if (this.apiKey && !hasActiveFailures && textOutput.trim().length > 10) {
      try {
        const jevEval = await this.querySystemOne(
          `Contract Requirements:\n${contractClauses.join('\n')}\n\nActual Execution Output:\n${textOutput.slice(-1500)}`,
          {
            is_satisfied: {
              type: 'noul',
              instructions: 'Does the actual execution output provide verifiable empirical evidence that the contract requirements were fully met without errors or unhandled failures?',
            },
          }
        )

        if (typeof jevEval?.answers?.is_satisfied?.noul === 'number') {
          const probability = jevEval.answers.is_satisfied.noul
          if (probability < 0.35) {
            satisfied = false
            failed.push(`TypeSafe Jev rejected proof confidence (${probability})`)
          }
        }
      } catch {
        // Fall back cleanly to deterministic evaluation
      }
    }

    return {
      satisfied,
      score: Math.round(score * 100) / 100,
      passedAssertions: passed,
      failedAssertions: failed,
      feedback: satisfied
        ? 'Proof contract satisfied with verified empirical evidence.'
        : `Unsatisfied assertions: ${failed.join('; ')}`,
      latencyMs: Math.round(performance.now() - startTime),
    }
  }

  /**
   * Remote TypeSafe System One API Client:
   * Formats questions according to the official TypeSafe System One API contract (/v1/systemone)
   * @param {string} state - Context/state for the judgment
   * @param {Record<string, any>} questions - Dictionary of Choice, Score, or Noul questions
   * @returns {Promise<any>}
   */
  async querySystemOne(state, questions) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(`${this.baseUrl}/systemone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          state,
          model: this.model,
          questions,
        }),
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
