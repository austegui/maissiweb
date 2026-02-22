import { NextResponse } from 'next/server';
import { getWhatsAppClientWithPhone } from '@/lib/whatsapp-client';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { mediaId } = await params;
  try {
    const { client: whatsappClient, phoneNumberId } = await getWhatsAppClientWithPhone();

    // Get metadata for mime type
    const metadata = await whatsappClient.media.get({
      mediaId,
      phoneNumberId
    });

    const buffer = await whatsappClient.media.download({
      mediaId,
      phoneNumberId,
      auth: 'never' // Force no auth headers for CDN
    });

    // If buffer is a Response, return it directly
    if (buffer instanceof Response) {
      return buffer;
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': metadata.mimeType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch media',
        details: error instanceof Error ? error.message : 'Unknown error',
        mediaId
      },
      { status: 500 }
    );
  }
}
