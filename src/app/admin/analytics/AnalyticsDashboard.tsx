'use client'

import { useState, useEffect } from 'react'
import { subDays, format } from 'date-fns'
import { MessageSquare, Clock, CheckCircle, Download } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

type Agent = {
  id: string
  display_name: string
}

type KPIs = {
  totalMessages: number
  totalConversations: number
  avgReplyTimeMinutes: number | null
  resolvedCount: number
}

type VolumeDay = {
  day: string
  count: number
}

type AgentBreakdown = {
  agentId: string
  agentName: string
  resolvedCount: number
  totalCount: number
}

type AnalyticsData = {
  kpis: KPIs
  volumeByDay: VolumeDay[]
  agentBreakdown: AgentBreakdown[]
}

type SortKey = 'agentName' | 'resolvedCount' | 'totalCount' | 'pct'
type SortDir = 'asc' | 'desc'

function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function makeRange(days: number): { from: string; to: string } {
  const now = new Date()
  return {
    from: toISODate(subDays(now, days - 1)),
    to: toISODate(now),
  }
}

export function AnalyticsDashboard({ agents: _agents }: { agents: Agent[] }) {
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(makeRange(7))
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('totalCount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/admin/analytics?from=${dateRange.from}&to=${dateRange.to}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Analytics fetch error:', err)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [dateRange])

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const url = `/api/admin/analytics/export?from=${dateRange.from}&to=${dateRange.to}&status=${statusFilter}`
      const res = await fetch(url)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `analiticas-${dateRange.from}-${dateRange.to}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const sortedAgents = [...(data?.agentBreakdown ?? [])].sort((a, b) => {
    let aVal: number | string
    let bVal: number | string
    if (sortBy === 'agentName') {
      aVal = a.agentName.toLowerCase()
      bVal = b.agentName.toLowerCase()
    } else if (sortBy === 'resolvedCount') {
      aVal = a.resolvedCount
      bVal = b.resolvedCount
    } else if (sortBy === 'totalCount') {
      aVal = a.totalCount
      bVal = b.totalCount
    } else {
      aVal = a.totalCount > 0 ? (a.resolvedCount / a.totalCount) * 100 : 0
      bVal = b.totalCount > 0 ? (b.resolvedCount / b.totalCount) * 100 : 0
    }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const sortArrow = (key: SortKey) => {
    if (sortBy !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const barChartHeight = Math.max(100, (data?.agentBreakdown.length ?? 0) * 50)

  return (
    <div>
      {/* Date range presets */}
      <div className="flex gap-2 mb-6">
        {[
          { label: '7 dias', days: 7 },
          { label: '30 dias', days: 30 },
          { label: '90 dias', days: 90 },
        ].map(({ label, days }) => {
          const range = makeRange(days)
          const isActive = dateRange.from === range.from && dateRange.to === range.to
          return (
            <button
              key={days}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {label}
            </button>
          )
        })}
        <span className="ml-auto text-xs text-gray-400 self-center">
          {dateRange.from} — {dateRange.to}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded border p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Mensajes Totales</span>
          </div>
          <div className="text-2xl font-bold">
            {loading ? '...' : (data?.kpis.totalMessages ?? 0).toLocaleString()}
          </div>
        </div>

        <div className="rounded border p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Tiempo de Respuesta Aprox.</span>
          </div>
          <div className="text-2xl font-bold">
            {loading
              ? '...'
              : data?.kpis.avgReplyTimeMinutes != null
              ? `${data.kpis.avgReplyTimeMinutes.toFixed(1)} min`
              : '—'}
          </div>
        </div>

        <div className="rounded border p-4 bg-white shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500">Conversaciones Resueltas</span>
          </div>
          <div className="text-2xl font-bold">
            {loading ? '...' : (data?.kpis.resolvedCount ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Message Volume Chart */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Volumen de Mensajes</h2>
        {loading || !data ? (
          <div className="bg-gray-100 rounded" style={{ height: 300 }} />
        ) : data.volumeByDay.length === 0 ? (
          <div
            className="bg-gray-50 rounded border flex items-center justify-center text-sm text-gray-400"
            style={{ height: 300 }}
          >
            Sin datos para este periodo
          </div>
        ) : (
          <div className={loading ? 'opacity-50' : ''}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.volumeByDay} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name="Mensajes"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Per-Agent Breakdown */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Rendimiento por Agente</h2>
        {loading || !data ? (
          <div className="bg-gray-100 rounded" style={{ height: 100 }} />
        ) : data.agentBreakdown.length === 0 ? (
          <div className="bg-gray-50 rounded border flex items-center justify-center text-sm text-gray-400 py-8">
            Sin datos para este periodo
          </div>
        ) : (
          <>
            <div className={loading ? 'opacity-50' : ''}>
              <ResponsiveContainer width="100%" height={barChartHeight}>
                <BarChart
                  data={data.agentBreakdown}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="agentName" type="category" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalCount" name="Total" fill="#94a3b8" />
                  <Bar dataKey="resolvedCount" name="Resueltas" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sortable table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th
                      className="text-left p-2 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('agentName')}
                    >
                      Agente{sortArrow('agentName')}
                    </th>
                    <th
                      className="text-right p-2 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('resolvedCount')}
                    >
                      Resueltas{sortArrow('resolvedCount')}
                    </th>
                    <th
                      className="text-right p-2 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('totalCount')}
                    >
                      Total{sortArrow('totalCount')}
                    </th>
                    <th
                      className="text-right p-2 cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort('pct')}
                    >
                      % Resueltas{sortArrow('pct')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent) => {
                    const pct =
                      agent.totalCount > 0
                        ? ((agent.resolvedCount / agent.totalCount) * 100).toFixed(0) + '%'
                        : '0%'
                    return (
                      <tr key={agent.agentId} className="border-b hover:bg-gray-50">
                        <td className="p-2">{agent.agentName}</td>
                        <td className="p-2 text-right">{agent.resolvedCount}</td>
                        <td className="p-2 text-right">{agent.totalCount}</td>
                        <td className="p-2 text-right">{pct}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* CSV Export */}
      <div className="border rounded p-4 bg-white shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Exportar Datos</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border rounded px-2 py-1.5 bg-white text-gray-700"
          >
            <option value="">Todos</option>
            <option value="abierto">Abierto</option>
            <option value="pendiente">Pendiente</option>
            <option value="resuelto">Resuelto</option>
          </select>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exportando...' : 'Descargar CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}
