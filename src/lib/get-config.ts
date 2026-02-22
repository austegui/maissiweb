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
 * Delegates to getConfigs() internally for backward compatibility.
 * Use getConfigs() directly for batch queries (single DB round-trip).
 */
export async function getConfig(key: ConfigKey): Promise<string> {
  const configs = await getConfigs(key)
  return configs[key]
}

/**
 * Batch-resolves multiple config keys in a single DB round-trip.
 * Uses .in() filter to fetch all requested keys at once.
 *
 * DB values take precedence over env vars, enabling admin-configurable credentials
 * without redeployment. Throws only if a key is absent from both DB and env.
 */
export async function getConfigs<K extends ConfigKey>(
  ...keys: K[]
): Promise<Record<K, string>> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', keys)

  // Build result map from DB rows
  const dbValues: Partial<Record<K, string>> = {}
  for (const row of data ?? []) {
    if (keys.includes(row.key as K)) {
      dbValues[row.key as K] = row.value
    }
  }

  // Apply env fallbacks for any missing keys, throw if still missing
  const result = {} as Record<K, string>
  for (const key of keys) {
    const value = dbValues[key] ?? ENV_FALLBACKS[key]
    if (value === undefined) {
      throw new Error(`Config key "${key}" is not set in DB or environment`)
    }
    result[key] = value
  }

  return result
}
