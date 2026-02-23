'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { uploadClientFile, deleteFileFromR2, deleteImageFromCloudflare, getFileUrl } from "@/lib/storage"
import { checkEditPermission, consumeEditPermission } from "./manage-permissions"
import { recordAuditLog } from "@/lib/audit"

/**
 * Interface for Flight Document
 */
export interface FlightDocument {
    title: string
    path: string
    name: string
    type: string
    size: number
    storage: 'r2' | 'images'
}

/**
 * Creates a new flight record
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

export async function createFlight(formData: FormData) {
    const supabase = await createClient()
    const adminSupabase = supabaseAdmin

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const client_id = formData.get('client_id') as string
        const travel_date = formData.get('travel_date') as string || null
        const pnr = formData.get('pnr') as string
        const itinerary = formData.get('itinerary') as string
        const cost = parseFloat(formData.get('cost') as string) || 0
        const status = formData.get('status') as string || 'Programado'
        
        const return_date = formData.get('return_date') as string || null
        const sold_price = parseFloat(formData.get('sold_price') as string) || 0
        const payment_method_it = formData.get('payment_method_it') as string
        const payment_method_pe = formData.get('payment_method_pe') as string
        
        let details = {}
        try {
            const detailsStr = formData.get('details') as string
            if (detailsStr) details = JSON.parse(detailsStr)
        } catch (e) {
            console.error('Error parsing details:', e)
        }

        // Handle Payment Details
        const payment_quantity_str = formData.get('payment_quantity') as string
        const payment_quantity = parseFloat(payment_quantity_str) || 0
        const payment_exchange_rate = parseFloat(formData.get('payment_exchange_rate') as string) || 1.0
        
        let payment_proof_path = null
        const payment_details: PaymentDetail[] = []
        
        // Handle Multi Payments if sent as JSON
        const multiPaymentsStr = formData.get('multi_payments') as string
        if (multiPaymentsStr) {
            try {
                const multiPayments = JSON.parse(multiPaymentsStr) as PaymentDetail[]
                
                // For each temp payment, check if there's a corresponding proof file
                for (let i = 0; i < multiPayments.length; i++) {
                    const tempFile = formData.get(`payment_proof_${i}`) as File
                    if (tempFile && tempFile.size > 0) {
                        const uploadResult = await uploadClientFile(tempFile, client_id)
                        multiPayments[i].proof_path = uploadResult.path
                        // If multiple proofs, the "main" one for the flight record will be the last one assigned here
                        // though each payment detail has its own path.
                        payment_proof_path = uploadResult.path
                    }
                }
                
                payment_details.push(...multiPayments)
            } catch (e) {
                console.error('Error parsing multi_payments:', e)
            }
        }

        // Handle Single Payment (legacy/fallback)
        if (payment_quantity > 0) {
            const proofFile = formData.get('payment_proof_file') as File
            if (proofFile && proofFile.size > 0) {
                const uploadResult = await uploadClientFile(proofFile, client_id)
                payment_proof_path = uploadResult.path
            }

            const currency = formData.get('payment_currency') as string || 'EUR'
            const original_amount = formData.get('payment_original_amount') as string || payment_quantity_str
            
            payment_details.push({
                sede_it: formData.get('sede_it') as string,
                sede_pe: formData.get('sede_pe') as string,
                metodo_it: payment_method_it,
                metodo_pe: payment_method_pe,
                cantidad: payment_quantity.toString(),
                tipo_cambio: payment_exchange_rate,
                total: formData.get('payment_total_display') as string || `${currency} ${original_amount}`,
                moneda: currency,
                monto_original: original_amount,
                created_at: new Date().toISOString(),
                proof_path: payment_proof_path || undefined
            })
        }

        let totalOnAccount = 0
        payment_details.forEach(p => totalOnAccount += parseFloat(p.cantidad) || 0)

        const on_account = totalOnAccount
        const balance = sold_price - on_account
        const fee_agv = sold_price - cost

        // Handle Documents
        const documents: FlightDocument[] = []
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

        const ticket_type = formData.get('ticket_type') as string

        const { error } = await adminSupabase.from('flights').insert({
            client_id,
            travel_date,
            pnr,
            itinerary,
            cost,
            on_account,
            balance,
            status,
            agent_id: user.id,
            details,
            return_date,
            sold_price,
            fee_agv,
            payment_method_it,
            payment_method_pe,
            payment_details,
            payment_proof_path,
            exchange_rate: payment_exchange_rate,
            ticket_type,
            pax_adt: parseInt(formData.get('pax_adt') as string) || 0,
            pax_chd: parseInt(formData.get('pax_chd') as string) || 0,
            pax_inf: parseInt(formData.get('pax_inf') as string) || 0,
            pax_total: parseInt(formData.get('pax_total') as string) || 0,
            iata_gds: formData.get('iata_gds') as string
        })

        if (error) throw error

        revalidatePath('/chimi-vuelos')
        return { success: true }

    } catch (error: unknown) {
        console.error('Error creating flight:', error)
        const errorMessage = error instanceof Error ? error.message : 'Error creating flight'
        return { error: errorMessage }
    }
}

/**
 * Updates an existing flight
 */
