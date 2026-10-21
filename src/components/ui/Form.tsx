import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cx('block', className)}>
      <label htmlFor={htmlFor} className="label mb-1.5 flex items-center gap-1 text-[0.7rem] text-ash">
        {label}
        {required && <span className="text-blood-400" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-blood-300" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-smoke">{hint}</p>
      ) : null}
    </div>
  )
}

type Common = { label: string; hint?: ReactNode; error?: string | null; className?: string }

export function TextInput({ label, hint, error, className, required, id, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={fid}>
      <input id={fid} className="field" required={required} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  )
}

export function TextArea({ label, hint, error, className, required, id, rows = 4, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={fid}>
      <textarea id={fid} rows={rows} className="field resize-y" required={required} aria-invalid={error ? true : undefined} {...rest} />
    </Field>
  )
}

export function SelectInput({
  label,
  hint,
  error,
  className,
  required,
  id,
  options,
  placeholder,
  ...rest
}: Common &
  SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string; disabled?: boolean }[]; placeholder?: string }) {
  const auto = useId()
  const fid = id ?? auto
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className} htmlFor={fid}>
      <select id={fid} className="field" required={required} aria-invalid={error ? true : undefined} {...rest}>
        {placeholder != null && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  hint?: ReactNode
  disabled?: boolean
}) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-5 w-9 shrink-0 border transition-colors',
          checked ? 'border-blood-500 bg-blood-500/30' : 'border-ink-400 bg-ink-900',
        )}
      >
        <span className={cx('absolute top-0.5 size-3.5 transition-all', checked ? 'left-[1.15rem] bg-blood-400' : 'left-0.5 bg-smoke')} />
      </button>
      <span className="text-sm">
        <span className="text-bone">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-smoke">{hint}</span>}
      </span>
    </label>
  )
}

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2.5 text-sm text-ash', disabled && 'cursor-not-allowed opacity-60')}>
      <input
        type="checkbox"
        className="size-4 accent-[#e1141e]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}

/** Barre de filtres (boutons segmentés) */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex border border-ink-500 bg-ink-900 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex items-center gap-1.5 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-[0.14em] transition-colors',
            value === o.value ? 'bg-blood-500 text-white' : 'text-smoke hover:text-bone',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
