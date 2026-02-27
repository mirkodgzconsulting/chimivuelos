'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { uploadFileToR2, getFileUrl, type StorageType } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import { createClient } from "@/lib/supabase/server"
import { getActivePermissionDetails, consumeEditPermission } from "./manage-permissions"
import { recordAuditLog } from "@/lib/audit"

export async function getTranslations() {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
        .from('translations')
        .select(`
            *,
            origin_address,
            origin_address_client,
            destination_address,
            destination_address_client,
            profiles:client_id (
                first_name,
                last_name,
                email,
                phone
            )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching translations:', error)
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

export async function createTranslation(formData: FormData) {
    const supabase = supabaseAdmin
    const { data: { user } } = await createClient().then(c => c.auth.getUser())
    
    // 1. Core Data
    const client_id = formData.get('client_id') as string
    const tracking_code = formData.get('tracking_code') as string || `TRAD-${Date.now().toString().slice(-4)}`
    
    // 2. Types & Services
    const document_types = JSON.parse(formData.get('document_types') as string || '[]')
    const document_types_other = formData.get('document_types_other') as string
    const work_types = JSON.parse(formData.get('work_types') as string || '[]')
    const work_types_other = formData.get('work_types_other') as string
    const source_language = formData.get('source_language') as string
    const target_language = formData.get('target_language') as string
    const notes = formData.get('notes') as string
    const recipient_name = formData.get('recipient_name') as string
    const recipient_phone = formData.get('recipient_phone') as string
    
    const quantity = parseInt(formData.get('quantity') as string) || 1
    
    // 3. Addresses
    const origin_address = formData.get('origin_address') as string
    const origin_address_client = formData.get('origin_address_client') as string
    const destination_address = formData.get('destination_address') as string
    const destination_address_client = formData.get('destination_address_client') as string
    
    // 4. Economics
    const net_amount = parseFloat(formData.get('net_amount') as string) || 0
    const total_amount = parseFloat(formData.get('total_amount') as string) || 0
    const on_account = parseFloat(formData.get('on_account') as string) || 0
    
    // 5. Multi-Payments & Proofs
    const paymentDetailsRaw = formData.get('payment_details') as string
    const payment_details = paymentDetailsRaw ? JSON.parse(paymentDetailsRaw) : []

    for (let i = 0; i < payment_details.length; i++) {
        const file = formData.get(`payment_proof_${i}`) as File
        if (file && file.size > 0) {
            const path = `translations/payments/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            await uploadFileToR2(file, path)
            payment_details[i].proof_path = path
        }
    }

    const status = formData.get('status') as string || 'pending'

    // 6. File Upload Logic
    const documents = []
    let index = 0
    while (formData.has(`document_file_${index}`)) {
        const title = formData.get(`document_title_${index}`) as string
        const file = formData.get(`document_file_${index}`) as File
        
        if (file && file.size > 0) {
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const path = `translations/${client_id}/${Date.now()}_${safeName}`
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
        document_types,
        document_types_other,
        quantity,
        documents,
        work_types,
        work_types_other,
        source_language,
        target_language,
        notes,
        recipient_name,
        recipient_phone,
        origin_address,
        origin_address_client,
        destination_address,
        destination_address_client,
        net_amount,
        total_amount,
        on_account,
        balance: total_amount - on_account,
        payment_details,
        status
    }

    const { error } = await supabase
        .from('translations')
        .insert(insertData)

    if (error) {
        return { error: error.message }
    }

    // Record Audit Log
    if (user) {
        await recordAuditLog({
            actorId: user.id,
            action: 'create',
            resourceType: 'translations',
            resourceId: tracking_code || 'new',
            newValues: insertData as unknown as Record<string, unknown>,
            metadata: { 
                method: 'createTranslation',
                displayId: tracking_code || 'Traducción Nueva'
            }
        })
    }

    revalidatePath('/chimi-traducciones')
    return { success: true }
}

