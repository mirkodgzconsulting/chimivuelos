'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Banknote, Calendar, AlertCircle, ArrowRight, User } from "lucide-react"
import { TermsGuard } from '@/components/client/TermsGuard'
import { useRouter } from 'next/navigation'

export interface TransferDocument {
    title: string
    path: string
    name: string
    type: string
    size: number
    storage: 'r2' | 'images'
}

export interface MoneyTransfer {
    id: string
    created_at: string
    amount_sent: number
    exchange_rate: number
    amount_received: number
    beneficiary_name: string
    beneficiary_document?: string
    beneficiary_phone?: string
    beneficiary_bank?: string
    beneficiary_account?: string
    transfer_code: string
    status: 'pending' | 'processing' | 'available' | 'completed' | 'cancelled' | 'delivered' | 'scheduled'
    documents?: TransferDocument[]
    terms_accepted_at?: string
    terms_ip?: string
    terms_metadata?: Record<string, unknown>
}

export default function TransferList({ transfers, termsContent, termsVersion }: { transfers: MoneyTransfer[], termsContent: string, termsVersion: string }) {
    const [selectedTransfer, setSelectedTransfer] = useState<MoneyTransfer | null>(null)
    const [showTerms, setShowTerms] = useState(false)
    const router = useRouter()

    const handleTransferClick = (transfer: MoneyTransfer) => {
        if (!transfer.terms_accepted_at) {
            setSelectedTransfer(transfer)
            setShowTerms(true)
        } else {
            router.push(`/portal/giros/${transfer.id}`)
        }
    }

    const handleTermsSuccess = () => {
        router.refresh()
        if (selectedTransfer) {
            router.push(`/portal/giros/${selectedTransfer.id}`)
        }
    }

    const formatMoney = (amount: number, currency = 'EUR') => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(amount)
    }

    if (!transfers || transfers.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-chimipink">
                    <Banknote size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-700">No tienes giros registrados</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Tus giros aparecerán aquí.
                </p>
            </div>
        )
    }

    return (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {transfers.map((transfer) => {
                const isTermsAccepted = !!transfer.terms_accepted_at

                return (
                    <Card 
                        key={transfer.id} 
                        onClick={() => handleTransferClick(transfer)}
                        className="cursor-pointer group overflow-hidden shadow-sm hover:shadow-md transition-all border-slate-200 relative"
                    >
                        {/* Status Bar */}
                        <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1",
                            transfer.status === 'completed' || transfer.status === 'delivered' ? "bg-emerald-500" :
                            transfer.status === 'cancelled' ? "bg-red-500" : "bg-amber-500"
                        )} />

                        <CardContent className="p-6">
                            
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-start gap-4">
                                    <div className="bg-slate-50 p-3 rounded-xl text-slate-700 group-hover:text-chimipink transition-colors">
                                        <Banknote size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-1000 text-lg">{formatMoney(transfer.amount_sent, 'EUR')}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Giro de Dinero</p>
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
                                    <span className="font-bold text-sm truncate">{transfer.beneficiary_name}</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Calendar size={14} />
                                        <span>{new Date(transfer.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter",
                                        transfer.status === 'completed' || transfer.status === 'delivered' ? "bg-emerald-100 text-emerald-700" :
                                        transfer.status === 'cancelled' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                    )}>
                                        {transfer.status === 'completed' ? 'Completado' : 
                                         transfer.status === 'delivered' ? 'Entregado' :
                                         transfer.status === 'cancelled' ? 'Cancelado' :
                                         transfer.status === 'available' ? 'Disponible' :
                                         transfer.status === 'processing' ? 'En Proceso' :
                                         transfer.status === 'scheduled' ? 'Programado' :
                                         'Pendiente'}
                                    </span>
                                </div>
                            </div>

                            {/* Action */}
                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-chimipink transition-colors">
                                <span>VER DETALLES</span>
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </CardContent>
                    </Card>
                )
            })}

            {selectedTransfer && (
                <TermsGuard 
                    open={showTerms} 
                    onOpenChange={setShowTerms}
                    serviceId={selectedTransfer.id}
                    serviceType="transfer" 
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
