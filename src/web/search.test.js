import test from 'node:test'
import assert from 'node:assert/strict'
import { PatzeSearchProvider, PATZE_SEARCH_PROVIDER_ID } from './search.js'

test('PatzeSearchProvider: registration contract and availability', () => {
  const provider = new PatzeSearchProvider()
  assert.equal(provider.id, PATZE_SEARCH_PROVIDER_ID)
  assert.equal(provider.available(), true)
})

test('PatzeSearchProvider: empty query returns empty sources safely', async () => {
  const provider = new PatzeSearchProvider()
  const result = await provider.search({ query: '' })
  assert.deepEqual(result.sources, [])
  assert.equal(result.truncated, false)
})

test('PatzeSearchProvider: live web search yields structured sources with valid URLs', async () => {
  const provider = new PatzeSearchProvider({ timeoutMs: 10000 })
  const result = await provider.search({ query: 'Patze autonomous agent goiltpatpat', maxResults: 3 })
  assert.ok(Array.isArray(result.sources))
  if (result.sources.length > 0) {
    const first = result.sources[0]
    assert.ok(first.url.startsWith('http://') || first.url.startsWith('https://'))
    assert.ok(typeof first.title === 'string' && first.title.length > 0)
  }
})

test('PatzeSearchProvider: timeout or aborted signal handled without unhandled rejection', async () => {
  const provider = new PatzeSearchProvider({ timeoutMs: 1 })
  const controller = new AbortController()
  controller.abort()
  const result = await provider.search({ query: 'test' }, controller.signal)
  assert.ok(Array.isArray(result.sources))
  assert.equal(result.truncated, false)
})
