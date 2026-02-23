'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Package, Calendar, AlertCircle, ArrowRight, User } from "lucide-react"
import { TermsGuard } from '@/components/client/TermsGuard'
import { useRouter } from 'next/navigation'

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
    const router = useRouter()

    const handleParcelClick = (parcel: Parcel) => {
        if (!parcel.terms_accepted_at) {
            setSelectedParcel(parcel)
            setShowTerms(true)
        } else {
            router.push(`/portal/encomiendas/${parcel.id}`)
        }
    }

    const handleTermsSuccess = () => {
        router.refresh()
        if (selectedParcel) {
            router.push(`/portal/encomiendas/${selectedParcel.id}`)
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
                const isTermsAccepted = !!parcel.terms_accepted_at

                return (
                    <Card 
                        key={parcel.id} 
                        onClick={() => handleParcelClick(parcel)}
                        className="cursor-pointer group overflow-hidden shadow-sm hover:shadow-md transition-all border-slate-200 relative"
                    >
                        {/* Status Bar */}
                        <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1",
                            parcel.status === 'delivered' ? "bg-emerald-500" :
                            parcel.status === 'cancelled' ? "bg-red-500" : "bg-amber-500"
                        )} />

                        <CardContent className="p-6">
                            
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-start gap-4">
                                    <div className="bg-slate-50 p-3 rounded-xl text-slate-700 group-hover:text-chimiteal transition-colors">
                                        <Package size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg">Encomienda</h3>
                                        {parcel.tracking_number && (
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block uppercase tracking-widest">
                                                ID: {parcel.tracking_number}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                {!isTermsAccepted && (
                                    <div className="text-chimipink animate-pulse" title="Acción Requerida">
                                        <AlertCircle size={22} />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="space-y-4 mb-6">
                                <div className="flex items-center gap-3 text-slate-700">
                                    <User size={18} className="text-slate-400" />
                                    <span className="font-bold text-sm truncate">{parcel.recipient_name}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Calendar size={14} />
                                        <span>{new Date(parcel.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter",
                                        parcel.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                                        parcel.status === 'cancelled' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                    )}>
                                        {parcel.status === 'delivered' ? 'Entregado' : 
                                         parcel.status === 'cancelled' ? 'Cancelado' :
                                         parcel.status === 'in_transit' ? 'En Tránsito' : 
                                         'Pendiente'}
                                    </span>
                                </div>
                            </div>

                            {/* Action */}
                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-chimiteal transition-colors">
                                <span>VER DETALLES</span>
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </div>
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

function cn(...inputs: (string | boolean | undefined | null)[]) {
    return inputs.filter(Boolean).join(' ')
}
