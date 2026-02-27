'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { uploadImageToCloudflare } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

export async function createAgent(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const role = formData.get('role') as string
  const photoFile = formData.get('photo') as File
  const phone = formData.get('phone') as string

  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return { error: 'No autorizado' }

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', currentUser.id).single()
    if (profile?.role !== 'admin') return { error: 'Se requieren permisos de administrador' }
    // 1. Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role,
      },
    })

    if (authError) {
      console.error('Error creating user:', authError)
      return { error: authError.message }
    }

    const userId = authData.user.id
    let avatarUrl = null

    // 2. Upload photo if exists (Cloudflare Images)
    if (photoFile && photoFile.size > 0) {
      try {
           const result = await uploadImageToCloudflare(photoFile);
           if (result.variants && result.variants.length > 0) {
               avatarUrl = result.variants[0];
           }
       } catch (error) {
           console.error('Error uploading avatar to Cloudflare:', error);
       }
    }


    // 3. Insert into public.profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        role,
        phone,
        avatar_url: avatarUrl,
        active: true,
      })

    if (profileError) {
      // Cleanup: delete auth user if profile creation fails?
      // For now, just log and return error
      console.error('Error creating profile:', profileError)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return { error: 'Error al crear el perfil del usuario' }
    }

    revalidatePath('/agents')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { error: 'Error inesperado al crear el agente' }
  }
}
