import { useEffect, useState } from 'react'
import { useData } from '../../hooks/useData'
import { useAuth } from '../../lib/auth'
import { inviteAdmin, listAdmins, removeAdmin, updateAdmin } from '../../lib/admin-api'
import { formatShortDate } from '../../lib/format'
import { ROLE_DESCRIPTION, ROLE_LABEL } from '../../lib/labels'
import type { AdminRole, AdminUser } from '../../lib/types'
import { AdminPageHeader } from './AdminLayout'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { SelectInput, TextInput } from '../../components/ui/Form'
import { ErrorState, LoadingBlock, Notice } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'

const ROLES: AdminRole[] = ['editor', 'admin', 'owner']

export default function Admins() {
  const toast = useToast()
  const { profile, refreshProfile } = useAuth()
  const admins = useData(() => listAdmins(), [])
  const [invite, setInvite] = useState({ open: false, email: '', display_name: '', role: 'editor' as AdminRole, busy: false })
  const [remove, setRemove] = useState<AdminUser | null>(null)

  useEffect(() => {
    document.title = 'Organisateurs — Back-office'
  }, [])

  const patch = async (a: AdminUser, p: Partial<Pick<AdminUser, 'display_name' | 'role' | 'active'>>, msg: string) => {
    try {
      await updateAdmin(a.user_id, p)
      toast.success(msg)
      await admins.reload()
      if (a.user_id === profile?.user_id) await refreshProfile()
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <>
      <AdminPageHeader title="Organisateurs" actions={<Button icon={<Icon name="plus" size={15} />} onClick={() => setInvite({ ...invite, open: true })}>Inviter un organisateur</Button>}>
        Comptes autorisés à accéder au back-office. Le nom affiché est un alias RP (jamais d’identité civile) ; il apparaît dans le journal des actions.
      </AdminPageHeader>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="border border-ink-600 p-4">
            <p className="display text-xl text-bone">{ROLE_LABEL[r]}</p>
            <p className="mt-1 text-xs text-smoke">{ROLE_DESCRIPTION[r]}</p>
          </div>
        ))}
      </div>

      {admins.error ? (
        <ErrorState error={admins.error} onRetry={admins.reload} />
      ) : admins.loading ? (
        <LoadingBlock rows={3} />
      ) : (
        <div className="overflow-x-auto border border-ink-600">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-ink-900">
              <tr>{['Nom affiché', 'Rôle', 'Statut', 'Depuis', ''].map((h) => <th key={h} className="label px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(admins.data ?? []).map((a) => {
                const me = a.user_id === profile?.user_id
                return (
                  <tr key={a.user_id} className="border-t border-ink-700">
                    <td className="px-4 py-3">
                      <input
                        className="field max-w-56 py-1.5"
                        defaultValue={a.display_name}
                        maxLength={40}
                        onBlur={(e) => e.target.value.trim() !== a.display_name && patch(a, { display_name: e.target.value.trim() }, 'Nom mis à jour.')}
                        aria-label="Nom affiché"
                      />
                      {me && <span className="ml-2 text-xs text-blood-400">vous</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select className="field w-auto py-1.5" value={a.role} onChange={(e) => patch(a, { role: e.target.value as AdminRole }, 'Rôle modifié.')} aria-label="Rôle">
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className={a.active ? 'text-emerald-400 hover:underline' : 'text-smoke hover:underline'}
                        disabled={me}
                        onClick={() => patch(a, { active: !a.active }, a.active ? 'Accès suspendu.' : 'Accès rétabli.')}
                      >
                        {a.active ? 'Actif' : 'Suspendu'}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-smoke">{formatShortDate(a.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {!me && (
                        <button className="p-1.5 text-smoke hover:text-blood-400" aria-label="Retirer l’accès" onClick={() => setRemove(a)}>
                          <Icon name="trash" size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Notice tone="info" className="mt-6">
        Il reste toujours au moins un compte « Owner » actif (protection en base). Retirer un accès ne supprime pas le compte d’authentification :
        supprimez-le aussi dans Supabase → Authentication → Users si nécessaire.
      </Notice>

      <Modal
        open={invite.open}
        onClose={() => setInvite({ ...invite, open: false })}
        title="Inviter un organisateur"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInvite({ ...invite, open: false })}>Annuler</Button>
            <Button
              loading={invite.busy}
              disabled={!/^\S+@\S+\.\S+$/.test(invite.email) || invite.display_name.trim().length < 2}
              onClick={async () => {
                setInvite((s) => ({ ...s, busy: true }))
                try {
                  const r = await inviteAdmin({ email: invite.email.trim(), display_name: invite.display_name.trim(), role: invite.role })
                  toast.success(r.existing ? 'Compte existant : accès au back-office accordé.' : 'Invitation envoyée par e-mail.')
                  setInvite({ open: false, email: '', display_name: '', role: 'editor', busy: false })
                  await admins.reload()
                } catch (e) {
                  toast.error(e)
                  setInvite((s) => ({ ...s, busy: false }))
                }
              }}
            >
              Envoyer l’invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextInput label="Adresse e-mail" type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} hint="Utilisée uniquement pour la connexion. Jamais affichée publiquement." />
          <TextInput label="Nom affiché (alias RP)" required value={invite.display_name} onChange={(e) => setInvite({ ...invite, display_name: e.target.value })} maxLength={40} />
          <SelectInput label="Rôle" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as AdminRole })} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} hint={ROLE_DESCRIPTION[invite.role]} />
          <p className="text-xs text-smoke">L’invitation passe par une fonction serveur Netlify : la clé secrète Supabase n’est jamais envoyée au navigateur.</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!remove}
        title="Retirer l’accès ?"
        confirmLabel="Retirer"
        danger
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          if (!remove) return
          try {
            await removeAdmin(remove.user_id)
            toast.success('Accès retiré.')
            await admins.reload()
          } catch (e) {
            toast.error(e)
          }
        }}
      >
        <p>{remove?.display_name} ne pourra plus accéder au back-office.</p>
      </ConfirmDialog>
    </>
  )
}
