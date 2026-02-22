import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('conversation_contact_labels')
    .select('label_id, contact_labels(id, name, color)')
    .eq('phone_number', phone);

  if (error) {
    console.error('Error fetching contact labels:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params;
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

  const { labelId } = body as { labelId?: string };
  if (!labelId || typeof labelId !== 'string') {
    return NextResponse.json({ error: 'labelId es requerido' }, { status: 400 });
  }

  const { error } = await supabase
    .from('conversation_contact_labels')
    .insert({ phone_number: phone, label_id: labelId });

  // Idempotent: if unique constraint violation, treat as success
  if (error) {
    const isUniqueViolation =
      error.message.includes('unique') ||
      error.message.includes('duplicate') ||
      error.code === '23505';
    if (isUniqueViolation) {
      return NextResponse.json({ success: true });
    }
    console.error('Error attaching label to contact:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params;
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

  const { labelId } = body as { labelId?: string };
  if (!labelId || typeof labelId !== 'string') {
    return NextResponse.json({ error: 'labelId es requerido' }, { status: 400 });
  }

  const { error } = await supabase
    .from('conversation_contact_labels')
    .delete()
    .eq('phone_number', phone)
    .eq('label_id', labelId);

  if (error) {
    console.error('Error removing label from contact:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
