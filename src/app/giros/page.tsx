'use client'

import { useState, useEffect, Suspense } from 'react'
import { getTransferByCode } from '@/app/actions/manage-transfers'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, CheckCircle, Clock, AlertTriangle, XCircle, ArrowRight } from "lucide-react"
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'

interface TransferResult {
    created_at: string
    amount_sent: number
    amount_received: number
    beneficiary_name: string
    beneficiary_bank?: string | null
    beneficiary_account?: string | null
    sender_name: string
    code: string
    status: 'pending' | 'processing' | 'available' | 'completed' | 'cancelled'
}

function TrackingContent() {
    const searchParams = useSearchParams()
    const [code, setCode] = useState('')
    const [result, setResult] = useState<TransferResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [searched, setSearched] = useState(false)

    // Effect to handle URL params
    useEffect(() => {
        const codeParam = searchParams.get('code')
        if (codeParam && !searched) {
            setCode(codeParam)
            performSearch(codeParam)
        }
    }, [searchParams, searched])

    const performSearch = async (searchCode: string) => {
        if (!searchCode.trim()) return

        setLoading(true)
        setError('')
        setResult(null)
        setSearched(true)

        try {
            const res = await getTransferByCode(searchCode)
            if (res.error) {
                setError(res.error)
            } else if (res.data) {
                setResult(res.data as TransferResult)
            }
        } catch {
            setError('Error al conectar con el servidor')
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        performSearch(code)
    }

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'pending':
                return { label: 'Pendiente', color: 'text-amber-600', bg: 'bg-amber-100', icon: Clock, desc: 'En espera de procesamiento.' }
            case 'processing':
                return { label: 'En Proceso', color: 'text-blue-600', bg: 'bg-blue-100', icon: Loader2, desc: 'Envío en curso.' }
            case 'available':
                return { label: 'Para Cobro', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle, desc: 'Listo para retiro.' }
            case 'completed':
                return { label: 'Entregado', color: 'text-slate-600', bg: 'bg-slate-200', icon: CheckCircle, desc: 'Dinero entregado exitosamente.' }
            case 'cancelled':
                return { label: 'Cancelado', color: 'text-red-600', bg: 'bg-red-100', icon: XCircle, desc: 'Giro cancelado.' }
            default:
                return { label: 'Desconocido', color: 'text-slate-500', bg: 'bg-slate-100', icon: AlertTriangle, desc: 'Estado no identificado.' }
        }
    }

    const statusInfo = result ? getStatusInfo(result.status) : null
    const StatusIcon = statusInfo ? statusInfo.icon : null

    return (
        <div className="w-full max-w-md z-10">
            <div className="flex justify-center mb-8">
                <div className="relative w-48 h-16">
                    <Image
                        src="/chimilogosidebar.svg"
                        alt="Chimivuelos Logo"
                        fill
                        priority
                        className="object-contain"
                    />
                </div>
            </div>

            <Card className="border-slate-200 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold text-slate-800">
                        Seguimiento de Giros
                    </CardTitle>
                    <CardDescription>
                        Ingrese el código de su envío para consultar el estado.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                            <Input 
                                className="pl-10 h-12 text-lg text-center tracking-wider uppercase font-medium border-slate-300 focus:border-chimipink focus:ring-chimipink" 
                                placeholder="EJ: GIR-1234" 
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                            />
                        </div>
                        <Button 
                            type="submit" 
                            disabled={loading || !code.trim()}
                            className="w-full h-12 bg-linear-to-r from-chimipink to-chimicyan font-bold text-slate-800 hover:opacity-90 transition-opacity"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Buscando...
                                </>
                            ) : (
                                'Rastrear Envío'
                            )}
                        </Button>
                    </form>

                    {error && (
                        <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-100 flex items-center gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                            <XCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Results Area */}
                    {result && statusInfo && StatusIcon && (
                        <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-top-4">
                            
                            {/* Status Banner - Redesigned to be smaller and cleaner */}
                            <div className={`flex items-center gap-4 p-4 rounded-xl border ${statusInfo.bg} border-opacity-60 shadow-xs relative overflow-hidden group`}>
                                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-white/90 shadow-xs ${statusInfo.color}`}>
                                    <StatusIcon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0 z-10">
                                    <h3 className={`font-bold text-base ${statusInfo.color}`}>
                                        {statusInfo.label}
                                    </h3>
                                    <p className="text-xs text-slate-600 truncate">
                                        {statusInfo.desc}
                                    </p>
                                </div>
                                {/* Decorative circle */}
                                <div className={`absolute -right-4 -top-8 w-24 h-24 rounded-full opacity-10 ${statusInfo.color.replace('text-', 'bg-')}`} />
                            </div>

                            {/* Main Details Grid */}
                            <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-5 space-y-5">
                                {/* Header: Dates & Code */}
                                <div className="flex justify-between items-start pb-4 border-b border-slate-200/60">
                                    <div>
                                        <p className="text-[10px] tracking-wider font-bold text-slate-400 uppercase mb-0.5">Código de Giro</p>
                                        <p className="font-mono text-lg font-bold text-slate-700">{result.code}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] tracking-wider font-bold text-slate-400 uppercase mb-0.5">Fecha de Envío</p>
                                        <p className="font-semibold text-slate-700 text-sm">{new Date(result.created_at).toLocaleDateString('es-PE')}</p>
                                    </div>
                                </div>

                                {/* Flow: Sender -> Receiver */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <div>
                                        <p className="text-[10px] tracking-wider font-bold text-slate-400 uppercase mb-1">Remitente</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                                                {result.sender_name.charAt(0)}
                                            </div>
                                            <p className="text-sm font-semibold text-slate-700 truncate">{result.sender_name}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] tracking-wider font-bold text-slate-400 uppercase mb-1">Beneficiario</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-chimipink/10 flex items-center justify-center text-chimipink font-bold text-xs shrink-0">
                                                {result.beneficiary_name.charAt(0)}
                                            </div>
                                            <p className="text-sm font-semibold text-slate-700 truncate">{result.beneficiary_name}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Bank Details (If any) */}
                                {(result.beneficiary_bank || result.beneficiary_account) && (
                                     <div className="pt-2">
                                        <div className="bg-white rounded-lg border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-xs">
                                             {result.beneficiary_bank && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Banco Destino</p>
                                                    <p className="text-sm font-medium text-slate-700">{result.beneficiary_bank}</p>
                                                </div>
                                             )}
                                             {result.beneficiary_account && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Cuenta Destino</p>
                                                    <p className="text-sm font-mono font-medium text-slate-700 tracking-tight break-all">{result.beneficiary_account}</p>
                                                </div>
                                             )}
                                        </div>
                                    </div>
                                )}

                                {/* Financials (Summary) */}
                                <div className="flex flex-col sm:flex-row items-center justify-between pt-2 gap-3 sm:gap-0">
                                    <div className="bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 w-full sm:w-auto text-center sm:text-left">
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Enviado</p>
                                        <p className="text-sm font-bold text-emerald-800">€ {result.amount_sent.toFixed(2)}</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-300 rotate-90 sm:rotate-0" />
                                    <div className="bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 w-full sm:w-auto text-center sm:text-right">
                                        <p className="text-[10px] font-bold text-blue-600 uppercase">Recibe</p>
                                        <p className="text-sm font-bold text-blue-800">S/ {result.amount_received.toFixed(2)}</p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    )}

                    {!result && !error && searched && !loading && (
                            <div className="mt-8 text-center text-slate-400 text-sm bg-slate-50 p-6 rounded-xl border border-slate-100">
                                No se encontraron resultados para el código ingresado.
                            </div>
                    )}
                    

                </CardContent>
            </Card>
            
            <p className="mt-8 text-center text-xs text-slate-400">
                &copy; {new Date().getFullYear()} Chimivuelos S.A.C. Todos los derechos reservados.
            </p>
        </div>
    )
}

export default function GirosPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-chimipink/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-chimicyan/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-chimiteal" />
                    <p className="text-slate-500 font-medium">Cargando...</p>
                </div>
            }>
                <TrackingContent />
            </Suspense>
        </div>
    )
}
