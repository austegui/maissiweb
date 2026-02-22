'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: boolean; message: string }

export async function createCannedResponse(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const title = formData.get('title')
  const shortcut = formData.get('shortcut')
  const body = formData.get('body')

  if (
    typeof title !== 'string' || !title.trim() ||
    typeof shortcut !== 'string' || !shortcut.trim() ||
    typeof body !== 'string' || !body.trim()
  ) {
    return { success: false, message: 'Title, shortcut, and body are required' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('canned_responses')
    .insert({ title: title.trim(), shortcut: shortcut.trim(), body: body.trim() })

  if (error) {
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return { success: false, message: 'A canned response with this shortcut already exists' }
    }
    return { success: false, message: `Create failed: ${error.message}` }
  }

  revalidatePath('/admin/canned-responses')
  return { success: true, message: 'Canned response created successfully' }
}

export async function updateCannedResponse(
  id: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const title = formData.get('title')
  const shortcut = formData.get('shortcut')
  const body = formData.get('body')

  if (
    typeof title !== 'string' || !title.trim() ||
    typeof shortcut !== 'string' || !shortcut.trim() ||
    typeof body !== 'string' || !body.trim()
  ) {
    return { success: false, message: 'Title, shortcut, and body are required' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('canned_responses')
    .update({
      title: title.trim(),
      shortcut: shortcut.trim(),
      body: body.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    if (error.message.includes('duplicate key') || error.message.includes('unique')) {
      return { success: false, message: 'A canned response with this shortcut already exists' }
    }
    return { success: false, message: `Update failed: ${error.message}` }
  }

  revalidatePath('/admin/canned-responses')
  return { success: true, message: 'Canned response updated successfully' }
}

export async function deleteCannedResponse(id: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, message: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('canned_responses')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, message: `Delete failed: ${error.message}` }
  }

  revalidatePath('/admin/canned-responses')
  return { success: true, message: 'Canned response deleted' }
}
