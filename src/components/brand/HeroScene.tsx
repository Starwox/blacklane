// Décor du hero : Los Santos de nuit sous la pluie, bitume mouillé,
// voiture sombre vue de l'arrière avec feux ronds rouges. Entièrement
// vectoriel ; remplaçable par une image depuis le back-office.
import { useMemo } from 'react'

function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Skyline() {
  const { buildings, windows } = useMemo(() => {
    const rnd = mulberry(42)
    const b: { x: number; w: number; h: number; tone: number }[] = []
    const w: { x: number; y: number; on: number }[] = []
    let x = -20
    while (x < 1620) {
      const width = 30 + rnd() * 70
      const center = 1 - Math.abs(x - 800) / 900
      const height = 60 + rnd() * 160 + center * 220 + (rnd() > 0.92 ? 140 : 0)
      b.push({ x, w: width, h: height, tone: rnd() })
      for (let wy = 470 - height + 14; wy < 455; wy += 11) {
        for (let wx = x + 6; wx < x + width - 6; wx += 9) {
          if (rnd() > 0.9) w.push({ x: wx, y: wy, on: rnd() })
        }
      }
      x += width + rnd() * 6
    }
    return { buildings: b, windows: w }
  }, [])
  return (
    <g>
      {buildings.map((b, i) => (
        <rect key={i} x={b.x} y={470 - b.h} width={b.w} height={b.h} fill={b.tone > 0.5 ? '#0d0d11' : '#0a0a0d'} />
      ))}
      {windows.map((w, i) => (
        <rect key={i} x={w.x} y={w.y} width="3" height="4" fill={w.on > 0.85 ? '#ff4b3e' : '#d8c9a8'} opacity={0.18 + w.on * 0.35} />
      ))}
    </g>
  )
}

/** Fond plein cadre : ciel, ville, route en perspective, traînées lumineuses */
export function HeroBackdrop() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#040405" />
          <stop offset="0.45" stopColor="#0b0709" />
          <stop offset="0.52" stopColor="#1a0709" />
          <stop offset="1" stopColor="#040404" />
        </linearGradient>
        <radialGradient id="cityglow" cx="0.5" cy="0.52" r="0.5">
          <stop offset="0" stopColor="#e1141e" stopOpacity="0.28" />
          <stop offset="1" stopColor="#e1141e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0a0c" />
          <stop offset="1" stopColor="#060607" />
        </linearGradient>
        <linearGradient id="trail" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff2d2d" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff2d2d" stopOpacity="0" />
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="softer">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      <ellipse cx="800" cy="470" rx="900" ry="190" fill="url(#cityglow)" />
      <Skyline />
      {/* Route */}
      <path d="M0 900 L700 470 L900 470 L1600 900 Z" fill="url(#road)" />
      <path d="M0 470 H1600 V900 H0 Z" fill="#050506" opacity="0.55" />
      <path d="M700 470 L0 900" stroke="#1d1d22" strokeWidth="2" />
      <path d="M900 470 L1600 900" stroke="#1d1d22" strokeWidth="2" />
      {/* Marquage central */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const t0 = Math.pow(i / 6, 1.8)
        const t1 = Math.pow((i + 0.45) / 6, 1.8)
        const y0 = 470 + t0 * 430
        const y1 = 470 + t1 * 430
        const w0 = 1 + t0 * 14
        const w1 = 1 + t1 * 14
        return <path key={i} d={`M${800 - w0} ${y0} L${800 + w0} ${y0} L${800 + w1} ${y1} L${800 - w1} ${y1} Z`} fill="#c9c3b8" opacity={0.1 + t0 * 0.18} />
      })}
      {/* Traînées de feux arrière */}
      <g filter="url(#softer)" className="[&>path]:[stroke-dasharray:90_40] motion-safe:[&>path]:animate-[trail_6s_linear_infinite]">
        <path d="M760 474 C 600 560, 340 700, 120 900" stroke="url(#trail)" strokeWidth="3" fill="none" />
        <path d="M772 474 C 640 580, 470 720, 330 900" stroke="url(#trail)" strokeWidth="2" fill="none" opacity="0.7" />
        <path d="M842 474 C 1000 580, 1240 720, 1480 900" stroke="url(#trail)" strokeWidth="2" fill="none" opacity="0.45" />
      </g>
      {/* Bokeh lointain */}
      {[
        [520, 455, '#ff3b30'],
        [560, 452, '#ff3b30'],
        [1040, 458, '#e8e2d2'],
        [1090, 455, '#e8e2d2'],
        [300, 462, '#ff3b30'],
        [1300, 462, '#ff7a3b'],
      ].map(([x, y, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r="5" fill={c as string} opacity="0.55" filter="url(#soft)" />
      ))}
      <style>{`@keyframes trail { to { stroke-dashoffset: -260; } }`}</style>
    </svg>
  )
}

