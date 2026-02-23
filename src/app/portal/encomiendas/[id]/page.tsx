import { getParcelById, getServiceHistory } from '@/app/actions/client-portal'
import { redirect } from 'next/navigation'
import { Package, User, Download, FileText, History, Truck, Clock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
    pending: 'PENDIENTE',
    warehouse: 'EN ALMACÉN',
    transit: 'EN TRÁNSITO',
    delivered: 'ENTREGADO',
    cancelled: 'CANCELADO'
}

const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-400',
    warehouse: 'bg-blue-400',
    transit: 'bg-orange-400',
    delivered: 'bg-emerald-500',
    cancelled: 'bg-red-500'
}

interface HistoryLog {
    status: string
    created_at: string
}

interface ParcelDocument {
    title: string
    path: string
    name: string
    storage: 'r2' | 'images'
}

export default async function ParcelDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const parcel = await getParcelById(id)

    if (!parcel) {
        redirect('/portal/encomiendas')
    }

    const historyLogs = await getServiceHistory(id, 'parcels')
    
    // Combine creation with audit logs
    const timeline = [
        { status: 'CREACIÓN', created_at: parcel.created_at, color: 'bg-blue-400' },
        ...historyLogs.map((log: HistoryLog) => ({
            status: STATUS_LABELS[log.status] || log.status.toUpperCase(),
            created_at: log.created_at,
            color: STATUS_COLORS[log.status] || 'bg-slate-400'
        }))
    ]

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                        Detalle de Encomienda
                    </h1>
                    <p className="text-slate-500 text-sm">Seguimiento de envío #{parcel.tracking_code || id.slice(0, 8)}</p>
                </div>
                <Link href="/portal/encomiendas">
                    <Button variant="outline" size="sm">
                        Volver
                    </Button>
                </Link>
            </header>

            {/* Main Content Card - Glassmorphism */}
            <div className="bg-white/30 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl overflow-hidden relative z-10">
                
                {/* 1. Parcel Details Section */}
                <div className="p-6 border-b border-white/30 relative overflow-hidden">
                   <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                        {/* Left Content (Info) */}
                        <div className="flex-1 space-y-8">
                             {/* Header Line */}
                             <div className="flex items-start gap-4">
                                <div className="bg-white/80 p-3 rounded-xl border border-white/50 text-chimiteal shadow-sm">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Envío de Encomienda</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-semibold px-2 py-0.5 bg-white/60 text-slate-600 rounded border border-white/40">
                                            TRACKING: {parcel.tracking_code || 'S/N'}
                                        </span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${
                                            parcel.status === 'delivered' ? 'bg-green-100/80 text-green-700' :
                                            parcel.status === 'cancelled' ? 'bg-red-100/80 text-red-700' :
                                            'bg-amber-100/80 text-amber-700'
                                        }`}>
                                            {parcel.status === 'delivered' ? 'Entregado' : 
                                             parcel.status === 'cancelled' ? 'Cancelado' :
                                             parcel.status === 'in_transit' ? 'En Tránsito' : 
                                             'Pendiente'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Column: Recipient, Description & History */}
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <User size={14} /> Datos del Destinatario
                                        </h3>
                                        <div className="bg-white/40 p-4 rounded-lg border border-white/40 space-y-3">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Nombre Completo</p>
                                                <p className="text-base font-bold text-slate-800">{parcel.recipient_name}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Documento</p>
                                                    <p className="text-sm font-semibold text-slate-700">{parcel.recipient_document || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Teléfono</p>
                                                    <p className="text-sm font-semibold text-slate-700">{parcel.recipient_phone || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-white/30">
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Dirección de Entrega</p>
                                                <p className="text-sm text-slate-600 leading-snug">{parcel.recipient_address || '—'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-2">Descripción de Carga</h3>
                                        <div className="bg-white/40 p-4 rounded-lg border border-white/40 text-sm leading-relaxed text-slate-700 italic">
                                            &quot;{parcel.package_description || 'Sin descripción detallada disponible.'}&quot;
                                        </div>
                                    </div>

                                    {/* Status Timeline - Moved here per user request */}
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Clock size={14} /> Historial de Cambio
                                        </h3>
                                        <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                            {timeline.map((step, idx) => (
                                                <div key={idx} className="relative flex items-center gap-4 group">
                                                    <div className={cn(
                                                        "absolute -left-[23px] h-3 w-3 rounded-full border-2 border-white shadow-sm z-10",
                                                        step.color
                                                    )} />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-slate-400 leading-none mb-1">
                                                            {new Date(step.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                        </span>
                                                        <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">
                                                            {step.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Docs & Tracking Info */}
                                <div className="space-y-8">
                                    {/* Documents */}
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <FileText size={14} /> Guías y Documentos
                                        </h3>
                                        
                                        <div className="grid grid-cols-1 gap-3">
                                            {parcel.documents && parcel.documents.length > 0 ? (
                                                parcel.documents.map((doc: ParcelDocument, idx: number) => (
                                                    <div key={idx} className="bg-white/40 p-3 rounded-xl border border-white/40 flex items-center justify-between group hover:bg-white/60 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-white/80 p-2 rounded-lg text-chimiteal">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{doc.title || doc.name}</p>
                                                                <p className="text-[10px] text-slate-400 uppercase">Documento Adjunto</p>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-chimiteal">
                                                            <Download size={16} />
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">No hay documentos electrónicos disponibles.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tracking Info */}
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <History size={14} /> Información de Seguimiento
                                        </h3>
                                        <div className="bg-white/40 border border-white/40 rounded-xl p-4 space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-chimiteal shadow-sm">
                                                    <Truck size={16} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter leading-none mb-1">Última Actualización</p>
                                                    <p className="text-sm font-bold text-slate-800">{new Date(parcel.updated_at || parcel.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/30">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Peso</p>
                                                    <p className="text-xs font-bold text-slate-700">{parcel.package_weight || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Tipo</p>
                                                    <p className="text-xs font-bold text-slate-700 capitalize">{parcel.package_type || '—'}</p>
                                                </div>
                                            </div>
                                            {parcel.terms_accepted_at && (
                                                <div className="pt-2 border-t border-white/20 flex justify-between items-center">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Condiciones:</span>
                                                    <span className="text-[10px] font-bold text-chimiteal flex items-center gap-1"><CheckCircle2 size={10} /> Aceptadas</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Content (Image) */}
                        <div className="w-full lg:w-1/3 flex items-center justify-center lg:justify-end">
                             <div className="relative w-full max-w-[200px] md:max-w-[350px] aspect-4/5 lg:mr-8 transition-transform hover:scale-105 duration-500">
                                <img 
                                    src="/img-parcel-detail.webp" 
                                    alt="Detalle de Encomienda" 
                                    className="object-contain w-full h-full drop-shadow-2xl"
                                />
                             </div>
                        </div>
                   </div>

                </div>

                {/* Generic Info (Full Width) */}
                <div className="bg-white/40 border-t border-white/30 p-6 flex flex-col md:flex-row gap-8">
                    <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 mb-2 whitespace-nowrap">Términos de Envío</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Chimivuelos no se hace responsable por artículos prohibidos o inflamables. El tiempo de entrega es una estimación y puede variar por factores climáticos o aduanas.
                        </p>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 mb-2 whitespace-nowrap">Reclamos</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Cualquier reclamo debe presentarse dentro de las 48 horas posteriores a la entrega programada, adjuntando fotografías del estado del paquete y la guía correspondiente.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
