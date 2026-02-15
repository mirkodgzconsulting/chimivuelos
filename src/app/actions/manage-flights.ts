'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { uploadClientFile, deleteFileFromR2, deleteImageFromCloudflare, getFileUrl } from "@/lib/storage"

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
export async function createFlight(formData: FormData) {
    const supabase = supabaseAdmin

    try {
        const client_id = formData.get('client_id') as string // UUID of the client
        const travel_date = formData.get('travel_date') as string
        const pnr = formData.get('pnr') as string
        const itinerary = formData.get('itinerary') as string
        const cost = parseFloat(formData.get('cost') as string) || 0
        const on_account = parseFloat(formData.get('on_account') as string) || 0
        const balance = parseFloat(formData.get('balance') as string) || (cost - on_account)
        const status = formData.get('status') as string || 'pending'

        // Handle Documents
        // Since input fields are dynamic (title_0, file_0, title_1, file_1...), we loop
        const documents: FlightDocument[] = []
        let index = 0
        while (formData.has(`document_title_${index}`)) {
            const title = formData.get(`document_title_${index}`) as string
            const file = formData.get(`document_file_${index}`) as File

            if (file && file.size > 0) {
                // Upload reusing client logic
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

        const { error } = await supabase.from('flights').insert({
            client_id,
            travel_date,
            pnr,
            itinerary,
            cost,
            on_account,
            balance,
            status,
            documents: documents as unknown
        })

        if (error) throw error

        revalidatePath('/flights')
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
    const supabase = supabaseAdmin
    const id = formData.get('id') as string // Fight ID

    try {
        // Fetch existing flight to merge documents
        const { data: existingFlight } = await supabase.from('flights').select('documents, client_id').eq('id', id).single()
        if (!existingFlight) throw new Error('Flight not found')

        const client_id = existingFlight.client_id // Can't change client
        const travel_date = formData.get('travel_date') as string
        const pnr = formData.get('pnr') as string
        const itinerary = formData.get('itinerary') as string
        const cost = parseFloat(formData.get('cost') as string) || 0
        const on_account = parseFloat(formData.get('on_account') as string) || 0
        const balance = parseFloat(formData.get('balance') as string) || (cost - on_account)
        const status = formData.get('status') as string

        // Build new documents array (Start with existing ones that weren't deleted)
        const currentDocuments: FlightDocument[] = (existingFlight.documents as unknown as FlightDocument[]) || []

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

        const { error } = await supabase.from('flights').update({
            travel_date,
            pnr,
            itinerary,
            cost,
            on_account,
            balance,
            status,
            documents: currentDocuments as unknown // Cast for Supabase JSONB
        }).eq('id', id)

        if (error) throw error

        revalidatePath('/flights')
        return { success: true }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Error updating flight'
        return { error: errorMessage }
    }
}

/**
 * Update only the status of a flight (Inline Edit)
 */
export async function updateFlightStatus(id: string, status: string) {
    const supabase = supabaseAdmin
    try {
        const { error } = await supabase.from('flights').update({ status }).eq('id', id)
        if (error) throw error
        revalidatePath('/flights')
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
    const supabase = supabaseAdmin

    try {
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

        revalidatePath('/flights')
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

        revalidatePath('/flights')
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
    // Join with profiles table to get client names
    const { data, error } = await supabase
        .from('flights')
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
