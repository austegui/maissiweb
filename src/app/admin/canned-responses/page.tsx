import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CannedResponsesManager } from './CannedResponsesManager'

export default async function CannedResponsesPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('canned_responses')
    .select('id, title, shortcut, body')
    .order('shortcut', { ascending: true })

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Canned Responses</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to inbox
        </Link>
      </div>
      <CannedResponsesManager initialResponses={rows ?? []} />
    </div>
  )
}
