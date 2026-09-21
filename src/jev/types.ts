/**
 * Type definitions for Jev (TypeSafe AI) System 1 Decision Layer in Patze.
 */

export type JevRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface JevDecision<T = unknown> {
  verdict: T
  confidence: number
  latencyMs: number
  source: 'jev-remote' | 'system1-heuristic'
  reasoning?: string
}

export interface SkillRouteResult {
  skill: string | null
  confidence: number
  intentCategory: string
  reasoning: string
  latencyMs: number
}

export interface SafetyCheckResult {
  safe: boolean
  riskLevel: JevRiskLevel
  requiresConfirmation: boolean
  reason: string
  latencyMs: number
}

export interface ProofEvaluationResult {
  satisfied: boolean
  score: number // 0 to 1.0
  passedAssertions: string[]
  failedAssertions: string[]
  feedback: string
  latencyMs: number
}

export interface JevConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  fallbackToHeuristics?: boolean
  timeoutMs?: number
}
