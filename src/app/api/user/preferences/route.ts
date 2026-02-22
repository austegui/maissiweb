import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data } = await supabase
    .from('user_profiles')
    .select('notifications_enabled, role')
    .eq('id', user.id)
    .single();

  const notificationsEnabled = data?.notifications_enabled ?? true;
  return NextResponse.json({
    notifications_enabled: notificationsEnabled,
    role: data?.role ?? 'agent',
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: { notifications_enabled: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.notifications_enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'notifications_enabled must be a boolean' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update({ notifications_enabled: body.notifications_enabled })
    .eq('id', user.id)
    .select('notifications_enabled')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notifications_enabled: data?.notifications_enabled ?? body.notifications_enabled });
}
