// Éditeur de formulaire générique pour les contenus JSON du site :
// déduit le type de champ de la valeur (texte, booléen, nombre, liste…)
// et utilise un dictionnaire de libellés français par chemin.
import { useState, type ReactNode } from 'react'
import { uploadImage } from '../../lib/admin-api'
import { errorMessage } from '../../lib/errors'
import { Icon } from '../../components/ui/Icon'
import { Toggle } from '../../components/ui/Form'
import { Button } from '../../components/ui/Button'
import { cx } from '../../components/ui/cx'

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

export interface EditorSchema {
  labels: Record<string, string>
  hints?: Record<string, string>
  /** Chemins des listes à taille fixe (pas d'ajout / suppression) */
  fixedArrays?: string[]
  /** Champs masqués (identifiants techniques) */
  hidden?: string[]
  /** Champs à choix */
  selects?: Record<string, { value: string; label: string }[]>
  /** Champs image (envoi vers le stockage) */
  images?: string[]
  /** Champs longs (zone de texte) */
  multiline?: string[]
  /** Modèle d'un nouvel élément pour une liste */
  templates?: Record<string, Json>
}

const pattern = (path: string) => path.replace(/\.\d+(?=\.|$)/g, '.*')
const humanize = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

function blankLike(v: Json): Json {
  if (typeof v === 'string') return ''
  if (typeof v === 'number') return 0
  if (typeof v === 'boolean') return false
  if (Array.isArray(v)) return []
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'id' ? `n${Date.now().toString(36)}` : blankLike(x)]))
  return null
}

function ImageField({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative overflow-hidden border border-ink-600">
          <img src={value} alt="" className="h-40 w-full object-cover" />
          <button type="button" className="absolute right-2 top-2 bg-ink-950/90 px-2 py-1 text-xs text-bone hover:text-blood-300" onClick={() => onChange(null)}>
            Retirer
          </button>
        </div>
      ) : (
        <p className="border border-dashed border-ink-500 px-3 py-4 text-xs text-smoke">Aucune image : le décor vectoriel par défaut est utilisé.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className={cx('inline-flex cursor-pointer items-center gap-2 border border-ink-500 px-3 py-1.5 text-xs uppercase tracking-wider text-ash hover:border-blood-500', busy && 'opacity-60')}>
          <Icon name="upload" size={14} />
          {busy ? 'Envoi…' : 'Envoyer une image'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setBusy(true)
              setError(null)
              try {
                onChange(await uploadImage(f))
              } catch (err) {
                setError(errorMessage(err))
              } finally {
                setBusy(false)
              }
            }}
          />
        </label>
        <input className="field flex-1 py-1.5 text-xs" placeholder="…ou URL https://" value={value ?? ''} onChange={(e) => onChange(e.target.value.trim() || null)} />
      </div>
      <p className="text-xs text-smoke">JPEG, PNG, WebP ou AVIF, 5 Mo max. Idéalement 2400 × 1350 px, sombre, sujet à droite.</p>
      {error && <p className="text-xs text-blood-300">{error}</p>}
    </div>
  )
}

