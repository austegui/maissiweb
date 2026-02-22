import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LabelsManager } from './LabelsManager'

export default async function LabelsPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('contact_labels')
    .select('id, name, color')
    .order('name', { ascending: true })

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Etiquetas</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Volver al inbox
        </Link>
      </div>
      <LabelsManager initialLabels={rows ?? []} />
    </div>
  )
}
