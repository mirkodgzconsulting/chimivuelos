import { getFlightById } from '@/app/actions/client-portal'
import { redirect } from 'next/navigation'
import { Plane, Calendar, FileText, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ClientDownloadButton } from '../ClientDownloadButton'
import { FlightRecommendations } from '../components/FlightRecommendations'
import { FlightFAQ } from '../components/FlightFAQ'

const formatCurrency = (amount: number | null | undefined) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0)
}

interface FlightDocument {
    title: string
    path: string
    name: string
    storage: 'r2' | 'images'
}

export default async function FlightDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const flight = await getFlightById(id)

    if (!flight) {
        redirect('/portal/vuelos')
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

                                    {/* Integrated Payment Info (Moved Here) */}
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Banknote size={14} /> Estado de Pago
                                        </h3>
                                        <div className="bg-white/40 border border-white/40 rounded-xl p-4 space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600">Costo Total</span>
                                                <span className="font-bold text-slate-800">{formatCurrency(flight.cost)}</span>
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
                                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/60 border border-white/50 rounded-lg hover:bg-white/80 hover:border-chimipink/30 transition-colors group">
                                                        <div className="flex items-center gap-3 flex-1 mr-2">
                                                            <div className="bg-pink-50 text-chimipink p-2 rounded shrink-0">
                                                                <FileText size={16} />
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-700 leading-tight">
                                                                {doc.title || doc.name}
                                                            </span>
                                                        </div>
                                                        <ClientDownloadButton doc={doc} />
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">No hay documentos cargados.</p>
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
                                    src="/img-detallevuelo.webp" 
                                    alt="Detalle de Vuelo" 
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
