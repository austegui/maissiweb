import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/settings
 *
 * Returns all rows from the app_settings table for authenticated users.
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
    .from('app_settings')
    .select('key, value')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * POST /api/settings
 *
 * Upserts credential rows into the app_settings table for authenticated users.
 * Body: { settings: Array<{ key: string; value: string }> }
 *
 * Uses onConflict: 'key' because the unique constraint is on the `key` column,
 * not on the primary key `id`. Without this, upsert would default to PK conflict
 * detection and always INSERT (causing unique constraint errors).
 */
export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const updates = body.settings as Array<{ key: string; value: string }>

  const { error } = await supabase
    .from('app_settings')
    .upsert(updates, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
