import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const VALID_STATUSES = ['abierto', 'pendiente', 'resuelto'] as const;

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

  const { status } = body as { status?: string };

  if (!status || !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      { error: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('conversation_metadata')
    .upsert(
      {
        conversation_id: id,
        status,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'conversation_id' }
    );

  if (error) {
    console.error('Error upserting conversation status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
