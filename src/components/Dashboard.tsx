import { useId } from 'react'
import { type Look, leatherOf, threadOf } from '../data'

/*
  Front view of a generic left-hand-drive dashboard, drawn in SVG so every
  surface can take the visitor's leather, finish and thread live.
*/

// top contour of the upper pad, incl. instrument hood on the driver side
const PAD = 'M40 168 C40 136 96 122 188 118 C196 78 318 70 352 112 L690 112 C740 114 764 134 764 168 L764 212 L40 212 Z'
const STITCH_A = 'M52 166 C54 142 104 132 196 128 C210 92 312 86 340 120 L690 122 C732 124 752 140 754 166'
const STITCH_B = 'M52 176 C56 152 106 142 200 138 C216 104 306 98 332 130 L690 132 C728 134 746 148 748 172'
const SEAM_LOW = 'M70 222 L734 222'

export default function Dashboard({ look, sewKey = 0, className = '' }: { look: Look; sewKey?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  const leather = leatherOf(look.leather)
  const thread = threadOf(look.thread, look.leather)
  const grainFreq = look.finish === 'alcantara' ? 1.6 : 0.75
  const grainOpacity = look.finish === 'alcantara' ? 0.38 : 0.22
  const sheen = look.finish === 'alcantara' ? 0.05 : 0.22

  return (
    <svg viewBox="0 0 800 340" className={className} role="img" aria-label={`Dashboard in ${leather.name} ${look.finish}`}>
      <defs>
        <linearGradient id={`pad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={leather.hi} />
          <stop offset="0.45" stopColor={leather.hex} />
          <stop offset="1" stopColor={leather.hex} />
        </linearGradient>
        <linearGradient id={`low-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={leather.hex} />
          <stop offset="1" stopColor="#0f1012" />
        </linearGradient>
        <linearGradient id={`sheen-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#fff" stopOpacity={sheen} />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`grain-${id}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={grainFreq} numOctaves="3" seed="7" />
          <feColorMatrix values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${grainOpacity} 0`} />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <pattern id={`perf-${id}`} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="1.25" fill="#000" opacity="0.55" />
        </pattern>
        <clipPath id={`padclip-${id}`}><path d={PAD} /></clipPath>
        <mask id={`sew-${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="340">
          <path key={`m${sewKey}`} className="sew-mask" d={STITCH_A} pathLength={1} fill="none" stroke="#fff" strokeWidth="40" />
          <path key={`n${sewKey}`} className="sew-mask" d={SEAM_LOW} pathLength={1} fill="none" stroke="#fff" strokeWidth="20" />
        </mask>
      </defs>

      {/* windscreen line / shadow */}
      <path d="M20 112 C200 60 600 60 780 112" fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="2" />
      <ellipse cx="400" cy="318" rx="380" ry="16" fill="#000" opacity="0.35" />

      {/* lower dash */}
      <path d="M48 212 L752 212 L730 298 C600 306 200 306 70 298 Z" fill={`url(#low-${id})`} />
      <path d="M48 212 L752 212 L730 298 C600 306 200 306 70 298 Z" fill={leather.hex} filter={`url(#grain-${id})`} />
      {/* glovebox */}
      <path d="M520 232 L704 232 L692 282 L530 282 Z" fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="2" />
      <path d="M520 233 L704 233" stroke="#fff" strokeOpacity="0.07" />
      {/* centre stack */}
      <path d="M346 212 L454 212 L446 300 L354 300 Z" fill="#141518" />
      <rect x="362" y="226" width="76" height="8" rx="4" fill="#2a2c30" />
      <rect x="362" y="242" width="76" height="8" rx="4" fill="#2a2c30" />
      <circle cx="400" cy="276" r="11" fill="#1d1f22" stroke="#3a3d42" />

      {/* upper pad (the part he re-trims) */}
      <path d={PAD} fill={`url(#pad-${id})`} />
      <g clipPath={`url(#padclip-${id})`}>
        <rect x="0" y="60" width="800" height="160" fill={leather.hex} filter={`url(#grain-${id})`} />
        {look.finish === 'perforated' && <rect x="360" y="112" width="400" height="100" fill={`url(#perf-${id})`} />}
        <rect x="0" y="60" width="800" height="160" fill={`url(#sheen-${id})`} />
      </g>
      <path d={PAD} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="1.5" />

      {/* instrument cluster + screen */}
      <path d="M212 130 C224 102 304 98 324 128 L324 164 L212 164 Z" fill="#0c0d0f" />
      <circle cx="244" cy="146" r="12" fill="none" stroke="#2f6bd0" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="292" cy="146" r="12" fill="none" stroke="#2f6bd0" strokeOpacity="0.55" strokeWidth="2" />
      <rect x="452" y="50" width="150" height="58" rx="7" fill="#0c0d0f" stroke="#2b2e33" />
      <rect x="460" y="58" width="134" height="42" rx="3" fill="#15212f" />
      <rect x="520" y="108" width="14" height="6" fill="#0c0d0f" />
      <path d="M470 90 L496 74 L516 84 L540 66 L584 78" fill="none" stroke="#3f7fe0" strokeOpacity="0.5" strokeWidth="2" />

      {/* vents */}
      {[[364, 172], [410, 172], [70, 176], [688, 176]].map(([x, y]) => (
        <g key={x}>
          <rect x={x} y={y} width="44" height="24" rx="5" fill="#0d0e10" />
          {[0, 1, 2, 3].map((i) => <line key={i} x1={x + 5} x2={x + 39} y1={y + 6 + i * 4.5} y2={y + 6 + i * 4.5} stroke="#2c2f34" strokeWidth="1.5" />)}
        </g>
      ))}

      {/* stitching, revealed by the sewing mask whenever the look changes */}
      <g mask={`url(#sew-${id})`} fill="none" stroke={thread} strokeWidth="2.2" strokeLinecap="round" strokeDasharray="7 5">
        <path d={STITCH_A} />
        {look.seam === 'double' && <path d={STITCH_B} />}
        <path d={SEAM_LOW} />
        {look.seam === 'double' && <path d="M70 230 L734 230" />}
      </g>

      {/* steering wheel */}
      <g>
        <circle cx="268" cy="250" r="86" fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="26" />
        <circle cx="268" cy="248" r="86" fill="none" stroke={leather.hex} strokeWidth="22" />
        <circle cx="268" cy="248" r="86" fill="none" stroke={leather.hi} strokeOpacity="0.35" strokeWidth="3" strokeDasharray="200 340" strokeDashoffset="-70" />
        <circle cx="268" cy="248" r="86" fill="none" stroke={thread} strokeWidth="1.6" strokeDasharray="5 4" opacity="0.9" />
        <path d="M188 262 L232 252 L304 252 L348 262 L330 290 L206 290 Z" fill="#141518" />
        <circle cx="268" cy="262" r="30" fill={leather.hex} stroke="#000" strokeOpacity="0.4" />
        <circle cx="268" cy="262" r="9" fill="#2a2c30" />
      </g>
    </svg>
  )
}
