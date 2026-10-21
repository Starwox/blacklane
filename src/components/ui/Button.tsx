import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from '../../lib/router'
import { cx } from './cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-display font-bold uppercase tracking-[0.14em] transition-all duration-200 select-none disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'chamfer-sm bg-blood-500 text-white hover:bg-blood-400 hover:shadow-glow active:translate-y-px disabled:hover:bg-blood-500 disabled:hover:shadow-none',
  secondary: 'chamfer-sm bg-bone text-ink-950 hover:bg-white active:translate-y-px',
  outline:
    'chamfer-sm border border-ink-400 text-bone hover:border-blood-500 hover:text-white hover:bg-blood-500/10 active:translate-y-px',
  ghost: 'text-ash hover:text-bone hover:bg-white/5',
  danger: 'chamfer-sm border border-blood-600 text-blood-300 hover:bg-blood-600 hover:text-white active:translate-y-px',
}

const sizes: Record<Size, string> = {
  sm: 'text-[0.72rem] px-3 py-1.5',
  md: 'text-[0.8rem] px-4 py-2.5',
  lg: 'text-sm px-6 py-3.5',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, type, ...rest }: ButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
}

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  className,
  children,
  icon,
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <Link to={to} className={cx(base, variants[variant], sizes[size], className)}>
      {icon}
      {children}
    </Link>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx('inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
    />
  )
}
