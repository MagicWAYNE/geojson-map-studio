import { describe, expect, it, vi } from 'vitest'
import { createOAuthClient, OAuthHttpError } from './oauth-client.mjs'

function json(value: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  })
}

describe('CDSE OAuth client', () => {
  it('reuses a token until its expiry skew and refreshes after expiry', async () => {
    let now = 1_000
    const request = vi.fn()
      .mockResolvedValueOnce(json({ access_token: 'first-token', expires_in: 60 }))
      .mockResolvedValueOnce(json({ access_token: 'second-token', expires_in: 60 }))
    const client = createOAuthClient({
      tokenEndpoint: 'https://identity.example/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetch: request,
      now: () => now,
      expirySkewMs: 1_000
    })
    expect(await client.accessToken()).toBe('first-token')
    expect(await client.accessToken()).toBe('first-token')
    now += 60_000
    expect(await client.accessToken()).toBe('second-token')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('refreshes exactly once after 401 and never exposes the token', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(json({ access_token: 'stale-secret-token', expires_in: 60 }))
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(json({ access_token: 'fresh-secret-token', expires_in: 60 }))
      .mockResolvedValueOnce(json({ ok: true }))
    const client = createOAuthClient({
      tokenEndpoint: 'https://identity.example/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetch: request,
      expirySkewMs: 0
    })
    const response = await client.authorizedFetch('https://service.example/resource')
    expect(response.status).toBe(200)
    expect(request).toHaveBeenCalledTimes(4)
  })

  it('rejects malformed token responses and redacts 429/error bodies', async () => {
    const malformed = createOAuthClient({
      tokenEndpoint: 'https://identity.example/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetch: vi.fn().mockResolvedValue(json({ expires_in: 60 }))
    })
    await expect(malformed.accessToken()).rejects.toThrow(/missing a valid access token/i)

    const request = vi.fn()
      .mockResolvedValueOnce(json({ access_token: 'private-token', expires_in: 60 }))
      .mockResolvedValueOnce(new Response(
        'Bearer private-token client-secret',
        { status: 429, headers: { 'retry-after': '3' } }
      ))
    const client = createOAuthClient({
      tokenEndpoint: 'https://identity.example/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      fetch: request
    })
    const error = await client.checkedFetch('https://service.example/resource').catch((cause) => cause)
    expect(error).toBeInstanceOf(OAuthHttpError)
    expect(error.status).toBe(429)
    expect(error.retryAfter).toBe('3')
    expect(error.message).not.toContain('private-token')
    expect(error.message).not.toContain('client-secret')
  })
})
