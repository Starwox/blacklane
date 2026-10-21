import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from '../../lib/router'
import { useData } from '../../hooks/useData'
import { discardDraft, getContentRow, publishContent, saveDraft } from '../../lib/admin-api'
import { formatDateTimeShort } from '../../lib/format'
import { RANK_LABEL } from '../../lib/labels'
import { TEMPLATE_VARIABLES } from '../../lib/template'
import type { ContentKey, ContentMap, FooterContent, HomeContent, QualificationsContent, RulesContent } from '../../lib/types'
import { AdminPageHeader } from './AdminLayout'
import { ObjectEditor, type EditorSchema } from './ObjectEditor'
import Home from '../public/Home'
import Rules from '../public/Rules'
import Qualifications from '../public/Qualifications'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Segmented } from '../../components/ui/Form'
import { ErrorState, LoadingBlock, Notice } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'
import { RichText } from '../../components/race/RichText'

const TABS: { value: ContentKey; label: string }[] = [
  { value: 'home', label: 'Page d’accueil' },
  { value: 'qualifications', label: 'Qualifications' },
  { value: 'rules', label: 'Règlement & sanctions' },
  { value: 'footer', label: 'Pied de page & mentions' },
]

const SCHEMAS: Record<ContentKey, EditorSchema> = {
  home: {
    labels: {
      announcement: 'Message d’annonce',
      'announcement.enabled': 'Afficher le message',
      'announcement.tone': 'Ton',
      'announcement.text': 'Texte',
      'announcement.link_label': 'Libellé du lien',
      'announcement.link_href': 'Lien (ex. /calendrier)',
      hero: 'Hero (bandeau principal)',
      'hero.kicker': 'Surtitre',
      'hero.title_left': 'Titre — partie blanche',
      'hero.title_right': 'Titre — partie rouge',
      'hero.tagline_1': 'Accroche — ligne 1',
      'hero.tagline_2': 'Accroche — ligne 2 (rouge)',
      'hero.motto': 'Devise',
      'hero.image_url': 'Visuel du hero',
      'hero.image_alt': 'Description du visuel (accessibilité)',
      'hero.primary_cta': 'Bouton principal',
      'hero.secondary_cta': 'Bouton secondaire',
      'hero.primary_cta.label': 'Libellé',
      'hero.primary_cta.href': 'Lien',
      'hero.secondary_cta.label': 'Libellé',
      'hero.secondary_cta.href': 'Lien',
      stats: 'Statistiques',
      'stats.enabled': 'Afficher la section',
      'stats.title': 'Titre',
      'stats.items': 'Indicateurs affichés',
      'stats.items.races_completed': 'Courses organisées',
      'stats.items.pilots_participated': 'Pilotes participants',
      'stats.items.pilots_ranked': 'Pilotes classés',
      'stats.items.upcoming_events': 'Événements à venir',
      'stats.items.races_completed.enabled': 'Afficher',
      'stats.items.pilots_participated.enabled': 'Afficher',
      'stats.items.pilots_ranked.enabled': 'Afficher',
      'stats.items.upcoming_events.enabled': 'Afficher',
      'stats.items.races_completed.label': 'Libellé',
      'stats.items.pilots_participated.label': 'Libellé',
      'stats.items.pilots_ranked.label': 'Libellé',
      'stats.items.upcoming_events.label': 'Libellé',
      standings: 'Classement',
      'standings.enabled': 'Afficher la section',
      'standings.title': 'Titre',
      'standings.subtitle': 'Sous-titre',
      'standings.limit': 'Nombre de pilotes affichés',
      upcoming: 'Prochaines courses',
      'upcoming.enabled': 'Afficher la section',
      'upcoming.title': 'Titre',
      'upcoming.limit': 'Nombre de courses',
      'upcoming.featured_only': 'Uniquement les événements mis en avant',
      phases: 'Phases Blacklane',
      'phases.enabled': 'Afficher la section',
      'phases.title': 'Titre',
      'phases.intro': 'Introduction',
      'phases.items': 'Étapes',
      'phases.items.*.name': 'Nom',
      'phases.items.*.description': 'Description',
      'phases.cta_label': 'Libellé du bouton',
      organizers: 'Organisateurs',
      'organizers.enabled': 'Afficher la section',
      'organizers.title': 'Titre',
      'organizers.people': 'Organisateurs (alias RP uniquement)',
      'organizers.people.*.alias': 'Alias',
      'organizers.people.*.roles': 'Rôles',
      'organizers.people.*.verbs': 'Devise',
      'organizers.quote': 'Citation',
      results: 'Derniers résultats',
      'results.enabled': 'Afficher la section',
      'results.title': 'Titre',
      'results.limit': 'Nombre de courses',
      rules: 'Rappel du règlement',
      'rules.enabled': 'Afficher la section',
      'rules.title': 'Titre',
      'rules.items': 'Règles mises en avant',
      'rules.items.*.title': 'Règle',
      'rules.items.*.text': 'Texte',
      'rules.cta_label': 'Libellé du bouton',
      closing: 'Conclusion',
      'closing.enabled': 'Afficher la section',
      'closing.line_1': 'Ligne 1',
      'closing.line_2': 'Ligne 2 (rouge)',
    },
    hints: {
      'hero.secondary_cta.href': 'Laisser vide : lien automatique vers le prochain événement.',
      'organizers.people': 'N’indiquez jamais d’identité civile.',
      'phases.items': 'Les rangs sont fixes ; seuls leurs textes sont modifiables.',
    },
    fixedArrays: ['phases.items'],
    hidden: ['phases.items.*.key'],
    images: ['hero.image_url'],
    selects: { 'announcement.tone': [{ value: 'info', label: 'Information' }, { value: 'alert', label: 'Alerte (rouge)' }] },
    multiline: ['phases.intro', 'phases.items.*.description', 'rules.items.*.text', 'announcement.text'],
  },
  qualifications: {
    labels: {
      intro: 'Introduction',
      phase1: 'Phase 1 — Qualifications',
      phase2: 'Phase 2 — Élite',
      urban_run: 'Épreuve Urban Run',
      navigation: 'Épreuve Navigation',
      finale: 'Finale',
      tiebreak: 'Égalités',
      challenge: 'Challenge Elite',
      'challenge.steps': 'Étapes',
      'challenge.win': 'Si le challenger gagne',
      'challenge.lose': 'Si le challenger perd',
      calendar: 'Déroulé indicatif',
      'calendar.items': 'Semaines',
      '*.title': 'Titre',
      'phase1.title': 'Titre',
      'phase1.text': 'Texte',
      'phase1.summary': 'Résumé',
      'phase2.title': 'Titre',
      'phase2.text': 'Texte',
      'urban_run.title': 'Titre',
      'urban_run.text': 'Texte',
      'navigation.title': 'Titre',
      'navigation.text': 'Texte',
      'finale.title': 'Titre',
      'finale.text': 'Texte',
      'tiebreak.title': 'Titre',
      'tiebreak.text': 'Texte',
      'challenge.title': 'Titre',
      'challenge.text': 'Texte',
      'calendar.title': 'Titre',
      'calendar.items.*.label': 'Libellé',
      'calendar.items.*.text': 'Contenu',
    },
    multiline: ['intro', 'phase1.text', 'phase2.text', 'urban_run.text', 'navigation.text', 'finale.text', 'tiebreak.text', 'challenge.text'],
    templates: { 'challenge.steps': '', 'calendar.items': { label: 'Semaine', text: '' } },
  },
  rules: {
    labels: {
      intro: 'Introduction',
      sections: 'Sections du règlement',
      'sections.*.title': 'Titre',
      'sections.*.body': 'Contenu',
      sanctions: 'Sanctions par infraction',
      'sanctions.*.infraction': 'Infraction',
      'sanctions.*.sanction': 'Sanction appliquée',
    },
    hints: {
      'sections.*.body': 'Paragraphes séparés par une ligne vide. Listes : lignes commençant par « - ». Gras : **texte**.',
      sanctions: 'La sanction de chaque infraction est affichée telle quelle sur la page Règlement.',
    },
    multiline: ['intro', 'sections.*.body', 'sanctions.*.sanction'],
    templates: { sections: { id: '', title: 'Nouvelle section', body: '' }, sanctions: { id: '', infraction: '', sanction: '' } },
  },
  footer: {
    labels: {
      tagline: 'Devise',
      subline: 'Sous-titre',
      disclaimer: 'Mention « univers fictif »',
      legal: 'Mentions légales (éditeur, hébergeur)',
      privacy: 'Confidentialité',
    },
    hints: { legal: 'Complétez l’éditeur du site : obligation légale pour un site accessible publiquement.' },
    multiline: ['disclaimer', 'legal', 'privacy'],
  },
}

