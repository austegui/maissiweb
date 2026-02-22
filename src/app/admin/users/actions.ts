'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ActionResult = { success: boolean; message: string }

async function requireAdmin() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('No autorizado')
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    throw new Error('Solo administradores')
  }

  return { user, supabase }
}

export async function createMember(
  email: string,
  password: string,
  displayName: string,
  role: 'admin' | 'agent'
): Promise<ActionResult & { credentials?: { email: string; password: string } }> {
  try {
    const { user: adminUser } = await requireAdmin()

    if (!email || !email.trim()) {
      return { success: false, message: 'El email es requerido' }
    }
    if (!password || password.length < 6) {
      return { success: false, message: 'La contrasena debe tener al menos 6 caracteres' }
    }
    if (!displayName || !displayName.trim()) {
      return { success: false, message: 'El nombre es requerido' }
    }

    void adminUser // used to confirm admin auth

    const adminClient = createAdminClient()

    const { data, error } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName.trim() },
    })

    if (error) {
      if (
        error.message.toLowerCase().includes('already been registered') ||
        error.message.toLowerCase().includes('already exists') ||
        error.message.toLowerCase().includes('already registered')
      ) {
        return { success: false, message: 'Ya existe un usuario con este email' }
      }
      return { success: false, message: `Error al crear usuario: ${error.message}` }
    }

    if (!data.user) {
      return { success: false, message: 'Error al crear usuario: respuesta inesperada' }
    }

    // Upsert user_profiles to handle trigger race condition
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .upsert(
        { id: data.user.id, display_name: displayName.trim(), role },
        { onConflict: 'id' }
      )

    if (profileError) {
      // Non-fatal -- profile trigger may have already created the row
      console.error('Profile upsert error (non-fatal):', profileError.message)
    }

    revalidatePath('/admin/users')
    return {
      success: true,
      message: 'Miembro creado exitosamente',
      credentials: { email: email.trim(), password },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { success: false, message }
  }
}

export async function updateMemberRole(
  targetUserId: string,
  newRole: 'admin' | 'agent'
): Promise<ActionResult> {
  try {
    const { user: adminUser } = await requireAdmin()

    if (adminUser.id === targetUserId) {
      return { success: false, message: 'No puedes cambiar tu propio rol' }
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', targetUserId)

    if (error) {
      return { success: false, message: `Error al actualizar rol: ${error.message}` }
    }

    revalidatePath('/admin/users')
    return { success: true, message: 'Rol actualizado' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { success: false, message }
  }
}

export async function deactivateMember(targetUserId: string): Promise<ActionResult> {
  try {
    const { user: adminUser } = await requireAdmin()

    if (adminUser.id === targetUserId) {
      return { success: false, message: 'No puedes desactivarte a ti mismo' }
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: '876000h',
    })

    if (error) {
      return { success: false, message: `Error al desactivar: ${error.message}` }
    }

    revalidatePath('/admin/users')
    return { success: true, message: 'Miembro desactivado' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { success: false, message }
  }
}

export async function reactivateMember(targetUserId: string): Promise<ActionResult> {
  try {
    await requireAdmin()

    const adminClient = createAdminClient()

    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: 'none',
    })

    if (error) {
      return { success: false, message: `Error al reactivar: ${error.message}` }
    }

    revalidatePath('/admin/users')
    return { success: true, message: 'Miembro reactivado' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { success: false, message }
  }
}
