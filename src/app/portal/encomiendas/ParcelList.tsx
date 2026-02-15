'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, Calendar, FileText, Download, AlertCircle, ChevronDown, ArrowRight, User } from "lucide-react"
import { TermsGuard } from '@/components/client/TermsGuard'
import { cn } from "@/lib/utils"

export interface ParcelDocument {
    title: string
    path: string
    name: string
    type: string
    size: number
    storage: 'r2' | 'images'
}

export interface Parcel {
    id: string
    tracking_number?: string
    created_at: string
    recipient_name: string
    recipient_address?: string
    recipient_phone?: string
    recipient_document?: string
    package_type?: string
    package_weight?: string
    package_description?: string
    status: 'pending' | 'in_transit' | 'delivered' | 'cancelled'
    documents?: ParcelDocument[]
    terms_accepted_at?: string
    terms_ip?: string
}

export default function ParcelList({ parcels, termsContent, termsVersion }: { parcels: Parcel[], termsContent: string, termsVersion: string }) {
    const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null)
    const [showTerms, setShowTerms] = useState(false)
    const [expandedParcelId, setExpandedParcelId] = useState<string | null>(null)

    const handleViewDocs = (parcel: Parcel) => {
        if (!parcel.terms_accepted_at) {
            setSelectedParcel(parcel)
            setShowTerms(true)
        } else {
            setExpandedParcelId(parcel.id === expandedParcelId ? null : parcel.id)
        }
    }

    const handleTermsSuccess = () => {
        if (selectedParcel) {
            setExpandedParcelId(selectedParcel.id)
        }
    }

    if (!parcels || parcels.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-chimipink">
                    <Package size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-700">No tienes encomiendas</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Tus envíos aparecerán aquí.
                </p>
            </div>
        )
    }

    return (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {parcels.map((parcel) => {
                const isExpanded = expandedParcelId === parcel.id
                const isTermsAccepted = !!parcel.terms_accepted_at

                return (
                    <Card key={parcel.id} className="overflow-hidden shadow-sm hover:shadow-md transition-all border-slate-200">
                        <CardContent className="p-4 sm:p-6">
                            
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4 sm:mb-6 relative">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl text-slate-700 shrink-0">
                                        <Package size={24} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-900 text-base sm:text-lg">Encomienda</h3>
                                        {parcel.tracking_number && (
                                            <span className="text-xs sm:text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-1 inline-block truncate max-w-full">
                                                {parcel.tracking_number}
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

                            {/* Content */}
                            <div className="space-y-3 mb-4 sm:mb-6">
                                <div className="flex items-center gap-3 text-slate-700">
                                    <User size={18} className="text-slate-400 shrink-0" />
                                    <span className="font-semibold text-sm sm:text-base truncate">{parcel.recipient_name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-500">
                                    <Calendar size={18} className="shrink-0" />
                                    <span className="font-medium text-sm sm:text-base">{new Date(parcel.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <Button 
                                onClick={() => handleViewDocs(parcel)}
                                variant="ghost"
                                className="w-full justify-between px-0 hover:bg-transparent hover:text-chimipink text-slate-800 font-bold group h-auto py-0"
                            >
                                {isTermsAccepted ? (
                                    <>
                                        <span className="text-base">{isExpanded ? 'Ocultar Detalles' : 'Ver Detalles'}</span>
                                        <ChevronDown className={cn("h-5 w-5 transition-transform text-slate-400 group-hover:text-chimipink", isExpanded && "rotate-180")} />
                                    </>
                                ) : (
                                    <>
                                        <span className="text-base">Ver Detalles</span>
                                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1 text-slate-400 group-hover:text-chimipink" />
                                    </>
                                )}
                            </Button>

                            {/* Expanded Content */}
                            {isExpanded && isTermsAccepted && (
                                <div className="mt-6 pt-6 border-t border-slate-100 animate-in slide-in-from-top-2 space-y-4">
                                    
                                    {/* Parcel Details Grid */}
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tipo</span>
                                            <p className="font-semibold text-slate-700 capitalize">{parcel.package_type || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Peso</span>
                                            <p className="font-semibold text-slate-700">{parcel.package_weight || '-'}</p>
                                        </div>
                                        
                                        <div className="col-span-2 space-y-1">
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Dirección de Entrega</span>
                                            <p className="text-slate-700 bg-slate-50 p-2 rounded-md border border-slate-100">
                                                {parcel.recipient_address || '-'}
                                            </p>
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Teléfono</span>
                                            <p className="font-mono text-slate-600">{parcel.recipient_phone || '-'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">DNI/Doc</span>
                                            <p className="font-mono text-slate-600">{parcel.recipient_document || '-'}</p>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="mb-4">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold">Descripción</p>
                                        <p className="text-sm text-slate-700 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            &quot;{parcel.package_description || 'Sin descripción'}&quot;
                                        </p>
                                    </div>

                                    <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">Documentos</h4>
                                    <div className="space-y-3">
                                        {parcel.documents && parcel.documents.length > 0 ? (
                                            parcel.documents.map((doc, idx) => (
                                                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between hover:border-chimiteal/30 transition-colors">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <FileText size={18} className="text-slate-400 shrink-0" />
                                                        <span className="text-sm font-semibold text-slate-700 truncate">{doc.title || doc.name}</span>
                                                    </div>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-chimiteal hover:bg-white">
                                                        <Download size={18} />
                                                    </Button>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-center text-slate-400 py-2 italic bg-slate-50 rounded-lg">No hay documentos.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )
            })}

            {selectedParcel && (
                <TermsGuard 
                    open={showTerms} 
                    onOpenChange={setShowTerms}
                    serviceId={selectedParcel.id}
                    serviceType="parcel" 
                    termsContent={termsContent} 
                    termsVersion={termsVersion}
                    onSuccess={handleTermsSuccess}
                />
            )}
        </div>
    )
}
