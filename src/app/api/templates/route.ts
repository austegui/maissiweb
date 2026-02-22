import { NextResponse } from 'next/server';
import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { getConfigs } from '@/lib/get-config';

export async function GET() {
  try {
    const { KAPSO_API_KEY, WHATSAPP_API_URL, WABA_ID: wabaId } = await getConfigs(
      'KAPSO_API_KEY',
      'WHATSAPP_API_URL',
      'WABA_ID'
    );
    const whatsappClient = new WhatsAppClient({
      baseUrl: WHATSAPP_API_URL,
      kapsoApiKey: KAPSO_API_KEY,
      graphVersion: 'v24.0'
    });

    const response = await whatsappClient.templates.list({
      businessAccountId: wabaId,
      limit: 100
    });

    return NextResponse.json({
      data: response.data,
      paging: response.paging
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
