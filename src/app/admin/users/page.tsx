import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { UsersManager } from './UsersManager'

export interface MemberUser {
  id: string
  email: string
  displayName: string
  role: 'admin' | 'agent'
  isActive: boolean
  lastSignInAt: string | null
}

export default async function UsersPage() {
  const adminClient = createAdminClient()
  const supabase = await createClient()

  const [
    { data: authData },
    { data: profiles },
    { data: { user: currentUser } },
  ] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from('user_profiles').select('id, display_name, role'),
    supabase.auth.getUser(),
  ])

  // Build a map of profiles keyed by user id for O(1) lookup
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  )

  const users: MemberUser[] = (authData?.users ?? []).map((authUser) => {
    const profile = profileMap.get(authUser.id)
    const isActive =
      !authUser.banned_until ||
      new Date(authUser.banned_until) < new Date()

    return {
      id: authUser.id,
      email: authUser.email ?? '',
      displayName: profile?.display_name ?? authUser.email ?? authUser.id,
      role: (profile?.role ?? 'agent') as 'admin' | 'agent',
      isActive,
      lastSignInAt: authUser.last_sign_in_at ?? null,
    }
  })

  return (
    <UsersManager
      users={users}
      currentUserId={currentUser?.id ?? ''}
    />
  )
}
