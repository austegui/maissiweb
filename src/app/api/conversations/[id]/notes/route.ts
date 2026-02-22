import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from('conversation_notes')
    .select('id, content, created_at, user_profiles ( display_name )')
    .eq('conversation_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notes = (rows ?? []).map((n) => {
    const profile = n.user_profiles as unknown as { display_name: string } | null;
    return {
      id: n.id,
      content: n.content,
      createdAt: n.created_at,
      authorName: profile?.display_name ?? 'Agente',
    };
  });

  return NextResponse.json({ data: notes });
}

export async function POST(
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
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 });
  }

  const { content } = body as { content?: string };

  if (!content?.trim()) {
    return NextResponse.json({ error: 'El contenido es requerido' }, { status: 400 });
  }

  const { error } = await supabase
    .from('conversation_notes')
    .insert({
      conversation_id: id,
      author_id: user.id,
      content: content.trim(),
    });

  if (error) {
    console.error('Error inserting note:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
