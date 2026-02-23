'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
    ShieldCheck, 
    History, 
    CheckCircle2, 
    XCircle, 
    Clock, 
} from "lucide-react"
import { 
    getAllEditRequests, 
    approveEditRequest, 
    rejectEditRequest, 
    getAuditLogs,
    getPendingRequestsCount,
    type EditRequest 
} from "@/app/actions/manage-permissions"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"

interface AuditLog {
    id: string
    created_at: string
    actor_id: string
    action: string
    resource_type: string
    resource_id: string
    old_values?: unknown
    new_values?: unknown
    metadata?: {
        displayId?: string;
        method?: string;
        [key: string]: unknown;
    }
    actor?: {
        first_name: string
        last_name: string
        email: string
    }
}

export default function AdminPermissionsPage() {
    const [activeTab, setActiveTab] = useState<'requests' | 'audit'>('requests')
    const [isLoading, setIsLoading] = useState(true)
    const [requests, setRequests] = useState<(EditRequest & { agent: { first_name: string, last_name: string, email: string } })[]>([])
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
    const [requestsCount, setRequestsCount] = useState(0)
    const [pendingBadgeCount, setPendingBadgeCount] = useState(0)
    const [auditCount, setAuditCount] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 20

    useEffect(() => {
        let isMounted = true
        
        async function fetch() {
            // Always fetch pending badge count
            const pCount = await getPendingRequestsCount()
            if (isMounted) setPendingBadgeCount(pCount)

            if (activeTab === 'requests') {
                const result = await getAllEditRequests(currentPage, itemsPerPage)
                if (isMounted) {
                    setRequests(result.data)
                    setRequestsCount(result.count)
                    setIsLoading(false)
                }
            } else {
                const result = await getAuditLogs(currentPage, itemsPerPage)
                if (isMounted) {
                    setAuditLogs(result.data as AuditLog[])
                    setAuditCount(result.count)
                    setIsLoading(false)
                }
            }
        }

        fetch()
        return () => { isMounted = false }
    }, [activeTab, currentPage])

    const loadData = useCallback(async () => {
        setIsLoading(true)
        const pCount = await getPendingRequestsCount()
        setPendingBadgeCount(pCount)

        if (activeTab === 'requests') {
            const result = await getAllEditRequests(currentPage, itemsPerPage)
            setRequests(result.data)
            setRequestsCount(result.count)
        } else {
            const result = await getAuditLogs(currentPage, itemsPerPage)
            setAuditLogs(result.data as AuditLog[])
            setAuditCount(result.count)
        }
        setIsLoading(false)
    }, [activeTab, currentPage])

    const handleApprove = async (id: string) => {
        if (!confirm('¿Aprobar esta solicitud de edición? El agente tendrá acceso por 60 minutos.')) return
        const result = await approveEditRequest(id)
        if (result.success) {
            toast.success("Solicitud aprobada")
            loadData()
        } else {
            toast.error("Error al aprobar", { description: result.error })
        }
    }

    const handleReject = async (id: string) => {
        if (!confirm('¿Rechazar esta solicitud?')) return
        const result = await rejectEditRequest(id)
        if (result.success) {
            toast.success("Solicitud rechazada")
            loadData()
        } else {
            toast.error("Error al rechazar", { description: result.error })
        }
    }

    const totalPages = Math.ceil((activeTab === 'requests' ? requestsCount : auditCount) / itemsPerPage)

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Control de Permisos</h1>
                    <p className="text-slate-500 mt-1">Gestiona solicitudes de edición y revisa el historial de cambios.</p>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full md:w-max">
                <button
                    onClick={() => { setActiveTab('requests'); setCurrentPage(1); setIsLoading(true); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                        activeTab === 'requests' 
                            ? "bg-chimipink text-white shadow-md shadow-pink-500/20" 
                            : "text-slate-600 hover:bg-slate-50"
                    )}
                >
                    <ShieldCheck className="h-4 w-4" />
                    Solicitudes de Edición
                    {pendingBadgeCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {pendingBadgeCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => { setActiveTab('audit'); setCurrentPage(1); setIsLoading(true); }}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
                        activeTab === 'audit' 
                            ? "bg-chimipink text-white shadow-md shadow-pink-500/20" 
                            : "text-slate-600 hover:bg-slate-50"
                    )}
                >
                    <History className="h-4 w-4" />
                    Registro de Auditoría
                </button>
            </div>

            <Card className="border-none shadow-xl bg-white/80 backdrop-blur-md overflow-hidden">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="h-10 w-10 border-4 border-chimipink/20 border-t-chimipink rounded-full animate-spin" />
                            <p className="text-slate-400 font-medium animate-pulse">Cargando datos...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                {activeTab === 'requests' ? (
                                    <>
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Agente</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Gestión</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">PNR</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Motivo</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Fecha</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Estado</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {requests.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                                        No hay solicitudes de edición pendientes.
                                                    </td>
                                                </tr>
                                            ) : requests.map((req) => (
                                                <tr key={req.id} className="hover:bg-slate-50/80 transition-colors group text-sm">
                                                    <td className="px-6 py-4 text-slate-900 font-medium">
                                                        {req.agent.first_name} {req.agent.last_name}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        {req.resource_type === 'flights' ? 'Vuelos' : 
                                                         req.resource_type === 'money_transfers' ? 'Giros' : 
                                                         req.resource_type === 'parcels' ? 'Encomiendas' : req.resource_type}
                                                    </td>
                                                    <td className="px-6 py-4 text-chimiteal font-bold">
                                                        {(req.metadata?.displayId || req.resource_id.substring(0,8))
                                                            .replace(/^(Vuelo PNR:|Giro:|Tracking:|PNR:|Código:)/i, '')
                                                            .split(' - ')[0]
                                                            .trim()}
                                                    </td>
                                                    <td className="px-6 py-4 max-w-xs text-slate-600 italic">
                                                        {req.reason}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500">
                                                        {format(new Date(req.created_at), "d MMM, HH:mm", { locale: es })}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                                            req.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                            req.status === 'approved' ? "bg-emerald-100 text-emerald-700" :
                                                            "bg-red-100 text-red-700"
                                                        )}>
                                                            {req.status === 'pending' && <Clock className="h-3 w-3" />}
                                                            {req.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                                                            {req.status === 'rejected' && <XCircle className="h-3 w-3" />}
                                                            {req.status === 'pending' ? 'Pendiente' : req.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {req.status === 'pending' && (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                                    onClick={() => handleApprove(req.id)}
                                                                >
                                                                    Aprobar
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => handleReject(req.id)}
                                                                >
                                                                    Rechazar
                                                                </Button>
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
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Fecha</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Agente</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Acción</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Gestión</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">PNR</th>
                                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-left">Cambios</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {auditLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                                        No hay registros de auditoría.
                                                    </td>
                                                </tr>
                                            ) : auditLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group text-sm">
                                                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                                        {format(new Date(log.created_at), "d MMM, HH:mm", { locale: es })}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">
                                                        {log.actor?.first_name} {log.actor?.last_name}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                                                            log.action === 'update' ? "bg-emerald-50 text-emerald-700" :
                                                            log.action === 'delete' ? "bg-red-50 text-red-700" :
                                                            log.action === 'create' ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                                                        )}>
                                                            {log.action === 'update' ? 'ACTUALIZAR' : 
                                                             log.action === 'create' ? 'CREAR' : 
                                                             log.action === 'delete' ? 'ELIMINAR' : log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        {log.resource_type === 'flights' ? 'Vuelos' : 
                                                         log.resource_type === 'money_transfers' ? 'Giros' : 
                                                         log.resource_type === 'parcels' ? 'Encomiendas' : log.resource_type}
                                                    </td>
                                                    <td className="px-6 py-4 text-chimiteal font-bold">
                                                        {(log.metadata?.displayId || (log.resource_id && log.resource_id.length > 20 ? log.resource_id.substring(0,8) : log.resource_id))
                                                            .replace(/^(Vuelo PNR:|Giro:|Tracking:|PNR:|Código:)/i, '')
                                                            .split(' - ')[0]
                                                            .trim()}
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-600">
                                                        {log.action === 'update' && log.new_values && typeof log.new_values === 'object' ? (
                                                            Object.entries(log.new_values as Record<string, unknown>)
                                                                .map(([key, value]) => {
                                                                    const labels: Record<string, string> = {
                                                                        status: 'Estado',
                                                                        cost: 'Costo',
                                                                        sold_price: 'Venta',
                                                                        itinerary: 'Ruta',
                                                                        travel_date: 'Fecha',
                                                                        return_date: 'Retorno',
                                                                        pnr: 'PNR',
                                                                        on_account: 'A cuenta',
                                                                        balance: 'Saldo',
                                                                        payment_details: 'Pagos',
                                                                        expense_details: 'Gastos',
                                                                        amount_sent: 'Enviado',
                                                                        amount_received: 'Recibido',
                                                                        exchange_rate: 'Cambio',
                                                                        total_amount: 'Total',
                                                                        beneficiary_name: 'Beneficiario',
                                                                        recipient_name: 'Destinatario',
                                                                        recipient_phone: 'Telf. Dest.',
                                                                        recipient_address: 'Dir. Dest.',
                                                                        origin_address: 'Origen',
                                                                        destination_address: 'Destino',
                                                                        package_type: 'Tipo Paquete',
                                                                        package_weight: 'Peso',
                                                                        package_description: 'Descripción',
                                                                        shipping_cost: 'Costo Envío'
                                                                    };
                                                                    const label = labels[key] || key;
                                                                    
                                                                    let displayValue = String(value);
                                                                    if (Array.isArray(value)) {
                                                                        displayValue = key === 'payment_details' ? 'Historial de pagos actualizado' : 
                                                                                      key === 'expense_details' ? 'Historial de gastos actualizado' : 
                                                                                      key === 'documents' ? 'Documentos actualizados' : 'Actualizado';
                                                                    } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
                                                                        try {
                                                                            displayValue = format(new Date(value), "d MMM", { locale: es });
                                                                        } catch {
                                                                            // Keep original string if parsing fails
                                                                        }
                                                                    }
                                                                    
                                                                    return `${label}: ${displayValue}`;
                                                                }).join(', ')
                                                        ) : (
                                                            <span className="italic text-slate-400">
                                                                {log.action === 'delete' ? 'Eliminado definitivamente' :
                                                                 log.action === 'create' ? 'Nuevo registro' :
                                                                 log.action === 'approve_edit' ? 'Permiso aprobado' :
                                                                 log.action === 'reject_edit' ? 'Permiso rechazado' : '-'}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </>
                                )}
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50 bg-slate-50/30">
                            <p className="text-xs text-slate-400">
                                Página <span className="font-semibold">{currentPage}</span> de {totalPages}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => { setCurrentPage(prev => prev - 1); setIsLoading(true); }}
                                    className="h-8 px-4"
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => { setCurrentPage(prev => prev + 1); setIsLoading(true); }}
                                    className="h-8 px-4"
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
