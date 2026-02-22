'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
} from './actions'
import type { ActionResult } from './actions'

type CannedResponse = {
  id: string
  title: string
  shortcut: string
  body: string
}

type Props = {
  initialResponses: CannedResponse[]
}

const initialState: ActionResult = { success: false, message: '' }

export function CannedResponsesManager({ initialResponses }: Props) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingItem, setEditingItem] = useState<CannedResponse | null>(null)
  const [isPending, startTransition] = useTransition()

  // State for create form
  const [createState, createAction, createPending] = useActionState(
    createCannedResponse,
    initialState
  )

  // State for edit form -- bound with editingItem.id
  const [editState, editAction, editPending] = useActionState(
    editingItem ? updateCannedResponse.bind(null, editingItem.id) : updateCannedResponse.bind(null, ''),
    initialState
  )

  // Switch back to list on successful create
  useEffect(() => {
    if (createState.success) {
      setMode('list')
    }
  }, [createState.success])

  // Switch back to list on successful edit
  useEffect(() => {
    if (editState.success) {
      setMode('list')
      setEditingItem(null)
    }
  }, [editState.success])

  const handleEdit = (item: CannedResponse) => {
    setEditingItem(item)
    setMode('edit')
  }

  const handleDelete = (item: CannedResponse) => {
    if (!window.confirm('Delete this canned response?')) return
    startTransition(() => {
      deleteCannedResponse(item.id)
    })
  }

  const handleCancel = () => {
    setMode('list')
    setEditingItem(null)
  }

  if (mode === 'create') {
    return (
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">New Canned Response</h2>
        <form action={createAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              name="title"
              type="text"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shortcut{' '}
              <span className="text-gray-400 text-xs font-normal">(without / prefix)</span>
            </label>
            <input
              name="shortcut"
              type="text"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea
              name="body"
              rows={4}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={createPending}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createPending ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
          {createState.message && (
            <p className={createState.success ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>
              {createState.message}
            </p>
          )}
        </form>
      </div>
    )
  }

  if (mode === 'edit' && editingItem) {
    return (
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Edit Canned Response</h2>
        <form key={editingItem.id} action={editAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              name="title"
              type="text"
              required
              defaultValue={editingItem.title}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shortcut{' '}
              <span className="text-gray-400 text-xs font-normal">(without / prefix)</span>
            </label>
            <input
              name="shortcut"
              type="text"
              required
              defaultValue={editingItem.shortcut}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea
              name="body"
              rows={4}
              required
              defaultValue={editingItem.body}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={editPending}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
          {editState.message && (
            <p className={editState.success ? 'text-green-600 text-sm' : 'text-red-600 text-sm'}>
              {editState.message}
            </p>
          )}
        </form>
      </div>
    )
  }

  // List view
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {initialResponses.length === 0
            ? 'No canned responses yet.'
            : `${initialResponses.length} canned response${initialResponses.length !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => setMode('create')}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
        >
          Add New
        </button>
      </div>

      {initialResponses.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded">
          <p className="text-sm">Create your first canned response to get started.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {initialResponses.map((item) => (
            <li
              key={item.id}
              className="border border-gray-200 rounded p-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                    /{item.shortcut}
                  </span>
                  <span className="text-sm font-medium text-gray-800">{item.title}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {item.body.length > 80 ? item.body.slice(0, 80) + '…' : item.body}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={isPending}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
