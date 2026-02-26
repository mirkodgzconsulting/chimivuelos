'use server'

import { supabaseAdmin } from "@/lib/supabase/admin"

export interface PaymentEntry {
    id: string; // Composite ID or just for unique keys
    serviceType: string;
    clientName: string;
    amountEur: number;
    originalAmount: string;
    currency: string;
    exchangeRate: number;
    method: string;
    country: 'IT' | 'PE';
    date: string;
    pnr?: string;
    branch?: string;
}

export async function getConsolidatedAccounting() {
    const supabase = supabaseAdmin;

    // Fetch all tables that contain payments
    const [
        { data: flights },
        { data: transfers },
        { data: parcels },
        { data: translations },
        { data: others },
        { data: methodsIT },
        { data: methodsPE }
    ] = await Promise.all([
        supabase.from('flights').select('id, created_at, payment_details, pnr, profiles:client_id(first_name, last_name)'),
        supabase.from('money_transfers').select('id, created_at, payment_details, transfer_code, profiles:client_id(first_name, last_name)'),
        supabase.from('parcels').select('id, created_at, payment_details, tracking_code, profiles:sender_id(first_name, last_name)'),
        supabase.from('translations').select('id, created_at, payment_details, tracking_code, profiles:client_id(first_name, last_name)'),
        supabase.from('other_services').select('id, created_at, payment_details, tracking_code, profiles:client_id(first_name, last_name)'),
        supabase.from('payment_methods_it').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('payment_methods_pe').select('*').eq('is_active', true).order('sort_order')
    ]);

    const allPayments: PaymentEntry[] = [];

    const processPayments = (data: { 
        id: string, 
        created_at?: string, 
        payment_details: unknown, 
        pnr?: string,
        transfer_code?: string,
        tracking_code?: string,
        profiles: { first_name: string | null, last_name: string | null } | { first_name: string | null, last_name: string | null }[] | null 
    }[] | null, serviceLabel: string) => {
        if (!data) return;
        data.forEach(item => {
            const payments = item.payment_details as {
                metodo_it?: string,
                metodo_pe?: string,
                cantidad: string,
                monto_original?: string,
                moneda?: string,
                tipo_cambio?: number,
                created_at?: string,
                sede_it?: string,
                sede_pe?: string
            }[];
            if (!payments || !Array.isArray(payments)) return;

            let clientProfile = item.profiles;
            if (Array.isArray(clientProfile)) {
                clientProfile = clientProfile[0] || null;
            }

            const clientName = clientProfile 
                ? `${clientProfile.first_name || ''} ${clientProfile.last_name || ''}`.trim()
                : 'Cliente Desconocido';

            payments.forEach((p, idx) => {
                const methodIT = p.metodo_it;
                const methodPE = p.metodo_pe;

                if (methodIT) {
                    allPayments.push({
                        id: `${item.id}-${serviceLabel}-IT-${idx}`,
                        serviceType: serviceLabel,
                        clientName,
                        amountEur: parseFloat(p.cantidad) || 0,
                        originalAmount: p.monto_original || p.cantidad,
                        currency: p.moneda || 'EUR',
                        exchangeRate: p.tipo_cambio || 1,
                        method: methodIT,
                        country: 'IT',
                        date: p.created_at || item.created_at || new Date().toISOString(),
                        pnr: item.pnr || item.transfer_code || item.tracking_code,
                        branch: p.sede_it
                    });
                }

                if (methodPE) {
                    allPayments.push({
                        id: `${item.id}-${serviceLabel}-PE-${idx}`,
                        serviceType: serviceLabel,
                        clientName,
                        amountEur: parseFloat(p.cantidad) || 0,
                        originalAmount: p.monto_original || p.cantidad,
                        currency: p.moneda || 'EUR',
                        exchangeRate: p.tipo_cambio || 1,
                        method: methodPE,
                        country: 'PE',
                        date: p.created_at || item.created_at || new Date().toISOString(),
                        pnr: item.pnr || item.transfer_code || item.tracking_code,
                        branch: p.sede_pe
                    });
                }
            });
        });
    };

    processPayments(flights, 'Vuelo');
    processPayments(transfers, 'Giro');
    processPayments(parcels, 'Encomienda');
    processPayments(translations, 'Traducción');
    processPayments(others, 'Otro Servicio');

    return {
        payments: allPayments,
        methodsIT: methodsIT || [],
        methodsPE: methodsPE || []
    };
}
