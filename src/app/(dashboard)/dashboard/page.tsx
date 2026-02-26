'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from "next/image"
import { Loader2 } from 'lucide-react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts'
import { getConsolidatedAccounting, PaymentEntry } from '@/app/actions/manage-accounting'

interface MethodStats {
    name: string
    ingresos: number
    gastos: number
}

interface CountryStatsSummary {
    income: number
    expenses: number
}

interface AgentMetric {
    name: string
    fullName: string
    value: number
}

interface AgentSalesData {
    Total: AgentMetric[]
    Vuelo: AgentMetric[]
    Giro: AgentMetric[]
    Encomienda: AgentMetric[]
    Traducción: AgentMetric[]
    Otro: AgentMetric[]
}

interface OperationsDashboardData {
    IT: MethodStats[]
    PE: MethodStats[]
    totals: {
        IT: CountryStatsSummary
        PE: CountryStatsSummary
    }
    agentData: AgentSalesData
}

interface TooltipProps {
    active?: boolean;
    payload?: {
        dataKey: string;
        value: number;
        payload: Record<string, unknown>;
    }[];
    label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
        const ingresos = payload.find((p) => p.dataKey === 'ingresos')?.value || 0;
        const gastos = payload.find((p) => p.dataKey === 'gastos')?.value || 0;
        const balance = ingresos - gastos;

