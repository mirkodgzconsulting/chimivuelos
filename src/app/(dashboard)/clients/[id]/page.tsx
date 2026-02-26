"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { 
    ChevronLeft, 
    User, 
    Mail, 
    Phone, 
    CreditCard, 
    Calendar, 
    FileText, 
    Download, 
    Plane, 
    ArrowLeftRight, 
    Package, 
    Languages, 
    Briefcase,
    ExternalLink,
    Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getClientFullDetails, getSignedDownloadUrl } from "@/app/actions/manage-clients"
import { cn } from "@/lib/utils"

interface ClientFile {
  path: string
  name: string
  type: string
  size: number
  storage?: 'r2' | 'images'
}

interface ClientProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  document_type: string
  document_number: string
  client_files: ClientFile[] | null
  active: boolean
  created_at: string
}

interface ServiceHistoryItem {
    id: string
    type: string
    date: string
    amount: number
    reference: string
    description: string
    status?: string
}

export default function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [client, setClient] = useState<ClientProfile | null>(null)
    const [history, setHistory] = useState<ServiceHistoryItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getClientFullDetails(id).then(res => {
            if (res.success) {
                setClient(res.profile)
                setHistory(res.history || [])
            }
            setLoading(false)
        })
    }, [id])

    const handleViewFile = async (file: ClientFile) => {
        try {
            const storageType = file.storage || (file.path.includes('/') ? 'r2' : 'images');
            const validStorage = (storageType === 'images') ? 'images' : 'r2';
            const url = await getSignedDownloadUrl(file.path, validStorage);
            if (url && url !== '#error-url') {
                window.open(url, '_blank');
            }
        } catch (e) {
            console.error("Error viewing file:", e);
        }
    }

    const getServiceIcon = (type: string) => {
        switch (type) {
            case 'Vuelo': return <Plane className="h-4 w-4 text-blue-500" />
            case 'Giro': return <ArrowLeftRight className="h-4 w-4 text-emerald-500" />
            case 'Encomienda': return <Package className="h-4 w-4 text-amber-500" />
            case 'Traducción': return <Languages className="h-4 w-4 text-purple-500" />
            case 'Otros': return <Briefcase className="h-4 w-4 text-slate-500" />
            default: return <FileText className="h-4 w-4" />
        }
    }

    const getServiceBadgeColor = (type: string) => {
        switch (type) {
            case 'Vuelo': return "bg-blue-50 text-blue-600 border-blue-100"
            case 'Giro': return "bg-emerald-50 text-emerald-600 border-emerald-100"
            case 'Encomienda': return "bg-amber-50 text-amber-600 border-amber-100"
            case 'Traducción': return "bg-purple-50 text-purple-600 border-purple-100"
            case 'Otros': return "bg-slate-50 text-slate-600 border-slate-100"
            default: return ""
        }
    }


    const getServiceStatusLabel = (status: string | undefined) => {
        if (!status) return 'Registrado'
        switch (status.toLowerCase()) {
            case 'pending': return 'Pendiente'
            case 'in_progress': return 'En Proceso'
            case 'completed': return 'Listo'
            case 'delivered': return 'Entregado'
            case 'cancelled': return 'Cancelado'
            case 'paid': return 'Pagado'
            case 'unpaid': return 'Por Pagar'
            default: return status.charAt(0).toUpperCase() + status.slice(1)
        }
    }

    const getServiceStatusColor = (status: string | undefined) => {
        if (!status) return "bg-slate-50 text-slate-400 border-slate-100"
        switch (status.toLowerCase()) {
            case 'pending': return "bg-amber-50 text-amber-600 border-amber-100"
            case 'in_progress': return "bg-blue-50 text-blue-600 border-blue-100"
            case 'completed': return "bg-emerald-50 text-emerald-600 border-emerald-100"
            case 'delivered': return "bg-teal-50 text-teal-600 border-teal-100"
            case 'cancelled': return "bg-red-50 text-red-600 border-red-100"
            case 'paid': return "bg-emerald-50 text-emerald-600 border-emerald-100"
            case 'unpaid': return "bg-rose-50 text-rose-600 border-rose-100"
            default: return "bg-slate-50 text-slate-500 border-slate-100"
        }
    }


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-chimipink"></div>
            </div>
        )
    }

    if (!client) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Cliente no encontrado</p>
                <Link href="/clients">
                    <Button variant="ghost" className="text-chimipink">Volver a clientes</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 py-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between px-2">
                <Link href="/clients">
                    <Button variant="ghost" className="gap-2 text-slate-500 hover:text-slate-900 px-0 transition-all font-medium">
                        <ChevronLeft className="h-4 w-4" />
                        Volver a la lista de Clientes
                    </Button>
                </Link>
            </div>

            <Card className="border-slate-200/60 shadow-xl rounded-2xl overflow-hidden bg-white">
                {/* Unified Header */}
                <div className="p-8 pb-0 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 rounded-2xl bg-linear-to-br from-chimipink/10 to-chimicyan/10 flex items-center justify-center border border-white shadow-sm shrink-0">
                            <User className="h-10 w-10 text-chimipink" />
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight leading-none mb-1">
                                {client.first_name} {client.last_name}
                            </h1>
                            <p className="text-slate-400 text-xs font-medium">
                                Registrado el {new Date(client.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-12">
                    {/* Section 1: Data and Docs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
                        {/* Column 1: Personal Data */}
                        <div className="space-y-8">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <FileText className="h-4 w-4 text-chimipink" />
                                Perfil del Cliente
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-slate-800">
                                    <CreditCard className="h-4 w-4 text-slate-400" />
                                    <span className="text-base font-semibold">{client.document_type}: <span className="text-slate-900">{client.document_number}</span></span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-slate-700">
                                        <Mail className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm font-medium">{client.email}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-700">
                                        <Phone className="h-4 w-4 text-slate-400" />
                                        <span className="text-sm font-medium">{client.phone || 'No registrado'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Column 2 & 3: Attached Documents */}
                        <div className="lg:col-span-2 space-y-6">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Download className="h-3.5 w-3.5 text-chimipink" />
                                Documentos del Cliente
                            </h3>
                            {client.client_files && client.client_files.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {client.client_files.map((file: ClientFile, idx: number) => (
                                        <div 
                                            key={idx} 
                                            className="group flex items-center justify-between p-3 bg-white/80 border border-white hover:border-chimipink/20 hover:bg-white transition-all cursor-pointer rounded-2xl shadow-sm" 
                                            onClick={() => handleViewFile(file)}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-chimipink group-hover:text-white transition-all shadow-xs">
                                                    <FileText className="h-3.5 w-3.5" />
                                                </div>
                                                <div className="flex flex-col truncate">
                                                    <span className="text-[11px] font-semibold text-slate-700 truncate">{file.name}</span>
                                                    <span className="text-[9px] text-slate-400">{(file.size / 1024).toFixed(1)} KB</span>
                                                </div>
                                            </div>
                                            <ExternalLink className="h-3 w-3 text-slate-200 group-hover:text-chimipink transition-colors mr-1" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
                                    <p className="text-[10px] text-slate-300 uppercase tracking-widest font-black italic">Sin archivos adjuntos</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 2: Service History */}
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
                            <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-4">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                Historial de Servicios
                            </h2>
                            
                            {/* Stats Summary */}
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(
                                    history.reduce((acc: Record<string, number>, item) => {
                                        acc[item.type] = (acc[item.type] || 0) + 1
                                        return acc
                                    }, {})
                                ).map(([type, count]) => (
                                    <Badge key={type} variant="outline" className="text-[10px] font-bold border-slate-100 bg-slate-50 text-slate-600 px-3 py-1 rounded-full flex gap-2">
                                        <span className={cn("h-1.5 w-1.5 rounded-full", 
                                            type === 'Vuelo' ? "bg-blue-400" : 
                                            type === 'Giro' ? "bg-emerald-400" : 
                                            type === 'Encomienda' ? "bg-amber-400" : 
                                            type === 'Traducción' ? "bg-purple-400" : 
                                            "bg-slate-400")}></span>
                                        {type}s: {count}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {history.length > 0 ? (
                                history.map((item) => (
                                    <div key={item.id} className="relative flex items-stretch min-h-[85px] border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-md transition-all duration-300 rounded-2xl group overflow-hidden bg-white">
                                        {/* Minimal color strip */}
                                        <div className={cn("w-1 shrink-0 transition-opacity group-hover:opacity-100 opacity-60", 
                                            item.type === 'Vuelo' ? "bg-blue-400" : 
                                            item.type === 'Giro' ? "bg-emerald-400" : 
                                            item.type === 'Encomienda' ? "bg-amber-400" : 
                                            item.type === 'Traducción' ? "bg-purple-400" : 
                                            "bg-slate-400")}>
                                        </div>
                                        
                                        <div className="p-4 flex-1 flex items-center">
                                            <div className="flex items-center gap-4 w-full">
                                                <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center transition-all shadow-xs shrink-0", getServiceBadgeColor(item.type))}>
                                                    {getServiceIcon(item.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                                        <div className="flex items-baseline gap-2 truncate">
                                                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate">{item.type}</span>
                                                            <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1 py-0.5 rounded border border-slate-100 truncate">{item.reference}</span>
                                                        </div>
                                                        <Badge variant="outline" className={cn("text-[8px] font-black uppercase px-2 py-0.5 rounded-full shrink-0", getServiceStatusColor(item.status))}>
                                                            {getServiceStatusLabel(item.status)}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                                                        <span>{new Date(item.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-3xl py-12 text-center">
                                    <Clock className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                                    <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest">Sin historial de servicios</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    )
}
