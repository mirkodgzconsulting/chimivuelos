'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { uploadClientFile, deleteFileFromR2, deleteImageFromCloudflare, getFileUrl } from "@/lib/storage"

/**
 * Interface for Transfer Document
 */
interface TransferDocument {
    title: string
    path: string
    name: string
    type: string
    size: number
    storage: 'r2' | 'images'
}

/**
 * Interface for Money Transfer Record
 */
export interface MoneyTransfer {
    id: string
    created_at: string
    client_id: string
    amount_sent: number
    exchange_rate: number
    amount_received: number
    commission: number
    total_amount: number
    on_account: number
    balance: number
    beneficiary_name: string
    beneficiary_document: string
    beneficiary_phone: string
    beneficiary_bank: string
    beneficiary_account: string
    transfer_code: string
    status: 'pending' | 'processing' | 'available' | 'completed' | 'cancelled'
    documents?: TransferDocument[]
    profiles?: {
        first_name: string
        last_name: string
        email: string
        phone: string
    }
}


/**
 * Creates a new transfer record
 */
export async function createTransfer(formData: FormData) {
    const supabase = supabaseAdmin

    try {
        const client_id = formData.get('client_id') as string
        
        // Financial Details
        const amount_sent = parseFloat(formData.get('amount_sent') as string) || 0
        const exchange_rate = parseFloat(formData.get('exchange_rate') as string) || 0
        const amount_received = parseFloat(formData.get('amount_received') as string) || (amount_sent * exchange_rate)
        const commission = parseFloat(formData.get('commission') as string) || 0
        
        // Payment Control
        const total_amount = parseFloat(formData.get('total_amount') as string) || (amount_sent + commission)
        const on_account = parseFloat(formData.get('on_account') as string) || 0
        const balance = parseFloat(formData.get('balance') as string) || (total_amount - on_account)
        
        // Beneficiary Details
        const beneficiary_name = formData.get('beneficiary_name') as string
        const beneficiary_document = formData.get('beneficiary_document') as string
        const beneficiary_phone = formData.get('beneficiary_phone') as string
        const beneficiary_bank = formData.get('beneficiary_bank') as string
        const beneficiary_account = formData.get('beneficiary_account') as string
        
        const transfer_code = formData.get('transfer_code') as string || `GIR-${Date.now().toString().slice(-4)}`
        const status = formData.get('status') as string || 'pending'

        // Handle Documents
        const documents: TransferDocument[] = []
        let index = 0
        while (formData.has(`document_title_${index}`)) {
            const title = formData.get(`document_title_${index}`) as string
            const file = formData.get(`document_file_${index}`) as File

            if (file && file.size > 0) {
                const uploadResult = await uploadClientFile(file, client_id)
                documents.push({
                    title: title || file.name,
                    path: uploadResult.path,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    storage: uploadResult.storage
                })
            }
            index++
        }

        const { error } = await supabase.from('money_transfers').insert({
            client_id,
            amount_sent,
            exchange_rate,
            amount_received,
            commission,
            total_amount,
            on_account,
            balance,
            beneficiary_name,
            beneficiary_document,
            beneficiary_phone,
            beneficiary_bank,
            beneficiary_account,
            transfer_code,
            status,
            documents: documents as unknown
        })

        if (error) throw error

        revalidatePath('/chimi-transfers')
        return { success: true }

    } catch (error: unknown) {
        console.error('Error creating transfer:', error)
        const errorMessage = error instanceof Error ? error.message : 'Error creating transfer'
        return { error: errorMessage }
    }
}

/**
 * Updates an existing transfer
 */
export async function updateTransfer(formData: FormData) {
    const supabase = supabaseAdmin
    const id = formData.get('id') as string

    try {
        const { data: existingTransfer } = await supabase.from('money_transfers').select('documents, client_id').eq('id', id).single()
        if (!existingTransfer) throw new Error('Transfer not found')

        const client_id = existingTransfer.client_id
        
        // Financial Details
        const amount_sent = parseFloat(formData.get('amount_sent') as string) || 0
        const exchange_rate = parseFloat(formData.get('exchange_rate') as string) || 0
        const amount_received = parseFloat(formData.get('amount_received') as string) || (amount_sent * exchange_rate)
        const commission = parseFloat(formData.get('commission') as string) || 0
        const total_amount = parseFloat(formData.get('total_amount') as string) || (amount_sent + commission)
        const on_account = parseFloat(formData.get('on_account') as string) || 0
        const balance = parseFloat(formData.get('balance') as string) || (total_amount - on_account)
        
        const beneficiary_name = formData.get('beneficiary_name') as string
        const beneficiary_document = formData.get('beneficiary_document') as string
        const beneficiary_phone = formData.get('beneficiary_phone') as string
        const beneficiary_bank = formData.get('beneficiary_bank') as string
        const beneficiary_account = formData.get('beneficiary_account') as string
        
        const transfer_code = formData.get('transfer_code') as string
        const status = formData.get('status') as string

        // Build new documents array (Start with existing ones)
        const currentDocuments: TransferDocument[] = (existingTransfer.documents as unknown as TransferDocument[]) || []

        // Process NEW uploads
        let index = 0
        while (formData.has(`document_title_${index}`)) {
            const title = formData.get(`document_title_${index}`) as string
            const file = formData.get(`document_file_${index}`) as File

            if (file && file.size > 0) {
                 const uploadResult = await uploadClientFile(file, client_id)
                 currentDocuments.push({
                    title: title || file.name,
                    path: uploadResult.path,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    storage: uploadResult.storage
                })
            }
            index++
        }

        const { error } = await supabase.from('money_transfers').update({
            amount_sent,
            exchange_rate,
            amount_received,
            commission,
            total_amount,
            on_account,
            balance,
            beneficiary_name,
            beneficiary_document,
            beneficiary_phone,
            beneficiary_bank,
            beneficiary_account,
            transfer_code,
            status,
            documents: currentDocuments as unknown
        }).eq('id', id)

        if (error) throw error

        revalidatePath('/chimi-transfers')
        return { success: true }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error updating transfer'
        return { error: errorMessage }
    }
}

