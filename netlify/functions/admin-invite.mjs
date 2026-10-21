// Netlify Function — invitation d'un organisateur dans le back-office.
//
// Exécutée côté serveur uniquement : la clé SUPABASE_SERVICE_ROLE_KEY n'est
// jamais envoyée au navigateur. L'appelant doit être connecté et posséder le
// rôle « owner » dans public.admin_users.
//
// Variables d'environnement Netlify requises :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL

const ROLES = new Set(['owner', 'admin', 'editor'])

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

export default async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' })

  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const siteUrl = (process.env.SITE_URL || process.env.URL || '').replace(/\/+$/, '')
  if (!url || !serviceKey) return json(500, { error: 'Fonction non configurée : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.' })

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Authentification requise.' })

  const admin = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }

  // 1. Identité de l'appelant (jeton de session Supabase)
  const meRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${token}` } })
  if (!meRes.ok) return json(401, { error: 'Session invalide ou expirée.' })
  const me = await meRes.json()

  // 2. L'appelant doit être owner actif
  const roleRes = await fetch(`${url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(me.id)}&select=role,active,display_name`, { headers: admin })
  const [caller] = roleRes.ok ? await roleRes.json() : []
  if (!caller || !caller.active || caller.role !== 'owner') return json(403, { error: 'Seul un owner peut inviter un organisateur.' })

  // 3. Validation de la demande
  let body
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'Requête invalide.' })
  }
  const email = String(body.email || '').trim().toLowerCase()
  const displayName = String(body.display_name || '').trim()
  const role = String(body.role || 'editor')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(400, { error: 'Adresse e-mail invalide.' })
  if (displayName.length < 2 || displayName.length > 40) return json(400, { error: 'Le nom affiché doit contenir 2 à 40 caractères.' })
  if (!ROLES.has(role)) return json(400, { error: 'Rôle inconnu.' })

  // 4. Invitation (ou récupération d'un compte existant)
  let userId = null
  let existing = false
  const redirect = siteUrl ? `?redirect_to=${encodeURIComponent(`${siteUrl}/admin/reinitialiser`)}` : ''
  const inviteRes = await fetch(`${url}/auth/v1/invite${redirect}`, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify({ email, data: { display_name: displayName } }),
  })
  if (inviteRes.ok) {
    userId = (await inviteRes.json()).id
  } else {
    const err = await inviteRes.json().catch(() => ({}))
    const already = inviteRes.status === 422 || /already|exists|registered/i.test(JSON.stringify(err))
    if (!already) return json(502, { error: `Invitation refusée par Supabase : ${err.msg || err.message || inviteRes.status}` })
    existing = true
    for (let page = 1; page <= 20 && !userId; page++) {
      const listRes = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: admin })
      if (!listRes.ok) break
      const { users = [] } = await listRes.json()
      userId = users.find((u) => (u.email || '').toLowerCase() === email)?.id ?? null
      if (users.length < 200) break
    }
    if (!userId) return json(502, { error: 'Compte existant introuvable.' })
  }

  // 5. Droits d'accès au back-office
  const upsert = await fetch(`${url}/rest/v1/admin_users?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...admin, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, display_name: displayName, role, active: true }),
  })
  if (!upsert.ok) {
    const err = await upsert.json().catch(() => ({}))
    return json(502, { error: `Enregistrement des droits impossible : ${err.message || upsert.status}` })
  }

  // 6. Journal
  await fetch(`${url}/rest/v1/audit_log`, {
    method: 'POST',
    headers: { ...admin, Prefer: 'return=minimal' },
    body: JSON.stringify({
      actor: me.id,
      actor_name: caller.display_name,
      action: 'admin.invite',
      entity: 'admin_users',
      entity_id: userId,
      details: { role, display_name: displayName, existing },
    }),
  }).catch(() => {})

  return json(200, { invited: !existing, existing })
}

