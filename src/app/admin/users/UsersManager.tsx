'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  createMember,
  updateMemberRole,
  deactivateMember,
  reactivateMember,
} from './actions'
import type { MemberUser } from './page'

interface UsersManagerProps {
  users: MemberUser[]
  currentUserId: string
}

interface Credentials {
  email: string
  password: string
}

export function UsersManager({ users, currentUserId }: UsersManagerProps) {
  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formRole, setFormRole] = useState<'admin' | 'agent'>('agent')
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Credentials dialog state
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [copied, setCopied] = useState(false)

  // Row-level action loading state (keyed by userId)
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({})

  function setUserLoading(userId: string, loading: boolean) {
    setRowLoading((prev) => ({ ...prev, [userId]: loading }))
  }

  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormLoading(true)

    const result = await createMember(formEmail, formPassword, formDisplayName, formRole)

    setFormLoading(false)

    if (!result.success) {
      setFormError(result.message)
      return
    }

    if (result.credentials) {
      setCredentials(result.credentials)
    }

    // Reset form
    setFormEmail('')
    setFormPassword('')
    setFormDisplayName('')
    setFormRole('agent')
    setShowForm(false)
  }

  async function handleRoleChange(userId: string, newRole: 'admin' | 'agent') {
    setUserLoading(userId, true)
    await updateMemberRole(userId, newRole)
    setUserLoading(userId, false)
  }

  async function handleDeactivate(userId: string, email: string) {
    if (!window.confirm(`Desactivar a ${email}?`)) return
    setUserLoading(userId, true)
    await deactivateMember(userId)
    setUserLoading(userId, false)
  }

  async function handleReactivate(userId: string) {
    setUserLoading(userId, true)
    await reactivateMember(userId)
    setUserLoading(userId, false)
  }

  async function handleCopyCredentials() {
    if (!credentials) return
    await navigator.clipboard.writeText(
      `Email: ${credentials.email}\nPassword: ${credentials.password}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleCloseDialog() {
    setCredentials(null)
    setCopied(false)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Gestion de miembros</h1>
          <Link
            href="/admin/settings"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            &larr; Volver a ajustes
          </Link>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
          className="px-4 py-2 rounded text-sm font-medium text-white"
          style={{ backgroundColor: '#00a884' }}
        >
          {showForm ? 'Cancelar' : 'Crear miembro'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreateMember}
          className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Contrasena (min. 6 caracteres)
              </label>
              <input
                type="text"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required
                minLength={6}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="Contrasena"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nombre a mostrar
              </label>
              <input
                type="text"
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="Juan Perez"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rol
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as 'admin' | 'agent')}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884] bg-white"
              >
                <option value="agent">Agente</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}

          <button
            type="submit"
            disabled={formLoading}
            className="px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: '#00a884' }}
          >
            {formLoading ? 'Creando...' : 'Crear'}
          </button>
        </form>
      )}

      {/* Credentials dialog */}
      {credentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-semibold mb-3">Miembro creado</h2>
            <p className="text-sm text-gray-600 mb-4">
              Comparte estas credenciales con el nuevo miembro de forma segura.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm font-mono mb-4 space-y-1">
              <div>Email: {credentials.email}</div>
              <div>Password: {credentials.password}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyCredentials}
                className="flex-1 px-3 py-2 rounded text-sm font-medium text-white"
                style={{ backgroundColor: '#00a884' }}
              >
                {copied ? 'Copiado!' : 'Copiar credenciales'}
              </button>
              <button
                onClick={handleCloseDialog}
                className="flex-1 px-3 py-2 rounded text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-2 px-3 font-medium text-gray-600">Nombre</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Email</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Rol</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Estado</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Ultimo acceso</th>
              <th className="text-left py-2 px-3 font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              const isLoading = rowLoading[user.id] ?? false

              return (
                <tr
                  key={user.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {/* Name */}
                  <td className="py-2 px-3 font-medium text-gray-900">
                    {user.displayName}
                    {isSelf && (
                      <span className="ml-2 text-xs text-gray-400">(tu)</span>
                    )}
                  </td>

                  {/* Email */}
                  <td className="py-2 px-3 text-gray-600">{user.email}</td>

                  {/* Role */}
                  <td className="py-2 px-3">
                    {isSelf ? (
                      <RoleBadge role={user.role} />
                    ) : (
                      <select
                        value={user.role}
                        disabled={isLoading}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value as 'admin' | 'agent')
                        }
                        className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#00a884] disabled:opacity-50"
                      >
                        <option value="admin">Admin</option>
                        <option value="agent">Agente</option>
                      </select>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-2 px-3">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          user.isActive ? 'bg-green-500' : 'bg-red-400'
                        }`}
                      />
                      <span className={user.isActive ? 'text-green-700' : 'text-red-600'}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </span>
                  </td>

                  {/* Last login */}
                  <td className="py-2 px-3 text-gray-500">
                    {user.lastSignInAt
                      ? new Date(user.lastSignInAt).toLocaleDateString('es', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '--'}
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-3">
                    {!isSelf && (
                      <div className="flex gap-2">
                        {user.isActive ? (
                          <button
                            onClick={() => handleDeactivate(user.id, user.email)}
                            disabled={isLoading}
                            className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            {isLoading ? '...' : 'Desactivar'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(user.id)}
                            disabled={isLoading}
                            className="text-xs px-2 py-1 rounded border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
                          >
                            {isLoading ? '...' : 'Reactivar'}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            No hay miembros registrados.
          </div>
        )}
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: 'admin' | 'agent' }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
        Admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-700">
      Agente
    </span>
  )
}
