"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { 
    ChevronLeft, 
    User, 
    Mail, 
    Phone, 
    Calendar, 
    FileText, 
    Plane, 
    ArrowLeftRight, 
    Package, 
    Languages, 
    Briefcase,
    Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAgentFullDetails } from "@/app/actions/manage-agents"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface AgentProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  phone: string | null
  avatar_url: string | null
  active: boolean
  created_at: string
}

interface ServiceHistoryItem {
    id: string
    type: string
    date: string
    amount: number
    reference: string
    clientName: string
    description: string
    status?: string
}

export default function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [agent, setAgent] = useState<AgentProfile | null>(null)
    const [history, setHistory] = useState<ServiceHistoryItem[]>([])
    const [loading, setLoading] = useState(true)

    // Filter states - Default to current month
    const currentDate = new Date()
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    const formatDate = (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }
    
    const [startDate, setStartDate] = useState(formatDate(firstDay))
    const [endDate, setEndDate] = useState(formatDate(lastDay))

    useEffect(() => {
        getAgentFullDetails(id).then(res => {
            if (res.success) {
                setAgent(res.profile as AgentProfile)
                setHistory(res.history || [])
            }
            setLoading(false)
        })
    }, [id])

    const filteredHistory = history.filter(item => {
        const itemDate = item.date.split('T')[0]
        return itemDate >= startDate && itemDate <= endDate
    })

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

    if (!agent) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Agente no encontrado</p>
                <Link href="/agents">
                    <Button variant="ghost" className="text-chimipink">Volver a agentes</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 py-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between px-2">
                <Link href="/agents">
                    <Button variant="ghost" className="gap-2 text-slate-500 hover:text-slate-900 px-0 transition-all font-medium">
                        <ChevronLeft className="h-4 w-4" />
                        Volver a la lista de Agentes
                    </Button>
                </Link>
            </div>

            <Card className="border-slate-200/60 shadow-xl rounded-2xl overflow-hidden bg-white">
                {/* Unified Header */}
                <div className="p-8 pb-0 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 rounded-2xl bg-linear-to-br from-chimipink/10 to-chimicyan/10 flex items-center justify-center border border-white shadow-sm shrink-0 overflow-hidden">
                            {agent.avatar_url ? (
                                <Image 
                                    src={agent.avatar_url} 
                                    alt={agent.first_name} 
                                    width={80} 
                                    height={80} 
                                    className="h-full w-full object-cover"
                                    unoptimized
                                />
                            ) : (
                                <User className="h-10 w-10 text-chimipink" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight leading-none mb-1">
                                {agent.first_name} {agent.last_name}
                            </h1>
                            <div className="flex items-center gap-2">
                                <Badge className={cn("text-[10px] font-bold uppercase py-0 px-2", agent.role === 'admin' ? "bg-slate-900" : "bg-cyan-500")}>
                                    {agent.role === 'admin' ? 'Administrador' : 'Agente'}
                                </Badge>
                                <p className="text-slate-400 text-xs font-medium">
                                    En el equipo desde {new Date(agent.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-12">
                    {/* Section 1: Data Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                        {/* Column 1: Personal Data */}
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 text-slate-700">
                                    <Mail className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium">{agent.email}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-700">
                                    <Phone className="h-4 w-4 text-slate-400" />
                                    <span className="text-sm font-medium">{agent.phone || 'No registrado'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Sales History Table */}
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                            <div className="space-y-4">
                                <h2 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-4">
                                    <Calendar className="h-4 w-4 text-slate-400" />
                                    Registro de Ventas Realizadas
                                </h2>
                                
                                {/* Date Filters */}
                                <div className="flex items-center gap-4">
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="start-date" className="text-[10px] font-bold text-slate-400 uppercase">Inicio</Label>
                                        <Input 
                                            id="start-date"
                                            type="date" 
                                            value={startDate} 
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="h-9 text-xs w-40"
                                        />
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label htmlFor="end-date" className="text-[10px] font-bold text-slate-400 uppercase">Fin</Label>
                                        <Input 
                                            id="end-date"
                                            type="date" 
                                            value={endDate} 
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="h-9 text-xs w-40"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Stats Summary - Count only */}
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(
                                    filteredHistory.reduce((acc: Record<string, number>, item) => {
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

                        <Card className="border-slate-100 shadow-xs overflow-hidden">
                            <CardContent className="p-0">
                                <div className="w-full overflow-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-4">Fecha</th>
                                                <th className="px-6 py-4">Servicio</th>
                                                <th className="px-6 py-4">PNR/CODIGO</th>
                                                <th className="px-6 py-4">CLIENTE</th>
                                                <th className="px-6 py-4 text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {filteredHistory.length > 0 ? (
                                                filteredHistory.map((item) => (
                                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                                                            {new Date(item.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs", getServiceBadgeColor(item.type))}>
                                                                    {getServiceIcon(item.type)}
                                                                </div>
                                                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{item.type}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                                                {item.reference}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-[11px] text-slate-600 font-bold max-w-[300px] truncate uppercase group-hover:text-chimipink transition-colors">
                                                                {item.clientName}
                                                            </p>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-full", getServiceStatusColor(item.status))}>
                                                                {getServiceStatusLabel(item.status)}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="py-12 text-center">
                                                        <div className="flex flex-col items-center justify-center space-y-2 opacity-40">
                                                            <Clock className="h-8 w-8 text-slate-300" />
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin registros en este rango</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </Card>
        </div>
    )
}