export async function updateTranslation(formData: FormData) {
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
            const permission = await getActivePermissionDetails('translations', id)
            if (!permission.hasPermission) {
                throw new Error('No tienes permiso para editar esta traducción. Debes solicitar autorización.')
            }
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
            await consumeEditPermission('translations', id)
        } else if (userRole === 'admin' || userRole === 'supervisor') {
            const permission = await getActivePermissionDetails('translations', id)
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
        }

        const { data: existing } = await adminSupabase
            .from('translations')
            .select('*')
            .eq('id', id)
            .single()

        if (!existing) throw new Error('Traducción no encontrada')

        // Process Data
        const document_types = JSON.parse(formData.get('document_types') as string || '[]')
        const document_types_other = formData.get('document_types_other') as string
        const work_types = JSON.parse(formData.get('work_types') as string || '[]')
        const work_types_other = formData.get('work_types_other') as string
        const source_language = formData.get('source_language') as string
        const target_language = formData.get('target_language') as string
        const notes = formData.get('notes') as string
        const recipient_name = formData.get('recipient_name') as string
        const recipient_phone = formData.get('recipient_phone') as string
        const quantity = parseInt(formData.get('quantity') as string) || 1
        
        const origin_address = formData.get('origin_address') as string
        const origin_address_client = formData.get('origin_address_client') as string
        const destination_address = formData.get('destination_address') as string
        const destination_address_client = formData.get('destination_address_client') as string
        
        const net_amount = parseFloat(formData.get('net_amount') as string) || 0
        const total_amount = parseFloat(formData.get('total_amount') as string) || 0
        const on_account = parseFloat(formData.get('on_account') as string) || 0
        const status = formData.get('status') as string

        const paymentDetailsRaw = formData.get('payment_details') as string
        const payment_details = paymentDetailsRaw ? JSON.parse(paymentDetailsRaw) : []

        for (let i = 0; i < payment_details.length; i++) {
            const file = formData.get(`payment_proof_${i}`) as File
            if (file && file.size > 0) {
                const path = `translations/payments/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
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
                const path = `translations/${existing.client_id}/${Date.now()}_${safeName}`
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
            document_types,
            document_types_other,
            work_types,
            work_types_other,
            source_language,
            target_language,
            notes,
            recipient_name,
            recipient_phone,
            quantity,
            documents: newDocuments,
            origin_address,
            origin_address_client,
            destination_address,
            destination_address_client,
            net_amount,
            total_amount,
            on_account,
            balance: total_amount - on_account,
            payment_details,
            status
        }

        const { error } = await adminSupabase
            .from('translations')
            .update(updateData)
            .eq('id', id)

        if (error) throw error

        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'translations',
            resourceId: existing.tracking_code || id,
            oldValues: existing,
            newValues: { ...existing, ...updateData },
            metadata: { 
                requestId: activeRequestId,
                reason: activeReason,
                displayId: existing.tracking_code || 'Traducción'
            }
        })

        revalidatePath('/chimi-traducciones')
        return { success: true }
    } catch (error) {
        console.error('Error updating translation:', error)
        return { error: (error as Error).message }
    }
}

export async function deleteTranslation(id: string) {
    const supabase = await createClient()
    const adminSupabase = supabaseAdmin
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin' && profile?.role !== 'supervisor') throw new Error('Se requieren permisos de administrador o supervisor')

        const { data: existing } = await adminSupabase.from('translations').select('*').eq('id', id).single()
        if (!existing) throw new Error('Traducción no encontrada')

        const { error } = await adminSupabase.from('translations').delete().eq('id', id)
        if (error) throw error

        await recordAuditLog({
            actorId: user.id,
            action: 'delete',
            resourceType: 'translations',
            resourceId: existing.tracking_code || id,
            oldValues: existing,
            metadata: { displayId: existing.tracking_code || 'Traducción' }
        })

        revalidatePath('/chimi-traducciones')
        return { success: true }
    } catch (error) {
        console.error('Error deleting translation:', error)
        return { error: (error as Error).message }
    }
}

export async function updateTranslationStatus(id: string, status: string) {
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
            const permission = await getActivePermissionDetails('translations', id)
            if (permission.hasPermission) {
                activeRequestId = permission.requestId as string
                activeReason = permission.reason as string
            } else {
                throw new Error('No tienes permiso para editar esta traducción. Debes solicitar autorización.')
            }
        } else if (userRole === 'admin' || userRole === 'supervisor') {
            const permission = await getActivePermissionDetails('translations', id)
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
        }

        const { data: existing } = await adminSupabase.from('translations').select('*').eq('id', id).single()
        if (!existing) throw new Error('Traducción no encontrada')

        const { error } = await adminSupabase
            .from('translations')
            .update({ status })
            .eq('id', id)

        if (error) throw error

        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'translations',
            resourceId: existing.tracking_code || id,
            oldValues: existing,
            newValues: { ...existing, status },
            metadata: { 
                method: 'updateTranslationStatus',
                action: 'status_update', 
                newStatus: status,
                displayId: existing.tracking_code || 'Traducción',
                requestId: activeRequestId,
                reason: activeReason
            }
        })

        revalidatePath('/chimi-traducciones')
        return { success: true }
    } catch (error) {
        console.error('Error updating status:', error)
        return { error: (error as Error).message }
    }
}

export async function deleteTranslationDocument(id: string, path: string) {
    const adminSupabase = supabaseAdmin
    try {
        const { data: existing } = await adminSupabase.from('translations').select('documents').eq('id', id).single()
        if (!existing) throw new Error('Traducción no encontrada')

        const newDocs = existing.documents.filter((d: any) => d.path !== path)

        const { error } = await adminSupabase
            .from('translations')
            .update({ documents: newDocs })
            .eq('id', id)

        if (error) throw error
        return { success: true }
    } catch (error) {
        console.error('Error deleting document:', error)
        return { error: (error as Error).message }
    }
}

export async function getTranslationDocumentUrl(path: string, storage: StorageType = 'r2') {
    return await getFileUrl(path, storage)
}

/**
 * Public Track Translation by Code
 */
export async function getTranslationByCode(code: string) {
    const supabase = supabaseAdmin
    
    // Clean code
    const cleanCode = code.trim().toUpperCase()

    const { data, error } = await supabase
        .from('translations')
        .select(`
            created_at,
            tracking_code,
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
        return { error: 'Trámite no encontrado' }
    }

    return {
        success: true,
        data: {
            created_at: data.created_at,
            code: data.tracking_code,
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
