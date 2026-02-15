'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { uploadImageToCloudflare } from '@/lib/storage'

export async function deleteAgent(userId: string) {
  try {
    // Delete from Auth (cascades to public.profiles usually if set up, 
    // but we can delete manually to be safe or just rely on cascade)
    // Supabase Auth delete cascades to objects owned by user if configured, 
    // but let's delete the user.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Error deleting user:', error)
      return { error: error.message }
    }

    revalidatePath('/agents')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { error: 'Error inesperado al eliminar el agente' }
  }
}

export async function updateAgent(formData: FormData) {
  const userId = formData.get('id') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const role = formData.get('role') as string
  const phone = formData.get('phone') as string
  const photoFile = formData.get('photo') as File

  if (!userId) {
    return { error: 'ID de usuario no encontrado' }
  }

  try {
    const updateData: any = {
      email,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role,
      },
      email_confirm: true
    }

    // Only update password if provided
    if (password && password.length > 0) {
      updateData.password = password
    }

    // 1. Update Auth User
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updateData
    )

    if (authError) {
      console.error('Error updating user auth:', authError)
      return { error: authError.message }
    }

    let avatarUrl = undefined

    // 2. Upload photo if exists (Cloudflare Images)
    if (photoFile && photoFile.size > 0) {
       try {
           const result = await uploadImageToCloudflare(photoFile);
           // Cloudflare Images returns variants. Use the first one or logic to pick.
           // result.variants is array of strings (URLs).
           if (result.variants && result.variants.length > 0) {
               avatarUrl = result.variants[0]; // Use the first variant as avatar
           }
       } catch (error) {
           console.error('Error uploading avatar to Cloudflare:', error);
           // Continue without updating avatar? Or fail?
           // Let's log and continue, keeping old avatar.
       }
    }

    // 3. Update public.profiles
    const profileUpdates: any = {
      first_name: firstName,
      last_name: lastName,
      role,
      phone,
      // email is often kept in sync
      email,
    }
    if (avatarUrl) {
      profileUpdates.avatar_url = avatarUrl
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating profile:', profileError)
      return { error: 'Error al actualizar el perfil' }
    }

    revalidatePath('/agents')
    return { success: true }

  } catch (error) {
    console.error('Unexpected error:', error)
    return { error: 'Error inesperado al actualizar el agente' }
  }
}
