'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { uploadFileToR2, getFileUrl, type StorageType } from '@/lib/storage'
import { revalidatePath } from 'next/cache'
import { createClient } from "@/lib/supabase/server"
import { getActivePermissionDetails, consumeEditPermission } from "./manage-permissions"
import { recordAuditLog } from "@/lib/audit"

export async function getParcels() {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
        .from('parcels')
        .select(`
            *,
            origin_address,
            destination_address,
            payment_details,
            profiles:sender_id (
                first_name,
                last_name,
                email,
                phone
            )
        `)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching parcels:', error)
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

export async function createParcel(formData: FormData) {
    const supabase = supabaseAdmin
    
    // 1. Core Data
    const sender_id = formData.get('sender_id') as string
    const recipient_name = formData.get('recipient_name') as string
    const recipient_phone = formData.get('recipient_phone') as string
    const recipient_address = formData.get('recipient_address') as string
    const origin_address = formData.get('origin_address') as string
    const destination_address = formData.get('destination_address') as string
    
    // 2. Package Details (Simplified)
    const package_type = formData.get('package_type') as string
    const package_weight = formData.get('package_weight') as string
    const package_description = formData.get('package_description') as string
    
    // 3. Economics (Simplified)
    const shipping_cost = parseFloat(formData.get('shipping_cost') as string) || 0
    const on_account = parseFloat(formData.get('on_account') as string) || 0
    // Balance is auto-generated but we calculate client-side too
    
    // 3. Multi-Payments & Proofs
    const paymentDetailsRaw = formData.get('payment_details') as string
    const payment_details = paymentDetailsRaw ? JSON.parse(paymentDetailsRaw) : []

    for (let i = 0; i < payment_details.length; i++) {
        const file = formData.get(`payment_proof_${i}`) as File
        if (file && file.size > 0) {
            const path = `parcels/payments/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            await uploadFileToR2(file, path)
            payment_details[i].proof_path = path
        }
    }

    const status = formData.get('status') as string || 'pending'
    
    // Generate Tracking Code (Simple)
    const tracking_code = formData.get('tracking_code') as string || `ENC-${Date.now().toString().slice(-4)}`

    // 4. File Upload Logic
    const documents = []
    let index = 0
    while (formData.has(`document_title_${index}`)) {
        const title = formData.get(`document_title_${index}`) as string
        const file = formData.get(`document_file_${index}`) as File
        
        if (file && file.size > 0) {
            // Upload to 'parcels' folder in bucket manually
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const path = `parcels/${sender_id}/${Date.now()}_${safeName}`
            
            // We use the raw R2 uploader now to control the path fully
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
        sender_id,
        recipient_name,
        recipient_phone,
        recipient_address,
        origin_address,
        destination_address,
        package_type,
        package_weight,
        package_description,
        shipping_cost,
        on_account,
        status,
        tracking_code,
        documents,
        payment_details
    }

    const { error } = await supabase
        .from('parcels')
        .insert(insertData)

    if (error) {
        return { error: error.message }
    }

    // Record Audit Log (Need to get user first, usually parcels has it)
    const { data: { user } } = await createClient().then(c => c.auth.getUser())
    if (user) {
        await recordAuditLog({
            actorId: user.id,
            action: 'create',
            resourceType: 'parcels',
            resourceId: tracking_code || 'new',
            newValues: insertData as unknown as Record<string, unknown>,
            metadata: { 
                method: 'createParcel',
                displayId: tracking_code || 'Encomienda Nueva'
            }
        })
    }

    revalidatePath('/chimi-encomiendas')
    return { success: true }
}

export async function updateParcel(formData: FormData) {
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
            const permission = await getActivePermissionDetails('parcels', id)
            if (!permission.hasPermission) {
                throw new Error('No tienes permiso para editar esta encomienda. Debes solicitar autorización.')
            }
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
            // Consumir permiso inmediatamente en la acción principal de guardado
            await consumeEditPermission('parcels', id)
        } else if (userRole === 'admin') {
            const permission = await getActivePermissionDetails('parcels', id)
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
        } else {
            throw new Error('Acceso denegado')
        }

        const { data: existing } = await adminSupabase
            .from('parcels')
            .select('*')
            .eq('id', id)
            .single()
            
        if (!existing) throw new Error('Parcel not found')

        // Deep clone for audit log comparison
        const oldValues = JSON.parse(JSON.stringify(existing))
        const currentDocs = existing.documents || []

    // 1. Core Data
    // Sender ID is locked in UI but we might receive it anyway, usually we don't update it
    const recipient_name = formData.get('recipient_name') as string
    const recipient_phone = formData.get('recipient_phone') as string
    const recipient_address = formData.get('recipient_address') as string
    const origin_address = formData.get('origin_address') as string
    const destination_address = formData.get('destination_address') as string
    
    const package_type = formData.get('package_type') as string
    const package_weight = formData.get('package_weight') as string
    const package_description = formData.get('package_description') as string
    
    const shipping_cost = parseFloat(formData.get('shipping_cost') as string) || 0
    const on_account = parseFloat(formData.get('on_account') as string) || 0
    const status = formData.get('status') as string

    // 2. Multi-Payments & Proofs
    const paymentDetailsRaw = formData.get('payment_details') as string
    const payment_details = paymentDetailsRaw ? JSON.parse(paymentDetailsRaw) : []

    for (let i = 0; i < payment_details.length; i++) {
        const file = formData.get(`payment_proof_${i}`) as File
        if (file && file.size > 0) {
            const path = `parcels/payments/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            await uploadFileToR2(file, path)
            payment_details[i].proof_path = path
        }
    }

    // 3. New Files Upload
    let index = 0
    while (formData.has(`document_title_${index}`)) {
        const title = formData.get(`document_title_${index}`) as string
        const file = formData.get(`document_file_${index}`) as File
        
        if (file && file.size > 0) {
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
            const path = `parcels/updates/${Date.now()}_${safeName}`
            
            await uploadFileToR2(file, path)
            
            currentDocs.push({
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
        recipient_name,
        recipient_phone,
        recipient_address,
        origin_address,
        destination_address,
        package_type,
        package_weight,
        package_description,
        shipping_cost,
        on_account,
        status,
        documents: currentDocs,
        payment_details,
        updated_at: new Date().toISOString()
    }

    const { error } = await supabase
        .from('parcels')
        .update(updateData)
        .eq('id', id)

    if (error) {
        throw error
    }

    await recordAuditLog({
        actorId: user.id,
        action: 'update',
        resourceType: 'parcels',
        resourceId: id,
        oldValues: oldValues,
        newValues: updateData,
        metadata: { 
            method: 'updateParcel',
            displayId: existing?.tracking_code || undefined,
            requestId: activeRequestId,
            reason: activeReason
        }
    })

    revalidatePath('/chimi-encomiendas')

    return { success: true }
    } catch (error: unknown) {
        console.error('Error updating parcel:', error)
        return { error: error instanceof Error ? error.message : 'Error al actualizar encomienda' }
    }
}

export async function deleteParcel(id: string) {
    const supabase = await createClient()
    const adminSupabase = supabaseAdmin

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin') {
            throw new Error('Solo los administradores pueden eliminar encomiendas.')
        }

        const { data: parcel } = await adminSupabase.from('parcels').select('*').eq('id', id).single()
        if (!parcel) throw new Error('Encomienda no encontrada')

        const { error } = await adminSupabase
            .from('parcels')
            .delete()
            .eq('id', id)

        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'delete',
            resourceType: 'parcels',
            resourceId: id,
            oldValues: parcel,
            metadata: { 
                method: 'deleteParcel',
                displayId: parcel?.tracking_code || undefined
            }
        })

        revalidatePath('/chimi-encomiendas')
        return { success: true }
    } catch (error: unknown) {
        console.error('Error deleting parcel:', error)
        return { error: error instanceof Error ? error.message : 'Error al eliminar encomienda' }
    }
}

