'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: boolean; message: string }

export async function createLabel(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name = formData.get('name')
  const color = formData.get('color')

  if (
    typeof name !== 'string' || !name.trim() ||
    typeof color !== 'string' || !color.trim()
  ) {
    return { success: false, message: 'El nombre y el color son requeridos' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'No autorizado' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, message: 'Solo administradores' }
  }

  const { error } = await supabase
    .from('contact_labels')
    .insert({ name: name.trim(), color: color.trim() })

  if (error) {
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return { success: false, message: 'Ya existe una etiqueta con este nombre' }
    }
    return { success: false, message: `Error al crear: ${error.message}` }
  }

  revalidatePath('/admin/labels')
  return { success: true, message: 'Etiqueta creada' }
}

export async function updateLabel(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name = formData.get('name')
  const color = formData.get('color')

  if (
    typeof name !== 'string' || !name.trim() ||
    typeof color !== 'string' || !color.trim()
  ) {
    return { success: false, message: 'El nombre y el color son requeridos' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'No autorizado' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, message: 'Solo administradores' }
  }

  const { error } = await supabase
    .from('contact_labels')
    .update({
      name: name.trim(),
      color: color.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return { success: false, message: 'Ya existe una etiqueta con este nombre' }
    }
    return { success: false, message: `Error al actualizar: ${error.message}` }
  }

  revalidatePath('/admin/labels')
  return { success: true, message: 'Etiqueta actualizada' }
}

export async function deleteLabel(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'No autorizado' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { success: false, message: 'Solo administradores' }
  }

  const { error } = await supabase
    .from('contact_labels')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, message: `Error al eliminar: ${error.message}` }
  }

  revalidatePath('/admin/labels')
  return { success: true, message: 'Etiqueta eliminada' }
}
