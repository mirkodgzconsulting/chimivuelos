'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { uploadFileToR2, getFileUrl, type StorageType } from '@/lib/storage'
import { revalidatePath } from 'next/cache'

export async function getParcels() {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
        .from('parcels')
        .select(`
            *,
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
    return data
}

export async function createParcel(formData: FormData) {
    const supabase = supabaseAdmin
    
    // 1. Core Data
    const sender_id = formData.get('sender_id') as string
    const recipient_name = formData.get('recipient_name') as string
    const recipient_document = formData.get('recipient_document') as string
    const recipient_phone = formData.get('recipient_phone') as string
    const recipient_address = formData.get('recipient_address') as string
    
    // 2. Package Details (Simplified)
    const package_type = formData.get('package_type') as string
    const package_weight = formData.get('package_weight') as string
    const package_description = formData.get('package_description') as string
    
    // 3. Economics (Simplified)
    const shipping_cost = parseFloat(formData.get('shipping_cost') as string) || 0
    const on_account = parseFloat(formData.get('on_account') as string) || 0
    // Balance is auto-generated but we calculate client-side too
    
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

    const { error } = await supabase
        .from('parcels')
        .insert({
            sender_id,
            recipient_name,
            recipient_document,
            recipient_phone,
            recipient_address,
            package_type,
            package_weight,
            package_description,
            shipping_cost,
            on_account,
            status,
            tracking_code,
            documents
        })

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/parcels')
    return { success: true }
}

export async function updateParcel(formData: FormData) {
    const supabase = supabaseAdmin
    const id = formData.get('id') as string
    
    // Retrieve existing data to preserve old docs
    const { data: existing } = await supabase
        .from('parcels')
        .select('documents')
        .eq('id', id)
        .single()
        
    const currentDocs = existing?.documents || []

    // 1. Core Data
    // Sender ID is locked in UI but we might receive it anyway, usually we don't update it
    const recipient_name = formData.get('recipient_name') as string
    const recipient_document = formData.get('recipient_document') as string
    const recipient_phone = formData.get('recipient_phone') as string
    const recipient_address = formData.get('recipient_address') as string
    
    const package_type = formData.get('package_type') as string
    const package_weight = formData.get('package_weight') as string
    const package_description = formData.get('package_description') as string
    
    const shipping_cost = parseFloat(formData.get('shipping_cost') as string) || 0
    const on_account = parseFloat(formData.get('on_account') as string) || 0
    const status = formData.get('status') as string

    // 2. New Files Upload
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

    const { error } = await supabase
        .from('parcels')
        .update({
            recipient_name,
            recipient_document,
            recipient_phone,
            recipient_address,
            package_type,
            package_weight,
            package_description,
            shipping_cost,
            on_account,
            status,
            documents: currentDocs,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/parcels')
    return { success: true }
}

export async function deleteParcel(id: string) {
    const supabase = supabaseAdmin
    
    // Optionally delete files from bucket here if desired
    
    const { error } = await supabase
        .from('parcels')
        .delete()
        .eq('id', id)

    if (error) {
        return { error: error.message }
    }

    revalidatePath('/parcels')
    return { success: true }
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

    revalidatePath('/parcels')
    return { success: true }
}

export async function updateParcelStatus(id: string, status: string) {
    const supabase = supabaseAdmin
    const { error } = await supabase
        .from('parcels')
        .update({ status })
        .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/parcels')
    return { success: true }
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
