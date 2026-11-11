import { useEffect, useRef, useState } from 'react'
import { DEFAULT_LOOK, type Look } from '../data'
import type { Cockpit, View } from '../three/cockpit'
import Dashboard from './Dashboard'

/*
  Shows the drawn dashboard first (instant, tiny) and swaps in the 3D cockpit once
  the visitor interacts with the page. three.js is a separate chunk, so it never
  slows the first paint or the Lighthouse run.
*/

const TRIGGERS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

function webglOk() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const base = import.meta.env.BASE_URL
const isDefault = (l: Look) => l.leather === DEFAULT_LOOK.leather && l.finish === DEFAULT_LOOK.finish && l.thread === DEFAULT_LOOK.thread && l.seam === DEFAULT_LOOK.seam

export type CockpitState = 'poster' | 'loading' | 'ready' | 'unsupported'

export default function Cockpit3D({ look, sewKey, view, label, onState }: {
  look: Look; sewKey: number; view: View; label: string; onState?: (s: CockpitState) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cockpit = useRef<Cockpit | null>(null)
  const [state, setState] = useState<CockpitState>('poster')
  const lookRef = useRef(look)
  lookRef.current = look

  useEffect(() => { onState?.(state) }, [state, onState])

  // wait for the first sign of a real visitor, then load
  useEffect(() => {
    if (!webglOk()) { setState('unsupported'); return }
    let disposed = false
    const start = () => {
      TRIGGERS.forEach((e) => window.removeEventListener(e, start))
      setState('loading')
      import('../three/cockpit').then(({ createCockpit }) => {
        if (disposed || !canvasRef.current) return
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        cockpit.current = createCockpit(canvasRef.current, lookRef.current, {
          reducedMotion: reduced,
          onReady: () => !disposed && setState('ready'),
        })
      }).catch(() => !disposed && setState('unsupported'))
    }
    TRIGGERS.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }))
    return () => {
      disposed = true
      TRIGGERS.forEach((e) => window.removeEventListener(e, start))
      cockpit.current?.dispose()
      cockpit.current = null
    }
  }, [])

  // push look changes; a new sewKey means "sew the seam again"
  const lastSew = useRef(sewKey)
  useEffect(() => {
    const sew = sewKey !== lastSew.current
    lastSew.current = sewKey
    cockpit.current?.setLook(look, sew)
  }, [look, sewKey])

  useEffect(() => { cockpit.current?.setView(view) }, [view])

  const show3d = state === 'ready'
  return (
    <div className="relative aspect-[16/10] w-full sm:aspect-[16/8]">
      <div aria-hidden={show3d} className={`absolute inset-0 grid place-items-center transition-opacity duration-500 ${show3d ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        {isDefault(look) && state !== 'unsupported' ? (
          // pre-rendered frame of the 3D cockpit in the default look: instant, ~40 KB
          <img
            src={`${base}cockpit/poster-wide.webp`}
            srcSet={`${base}cockpit/poster-narrow.webp 640w, ${base}cockpit/poster-wide.webp 1600w`}
            sizes="(max-width: 700px) 100vw, 1200px"
            alt=""
            width={1600} height={801}
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        ) : (
          <Dashboard look={look} sewKey={sewKey} className="w-full max-w-5xl px-2 sm:px-8" />
        )}
      </div>
      {state !== 'unsupported' && (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          className={`absolute inset-0 h-full w-full cursor-grab touch-pan-y transition-opacity duration-500 active:cursor-grabbing ${show3d ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}
