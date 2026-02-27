'use client'

import { useState } from 'react'
import { Languages, Calendar, ArrowRight, FileText } from "lucide-react"
import { TermsGuard } from '@/components/client/TermsGuard'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface Translation {
    id: string
    created_at: string
    tracking_code: string
    document_types: string[]
    status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled'
    terms_accepted_at?: string
    source_language?: string
    target_language?: string
}

export default function TranslationList({ translations, termsContent, termsVersion }: { translations: Translation[], termsContent: string, termsVersion: string }) {
    const [selectedTranslation, setSelectedTranslation] = useState<Translation | null>(null)
    const [showTerms, setShowTerms] = useState(false)
    const router = useRouter()

    const handleTranslationClick = (translation: Translation) => {
        if (!translation.terms_accepted_at) {
            setSelectedTranslation(translation)
            setShowTerms(true)
        } else {
            router.push(`/portal/traducciones/${translation.id}`)
        }
    }

    const handleTermsSuccess = () => {
        router.refresh()
        if (selectedTranslation) {
            router.push(`/portal/traducciones/${selectedTranslation.id}`)
        }
    }

    if (!translations || translations.length === 0) {
        return (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-chimipink">
                    <Languages size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-700">No tienes trámites de traducción</h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                    Tus servicios de traducción aparecerán aquí.
                </p>
            </div>
        )
    }

    return (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {translations.map((translation) => {
                const isTermsAccepted = !!translation.terms_accepted_at

                return (
                    <div 
                        key={translation.id} 
                        onClick={() => handleTranslationClick(translation)}
                        className="cursor-pointer group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                    >
                        {/* Status Bar */}
                        <div className={cn(
                            "absolute left-0 top-0 bottom-0 w-1.5",
                            translation.status === 'delivered' || translation.status === 'completed' ? "bg-emerald-500" :
                            translation.status === 'cancelled' ? "bg-red-500" : "bg-amber-500"
                        )} />

                        <div className="p-6">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-start gap-4">
                                    <div className="bg-slate-50 p-3 rounded-xl text-slate-700 group-hover:text-chimiteal transition-colors">
                                        <Languages size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg">Traducción</h3>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block uppercase tracking-widest">
                                            ID: {translation.tracking_code || translation.id.slice(0, 8)}
                                        </span>
                                    </div>
                                </div>
                                
                                {!isTermsAccepted && (
                                    <div className="text-chimipink animate-pulse" title="Acción Requerida">
                                        <div className="h-2 w-2 rounded-full bg-chimipink" />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="space-y-4 mb-6">
                                <div className="flex items-center gap-3 text-slate-700">
                                    <FileText size={18} className="text-slate-400" />
                                    <span className="font-bold text-sm truncate">
                                        {translation.document_types?.join(', ') || 'Documentos'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Calendar size={14} />
                                        <span>{new Date(translation.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter",
                                        translation.status === 'delivered' || translation.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                                        translation.status === 'cancelled' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                    )}>
                                        {translation.status === 'completed' ? 'Completado' : 
                                         translation.status === 'delivered' ? 'Entregado' :
                                         translation.status === 'cancelled' ? 'Cancelado' :
                                         translation.status === 'in_progress' ? 'En Proceso' : 
                                         'Pendiente'}
                                    </span>
                                </div>
                            </div>

                            {/* Action */}
                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-chimiteal transition-colors">
                                <span>VER DETALLES</span>
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                )
            })}

            {selectedTranslation && (
                <TermsGuard 
                    open={showTerms} 
                    onOpenChange={setShowTerms}
                    serviceId={selectedTranslation.id}
                    serviceType="translation" 
                    termsContent={termsContent} 
                    termsVersion={termsVersion}
                    onSuccess={handleTermsSuccess}
                />
            )}
        </div>
    )
}
