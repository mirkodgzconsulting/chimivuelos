'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Image from "next/image"
import { 
    ChevronLeft, 
    TrendingUp, 
    TrendingDown,
    History,
    ArrowUpRight,
    Loader2,
    Building2,
    CalendarDays,
    X,
    ArrowDownUp,
    FileSpreadsheet
} from 'lucide-react'
import * as XLSX from 'xlsx'
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
    const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')

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
        const methodPayments = payments.filter(p => {
            const paymentDate = p.date.split('T')[0]
            const isInRange = paymentDate >= startDate && paymentDate <= endDate
            return p.method === methodName && p.country === country && isInRange
        })
        
        const totalIncome = methodPayments.filter(p => p.amountEur > 0).reduce((sum, p) => sum + p.amountEur, 0)
        const totalExpenses = methodPayments.filter(p => p.amountEur < 0).reduce((sum, p) => sum + Math.abs(p.amountEur), 0)
        const balance = methodPayments.reduce((sum, p) => sum + p.amountEur, 0)

        return {
            totalIncome,
            totalExpenses,
            balance
        }
    }

    const countryStats = useMemo(() => {
        const stats = {
            IT: { income: 0, expenses: 0, balance: 0 },
            PE: { income: 0, expenses: 0, balance: 0 }
        }

        payments.forEach(p => {
            const paymentDate = p.date.split('T')[0]
            if (paymentDate >= startDate && paymentDate <= endDate) {
                if (p.country === 'IT') {
                    if (p.amountEur > 0) stats.IT.income += p.amountEur
                    else stats.IT.expenses += Math.abs(p.amountEur)
                    stats.IT.balance += p.amountEur
                } else if (p.country === 'PE') {
                    if (p.amountEur > 0) stats.PE.income += p.amountEur
                    else stats.PE.expenses += Math.abs(p.amountEur)
                    stats.PE.balance += p.amountEur
                }
            }
        })

        return stats
    }, [payments, startDate, endDate])

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
                const isCorrectType = typeFilter === 'all' || (typeFilter === 'income' ? p.amountEur > 0 : p.amountEur < 0)
                
                return isInRange && isCorrectBranch && isCorrectType
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }, [payments, selectedMethod, selectedCountry, startDate, endDate, selectedBranch, typeFilter])

    const { totalIncome, totalExpenses, totalDetail } = useMemo(() => {
        return filteredDetailPayments.reduce((acc, p) => {
            if (p.amountEur > 0) acc.totalIncome += p.amountEur
            else acc.totalExpenses += Math.abs(p.amountEur)
            acc.totalDetail += p.amountEur
            return acc
        }, { totalIncome: 0, totalExpenses: 0, totalDetail: 0 })
    }, [filteredDetailPayments])

    const handleExportExcel = () => {
        const dataToExport = filteredDetailPayments.map(p => ({
            Fecha: new Date(p.date).toLocaleDateString('es-ES'),
            Servicio: p.serviceType,
            PNR_CODI: p.pnr || '--',
            Sede: p.branch || '--',
            Cliente_Proveedor: p.clientName,
            Moneda: p.currency,
            Monto_Original: p.originalAmount,
            Tipo_Cambio: p.exchangeRate.toFixed(2),
            Total_EUR: p.amountEur.toFixed(2)
        }))
        const worksheet = XLSX.utils.json_to_sheet(dataToExport)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Contabilidad")
        XLSX.writeFile(workbook, `Contabilidad_${selectedMethod}_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

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

                                <div className="space-y-1.5 min-w-[140px]">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-0.5">
                                        <Building2 size={12} className="text-chimicyan" /> Sede
                                    </label>
                                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                        <SelectTrigger className="h-9 text-xs border-slate-200 hover:border-chimicyan/40 focus:border-chimicyan/60 transition-all bg-white font-bold w-full rounded-lg shadow-sm">
                                            <SelectValue placeholder="Todas" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas</SelectItem>
                                            {branches.map((b) => (
                                                <SelectItem key={b} value={b}>{b}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5 min-w-[120px]">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-0.5">
                                        <ArrowDownUp size={12} className="text-chimipink" /> Tipo
                                    </label>
                                    <Select value={typeFilter} onValueChange={(v: 'all' | 'income' | 'expense') => setTypeFilter(v)}>
                                        <SelectTrigger className="h-9 text-xs border-slate-200 hover:border-chimipink/40 focus:border-chimipink/60 transition-all bg-white font-bold w-full rounded-lg shadow-sm">
                                            <SelectValue placeholder="Todos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="income">Entradas</SelectItem>
                                            <SelectItem value="expense">Gastos</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                        const now = new Date()
                                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                                        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                                        
                                        setStartDate(`${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`)
                                        setEndDate(`${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`)
                                        setSelectedBranch('all')
                                        setTypeFilter('all')
                                    }}
                                    className="h-9 w-9 text-slate-400 hover:text-chimipink hover:bg-pink-50 rounded-lg transition-all mb-px"
                                    title="Limpiar Filtros"
                                >
                                    <X className="h-4 w-4" />
                                </Button>

                                <Button 
                                    variant="outline" 
                                    size="icon"
                                    onClick={handleExportExcel}
                                    className="h-9 w-9 text-emerald-600 border-slate-200 hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm"
                                    title="Exportar a Excel"
                                >
                                    <FileSpreadsheet className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-6 border-l border-slate-200 pl-6 ml-auto">
                                <div className="flex flex-col items-end pb-0.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">TOTAL INGRESOS</span>
                                    <span className="text-lg font-bold text-emerald-600 leading-none">
                                        € {totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div className="flex flex-col items-end pb-0.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">TOTAL GASTOS</span>
                                    <span className="text-lg font-bold text-rose-600 leading-none">
                                        - € {totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div className="flex flex-col items-end pb-0.5">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">TOTAL CONSOLIDADO</span>
                                    <span className={cn(
                                        "text-3xl font-black leading-none drop-shadow-sm",
                                        totalDetail >= 0 ? "text-chimiteal" : "text-rose-600"
                                    )}>
                                        {totalDetail < 0 ? '- ' : ''}€ {Math.abs(totalDetail).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
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
                                                    "px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-tighter flex items-center gap-1 w-fit",
                                                    p.amountEur >= 0 ? (
                                                        p.serviceType === 'Vuelo' ? "bg-blue-50 text-blue-600" :
                                                        p.serviceType === 'Giro' ? "bg-emerald-50 text-emerald-600" :
                                                        p.serviceType === 'Encomienda' ? "bg-amber-50 text-amber-600" :
                                                        p.serviceType === 'Traducción' ? "bg-purple-50 text-purple-600" :
                                                        "bg-slate-100 text-slate-600"
                                                    ) : "bg-rose-50 text-rose-600 border border-rose-100"
                                                )}>
                                                    {p.amountEur >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
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
                                                <div className={cn("font-bold text-xs", p.amountEur < 0 ? "text-rose-600" : "text-slate-700")}>
                                                    {p.amountEur < 0 ? '-' : ''}{p.currency === 'PEN' ? 'S/' : p.currency === 'USD' ? '$' : '€'} {Math.abs(parseFloat(p.originalAmount)).toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-mono text-[11px] text-slate-500">
                                                {p.exchangeRate.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right">
                                                <span className={cn("text-sm font-black", p.amountEur < 0 ? "text-rose-600" : "text-chimiteal")}>
                                                    {p.amountEur < 0 ? '- ' : ''}€ {Math.abs(p.amountEur).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            {/* Italia Section */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <Image src="https://flagcdn.com/w40/it.png" width={40} height={30} alt="Italia" className="rounded shadow-sm" />
                        <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Italia</h2>
                    </div>

                    {/* Country Totals */}
                    <div className="flex items-center gap-8 bg-slate-50/50 p-2 px-6 rounded-2xl border border-slate-100 shadow-xs animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Ingresos</span>
                            <span className="text-sm font-black text-emerald-600">€ {countryStats.IT.income.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Gastos</span>
                            <span className="text-sm font-black text-rose-500">- € {countryStats.IT.expenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex flex-col pl-6 border-l border-slate-200">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Balance General</span>
                            <span className={cn("text-lg font-black tracking-tight leading-none", countryStats.IT.balance >= 0 ? "text-slate-800" : "text-rose-600")}>
                                {countryStats.IT.balance < 0 ? '- ' : ''}€ {Math.abs(countryStats.IT.balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Compact Date Filter aligned with Header */}
                    <div className="flex items-center gap-2 bg-white/60 p-1 px-3 rounded-full border border-slate-200/60 shadow-xs backdrop-blur-md">
                        <CalendarDays size={10} className="text-chimipink" />
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Filtrar:</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                className="h-5 w-24 text-[10px] border-none bg-transparent font-black text-slate-600 focus:ring-0 cursor-pointer p-0"
                            />
                            <span className="text-slate-300 mx-0.5">—</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)}
                                className="h-5 w-24 text-[10px] border-none bg-transparent font-black text-slate-600 focus:ring-0 cursor-pointer p-0"
                            />
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                                const now = new Date()
                                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                                setStartDate(`${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`)
                                setEndDate(`${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`)
                            }}
                            className="h-5 w-5 text-slate-300 hover:text-chimipink hover:bg-pink-50 rounded-full transition-all"
                            title="Mes Actual"
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
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
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 border-t border-slate-100 pt-12">
                    <div className="flex items-center gap-3">
                        <Image src="https://flagcdn.com/w40/pe.png" width={40} height={30} alt="Perú" className="rounded shadow-sm" />
                        <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Perú</h2>
                    </div>

                    {/* Country Totals */}
                    <div className="flex items-center gap-8 bg-slate-50/50 p-2 px-6 rounded-2xl border border-slate-100 shadow-xs animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Ingresos</span>
                            <span className="text-sm font-black text-emerald-600">€ {countryStats.PE.income.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Gastos</span>
                            <span className="text-sm font-black text-rose-500">- € {countryStats.PE.expenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex flex-col pl-6 border-l border-slate-200">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Balance General</span>
                            <span className={cn("text-lg font-black tracking-tight leading-none", countryStats.PE.balance >= 0 ? "text-slate-800" : "text-rose-600")}>
                                {countryStats.PE.balance < 0 ? '- ' : ''}€ {Math.abs(countryStats.PE.balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Placeholder for symmetry if needed, or just spacers */}
                    <div className="hidden md:block w-[300px]" />
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
    stats: { totalIncome: number, totalExpenses: number, balance: number }, 
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

                <div className="space-y-4">
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/50 space-y-2.5">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ingresos</span>
                            <span className="text-xs font-bold text-emerald-600">
                                € {stats.totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gastos</span>
                            <span className="text-xs font-bold text-rose-500">
                                - € {stats.totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <div className="px-1 pt-1 border-t border-slate-100">
                        <div className="flex justify-between items-end">
                            <div className="flex items-center gap-1.5">
                                {stats.balance >= 0 ? <TrendingUp size={12} className="text-emerald-500" /> : <TrendingDown size={12} className="text-rose-500" />}
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Balance</span>
                            </div>
                            <span className={cn("text-lg font-black tracking-tight", stats.balance >= 0 ? "text-slate-800" : "text-rose-600")}>
                                {stats.balance < 0 ? '- ' : ''}€ {Math.abs(stats.balance).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