        return (
            <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-100 text-[11px] min-w-[160px]">
                <p className="font-bold mb-2 text-slate-700 uppercase tracking-wide border-b border-slate-50 pb-1">{label}</p>
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-1.5 text-slate-500">
                             <div className="h-1.5 w-1.5 rounded-full bg-[#00d1ff]" />
                             <span>Ingr</span>
                        </div>
                        <span className="font-bold text-slate-700">€{ingresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-1.5 text-slate-500">
                             <div className="h-1.5 w-1.5 rounded-full bg-[#ff4d94]" />
                             <span>Gast</span>
                        </div>
                        <span className="font-bold text-slate-700">€{gastos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="pt-1.5 mt-1 border-t border-slate-100 flex justify-between items-center gap-4">
                        <span className="font-bold text-slate-400 uppercase text-[9px] tracking-widest">Balance</span>
                        <span className={`font-bold ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            €{balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export default function DashboardPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [payments, setPayments] = useState<PaymentEntry[]>([])

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], [])

    useEffect(() => {
        async function loadData() {
            setIsLoading(true)
            try {
                const result = await getConsolidatedAccounting()
                setPayments(result.payments)
            } catch (error) {
                console.error("Error loading dashboard data:", error)
            } finally {
                setIsLoading(false)
            }
        }
        loadData()
    }, [])

    const countryData = useMemo<OperationsDashboardData>(() => {
        const initialAgentData: AgentSalesData = {
            Total: [],
            Vuelo: [],
            Giro: [],
            Encomienda: [],
            Traducción: [],
            Otro: []
        }

        const stats: OperationsDashboardData = {
            IT: [],
            PE: [],
            totals: {
                IT: { income: 0, expenses: 0 },
                PE: { income: 0, expenses: 0 }
            },
            agentData: initialAgentData
        }

        const dailyMap = {
            IT: {} as Record<string, MethodStats>,
            PE: {} as Record<string, MethodStats>
        }

        payments.forEach(p => {
            const paymentDate = p.date.split('T')[0]
            if (paymentDate === todayStr) {
                const country = p.country as 'IT' | 'PE'
                const method = p.method

                if (!dailyMap[country][method]) {
                    dailyMap[country][method] = { name: method, ingresos: 0, gastos: 0 }
                }

                if (p.amountEur > 0) {
                    dailyMap[country][method].ingresos += p.amountEur
                    stats.totals[country].income += p.amountEur
                } else {
                    const absExp = Math.abs(p.amountEur)
                    dailyMap[country][method].gastos += absExp
                    stats.totals[country].expenses += absExp
                }
            }
        })

        stats.IT = Object.values(dailyMap.IT).map(m => ({
            ...m,
            ingresos: Number(m.ingresos.toFixed(2)),
            gastos: Number(m.gastos.toFixed(2))
        }))
        stats.PE = Object.values(dailyMap.PE).map(m => ({
            ...m,
            ingresos: Number(m.ingresos.toFixed(2)),
            gastos: Number(m.gastos.toFixed(2))
        }))

        // AGENT SALES DATA PROCESSING
        const services = ['Vuelo', 'Giro', 'Encomienda', 'Traducción', 'Otro Servicio']
        const agentsMap = {} as Record<string, Record<string, number>> // AgentName -> { ServiceName -> count }

        payments.forEach(p => {
            const paymentDate = p.date.split('T')[0]
            if (paymentDate === todayStr && p.amountEur > 0) { // Only count positive revenue entries as sales
                const agent = p.agentName || 'Sist / Admin'
                if (!agentsMap[agent]) {
                    agentsMap[agent] = { 'Total': 0 }
                    services.forEach(s => agentsMap[agent][s] = 0)
                }
                
                agentsMap[agent]['Total']++
                if (services.includes(p.serviceType)) {
                    agentsMap[agent][p.serviceType]++
                }
            }
        })

        const agentData: AgentSalesData = {
            Total: [],
            Vuelo: [],
            Giro: [],
            Encomienda: [],
            Traducción: [],
            Otro: []
        }

        Object.entries(agentsMap).forEach(([name, counts]) => {
            const shortName = name.split(' ')[0] // Only first name to save space
            agentData.Total.push({ name: shortName, fullName: name, value: counts['Total'] })
            agentData.Vuelo.push({ name: shortName, fullName: name, value: counts['Vuelo'] })
            agentData.Giro.push({ name: shortName, fullName: name, value: counts['Giro'] })
            agentData.Encomienda.push({ name: shortName, fullName: name, value: counts['Encomienda'] })
            agentData.Traducción.push({ name: shortName, fullName: name, value: counts['Traducción'] })
            agentData.Otro.push({ name: shortName, fullName: name, value: counts['Otro Servicio'] })
        })

        // Sort each by value descending
        Object.keys(agentData).forEach(key => {
            const k = key as keyof AgentSalesData;
            agentData[k].sort((a, b) => b.value - a.value)
        })

        return { ...stats, agentData }
    }, [payments, todayStr])

    if (isLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-200" />
            </div>
        )
    }

    const AgentChart = ({ title, data, variant = 'cyan' }: { title: string, data: AgentMetric[], variant?: 'cyan' | 'pink' }) => {
        const filteredData = data.filter(d => d.value > 0);
        const hasData = filteredData.length > 0;
        const dynamicHeight = Math.max(140, (filteredData.length * 45) + 20);
        
        const gradId = `gradAgent-${variant}`;
        const mainColor = variant === 'cyan' ? '#00d1ff' : '#ff4d94';
        const darkColor = variant === 'cyan' ? '#00b8e6' : '#e6006e';

        return (
            <div className="bg-white/50 p-6 rounded-xl border border-slate-100/60 shadow-xs flex flex-col gap-4 h-full">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">{title}</h3>
                <div style={{ height: `${dynamicHeight}px` }} className="w-full">
                    {hasData ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={filteredData} 
                                layout="vertical" 
                                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                            >
                                <defs>
                                    <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor={mainColor} />
                                        <stop offset="100%" stopColor={darkColor} />
                                    </linearGradient>
                                </defs>
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                    width={70}
                                />
                                <Tooltip 
                                    cursor={{ fill: '#f8fafc' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-100 text-[11px] min-w-[140px]">
                                                    <p className="font-bold mb-2 text-slate-700 uppercase tracking-wide border-b border-slate-50 pb-1">{payload[0].payload.fullName}</p>
                                                    <div className="flex justify-between items-center gap-4 text-slate-500">
                                                        <span>Ventas hoy:</span>
                                                        <span className="font-bold text-base" style={{ color: mainColor }}>{payload[0].value}</span>
                                                    </div>
                                                </div>
                                            )
                                        }
                                        return null;
                                    }}
                                />
                                <Bar 
                                    dataKey="value" 
                                    fill={`url(#${gradId})`}
                                    radius={[0, 4, 4, 0]} 
                                    barSize={26}
                                    label={{ position: 'center', fill: '#000000', fontSize: 11, fontWeight: 700 }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-300 italic text-[11px]">No hay registros hoy</div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-12 py-6 animate-in fade-in duration-700">
            {/* Minimalist Dashboard Header */}
            <header className="flex flex-col items-center justify-center px-2">
                <p className="text-slate-500 font-medium">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </header>

            <section className="space-y-6">
                <div className="px-2">
                    <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Balance Operativo por Método</h2>
                </div>
                <div className="flex flex-col gap-8 px-2">
                    {/* ITALIA GRAPHIC */}
                    <div className="h-[450px] w-full bg-white/50 p-6 rounded-xl border border-slate-100/60 shadow-xs flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Image src="https://flagcdn.com/w40/it.png" width={24} height={18} alt="IT" className="rounded-sm shadow-xs" />
                                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-widest">Italia</h2>
                            </div>
                            <div className="flex gap-6 text-[10px] font-medium uppercase tracking-wider">
                                <div className="flex flex-col items-end">
                                    <span className="text-slate-400">Ingr</span>
                                    <span className="text-slate-700 font-bold">€{countryData.totals.IT.income.toLocaleString('es-ES')}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-slate-400">Gast</span>
                                    <span className="text-slate-700 font-bold">€{countryData.totals.IT.expenses.toLocaleString('es-ES')}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-slate-400">Bal</span>
                                    <span className="text-slate-700 font-bold">€{(countryData.totals.IT.income - countryData.totals.IT.expenses).toLocaleString('es-ES')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1">
                            {countryData.IT.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={countryData.IT} margin={{ top: 0, right: 30, left: 10, bottom: 20 }}>
                                        <defs>
                                            <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#00d1ff" stopOpacity={0.9}/>
                                                <stop offset="95%" stopColor="#00b8e6" stopOpacity={0.9}/>
                                            </linearGradient>
                                            <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ff4d94" stopOpacity={0.9}/>
                                                <stop offset="95%" stopColor="#e6006e" stopOpacity={0.9}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                            interval={0}
                                            dy={10}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                            tickFormatter={(value) => `€${value}`}
                                        />
                                        <Tooltip 
                                            content={<CustomTooltip />}
                                            cursor={{ fill: '#f8fafc', opacity: 0.4 }}
                                        />
                                        <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 600, color: '#64748b' }} />
                                        <Bar name="Ingresos" dataKey="ingresos" stackId="a" fill="url(#gradIngresos)" barSize={24} />
                                        <Bar name="Gastos" dataKey="gastos" stackId="a" fill="url(#gradGastos)" barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300 italic text-sm">Sin movimientos hoy en Italia</div>
                            )}
                        </div>
                    </div>

                    {/* PERU GRAPHIC */}
                    <div className="h-[450px] w-full bg-white/50 p-6 rounded-xl border border-slate-100/60 shadow-xs flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Image src="https://flagcdn.com/w40/pe.png" width={24} height={18} alt="PE" className="rounded-sm shadow-xs" />
                                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-widest">Perú</h2>
                            </div>
                            <div className="flex gap-6 text-[10px] font-medium uppercase tracking-wider">
                                <div className="flex flex-col items-end">
                                    <span className="text-slate-400">Ingr</span>
                                    <span className="text-slate-700 font-bold">€{countryData.totals.PE.income.toLocaleString('es-ES')}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-slate-400">Gast</span>
                                    <span className="text-slate-700 font-bold">€{countryData.totals.PE.expenses.toLocaleString('es-ES')}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-slate-400">Bal</span>
                                    <span className="text-slate-700 font-bold">€{(countryData.totals.PE.income - countryData.totals.PE.expenses).toLocaleString('es-ES')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1">
                            {countryData.PE.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={countryData.PE} margin={{ top: 0, right: 30, left: 10, bottom: 20 }}>
                                        <defs>
                                            <linearGradient id="gradIngresosPE" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#00d1ff" stopOpacity={0.9}/>
                                                <stop offset="95%" stopColor="#00b8e6" stopOpacity={0.9}/>
                                            </linearGradient>
                                            <linearGradient id="gradGastosPE" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ff4d94" stopOpacity={0.9}/>
                                                <stop offset="95%" stopColor="#e6006e" stopOpacity={0.9}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                            interval={0}
                                            dy={10}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                            tickFormatter={(value) => `€${value}`}
                                        />
                                        <Tooltip 
                                            content={<CustomTooltip />}
                                            cursor={{ fill: '#f8fafc', opacity: 0.4 }}
                                        />
                                        <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 600, color: '#64748b' }} />
                                        <Bar name="Ingresos" dataKey="ingresos" stackId="a" fill="url(#gradIngresosPE)" barSize={24} />
                                        <Bar name="Gastos" dataKey="gastos" stackId="a" fill="url(#gradGastosPE)" barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300 italic text-sm">Sin movimientos hoy en Perú</div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-6 pt-8 border-t border-slate-100">
                <div className="px-2">
                    <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Ventas por Agente</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2">
                    <AgentChart title="Consolidado Total de Ventas" data={countryData.agentData.Total} variant="pink" />
                    <AgentChart title="Ventas: Vuelos" data={countryData.agentData.Vuelo} />
                    <AgentChart title="Ventas: Giros" data={countryData.agentData.Giro} />
                    <AgentChart title="Ventas: Encomiendas" data={countryData.agentData.Encomienda} />
                    <AgentChart title="Ventas: Traducciones" data={countryData.agentData.Traducción} />
                    <AgentChart title="Ventas: Otros Servicios" data={countryData.agentData.Otro} />
                </div>
            </section>
        </div>
    )
}
