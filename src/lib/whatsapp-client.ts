import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { getConfig } from '@/lib/get-config';

export async function getWhatsAppClient(): Promise<WhatsAppClient> {
  const kapsoApiKey = await getConfig('KAPSO_API_KEY');
  const baseUrl = await getConfig('WHATSAPP_API_URL');
  return new WhatsAppClient({ baseUrl, kapsoApiKey, graphVersion: 'v24.0' });
}
