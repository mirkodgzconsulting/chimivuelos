'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

// --- HELPER TO GET CURRENT CLIENT ---
export async function getClientUser() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    // Check if user exists and is a client (optional security check)
    // RLS will enforce data access anyway
    if (error || !user) return null
    return user
}

// --- DASHBOARD SUMMARY ---
export async function getMyDashboardSummary() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { flights: 0, parcels: 0, transfers: 0 }

    try {
        // Run counts in parallel
        const [flights, parcels, transfers] = await Promise.all([
            supabase.from('flights').select('*', { count: 'exact', head: true }).eq('client_id', user.id).neq('status', 'finished'),
            supabase.from('parcels').select('*', { count: 'exact', head: true }).eq('sender_id', user.id).neq('status', 'delivered'),
            supabase.from('money_transfers').select('*', { count: 'exact', head: true }).eq('sender_id', user.id).neq('status', 'completed')
        ])

        return {
            flights: flights.count || 0,
            parcels: parcels.count || 0,
            transfers: transfers.count || 0
        }
    } catch (error) {
        console.error('Error fetching dashboard summary:', error)
        return { flights: 0, parcels: 0, transfers: 0 }
    }
}

// --- TERMS & CONDITIONS LOGIC ---
export async function getActiveTerms(serviceType: 'flight' | 'parcel' | 'transfer') {
    const supabase = await createClient()
    
    // Fetch the latest active version
    const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('service_type', serviceType)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single()
    
    if (error) {
        console.error(`Error fetching terms for ${serviceType}:`, error)
        return null
    }
    return data
}

export async function acceptServiceTerms(serviceId: string, serviceType: 'flight' | 'parcel' | 'transfer', version: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { error: 'Unauthorized' }

    // Capture Audit Data
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    const auditData = {
        terms_accepted_at: new Date().toISOString(),
        terms_version: version,
        terms_ip: ip,
        terms_metadata: { 
            user_agent: userAgent, 
            device: 'web_portal',
            timestamp: Date.now() 
        }
    }

    // Ownership check field varies by table
    let ownerField = 'client_id'
    let tableName = ''

    if (serviceType === 'flight') {
        tableName = 'flights'
        ownerField = 'client_id'
    } else if (serviceType === 'parcel') {
        tableName = 'parcels'
        ownerField = 'sender_id' // Verified in manage-parcels.ts
    } else if (serviceType === 'transfer') {
        tableName = 'money_transfers'
        ownerField = 'client_id' // Verified: transfers use client_id
    }

    // Update with Admin Client to bypass RLS
    // We manually verify ownership: .eq(ownerField, user.id)
    const { data: updated, error } = await supabaseAdmin
        .from(tableName)
        .update(auditData)
        .eq('id', serviceId)
        .eq(ownerField, user.id)
        .select()

    if (error) {
        console.error(`Error accepting terms for ${serviceType} ${serviceId}:`, JSON.stringify(error, null, 2))
        return { error: `Error técnico: ${error.message}` }
    }

    if (!updated || updated.length === 0) {
        console.error(`Terms acceptance failed: Record not found or ownership mismatch for ${serviceType} ${serviceId} (User: ${user.id})`)
        return { error: 'No se pudo verificar la propiedad del servicio o el servicio no existe.' }
    }

    return { success: true }
}

// --- DATA FETCHERS (With Terms Check) ---
export async function getMyFlights() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('flights')
        .select(`
            *,
            profiles:client_id (
                first_name,
                last_name
            )
        `)
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
    
    return data || []
}

export async function getMyParcels() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('parcels')
        .select('*')
        .eq('sender_id', user.id) // Corrected from client_id
        .order('created_at', { ascending: false })
    
    return data || []
}

export async function getMyTransfers() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('money_transfers')
        .select('*')
        .eq('client_id', user.id) 
        .order('created_at', { ascending: false })
    
    return data || []
}

export async function getFlightById(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('flights')
        .select('*')
        .eq('id', id)
        .eq('client_id', user.id)
        .single()
    
    if (error) return null
    return data
}

export async function getTransferById(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('money_transfers')
        .select('*')
        .eq('id', id)
        .eq('client_id', user.id)
        .single()
    
    if (error) return null
    return data
}

export async function getParcelById(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('parcels')
        .select('*')
        .eq('id', id)
        .eq('sender_id', user.id)
        .single()
    
    if (error) return null
    return data
}
