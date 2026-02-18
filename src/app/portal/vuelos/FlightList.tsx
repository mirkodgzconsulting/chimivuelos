'use client'

import { useState } from 'react'
import { Plane, Calendar, ArrowRight, Banknote } from "lucide-react"
import { TermsGuard } from '@/components/client/TermsGuard'
import { useRouter } from 'next/navigation'

interface FlightDocument {
    title: string
    path: string
    name: string
    storage: 'r2' | 'images'
}

export interface Flight {
    id: string
    airline: string
    status: 'scheduled' | 'delayed' | 'cancelled' | 'landed' | 'finished' | 'pending' | 'confirmed'
    pnr?: string
    travel_date: string
    itinerary?: string
    documents?: FlightDocument[]
    terms_accepted_at?: string
    balance?: number
}

const formatCurrency = (amount: number | undefined) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount || 0)
}

export default function FlightList({ flights, termsContent, termsVersion }: { flights: Flight[], termsContent: string, termsVersion: string }) {
    const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null)
    const [showTerms, setShowTerms] = useState(false)
    const router = useRouter()

    const handleFlightClick = (flight: Flight) => {
        if (!flight.terms_accepted_at) {
            setSelectedFlight(flight)
            setShowTerms(true)
        } else {
            router.push(`/portal/vuelos/${flight.id}`)
        }
    }

    const handleTermsSuccess = () => {
        router.refresh()
        if (selectedFlight) {
            router.push(`/portal/vuelos/${selectedFlight.id}`)
        }
    }

    if (!flights || flights.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-chimipink">
                    <Plane size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-700">No tienes vuelos registrados</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Tus vuelos aparecerán aquí.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {flights.map((flight) => {
                // Formatting Itinerary
                // If usage of flight.itinerary is generic list, we try to use it. 
                // Fallback: Airline + PNR or Origin -> Dest if available (but flight structure is simple)
                // Assuming itinerary field contains the route like "Lima - Madrid - Milan" as per user request.
                const routeText = flight.itinerary && flight.itinerary.length < 50 ? flight.itinerary : `${flight.airline} (${flight.pnr || 'Vuelo'})`

                return (
                    <div 
                        key={flight.id} 
                        onClick={() => handleFlightClick(flight)}
                        className="cursor-pointer group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                    >
                        {/* Left Color Bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-linear-to-b from-chimipink to-chimicyan"></div>

                        <div className="p-4 pl-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            
                            {/* Flight Info */}
                            <div className="flex-1 flex flex-col md:flex-row md:items-center gap-x-8 gap-y-2">
                                {/* Airline */}
                                <div className="flex items-center gap-3 min-w-fit">
                                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">
                                        {flight.airline}
                                    </span>
                                </div>

                                {/* Route */}
                                <div className="flex items-center gap-2 text-slate-800 text-lg font-bold">
                                    <Plane className="text-chimipink fill-current opacity-20" size={20} />
                                    <span>{routeText}</span>
                                </div>
                                
                                {/* Date */}
                                <div className="flex items-center gap-2 text-sm text-slate-500 min-w-fit">
                                    <Calendar size={16} className="text-slate-400" />
                                    <span className="capitalize">{new Date(flight.travel_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                            </div>

                            {/* Status & Action */}
                            <div className="flex items-center gap-4 min-w-fit">
                                {flight.balance && flight.balance > 0 ? (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white rounded-full shadow-sm shadow-red-200 animate-pulse" title="Saldo pendiente de pago">
                                        <Banknote size={14} />
                                        <span className="text-xs font-bold uppercase tracking-wider">
                                            Tienes una deuda de: {formatCurrency(flight.balance)}
                                        </span>
                                    </div>
                                ) : null}

                                <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${
                                    flight.status === 'confirmed' || flight.status === 'scheduled' ? 'bg-green-100 text-green-700' :
                                    flight.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-yellow-100 text-yellow-700'
                                }`}>
                                   {flight.status === 'scheduled' ? 'Programado' : 
                                    flight.status === 'confirmed' ? 'Confirmado' :
                                    flight.status === 'cancelled' ? 'Cancelado' :
                                    flight.status === 'pending' ? 'Pendiente' :
                                    flight.status}
                                </span>
                                
                                <div className="hidden md:flex items-center gap-1 text-chimipink text-sm font-bold group-hover:translate-x-1 transition-transform">
                                    Ver Detalles <ArrowRight size={16} />
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}

            {selectedFlight && (
                <TermsGuard 
                    open={showTerms} 
                    onOpenChange={setShowTerms}
                    serviceId={selectedFlight.id}
                    serviceType="flight" 
                    termsContent={termsContent} 
                    termsVersion={termsVersion}
                    onSuccess={handleTermsSuccess}
                />
            )}
        </div>
    )
}
