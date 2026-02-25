'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
    ShieldCheck, 
    History, 
    Clock, 
} from "lucide-react"
import { 
    getAllEditRequests, 
    approveEditRequest, 
    rejectEditRequest, 
    getAuditLogs,
    type EditRequest 
} from "@/app/actions/manage-permissions"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from "@/components/ui/dialog"

interface AuditLog {
    id: string
    created_at: string
    actor_id: string
    action: string
    resource_type: string
    resource_id: string
    old_values: unknown
    new_values: unknown
    metadata?: {
        displayId?: string;
        changed_keys?: string[];
        [key: string]: unknown;
    }
    actor?: {
        first_name: string;
        last_name: string;
        email: string;
    }
}

const FIELD_LABELS: Record<string, string> = {
    status: 'Estado',
    cost: 'Costo/Neto',
    sold_price: 'Venta/Vendido',
    itinerary: 'Itinerario/Ruta',
    travel_date: 'Fecha de Viaje',
    return_date: 'Fecha de Retorno',
    pnr: 'Código PNR',
    on_account: 'Monto a Cuenta (Total)',
    balance: 'Saldo Pendiente',
    payment_details: 'Historial de Pagos',
    expense_details: 'Historial de Gastos',
    amount_sent: 'Monto Enviado',
    amount_received: 'Monto Recibido',
    exchange_rate: 'Tipo de Cambio',
    total_amount: 'Total (Modo Envío)',
    beneficiary_name: 'Nombre Beneficiario',
    beneficiary_document: 'Doc. Beneficiario',
    beneficiary_phone: 'Telf. Beneficiario',
    beneficiary_bank: 'Banco/Sede',
    beneficiary_account: 'Nº Cuenta',
    transfer_code: 'Código Giro',
    recipient_name: 'Nombre Destinatario',
    recipient_phone: 'Telf. Destinatario',
    recipient_address: 'Dirección Destino',
    origin_address: 'Dirección Origen',
    destination_address: 'Dirección Destino',
    package_type: 'Tipo de Paquete',
    package_weight: 'Peso (Kg)',
    package_description: 'Contenido/Detalle',
    shipping_cost: 'Costo de Envío',
    pax_adt: 'Pax Adultos',
    pax_chd: 'Pax Niños',
    pax_inf: 'Pax Infantes',
    pax_total: 'Total de Pasajeros',
    ticket_type: 'Tipo de Ticket/Tarifa',
    iata_gds: 'IATA / GDS',
    details: 'Servicios/Seguros/Extras',
    client_id: 'Cliente Asociado',
    documents: 'Archivos Adjuntos',
    payment_method_it: 'Método Italia',
    payment_method_pe: 'Método Perú',
    transfer_mode: 'Modalidad de Giro',
    tracking_code: 'Código de Seguimiento',
    sender_id: 'ID Remitente',
    total_expenses: 'Suma de Gastos',
    net_profit: 'Utilidad Neta (Profit)',
    commission: 'Comisión AGV',
    commission_percentage: '% Comisión',
    updated_at: 'Marca de Tiempo'
};

const DETAIL_MAP: Record<string, string> = {
    ticket_one_way: "Solo Ida",
    ticket_round_trip: "Ida y Vuelta",
    insurance_1m: "Seguro 1 mes",
    insurance_2m: "Seguro 2 meses",
    insurance_3m: "Seguro 3 meses",
    doc_invitation_letter: "Carta Invitación",
    doc_agency_managed: "Gestión Agencia",
    svc_airport_assistance: "Asist. Aeropuerto",
    svc_return_activation: "Activ. Retorno",
    hotel_3d_2n: "Hotel 3D/2N",
    hotel_2d_1n: "Hotel 2D/1N",
    baggage_1pc_23kg: "Maleta 23kg",
    baggage_2pc_23kg: "2 Maletas 23kg",
    baggage_1pc_10kg: "Maleta Mano 10kg",
    baggage_backpack: "Mochila",
    insurance_tourism_active: "Seguro Turista",
    insurance_migratory: "Seguro Migratorio",
    svc_stewardess_um: "Serv. Azafata UM",
    svc_pet_travel: "Mascota",
    hotel_custom_active: "Hotel Personalizado"
};

