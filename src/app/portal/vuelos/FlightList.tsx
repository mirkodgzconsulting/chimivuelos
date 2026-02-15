'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plane, Calendar, FileText, Download, AlertCircle, ChevronDown, ArrowRight } from "lucide-react"
import { TermsGuard } from '@/components/client/TermsGuard'
import { getFlightDocumentUrl } from '@/app/actions/manage-flights'
import { cn } from "@/lib/utils"

export interface FlightDocument {
    title: string
    path: string
    name: string
    type: string
    size: number
    storage: 'r2' | 'images'
}

export interface Flight {
    id: string
    airline: string
    status: 'scheduled' | 'delayed' | 'cancelled' | 'landed' | 'finished'
    pnr?: string
    travel_date: string
    itinerary?: string
    documents?: FlightDocument[]
    terms_accepted_at?: string
    terms_ip?: string
}

export default function FlightList({ flights, termsContent, termsVersion }: { flights: Flight[], termsContent: string, termsVersion: string }) {
    const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null)
    const [showTerms, setShowTerms] = useState(false)
    const [expandedFlightId, setExpandedFlightId] = useState<string | null>(null)

    const handleViewDocs = (flight: Flight) => {
        if (!flight.terms_accepted_at) {
            setSelectedFlight(flight)
            setShowTerms(true)
        } else {
            setExpandedFlightId(flight.id === expandedFlightId ? null : flight.id)
        }
    }

    const handleTermsSuccess = () => {
        if (selectedFlight) {
            setExpandedFlightId(selectedFlight.id)
        }
    }

    const handleDownload = async (path: string, storage: 'r2' | 'images') => {
        const result = await getFlightDocumentUrl(path, storage)
        if (result.url) {
            window.open(result.url, '_blank')
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
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {flights.map((flight) => {
                const isExpanded = expandedFlightId === flight.id
                const isTermsAccepted = !!flight.terms_accepted_at

                return (
                    <Card key={flight.id} className="overflow-hidden shadow-sm hover:shadow-md transition-all border-slate-200">
                        <CardContent className="p-4 sm:p-6">
                            
                            {/* Header: Icon, Title, Alert */}
                            <div className="flex justify-between items-start mb-4 sm:mb-6 relative">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl text-slate-700 shrink-0">
                                        <Plane size={24} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-900 text-base sm:text-lg truncate pr-2">{flight.airline || 'Vuelo'}</h3>
                                        {flight.pnr && (
                                            <span className="text-xs sm:text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                                                {flight.pnr}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {!isTermsAccepted && (
                                    <div className="text-chimipink animate-pulse shrink-0" title="Acción Requerida">
                                        <AlertCircle size={22} />
                                    </div>
                                )}
                            </div>

                            {/* Content: Date */}
                            <div className="flex items-center gap-3 text-slate-500 mb-4 sm:mb-6">
                                <Calendar size={18} />
                                <span className="font-medium text-sm sm:text-base">{new Date(flight.travel_date).toLocaleDateString()}</span>
                            </div>

                            {/* Footer: Action Button */}
                            <Button 
                                onClick={() => handleViewDocs(flight)}
                                variant="ghost"
                                className="w-full justify-between px-0 hover:bg-transparent hover:text-chimipink text-slate-800 font-bold group h-auto py-0"
                            >
                                {isTermsAccepted ? (
                                    <>
                                        <span className="text-base">{isExpanded ? 'Ocultar Documentos' : 'Ver Documentos'}</span>
                                        <ChevronDown className={cn("h-5 w-5 transition-transform text-slate-400 group-hover:text-chimipink", isExpanded && "rotate-180")} />
                                    </>
                                ) : (
                                    <>
                                        <span className="text-base">Ver Detalles</span>
                                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1 text-slate-400 group-hover:text-chimipink" />
                                    </>
                                )}
                            </Button>

                            {/* Expanded Content (Only after terms) */}
                            {isExpanded && isTermsAccepted && (
                                <div className="mt-6 pt-6 border-t border-slate-100 animate-in slide-in-from-top-2 space-y-4">
                                    
                                    {/* Flight Details Grid */}
                                    <div className="grid grid-cols-1 gap-4 text-sm">
                                        {flight.itinerary && (
                                            <div className="space-y-1">
                                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Itinerario</span>
                                                <p className="text-slate-600 bg-slate-50 p-3 rounded-md border border-slate-100 font-medium whitespace-pre-wrap">
                                                    {flight.itinerary}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Documents Section */}
                                    <div>
                                        <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3 mt-2">Documentos Disponibles</h4>
                                        <div className="space-y-3">
                                            {flight.documents && flight.documents.length > 0 ? (
                                                flight.documents.map((doc, idx) => (
                                                    <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between hover:border-chimiteal/30 transition-colors">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <FileText size={18} className="text-slate-400 shrink-0" />
                                                            <span className="text-sm font-semibold text-slate-700 truncate">{doc.title || doc.name}</span>
                                                        </div>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleDownload(doc.path, doc.storage)
                                                            }}
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-chimiteal hover:bg-white"
                                                        >
                                                            <Download size={18} />
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-center text-slate-400 py-2 italic bg-slate-50 rounded-lg">No hay documentos adjuntos.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
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
