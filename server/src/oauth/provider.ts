import type { Response } from 'express'
import { and, eq, gt } from 'drizzle-orm'
import type { OAuthServerProvider, AuthorizationParams } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { InvalidGrantError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { schema } from '../db/index.js'
import { randomToken, sha256 } from '../lib.js'
import type { Ctx } from '../services/context.js'

const ACCESS_TTL = 60 * 60 // 1 h
const REFRESH_TTL = 60 * 60 * 24 * 30 // 30 days
const CODE_TTL = 5 * 60
export const SCOPE = 'workshop'

/** An authorization request waiting for the owner to sign in and click "Allow". */
export interface PendingAuth { client: OAuthClientInformationFull; params: AuthorizationParams; csrf: string; expires: number }

/**
 * OAuth 2.1 authorization server for the MCP connector, backed by the database.
 * Dynamic client registration and PKCE are handled by the SDK router; this class stores
 * clients, codes and (hashed) tokens and sends the browser to our consent page.
 */
export class WorkshopOAuthProvider implements OAuthServerProvider {
  /** short-lived, single instance is fine; codes and tokens themselves live in the DB */
  readonly pending = new Map<string, PendingAuth>()

  constructor(private ctx: Ctx) {}

  get clientsStore(): OAuthRegisteredClientsStore {
    const db = this.ctx.db
    return {
      async getClient(clientId) {
        const [c] = await db.select().from(schema.oauthClients).where(eq(schema.oauthClients.clientId, clientId))
        return c?.info as OAuthClientInformationFull | undefined
      },
      async registerClient(client) {
        const full = client as OAuthClientInformationFull
        await db.insert(schema.oauthClients).values({ clientId: full.client_id, info: full as unknown as Record<string, unknown> })
        return full
      },
    }
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    const id = randomToken(18)
    const now = Date.now()
    for (const [k, v] of this.pending) if (v.expires < now) this.pending.delete(k)
    this.pending.set(id, { client, params, csrf: randomToken(18), expires: now + 10 * 60_000 })
    res.redirect(302, `/oauth/consent?req=${encodeURIComponent(id)}`)
  }

  /** Called by the consent page after the owner allowed access. Returns where to send the browser. */
  async issueCode(p: PendingAuth, userId: number) {
    const code = randomToken()
    await this.ctx.db.insert(schema.oauthCodes).values({
      codeHash: sha256(code), clientId: p.client.client_id, userId, codeChallenge: p.params.codeChallenge,
      redirectUri: p.params.redirectUri, scopes: p.params.scopes?.length ? p.params.scopes : [SCOPE],
      resource: p.params.resource?.href ?? null, expiresAt: new Date(Date.now() + CODE_TTL * 1000),
    })
    const url = new URL(p.params.redirectUri)
    url.searchParams.set('code', code)
    if (p.params.state) url.searchParams.set('state', p.params.state)
    return url.href
  }

  denyRedirect(p: PendingAuth) {
    const url = new URL(p.params.redirectUri)
    url.searchParams.set('error', 'access_denied')
    url.searchParams.set('error_description', 'The workshop owner did not allow access')
    if (p.params.state) url.searchParams.set('state', p.params.state)
    return url.href
  }

  private async findCode(client: OAuthClientInformationFull, code: string) {
    const [row] = await this.ctx.db.select().from(schema.oauthCodes).where(and(eq(schema.oauthCodes.codeHash, sha256(code)), eq(schema.oauthCodes.clientId, client.client_id)))
    if (!row || row.expiresAt < new Date()) throw new InvalidGrantError('Authorization code is invalid or expired')
    return row
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, code: string) {
    return (await this.findCode(client, code)).codeChallenge
  }

  async exchangeAuthorizationCode(client: OAuthClientInformationFull, code: string, _verifier?: string, redirectUri?: string, resource?: URL): Promise<OAuthTokens> {
    const row = await this.findCode(client, code)
    // single use: delete before issuing, so a replayed code fails
    await this.ctx.db.delete(schema.oauthCodes).where(eq(schema.oauthCodes.codeHash, row.codeHash))
    if (redirectUri && redirectUri !== row.redirectUri) throw new InvalidGrantError('redirect_uri does not match')
    if (resource && row.resource && resource.href !== row.resource) throw new InvalidGrantError('resource does not match')
    return this.issueTokens(client.client_id, row.userId, row.scopes, row.resource)
  }

  async exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[], resource?: URL): Promise<OAuthTokens> {
    const [row] = await this.ctx.db.select().from(schema.oauthTokens).where(and(
      eq(schema.oauthTokens.tokenHash, sha256(refreshToken)), eq(schema.oauthTokens.kind, 'refresh'),
      eq(schema.oauthTokens.clientId, client.client_id), eq(schema.oauthTokens.revoked, false), gt(schema.oauthTokens.expiresAt, new Date()),
    ))
    if (!row) throw new InvalidGrantError('Refresh token is invalid or expired')
    if (scopes?.some((s) => !row.scopes.includes(s))) throw new InvalidGrantError('Cannot widen the scope')
    if (resource && row.resource && resource.href !== row.resource) throw new InvalidGrantError('resource does not match')
    // rotate: the old refresh token stops working
    await this.ctx.db.update(schema.oauthTokens).set({ revoked: true }).where(eq(schema.oauthTokens.tokenHash, row.tokenHash))
    return this.issueTokens(client.client_id, row.userId, scopes?.length ? scopes : row.scopes, row.resource)
  }

  private async issueTokens(clientId: string, userId: number, scopes: string[], resource: string | null): Promise<OAuthTokens> {
    const access = randomToken()
    const refresh = randomToken()
    const now = Date.now()
    await this.ctx.db.insert(schema.oauthTokens).values([
      { tokenHash: sha256(access), kind: 'access', clientId, userId, scopes, resource, expiresAt: new Date(now + ACCESS_TTL * 1000) },
      { tokenHash: sha256(refresh), kind: 'refresh', clientId, userId, scopes, resource, expiresAt: new Date(now + REFRESH_TTL * 1000) },
    ])
    return { access_token: access, token_type: 'bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope: scopes.join(' ') }
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const [row] = await this.ctx.db.select({ t: schema.oauthTokens, c: schema.oauthClients }).from(schema.oauthTokens)
      .innerJoin(schema.oauthClients, eq(schema.oauthClients.clientId, schema.oauthTokens.clientId))
      .where(and(eq(schema.oauthTokens.tokenHash, sha256(token)), eq(schema.oauthTokens.kind, 'access'), eq(schema.oauthTokens.revoked, false)))
    if (!row || row.t.expiresAt < new Date()) throw new InvalidTokenError('Access token is invalid or expired')
    return {
      token, clientId: row.t.clientId, scopes: row.t.scopes, expiresAt: Math.floor(row.t.expiresAt.getTime() / 1000),
      resource: row.t.resource ? new URL(row.t.resource) : undefined,
      extra: { userId: row.t.userId, clientName: (row.c.info as { client_name?: string }).client_name ?? row.t.clientId },
    }
  }

  async revokeToken(client: OAuthClientInformationFull, req: OAuthTokenRevocationRequest) {
    await this.ctx.db.update(schema.oauthTokens).set({ revoked: true })
      .where(and(eq(schema.oauthTokens.tokenHash, sha256(req.token)), eq(schema.oauthTokens.clientId, client.client_id)))
  }

  /** Admin: revoke everything a connected client holds (disconnect). */
  async disconnectClient(clientId: string) {
    await this.ctx.db.update(schema.oauthTokens).set({ revoked: true }).where(eq(schema.oauthTokens.clientId, clientId))
  }
}
