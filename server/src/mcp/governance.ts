import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { schema } from '../db/index.js'
import { AppError, badRequest, newId, notFound } from '../lib.js'
import { audit, type Actor, type Ctx } from '../services/context.js'
import { mediaUrl } from '../services/content.js'
import { TOOLS, TOOL_MAP, type Mode, type ToolDef } from './registry.js'

/* ---------------- policies ---------------- */

export async function policies(ctx: Ctx) {
  const rows = await ctx.db.select().from(schema.mcpPolicies)
  const set = new Map(rows.map((r) => [r.tool, r.mode as Mode]))
  return TOOLS.map((t) => ({ tool: t.name, title: t.title, area: t.area, readOnly: t.readOnly, default: t.mode, mode: set.get(t.name) ?? t.mode }))
}

export async function modeOf(ctx: Ctx, tool: string): Promise<Mode> {
  const [row] = await ctx.db.select().from(schema.mcpPolicies).where(eq(schema.mcpPolicies.tool, tool))
  return (row?.mode as Mode) ?? TOOL_MAP.get(tool)?.mode ?? 'DENY'
}

export async function setPolicy(ctx: Ctx, actor: Actor, tool: string, mode: Mode) {
  if (!TOOL_MAP.has(tool)) throw notFound(`Tool ${tool}`)
  await ctx.db.insert(schema.mcpPolicies).values({ tool, mode }).onConflictDoUpdate({ target: schema.mcpPolicies.tool, set: { mode, updatedAt: new Date() } })
  await audit(ctx, actor, 'mcp.policy', tool, { mode })
  return { tool, mode }
}

/* ---------------- invoking a tool under its policy ---------------- */

export type InvokeResult =
  | { status: 'done'; result: unknown }
  | { status: 'pending_approval'; approval_id: string; summary: string; link: string; message: string }

const approvalLink = (ctx: Ctx, id: string) => `${ctx.config.adminUrl}/approvals?id=${id}`

export async function invoke(ctx: Ctx, actor: Actor, tool: ToolDef, rawArgs: Record<string, unknown>): Promise<InvokeResult> {
  const args = z.object(tool.input).parse(rawArgs)
  const mode = await modeOf(ctx, tool.name)
  if (mode === 'DENY') throw new AppError(403, `The workshop owner has switched off "${tool.title}" for AI assistants.`, 'denied')
  if (mode === 'APPROVAL') {
    const prepared = tool.prepare ? await tool.prepare(ctx, actor, args) : args
    const id = newId('APR')
    const summary = tool.summary?.(prepared) ?? tool.title
    await ctx.db.insert(schema.approvals).values({ id, tool: tool.name, args: prepared, summary, requestedBy: actor.label })
    await audit(ctx, actor, 'approval.request', id, { tool: tool.name })
    return {
      status: 'pending_approval', approval_id: id, summary, link: approvalLink(ctx, id),
      message: 'Nothing has changed yet. The owner has to approve this in the admin (Approvals); it runs as soon as they do.',
    }
  }
  return { status: 'done', result: await tool.run(ctx, actor, args) }
}

/* ---------------- the approval queue ---------------- */

export async function listApprovals(ctx: Ctx, status?: 'pending' | 'approved' | 'rejected' | 'failed') {
  const rows = await ctx.db.select().from(schema.approvals).where(status ? eq(schema.approvals.status, status) : undefined).orderBy(desc(schema.approvals.createdAt)).limit(200)
  return rows.map((r) => ({
    ...r,
    toolTitle: TOOL_MAP.get(r.tool)?.title ?? r.tool,
    preview: typeof r.args.media_id === 'string' ? mediaUrl(ctx, r.args.media_id as string, 400) : null,
  }))
}

export async function decideApproval(ctx: Ctx, user: { id: number; email: string }, id: string, approve: boolean) {
  const [a] = await ctx.db.select().from(schema.approvals).where(eq(schema.approvals.id, id))
  if (!a) throw notFound('Approval')
  if (a.status !== 'pending') throw badRequest(`Already ${a.status}`)
  const decided = { decidedBy: user.email, decidedAt: new Date() }
  if (!approve) {
    const [row] = await ctx.db.update(schema.approvals).set({ status: 'rejected', ...decided }).where(eq(schema.approvals.id, id)).returning()
    await audit(ctx, { kind: 'user', userId: user.id, label: user.email }, 'approval.reject', id)
    return row
  }
  const tool = TOOL_MAP.get(a.tool)
  if (!tool) throw badRequest(`Tool ${a.tool} no longer exists`)
  // the action runs on behalf of the AI client that asked, approved by this user
  const actor: Actor = { kind: 'mcp', clientId: a.requestedBy, userId: user.id, label: `${a.requestedBy} (approved by ${user.email})` }
  try {
    const result = await tool.run(ctx, actor, z.object(tool.input).parse(a.args))
    const [row] = await ctx.db.update(schema.approvals).set({ status: 'approved', result: result ?? null, ...decided }).where(eq(schema.approvals.id, id)).returning()
    return row
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const [row] = await ctx.db.update(schema.approvals).set({ status: 'failed', error: msg, ...decided }).where(eq(schema.approvals.id, id)).returning()
    return row
  }
}

/* ---------------- governance tools (read-only, for the assistant) ---------------- */

TOOLS.push(
  {
    name: 'get_approval', title: 'Check an approval', area: 'system', mode: 'ALLOW', readOnly: true, input: { id: z.string() },
    description: 'Status of an action waiting for the owner\'s approval, and its result once approved.',
    run: async (ctx, _a, a) => {
      const [r] = await ctx.db.select().from(schema.approvals).where(eq(schema.approvals.id, a.id))
      if (!r) throw notFound('Approval')
      return { id: r.id, tool: r.tool, summary: r.summary, status: r.status, decidedBy: r.decidedBy, result: r.result, error: r.error }
    },
  },
  {
    name: 'get_mcp_policy', title: 'What may I do?', area: 'system', mode: 'ALLOW', readOnly: true, input: {},
    description: 'Lists every tool with its policy: ALLOW runs at once, APPROVAL waits for the owner, DENY is switched off.',
    run: (ctx) => policies(ctx),
  },
)
for (const t of TOOLS.slice(-2)) TOOL_MAP.set(t.name, t)
