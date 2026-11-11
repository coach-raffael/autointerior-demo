import { useState } from 'react'
import { Check, Code2, Sparkles, Trash2 } from 'lucide-react'
import { useStore, makePost, day } from '../store'
import { NETWORKS, carLabel, type Network, type Post } from '../data'
import type { Lang } from '../i18n'
import { Badge, Btn, Empty, Modal, Page, Panel, fmtDateTime } from './ui'

const TONE = { draft: 'warn', approved: 'thread', scheduled: 'ok' } as const
const LANG_LABEL: Record<Lang, string> = { ka: 'ქართული', en: 'English', ru: 'Русский' }
// placeholder until Metricool's getBestTimeToPostByNetwork is wired to his brand
const BEST_SLOTS = ['Tue 19:30', 'Thu 19:30', 'Sat 13:00']

/** Builds the exact `info` object Metricool's createScheduledPost expects. */
export function metricoolPayload(p: Post, lang: Lang, publicBase = 'https://autointeriore.ge/') {
  const net = (n: Network) => (n === 'youtube' ? 'youtube' : n)
  const data: Record<string, unknown> = {}
  if (p.networks.includes('instagram')) data.instagramData = { type: 'POST' }
  if (p.networks.includes('facebook')) data.facebookData = { type: 'POST' }
  if (p.networks.includes('tiktok')) data.tiktokData = { privacyOption: 'PUBLIC_TO_EVERYONE' }
  if (p.networks.includes('threads')) data.threadsData = {}
  if (p.networks.includes('gmb')) data.gmbData = { type: 'publication' }
  if (p.networks.includes('youtube')) data.youtubeData = { type: 'short', title: p.captions.en.slice(0, 90), madeForKids: false }
  const [d, t] = p.date.split('T')
  return {
    blogId: '<autointeriore brand id>',
    date: `${d}T${t}:00+04:00`,
    info: {
      autoPublish: true,
      draft: false,
      text: `${p.captions[lang]}\n\n${p.hashtags}`,
      firstCommentText: lang === 'ka' ? p.captions.en : '',
      media: p.img ? [publicBase + p.img] : [],
      providers: p.networks.map((n) => ({ network: net(n) })),
      publicationDate: { dateTime: `${d}T${t}:00`, timezone: 'Asia/Tbilisi' },
      ...data,
    },
  }
}

