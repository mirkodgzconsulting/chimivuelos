'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { uploadClientFile, deleteFileFromR2, deleteImageFromCloudflare, getFileUrl } from "@/lib/storage"
import { getActivePermissionDetails, consumeEditPermission } from "./manage-permissions"
import { recordAuditLog } from "@/lib/audit"

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
interface PaymentDetail {
    sede_it: string
    sede_pe: string
    metodo_it: string
    metodo_pe: string
    cantidad: string       // EUR amount (affects accounting)
    tipo_cambio: number    // Exchange rate used
    total: string          // Formatted original amount (e.g. "S/ 400.00")
    moneda?: string        // 'EUR', 'PEN', 'USD'
    monto_original?: string
    created_at?: string
    updated_at?: string
    proof_path?: string
}

interface ExpenseDetail {
    description: string
    amount: number
    currency: string
    category: string
    sede_it?: string
    sede_pe?: string
    metodo_it?: string
    metodo_pe?: string
    tipo_cambio?: number
    total_formatted?: string
    created_at?: string
    proof_path?: string
}

export interface MoneyTransfer {
    id: string
    created_at: string
    client_id: string
    transfer_mode: 'eur_to_pen' | 'pen_to_eur' | 'eur_to_eur'
    amount_sent: number
    exchange_rate: number
    amount_received: number
    commission_percentage: number
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
    status: 'scheduled' | 'delivered' | 'cancelled'
    payment_details?: PaymentDetail[]
    expense_details?: ExpenseDetail[]
    agent_id?: string
    documents?: TransferDocument[]
    total_expenses?: number
    net_profit?: number
    profiles?: {
        first_name: string
        last_name: string
        email: string
        phone: string
    }
    agent?: {
        first_name: string
        last_name: string
    }
}


/**
 * Creates a new transfer record
 */
