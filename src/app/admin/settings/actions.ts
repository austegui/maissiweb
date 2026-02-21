'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type SaveResult = { success: boolean; message: string }

export async function saveSettings(
  _prevState: SaveResult,
  formData: FormData
): Promise<SaveResult> {
  const kapsoApiKey = formData.get('kapsoApiKey')
  const phoneNumberId = formData.get('phoneNumberId')
  const wabaId = formData.get('wabaId')
  const whatsappApiUrl = formData.get('whatsappApiUrl')

  if (typeof phoneNumberId !== 'string' || typeof wabaId !== 'string') {
    return { success: false, message: 'Phone Number ID and WABA ID are required' }
  }

  const updates: Array<{ key: string; value: string }> = []

  // Always include PHONE_NUMBER_ID and WABA_ID
  updates.push({ key: 'PHONE_NUMBER_ID', value: phoneNumberId.trim() })
  updates.push({ key: 'WABA_ID', value: wabaId.trim() })

  // Only include KAPSO_API_KEY if a new value is provided
  // Empty means "keep current" — do not overwrite with empty string
  if (typeof kapsoApiKey === 'string' && kapsoApiKey.trim()) {
    updates.push({ key: 'KAPSO_API_KEY', value: kapsoApiKey.trim() })
  }

  // WHATSAPP_API_URL is optional — blank means "use default fallback", do not write empty string
  if (typeof whatsappApiUrl === 'string' && whatsappApiUrl.trim()) {
    updates.push({ key: 'WHATSAPP_API_URL', value: whatsappApiUrl.trim() })
  }

  if (updates.length === 0) {
    return { success: false, message: 'No changes to save' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('app_settings')
    .upsert(updates, { onConflict: 'key' })

  if (error) {
    return { success: false, message: `Save failed: ${error.message}` }
  }

  revalidatePath('/admin/settings')
  return { success: true, message: 'Settings saved successfully' }
}