// Utility to normalize values for comparison (Same as server)
function deepNormalize(v: unknown): unknown {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v.toFixed(2);
    if (typeof v === 'string' && !isNaN(parseFloat(v)) && isFinite(Number(v))) {
        return parseFloat(v).toFixed(2);
    }
    if (Array.isArray(v)) return v.map(deepNormalize);
    if (typeof v === 'object') {
        const sorted: Record<string, unknown> = {};
        Object.keys(v as object).sort().forEach(key => {
            sorted[key] = deepNormalize((v as Record<string, unknown>)[key]);
        });
        return sorted;
    }
    return String(v);
}

const RESOURCE_FIELD_ORDER: Record<string, string[]> = {
    flights: [
        'pnr', 'itinerary', 'client_id', 'travel_date', 'return_date', 'ticket_type', 'iata_gds',
        'pax_adt', 'pax_chd', 'pax_inf', 'pax_total',
        'cost', 'sold_price', 'fee_agv', 'on_account', 'balance', 'status',
        'payment_details', 'details', 'documents'
    ],
    money_transfers: [
        'transfer_code', 'client_id', 'transfer_mode', 'amount_sent', 'exchange_rate', 
        'amount_received', 'commission', 'total_amount', 'total_expenses', 'net_profit',
        'on_account', 'balance', 'status', 'beneficiary_name', 'beneficiary_bank', 
        'beneficiary_account', 'payment_details', 'expense_details', 'documents'
    ],
    parcels: [
        'tracking_code', 'sender_id', 'recipient_name', 'recipient_phone', 
        'origin_address', 'destination_address', 'package_type', 'package_weight',
        'package_description', 'shipping_cost', 'on_account', 'balance', 'status', 
        'payment_details', 'documents'
    ]
};

