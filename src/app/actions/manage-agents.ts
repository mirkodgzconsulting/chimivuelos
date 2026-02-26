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
    const updateData: {
        email: string;
        user_metadata: { first_name: string; last_name: string; role: string };
        email_confirm: boolean;
        password?: string;
    } = {
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
    const profileUpdates: {
        first_name: string;
        last_name: string;
        role: string;
        phone: string;
        email: string;
        avatar_url?: string;
    } = {
        first_name: firstName,
        last_name: lastName,
        role,
        phone,
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

interface ProfileJoin {
    first_name: string | null;
    last_name: string | null;
}

// ---- GET FULL AGENT DETAILS (Including Sales History) ----
export async function getAgentFullDetails(agentId: string) {
    try {
        // 1. Fetch Profile
        const profilePromise = supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', agentId)
            .single()

        // 2. Fetch History in Parallel (Consolidate all services sold by this agent)
        const flightsPromise = supabaseAdmin.from('flights').select('*, profiles!client_id(first_name, last_name)').eq('agent_id', agentId).order('created_at', { ascending: false })
        const transfersPromise = supabaseAdmin.from('money_transfers').select('*, profiles!client_id(first_name, last_name)').eq('agent_id', agentId).order('created_at', { ascending: false })
        const parcelsPromise = supabaseAdmin.from('parcels').select('*, profiles!sender_id(first_name, last_name)').eq('agent_id', agentId).order('created_at', { ascending: false })
        const translationsPromise = supabaseAdmin.from('translations').select('*, profiles!client_id(first_name, last_name)').eq('agent_id', agentId).order('created_at', { ascending: false })
        const otherServicesPromise = supabaseAdmin.from('other_services').select('*, profiles!client_id(first_name, last_name)').eq('agent_id', agentId).order('created_at', { ascending: false })

        const [
            { data: profile, error: profileError },
            { data: flights },
            { data: transfers },
            { data: parcels },
            { data: translations },
            { data: otherServices }
        ] = await Promise.all([
            profilePromise,
            flightsPromise,
            transfersPromise,
            parcelsPromise,
            translationsPromise,
            otherServicesPromise
        ])

        if (profileError || !profile) {
            return { error: 'Agente no encontrado' }
        }

        // 3. Consolidate and normalize history items
        const history = [
            ...(flights || []).map(f => {
                const p = f.profiles as unknown as ProfileJoin | ProfileJoin[] | null
                const client = Array.isArray(p) ? p[0] : p
                const name = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'N/A'
                return { 
                    ...f, 
                    type: 'Vuelo', 
                    date: f.created_at,
                    amount: f.amountEur || 0,
                    reference: f.pnr || 'N/A',
                    clientName: name || 'N/A',
                    description: f.itinerary || 'Sin detalle'
                }
            }),
            ...(transfers || []).map(t => {
                const p = t.profiles as unknown as ProfileJoin | ProfileJoin[] | null
                const client = Array.isArray(p) ? p[0] : p
                const name = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'N/A'
                return { 
                    ...t, 
                    type: 'Giro', 
                    date: t.created_at,
                    amount: t.total_amount || 0,
                    reference: t.operation_number || t.transfer_code || 'N/A',
                    clientName: name || 'N/A',
                    description: `${t.transfer_mode === 'eur_to_pen' ? 'EUR → PEN' : t.transfer_mode === 'pen_to_eur' ? 'PEN → EUR' : 'EUR → EUR'}`
                }
            }),
            ...(parcels || []).map(p => {
                const prof = p.profiles as unknown as ProfileJoin | ProfileJoin[] | null
                const client = Array.isArray(prof) ? prof[0] : prof
                const name = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'N/A'
                return { 
                    ...p, 
                    type: 'Encomienda', 
                    date: p.created_at,
                    amount: p.shipping_cost || 0,
                    reference: p.tracking_code || 'N/A',
                    clientName: name || 'N/A',
                    description: `${p.recipient_name} (${p.package_description || 'Paquete'})`
                }
            }),
            ...(translations || []).map(tr => {
                const p = tr.profiles as unknown as ProfileJoin | ProfileJoin[] | null
                const client = Array.isArray(p) ? p[0] : p
                const name = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'N/A'
                return { 
                    ...tr, 
                    type: 'Traducción', 
                    date: tr.created_at,
                    amount: tr.total_amount || 0,
                    reference: tr.tracking_code || 'N/A',
                    clientName: name || 'N/A',
                    description: `${tr.source_language} → ${tr.target_language}`
                }
            }),
            ...(otherServices || []).map(o => {
                const p = o.profiles as unknown as ProfileJoin | ProfileJoin[] | null
                const client = Array.isArray(p) ? p[0] : p
                const name = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'N/A'
                return { 
                    ...o, 
                    type: 'Otros', 
                    date: o.created_at,
                    amount: o.total_amount || 0,
                    reference: 'N/A',
                    clientName: name || 'N/A',
                    description: o.service_type || 'Servicio registrado'
                }
            })
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        return {
            success: true,
            profile,
            history
        }

    } catch (error) {
        console.error('Error fetching full agent details:', error)
        return { error: 'Error al obtener los detalles del agente' }
    }
}
