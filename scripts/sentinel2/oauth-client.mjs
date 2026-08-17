const DEFAULT_EXPIRY_SKEW_MS = 30_000

function sanitizedText(value, secrets = []) {
  let text = String(value ?? '')
  for (const secret of secrets.filter(Boolean)) text = text.split(String(secret)).join('[REDACTED]')
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/"(?:access_token|refresh_token|client_secret)"\s*:\s*"[^"]*"/gi, '"$1":"[REDACTED]"')
    .slice(0, 500)
}
export class OAuthHttpError extends Error {
  constructor(message, { status, retryAfter = null } = {}) {
    super(message)
    this.name = 'OAuthHttpError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

export function createOAuthClient({
  tokenEndpoint,
  clientId,
  clientSecret,
  fetch: request = globalThis.fetch,
  now = () => Date.now(),
  expirySkewMs = DEFAULT_EXPIRY_SKEW_MS
}) {
  if (!tokenEndpoint || !clientId || !clientSecret) throw new Error('OAuth client configuration is incomplete')
  let cached = null

  async function requestToken() {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    })
    let response
    try {
      response = await request(tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body
      })
    } catch (cause) {
      throw new OAuthHttpError(`OAuth token request failed: ${sanitizedText(cause, [clientId, clientSecret])}`)
    }
    if (!response.ok) {
      const detail = sanitizedText(await response.text().catch(() => ''), [clientId, clientSecret])
      throw new OAuthHttpError(
        `OAuth token request failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`,
        { status: response.status, retryAfter: response.headers.get('retry-after') }
      )
    }
    let payload
    try {
      payload = await response.json()
    } catch {
      throw new OAuthHttpError('OAuth token response was not valid JSON', { status: response.status })
    }
    if (
      typeof payload?.access_token !== 'string' || !payload.access_token ||
      typeof payload?.expires_in !== 'number' || !Number.isFinite(payload.expires_in) || payload.expires_in <= 0
    ) {
      throw new OAuthHttpError('OAuth token response was missing a valid access token or expiry', { status: response.status })
    }
    cached = {
      value: payload.access_token,
      expiresAt: now() + payload.expires_in * 1000
    }
    return cached.value
  }

  async function accessToken(forceRefresh = false) {
    if (!forceRefresh && cached && cached.expiresAt - expirySkewMs > now()) return cached.value
    cached = null
    return requestToken()
  }

  async function authorizedFetch(url, init = {}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await accessToken(attempt === 1)
      const headers = new Headers(init.headers)
      headers.set('authorization', `Bearer ${token}`)
      let response
      try {
        response = await request(url, { ...init, headers })
      } catch (cause) {
        throw new OAuthHttpError(`Authorized request failed: ${sanitizedText(cause, [clientId, clientSecret, token])}`)
      }
      if (response.status !== 401 || attempt === 1) return response
      cached = null
    }
    throw new OAuthHttpError('Authorized request failed after token refresh')
  }

  async function checkedFetch(url, init = {}) {
    const response = await authorizedFetch(url, init)
    if (response.ok) return response
    const detail = sanitizedText(await response.clone().text().catch(() => ''), [clientId, clientSecret, cached?.value])
    throw new OAuthHttpError(
      `Authorized request failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`,
      { status: response.status, retryAfter: response.headers.get('retry-after') }
    )
  }

  return {
    accessToken,
    authorizedFetch,
    checkedFetch,
    invalidate() { cached = null }
  }
}
