import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/canned-responses
 *
 * Returns all canned responses ordered by shortcut for authenticated users.
 * Returns 401 JSON (not 302 redirect) for unauthenticated requests — the
 * middleware redirect is not appropriate for API consumers making fetch() calls.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('canned_responses')
    .select('id, title, shortcut, body')
    .order('shortcut', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