/** Voiture sombre vue de l'arrière, quatre feux ronds */
export function HeroCar({ className, plate = 'BL-001' }: { className?: string; plate?: string }) {
  const lights = [214, 288, 512, 586]
  return (
    <svg viewBox="0 0 800 470" className={className} aria-hidden>
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e1e24" />
          <stop offset="0.35" stopColor="#0f0f13" />
          <stop offset="1" stopColor="#060608" />
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15151a" />
          <stop offset="1" stopColor="#050507" />
        </linearGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff6a5a" />
          <stop offset="0.55" stopColor="#ff1e1e" />
          <stop offset="1" stopColor="#7a0006" />
        </radialGradient>
        <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="glow-wide" x="-60%" y="-200%" width="220%" height="500%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <linearGradient id="reflect" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff2020" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff2020" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ombre au sol */}
      <ellipse cx="400" cy="372" rx="350" ry="26" fill="#000" opacity="0.9" />
      {/* Reflets des feux sur le bitume mouillé */}
      <g filter="url(#glow)" opacity="0.75">
        {lights.map((x) => (
          <rect key={x} x={x - 9} y="372" width="18" height="96" fill="url(#reflect)" />
        ))}
      </g>
      {/* Pneus */}
      <rect x="92" y="282" width="92" height="86" rx="14" fill="#050506" />
      <rect x="616" y="282" width="92" height="86" rx="14" fill="#050506" />
      {/* Carrosserie */}
      <path
        d="M70 300 C70 250 92 212 150 196 L232 116 C250 98 270 92 300 90 L500 90 C530 92 550 98 568 116 L650 196 C708 212 730 250 730 300 L728 338 C726 352 716 360 700 360 L100 360 C84 360 74 352 72 338 Z"
        fill="url(#body)"
      />
      {/* Lunette arrière */}
      <path d="M262 124 C272 110 284 104 304 103 L496 103 C516 104 528 110 538 124 L586 190 L214 190 Z" fill="url(#glass)" />
      <path d="M300 112 L500 112" stroke="url(#sheen)" strokeWidth="2" />
      {/* Ligne d'épaule */}
      <path d="M104 214 C200 202 600 202 696 214" stroke="#2a2a32" strokeWidth="2" fill="none" />
      {/* Aileron */}
      <path d="M128 196 L672 196 L664 206 L136 206 Z" fill="#141418" />
      <path d="M128 196 L672 196" stroke="#3a3a44" strokeWidth="1.5" />
      <rect x="250" y="206" width="10" height="14" fill="#0c0c10" />
      <rect x="540" y="206" width="10" height="14" fill="#0c0c10" />
      {/* Panneau arrière */}
      <path d="M96 222 C300 214 500 214 704 222 L700 284 C500 290 300 290 100 284 Z" fill="#0a0a0d" />
      {/* Feux : halo */}
      <g filter="url(#glow-wide)" opacity="0.8">
        <rect x="170" y="228" width="160" height="40" rx="20" fill="#ff1515" />
        <rect x="470" y="228" width="160" height="40" rx="20" fill="#ff1515" />
      </g>
      {lights.map((x) => (
        <g key={x}>
          <circle cx={x} cy="248" r="28" fill="#120203" />
          <circle cx={x} cy="248" r="24" fill="none" stroke="url(#lamp)" strokeWidth="8" />
          <circle cx={x} cy="248" r="24" fill="none" stroke="#ff4b3e" strokeWidth="8" filter="url(#glow)" opacity="0.9" />
          <circle cx={x} cy="248" r="10" fill="#1a0203" />
          <circle cx={x - 7} cy="240" r="3" fill="#fff" opacity="0.35" />
        </g>
      ))}
      {/* Plaque */}
      <rect x="342" y="254" width="116" height="30" rx="2" fill="#d9d4ca" />
      <rect x="344" y="256" width="112" height="26" rx="1.5" fill="none" stroke="#1a1a1a" strokeWidth="1" />
      <text x="400" y="276" textAnchor="middle" fontFamily="'JetBrains Mono', monospace" fontWeight="700" fontSize="18" fill="#0b0b0b" letterSpacing="1">
        {plate}
      </text>
      {/* Bouclier et diffuseur */}
      <path d="M100 300 L700 300 L690 344 L110 344 Z" fill="#08080a" />
      {[300, 340, 380, 420, 460, 500].map((x) => (
        <path key={x} d={`M${x} 312 L${x} 344`} stroke="#1c1c22" strokeWidth="3" />
      ))}
      {[150, 196, 604, 650].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="330" rx="18" ry="11" fill="#1d1d22" />
          <ellipse cx={x} cy="330" rx="12" ry="7" fill="#020202" />
        </g>
      ))}
      {/* Reflet de carrosserie */}
      <path d="M160 200 C300 188 500 188 640 200" stroke="url(#sheen)" strokeWidth="3" fill="none" />
    </svg>
  )
}
