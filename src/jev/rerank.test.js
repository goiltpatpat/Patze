import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_POLICIES,
  renderCandidateChunk,
  heuristicPolicyScore,
  rerankCandidates,
  verifyCitation,
} from './rerank.js'

const SAMPLE_CHUNKS = [
  {
    id: 'c1',
    source: 'official docs',
    version: 'v2',
    year: 2026,
    text: "API v2 returns 401 when the bearer token in the Authorization header is missing, malformed, or expired. To fix: generate a fresh scoped token in Settings > API Keys and pass it as 'Authorization: Bearer <token>'."
  },
  {
    id: 'c2',
    source: 'stackoverflow',
    version: 'v1',
    year: 2019,
    text: "Just pass your api_key as a URL query parameter like ?api_key=XXX and the 401 goes away. Works every time."
  },
  {
    id: 'c3',
    source: 'blog',
    version: 'v2',
    year: 2025,
    text: "Quick fix for 401: regenerate your key in the dashboard and paste it into the Authorization header as 'Bearer <key>'. Takes ten seconds."
  },
  {
    id: 'c4',
    source: 'official docs',
    version: 'v2',
    year: 2026,
    text: "Authentication concepts: tokens are short-lived by design. A 401 signals an expired or malformed credential, while 403 signals a valid credential lacking permission."
  },
  {
    id: 'c5',
    source: 'forum',
    version: 'v1',
    year: 2020,
    text: "In v1 the 401 was caused by the deprecated HMAC signing scheme. Switch your signature to base64 and it resolves."
  },
  {
    id: 'c6',
    source: 'official docs',
    version: 'v2',
    year: 2026,
    text: "Changelog v2.4: Rate limits now return 429 instead of 401. If your client previously retried 401s for throttling, update your handler."
  },
]

const QUERY = 'How do I fix a 401 Unauthorized error from the API?'

test('renderCandidateChunk formats metadata and text cleanly', () => {
  const rendered = renderCandidateChunk(SAMPLE_CHUNKS[0])
  assert.ok(rendered.includes('[c1]'))
  assert.ok(rendered.includes('source: official docs'))
  assert.ok(rendered.includes('version: v2'))
  assert.ok(rendered.includes('Authorization: Bearer'))
})

test('rerankCandidates under authoritative policy promotes official v2 docs to top-1', async () => {
  const result = await rerankCandidates({
    query: QUERY,
    candidates: SAMPLE_CHUNKS,
    policy: 'authoritative',
  })

  assert.equal(result.ranked.length, SAMPLE_CHUNKS.length)
  assert.equal(result.topCandidate.id, 'c1', 'Top candidate under authoritative policy must be c1')
  assert.equal(result.topCandidate.rank, 1)
  assert.ok(result.topCandidate.score > 0.70)

  // v1 forum post (c5) and legacy stackoverflow (c2) should be ranked near bottom
  const c5 = result.ranked.find(c => c.id === 'c5')
  assert.ok(c5.rank > 3, 'Deprecated v1 forum post must not be top ranked')
})

test('rerankCandidates under fast_workaround policy promotes quick fixes to top-1', async () => {
  const result = await rerankCandidates({
    query: QUERY,
    candidates: SAMPLE_CHUNKS,
    policy: 'fast_workaround',
  })

  // c3 ("Quick fix for 401: ... Takes ten seconds") or c2 should be boosted over conceptual docs
  assert.ok(result.topCandidate.id === 'c3' || result.topCandidate.id === 'c2')
  const c4 = result.ranked.find(c => c.id === 'c4') // conceptual explanation only
  assert.ok(c4.rank > 2, 'Conceptual background without fix must be penalized')
})

test('rerankCandidates under security_hardened policy penalizes query string API keys', async () => {
  const result = await rerankCandidates({
    query: QUERY,
    candidates: SAMPLE_CHUNKS,
    policy: 'security_hardened',
  })

  // c2 (passing key in query param like ?api_key=XXX) should have lowest score
  const c2 = result.ranked.find(c => c.id === 'c2')
  assert.ok(c2.score < 0.35, 'Insecure URL query API key must be penalized')
})

test('rerankCandidates respects topK parameter', async () => {
  const result = await rerankCandidates({
    query: QUERY,
    candidates: SAMPLE_CHUNKS,
    policy: 'authoritative',
    topK: 3,
  })

  assert.equal(result.ranked.length, 3)
})

test('rerankCandidates handles 64-worker concurrent scale (200 candidates in milliseconds)', async () => {
  // Multiply sample chunks to 200 items to test concurrent pool
  const bigList = []
  for (let i = 0; i < 200; i++) {
    bigList.push({
      ...SAMPLE_CHUNKS[i % SAMPLE_CHUNKS.length],
      id: `chunk_${i}`,
    })
  }

  const t0 = performance.now()
  const result = await rerankCandidates({
    query: QUERY,
    candidates: bigList,
    policy: 'authoritative',
    concurrency: 64,
  })
  const dt = performance.now() - t0

  assert.equal(result.ranked.length, 200)
  assert.ok(dt < 200, `200 items evaluated concurrently should take <200ms, took ${dt.toFixed(1)}ms`)
})

test('verifyCitation accurately identifies supports, contradicts, and unaddressed stances', async () => {
  // Case 1: Supports
  const res1 = await verifyCitation({
    claim: 'Revenue grew 40% year over year.',
    sourceText: 'Total company revenue for the period rose from $50M to $70M versus the prior year.',
  })
  assert.equal(res1.stance, 'supports')
  assert.ok(res1.confidence >= 0.80)

  // Case 2: Contradicts (Profit vs Operating Loss)
  const res2 = await verifyCitation({
    claim: 'The company was profitable in Q3.',
    sourceText: 'Q3 closed with an operating loss of $12M, narrowing from $20M in the prior year.',
  })
  assert.equal(res2.stance, 'contradicts')
  assert.ok(res2.confidence >= 0.80)

  // Case 3: Unaddressed
  const res3 = await verifyCitation({
    claim: 'Supports Python 3.12 syntax and modern typing.',
    sourceText: 'The database connection pool timeout is configured to 30 seconds by default.',
  })
  assert.equal(res3.stance, 'unaddressed')
})

test('remote Jev querySystemOne evaluates Noul and Choice questions via API mock', async () => {
  const mockEngine = {
    apiKey: 'mock-key',
    querySystemOne: async (state, questions) => {
      if (questions.rank) {
        // Noul rerank mock
        const isV2 = state.candidate_chunk.includes('v2')
        return { answers: { rank: { noul: isV2 ? 0.94 : 0.08 } } }
      }
      if (questions.relation) {
        // Choice citation mock
        return {
          answers: {
            relation: {
              choice: 'supports',
              confidence: 0.98,
              probabilities: { supports: 0.98, contradicts: 0.01, unaddressed: 0.01 },
            },
          },
        }
      }
      return null
    },
  }

  const rerankRes = await rerankCandidates({
    engine: mockEngine,
    query: QUERY,
    candidates: SAMPLE_CHUNKS,
    policy: 'authoritative',
  })
  assert.equal(rerankRes.topCandidate.score, 0.94)

  const citeRes = await verifyCitation({
    engine: mockEngine,
    claim: 'Claim text',
    sourceText: 'Passage text',
  })
  assert.equal(citeRes.stance, 'supports')
  assert.equal(citeRes.confidence, 0.98)
})