function SmartValueRenderer({ value, field, isChanged, compareValue }: { value: unknown, field: string, isChanged: boolean, compareValue?: unknown }) {
    if (value === null || value === undefined || value === '') return <span className="text-slate-300 italic">Vacío</span>;

    if (field === 'payment_details' || field === 'expense_details') {
        const items = Array.isArray(value) ? value : [];
        const oldItems = Array.isArray(compareValue) ? compareValue : [];
        
        if (!isChanged) {
            // Columna Izquierda: Simplemente listar lo que había
            return (
                <div className="space-y-1">
                    {items.length === 0 ? <span className="text-slate-300 italic">Sin registros</span> : (
                        items.map((item: { amount?: number, cantidad?: string, description?: string, category?: string, metodo_it?: string, metodo_pe?: string }, i: number) => {
                            const amount = item.amount || item.cantidad || '0';
                            const label = item.description || item.category || (item.metodo_it || item.metodo_pe) || 'Item';
                            return (
                                <div key={i} className="text-[10px] border-l-2 border-slate-200 pl-2 py-1 mb-1 opacity-70">
                                    <div className="font-bold text-slate-600">#{i+1} - {amount}€</div>
                                    <div className="text-slate-400 truncate max-w-[150px]">{label}</div>
                                </div>
                            )
                        })
                    )}
                </div>
            );
        }

        // Columna Derecha: Simplemente listar lo que HAY AHORA y lo que fue ELIMINADO
        return (
            <div className="space-y-1">
                {Math.max(items.length, oldItems.length) === 0 ? <span className="text-slate-300 italic">Sin registros</span> : (
                    Array.from({ length: Math.max(items.length, oldItems.length) }).map((_, i) => {
                        const newItem = items[i] as { amount?: number, cantidad?: string, description?: string, category?: string, metodo_it?: string, metodo_pe?: string } | undefined;
                        const oldItem = oldItems[i] as { amount?: number, cantidad?: string, description?: string, category?: string, metodo_it?: string, metodo_pe?: string } | undefined;
                        
                        const isAdded = newItem && !oldItem;
                        const isRemoved = !newItem && oldItem;
                        const isModified = newItem && oldItem && JSON.stringify(newItem) !== JSON.stringify(oldItem);
                        
                        if (isRemoved) {
                            const amount = oldItem.amount || oldItem.cantidad || '0';
                            const label = oldItem.description || oldItem.category || (oldItem.metodo_it || oldItem.metodo_pe) || 'Item';
                            return (
                                <div key={i} className="text-[10px] border-l-2 border-red-500 bg-red-50/50 pl-2 py-1 mb-1 text-red-500 line-through opacity-70">
                                    <div className="font-bold">#{i+1} - {amount}€ (ELIMINADO)</div>
                                    <div className="truncate max-w-[150px]">{label}</div>
                                </div>
                            );
                        }

                        const amount = newItem!.amount || newItem!.cantidad || '0';
                        const label = newItem!.description || newItem!.category || (newItem!.metodo_it || newItem!.metodo_pe) || 'Item';

                        if (!isAdded && !isModified) {
                             return (
                                <div key={i} className="text-[10px] border-l-2 border-slate-200 pl-2 py-1 mb-1">
                                    <div className="font-bold text-slate-600">#{i+1} - {amount}€</div>
                                    <div className="text-slate-500 truncate max-w-[150px]">{label}</div>
                                </div>
                             )
                        }

                        if (isAdded) {
                            return (
                                <div key={i} className="text-[10px] border-l-2 border-emerald-500 bg-emerald-50/50 pl-2 py-1 mb-1 shadow-sm text-emerald-800">
                                    <div className="font-black">
                                        #{i+1} - {amount}€ <span className="text-emerald-700 bg-emerald-100 px-1 rounded ml-1 text-[8px] tracking-tighter">(NUEVO PAGO)</span>
                                    </div>
                                    <div className="truncate max-w-[150px] font-bold">{label}</div>
                                </div>
                            )
                        }

                        if (isModified) {
                            const changedKeys = Object.keys(newItem!).filter(k => 
                                !['updated_at', 'created_at', 'id', 'proof_path'].includes(k) && 
                                deepNormalize((newItem as Record<string, unknown>)[k]) !== deepNormalize((oldItem as Record<string, unknown>)[k])
                            );

                            return (
                                <div key={i} className="text-[10px] border-l-2 border-amber-500 bg-amber-50/30 pl-2 py-1 mb-1 shadow-sm">
                                    <div className="font-black text-amber-900 border-b border-amber-200/50 pb-0.5 mb-1">
                                        #{i+1} - {amount}€ <span className="text-amber-700 bg-amber-100 px-1 rounded ml-1 text-[8px] tracking-tighter">(MODIFICADO)</span>
                                    </div>
                                    <div className="space-y-1">
                                    {changedKeys.map(k => {
                                        let oldVal = String((oldItem as Record<string, unknown>)[k] || '-');
                                        let newVal = String((newItem as Record<string, unknown>)[k] || '-');
                                        
                                        if (k === 'tipo_cambio') {
                                            oldVal = Number(oldVal).toFixed(3);
                                            newVal = Number(newVal).toFixed(3);
                                        } else {
                                            oldVal = (deepNormalize(oldVal) as string) || oldVal;
                                            newVal = (deepNormalize(newVal) as string) || newVal;
                                        }

                                        return (
                                            <div key={k} className="flex items-center gap-1.5 text-[9px]">
                                                <span className="font-bold text-slate-500 uppercase tracking-tighter w-16 truncate" title={k}>{k.replace('_', ' ')}:</span>
                                                <span className="line-through text-red-500 truncate max-w-[60px]" title={oldVal}>{oldVal}</span>
                                                <span className="text-emerald-700 font-bold truncate max-w-[70px]" title={newVal}>➔ {newVal}</span>
                                            </div>
                                        )
                                    })}
                                    </div>
                                </div>
                            )
                        }
                    })
                )}
            </div>
        );
    }

    if (field === 'documents') {
        const docs = (Array.isArray(value) ? value : []) as { title?: string, name?: string }[];
        return (
            <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-700">{docs.length} archivo(s)</span>
                {docs.length > 0 && (
                    <div className="text-[9px] text-slate-400 italic truncate max-w-[180px]">
                        {docs.map((d: { title?: string, name?: string }) => d.title || d.name).join(', ')}
                    </div>
                )}
            </div>
        );
    }

    if (field === 'details') {
        const flags = (value as Record<string, unknown>) || {};
        const compareFlags = (compareValue as Record<string, unknown>) || {};
        
        if (!isChanged) {
            const activeOldKeys = Object.keys(flags).filter(k => flags[k] === true || flags[k] === "true");
            return (
                <div className="flex flex-wrap gap-1">
                    {activeOldKeys.length > 0 ? activeOldKeys.map(k => (
                        <span key={k} className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-slate-100 text-slate-600 border-slate-200 opacity-70">
                            {DETAIL_MAP[k] || k}
                        </span>
                    )) : <span className="text-slate-300 italic text-[9px]">Sín extras previos</span>}
                </div>
            );
        }

        const activeNewKeys = Object.keys(flags).filter(k => flags[k] === true || flags[k] === "true");
        const activeOldKeys = Object.keys(compareFlags).filter(k => compareFlags[k] === true || compareFlags[k] === "true");
        const allKeys = Array.from(new Set([...activeNewKeys, ...activeOldKeys]));

        return (
            <div className="flex flex-wrap gap-1">
                {allKeys.length > 0 ? allKeys.map(k => {
                    const isNewAddition = activeNewKeys.includes(k) && !activeOldKeys.includes(k);
                    const isRemoved = !activeNewKeys.includes(k) && activeOldKeys.includes(k);
                    
                    if (isRemoved) {
                        return (
                            <span key={k} className="px-1.5 py-0.5 rounded text-[9px] font-bold border bg-red-50 text-red-500 border-red-200 line-through opacity-70">
                                {DETAIL_MAP[k] || k}
                            </span>
                        );
                    }
                    
                    return (
                        <span key={k} className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold border",
                            isNewAddition ? "bg-red-50 text-red-800 border-red-300 shadow-sm" : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                            {DETAIL_MAP[k] || k}
                        </span>
                    );
                }) : <span className="text-slate-300 italic text-[9px]">Sín extras</span>}
            </div>
        );
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        return (
            <div className="text-[10px] space-y-0.5">
                {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex gap-1">
                        <span className="text-slate-400">{k}:</span>
                        <span className="text-slate-700 font-medium">{String(v)}</span>
                    </div>
                ))}
            </div>
        );
    }

    if (field.includes('date') && String(value).length > 5) {
        let dateResult = String(value);
        try { dateResult = format(new Date(value as string), "dd/MM/yyyy", { locale: es }); } catch {}
        return <span className={cn(isChanged && "text-emerald-700 font-bold")}>{dateResult}</span>;
    }

    const isNumeric = ['cost', 'sold_price', 'on_account', 'balance', 'amount_sent', 'amount_received', 'total_amount', 'commission', 'net_profit', 'shipping_cost', 'total_expenses'].includes(field);
    if (isNumeric) {
        const num = Number(value);
        const prev = Number(compareValue || 0);
        return (
            <div className="flex items-center gap-2">
                <span className={cn("font-bold", isChanged ? "text-emerald-700 underline decoration-emerald-200" : "text-slate-800")}>
                    {num.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </span>
                {isChanged && prev !== 0 && (
                    <span className={cn("text-[9px] font-black", num > prev ? "text-emerald-600" : "text-red-500")}>
                        ({num > prev ? '+' : ''}{(num - prev).toFixed(2)})
                    </span>
                )}
            </div>
        );
    }

    if (isChanged) {
        return (
            <div className="flex flex-col">
               <span className="text-red-700 font-black bg-red-50 px-1.5 py-0.5 rounded w-fit border border-red-200 shadow-sm">
                   {String(value)}
               </span>
            </div>
        );
    }

    return <span className="text-slate-600 font-medium">{String(value)}</span>;
}

