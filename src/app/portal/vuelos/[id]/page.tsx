import { getFlightById, getServiceHistory } from '@/app/actions/client-portal'
import { redirect } from 'next/navigation'
import { Plane, Calendar, FileText, Banknote, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import Image from 'next/image'
import { FlightDocumentRow } from '../ClientDownloadButton'
import { FlightRecommendations } from '../components/FlightRecommendations'
import { FlightFAQ } from '../components/FlightFAQ'
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
    // Keys
    'Programado': 'PROGRAMADO',
    'En tránsito': 'EN TRÁNSITO',
    'Reprogramado': 'REPROGRAMADO',
    'Cambio de horario': 'CAMBIO DE HORARIO',
    'Cancelado': 'CANCELADO',
    'No-show (no se presentó)': 'NO-SHOW',
    'En migración': 'EN MIGRACIÓN',
    'Deportado': 'DEPORTADO',
    'Finalizado': 'FINALIZADO',
    // Fallback technical keys
    pending: 'PENDIENTE',
    confirmed: 'CONFIRMADO',
    scheduled: 'PROGRAMADO',
    delayed: 'RETRASADO',
    landed: 'ATERRIZADO'
}

const STATUS_COLORS: Record<string, string> = {
    'Programado': 'bg-sky-400',
    'En tránsito': 'bg-orange-400',
    'Reprogramado': 'bg-amber-400',
    'Cambio de horario': 'bg-amber-500',
    'Cancelado': 'bg-red-500',
    'No-show (no se presentó)': 'bg-slate-400',
    'En migración': 'bg-purple-400',
    'Deportado': 'bg-red-700',
    'Finalizado': 'bg-emerald-500',
    // Fallbacks
    pending: 'bg-amber-400',
    confirmed: 'bg-emerald-500',
    scheduled: 'bg-sky-400',
    delayed: 'bg-orange-500',
    landed: 'bg-chimiteal'
}

interface HistoryLog {
    status: string
    created_at: string
}

const formatCurrency = (amount: number | null | undefined) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0)
}

interface FlightDocument {
    title: string
    path: string
    name: string
    storage: 'r2' | 'images'
}

const DETAILS_LABELS: Record<string, string> = {
    ticket_one_way: "Pasaje solo ida",
    ticket_round_trip: "Pasaje ida y vuelta",
    insurance_1m: "Seguro x 1 mes",
    insurance_2m: "Seguro x 2 meses",
    insurance_3m: "Seguro x 3 meses",
    doc_invitation_letter: "Redacción carta de invitación con documentos del anfitrión (El cliente envía copia del documento de identidad o Permesso di soggiorno y Tessera sanitaria del familiar en Italia.)",
    doc_agency_managed: "Carta inv. gestionada por agencia",
    svc_airport_assistance: "Asistencia aeroportuaria",
    svc_return_activation: "Activación pasaje retorno",
    hotel_3d_2n: "Hotel 3 días / 2 noches (Utilizable 1 día)",
    hotel_custom_active: "Hotel personalizado",
    hotel_2d_1n: "Hotel 2 días / 1 noche",
    baggage_1pc_23kg: "1 pc 23kg",
    baggage_2pc_23kg: "2 pc 23kg",
    baggage_1pc_10kg: "1 pc 10kg",
    baggage_backpack: "1 Mochila",
    insurance_tourism_active: "Seguro (Turista / Schengen)",
    insurance_migratory: "Seguro migratorio",
    svc_stewardess_um: "Solicitud de azafata para menor de edad (UMNR) +225 EURO PAGO SÍ INCLUIDO EN EL PRECIO",
    svc_stewardess_um_unpaid: "Solicitud de azafata para menor de edad (UMNR) +225 EURO PAGO NO INCLUIDO EN EL PRECIO",
    svc_pet_travel: "Viaja con mascota",
}

