import { supabaseAdmin } from "@/lib/supabase/admin"

const LAST_LOGS: Record<string, { timestamp: number, changes: string }> = {};

function deepNormalize(v: unknown): unknown {
    if (v === null || v === undefined || v === '') return null;
    
    // Handle numeric strings vs numbers
    if (typeof v === 'number') return v.toFixed(2);
    if (typeof v === 'string' && !isNaN(parseFloat(v)) && isFinite(Number(v))) {
        return parseFloat(v).toFixed(2);
    }

    if (Array.isArray(v)) {
        return v.map(deepNormalize);
    }

    if (typeof v === 'object') {
        const sorted: Record<string, unknown> = {};
        Object.keys(v as object).sort().forEach(key => {
            sorted[key] = deepNormalize((v as Record<string, unknown>)[key]);
        });
        return sorted;
    }

    return String(v);
}

/**
 * Detects changes between two objects, ignoring updated_at
 */
export function getChanges(oldVal: Record<string, unknown> | null, newVal: Record<string, unknown> | null) {
    if (!oldVal || !newVal) return newVal
    const changes: Record<string, unknown> = {}
    
    // Use deepNormalize to handle numbers vs strings and nested objects
    Object.keys(newVal).forEach(key => {
        if (key === 'updated_at') return; 
        
        const normOld = JSON.stringify(deepNormalize(oldVal[key]));
        const normNew = JSON.stringify(deepNormalize(newVal[key]));
        
        if (normOld !== normNew) {
            changes[key] = newVal[key];
        }
    });

    return Object.keys(changes).length > 0 ? changes : null
}

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
        const changes = action === 'update' && oldValues && newValues ? getChanges(oldValues, newValues) : newValues
        if (action === 'update' && !changes) return 

        // Deduplication to prevent the "3 rows for 1 request" issue
        const logKey = `${resourceType}:${resourceId}:${action}`
        const changesStr = JSON.stringify(changes)
        const now = Date.now()
        
        if (LAST_LOGS[logKey] && 
            LAST_LOGS[logKey].changes === changesStr && 
            now - LAST_LOGS[logKey].timestamp < 5000) {
            return 
        }
        LAST_LOGS[logKey] = { timestamp: now, changes: changesStr }

        // Ensure new_values contains a full snapshot even for partial updates
        let finalNewValues = newValues;
        if (action === 'update' && oldValues && newValues) {
             finalNewValues = { ...oldValues, ...newValues };
        }

        const { error } = await supabaseAdmin.from('audit_logs').insert({
            actor_id: actorId,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            old_values: oldValues,
            new_values: finalNewValues, 
            metadata: {
                ...metadata,
                changed_keys: changes ? Object.keys(changes) : []
            }
        })

        if (error) {
            console.error('Failed to record audit log:', error)
        }
    } catch (error) {
        console.error('Audit log error:', error)
    }
}
