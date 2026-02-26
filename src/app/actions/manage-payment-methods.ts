'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"

export interface PaymentMethod {
    id: string
    name: string
    is_active: boolean
    sort_order: number
}

/**
 * Fetches active payment methods for Italy
 */
export async function getPaymentMethodsIT() {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
        .from('payment_methods_it')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
    
    if (error) {
        console.error('Error fetching payment methods IT:', error)
        return []
    }
    return data as PaymentMethod[]
}

/**
 * Fetches active payment methods for Peru
 */
export async function getPaymentMethodsPE() {
    const supabase = supabaseAdmin
    const { data, error } = await supabase
        .from('payment_methods_pe')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
    
    if (error) {
        console.error('Error fetching payment methods PE:', error)
        return []
    }
    return data as PaymentMethod[]
}