export async function deleteParcelDocument(id: string, docPath: string) {
    const supabase = supabaseAdmin
    
    const { data: existing } = await supabase
        .from('parcels')
        .select('documents')
        .eq('id', id)
        .single()
        
    if (!existing) return { error: 'Parcel not found' }

    const newDocs = existing.documents.filter((d: {path: string}) => d.path !== docPath)
    
    // We update the array in DB. File remains in bucket (soft delete) or implement bucket delete logic.

    const { error } = await supabase
        .from('parcels')
        .update({ documents: newDocs })
        .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/chimi-encomiendas')
    return { success: true }
}

export async function updateParcelStatus(id: string, status: string) {
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
            const permission = await getActivePermissionDetails('parcels', id)
            if (permission.hasPermission) {
                activeRequestId = permission.requestId as string
                activeReason = permission.reason as string
            } else {
                throw new Error('No tienes permiso para editar esta encomienda.')
            }
        } else if (userRole === 'admin') {
            const permission = await getActivePermissionDetails('parcels', id)
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
        }

        // Fetch parcel info for audit log
        const { data: parcelRecord } = await adminSupabase.from('parcels').select('*').eq('id', id).single()

        const { error } = await adminSupabase
            .from('parcels')
            .update({ status })
            .eq('id', id)

        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'parcels',
            resourceId: id,
            oldValues: parcelRecord,
            newValues: { status },
            metadata: { 
                method: 'updateParcelStatus',
                displayId: parcelRecord?.tracking_code || undefined,
                requestId: activeRequestId,
                reason: activeReason
            }
        })

        revalidatePath('/chimi-encomiendas')
        return { success: true }
    } catch (error: unknown) {
        console.error('Error updating status:', error)
        return { error: error instanceof Error ? error.message : 'Error al actualizar estado' }
    }
}

export async function getParcelDocumentUrl(path: string, storage: StorageType = 'r2') {
    return await getFileUrl(path, storage)
}

/**
 * Public Track Parcel by Code
 */
export async function getParcelByCode(code: string) {
    const supabase = supabaseAdmin
    
    // Clean code
    const cleanCode = code.trim().toUpperCase()

    const { data, error } = await supabase
        .from('parcels')
        .select(`
            created_at,
            package_description,
            package_weight,
            package_type,
            recipient_name,
            recipient_address,
            tracking_code,
            status,
            profiles:sender_id (
                first_name,
                last_name
            )
        `)
        .ilike('tracking_code', cleanCode) // Case insensitive match
        .single()
    
    if (error || !data) {
        return { error: 'Encomienda no encontrada' }
    }

    // Return limited data for privacy
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = data.profiles as any
    const senderName = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '***'

    return {
        success: true,
        data: {
            created_at: data.created_at,
            description: data.package_description,
            weight: data.package_weight,
            type: data.package_type,
            recipient_name: maskName(data.recipient_name),
            recipient_address: maskAddress(data.recipient_address), // Mask address for privacy
            sender_name: maskName(senderName),
            code: data.tracking_code,
            status: data.status
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

function maskAddress(address: string) {
    if (!address) return '***'
    // Show only the last part (city/country) or first few chars
    // Simple strategy: Show first 5 chars then ***
    if (address.length <= 5) return address
    return address.substring(0, 5) + '***'
}
