'use client'

import { useEffect, useState } from 'react'
import { Command } from 'cmdk'

type CannedResponse = {
  id: string
  title: string
  shortcut: string
  body: string
}

type Props = {
  query: string
  onSelect: (body: string) => void
  onClose: () => void
}

export function CannedResponsesPicker({ query, onSelect, onClose }: Props) {
  const [responses, setResponses] = useState<CannedResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/canned-responses')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) {
          setResponses(json.data ?? [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const filtered = responses.filter((r) => {
    const q = query.toLowerCase()
    return r.shortcut.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)
  })

  if (!loading && filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-lg border border-[#d1d7db] bg-white shadow-lg overflow-hidden max-h-64">
      <Command shouldFilter={false}>
        <Command.List className="overflow-y-auto max-h-64">
          {loading ? (
            <Command.Loading>
              <div className="px-3 py-2 text-sm text-[#667781]">Loading...</div>
            </Command.Loading>
          ) : (
            filtered.map((response) => (
              <Command.Item
                key={response.id}
                value={response.id}
                onSelect={() => {
                  onSelect(response.body)
                  onClose()
                }}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer text-sm [&[aria-selected=true]]:bg-[#f0f2f5] outline-none"
              >
                <span className="font-mono text-[#00a884] text-xs shrink-0">/{response.shortcut}</span>
                <span className="text-[#111b21] truncate">{response.title}</span>
              </Command.Item>
            ))
          )}
        </Command.List>
      </Command>
    </div>
  )
}