export default function Content() {
  const { posts, orders, upsert, remove } = useStore()
  const [lang, setLang] = useState<Lang>('ka')
  const [payload, setPayload] = useState<Post | null>(null)
  const [msg, setMsg] = useState('')
  const sorted = [...posts].sort((a, b) => a.date.localeCompare(b.date))

  const autopilot = () => {
    const todo = orders.filter((o) => (o.status === 'ready' || o.status === 'delivered') && !posts.some((p) => p.refId === o.id))
    todo.forEach((o, i) => upsert('posts', makePost(o, day(i + 2) + 'T19:30')))
    setMsg(todo.length ? `${todo.length} new draft${todo.length > 1 ? 's' : ''} from finished jobs.` : 'Every finished job already has a post.')
  }
  const set = (p: Post, patch: Partial<Post>) => upsert('posts', { ...p, ...patch })

  return (
    <Page title="Social content" actions={<Btn variant="primary" onClick={autopilot}><Sparkles size={15} /> Draft posts from finished jobs</Btn>}>
      <div className="mb-5 grid gap-3 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <p className="text-sm leading-relaxed text-dust">
            Every finished job and every new part becomes a post draft with captions in Georgian, English and Russian.
            You approve it here; approved posts go to Metricool, which publishes to all connected channels at the best time.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-dust">Pipeline:</span>
            {['Job marked ready', 'Draft created', 'You approve', 'Metricool schedules', 'Published everywhere'].map((s, i) => (
              <span key={s} className="flex items-center gap-2">{i > 0 && <span className="h-0 w-4 border-t border-dashed border-thread" />}<Badge tone={i === 2 ? 'thread' : 'muted'}>{s}</Badge></span>
            ))}
          </div>
        </Panel>
        <Panel>
          <p className="text-sm text-dust">Best times to post</p>
          <p className="mt-1 font-display">{BEST_SLOTS.join(' · ')}</p>
          <p className="mt-2 text-xs text-dust">Sample values. Live numbers come from Metricool once his accounts are connected.</p>
        </Panel>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-dust">Preview captions in</span>
        {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
          <Btn key={l} variant={lang === l ? 'ghost' : 'quiet'} aria-pressed={lang === l} onClick={() => setLang(l)}>{LANG_LABEL[l]}</Btn>
        ))}
      </div>
      {msg && <p role="status" className="mb-4 text-sm text-ok">{msg}</p>}

      {sorted.length === 0 ? <Empty>No posts yet. Mark a job as ready, or use “Draft posts from finished jobs”.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => (
            <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-seam bg-hide/70">
              {p.img ? <img src={p.img} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-seam" />}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={TONE[p.status]}>{p.status}</Badge>
                  <span className="text-xs text-dust">{p.source === 'order' ? `Job ${p.refId}` : p.source === 'part' ? `Part ${p.refId}` : 'Manual'}</span>
                </div>
                <textarea
                  className="field min-h-28 text-sm"
                  value={p.captions[lang]}
                  onChange={(e) => set(p, { captions: { ...p.captions, [lang]: e.target.value } })}
                  aria-label={`Caption (${LANG_LABEL[lang]})`}
                  disabled={p.status === 'scheduled'}
                />
                <p className="text-xs break-words text-dust">{p.hashtags}</p>
                <div className="flex flex-wrap gap-1.5">
                  {NETWORKS.map((n) => {
                    const on = p.networks.includes(n.id)
                    return (
                      <button key={n.id} disabled={p.status === 'scheduled'} aria-pressed={on}
                        onClick={() => set(p, { networks: on ? p.networks.filter((x) => x !== n.id) : [...p.networks, n.id] })}
                        className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-thread text-thread' : 'border-seam text-dust'}`}>{n.label}</button>
                    )
                  })}
                </div>
                <input type="datetime-local" className="field text-sm" value={p.date} disabled={p.status === 'scheduled'} onChange={(e) => set(p, { date: e.target.value })} aria-label="Publish at" />
                {p.networks.includes('youtube') && <p className="text-xs text-warn">YouTube Shorts needs a video. Add the reel before approving.</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {p.status === 'draft' && <Btn variant="primary" onClick={() => set(p, { status: 'approved' })}><Check size={15} /> Approve</Btn>}
                  {p.status === 'approved' && <Btn variant="primary" onClick={() => setPayload(p)}><Code2 size={15} /> Send to Metricool</Btn>}
                  {p.status === 'scheduled' && <span className="text-sm text-ok">Scheduled for {fmtDateTime(p.date)}</span>}
                  {p.status !== 'scheduled' && <Btn variant="quiet" onClick={() => remove('posts', p.id)}><Trash2 size={15} /> Discard</Btn>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {payload && (
        <Modal title="Metricool request" onClose={() => setPayload(null)} wide>
          <p className="text-sm text-dust">
            In the live version this goes straight to Metricool’s scheduling API. In the demo nothing is published — this is the request that would be sent for {payload.refId ? carLabel(orders.find((o) => o.id === payload.refId)?.car.model ?? '') || payload.refId : 'this post'}.
          </p>
          <pre className="mt-4 max-h-[60vh] overflow-auto rounded-xl bg-hide p-4 text-xs leading-relaxed">{JSON.stringify(metricoolPayload(payload, lang), null, 2)}</pre>
          <div className="mt-4 flex gap-2">
            <Btn variant="primary" onClick={() => { set(payload, { status: 'scheduled' }); setPayload(null) }}><Check size={15} /> Mark as scheduled (demo)</Btn>
            <Btn onClick={() => setPayload(null)}>Close</Btn>
          </div>
        </Modal>
      )}
    </Page>
  )
}
