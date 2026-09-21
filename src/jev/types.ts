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

export interface RerankCandidate {
  id: string | number
  text: string
  source?: string
  version?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface ScoredCandidate extends RerankCandidate {
  score: number // calibrated probability 0.0 to 1.0
  rank: number
}

export interface RerankResult {
  query: string
  policy: string
  ranked: ScoredCandidate[]
  topCandidate: ScoredCandidate | null
  latencyMs: number
}

export interface CitationCheckResult {
  stance: 'supports' | 'contradicts' | 'unaddressed'
  confidence: number
  probabilities: {
    supports: number
    contradicts: number
    unaddressed: number
  }
  latencyMs: number
}

export interface JevConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  fallbackToHeuristics?: boolean
  timeoutMs?: number
}

