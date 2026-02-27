'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface EditRequest {
    id: string
    agent_id: string
    resource_type: string
    resource_id: string
    reason: string
    status: 'pending' | 'approved' | 'rejected'
    admin_id?: string
    approved_at?: string
    expires_at?: string
    metadata?: {
        displayId?: string;
        [key: string]: unknown;
    }
    created_at: string
}

/**
 * Creates a new edit request for an agent
 */
export async function createEditRequest(resourceType: string, resourceId: string, reason: string, metadata: unknown = {}) {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { error } = await supabaseAdmin.from('edit_requests').insert({
            agent_id: user.id,
            resource_type: resourceType,
            resource_id: resourceId,
            reason: reason,
            status: 'pending',
            metadata: metadata
        })

        if (error) throw error

        revalidatePath('/dashboard') // Or specific pages
        return { success: true }
    } catch (error) {
        console.error('Error creating edit request:', error)
        return { error: (error as Error).message }
    }
}

/**
 * Approves an edit request
 */
export async function approveEditRequest(requestId: string, expirationMinutes: number = 60) {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // Check if user is admin
        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin') throw new Error('Permissions denied')

        const expiresAt = new Date(Date.now() + expirationMinutes * 60000).toISOString()

        const { error } = await supabaseAdmin.from('edit_requests').update({
            status: 'approved',
            admin_id: user.id,
            approved_at: new Date().toISOString(),
            expires_at: expiresAt
        }).eq('id', requestId)

        if (error) throw error

        return { success: true }
    } catch (error) {
        console.error('Error approving edit request:', error)
        return { error: (error as Error).message }
    }
}

/**
 * Rejects an edit request
 */
export async function rejectEditRequest(requestId: string) {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin') throw new Error('Permissions denied')

        const { error } = await supabaseAdmin.from('edit_requests').update({
            status: 'rejected',
            admin_id: user.id
        }).eq('id', requestId)

        if (error) throw error

        return { success: true }
    } catch (error) {
        console.error('Error rejecting edit request:', error)
        return { error: (error as Error).message }
    }
}

/**
 * Consumes/Expires an approved edit permission
 */
export async function consumeEditPermission(resourceType: string, resourceId: string) {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        await supabaseAdmin
            .from('edit_requests')
            .update({ expires_at: new Date().toISOString() })
            .eq('agent_id', user.id)
            .eq('resource_type', resourceType)
            .eq('resource_id', resourceId)
            .eq('status', 'approved')
    } catch (error) {
        console.error('Error consuming permission:', error)
    }
}

/**
 * Checks if an agent has an active approved permission for a resource, and returns details to tie to audit logs.
 */
export async function getActivePermissionDetails(resourceType: string, resourceId: string) {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { hasPermission: false }

        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
        const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor'

        // Check for ANY approved and non-expired request (even for admins, to track their explicit requests)
        const { data: req } = await supabaseAdmin
            .from('edit_requests')
            .select('id, reason')
            .eq('agent_id', user.id)
            .eq('resource_type', resourceType)
            .eq('resource_id', resourceId)
            .eq('status', 'approved')
            .gt('expires_at', new Date().toISOString())
            .order('approved_at', { ascending: false })
            .limit(1)
            .single()

        if (req) {
            return { hasPermission: true, requestId: req.id, reason: req.reason }
        }

        if (isAdmin) {
            return { hasPermission: true, requestId: 'admin_direct', reason: 'Edición Directa' }
        }

        return { hasPermission: false }
    } catch (error) {
        console.error('Error fetching permission details:', error)
        return { hasPermission: false }
    }
}

/**
 * Gets pending requests for admin
 */
export async function getPendingEditRequests() {
    try {
        const { data, error } = await supabaseAdmin
            .from('edit_requests')
            .select('*, agent:agent_id(first_name, last_name, email)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
        
        if (error) throw error
        return data as (EditRequest & { agent: { first_name: string, last_name: string, email: string } })[]
    } catch (error) {
        console.error('Error fetching pending requests:', error)
        return []
    }
}
/**
 * Gets all requests for admin with pagination
 */
export async function getAllEditRequests(page: number = 1, limit: number = 20) {
    try {
        const from = (page - 1) * limit
        const to = from + limit - 1

        const { data, error, count } = await supabaseAdmin
            .from('edit_requests')
            .select('*, agent:agent_id(first_name, last_name, email)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)
        
        if (error) throw error
        return { 
            data: data as (EditRequest & { agent: { first_name: string, last_name: string, email: string } })[],
            count: count || 0
        }
    } catch (error) {
        console.error('Error fetching all requests:', error)
        return { data: [], count: 0 }
    }
}

/**
 * Gets audit logs for admin
 */
export async function getAuditLogs(page: number = 1, limit: number = 50) {
    try {
        const from = (page - 1) * limit
        const to = from + limit - 1

        const { data, error, count } = await supabaseAdmin
            .from('audit_logs')
            .select('*, actor:actor_id(first_name, last_name, email)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)
        
        if (error) throw error
        return { 
            data: data || [],
            count: count || 0
        }
    } catch (error) {
        console.error('Error fetching audit logs:', error)
        return { data: [], count: 0 }
    }
}
/**
 * Gets all active approved permissions for the current agent
 */
export async function getActivePermissions() {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const { data: requests } = await supabaseAdmin
            .from('edit_requests')
            .select('resource_id')
            .eq('agent_id', user.id)
            .eq('status', 'approved')
            .gt('expires_at', new Date().toISOString())

        return (requests || []).map(r => r.resource_id)
    } catch (error) {
        console.error('Error fetching active permissions:', error)
        return []
    }
}
/**
 * Gets the count of pending requests
 */
export async function getPendingRequestsCount() {
    try {
        const { count, error } = await supabaseAdmin
            .from('edit_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
        
        if (error) throw error
        return count || 0
    } catch (error) {
        console.error('Error fetching pending count:', error)
        return 0
    }
}
