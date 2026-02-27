'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { uploadFileToR2, getFileUrl, type StorageType } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import { createClient } from "@/lib/supabase/server"
import { getActivePermissionDetails, consumeEditPermission } from "./manage-permissions"
import { recordAuditLog } from "@/lib/audit"

export async function getOtherServices() {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
        .from('other_services')
        .select(`
            *,
            profiles:client_id (
                first_name,
                last_name,
                email,
                phone
            ),
            origin_address_client,
            destination_address_client
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching other services:', error)
        return []
    }

    if (data && data.length > 0) {
        const agentIds = [...new Set(data.map(d => d.agent_id).filter(Boolean))] as string[];
        if (agentIds.length > 0) {
            const { data: agents } = await supabase.from('profiles').select('id, first_name, last_name').in('id', agentIds);
            if (agents) {
                const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));
                data.forEach(d => {
                    if (d.agent_id && agentMap[d.agent_id]) {
                        d.agent = agentMap[d.agent_id];
                    }
                })
            }
        }
    }

    return data
}

export async function createOtherService(formData: FormData) {
    const supabase = supabaseAdmin
    const { data: { user } } = await createClient().then(c => c.auth.getUser())
    
    // 1. Core Data
    const client_id = formData.get('client_id') as string
    const tracking_code = formData.get('tracking_code') as string || `SERV-${Date.now().toString().slice(-4)}`
    
    // 2. Service Details
    const service_type = formData.get('service_type') as string
    const service_type_other = formData.get('service_type_other') as string
    const note = formData.get('note') as string
    
    // 2.5 Logistics & Recipient
    const recipient_name = formData.get('recipient_name') as string
    const recipient_phone = formData.get('recipient_phone') as string
    const origin_address = formData.get('origin_address') as string
    const origin_address_client = formData.get('origin_address_client') as string
    const destination_address = formData.get('destination_address') as string
    const destination_address_client = formData.get('destination_address_client') as string
    
    // 3. Economics
    const total_amount = parseFloat(formData.get('total_amount') as string) || 0
    const on_account = parseFloat(formData.get('on_account') as string) || 0
    
    // 4. Multi-Payments & Proofs
    const paymentDetailsRaw = formData.get('payment_details') as string
    const payment_details = paymentDetailsRaw ? JSON.parse(paymentDetailsRaw) : []

    for (let i = 0; i < payment_details.length; i++) {
        const file = formData.get(`payment_proof_${i}`) as File
        if (file && file.size > 0) {
            const path = `other-services/payments/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            await uploadFileToR2(file, path)
            payment_details[i].proof_path = path
        }
    }

    const status = formData.get('status') as string || 'pending'

    // 5. File Upload Logic
    const documents = []
    let index = 0
    while (formData.has(`document_file_${index}`)) {
        const title = formData.get(`document_title_${index}`) as string
        const file = formData.get(`document_file_${index}`) as File
        
        if (file && file.size > 0) {
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const path = `other-services/${client_id}/${Date.now()}_${safeName}`
            await uploadFileToR2(file, path)
            
            documents.push({
                title: title || file.name,
                path: path,
                name: file.name,
                size: file.size,
                type: file.type,
                storage: 'r2',
                uploaded_at: new Date().toISOString()
            })
        }
        index++
    }

    const insertData = {
        client_id,
        tracking_code,
        agent_id: user?.id,
        service_type,
        service_type_other,
        note,
        recipient_name,
        recipient_phone,
        origin_address,
        origin_address_client,
        destination_address,
        destination_address_client,
        documents,
        total_amount,
        on_account,
        balance: total_amount - on_account,
        payment_details,
        status
    }

    const { error } = await supabase
        .from('other_services')
        .insert(insertData)

    if (error) {
        return { error: error.message }
    }

    // Record Audit Log
    if (user) {
        await recordAuditLog({
            actorId: user.id,
            action: 'create',
            resourceType: 'other_services',
            resourceId: tracking_code || 'new',
            newValues: insertData as unknown as Record<string, unknown>,
            metadata: { 
                method: 'createOtherService',
                displayId: tracking_code || 'Servicio Nuevo'
            }
        })
    }

    revalidatePath('/chimi-otros-servicios')
    return { success: true }
}

