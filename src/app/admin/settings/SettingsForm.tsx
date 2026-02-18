'use client'

import { useActionState } from 'react'
import { saveSettings } from './actions'
import type { SaveResult } from './actions'

type Props = {
  kapsoApiKey: string
  phoneNumberId: string
  wabaId: string
  whatsappApiUrl: string
}

const initialState: SaveResult = { success: false, message: '' }

export function SettingsForm({ kapsoApiKey, phoneNumberId, wabaId, whatsappApiUrl }: Props) {
  const [state, formAction, pending] = useActionState(saveSettings, initialState)

  // Mask the API key: show bullet chars + last 4 characters
  // Cap bullet count at 12 to avoid overly long display
  const maskedApiKey = kapsoApiKey.length > 4
    ? '•'.repeat(Math.min(kapsoApiKey.length - 4, 12)) + kapsoApiKey.slice(-4)
    : kapsoApiKey || 'Not set'

  return (
    <form action={formAction} className="space-y-4">

      {/* KAPSO API Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          API Key{' '}
          <span className="text-gray-400 text-xs font-normal">(current: {maskedApiKey})</span>
        </label>
        <input
          name="kapsoApiKey"
          type="password"
          placeholder="Enter new value to update (leave blank to keep current)"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Phone Number ID */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number ID
        </label>
        <input
          name="phoneNumberId"
          type="text"
          defaultValue={phoneNumberId}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* WABA ID */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WABA ID
        </label>
        <input
          name="wabaId"
          type="text"
          defaultValue={wabaId}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* WhatsApp API URL (optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          WhatsApp API URL{' '}
          <span className="text-gray-400 text-xs font-normal">(optional)</span>
        </label>
        <input
          name="whatsappApiUrl"
          type="text"
          placeholder="Default: https://api.kapso.ai/meta/whatsapp"
          defaultValue={whatsappApiUrl}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={pending}
        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Status message */}
      {state.message && (
        <p className={state.success ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>
          {state.message}
        </p>
      )}
    </form>
  )
}
