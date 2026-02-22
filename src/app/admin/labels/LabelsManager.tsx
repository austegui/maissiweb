'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  createLabel,
  updateLabel,
  deleteLabel,
} from './actions'
import type { ActionResult } from './actions'

type Label = {
  id: string
  name: string
  color: string
}

type Props = {
  initialLabels: Label[]
}

const initialState: ActionResult = { success: false, message: '' }

function getContrastColor(hex: string): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 128 ? '#111827' : '#ffffff'
}

export function LabelsManager({ initialLabels }: Props) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingItem, setEditingItem] = useState<Label | null>(null)
  const [isPending, startTransition] = useTransition()

  // Color preview state for create form
  const [createColor, setCreateColor] = useState('#6B7280')
  // Color preview state for edit form
  const [editColor, setEditColor] = useState('#6B7280')

  // State for create form
  const [createState, createAction, createPending] = useActionState(
    createLabel,
    initialState
  )

  // State for edit form -- bound with editingItem.id
  const [editState, editAction, editPending] = useActionState(
    editingItem ? updateLabel.bind(null, editingItem.id) : updateLabel.bind(null, ''),
    initialState
  )

  // Switch back to list on successful create
  useEffect(() => {
    if (createState.success) {
      setMode('list')
      setCreateColor('#6B7280')
    }
  }, [createState.success])

  // Switch back to list on successful edit
  useEffect(() => {
    if (editState.success) {
      setMode('list')
      setEditingItem(null)
    }
  }, [editState.success])

  const handleEdit = (item: Label) => {
    setEditingItem(item)
    setEditColor(item.color)
    setMode('edit')
  }

  const handleDelete = (item: Label) => {
    if (!window.confirm('Eliminar esta etiqueta?')) return
    startTransition(() => {
      deleteLabel(item.id)
    })
  }

  const handleCancel = () => {
    setMode('list')
    setEditingItem(null)
    setCreateColor('#6B7280')
  }

  if (mode === 'create') {
    return (
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Nueva Etiqueta</h2>
        <form action={createAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              name="name"
              type="text"
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex items-center gap-3">
              <input
                name="color"
                type="color"
                defaultValue="#6B7280"
                onChange={(e) => setCreateColor(e.target.value)}
                className="h-9 w-16 border border-gray-300 rounded cursor-pointer p-0.5"
              />
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: createColor,
                  color: getContrastColor(createColor),
                }}
              >
                Vista previa
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={createPending}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createPending ? 'Creando...' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
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
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Editar Etiqueta</h2>
        <form key={editingItem.id} action={editAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              name="name"
              type="text"
              required
              defaultValue={editingItem.name}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
            <div className="flex items-center gap-3">
              <input
                name="color"
                type="color"
                defaultValue={editingItem.color}
                onChange={(e) => setEditColor(e.target.value)}
                className="h-9 w-16 border border-gray-300 rounded cursor-pointer p-0.5"
              />
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: editColor,
                  color: getContrastColor(editColor),
                }}
              >
                Vista previa
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={editPending}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editPending ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
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
          {initialLabels.length === 0
            ? 'No hay etiquetas aun.'
            : `${initialLabels.length} etiqueta${initialLabels.length !== 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => setMode('create')}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
        >
          Agregar nueva
        </button>
      </div>

      {initialLabels.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded">
          <p className="text-sm">Crea tu primera etiqueta para comenzar.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {initialLabels.map((item) => (
            <li
              key={item.id}
              className="border border-gray-200 rounded p-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{
                    backgroundColor: item.color,
                    color: getContrastColor(item.color),
                  }}
                >
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleEdit(item)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={isPending}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                  title="Eliminar"
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
