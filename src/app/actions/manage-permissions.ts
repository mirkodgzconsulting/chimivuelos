'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { recordAuditLog } from "@/lib/audit"

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
 * Maps resource types to their table names in Supabase
 */
const RESOURCE_TABLE_MAP: Record<string, string> = {
    'flights': 'flights',
    'money_transfers': 'money_transfers',
    'parcels': 'parcels',
    'translations': 'translations',
    'other_services': 'other_services'
}

/**
 * Creates or updates an edit request for an agent (Draft & Approval system)
 */
export async function createEditRequest(resourceType: string, resourceId: string, reason: string, metadata: Record<string, unknown> = {}) {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // Check if there's already a pending request for this resource by ANY agent
        const { data: existing } = await supabaseAdmin
            .from('edit_requests')
            .select('id, agent_id')
            .eq('resource_type', resourceType)
            .eq('resource_id', resourceId)
            .eq('status', 'pending')
            .single()

        if (existing) {
            // If it's the same agent, update the draft. If different, block (Scenario B)
            if (existing.agent_id !== user.id) {
                const { data: agent } = await supabaseAdmin.from('profiles').select('first_name, last_name').eq('id', existing.agent_id).single()
                throw new Error(`Ya existe una solicitud pendiente para este registro enviada por ${agent?.first_name || 'otro agente'}.`)
            }

            // Scenario A: Update existing draft
            const { error } = await supabaseAdmin
                .from('edit_requests')
                .update({
                    reason: reason,
                    metadata: metadata,
                    created_at: new Date().toISOString() // Refresh timestamp
                })
                .eq('id', existing.id)

            if (error) throw error
        } else {
            // Create new request
            const { error } = await supabaseAdmin.from('edit_requests').insert({
                agent_id: user.id,
                resource_type: resourceType,
                resource_id: resourceId,
                reason: reason,
                status: 'pending',
                metadata: { 
                    ...metadata, 
                    original_created_at: new Date().toISOString() 
                }
            })

            if (error) throw error
        }

        revalidatePath('/admin/permissions')
        return { success: true }
    } catch (error) {
        console.error('Error creating/updating edit request:', error)
        return { error: (error as Error).message }
    }
}

/**
 * Approves an edit request and applies the draft data to the source table
 */
export async function approveEditRequest(requestId: string) {
    const supabase = await createClient()
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        // Check if user is admin
        const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin' && profile?.role !== 'supervisor') throw new Error('Permissions denied')

        // 1. Fetch the request details
        const { data: request, error: reqError } = await supabaseAdmin
            .from('edit_requests')
            .select('*')
            .eq('id', requestId)
            .single()

        if (reqError || !request) return { success: false, error: 'Request not found' }
        
        const draftData = request.metadata?.draftData as Record<string, unknown>
        if (!draftData) throw new Error('No hay datos de borrador para aplicar')

        const tableName = RESOURCE_TABLE_MAP[request.resource_type]
        if (!tableName) throw new Error('Tipo de recurso no reconocido')

        // 2. Fetch OLD values for audit log
        const { data: oldValues } = await supabaseAdmin
            .from(tableName)
            .select('*')
            .eq('id', request.resource_id)
            .single()

        // 3. APPLY CHANGE TO SOURCE TABLE
        const { error: updateError } = await supabaseAdmin
            .from(tableName)
            .update(draftData)
            .eq('id', request.resource_id)

        if (updateError) throw updateError

        // 4. RECORD AUDIT LOG (with 'approve_edit' action)
        await recordAuditLog({
            actorId: user.id,
            action: 'approve_edit',
            resourceType: request.resource_type,
            resourceId: request.resource_id,
            oldValues: oldValues,
            newValues: draftData,
            metadata: {
                requestId: requestId,
                agentId: request.agent_id,
                reason: request.reason,
                displayId: request.metadata?.displayId
            }
        })

        // 5. Update request status
        const { error: updateReqError } = await supabaseAdmin.from('edit_requests').update({
            status: 'approved',
            admin_id: user.id,
            approved_at: new Date().toISOString()
        }).eq('id', requestId)

        if (updateReqError) throw updateReqError
        
        const RESOURCE_PATH_MAP: Record<string, string> = {
            'flights': '/chimi-vuelos',
            'money_transfers': '/chimi-giros',
            'parcels': '/chimi-encomiendas',
            'translations': '/chimi-traducciones',
            'other_services': '/chimi-otros-servicios'
        }

        const resourcePath = RESOURCE_PATH_MAP[request.resource_type]
        if (resourcePath) revalidatePath(resourcePath)
        
        revalidatePath('/admin/permissions')
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
        if (profile?.role !== 'admin' && profile?.role !== 'supervisor') throw new Error('Permissions denied')

        const { error } = await supabaseAdmin.from('edit_requests').update({
            status: 'rejected',
            admin_id: user.id
        }).eq('id', requestId)

        if (error) throw error

        revalidatePath('/admin/permissions')
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
export async function getAllEditRequests(page: number = 1, limit: number = 20, filters?: { agentId?: string, resourceType?: string, startDate?: string, endDate?: string, search?: string, status?: string }) {
    try {
        const from = (page - 1) * limit
        const to = from + limit - 1

        let query = supabaseAdmin
            .from('edit_requests')
            .select('*, agent:agent_id(first_name, last_name, email)', { count: 'exact' })

        if (filters?.agentId) {
            query = query.eq('agent_id', filters.agentId);
        }
        if (filters?.resourceType) {
            query = query.eq('resource_type', filters.resourceType);
        }
        if (filters?.status) {
            query = query.eq('status', filters.status);
        }
        if (filters?.startDate) {
            query = query.gte('created_at', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('created_at', filters.endDate);
        }
        if (filters?.search) {
            query = query.ilike('metadata->>displayId', `%${filters.search}%`);
        }

        const { data, error, count } = await query
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
export async function getAuditLogs(page: number = 1, limit: number = 50, filters?: { agentId?: string, resourceType?: string, startDate?: string, endDate?: string, search?: string }) {
    try {
        const from = (page - 1) * limit
        const to = from + limit - 1

        let query = supabaseAdmin
            .from('audit_logs')
            .select('*, actor:actor_id(first_name, last_name, email)', { count: 'exact' })
            .neq('action', 'create')

        if (filters?.agentId) {
            query = query.eq('actor_id', filters.agentId);
        }
        if (filters?.resourceType) {
            query = query.eq('resource_type', filters.resourceType);
        }
        if (filters?.startDate) {
            query = query.gte('created_at', filters.startDate);
        }
        if (filters?.endDate) {
            query = query.lte('created_at', filters.endDate);
        }
        if (filters?.search) {
            // Search in metadata->displayId using ilike if possible, or just exact match
            query = query.ilike('metadata->>displayId', `%${filters.search}%`);
        }

        const { data, error, count } = await query
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
/**
 * Gets map of resource IDs with pending requests and who sent them
 */
export async function getPendingResourceDetails(resourceType?: string) {
    try {
        let query = supabaseAdmin
            .from('edit_requests')
            .select('resource_id, agent:agent_id(first_name, last_name)')
            .eq('status', 'pending')
        
        if (resourceType) {
            query = query.eq('resource_type', resourceType)
        }

        const { data, error } = await query
        
        if (error) throw error
        
        const details: Record<string, string> = {}
        data?.forEach(req => {
            const agent = req.agent as unknown as { first_name: string, last_name: string } | null
            details[req.resource_id] = agent ? `${agent.first_name} ${agent.last_name}` : 'Otro agente'
        })
        
        return details
    } catch (error) {
        console.error('Error fetching pending resource details:', error)
        return {}
    }
}
