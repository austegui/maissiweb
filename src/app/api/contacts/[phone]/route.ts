import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? undefined;

  // Upsert: creates row if absent, never overwrites existing data
  await supabase
    .from('contacts')
    .upsert(
      { phone_number: phone, whatsapp_name: name },
      { onConflict: 'phone_number', ignoreDuplicates: true }
    );

  const { data: contact, error } = await supabase
    .from('contacts')
    .select('phone_number, display_name, email, notes, whatsapp_name, created_at')
    .eq('phone_number', phone)
    .single();

  if (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: contact });
}

export async function PATCH(
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
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 });
  }

  const { displayName, email, notes } = body as {
    displayName?: string;
    email?: string;
    notes?: string;
  };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (displayName !== undefined) updates.display_name = displayName;
  if (email !== undefined) updates.email = email;
  if (notes !== undefined) updates.notes = notes;

  const { error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('phone_number', phone);

  if (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