export async function updateOtherService(formData: FormData) {
    const supabase = await createClient()
    const adminSupabase = supabaseAdmin
    const id = formData.get('id') as string

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
        const userRole = profile?.role || 'client'

        let activeRequestId = 'admin_direct';
        let activeReason = 'Edición Directa';

        if (userRole === 'agent' || userRole === 'usuario') {
            const permission = await getActivePermissionDetails('other_services', id)
            if (!permission.hasPermission) {
                throw new Error('No tienes permiso para editar este servicio. Debes solicitar autorización.')
            }
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
            await consumeEditPermission('other_services', id)
        } else if (userRole === 'admin' || userRole === 'supervisor') {
            const permission = await getActivePermissionDetails('other_services', id)
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
        }

        const { data: existing } = await adminSupabase
            .from('other_services')
            .select('*')
            .eq('id', id)
            .single()

        if (!existing) throw new Error('Servicio no encontrado')

        // Process Data
        const service_type = formData.get('service_type') as string
        const service_type_other = formData.get('service_type_other') as string
        const note = formData.get('note') as string
        
        const recipient_name = formData.get('recipient_name') as string
        const recipient_phone = formData.get('recipient_phone') as string
        const origin_address = formData.get('origin_address') as string
        const origin_address_client = formData.get('origin_address_client') as string
        const destination_address = formData.get('destination_address') as string
        const destination_address_client = formData.get('destination_address_client') as string
        
        const total_amount = parseFloat(formData.get('total_amount') as string) || 0
        const on_account = parseFloat(formData.get('on_account') as string) || 0
        const status = formData.get('status') as string

        const paymentDetailsRaw = formData.get('payment_details') as string
        const payment_details = paymentDetailsRaw ? JSON.parse(paymentDetailsRaw) : []

        for (let i = 0; i < payment_details.length; i++) {
            const file = formData.get(`payment_proof_${i}`) as File
            if (file && file.size > 0) {
                const path = `other-services/payments/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                await uploadFileToR2(file, path)
                payment_details[i].proof_path = path
            }
        }

        // Handle new documents
        const newDocuments = [...(existing.documents || [])]
        let index = 0
        while (formData.has(`document_file_${index}`)) {
            const title = formData.get(`document_title_${index}`) as string
            const file = formData.get(`document_file_${index}`) as File
            
            if (file && file.size > 0) {
                const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
                const path = `other-services/${existing.client_id}/${Date.now()}_${safeName}`
                await uploadFileToR2(file, path)
                
                newDocuments.push({
                    title: title || file.name,
                    path: path,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    storage: 'r2',
                    uploaded_at: new Date().toISOString()
                })
            }
            index++
        }

        const updateData = {
            service_type,
            service_type_other,
            note,
            recipient_name,
            recipient_phone,
            origin_address,
            origin_address_client,
            destination_address,
            destination_address_client,
            documents: newDocuments,
            total_amount,
            on_account,
            balance: total_amount - on_account,
            payment_details,
            status
        }

        const { error } = await adminSupabase
            .from('other_services')
            .update(updateData)
            .eq('id', id)

        if (error) throw error

        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'other_services',
            resourceId: existing.tracking_code || id,
            oldValues: existing,
            newValues: { ...existing, ...updateData },
            metadata: { 
                requestId: activeRequestId,
                reason: activeReason,
                displayId: existing.tracking_code || 'Servicio'
            }
        })

        revalidatePath('/chimi-otros-servicios')
        return { success: true }
    } catch (error) {
        console.error('Error updating other service:', error)
        return { error: (error as Error).message }
    }
}

export async function deleteOtherService(id: string) {
    const supabase = await createClient()
    const adminSupabase = supabaseAdmin
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin' && profile?.role !== 'supervisor') throw new Error('Se requieren permisos de administrador o supervisor')

        const { data: existing } = await adminSupabase.from('other_services').select('*').eq('id', id).single()
        if (!existing) throw new Error('Servicio no encontrado')

        const { error } = await adminSupabase.from('other_services').delete().eq('id', id)
        if (error) throw error

        await recordAuditLog({
            actorId: user.id,
            action: 'delete',
            resourceType: 'other_services',
            resourceId: existing.tracking_code || id,
            oldValues: existing,
            metadata: { displayId: existing.tracking_code || 'Servicio' }
        })

        revalidatePath('/chimi-otros-servicios')
        return { success: true }
    } catch (error) {
        console.error('Error deleting other service:', error)
        return { error: (error as Error).message }
    }
}

export async function updateOtherServiceStatus(id: string, status: string) {
    const supabase = await createClient()
    const adminSupabase = supabaseAdmin
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
        const userRole = profile?.role || 'client'

        let activeRequestId = 'admin_direct';
        let activeReason = 'Actualización de Estado Rápida';

        if (userRole === 'agent' || userRole === 'usuario') {
            const permission = await getActivePermissionDetails('other_services', id)
            if (permission.hasPermission) {
                activeRequestId = permission.requestId as string
                activeReason = permission.reason as string
            } else {
                throw new Error('No tienes permiso para editar este servicio. Debes solicitar autorización.')
            }
        } else if (userRole === 'admin' || userRole === 'supervisor') {
            const permission = await getActivePermissionDetails('other_services', id)
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
        }

        const { data: existing } = await adminSupabase.from('other_services').select('*').eq('id', id).single()
        if (!existing) throw new Error('Servicio no encontrado')

        const { error } = await adminSupabase
            .from('other_services')
            .update({ status })
            .eq('id', id)

        if (error) throw error

        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'other_services',
            resourceId: existing.tracking_code || id,
            oldValues: existing,
            newValues: { ...existing, status },
            metadata: { 
                method: 'updateOtherServiceStatus',
                action: 'status_update', 
                newStatus: status,
                displayId: existing.tracking_code || 'Servicio',
                requestId: activeRequestId,
                reason: activeReason
            }
        })

        revalidatePath('/chimi-otros-servicios')
        return { success: true }
    } catch (error) {
        console.error('Error updating status:', error)
        return { error: (error as Error).message }
    }
}

export async function deleteOtherServiceDocument(id: string, path: string) {
    const adminSupabase = supabaseAdmin
    try {
        const { data: existing } = await adminSupabase.from('other_services').select('documents').eq('id', id).single()
        if (!existing) throw new Error('Servicio no encontrado')

        const newDocs = existing.documents.filter((d: { path: string }) => d.path !== path)

        const { error } = await adminSupabase
            .from('other_services')
            .update({ documents: newDocs })
            .eq('id', id)

        if (error) throw error
        return { success: true }
    } catch (error) {
        console.error('Error deleting document:', error)
        return { error: (error as Error).message }
    }
}

export async function getOtherServiceDocumentUrl(path: string, storage: StorageType = 'r2') {
    return await getFileUrl(path, storage)
}

/**
 * Public Track Other Service by Code
 */
export async function getOtherServiceByCode(code: string) {
    const supabase = supabaseAdmin
    
    // Clean code
    const cleanCode = code.trim().toUpperCase()

    const { data, error } = await supabase
        .from('other_services')
        .select(`
            created_at,
            tracking_code,
            service_type,
            service_type_other,
            total_amount,
            on_account,
            balance,
            status,
            profiles:client_id (
                first_name,
                last_name
            )
        `)
        .ilike('tracking_code', cleanCode)
        .single()
    
    if (error || !data) {
        return { error: 'Servicio no encontrado' }
    }

    return {
        success: true,
        data: {
            created_at: data.created_at,
            code: data.tracking_code,
            service_type: data.service_type === "Otros servicios" ? data.service_type_other : data.service_type,
            total_amount: data.total_amount,
            on_account: data.on_account,
            balance: data.balance,
            status: data.status,
            sender_name: maskName(getSenderName(data.profiles))
        }
    }
}

function maskName(name: string) {
    if (!name) return '***'
    const parts = name.split(' ')
    return parts.map((part, index) => {
        if (index === 0) return part // Show first name
        return part.charAt(0) + '***' // Mask others
    }).join(' ')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSenderName(profiles: any) {
    if (!profiles) return '***'
    const p = profiles as any
    if (Array.isArray(p)) {
        const profile = p[0]
        return profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '***'
    } else {
        return `${p.first_name || ''} ${p.last_name || ''}`.trim() || '***'
    }
}
