import { cx } from '../ui/cx'

/** Logo texte BLACKLANE : « BLACK » blanc cassé, « LANE » rouge, trait de vitesse */
export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const s = { sm: 'text-xl', md: 'text-2xl', lg: 'text-5xl', xl: 'text-[clamp(4.2rem,15vw,11.5rem)]' }[size]
  return (
    <span className={cx('relative inline-flex select-none items-baseline font-display font-black italic uppercase leading-none tracking-[-0.01em]', s, className)}>
      <span className="text-bone">Black</span>
      <span className="text-blood-500">Lane</span>
      <span aria-hidden className="absolute -bottom-[0.12em] left-[38%] h-[0.06em] w-[64%] -skew-x-[30deg] bg-gradient-to-r from-blood-500 via-blood-500/70 to-transparent" />
    </span>
  )
}

/** Emblème « BL » : anneau rouge ouvert, lettres géométriques italiques */
export function Emblem({ className, size = 40, glow }: { className?: string; size?: number; glow?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role="img" aria-label="Blacklane">
      <defs>
        <filter id="bl-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={glow ? 'url(#bl-glow)' : undefined}>
        <path d="M84 30 A40 40 0 1 1 64 13" fill="none" stroke="#e1141e" strokeWidth="6" strokeLinecap="square" />
        <path d="M70 9 l14 4 -6 9" fill="none" stroke="#e1141e" strokeWidth="5" strokeLinecap="square" />
      </g>
      <g transform="translate(9 0) skewX(-14)">
        <path
          fillRule="evenodd"
          fill="#ece8e1"
          d="M24 29 H45 Q56 29 56 39 Q56 46 50 48.5 Q58 51 58 60 Q58 71 46 71 H24 Z M33 37 V45.5 H44 Q47.5 45.5 47.5 41.2 Q47.5 37 44 37 Z M33 53 V63 H45.5 Q49 63 49 58 Q49 53 45.5 53 Z"
        />
        <path fill="#e1141e" d="M62 29 H71 V62.5 H85 V71 H62 Z" />
      </g>
    </svg>
  )
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <Emblem size={34} />
      <Wordmark size="sm" />
    </span>
  )
}