export function ObjectEditor({ value, onChange, schema, path = '' }: { value: Json; onChange: (v: Json) => void; schema: EditorSchema; path?: string }) {
  const p = pattern(path)
  const key = path.split('.').pop() ?? ''
  const label = schema.labels[p] ?? humanize(key)
  const hint = schema.hints?.[p]

  if (schema.images?.includes(p)) {
    return (
      <Wrap label={label} hint={hint} asDiv>
        <ImageField value={(value as string | null) ?? null} onChange={onChange} />
      </Wrap>
    )
  }
  if (schema.selects?.[p]) {
    return (
      <Wrap label={label} hint={hint}>
        <select className="field" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {schema.selects[p].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Wrap>
    )
  }
  if (typeof value === 'boolean') {
    return <Toggle label={label} hint={hint} checked={value} onChange={onChange} />
  }
  if (typeof value === 'number') {
    return (
      <Wrap label={label} hint={hint}>
        <input type="number" className="field w-32" value={value} min={0} max={50} onChange={(e) => onChange(Math.max(0, Math.min(50, Number(e.target.value) || 0)))} />
      </Wrap>
    )
  }
  if (typeof value === 'string' || value === null) {
    const multiline = schema.multiline?.includes(p) || (typeof value === 'string' && value.length > 90)
    return (
      <Wrap label={label} hint={hint}>
        {multiline ? (
          <textarea className="field min-h-24" value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={Math.min(10, Math.max(3, Math.ceil((value ?? '').length / 90)))} />
        ) : (
          <input className="field" value={value ?? ''} onChange={(e) => onChange(value === null && e.target.value === '' ? null : e.target.value)} />
        )}
      </Wrap>
    )
  }
  if (Array.isArray(value)) {
    const fixed = schema.fixedArrays?.includes(p)
    const template = schema.templates?.[p] ?? (value.length ? blankLike(value[0]) : '')
    const move = (i: number, d: number) => {
      const next = [...value]
      const j = i + d
      if (j < 0 || j >= next.length) return
      ;[next[i], next[j]] = [next[j], next[i]]
      onChange(next)
    }
    return (
      <fieldset className="space-y-3">
        <legend className="label mb-2 text-ash">{label}</legend>
        {hint && <p className="-mt-1 text-xs text-smoke">{hint}</p>}
        {value.map((item, i) => (
          <div key={i} className="relative border border-ink-600 bg-ink-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs text-smoke">#{i + 1}</span>
              <span className="flex gap-1">
                <button type="button" className="p-1 text-smoke hover:text-bone disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Monter">
                  <Icon name="chevronDown" size={15} className="rotate-180" />
                </button>
                <button type="button" className="p-1 text-smoke hover:text-bone disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label="Descendre">
                  <Icon name="chevronDown" size={15} />
                </button>
                {!fixed && (
                  <button type="button" className="p-1 text-smoke hover:text-blood-400" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Supprimer">
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </span>
            </div>
            <ObjectEditor value={item} schema={schema} path={`${path}.${i}`} onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))} />
          </div>
        ))}
        {!fixed && (
          <Button size="sm" variant="outline" icon={<Icon name="plus" size={14} />} onClick={() => onChange([...value, structuredClone(template)])}>
            Ajouter
          </Button>
        )}
      </fieldset>
    )
  }
  // Objet
  // Ordre d'affichage : celui du dictionnaire de libellés (le stockage JSON ne conserve pas l'ordre des clés)
  const order = Object.keys(schema.labels)
  const rank = (k: string) => {
    const i = order.indexOf(pattern(path ? `${path}.${k}` : k))
    return i === -1 ? 9999 : i
  }
  const entries = Object.entries(value)
    .filter(([k]) => !schema.hidden?.includes(pattern(path ? `${path}.${k}` : k)) && k !== 'id')
    .sort(([a], [b]) => rank(a) - rank(b))
  const isTop = !path
  const content = (
    <div className={cx('grid gap-4', !isTop && 'md:grid-cols-1')}>
      {entries.map(([k, v]) => (
        <ObjectEditor key={k} value={v} schema={schema} path={path ? `${path}.${k}` : k} onChange={(nv) => onChange({ ...value, [k]: nv })} />
      ))}
    </div>
  )
  if (isTop || /\.\d+$/.test(path)) return content
  const depth = path.split('.').length
  return (
    <fieldset className={cx(depth === 1 ? 'panel-flat p-5' : 'border-l-2 border-ink-600 pl-4')}>
      <legend className={cx(depth === 1 ? 'display float-left mb-4 w-full text-2xl text-bone' : 'label mb-3 text-ash')}>{label}</legend>
      {hint && <p className="clear-both -mt-2 mb-4 text-xs text-smoke">{hint}</p>}
      <div className="clear-both">{content}</div>
    </fieldset>
  )
}

function Wrap({ label, hint, children, asDiv }: { label: string; hint?: string; children: ReactNode; asDiv?: boolean }) {
  const Tag = asDiv ? 'div' : 'label'
  return (
    <Tag className="block">
      <span className="label mb-1.5 block text-[0.7rem] text-ash">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-smoke">{hint}</span>}
    </Tag>
  )
}
