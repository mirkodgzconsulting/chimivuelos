'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { uploadClientFile, deleteClientFileUniversal, getFileUrl, StorageType } from '@/lib/storage'

export interface ClientFileData {
  path: string
  name: string
  type: string
  size: number
  storage?: StorageType // 'r2' | 'images'
  uploaded_at?: string
}

// ---- HELPER: Get Signed URL ----
export async function getSignedDownloadUrl(path: string, storage: StorageType = 'r2') {
    return await getFileUrl(path, storage);
}

// ---- CREATE CLIENT ----
export async function createClient(formData: FormData) {
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const phone = formData.get('phone') as string
  const documentType = formData.get('document_type') as string
  const documentNumber = formData.get('document_number') as string
  const role = 'client'
  
  const files = formData.getAll('documents') as File[]

  if (files.length > 5) {
    return { error: 'Máximo 5 archivos permitidos.' }
  }

  try {
    // 1. Create user in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: role,
      },
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return { error: authError.message }
    }

    const userId = authData.user.id
    const uploadedFiles: ClientFileData[] = []

    // 2. Upload Documents (Hybrid R2/Images)
    if (files.length > 0) {
      for (const file of files) {
        if (file.size > 0) {
          try {
             // Smart upload: Images -> Cloudflare Images, Docs -> R2
             const result = await uploadClientFile(file, userId)
             
             uploadedFiles.push({
                path: result.path,
                name: file.name,
                type: file.type,
                size: file.size,
                storage: result.storage,
                uploaded_at: new Date().toISOString()
             })
          } catch (err) {
              console.error(`Error uploading file ${file.name}:`, err)
          }
        }
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
        document_type: documentType,
        document_number: documentNumber,
        client_files: uploadedFiles,
        raw_password: password,
        active: true,
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return { error: 'Error al crear el perfil del cliente.' }
    }

    revalidatePath('/clients')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error creating client:', error)
    return { error: 'Error inesperado al crear el cliente.' }
  }
}

// ---- UPDATE CLIENT ----
export async function updateClient(formData: FormData) {
  const userId = formData.get('id') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const phone = formData.get('phone') as string
  const documentType = formData.get('document_type') as string
  const documentNumber = formData.get('document_number') as string
  
  const newFiles = formData.getAll('documents') as File[]

  if (!userId) {
    return { error: 'ID de usuario no encontrado' }
  }

  try {
    const updateData: {
      email: string;
      user_metadata: { first_name: string; last_name: string };
      email_confirm: boolean;
      password?: string;
    } = {
      email,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
      email_confirm: true
    }
    if (password && password.length > 0) {
      updateData.password = password
    }

    // 1. Update Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updateData
    )

    if (authError) {
      return { error: authError.message }
    }

    // 2. Fetch existing files
    const { data: currentProfile, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('client_files')
        .eq('id', userId)
        .single()
    
    if (fetchError) {
      return { error: 'Error obteniendo datos del cliente.' }
    }

    const existingFiles: ClientFileData[] = (currentProfile.client_files as unknown as ClientFileData[]) || []
    
    if (existingFiles.length + newFiles.length > 5) {
        return { error: `Límite excedido. Máximo 5 archivos.` }
    }

    // Upload new files
    const uploadErrors: string[] = [];
    if (newFiles.length > 0) {
      for (const file of newFiles) {
        if (file.size > 0) {
           try {
               const result = await uploadClientFile(file, userId)
               existingFiles.push({
                   path: result.path,
                   name: file.name,
                   type: file.type,
                   size: file.size,
                   storage: result.storage,
                   uploaded_at: new Date().toISOString()
               })
           } catch (err: unknown) {
               console.error("Error uploading file:", err)
               const msg = err instanceof Error ? err.message : 'Error desconocido'
               uploadErrors.push(`Error subiendo ${file.name}: ${msg}`);
           }
        }
      }
    }

    // 3. Update Profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        email,
        document_type: documentType,
        document_number: documentNumber,
        client_files: existingFiles,
        ...(password ? { raw_password: password } : {})
      })
      .eq('id', userId)

    if (profileError) {
      return { error: 'Error al actualizar el perfil.' }
    }

    revalidatePath('/clients')

    if (uploadErrors.length > 0) {
        // We return success: false conceptually for the UI to show an alert, or we can handle it.
        // But the profile update was successful. Let's return a specific warning if possible or just plain success with console log?
        // Let's return error so user knows something happened.
        return { error: `Datos actualizados, pero hubo error subiendo archivos: ${uploadErrors.join(', ')}` }
    }
    return { success: true }

  } catch (error) {
    console.error('Unexpected error updating client:', error)
    return { error: 'Error inesperado al actualizar el cliente.' }
  }
}

// ---- DELETE CLIENT ----
export async function deleteClient(userId: string) {
  try {
    // 1. Delete files
    const { data: currentProfile } = await supabaseAdmin
        .from('profiles')
        .select('client_files')
        .eq('id', userId)
        .single()
    
    if (currentProfile?.client_files) {
         const files = currentProfile.client_files as ClientFileData[]
         await Promise.all(files.map(async (f) => {
             // Default to 'r2' if storage not set (legacy files)
             // However, legacy files might be Supabase paths? 
             // If path doesn't look like R2/Image, deleteUniversal might fail gracefully.
             if (f.path) await deleteClientFileUniversal(f.path, f.storage || 'r2')
         }))
    }

    // 2. Delete User
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath('/clients')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error deleting client:', error)
    return { error: 'Error inesperado al eliminar el cliente.' }
  }
}

// ---- DELETE SINGLE FILE ----
export async function deleteClientFile(userId: string, filePath: string) {
    try {
        // 1. Get file metadata first to know Storage Type
         const { data: currentProfile, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('client_files')
            .eq('id', userId)
            .single()
        
        if (fetchError || !currentProfile) return { error: 'Perfil no encontrado' }
        const files: ClientFileData[] = (currentProfile.client_files as unknown as ClientFileData[]) || []
        
        const fileToDelete = files.find(f => f.path === filePath)
        if (!fileToDelete) return { error: 'Archivo no encontrado' }

        // 2. Remove from Storage (R2 or Images)
        await deleteClientFileUniversal(filePath, fileToDelete.storage || 'r2')

        // 3. Update Profile metadata
        const updatedFiles = files.filter(f => f.path !== filePath)

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ client_files: updatedFiles })
            .eq('id', userId)
        
        if (updateError) return { error: 'Error al actualizar metadata del archivo' }

        revalidatePath('/clients')
        return { success: true }

    } catch {
        return { error: 'Error inesperado' }
    }
}

