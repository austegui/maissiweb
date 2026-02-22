import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 });
  }

  // agentId can be a UUID string or null (to unassign)
  const { agentId } = body as { agentId?: string | null };

  // agentId must be undefined (not provided), null (unassign), or a non-empty string (UUID)
  if (agentId !== null && agentId !== undefined && typeof agentId !== 'string') {
    return NextResponse.json({ error: 'agentId debe ser un UUID o null' }, { status: 400 });
  }

  const { error } = await supabase
    .from('conversation_metadata')
    .upsert(
      {
        conversation_id: id,
        assigned_agent_id: agentId ?? null,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'conversation_id' }
    );

  if (error) {
    console.error('Error upserting conversation assignment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
