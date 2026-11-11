import express, { type Request, type Response } from 'express'
import { login, sessionCookie, SESSION_COOKIE, userFromSession } from '../auth.js'
import { AppError } from '../lib.js'
import type { Ctx } from '../services/context.js'
import type { WorkshopOAuthProvider } from './provider.js'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function page(body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect to Auto Interiore</title>
<style>
:root{--nappa:#1f2124;--hide:#2a2d31;--seam:#3b3f45;--chalk:#ece8e1;--dust:#9b9ea4;--thread:#f2c230}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--nappa);color:var(--chalk);font:16px/1.5 system-ui,"Noto Sans Georgian",sans-serif;padding:16px}
main{width:100%;max-width:420px;background:var(--hide);border:1px solid var(--seam);border-radius:24px;padding:28px}
h1{font-size:1.35rem;margin:0 0 4px}p{color:var(--dust);margin:.25rem 0 1rem}.seam{border-top:2px dashed var(--thread);margin:18px 0}
ul{padding-left:1.1rem;color:var(--dust);margin:0 0 1rem}li{margin:.2rem 0}
label{display:block;font-size:.85rem;color:var(--dust);margin:.6rem 0 .25rem}input{width:100%;padding:.7rem .8rem;border-radius:10px;border:1px solid var(--seam);background:var(--nappa);color:var(--chalk);font:inherit}
input:focus{outline:2px solid var(--thread);outline-offset:1px}
.row{display:flex;gap:10px;margin-top:18px}button{flex:1;padding:.75rem 1rem;border-radius:999px;font:inherit;font-weight:600;cursor:pointer;border:1px solid var(--seam);background:transparent;color:var(--chalk)}
button.primary{background:var(--thread);color:var(--nappa);border-color:var(--thread)}.err{color:#e0884a}.client{color:var(--chalk);font-weight:600}
</style></head><body><main>${body}</main></body></html>`
}

export function consentRouter(ctx: Ctx, provider: WorkshopOAuthProvider) {
  const r = express.Router()
  r.use(express.urlencoded({ extended: false, limit: '10kb' }))

  const pendingFrom = (req: Request) => {
    const id = String(req.query.req ?? req.body?.req ?? '')
    const p = provider.pending.get(id)
    if (!p || p.expires < Date.now()) throw new AppError(400, 'This sign-in link has expired. Start connecting again from Claude.', 'expired')
    return { id, p }
  }

  const render = async (req: Request, res: Response, error?: string) => {
    const { id, p } = pendingFrom(req)
    const user = await userFromSession(ctx, req.cookies?.[SESSION_COOKIE])
    const name = esc(p.client.client_name ?? 'An AI assistant')
    const what = `<ul><li>read orders, calendar, parts, suppliers and posts</li><li>prepare quotes, bookings, purchase orders and post drafts</li><li>anything that changes the website, sends messages or deletes data waits for your approval in the admin</li></ul>`
    const hidden = `<input type="hidden" name="req" value="${esc(id)}"><input type="hidden" name="csrf" value="${esc(p.csrf)}">`
    res.set('Cache-Control', 'no-store').set('X-Frame-Options', 'DENY').set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'")
    res.send(page(`
      <h1>Connect to Auto Interiore</h1>
      <p><span class="client">${name}</span> wants access to your workshop.</p>
      ${what}
      <div class="seam"></div>
      ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
      <form method="post" action="/oauth/consent">${hidden}
        ${user ? `<p>Signed in as <span class="client">${esc(user.email)}</span></p>` : `
          <label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required>
          <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required>`}
        <div class="row"><button name="decision" value="deny" formnovalidate>Don't allow</button><button class="primary" name="decision" value="allow">Allow access</button></div>
      </form>`))
  }

  r.get('/oauth/consent', async (req, res, next) => { try { await render(req, res) } catch (e) { next(e) } })

  r.post('/oauth/consent', async (req, res, next) => {
    try {
      const { id, p } = pendingFrom(req)
      if (req.body.csrf !== p.csrf) throw new AppError(400, 'The form expired. Reload the page and try again.', 'csrf')
      if (req.body.decision !== 'allow') {
        provider.pending.delete(id)
        return res.redirect(302, provider.denyRedirect(p))
      }
      let user = await userFromSession(ctx, req.cookies?.[SESSION_COOKIE])
      if (!user) {
        try {
          const s = await login(ctx, String(req.body.email ?? ''), String(req.body.password ?? ''))
          res.cookie(SESSION_COOKIE, s.token, sessionCookie(ctx))
          user = s.user
        } catch (e) {
          return render(req, res, e instanceof AppError ? e.message : 'Sign-in failed')
        }
      }
      if (user.role !== 'owner') return render(req, res, 'Only the workshop owner can connect AI assistants.')
      provider.pending.delete(id)
      res.redirect(302, await provider.issueCode(p, user.id))
    } catch (e) { next(e) }
  })
  return r
}
