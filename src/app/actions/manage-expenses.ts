'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { uploadClientFile } from "@/lib/storage"
import { recordAuditLog } from "@/lib/audit"

export interface CorporateExpense {
    id: string
    created_at: string
    expense_date: string
    agent_id: string
    status: string
    category: string
    sub_category: string
    other_category_details?: string
    connected_record_id?: string
    connected_service?: string
    reference_number?: string
    provider_name?: string
    description: string
    notes?: string
    sede_it?: string
    sede_pe?: string
    metodo_it?: string
    metodo_pe?: string
    original_amount: number
    currency: string
    exchange_rate: number
    amount_eur: number
    proof_path?: string
    additional_files?: {
        name: string
        title?: string
        path: string
        type: string
        size: number
        storage: 'r2' | 'images'
    }[]
    agent?: {
        first_name: string
        last_name: string
    }
}

export async function getExpenses() {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
        .from('corporate_expenses')
        .select('*')
        .order('expense_date', { ascending: false })

    if (error) {
        console.error('Error fetching expenses:', error)
        return []
    }

    if (data && data.length > 0) {
        const agentIds = [...new Set(data.map(d => d.agent_id).filter(Boolean))] as string[]
        if (agentIds.length > 0) {
            const { data: agents } = await supabase.from('profiles').select('id, first_name, last_name').in('id', agentIds)
            if (agents) {
                const agentMap = Object.fromEntries(agents.map(a => [a.id, a]))
                data.forEach(d => {
                    if (d.agent_id && agentMap[d.agent_id]) {
                        d.agent = agentMap[d.agent_id]
                    }
                })
            }
        }
    }

    return data as CorporateExpense[]
}

export async function createExpense(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const category = formData.get('category') as string
    const original_amount = parseFloat(formData.get('original_amount') as string) || 0
    const exchange_rate = parseFloat(formData.get('exchange_rate') as string) || 1
    const amount_eur = original_amount / exchange_rate 

    let uploadResult = null
    const proofFile = formData.get('proof_file') as File
    if (proofFile && proofFile.size > 0) {
        uploadResult = await uploadClientFile(proofFile, 'expenses')
    }

    const additional_files_data = []
    let index = 0
    while (formData.has(`document_file_${index}`)) {
        const title = formData.get(`document_title_${index}`) as string
        const file = formData.get(`document_file_${index}`) as File
        if (file && file.size > 0) {
            const uploadResult = await uploadClientFile(file, 'expenses/attachments')
            additional_files_data.push({
                name: file.name,
                title: title || file.name,
                path: uploadResult.path,
                type: file.type,
                size: file.size,
                storage: uploadResult.storage
            })
        }
        index++
    }

    const insertData = {
        agent_id: user.id,
        expense_date: formData.get('expense_date') as string,
        category,
        sub_category: formData.get('sub_category') as string,
        other_category_details: formData.get('other_category_details') as string,
        connected_record_id: formData.get('connected_record_id') as string,
        connected_service: formData.get('connected_service') as string,
        reference_number: formData.get('reference_number') as string,
        provider_name: formData.get('provider_name') as string,
        description: formData.get('description') as string,
        notes: formData.get('notes') as string,
        sede_it: formData.get('sede_it') as string,
        sede_pe: formData.get('sede_pe') as string,
        metodo_it: formData.get('metodo_it') as string,
        metodo_pe: formData.get('metodo_pe') as string,
        original_amount,
        currency: formData.get('currency') as string || 'EUR',
        exchange_rate,
        amount_eur: parseFloat(formData.get('amount_eur') as string) || amount_eur,
        proof_path: uploadResult?.path || null,
        additional_files: additional_files_data,
        status: 'confirmed'
    }

    const { data, error } = await supabaseAdmin
        .from('corporate_expenses')
        .insert(insertData)
        .select()
        .single()

    if (error) {
        console.error('Error creating expense:', error)
        return { error: error.message }
    }

    await recordAuditLog({
        actorId: user.id,
        action: 'create',
        resourceType: 'corporate_expenses',
        resourceId: data.id,
        newValues: insertData,
        metadata: { method: 'createExpense' }
    })

    revalidatePath('/chimi-gastos')
    return { success: true }
}

export async function deleteExpense(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { error } = await supabaseAdmin
        .from('corporate_expenses')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Error deleting expense:', error)
        return { error: error.message }
    }

    await recordAuditLog({
        actorId: user.id,
        action: 'delete',
        resourceType: 'corporate_expenses',
        resourceId: id,
        metadata: { method: 'deleteExpense' }
    })

    revalidatePath('/chimi-gastos')
    return { success: true }
}

export async function updateExpense(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const id = formData.get('id') as string
    if (!id) throw new Error('Missing ID')

    const category = formData.get('category') as string
    const original_amount = parseFloat(formData.get('original_amount') as string) || 0
    const exchange_rate = parseFloat(formData.get('exchange_rate') as string) || 1
    const amount_eur = parseFloat(formData.get('amount_eur') as string) || (original_amount / exchange_rate)

    let uploadResult = null
    const proofFile = formData.get('proof_file') as File
    if (proofFile && proofFile.size > 0) {
        uploadResult = await uploadClientFile(proofFile, 'expenses')
    }

    const additional_files_data = JSON.parse(formData.get('additional_files_existing') as string || '[]')
    let ind = 0
    while (formData.has(`document_file_${ind}`)) {
        const title = formData.get(`document_title_${ind}`) as string
        const file = formData.get(`document_file_${ind}`) as File
        if (file && file.size > 0) {
            const uploadResult = await uploadClientFile(file, 'expenses/attachments')
            additional_files_data.push({
                name: file.name,
                title: title || file.name,
                path: uploadResult.path,
                type: file.type,
                size: file.size,
                storage: uploadResult.storage
            })
        }
        ind++
    }

    const updateData = {
        expense_date: formData.get('expense_date') as string,
        category,
        sub_category: formData.get('sub_category') as string,
        other_category_details: formData.get('other_category_details') as string,
        connected_record_id: formData.get('connected_record_id') as string,
        connected_service: formData.get('connected_service') as string,
        reference_number: formData.get('reference_number') as string,
        provider_name: formData.get('provider_name') as string,
        description: formData.get('description') as string,
        notes: formData.get('notes') as string,
        sede_it: formData.get('sede_it') as string,
        sede_pe: formData.get('sede_pe') as string,
        metodo_it: formData.get('metodo_it') as string,
        metodo_pe: formData.get('metodo_pe') as string,
        original_amount,
        currency: formData.get('currency') as string || 'EUR',
        exchange_rate,
        amount_eur,
        proof_path: uploadResult?.path || formData.get('proof_path_existing') as string || null,
        additional_files: additional_files_data
    }

    const { error } = await supabaseAdmin
        .from('corporate_expenses')
        .update(updateData)
        .eq('id', id)

    if (error) {
        console.error('Error updating expense:', error)
        return { error: error.message }
    }

    await recordAuditLog({
        actorId: user.id,
        action: 'update',
        resourceType: 'corporate_expenses',
        resourceId: id,
        newValues: updateData,
        metadata: { method: 'updateExpense' }
    })

    revalidatePath('/chimi-gastos')
    return { success: true }
}

export async function getExpenseDocumentUrl(path: string) {
    const { getFileUrl } = await import('@/lib/storage')
    return await getFileUrl(path)
}
