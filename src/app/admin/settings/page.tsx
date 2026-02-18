import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('app_settings')
    .select('key, value')

  const settings: Record<string, string> = {}
  for (const row of rows ?? []) {
    settings[row.key] = row.value
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Settings</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to inbox
        </Link>
      </div>
      <SettingsForm
        kapsoApiKey={settings['KAPSO_API_KEY'] ?? ''}
        phoneNumberId={settings['PHONE_NUMBER_ID'] ?? ''}
        wabaId={settings['WABA_ID'] ?? ''}
        whatsappApiUrl={settings['WHATSAPP_API_URL'] ?? ''}
      />
    </div>
  )
}
