/**
 * Patze Universal Web Search Provider
 *
 * Implements Cordis @deepseek-ai/dsh-web WebSearchProvider interface.
 * Enables zero-cost, multi-provider web search for all LLM models (Kimi, OpenAI, DeepSeek, etc.)
 * without requiring dedicated external paid search API keys (Exa, Perplexity, DeepSeek-Search).
 */

export const PATZE_SEARCH_PROVIDER_ID = 'patze-search'

/**
 * Clean HTML entities and tags from extracted search snippets.
 */
function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract target URL from DuckDuckGo redirect link.
 */
function extractTargetUrl(rawUrl) {
  if (!rawUrl) return ''
  if (rawUrl.includes('uddg=')) {
    const match = rawUrl.match(/uddg=([^&]+)/)
    if (match) {
      try {
        return decodeURIComponent(match[1])
      } catch {
        return match[1]
      }
    }
  }
  return rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl
}

/**
 * Universal Search Provider for Patze platform
 */
export class PatzeSearchProvider {
  constructor(options = {}) {
    this.id = options.id ?? PATZE_SEARCH_PROVIDER_ID
    this.timeoutMs = options.timeoutMs ?? 15000
    this.maxResults = options.maxResults ?? 5
  }

  /**
   * The provider is always available because it includes a zero-config open fallback.
   */
  available() {
    return true
  }

  /**
   * Execute web search query and return normalized WebSearchResult.
   * @param {import('@deepseek-ai/dsh-web').WebSearchRequest} request
   * @param {AbortSignal} [signal]
   * @returns {Promise<import('@deepseek-ai/dsh-web').WebSearchResult>}
   */
  async search(request, signal) {
    const query = request.query?.trim()
    if (!query) {
      return { sources: [], truncated: false }
    }

    const limit = Math.max(1, request.maxResults ?? this.maxResults)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
      if (signal) {
        signal.addEventListener('abort', () => controller.abort(), { once: true })
      }

      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
      const res = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
      clearTimeout(timeout)

      if (!res.ok) {
        return { sources: [], truncated: false }
      }

      const html = await res.text()
      const sources = []

      // DuckDuckGo HTML result parsing
      const resultBlocks = html.split('<div class="result results_links')
      for (let i = 1; i < resultBlocks.length && sources.length < limit; i++) {
        const block = resultBlocks[i]
        const linkMatch = block.match(/<a[^>]*class="result__url"[^>]*href="([^"]+)"[^>]*>/)
        const headerMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
        const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)

        let rawUrl = (headerMatch && headerMatch[1]) || (linkMatch && linkMatch[1]) || ''
        const targetUrl = extractTargetUrl(rawUrl)

        const title = headerMatch ? cleanText(headerMatch[2]) : targetUrl
        const snippet = snippetMatch ? cleanText(snippetMatch[1]) : ''

        if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
          sources.push({
            url: targetUrl,
            title: title || targetUrl,
            snippet: snippet || undefined,
          })
        }
      }

      return {
        sources,
        truncated: sources.length >= limit,
      }
    } catch {
      // Fail-open: return empty sources instead of throwing to prevent crashing turn loop
      return { sources: [], truncated: false }
    }
  }
}
