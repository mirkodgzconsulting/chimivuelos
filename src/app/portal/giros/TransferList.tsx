'use client'

import { useState } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Banknote, Calendar, FileText, Download, AlertCircle, ChevronDown, ArrowRight, User } from "lucide-react"
import { TermsGuard } from '@/components/client/TermsGuard'
import { cn } from "@/lib/utils"

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
    status: 'pending' | 'processing' | 'available' | 'completed' | 'cancelled'
    documents?: TransferDocument[]
    terms_accepted_at?: string
    terms_ip?: string
}

export default function TransferList({ transfers, termsContent, termsVersion }: { transfers: MoneyTransfer[], termsContent: string, termsVersion: string }) {
    const [selectedTransfer, setSelectedTransfer] = useState<MoneyTransfer | null>(null)
    const [showTerms, setShowTerms] = useState(false)
    const [expandedTransferId, setExpandedTransferId] = useState<string | null>(null)

    const handleViewDocs = (transfer: MoneyTransfer) => {
        if (!transfer.terms_accepted_at) {
            setSelectedTransfer(transfer)
            setShowTerms(true)
        } else {
            setExpandedTransferId(transfer.id === expandedTransferId ? null : transfer.id)
        }
    }

    const handleTermsSuccess = () => {
        if (selectedTransfer) {
            setExpandedTransferId(selectedTransfer.id)
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
                const isExpanded = expandedTransferId === transfer.id
                const isTermsAccepted = !!transfer.terms_accepted_at

                return (
                    <Card key={transfer.id} className="overflow-hidden shadow-sm hover:shadow-md transition-all border-slate-200">
                        <CardContent className="p-4 sm:p-6">
                            
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4 sm:mb-6 relative">
                                <div className="flex items-start gap-3 sm:gap-4">
                                    <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl text-slate-700 shrink-0">
                                        <Banknote size={24} />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-900 text-base sm:text-lg">{formatMoney(transfer.amount_sent, 'EUR')}</h3>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Dinero</p>
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
                                    <span className="font-semibold text-sm sm:text-base truncate">{transfer.beneficiary_name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-500">
                                    <Calendar size={18} className="shrink-0" />
                                    <span className="font-medium text-sm sm:text-base">{new Date(transfer.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <Button 
                                onClick={() => handleViewDocs(transfer)}
                                variant="ghost"
                                className="w-full justify-between px-0 hover:bg-transparent hover:text-chimipink text-slate-800 font-bold group h-auto py-0"
                            >
                                {isTermsAccepted ? (
                                    <>
                                        <span className="text-base">{isExpanded ? 'Ocultar Recibo' : 'Ver Recibo'}</span>
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
                                    
                                    {/* Transfer Details Grid */}
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Código de Giro</span>
                                            <p className="font-mono text-slate-700 font-bold bg-slate-100 inline-block px-2 py-0.5 rounded text-xs">
                                                {transfer.transfer_code}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tasa de Cambio</span>
                                            <p className="font-mono text-slate-700">{transfer.exchange_rate ? `1 EUR = ${transfer.exchange_rate} PEN` : '-'}</p>
                                        </div>

                                        <div className="col-span-2 mt-2 pt-2 border-t border-slate-50">
                                            <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                                <User size={16} className="text-chimiteal" />
                                                Datos del Beneficiario
                                            </h5>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Banco</span>
                                                    <p className="font-semibold text-slate-700">{transfer.beneficiary_bank || '-'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cuenta</span>
                                                    <p className="font-mono text-xs text-slate-600 break-all">{transfer.beneficiary_account || '-'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">DNI/Doc</span>
                                                    <p className="font-mono text-slate-600">{transfer.beneficiary_document || '-'}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Teléfono</span>
                                                    <p className="font-mono text-slate-600">{transfer.beneficiary_phone || '-'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100 mt-4">
                                        <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">Monto a Recibir</span>
                                        <span className="font-bold text-emerald-600 text-lg">{formatMoney(transfer.amount_received, 'PEN')}</span>
                                    </div>

                                    <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-3">Comprobantes</h4>
                                    <div className="space-y-3">
                                        {transfer.documents && transfer.documents.length > 0 ? (
                                            transfer.documents.map((doc, idx) => (
                                                <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between hover:border-chimiteal/30 transition-colors">
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
                                            <p className="text-sm text-center text-slate-400 py-2 italic bg-slate-50 rounded-lg">No hay comprobantes.</p>
                                        )}
                                    </div>
                                </div>
                            )}
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