export async function updateFlight(formData: FormData) {
    const supabase = await createClient()
    const adminSupabase = supabaseAdmin
    const id = formData.get('id') as string

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
        const userRole = profile?.role || 'client'

        if (userRole === 'agent' || userRole === 'usuario') {
            const hasPermission = await checkEditPermission('flights', id)
            if (!hasPermission) {
                throw new Error('No tienes permiso para editar este vuelo. Debes solicitar autorización.')
            }
        } else if (userRole !== 'admin') {
            throw new Error('Acceso denegado')
        }

        const { data: existingFlight } = await adminSupabase.from('flights').select('*').eq('id', id).single()
        if (!existingFlight) throw new Error('Flight not found')

        // Deep clone for audit log comparison
        const oldValues = JSON.parse(JSON.stringify(existingFlight))

        const client_id = existingFlight.client_id
        const travel_date = formData.get('travel_date') as string || null
        const pnr = formData.get('pnr') as string
        const itinerary = formData.get('itinerary') as string
        const cost = parseFloat(formData.get('cost') as string) || 0
        const status = formData.get('status') as string

        const return_date = formData.get('return_date') as string || null
        const sold_price = parseFloat(formData.get('sold_price') as string) || 0
        const payment_method_it = formData.get('payment_method_it') as string
        const payment_method_pe = formData.get('payment_method_pe') as string

        let details = {}
        try {
            const detailsStr = formData.get('details') as string
            if (detailsStr) details = JSON.parse(detailsStr)
        } catch (e) {
            console.error('Error parsing details:', e)
        }

        // Handle Payment Details
        const payment_quantity_str = formData.get('payment_quantity') as string
        const payment_quantity = parseFloat(payment_quantity_str) || 0
        const payment_exchange_rate = parseFloat(formData.get('payment_exchange_rate') as string) || 1.0
        
        const currentPayments = (existingFlight.payment_details as PaymentDetail[]) || []

        // Handle Multi Payments if sent as JSON
        const multiPaymentsStr = formData.get('multi_payments') as string
        if (multiPaymentsStr) {
            try {
                const multiPayments = JSON.parse(multiPaymentsStr) as PaymentDetail[]
                
                // For each temp payment, check if there's a corresponding proof file
                for (let i = 0; i < multiPayments.length; i++) {
                    const tempFile = formData.get(`payment_proof_${i}`) as File
                    if (tempFile && tempFile.size > 0) {
                        const uploadResult = await uploadClientFile(tempFile, client_id)
                        multiPayments[i].proof_path = uploadResult.path
                    }
                }

                currentPayments.push(...multiPayments)
            } catch (e) {
                console.error('Error parsing multi_payments:', e)
            }
        }

        // Handle Payment Proof
        let payment_proof_path = existingFlight.payment_proof_path
        const proofFile = formData.get('payment_proof_file') as File
        if (proofFile && proofFile.size > 0) {
            const uploadResult = await uploadClientFile(proofFile, client_id)
            payment_proof_path = uploadResult.path
        }

        // Handle Single Payment (legacy/fallback)
        if (payment_quantity > 0) {
            const currency = formData.get('payment_currency') as string || 'EUR'
            const original_amount = formData.get('payment_original_amount') as string || payment_quantity_str

            const newPayment: PaymentDetail = {
                sede_it: (formData.get('sede_it') as string) || '',
                sede_pe: (formData.get('sede_pe') as string) || '',
                metodo_it: (formData.get('payment_method_it') as string) || '',
                metodo_pe: (formData.get('payment_method_pe') as string) || '',
                cantidad: payment_quantity.toString(),
                tipo_cambio: payment_exchange_rate,
                total: formData.get('payment_total_display') as string || `${currency} ${original_amount}`,
                moneda: currency,
                monto_original: original_amount,
                created_at: new Date().toISOString(),
                proof_path: payment_proof_path || undefined
            }
            currentPayments.push(newPayment)
        }

        let totalOnAccount = 0
        currentPayments.forEach((p: PaymentDetail) => {
            totalOnAccount += parseFloat(p.cantidad) || 0
        })



        const currentDocuments: FlightDocument[] = (existingFlight.documents as unknown as FlightDocument[]) || []
        let docIndex = 0
        while (formData.has(`document_title_${docIndex}`)) {
            const title = formData.get(`document_title_${docIndex}`) as string
            const file = formData.get(`document_file_${docIndex}`) as File

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
            docIndex++
        }

        const on_account = totalOnAccount 
        const balance = sold_price - on_account
        const fee_agv = sold_price - cost

        const ticket_type = formData.get('ticket_type') as string

        const { error } = await adminSupabase.from('flights').update({
            travel_date,
            pnr,
            itinerary,
            cost,
            on_account,
            balance,
            status,
            details,
            return_date,
            sold_price,
            fee_agv,
            payment_method_it,
            payment_method_pe,
            payment_details: currentPayments,
            payment_proof_path,
            exchange_rate: payment_exchange_rate,
            documents: currentDocuments as unknown,
            ticket_type,
            pax_adt: parseInt(formData.get('pax_adt') as string) || 0,
            pax_chd: parseInt(formData.get('pax_chd') as string) || 0,
            pax_inf: parseInt(formData.get('pax_inf') as string) || 0,
            pax_total: parseInt(formData.get('pax_total') as string) || 0,
            iata_gds: formData.get('iata_gds') as string
        }).eq('id', id)

        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'flights',
            resourceId: id,
            oldValues: oldValues,
            newValues: { 
                travel_date, 
                return_date,
                pnr, 
                itinerary, 
                cost, 
                sold_price, 
                status,
                on_account,
                balance,
                payment_details: currentPayments
            },
            metadata: { 
                method: 'updateFlight',
                displayId: pnr || undefined
            }
        })

        // Consume permission if agent
        if (userRole === 'agent') {
            await consumeEditPermission('flights', id)
        }

        revalidatePath('/chimi-vuelos')
        return { success: true }

    } catch (error: unknown) {
        console.error('Error updating flight:', error)
        const errorMessage = error instanceof Error ? error.message : 'Error updating flight'
        return { error: errorMessage }
    }
}