export default async function FlightDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const flight = await getFlightById(id)

    if (!flight) {
        redirect('/portal/vuelos')
    }

    const historyLogs = await getServiceHistory(id, 'flights')
    
    // Combine creation with audit logs
    const timeline = [
        { status: 'CREACIÓN', created_at: flight.created_at, color: 'bg-blue-400' },
        ...historyLogs.map((log: HistoryLog) => ({
            status: STATUS_LABELS[log.status] || log.status.toUpperCase(),
            created_at: log.created_at,
            color: STATUS_COLORS[log.status] || 'bg-slate-400'
        }))
    ]

    let flightDetails: Record<string, string | boolean | number> = {}
    try {
        if (typeof flight?.details === 'string') {
            flightDetails = JSON.parse(flight.details)
        } else if (flight?.details) {
            flightDetails = flight.details
        }
    } catch (e) {
        console.error("Error parsing flight details", e)
    }

    // Process all active details
    const activeDetails: {key: string, label: string}[] = []
    
    Object.entries(flightDetails).forEach(([key, value]) => {
        // Skip keys that shouldn't be shown directly
        if (!value || key === 'hotel_custom_days' || key === 'hotel_custom_nights' || key === 'special_note' || key.startsWith('insurance_tourism_date')) {
            return
        }

        let label = DETAILS_LABELS[key] || key

        // Custom formatting for specific fields
        if (key === 'insurance_tourism_active') {
             const from = flightDetails.insurance_tourism_date_from;
             const to = flightDetails.insurance_tourism_date_to;
             if (typeof from === 'string' && typeof to === 'string' && from && to) {
                 const fromFormatted = new Date(from).toLocaleDateString('es-PE');
                 const toFormatted = new Date(to).toLocaleDateString('es-PE');
                 label = `Seguro desde ${fromFormatted} hasta ${toFormatted} (turista / Schengen)`;
             }
        } else if (key === 'hotel_custom_active') {
            const days = flightDetails.hotel_custom_days || '__';
            const nights = flightDetails.hotel_custom_nights || '__';
            label = `Reserva de hotel por ${days} días / ${nights} noches`;
        }

        activeDetails.push({ key, label })
    })
    
    // Also check for special note
    if (flightDetails.special_note) {
        activeDetails.push({ key: 'special_note', label: `Nota Especial: ${flightDetails.special_note}` })
    }

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                        Detalles del Vuelo
                    </h1>
                    <p className="text-slate-500 text-sm">Información completa de tu reserva.</p>
                </div>
                <Link href="/portal/vuelos">
                    <Button variant="outline" size="sm">
                        Volver
                    </Button>
                </Link>
            </header>

            {/* Main Content Card - Glassmorphism */}
            <div className="bg-white/30 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl overflow-hidden relative z-10">
                
                {/* 1. Flight Details Section */}
                <div className="p-6 border-b border-white/30 relative overflow-hidden">
                   <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                        {/* Left Content (Info) */}
                        <div className="flex-1 space-y-8">
                             {/* Header Line */}
                             <div className="flex items-start gap-4">
                                <div className="bg-white/80 p-3 rounded-xl border border-white/50 text-chimipink shadow-sm">
                                    <Plane size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{flight.airline}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-semibold px-2 py-0.5 bg-white/60 text-slate-600 rounded border border-white/40">
                                            PNR: {flight.pnr || 'N/A'}
                                        </span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${
                                            flight.status === 'confirmed' || flight.status === 'scheduled' ? 'bg-green-100/80 text-green-700' :
                                            flight.status === 'cancelled' ? 'bg-red-100/80 text-red-700' :
                                            'bg-yellow-100/80 text-yellow-700'
                                        }`}>
                                            {flight.status === 'scheduled' ? 'Programado' : 
                                             flight.status === 'confirmed' ? 'Confirmado' :
                                             flight.status === 'cancelled' ? 'Cancelado' :
                                             flight.status === 'pending' ? 'Pendiente' :
                                             flight.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Date & Itinerary */}
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Calendar size={14} /> Fecha de Viaje
                                        </h3>
                                        <p className="text-xl font-medium text-slate-800">
                                            {new Date(flight.travel_date).toLocaleDateString(undefined, { 
                                                weekday: 'long', 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric' 
                                            })}
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-2">Itinerario</h3>
                                        <div className="bg-white/40 p-4 rounded-lg border border-white/40 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                                            {flight.itinerary || 'No hay información de itinerario disponible.'}
                                        </div>
                                    </div>

                                    {/* Flight Details (Tu Vuelo Incluye) */}
                                    {activeDetails.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <Plane size={14} /> Tu Vuelo Incluye
                                            </h3>
                                            <div className="bg-white/40 p-4 rounded-lg border border-white/40">
                                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {activeDetails.map(({ key, label }) => (
                                                        <li key={key} className="flex items-center gap-2 text-sm text-slate-700">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-chimiteal shrink-0" />
                                                            {label}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                    {/* Status Timeline */}
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Clock size={14} /> Historial de Cambio
                                        </h3>
                                        <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
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

                                {/* Documents Group */}
                                <div className="space-y-8">
                                    {/* Documents */}
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <FileText size={14} /> Documentos
                                        </h3>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {flight.documents && flight.documents.length > 0 ? (
                                                flight.documents.map((doc: FlightDocument, idx: number) => (
                                                    <FlightDocumentRow key={idx} doc={doc} />
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">No hay documentos cargados.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Integrated Payment Info (Moved Here) */}
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Banknote size={14} /> Estado de Pago
                                        </h3>
                                        <div className="bg-white/40 border border-white/40 rounded-xl p-4 space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600">Costo Total</span>
                                                <span className="font-bold text-slate-800">{formatCurrency(flight.sold_price)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600">A cuenta</span>
                                                <span className="font-bold text-green-600">{formatCurrency(flight.on_account)}</span>
                                            </div>
                                            <div className="border-t border-white/30 pt-3 flex justify-between items-center">
                                                <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Saldo Pendiente</span>
                                                
                                                <div className={`px-4 py-2 rounded-xl border-2 transition-all shadow-lg ${
                                                    flight.balance > 0 
                                                        ? 'bg-red-600 border-red-700 text-white shadow-red-200/50 animate-pulse-fast' 
                                                        : 'bg-green-100/80 border-green-200 text-green-800'
                                                }`}>
                                                    <span className="font-bold text-lg">{formatCurrency(flight.balance)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Content (Image) */}
                        <div className="w-full lg:w-1/3 flex items-center justify-center lg:justify-end">
                             <div className="relative w-full max-w-[200px] md:max-w-[350px] aspect-4/5 lg:mr-8 transition-transform hover:scale-105 duration-500">
                                <Image 
                                    src="/img-detallevuelo.webp" 
                                    alt="Detalle de Vuelo" 
                                    width={350}
                                    height={438}
                                    className="object-contain w-full h-full drop-shadow-2xl"
                                />
                             </div>
                        </div>
                   </div>

                </div>

                {/* Generic Info (Full Width) */}
                <div className="bg-white/40 border-t border-white/30 p-6">
                    <h4 className="font-semibold text-slate-800 mb-2">Información Importante</h4>
                    <p className="text-sm text-slate-500">
                        Recuerda revisar que tu pasaporte tenga una vigencia mínima de 6 meses. 
                        Llega al aeropuerto con 3 horas de anticipación para vuelos internacionales.
                    </p>
                </div>

                {/* Recommendations Section - Integrated */}
                <div className="border-t border-white/30">
                    <FlightRecommendations />
                </div>

                {/* FAQ Section - Integrated */}
                <div className="border-t border-white/30">
                    <FlightFAQ />
                </div>
            </div>
        </div>
    )
}
