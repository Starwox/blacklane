// Formatage des dates et nombres (français, fuseau du serveur RP)

/** Fuseau horaire de référence pour l'affichage et la saisie des horaires */
export const SITE_TIMEZONE = 'Europe/Paris'

const dateFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: SITE_TIMEZONE, day: 'numeric', month: 'long', year: 'numeric' })
const shortDateFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: SITE_TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: SITE_TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: SITE_TIMEZONE, hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: SITE_TIMEZONE, day: '2-digit' })
const monthShortFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: SITE_TIMEZONE, month: 'short' })
const monthYearFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: SITE_TIMEZONE, month: 'long', year: 'numeric' })
const numberFmt = new Intl.NumberFormat('fr-FR')

const toDate = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v)

export const formatDate = (v: string | Date | null | undefined) => (v ? dateFmt.format(toDate(v)) : '—')
export const formatShortDate = (v: string | Date | null | undefined) => (v ? shortDateFmt.format(toDate(v)) : '—')
export const formatTime = (v: string | Date | null | undefined) => (v ? timeFmt.format(toDate(v)).replace(':', 'h') : '')
export const formatWeekday = (v: string | Date) => capitalize(weekdayFmt.format(toDate(v)))
export const formatDay = (v: string | Date) => dayFmt.format(toDate(v))
export const formatMonthShort = (v: string | Date) => monthShortFmt.format(toDate(v)).replace('.', '').toUpperCase()
export const formatMonthYear = (v: string | Date) => capitalize(monthYearFmt.format(toDate(v)))
export const formatNumber = (n: number | null | undefined) => (n == null ? '—' : numberFmt.format(n))

export function formatDateTime(v: string | Date | null | undefined): string {
  if (!v) return 'Date à confirmer'
  return `${formatWeekday(v)} · ${formatTime(v)}`
}

export function formatDateTimeShort(v: string | Date | null | undefined): string {
  if (!v) return '—'
  return `${formatShortDate(v)} ${formatTime(v)}`
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

export function ordinal(n: number): string {
  return n === 1 ? '1er' : `${n}e`
}

// ---------------------------------------------------------------------
//  Conversion heure locale (fuseau du site) <-> ISO, pour <input type="datetime-local">
// ---------------------------------------------------------------------

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: SITE_TIMEZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function wallClock(d: Date): WallClock & { second: number } {
  const map: Record<string, number> = {}
  for (const p of partsFmt.formatToParts(d)) if (p.type !== 'literal') map[p.type] = Number(p.value)
  return { year: map.year, month: map.month, day: map.day, hour: map.hour % 24, minute: map.minute, second: map.second }
}

function offsetMinutes(d: Date): number {
  const w = wallClock(d)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO -> "AAAA-MM-JJTHH:MM" exprimé dans le fuseau du site */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const w = wallClock(new Date(iso))
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`
}

/** "AAAA-MM-JJTHH:MM" (fuseau du site) -> ISO UTC */
export function fromLocalInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return null
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let ts = guess - offsetMinutes(new Date(guess)) * 60000
  ts = guess - offsetMinutes(new Date(ts)) * 60000
  return new Date(ts).toISOString()
}

/** Clé de jour "AAAA-MM-JJ" dans le fuseau du site */
export function dayKey(v: string | Date): string {
  const w = wallClock(toDate(v))
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`
}
