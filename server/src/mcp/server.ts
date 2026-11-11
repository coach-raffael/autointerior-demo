import type { Request, Response } from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ZodError } from 'zod'
import { AppError } from '../lib.js'
import type { Actor, Ctx } from '../services/context.js'
import { TOOLS } from './registry.js'
import { invoke } from './governance.js'

const INSTRUCTIONS = `Auto Interiore — leather dashboard & steering-wheel re-trimming workshop in Tbilisi (website, parts shop and back office).
Every write tool follows a policy set by the owner: ALLOW runs at once, APPROVAL creates a pending action the owner confirms in the admin (the answer has status "pending_approval" and a link; check it later with get_approval), DENY is switched off. Call get_mcp_policy to see which is which.
Money is in GEL as whole numbers. Dates are YYYY-MM-DD and times HH:MM, Tbilisi time (UTC+4). Car model ids come from list_catalog.
Website texts are { en, ka, ru }; write Georgian and Russian yourself when you can, otherwise English is used for all three.
To put a photo on the website: create_gallery_item with image_url (https) or image_base64; upload_image first if you want to reuse the image.`

/** JSON for the model, without base64 blobs or huge arrays. */
function toText(v: unknown) {
  return JSON.stringify(v, (_k, x) => (typeof x === 'string' && x.length > 4000 ? `${x.slice(0, 200)}… (${x.length} chars)` : x), 2)
}

export function buildMcpServer(ctx: Ctx, actor: Actor) {
  const server = new McpServer({ name: 'auto-interiore', title: 'Auto Interiore Workshop', version: '0.1.0' }, { instructions: INSTRUCTIONS })
  for (const tool of TOOLS) {
    server.registerTool(tool.name, {
      title: tool.title,
      description: `${tool.description}${tool.readOnly ? '' : ` [default policy: ${tool.mode}]`}`,
      inputSchema: tool.input,
      annotations: { title: tool.title, readOnlyHint: tool.readOnly, destructiveHint: tool.name.startsWith('delete_'), openWorldHint: tool.name === 'send_purchase_order' || tool.name === 'schedule_post' || tool.name === 'upload_image' },
    }, async (args: Record<string, unknown>) => {
      try {
        const out = await invoke(ctx, actor, tool, args ?? {})
        return { content: [{ type: 'text' as const, text: toText(out.status === 'done' ? out.result : out) }] }
      } catch (e) {
        const msg = e instanceof ZodError ? `Invalid input: ${e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
          : e instanceof AppError ? e.message : 'The workshop server hit an error; nothing was changed.'
        if (!(e instanceof AppError) && !(e instanceof ZodError)) console.error('[mcp]', tool.name, e)
        return { isError: true, content: [{ type: 'text' as const, text: msg }] }
      }
    })
  }
  return server
}

/** Stateless Streamable HTTP: one server + transport per request, auth comes from the bearer token. */
export function mcpHandler(ctx: Ctx) {
  return async (req: Request, res: Response) => {
    const auth = req.auth!
    const extra = (auth.extra ?? {}) as { userId?: number; clientName?: string }
    const actor: Actor = { kind: 'mcp', clientId: auth.clientId, userId: extra.userId ?? 0, label: extra.clientName ?? auth.clientId }
    const server = buildMcpServer(ctx, actor)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}) })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  }
}
