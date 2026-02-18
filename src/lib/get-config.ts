import { createClient } from '@/lib/supabase/server'

export type ConfigKey = 'KAPSO_API_KEY' | 'WHATSAPP_API_URL' | 'PHONE_NUMBER_ID' | 'WABA_ID'

const ENV_FALLBACKS: Record<ConfigKey, string | undefined> = {
  KAPSO_API_KEY: process.env.KAPSO_API_KEY,
  WHATSAPP_API_URL: process.env.WHATSAPP_API_URL || 'https://api.kapso.ai/meta/whatsapp',
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID || '',
  WABA_ID: process.env.WABA_ID,
}

/**
 * Resolves a config/credential value from the database (app_settings table)
 * with a fallback to process.env if no DB row exists.
 *
 * DB values take precedence over env vars, enabling admin-configurable credentials
 * without redeployment (Phase 3+). Phase 4 will wire Kapso routes to call this.
 *
 * Uses .maybeSingle() so missing rows return null (not an error).
 * Throws only if the key is absent from both DB and env (truly unconfigured).
 */
export async function getConfig(key: ConfigKey): Promise<string> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (data?.value) {
    return data.value
  }

  // Fall back to process.env
  const fallback = ENV_FALLBACKS[key]

  if (fallback !== undefined) {
    return fallback
  }

  throw new Error(`Config key "${key}" is not set in DB or environment`)
}