/**
 * Update only the status of a flight (Inline Edit)
 */
export async function updateFlightStatus(id: string, status: string) {
    const supabase = await createClient()
    const adminSupabase = supabaseAdmin
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // Fetch flight info for audit log
        const { data: flightRecord } = await adminSupabase.from('flights').select('*').eq('id', id).single()

        const { error } = await adminSupabase.from('flights').update({ status }).eq('id', id)
        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'flights',
            resourceId: id,
            oldValues: flightRecord,
            newValues: { status },
            metadata: { 
                method: 'updateFlightStatus',
                displayId: flightRecord?.pnr || undefined
            }
        })

        revalidatePath('/chimi-vuelos')
        return { success: true }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error updating status'
        return { error: errorMessage }
    }
}

/**
 * Delete a flight and all its documents
 */
export async function deleteFlight(id: string) {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin') {
            throw new Error('Solo los administradores pueden eliminar vuelos.')
        }

        // Get documents to delete them from storage
        const { data: flight } = await supabase.from('flights').select('documents').eq('id', id).single()
        
        if (flight && flight.documents) {
            const docs = flight.documents as unknown as FlightDocument[]
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

        const { error } = await supabase.from('flights').delete().eq('id', id)
        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'delete',
            resourceType: 'flights',
            resourceId: id,
            metadata: { method: 'deleteFlight' }
        })

        revalidatePath('/chimi-vuelos')
        return { success: true }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error deleting flight'
        return { error: errorMessage }
    }
}

/**
 * Delete a specific document from a flight
 */
export async function deleteFlightDocument(flightId: string, docPath: string) {
    const supabase = supabaseAdmin
    
    try {
        const { data: flight } = await supabase.from('flights').select('documents').eq('id', flightId).single()
        if (!flight) throw new Error('Flight not found')

        let docs = (flight.documents as unknown as FlightDocument[]) || []
        const docToDelete = docs.find(d => d.path === docPath)

        if (docToDelete) {
             // Delete from storage
             if (docToDelete.storage === 'images' && !docToDelete.path.includes('/')) {
                 await deleteImageFromCloudflare(docToDelete.path)
             } else {
                 await deleteFileFromR2(docToDelete.path)
             }

             // Update DB
             docs = docs.filter(d => d.path !== docPath)
             await supabase.from('flights').update({ documents: docs as unknown }).eq('id', flightId)
        }

        revalidatePath('/chimi-vuelos')
        return { success: true }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error deleting document'
        return { error: errorMessage }
    }
}

/**
 * Get signed URL for a document
 */
export async function getFlightDocumentUrl(path: string, storage: 'r2' | 'images') {
    try {
        const url = await getFileUrl(path, storage)
        return { url }
    } catch (error) {
        console.error('Error generating URL:', error)
        return { error: 'Failed to generate download URL' }
    }
}

/**
 * Get all flights with client details
 */
export async function getFlights() {
    const supabase = supabaseAdmin
    // Join with profiles table to get client names and agent names
    const { data, error } = await supabase
        .from('flights')
        .select(`
            *,
            profiles:client_id (
                first_name,
                last_name,
                email,
                phone
            ),
            agent:agent_id (
                first_name,
                last_name
            )
        `)
        .order('created_at', { ascending: false })
    
    if (error) {
        console.error('Error fetching flights:', error)
        return []
    }
    return data
}

