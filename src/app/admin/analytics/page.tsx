import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from './AnalyticsDashboard'

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, display_name')
    .order('display_name', { ascending: true })

  const agents = (profiles ?? []).map((p) => ({
    id: p.id as string,
    display_name: (p.display_name as string) ?? 'Sin nombre',
  }))

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Analiticas</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Volver al inbox
        </Link>
      </div>
      <AnalyticsDashboard agents={agents} />
    </div>
  )
}
