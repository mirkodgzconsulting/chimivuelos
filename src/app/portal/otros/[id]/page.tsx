import { getOtherServiceById, getServiceHistory } from '@/app/actions/client-portal'
import { redirect } from 'next/navigation'
import { Briefcase, FileText, Banknote, Clock, MapPin, User, ArrowLeft, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ServiceDocumentRow } from '../../components/ServiceDocumentRow'
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
    pending: 'PENDIENTE',
    in_progress: 'EN PROCESO',
    completed: 'COMPLETADO',
    delivered: 'ENTREGADO',
    cancelled: 'CANCELADO'
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    delivered: 'bg-emerald-100/50 text-emerald-600 border-emerald-200/50',
    cancelled: 'bg-red-100 text-red-700 border-red-200'
}

const formatCurrency = (amount: number | null | undefined) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0)
}

export default async function OtherServiceDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const service = await getOtherServiceById(id)

    if (!service) {
        redirect('/portal/otros')
    }

    const historyLogs = await getServiceHistory(id, 'other_services')
    
    const timeline = [
        { status: 'CREACIÓN', created_at: service.created_at, color: 'bg-blue-400' },
        ...historyLogs.map((log) => ({
            status: STATUS_LABELS[log.status] || log.status.toUpperCase(),
            created_at: log.created_at,
            color: 'bg-slate-400'
        }))
    ]

    const displayType = service.service_type === "Otros servicios" ? service.service_type_other : service.service_type

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/portal/otros">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ArrowLeft size={20} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                            Detalles del Servicio
                        </h1>
                        <p className="text-slate-500 text-sm">Información detallada de tu solicitud.</p>
                    </div>
                </div>
                <div className="hidden md:block">
                     <span className="text-xs font-bold text-slate-400 bg-white/60 px-3 py-1 rounded-full uppercase tracking-widest border border-white/40">
                        ID: {service.tracking_code}
                    </span>
                </div>
            </header>

            {/* Main Content Card */}
            <div className="bg-white/30 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl overflow-hidden relative">
                
                {/* 1. Header Info Section */}
                <div className="p-6 border-b border-white/30">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Info Block */}
                        <div className="flex-1 space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="bg-white/80 p-3 rounded-xl border border-white/50 text-chimipink shadow-sm">
                                    <Briefcase size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{displayType}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter border",
                                            STATUS_COLORS[service.status]
                                        )}>
                                            {STATUS_LABELS[service.status]}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            REGISTRADO EL {new Date(service.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Side: Details and Notes */}
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Info size={14} /> Información del Servicio
                                        </h3>
                                        <div className="bg-white/40 p-4 rounded-xl border border-white/40">
                                            <p className="font-bold text-slate-800 text-sm mb-2">{displayType}</p>
                                            {service.note && (
                                                <p className="text-sm text-slate-600 leading-relaxed italic border-t border-white/30 pt-2 mt-2">
                                                    &ldquo;{service.note}&rdquo;
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Destination and Logistics */}
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <User size={14} /> Receptor y Ubicación
                                        </h3>
                                        <div className="bg-white/40 p-4 rounded-xl border border-white/40 space-y-3">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nombre / Ref</p>
                                                <p className="text-sm font-bold text-slate-700">{service.recipient_name || 'No especificado'}</p>
                                                {service.recipient_phone && <p className="text-xs text-slate-500 mt-0.5">{service.recipient_phone}</p>}
                                            </div>
                                            <div className="pt-2 border-t border-white/30">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                    <MapPin size={10} /> Localización
                                                </p>
                                                <p className="text-sm text-slate-600 leading-snug">
                                                    {service.destination_address_client || service.destination_address || 'Oficina Chimivuelos'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Content (Financial & Documents) */}
                        <div className="lg:w-80 space-y-6">
                            {/* Financial Summary */}
                            <div>
                                <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Banknote size={14} /> Resumen Económico
                                </h3>
                                <div className="bg-white/40 border border-white/40 rounded-2xl p-5 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Total</span>
                                        <span className="text-sm font-bold text-slate-800">{formatCurrency(service.total_amount)}</span>
                                    </div>

                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">A cuenta</span>
                                        <span className="text-sm font-bold text-emerald-600">{formatCurrency(service.on_account)}</span>
                                    </div>
                                    
                                    <div className="pt-3 border-t border-white/30 flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Saldo</span>
                                        <span className={cn(
                                            "text-sm font-black",
                                            service.balance > 0 ? "text-red-600" : "text-emerald-600"
                                        )}>{formatCurrency(service.balance)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Documents List */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider flex items-center gap-2">
                                        <FileText size={14} /> Documentación
                                    </h3>
                                    <span className="text-[10px] font-bold bg-white/60 text-slate-500 px-2 py-0.5 rounded-full border border-white/40">
                                        {service.documents?.length || 0} archivos
                                    </span>
                                </div>
                                
                                <div className="space-y-2">
                                    {service.documents && service.documents.length > 0 ? (
                                        service.documents.map((doc: {title: string, path: string, name: string, storage: 'r2' | 'images'}, idx: number) => (
                                            <ServiceDocumentRow key={idx} doc={doc} type="other" />
                                        ))
                                    ) : (
                                        <div className="text-center py-6 bg-white/20 rounded-xl border border-dashed border-white/50">
                                            <p className="text-[10px] text-slate-400 italic">No hay documentos cargados.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Timeline and Bottom Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2">
                    <div className="p-6 lg:border-r border-white/30">
                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-6 flex items-center gap-2">
                            <Clock size={14} /> Historial de Tracking
                        </h3>
                        
                        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-white/30">
                            {timeline.reverse().map((step, idx) => (
                                <div key={idx} className="relative flex items-center justify-between group">
                                    <div className={cn(
                                        "absolute -left-[23px] h-3 w-3 rounded-full border-2 border-white shadow-sm z-10 transition-transform group-hover:scale-125",
                                        step.color
                                    )} />
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 leading-none mb-1">
                                            {new Date(step.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">
                                            {step.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 flex flex-col justify-center bg-white/10">
                        <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <Briefcase size={16} className="text-chimipink" /> Nota Adicional
                        </h4>
                        <p className="text-sm text-slate-600 leading-relaxed italic">
                            Este servicio es gestionado directamente por nuestro equipo administrativo. Si tiene dudas sobre el estado de su trámite, por favor póngase en contacto con su agente o soporte técnico.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
