import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';
import { getConfigs } from '@/lib/get-config';

export async function getWhatsAppClient(): Promise<WhatsAppClient> {
  const { KAPSO_API_KEY, WHATSAPP_API_URL } = await getConfigs(
    'KAPSO_API_KEY',
    'WHATSAPP_API_URL'
  )
  return new WhatsAppClient({
    baseUrl: WHATSAPP_API_URL,
    kapsoApiKey: KAPSO_API_KEY,
    graphVersion: 'v24.0'
  })
}

/**
 * Factory that returns both a WhatsApp client and the phone number ID
 * in a single DB round-trip (one .in() query for all 3 config keys).
 *
 * Use this in any route that needs both the client and phoneNumberId,
 * replacing the previous pattern of getWhatsAppClient() + getConfig('PHONE_NUMBER_ID').
 */
export async function getWhatsAppClientWithPhone(): Promise<{
  client: WhatsAppClient
  phoneNumberId: string
}> {
  const { KAPSO_API_KEY, WHATSAPP_API_URL, PHONE_NUMBER_ID } = await getConfigs(
    'KAPSO_API_KEY',
    'WHATSAPP_API_URL',
    'PHONE_NUMBER_ID'
  )
  return {
    client: new WhatsAppClient({
      baseUrl: WHATSAPP_API_URL,
      kapsoApiKey: KAPSO_API_KEY,
      graphVersion: 'v24.0'
    }),
    phoneNumberId: PHONE_NUMBER_ID
  }
}
