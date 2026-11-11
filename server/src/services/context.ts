import type { DB } from '../db/index.js'
import { schema } from '../db/index.js'
import type { MediaStore } from '../storage.js'
import type { Config } from '../config.js'

/** Who is acting: an admin user, an MCP client, or an anonymous website visitor. */
export type Actor = { kind: 'user'; userId: number; label: string } | { kind: 'mcp'; clientId: string; userId: number; label: string } | { kind: 'public'; label: 'public' }

export interface Ctx {
  db: DB
  store: MediaStore
  config: Config
}

export const actorTag = (a: Actor) => (a.kind === 'user' ? `user:${a.userId}` : a.kind === 'mcp' ? `mcp:${a.label}` : 'public')

export async function audit(ctx: Ctx, actor: Actor, action: string, target?: string, details?: unknown) {
  await ctx.db.insert(schema.auditLog).values({ actor: actorTag(actor), action, target, details: details ?? null })
}