/**
 * Get all clients for the dropdown
 */
export async function getClientsForDropdown() {
    const supabase = supabaseAdmin
    const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .eq('role', 'client') // Assuming only clients
        .order('first_name', { ascending: true })
    return data || []
}

/**
 * Deletes a specific payment from the payment_details array
 */
export async function deleteFlightPayment(flightId: string, paymentIndex: number) {
    const adminSupabase = supabaseAdmin

    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: flight } = await adminSupabase.from('flights').select('*').eq('id', flightId).single()
        if (!flight) throw new Error('Flight not found')

        const oldValues = JSON.parse(JSON.stringify(flight))
        const payments = (flight.payment_details as PaymentDetail[]) || []
        
        // Safety check: index out of bounds
        if (paymentIndex < 0 || paymentIndex >= payments.length) {
            throw new Error('Payment index out of bounds')
        }

        // Remove the payment
        payments.splice(paymentIndex, 1)

        // Recalculate totals
        let totalOnAccount = 0
        payments.forEach(p => totalOnAccount += parseFloat(p.cantidad) || 0)

        const on_account = totalOnAccount
        const balance = (flight.sold_price || 0) - on_account

        const { error } = await adminSupabase.from('flights').update({
            payment_details: payments,
            on_account,
            balance
        }).eq('id', flightId)

        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'flights',
            resourceId: flightId,
            oldValues,
            newValues: { payment_details: payments, on_account, balance },
            metadata: { 
                method: 'deleteFlightPayment',
                displayId: flight.pnr || undefined
            }
        })
        
        revalidatePath('/chimi-vuelos')
        return { success: true }
    } catch (error) {
        console.error('Error deleting payment:', error)
        return { success: false, error: (error as Error).message }
    }
}

/**
 * Updates a specific payment in the payment_details array
 */
export async function updateFlightPayment(formData: FormData) {
    const adminSupabase = supabaseAdmin
    const flightId = formData.get('flightId') as string
    const paymentIndex = parseInt(formData.get('paymentIndex') as string)
    const proofFile = formData.get('proofFile') as File | null

    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: flight } = await adminSupabase.from('flights').select('*').eq('id', flightId).single()
        if (!flight) throw new Error('Flight not found')

        const oldValues = JSON.parse(JSON.stringify(flight))
        const payments = (flight.payment_details as PaymentDetail[]) || []
        
        if (paymentIndex < 0 || paymentIndex >= payments.length) {
            throw new Error('Payment index out of bounds')
        }

        let proofPath = payments[paymentIndex].proof_path
        if (proofFile && proofFile.size > 0) {
            const uploadResult = await uploadClientFile(proofFile, flight.client_id)
            proofPath = uploadResult.path
        }

        // Update the payment fields from formData
        const currency = formData.get('moneda') as string || payments[paymentIndex].moneda || 'EUR'
        const original_amount = formData.get('monto_original') as string || formData.get('cantidad_original') as string || payments[paymentIndex].monto_original || payments[paymentIndex].cantidad

        payments[paymentIndex] = {
            ...payments[paymentIndex],
            sede_it: formData.get('sede_it') as string,
            sede_pe: formData.get('sede_pe') as string,
            metodo_it: formData.get('metodo_it') as string,
            metodo_pe: formData.get('metodo_pe') as string,
            cantidad: formData.get('cantidad') as string, // This is expected to be EUR
            tipo_cambio: parseFloat(formData.get('tipo_cambio') as string),
            total: formData.get('total_display') as string || `${currency} ${original_amount}`,
            moneda: currency,
            monto_original: original_amount,
            proof_path: proofPath,
            updated_at: new Date().toISOString()
        }

        // Recalculate totals
        let totalOnAccount = 0
        payments.forEach(p => totalOnAccount += parseFloat(p.cantidad) || 0)

        const on_account = totalOnAccount
        const balance = (flight.sold_price || 0) - on_account

        const { error } = await adminSupabase.from('flights').update({
            payment_details: payments,
            on_account,
            balance
        }).eq('id', flightId)

        if (error) throw error

        // Record Audit Log
        await recordAuditLog({
            actorId: user.id,
            action: 'update',
            resourceType: 'flights',
            resourceId: flightId,
            oldValues,
            newValues: { payment_details: payments, on_account, balance },
            metadata: { 
                method: 'updateFlightPayment',
                displayId: flight.pnr || undefined
            }
        })
        
        revalidatePath('/chimi-vuelos')
        return { success: true }
    } catch (error) {
        console.error('Error updating payment:', error)
        return { success: false, error: (error as Error).message }
    }
}
