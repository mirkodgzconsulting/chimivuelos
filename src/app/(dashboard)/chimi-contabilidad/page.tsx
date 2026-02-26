'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from "next/image"
import { 
    Calculator, 
    ChevronLeft, 
    TrendingUp, 
    History,
    ArrowUpRight,
    Loader2,
    Building2,
    CalendarDays,
    Filter
} from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from '@/lib/utils'
import { getConsolidatedAccounting, PaymentEntry } from '@/app/actions/manage-accounting'
import { PaymentMethod } from '@/app/actions/manage-payment-methods'

export default function ContabilidadPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [payments, setPayments] = useState<PaymentEntry[]>([])
    const [methodsIT, setMethodsIT] = useState<PaymentMethod[]>([])
    const [methodsPE, setMethodsPE] = useState<PaymentMethod[]>([])
    
    // View state: 'grid' or 'detail'
    const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid')
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
    const [selectedCountry, setSelectedCountry] = useState<'IT' | 'PE' | null>(null)

    // Filters
    // Filters
    const [startDate, setStartDate] = useState<string>(() => {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        // Format to YYYY-MM-DD using local time
        return `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`
    })
    const [endDate, setEndDate] = useState<string>(() => {
        const now = new Date()
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
    })
    const [selectedBranch, setSelectedBranch] = useState<string>('all')

    const loadData = useCallback(async () => {
        setIsLoading(true)
        try {
            const result = await getConsolidatedAccounting()
            setPayments(result.payments)
            setMethodsIT(result.methodsIT)
            setMethodsPE(result.methodsPE)
        } catch (error) {
            console.error("Error loading accounting data:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Helpers for calculations
    const getStatsForMethod = (methodName: string, country: 'IT' | 'PE') => {
        const today = new Date().toISOString().split('T')[0]
        
        const methodPayments = payments.filter(p => p.method === methodName && p.country === country)
        
        const totalGeneral = methodPayments.reduce((sum, p) => sum + p.amountEur, 0)
        const entradaDia = methodPayments
            .filter(p => p.date.startsWith(today))
            .reduce((sum, p) => sum + p.amountEur, 0)

        return {
            entradaDia,
            totalGeneral
        }
    }

    const branches = useMemo(() => {
        if (!selectedMethod || !selectedCountry) return []
        const methodPayments = payments.filter(p => p.method === selectedMethod && p.country === selectedCountry)
        return Array.from(new Set(methodPayments.map(p => p.branch).filter(Boolean))).sort() as string[]
    }, [payments, selectedMethod, selectedCountry])

    const filteredDetailPayments: PaymentEntry[] = useMemo(() => {
        if (!selectedMethod || !selectedCountry) return []
        return payments
            .filter(p => {
                const matchMethod = p.method === selectedMethod && p.country === selectedCountry
                if (!matchMethod) return false
                
                const paymentDate = p.date.split('T')[0]
                const isInRange = paymentDate >= startDate && paymentDate <= endDate
                const isCorrectBranch = selectedBranch === 'all' || p.branch === selectedBranch
                
                return isInRange && isCorrectBranch
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }, [payments, selectedMethod, selectedCountry, startDate, endDate, selectedBranch])

    const totalDetail = useMemo(() => {
        return filteredDetailPayments.reduce((sum: number, p: PaymentEntry) => sum + p.amountEur, 0)
    }, [filteredDetailPayments])

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-chimicyan" />
                    <p className="text-slate-500 font-medium animate-pulse">Cargando contabilidad...</p>
                </div>
            </div>
        )
    }

    if (viewMode === 'detail' && selectedMethod) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-slate-200/60 shadow-xl overflow-hidden bg-white">
                    {/* Integrated Header: Title, Navigation, Filters and Total */}
                    <div className="bg-slate-50/50 border-b border-slate-100 p-6 space-y-6">
                        <div className="flex items-center gap-4">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setViewMode('grid')}
                                className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 font-bold h-9 px-3 shadow-sm"
                            >
                                <ChevronLeft className="h-4 w-4 mr-2" /> Volver
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                    <History className="text-chimipink h-5 w-5" />
                                    Historial: <span className="font-bold">{selectedMethod}</span>
                                </h1>
                            </div>
                        </div>

                        {/* Filter Bar & Total - Unified Row */}
                        <div className="flex flex-wrap items-end justify-between gap-6 mt-4 pt-6 border-t border-slate-200/60">
                            <div className="flex flex-wrap items-end gap-8">
                                <div className="flex items-center gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-0.5">
                                            <CalendarDays size={12} className="text-chimipink" /> Fecha Inicio
                                        </label>
                                        <Input 
                                            type="date" 
                                            value={startDate} 
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="h-9 w-36 text-xs border-slate-200 hover:border-chimipink/40 focus:border-chimipink/60 transition-all bg-white font-bold rounded-lg shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-0.5">
                                            Fecha Fin
                                        </label>
                                        <Input 
                                            type="date" 
                                            value={endDate} 
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="h-9 w-36 text-xs border-slate-200 hover:border-chimipink/40 focus:border-chimipink/60 transition-all bg-white font-bold rounded-lg shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 min-w-[200px]">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-0.5">
                                        <Building2 size={12} className="text-chimicyan" /> Filtrar por Sede
                                    </label>
                                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                        <SelectTrigger className="h-9 text-xs border-slate-200 hover:border-chimicyan/40 focus:border-chimicyan/60 transition-all bg-white font-bold w-full rounded-lg shadow-sm">
                                            <SelectValue placeholder="Todas las sedes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las sedes</SelectItem>
                                            {branches.map((b) => (
                                                <SelectItem key={b} value={b}>{b}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                        const now = new Date()
                                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                                        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                                        
                                        setStartDate(`${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`)
                                        setEndDate(`${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`)
                                        setSelectedBranch('all')
                                    }}
                                    className="text-[10px] font-black text-slate-400 hover:text-chimipink h-9 uppercase px-4 hover:bg-pink-50 rounded-lg transition-all mb-px"
                                >
                                    <Filter className="h-3.5 w-3.5 mr-2" /> Limpiar Filtros
                                </Button>
                            </div>

                            <div className="flex flex-col items-end pb-0.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">TOTAL CONSOLIDADO</span>
                                <span className="text-3xl font-black text-chimiteal leading-none drop-shadow-sm">
                                    € {totalDetail.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                    <th className="p-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-left">Fecha</th>
                                    <th className="p-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Servicio</th>
                                    <th className="p-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">PNR / CODI.</th>
                                    <th className="p-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-left">Sede</th>
                                    <th className="p-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-left">Cliente</th>
                                    <th className="p-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Moneda de Pago</th>
                                    <th className="p-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Cantidad</th>
                                    <th className="p-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-center">Tipo de Cambio (Base EUR)</th>
                                    <th className="p-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest text-right whitespace-nowrap">Equivalente a Abonar (EUR €)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredDetailPayments.length > 0 ? (
                                    filteredDetailPayments.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-4 text-xs font-medium text-slate-600 text-nowrap">
                                                {new Date(p.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    "px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-tighter",
                                                    p.serviceType === 'Vuelo' && "bg-blue-50 text-blue-600",
                                                    p.serviceType === 'Giro' && "bg-emerald-50 text-emerald-600",
                                                    p.serviceType === 'Encomienda' && "bg-amber-50 text-amber-600",
                                                    p.serviceType === 'Traducción' && "bg-purple-50 text-purple-600",
                                                    p.serviceType === 'Otro Servicio' && "bg-slate-100 text-slate-600"
                                                )}>
                                                    {p.serviceType}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded">
                                                    {p.pnr || '--'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-xs font-medium text-slate-500 uppercase tracking-tight">
                                                {p.branch || '--'}
                                            </td>
                                            <td className="p-4 text-xs font-medium text-slate-700">{p.clientName}</td>
                                            <td className="p-4 text-center">
                                                <span className={cn(
                                                    "text-[10px] font-bold px-2 py-1 rounded inline-block min-w-[35px]",
                                                    p.currency === 'PEN' && "bg-rose-50 text-rose-600 border border-rose-100",
                                                    p.currency === 'USD' && "bg-blue-50 text-blue-600 border border-blue-100",
                                                    p.currency === 'EUR' && "bg-slate-100 text-slate-600 border border-slate-200"
                                                )}>
                                                    {p.currency === 'PEN' ? 'SOL' : p.currency === 'USD' ? 'DOL' : p.currency}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="font-bold text-xs text-slate-700">
                                                    {p.currency === 'PEN' ? 'S/' : p.currency === 'USD' ? '$' : '€'} {parseFloat(p.originalAmount).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-mono text-[11px] text-slate-500">
                                                {p.exchangeRate.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className="text-sm font-black text-chimiteal">
                                                    € {p.amountEur.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center text-slate-400 font-medium italic">
                                            No hay registros para este método.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            {/* Header */}
            <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center justify-center gap-2">
                    <Calculator className="h-6 w-6 text-chimipink" />
                    CONTABILIDAD
                </h1>
                <p className="text-slate-400 font-medium uppercase tracking-[0.2em] text-[10px]">
                    Ingresos por Métodos de Pago
                </p>
            </div>

            {/* Italia Section */}
            <div className="space-y-6">
                <div className="flex flex-col items-center justify-center gap-2 px-2">
                    <Image src="https://flagcdn.com/w40/it.png" width={40} height={30} alt="Italia" className="rounded shadow-sm" />
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Italia</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {methodsIT.map((method) => {
                        const stats = getStatsForMethod(method.name, 'IT')
                        return (
                            <MethodCard 
                                key={method.id}
                                name={method.name}
                                country="IT"
                                stats={stats}
                                onVerDetalle={() => {
                                    setSelectedMethod(method.name)
                                    setSelectedCountry('IT')
                                    setViewMode('detail')
                                }}
                            />
                        )
                    })}
                </div>
            </div>

            {/* Perú Section */}
            <div className="space-y-6 pt-6">
                <div className="flex flex-col items-center justify-center gap-2 px-2 border-t border-slate-100 pt-12">
                    <Image src="https://flagcdn.com/w40/pe.png" width={40} height={30} alt="Perú" className="rounded shadow-sm" />
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Perú</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {methodsPE.map((method) => {
                        const stats = getStatsForMethod(method.name, 'PE')
                        return (
                            <MethodCard 
                                key={method.id}
                                name={method.name}
                                country="PE"
                                stats={stats}
                                onVerDetalle={() => {
                                    setSelectedMethod(method.name)
                                    setSelectedCountry('PE')
                                    setViewMode('detail')
                                }}
                            />
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

function MethodCard({ name, stats, onVerDetalle, country }: { 
    name: string, 
    country: 'IT' | 'PE',
    stats: { entradaDia: number, totalGeneral: number }, 
    onVerDetalle: () => void 
}) {
    return (
        <Card 
            onClick={onVerDetalle}
            className="group relative border-slate-200/60 shadow-sm hover:shadow-lg hover:border-chimicyan/30 transition-all duration-300 cursor-pointer bg-white overflow-hidden rounded-xl"
        >
            <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5 max-w-[85%]">
                        <h3 className="font-bold text-slate-700 text-sm leading-tight group-hover:text-chimicyan transition-colors line-clamp-1">
                            {name}
                        </h3>
                    </div>
                    <div className={cn(
                        "p-1.5 rounded-md transition-colors",
                        country === 'IT' ? "text-blue-400 group-hover:bg-blue-50" : "text-rose-400 group-hover:bg-rose-50"
                    )}>
                        <ArrowUpRight size={16} strokeWidth={2.5} />
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                        <div className="flex items-center gap-1.5">
                            <TrendingUp size={12} className="text-emerald-500" />
                            <span className="text-[9px] font-medium text-slate-500 uppercase">Entrada hoy</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600">
                            € {stats.entradaDia.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                    </div>

                    <div className="pt-1">
                        <div className="flex justify-between items-end">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Acumulado</span>
                            <span className="text-base font-semibold text-slate-800">
                                € {stats.totalGeneral.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
