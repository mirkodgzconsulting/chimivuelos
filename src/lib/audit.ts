import { supabaseAdmin } from "@/lib/supabase/admin"

function getChanges(oldVal: Record<string, unknown> | null, newVal: Record<string, unknown> | null) {
    if (!oldVal || !newVal) return newVal
    const changes: Record<string, unknown> = {}
    
    // Normalize comparison: null, undefined and empty string are treated as same
    const normalize = (v: unknown) => {
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'object') return JSON.stringify(v);
        return String(v);
    };

    Object.keys(newVal).forEach(key => {
        const normOld = normalize(oldVal[key]);
        const normNew = normalize(newVal[key]);
        
        if (normOld !== normNew) {
            changes[key] = newVal[key];
        }
    });

    return Object.keys(changes).length > 0 ? changes : null
}

/**
 * Records an action in the audit logs
 */
export async function recordAuditLog({
    actorId,
    action,
    resourceType,
    resourceId,
    oldValues,
    newValues,
    metadata
}: {
    actorId: string
    action: 'create' | 'update' | 'delete' | 'approve_edit' | 'reject_edit'
    resourceType: string
    resourceId: string
    oldValues?: Record<string, unknown> | null
    newValues?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
}) {
    try {
        let finalNewValues = newValues
        if (action === 'update' && oldValues && newValues) {
            finalNewValues = getChanges(oldValues, newValues)
            if (!finalNewValues) return // Skip if no changes detected
        }

        const { error } = await supabaseAdmin.from('audit_logs').insert({
            actor_id: actorId,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            old_values: oldValues,
            new_values: finalNewValues,
            metadata: metadata
        })

        if (error) {
            console.error('Failed to record audit log:', error)
        }
    } catch (error) {
        console.error('Audit log error:', error)
    }
}