export default function AdminPermissionsPage() {
    const [activeTab, setActiveTab] = useState<'requests' | 'audit'>('requests')
    const [requests, setRequests] = useState<(EditRequest & { agent: { first_name: string, last_name: string, email: string } })[]>([])
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    
    type AuditLogGroup = AuditLog & { _siblings: AuditLog[] };
    const [selectedLog, setSelectedLog] = useState<AuditLogGroup | null>(null)
    const ITEMS_PER_PAGE = 20

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            if (activeTab === 'requests') {
                const { data, count } = await getAllEditRequests(currentPage, ITEMS_PER_PAGE)
                setRequests(data)
                setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
            } else {
                const { data, count } = await getAuditLogs(currentPage, ITEMS_PER_PAGE)
                setAuditLogs(data as AuditLog[])
                setTotalPages(Math.ceil((count || 0) / ITEMS_PER_PAGE))
            }
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error("Error al cargar los datos")
        } finally {
            setIsLoading(false)
        }
    }, [activeTab, currentPage])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const groupedAuditLogs = useMemo(() => {
        const groups: AuditLogGroup[] = [];
        auditLogs.forEach(log => {
            const lastGroup = groups[groups.length - 1];
            
            const reqId = log.metadata?.requestId as string;
            const lastReqId = lastGroup?.metadata?.requestId as string;

            if (lastGroup && 
                reqId && 
                reqId !== 'admin_direct' && 
                reqId === lastReqId &&
                lastGroup.resource_id === log.resource_id
            ) {
                lastGroup._siblings.push(log);
                lastGroup.old_values = log.old_values;
            } else {
                groups.push({ ...log, _siblings: [log] });
            }
        });
        return groups;
    }, [auditLogs]);

    const handleApprove = async (id: string) => {
        const result = await approveEditRequest(id)
        if (result.success) {
            toast.success("Solicitud aprobada")
            fetchData()
        } else {
            toast.error(result.error || "Error al aprobar")
        }
    }

    const handleReject = async (id: string) => {
        const result = await rejectEditRequest(id)
        if (result.success) {
            toast.success("Solicitud rechazada")
            fetchData()
        } else {
            toast.error(result.error || "Error al rechazar")
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-chimiteal" />
                        Control Maestro de Accesos
                    </h1>
                    <p className="text-slate-500 text-sm">Gestión avanzada de permisos y auditoría forense</p>
                </div>
                
                <div className="flex p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <button
                        onClick={() => { setActiveTab('requests'); setCurrentPage(1); setIsLoading(true); }}
                        className={cn(
                            "px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2",
                            activeTab === 'requests' 
                                ? "bg-chimiteal text-white shadow-sm" 
                                : "text-slate-500 hover:bg-slate-50"
                        )}
                    >
                        <Clock className="h-4 w-4" />
                        Solicitudes
                    </button>
                    <button
                        onClick={() => { setActiveTab('audit'); setCurrentPage(1); setIsLoading(true); }}
                        className={cn(
                            "px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2",
                            activeTab === 'audit' 
                                ? "bg-chimipink text-white shadow-sm" 
                                : "text-slate-500 hover:bg-slate-50"
                        )}
                    >
                        <History className="h-4 w-4" />
                        Auditoría
                    </button>
                </div>
            </div>

            <Card className="border-slate-200 shadow-sm overflow-hidden rounded-xl bg-white">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            {activeTab === 'requests' ? (
                                <>
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-500">
                                            <th className="px-6 py-4">Fecha Solicitud</th>
                                            <th className="px-6 py-4">Agente</th>
                                            <th className="px-6 py-4">Gestión</th>
                                            <th className="px-6 py-4">PNR</th>
                                            <th className="px-6 py-4">Motivo</th>
                                            <th className="px-6 py-4">Situación</th>
                                            <th className="px-6 py-4 text-right">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {requests.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No hay solicitudes pendientes</td>
                                            </tr>
                                        ) : requests.map((req) => (
                                            <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                                    {format(new Date(req.created_at), "dd/MM/yy HH:mm", { locale: es })}
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-900">
                                                    {req.agent.first_name} {req.agent.last_name}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-slate-700 font-bold uppercase text-[10px]">
                                                        {req.resource_type === 'flights' ? 'Vuelos' : 
                                                         req.resource_type === 'money_transfers' ? 'Giros' : 
                                                         req.resource_type === 'parcels' ? 'Encomiendas' : req.resource_type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-chimiteal font-bold text-xs">
                                                        {String(req.metadata?.displayId || req.resource_id.substring(0,8))
                                                            .replace(/^(Vuelo PNR:|Giro:|Tracking:|PNR:|Código:)/i, '')
                                                            .split(' - ')[0]
                                                            .trim()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 text-xs">{req.reason}</td>
                                                <td className="px-6 py-4">
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                        req.status === 'approved' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                                        req.status === 'rejected' ? "bg-red-50 text-red-700 border border-red-100" :
                                                        "bg-amber-50 text-amber-700 border border-amber-100"
                                                    )}>
                                                        {req.status === 'approved' ? 'APROBADO' : 
                                                         req.status === 'rejected' ? 'RECHAZADO' : 
                                                         'PENDIENTE'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {req.status === 'pending' && (
                                                        <div className="flex justify-end gap-1">
                                                            <Button size="sm" onClick={() => handleApprove(req.id)} className="h-7 bg-chimipink hover:opacity-90 transition-opacity text-white text-[10px] font-bold shadow-sm">APROBAR</Button>
                                                            <Button variant="outline" size="sm" onClick={() => handleReject(req.id)} className="h-7 text-red-600 border-red-100 hover:bg-red-50 text-[10px] font-bold">RECHAZAR</Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </>
                            ) : (
                                <>
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-500">
                                            <th className="px-6 py-4">Sincronización</th>
                                            <th className="px-6 py-4">Agente</th>
                                            <th className="px-6 py-4">Motivo</th>
                                            <th className="px-6 py-4">Gestión</th>
                                            <th className="px-6 py-4">PNR</th>
                                            <th className="px-6 py-4 text-right">Evidencias</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {groupedAuditLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Registro de auditoría vacío</td>
                                            </tr>
                                        ) : groupedAuditLogs.map((log: AuditLogGroup) => (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4 text-slate-400 whitespace-nowrap text-[10px]">
                                                    {format(new Date(log.created_at), "dd/MM/yy HH:mm:ss", { locale: es })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-slate-900 font-bold text-xs">
                                                        {log.actor ? `${log.actor.first_name} ${log.actor.last_name}` : 'Sistema'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 text-[11px] truncate max-w-[150px]" title={(log.metadata?.reason as string) || 'Edición Directa'}>
                                                    {(log.metadata?.reason as string) || 'Edición Directa'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border",
                                                            log.action === 'update' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                            log.action === 'delete' ? "bg-red-50 text-red-600 border-red-100" :
                                                            "bg-blue-50 text-blue-600 border-blue-100"
                                                        )}>
                                                            {log.action === 'update' ? 'MODIFICACIÓN' : 
                                                             log.action === 'delete' ? 'ELIMINACIÓN' : 
                                                             log.action === 'create' ? 'CREACIÓN' : log.action}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold">
                                                            {log.resource_type === 'flights' ? 'Vuelos' : 
                                                             log.resource_type === 'money_transfers' ? 'Giros' : 
                                                             log.resource_type === 'parcels' ? 'Encomiendas' : log.resource_type}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-chimiteal font-bold text-xs">
                                                        {String(log.metadata?.displayId || log.resource_id.substring(0,8))
                                                            .replace(/^(Vuelo PNR:|Giro:|Tracking:|PNR:|Código:)/i, '')
                                                            .split(' - ')[0]
                                                            .trim()}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => setSelectedLog(log)}
                                                        className="h-7 gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all text-[9px] font-bold"
                                                    >
                                                        <History className="h-3 w-3" />
                                                        INSPECTOR
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </>
                            )}
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">Página {currentPage} de {totalPages}</div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage === 1 || isLoading} onClick={() => setCurrentPage(prev => prev - 1)} className="h-8 px-4 font-bold text-xs border-slate-200">ANTERIOR</Button>
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages || isLoading} onClick={() => setCurrentPage(prev => prev + 1)} className="h-8 px-4 font-bold text-xs border-slate-200">SIGUIENTE</Button>
                </div>
            </div>

            <Dialog open={!!selectedLog} onOpenChange={(o) => !o && setSelectedLog(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 border-none rounded-2xl overflow-hidden bg-white">
                    {selectedLog && (
                        <>
                            <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                            <History className="h-5 w-5 text-chimiteal" />
                                            Detalles
                                        </DialogTitle>
                                        <DialogDescription className="text-slate-500 text-xs mt-1">
                                            Fecha: {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss")}
                                        </DialogDescription>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Efectuado por:</p>
                                        <p className="font-bold text-slate-900">{selectedLog.actor?.first_name} {selectedLog.actor?.last_name}</p>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="p-6 bg-white space-y-4 overflow-y-auto flex-1">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Analítica de Diferencias</h3>
                                
                                <div className="border border-slate-100 rounded-lg overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b">
                                            <tr className="text-slate-400 font-bold uppercase text-[9px]">
                                                <th className="px-4 py-2 w-1/4">Atributo</th>
                                                <th className="px-4 py-2 w-[37.5%]">Datos Previos</th>
                                                <th className="px-4 py-2 w-[37.5%]">Datos Actualizados</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {(() => {
                                                const groupData = (selectedLog.new_values as Record<string, unknown>) || {};
                                                // Grouping Logic applied here ensures we deeply diff between the OLDEST state of the session and the NEWEST state!
                                                const oldData = (selectedLog.old_values as Record<string, unknown>) || {};
                                                
                                                // Because multiple actions could affect different keys, we must mathematically calculate the MASTER delta.
                                                // We ignore meta arrays and use deep diff to precisely find fields that fundamentally diverged during the session.
                                                const changedKeysList = Object.keys(groupData).filter(key => {
                                                     if (['updated_at'].includes(key)) return false;
                                                     const normOld = JSON.stringify(deepNormalize(oldData[key]));
                                                     const normNew = JSON.stringify(deepNormalize(groupData[key]));
                                                     return normOld !== normNew;
                                                });

                                                const predefinedOrder = RESOURCE_FIELD_ORDER[selectedLog.resource_type] || [];
                                                const otherKeys = Object.keys(groupData).filter(k => !predefinedOrder.includes(k));
                                                const allDisplayKeys = [...predefinedOrder, ...otherKeys];

                                                // ONLY SHOW CHANGED FIELDS: Do not render full identical table
                                                const keysToShow = allDisplayKeys.filter(key => {
                                                     return !['updated_at', 'id', 'agent_id', 'created_at'].includes(key) && changedKeysList.includes(key);
                                                });

                                                if (keysToShow.length === 0) {
                                                    return (
                                                        <tr>
                                                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No se detectaron cambios a nivel de datos estructurales.</td>
                                                        </tr>
                                                    )
                                                }

                                                return keysToShow.map(key => {
                                                    const newValue = groupData[key];
                                                    const oldValue = oldData[key];
                                                    const isChanged = true;

                                                    return (
                                                        <tr key={key} className="transition-colors bg-red-50/10 hover:bg-slate-50/50">
                                                            <td className="px-4 py-4 align-top min-w-[140px]">
                                                                <p className="text-[11px] text-red-700 font-black">
                                                                    {FIELD_LABELS[key] || key}
                                                                </p>
                                                            </td>
                                                            <td className="px-4 py-3 align-top border-x border-slate-50 w-1/3">
                                                                <SmartValueRenderer value={oldValue} field={key} isChanged={false} compareValue={newValue} />
                                                            </td>
                                                            <td className="px-4 py-3 align-top w-1/3 bg-slate-50/30">
                                                                <SmartValueRenderer 
                                                                    value={newValue} 
                                                                    field={key} 
                                                                    isChanged={isChanged} 
                                                                    compareValue={oldValue} 
                                                                />
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <DialogFooter className="p-4 bg-slate-50 border-t shrink-0">
                                <Button onClick={() => setSelectedLog(null)} className="bg-chimipink hover:opacity-90 transition-opacity text-white font-bold h-9 px-6 rounded-lg text-xs shadow-md">CERRAR VISOR</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