function withIds<K extends ContentKey>(key: K, v: ContentMap[K]): ContentMap[K] {
  if (key !== 'rules') return v
  const r = v as RulesContent
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'section'
  const used = new Set<string>()
  const sections = r.sections.map((s) => {
    let id = s.id && !used.has(s.id) ? s.id : slug(s.title)
    while (used.has(id)) id += '-2'
    used.add(id)
    return { ...s, id }
  })
  return { ...r, sections, sanctions: r.sanctions.map((s, i) => ({ ...s, id: s.id || `s${i + 1}` })) } as ContentMap[K]
}

export default function ContentEditor() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const key = (params.get('page') as ContentKey) || 'home'
  const row = useData(() => getContentRow(key), [key])
  const [draft, setDraft] = useState<ContentMap[ContentKey] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null)
  const [preview, setPreview] = useState(false)
  const [discard, setDiscard] = useState(false)

  useEffect(() => {
    document.title = 'Contenus — Back-office'
  }, [])
  useEffect(() => {
    if (row.data) {
      setDraft(row.data.draft)
      setDirty(false)
    }
  }, [row.data])
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const differs = useMemo(() => (row.data ? JSON.stringify(row.data.draft) !== JSON.stringify(row.data.published) : false), [row.data])

  const save = async () => {
    if (!draft) return
    setBusy('save')
    try {
      await saveDraft(key, withIds(key, draft))
      toast.success('Brouillon enregistré (non publié).')
      await row.reload()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(null)
    }
  }
  const publish = async () => {
    if (!draft) return
    setBusy('publish')
    try {
      if (dirty) await saveDraft(key, withIds(key, draft))
      await publishContent(key)
      toast.success('Contenu publié sur le site.')
      await row.reload()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Contenus du site"
        actions={
          <>
            <Button variant="outline" icon={<Icon name="eye" size={15} />} onClick={() => setPreview(true)} disabled={!draft}>Aperçu</Button>
            <Button variant="outline" onClick={save} loading={busy === 'save'} disabled={!dirty}>Enregistrer le brouillon</Button>
            <Button onClick={publish} loading={busy === 'publish'} disabled={!dirty && !differs} icon={<Icon name="upload" size={15} />}>Publier</Button>
          </>
        }
      >
        Les modifications sont enregistrées en brouillon, vérifiées dans l’aperçu, puis publiées sur le site public en un clic.
      </AdminPageHeader>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Page"
          value={key}
          onChange={(v) => {
            if (dirty && !window.confirm('Des modifications non enregistrées seront perdues. Continuer ?')) return
            setParams({ page: v === 'home' ? null : v })
          }}
          options={TABS}
        />
        {row.data && (
          <p className="text-xs text-smoke">
            Publié : {row.data.published_at ? formatDateTimeShort(row.data.published_at) : 'jamais'} · Brouillon : {formatDateTimeShort(row.data.draft_updated_at)}
            {dirty ? <span className="ml-2 text-amber-400">● modifications non enregistrées</span> : differs ? <span className="ml-2 text-amber-400">● brouillon non publié</span> : <span className="ml-2 text-emerald-400">● à jour</span>}
            {differs && !dirty && (
              <button className="ml-3 underline hover:text-bone" onClick={() => setDiscard(true)}>Revenir à la version publiée</button>
            )}
          </p>
        )}
      </div>

      {row.error ? (
        <ErrorState error={row.error} onRetry={row.reload} />
      ) : !draft || row.loading ? (
        <LoadingBlock rows={8} />
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <ObjectEditor
              value={draft as never}
              schema={SCHEMAS[key]}
              onChange={(v) => {
                setDraft(v as unknown as ContentMap[ContentKey])
                setDirty(true)
              }}
            />
          </div>
          <aside className="space-y-4">
            <div className="panel-flat sticky top-6 p-5">
              <p className="label mb-3">Variables disponibles</p>
              <p className="mb-3 text-xs text-smoke">Insérées dans un texte, elles sont remplacées par les paramètres de compétition actuels.</p>
              <ul className="space-y-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <li key={v.key} className="text-xs">
                    <code className="font-mono text-blood-300">{`{${v.key}}`}</code>
                    <span className="block text-smoke">{v.description}</span>
                  </li>
                ))}
              </ul>
              {key === 'home' && <Notice className="mt-4" tone="info">Les rangs ({Object.values(RANK_LABEL).join(', ')}) et les données chiffrées proviennent de la base : ils ne se saisissent pas ici.</Notice>}
            </div>
          </aside>
        </div>
      )}

      <Modal open={preview} onClose={() => setPreview(false)} title={`Aperçu — ${TABS.find((t) => t.value === key)?.label}`} size="full">
        <div className="-mx-5 -my-5 bg-ink-950">
          <p className="sticky top-0 z-10 border-b border-amber-400/30 bg-ink-900 px-4 py-2 text-xs text-amber-400">Aperçu du brouillon — non publié</p>
          {draft && key === 'home' && <Home preview={draft as HomeContent} />}
          {draft && key === 'rules' && <Rules preview={withIds('rules', draft as RulesContent)} />}
          {draft && key === 'qualifications' && <Qualifications preview={draft as QualificationsContent} />}
          {draft && key === 'footer' && (
            <div className="mx-auto max-w-3xl space-y-8 p-8">
              <p className="display text-4xl text-bone">{(draft as FooterContent).tagline}</p>
              <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-blood-400">{(draft as FooterContent).subline}</p>
              <RichText text={(draft as FooterContent).disclaimer} />
              <RichText text={(draft as FooterContent).legal} />
              <RichText text={(draft as FooterContent).privacy} />
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={discard}
        title="Abandonner le brouillon ?"
        confirmLabel="Revenir à la version publiée"
        danger
        onClose={() => setDiscard(false)}
        onConfirm={async () => {
          try {
            await discardDraft(key)
            toast.success('Brouillon remplacé par la version publiée.')
            await row.reload()
          } catch (e) {
            toast.error(e)
          }
        }}
      >
        <p>Les modifications non publiées de cette page seront perdues.</p>
      </ConfirmDialog>
    </>
  )
}