/**
 * Update only the status of a transfer
 */
export async function updateTransferStatus(id: string, status: string) {
    const supabase = supabaseAdmin
    try {
        const { error } = await supabase.from('money_transfers').update({ status }).eq('id', id)
        if (error) throw error
        revalidatePath('/chimi-transfers')
        return { success: true }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error updating status'
        return { error: errorMessage }
    }
}

/**
 * Delete a transfer and all its documents
 */
export async function deleteTransfer(id: string) {
    const supabase = supabaseAdmin

    try {
        const { data: transfer } = await supabase.from('money_transfers').select('documents').eq('id', id).single()
        
        if (transfer && transfer.documents) {
            const docs = transfer.documents as unknown as TransferDocument[]
            for (const doc of docs) {
                try {
                    if (doc.storage === 'images' && !doc.path.includes('/')) {
                        await deleteImageFromCloudflare(doc.path)
                    } else {
                        await deleteFileFromR2(doc.path)
                    }
                } catch (e) {
                    console.error('Error deleting file:', doc.path, e)
                }
            }
        }

        const { error } = await supabase.from('money_transfers').delete().eq('id', id)
        if (error) throw error

        revalidatePath('/chimi-transfers')
        return { success: true }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error deleting transfer'
        return { error: errorMessage }
    }
}

/**
 * Delete a specific document from a transfer
 */
export async function deleteTransferDocument(transferId: string, docPath: string) {
    const supabase = supabaseAdmin
    
    try {
        const { data: transfer } = await supabase.from('money_transfers').select('documents').eq('id', transferId).single()
        if (!transfer) throw new Error('Transfer not found')

        let docs = (transfer.documents as unknown as TransferDocument[]) || []
        const docToDelete = docs.find(d => d.path === docPath)

        if (docToDelete) {
             if (docToDelete.storage === 'images' && !docToDelete.path.includes('/')) {
                 await deleteImageFromCloudflare(docToDelete.path)
             } else {
                 await deleteFileFromR2(docToDelete.path)
             }

             // Update DB
             docs = docs.filter(d => d.path !== docPath)
             await supabase.from('money_transfers').update({ documents: docs as unknown }).eq('id', transferId)
        }

        revalidatePath('/chimi-transfers')
        return { success: true }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error deleting document'
        return { error: errorMessage }
    }
}

/**
 * Get signed URL for a transfer document
 */
export async function getTransferDocumentUrl(path: string, storage: 'r2' | 'images') {
    return getFileUrl(path, storage)
}

/**
 * Get all transfers with client details
 */
export async function getTransfers() {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
        .from('money_transfers')
        .select(`
            *,
            profiles:client_id (
                first_name,
                last_name,
                email,
                phone
            )
        `)
        .order('created_at', { ascending: false })
    
    if (error) {
        console.error('Error fetching transfers:', error)
        return []
    }
    return data
}

/**
 * Get all clients (Reused logic, keeping independent implementation for clarity)
 */
export async function getClientsForDropdown() {
    const supabase = supabaseAdmin
    const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .eq('role', 'client')
        .order('first_name', { ascending: true })
    return data || []
}

/**
 * Public Track Transfer by Code
 */
export async function getTransferByCode(code: string) {
    const supabase = supabaseAdmin
    
    // Clean code
    const cleanCode = code.trim().toUpperCase()

    const { data, error } = await supabase
        .from('money_transfers')
        .select(`
            created_at,
            amount_sent,
            amount_received,
            beneficiary_name,
            beneficiary_bank,
            beneficiary_account,
            transfer_code,
            status,
            profiles:client_id (
                first_name,
                last_name
            )
        `)
        .ilike('transfer_code', cleanCode) // Case insensitive match
        .single()
    
    if (error || !data) {
        return { error: 'Giro no encontrado' }
    }

    // Return limited data for privacy
    return {
        success: true,
        data: {
            created_at: data.created_at,
            amount_sent: data.amount_sent,
            amount_received: data.amount_received,
            beneficiary_name: maskName(data.beneficiary_name),
            beneficiary_bank: data.beneficiary_bank,
            beneficiary_account: data.beneficiary_account ? maskAccount(data.beneficiary_account) : null,
            sender_name: maskName(getSenderName(data.profiles)),
            code: data.transfer_code,
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

function maskAccount(account: string) {
    if (!account) return '***'
    if (account.length <= 4) return '****'
    return '****' + account.slice(-4)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSenderName(profiles: any) {
    if (!profiles) return '***'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = profiles as any
    if (Array.isArray(p)) {
        const profile = p[0]
        return profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '***'
    } else {
        return `${p.first_name || ''} ${p.last_name || ''}`.trim() || '***'
    }
}