export async function createTransfer(formData: FormData) {
    const supabase = supabaseAdmin

    try {
        const client_id = formData.get('client_id') as string
        const transfer_mode = (formData.get('transfer_mode') as string) || 'eur_to_pen'
        
        // Financial Details
        const amount_sent = parseFloat(formData.get('amount_sent') as string) || 0
        const exchange_rate = parseFloat(formData.get('exchange_rate') as string) || 0
        const amount_received = parseFloat(formData.get('amount_received') as string) || 0
        const commission_percentage = parseFloat(formData.get('commission_percentage') as string) || 0
        const commission = parseFloat(formData.get('commission') as string) || 0
        
        // Payment Control
        const total_amount = parseFloat(formData.get('total_amount') as string) || (amount_sent + commission)

        const { data: { user } } = await (await createClient()).auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // Beneficiary Details
        const beneficiary_name = formData.get('beneficiary_name') as string
        const beneficiary_document = formData.get('beneficiary_document') as string
        const beneficiary_phone = formData.get('beneficiary_phone') as string
        const beneficiary_bank = formData.get('beneficiary_bank') as string
        const beneficiary_account = formData.get('beneficiary_account') as string
        
        const transfer_code = formData.get('transfer_code') as string || `GIR-${Date.now().toString().slice(-4)}`
        const status = formData.get('status') as string || 'scheduled'

        // Handle Payment Details (Multi-payment logic)
        const payment_details: PaymentDetail[] = []
        const multiPaymentsStr = formData.get('payment_details') as string
        if (multiPaymentsStr) {
            try {
                const multiPayments = JSON.parse(multiPaymentsStr) as PaymentDetail[]
                for (let i = 0; i < multiPayments.length; i++) {
                    const tempFile = formData.get(`payment_proof_${i}`) as File
                    if (tempFile && tempFile.size > 0) {
                        const uploadResult = await uploadClientFile(tempFile, client_id)
                        multiPayments[i].proof_path = uploadResult.path
                    }
                }
                payment_details.push(...multiPayments)
            } catch (e) {
                console.error('Error parsing payment_details:', e)
            }
        }

        // Handle Expense Details
        const expense_details: ExpenseDetail[] = []
        const expensesStr = formData.get('expense_details') as string
        if (expensesStr) {
            try {
                const expenses = JSON.parse(expensesStr) as ExpenseDetail[]
                for (let i = 0; i < expenses.length; i++) {
                    const tempFile = formData.get(`expense_proof_${i}`) as File
                    if (tempFile && tempFile.size > 0) {
                        const uploadResult = await uploadClientFile(tempFile, client_id)
                        expenses[i].proof_path = uploadResult.path
                    }
                }
                expense_details.push(...expenses)
            } catch (e) {
                console.error('Error parsing expense_details:', e)
            }
        }

        const on_account = payment_details.reduce((sum, p) => sum + (parseFloat(p.cantidad) || 0), 0)
        
        // Accounting conversion: Balance and Profit are ALWAYS in EUR
        let totalAmountEur = total_amount
        let commissionEur = commission
        if (transfer_mode === 'pen_to_eur') {
            const rate = exchange_rate || 1.0
            totalAmountEur = total_amount / rate
            commissionEur = commission / rate
        }

        const balance = totalAmountEur - on_account
        const total_expenses = expense_details.reduce((sum, e) => sum + (e.amount || 0), 0)
        const net_profit = commissionEur - total_expenses

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

        const insertData = {
            client_id,
            transfer_mode,
            amount_sent,
            exchange_rate,
            amount_received,
            commission_percentage,
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
            payment_details: payment_details as unknown,
            expense_details: expense_details as unknown,
            documents: documents as unknown,
            total_expenses,
            net_profit,
            agent_id: user.id
        }

        const { error } = await supabase.from('money_transfers').insert(insertData)

        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'create',
            resourceType: 'money_transfers',
            resourceId: transfer_code || 'new',
            newValues: insertData as unknown as Record<string, unknown>,
            metadata: { 
                method: 'createTransfer',
                displayId: transfer_code || beneficiary_name || 'Giro Nuevo'
            }
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
            const permission = await getActivePermissionDetails('money_transfers', id)
            if (!permission.hasPermission) {
                throw new Error('No tienes permiso para editar este giro. Debes solicitar autorización.')
            }
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
            // Consumir permiso inmediatamente en la acción principal de guardado
            await consumeEditPermission('money_transfers', id)
        } else if (userRole === 'admin') {
            const permission = await getActivePermissionDetails('money_transfers', id)
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
        } else {
            throw new Error('Acceso denegado')
        }

        const { data: existingTransfer } = await adminSupabase.from('money_transfers').select('*').eq('id', id).single()
        if (!existingTransfer) throw new Error('Transfer not found')

        // Deep clone for audit log comparison
        const oldValues = JSON.parse(JSON.stringify(existingTransfer))

        const client_id = existingTransfer.client_id
        const transfer_mode = (formData.get('transfer_mode') as string) || 'eur_to_pen'
        
        // Financial Details
        const amount_sent = parseFloat(formData.get('amount_sent') as string) || 0
        const exchange_rate = parseFloat(formData.get('exchange_rate') as string) || 0
        const amount_received = parseFloat(formData.get('amount_received') as string) || 0
        const commission_percentage = parseFloat(formData.get('commission_percentage') as string) || 0
        const commission = parseFloat(formData.get('commission') as string) || 0
        const total_amount = parseFloat(formData.get('total_amount') as string) || (amount_sent + commission)
        const beneficiary_name = formData.get('beneficiary_name') as string
        const beneficiary_document = formData.get('beneficiary_document') as string
        const beneficiary_phone = formData.get('beneficiary_phone') as string
        const beneficiary_bank = formData.get('beneficiary_bank') as string
        const beneficiary_account = formData.get('beneficiary_account') as string
        
        const transfer_code = formData.get('transfer_code') as string
        const status = formData.get('status') as string
        const agent_id = formData.get('agent_id') as string || null

        // Handle Payment Details
        const payment_details: PaymentDetail[] = (existingTransfer.payment_details as unknown as PaymentDetail[]) || []
        const multiPaymentsStr = formData.get('payment_details') as string
        if (multiPaymentsStr) {
            try {
                const newMultiPayments = JSON.parse(multiPaymentsStr) as PaymentDetail[]
                for (let i = 0; i < newMultiPayments.length; i++) {
                    const tempFile = formData.get(`payment_proof_${i}`) as File
                    if (tempFile && tempFile.size > 0) {
                        const uploadResult = await uploadClientFile(tempFile, client_id)
                        newMultiPayments[i].proof_path = uploadResult.path
                    }
                }
                // Replace or merge payment details. For simplicity, replacing for now.
                // A more robust solution might merge based on an ID or update existing.
                payment_details.splice(0, payment_details.length, ...newMultiPayments);
            } catch (e) {
                console.error('Error parsing payment_details:', e)
            }
        }

        // Handle Expense Details
        const expense_details: ExpenseDetail[] = (existingTransfer.expense_details as unknown as ExpenseDetail[]) || []
        const expensesStr = formData.get('expense_details') as string
        if (expensesStr) {
            try {
                const newExpenses = JSON.parse(expensesStr) as ExpenseDetail[]
                for (let i = 0; i < newExpenses.length; i++) {
                    const tempFile = formData.get(`expense_proof_${i}`) as File
                    if (tempFile && tempFile.size > 0) {
                        const uploadResult = await uploadClientFile(tempFile, client_id)
                        newExpenses[i].proof_path = uploadResult.path
                    }
                }
                // Replace or merge expense details.
                expense_details.splice(0, expense_details.length, ...newExpenses);
            } catch (e) {
                console.error('Error parsing expense_details:', e)
            }
        }

        const on_account = payment_details.reduce((sum, p) => sum + (parseFloat(p.cantidad) || 0), 0)
        
        // Accounting conversion: Balance and Profit are ALWAYS in EUR
        let totalAmountEur = total_amount
        let commissionEur = commission
        if (transfer_mode === 'pen_to_eur') {
            const rate = exchange_rate || 1.0
            totalAmountEur = total_amount / rate
            commissionEur = commission / rate
        }

        const balance = totalAmountEur - on_account
        const total_expenses = expense_details.reduce((sum, e) => sum + (e.amount || 0), 0)
        const net_profit = commissionEur - total_expenses

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

        const updateData = {
            transfer_mode,
            amount_sent,
            exchange_rate,
            amount_received,
            commission_percentage,
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
            payment_details: payment_details as unknown,
            expense_details: expense_details as unknown,
            documents: currentDocuments as unknown,
            total_expenses,
            net_profit,
            agent_id: agent_id || (await (await createClient()).auth.getUser()).data.user?.id
        }

        const { error } = await supabase.from('money_transfers').update(updateData).eq('id', id)

        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'money_transfers',
            resourceId: id,
            oldValues: oldValues,
            newValues: updateData,
            metadata: { 
                method: 'updateTransfer',
                displayId: transfer_code || beneficiary_name || undefined,
                requestId: activeRequestId,
                reason: activeReason
            }
        })

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
            const permission = await getActivePermissionDetails('money_transfers', id)
            if (permission.hasPermission) {
                activeRequestId = permission.requestId as string
                activeReason = permission.reason as string
            } else {
                throw new Error('No tienes permiso para editar este giro.')
            }
        } else if (userRole === 'admin') {
            const permission = await getActivePermissionDetails('money_transfers', id)
            activeRequestId = permission.requestId as string
            activeReason = permission.reason as string
        }

        // Fetch transfer info for audit log
        const { data: transferRecord } = await adminSupabase.from('money_transfers').select('*').eq('id', id).single()

        const { error } = await adminSupabase.from('money_transfers').update({ status }).eq('id', id)
        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'money_transfers',
            resourceId: id,
            oldValues: transferRecord,
            newValues: { status },
            metadata: { 
                method: 'updateTransferStatus',
                displayId: transferRecord?.transfer_code || transferRecord?.beneficiary_name || undefined,
                requestId: activeRequestId,
                reason: activeReason
            }
        })
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
    const supabase = await createClient()
    const adminSupabase = supabaseAdmin

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin') {
            throw new Error('Solo los administradores pueden eliminar giros.')
        }

        const { data: transfer } = await adminSupabase.from('money_transfers').select('*').eq('id', id).single()
        if (!transfer) throw new Error('Giro no encontrado')
        
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

        const { error } = await adminSupabase.from('money_transfers').delete().eq('id', id)
        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'delete',
            resourceType: 'money_transfers',
            resourceId: id,
            oldValues: transfer as unknown as Record<string, unknown>,
            metadata: { 
                method: 'deleteTransfer',
                displayId: transfer?.transfer_code || transfer?.beneficiary_name || undefined
            }
        })

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
            transfer_mode,
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
            transfer_mode: data.transfer_mode,
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
