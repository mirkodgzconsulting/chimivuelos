'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from "next/image"
import { 
    X, 
    Receipt, 
    Loader2, 
    Tag, 
    NotebookPen,
    Plus,
    Trash2,
    Search as SearchIcon,
    Search,
    ExternalLink,
    FileText,
    Package,
    Download,
    Pencil,
    ClipboardList,
    Paperclip,
    ShieldCheck
} from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { getExpenses, createExpense, updateExpense, deleteExpense, getExpenseDocumentUrl, CorporateExpense } from '@/app/actions/manage-expenses'
import { getPaymentMethodsIT, getPaymentMethodsPE, PaymentMethod } from '@/app/actions/manage-payment-methods'
import { createClient } from '@/lib/supabase/client'
import { toast } from "sonner"

// Categories Mapping
const EXPENSE_CATEGORIES = [
    { label: "1. Operación viajes", value: "operacion_viajes", motifs: ["Billetes", "Penalidades", "Proveedores", "Seguros"] },
    { label: "2. Oficina / sede", value: "oficina_sede", motifs: ["Alquiler", "Luz", "Agua", "Internet", "Limpieza"] },
    { label: "3. Pago a personal", value: "pago_personal", motifs: ["Sueldos", "Comisiones", "Bonos", "Aportes"] },
    { label: "4. Tecnología", value: "tecnologia", motifs: ["Software", "Sabre", "Equipos", "Hosting"] },
    { label: "5. Marketing", value: "marketing", motifs: ["Publicidad", "Impresiones", "Diseño"] },
    { label: "6. Financieros", value: "financieros", motifs: ["Comisiones bancarias", "POS", "Transferencias"] },
    { label: "7. Encomiendas", value: "encomiendas", motifs: ["Transporte", "Embalaje", "Logística"] },
    { label: "8. Giros", value: "giros", motifs: ["Comisiones de envío"] },
    { label: "9. Servicios profesionales", value: "servicios_profesionales", motifs: ["Traductores", "Notario", "Abogados", "Contador"] },
    { label: "10. Administrativos / otros", value: "administrativos", motifs: ["Impuestos", "Licencias", "Papelería", "Varios"] },
    { label: "11 Otros gastos", value: "otros", motifs: [] }
]

const SEDE_IT_OPTIONS = ["turro milano", "corsico milano", "roma", "lima", "remoto"]
const CONNECTED_SERVICES = ["Ninguno", "Vuelo", "Giro", "Encomienda", "Traducción", "Otro Servicio"]
const CURRENCY_OPTIONS = ["EUR", "PEN", "USD"]

interface DocumentInput {
    title: string
    file: File | null
}

export default function GastosPage() {
    // Data States
    const [expenses, setExpenses] = useState<CorporateExpense[]>([])
    const [paymentMethodsIT, setPaymentMethodsIT] = useState<PaymentMethod[]>([])
    const [paymentMethodsPE, setPaymentMethodsPE] = useState<PaymentMethod[]>([])
    
    // UI States
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Edit State
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<string | null>(null)

    // Form State
    const [formData, setFormData] = useState({
        expense_date: new Date().toISOString().split('T')[0],
        category: '',
        sub_category: '',
        other_category_details: '',
        connected_record_id: '',
        connected_service: 'Ninguno',
        description: '',
        notes: '',
        sede_it: 'turro milano',
        sede_pe: '',
        metodo_it: '',
        metodo_pe: '',
        original_amount: '',
        currency: 'EUR',
        exchange_rate: '1.00',
        amount_eur: '',
        provider_name: ''
    })

    const [proofFile, setProofFile] = useState<File | null>(null)
    const [existingProof, setExistingProof] = useState<string | null>(null)
    const [numDocs, setNumDocs] = useState<number>(0)
    const [documentInputs, setDocumentInputs] = useState<DocumentInput[]>([])
    const [existingAttachments, setExistingAttachments] = useState<{name: string, title?: string, path: string, type: string, size: number, storage: 'r2' | 'images'}[]>([])

    // UI Helpers (Lists)
    const [showSedeList, setShowSedeList] = useState(false)
    const [showMetodoITList, setShowMetodoITList] = useState(false)
    const [showMetodoPEList, setShowMetodoPEList] = useState(false)

    const fetchUserData = useCallback(async () => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const role = user.user_metadata?.role || 'client'
            setUserRole(role === 'usuario' ? 'agent' : role)
        }
    }, [])

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        try {
            const [expData, itMethods, peMethods] = await Promise.all([
                getExpenses(),
                getPaymentMethodsIT(),
                getPaymentMethodsPE()
            ])
            setExpenses(expData)
            setPaymentMethodsIT(itMethods)
            setPaymentMethodsPE(peMethods)
            await fetchUserData()
        } catch {
            toast.error("Error al cargar los datos")
        } finally {
            setIsLoading(false)
        }
    }, [fetchUserData])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Math EUR
    useEffect(() => {
        const qty = parseFloat(formData.original_amount) || 0
        const rate = parseFloat(formData.exchange_rate) || 1.0
        if (formData.currency === 'EUR') {
            setFormData(prev => ({ ...prev, amount_eur: formData.original_amount, exchange_rate: '1.00' }))
        } else {
            setFormData(prev => ({ ...prev, amount_eur: (qty / rate).toFixed(2) }))
        }
    }, [formData.original_amount, formData.exchange_rate, formData.currency])

    const handleResetForm = () => {
        setFormData({
            expense_date: new Date().toISOString().split('T')[0],
            category: '',
            sub_category: '',
            other_category_details: '',
            connected_record_id: '',
            connected_service: 'Ninguno',
            description: '',
            notes: '',
            sede_it: 'turro milano',
            sede_pe: '',
            metodo_it: '',
            metodo_pe: '',
            original_amount: '',
            currency: 'EUR',
            exchange_rate: '1.00',
            amount_eur: '',
            provider_name: ''
        })
        setProofFile(null)
        setExistingProof(null)
        setNumDocs(0)
        setDocumentInputs([])
        setExistingAttachments([])
        setSelectedId(null)
    }

    const handleEdit = (item: CorporateExpense) => {
        handleResetForm()
        setSelectedId(item.id)
        setFormData({
            expense_date: item.expense_date,
            category: item.category,
            sub_category: item.sub_category,
            other_category_details: item.other_category_details || '',
            connected_record_id: item.connected_record_id || '',
            connected_service: item.connected_service || 'Ninguno',
            description: item.description,
            notes: item.notes || '',
            sede_it: item.sede_it || 'turro milano',
            sede_pe: item.sede_pe || '',
            metodo_it: item.metodo_it || '',
            metodo_pe: item.metodo_pe || '',
            original_amount: item.original_amount.toString(),
            currency: item.currency || 'EUR',
            exchange_rate: item.exchange_rate.toString(),
            amount_eur: item.amount_eur.toString(),
            provider_name: item.provider_name || ''
        })
        setExistingProof(item.proof_path || null)
        setExistingAttachments(item.additional_files || [])
        setIsDialogOpen(true)
    }

    const handleNumDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), 5)
        setNumDocs(val)
        setDocumentInputs(Array.from({ length: val }, (_, i) => ({
            title: documentInputs[i]?.title || "",
            file: documentInputs[i]?.file || null
        })))
    }

    const handleDocInputChange = (index: number, field: keyof DocumentInput, value: string | File | null) => {
        const newInps = [...documentInputs]
        newInps[index] = { ...newInps[index], [field]: value }
        setDocumentInputs(newInps)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.category || !formData.original_amount) {
            toast.error("Por favor completa los campos obligatorios")
            return
        }
        setIsSubmitting(true)
        try {
            const sd = new FormData()
            // Append CORE fields
            sd.append('expense_date', formData.expense_date)
            sd.append('category', formData.category)
            sd.append('sub_category', formData.sub_category)
            sd.append('other_category_details', formData.other_category_details)
            sd.append('connected_record_id', formData.connected_record_id)
            sd.append('connected_service', formData.connected_service)
            sd.append('description', formData.description)
            sd.append('notes', formData.notes)
            sd.append('sede_it', formData.sede_it)
            sd.append('sede_pe', formData.sede_pe)
            sd.append('metodo_it', formData.metodo_it)
            sd.append('metodo_pe', formData.metodo_pe)
            sd.append('original_amount', formData.original_amount)
            sd.append('currency', formData.currency)
            sd.append('exchange_rate', formData.exchange_rate)
            sd.append('amount_eur', formData.amount_eur)
            sd.append('provider_name', formData.provider_name)

            if (proofFile) sd.append('proof_file', proofFile)
            
            if (selectedId) {
                sd.append('id', selectedId)
                sd.append('proof_path_existing', existingProof || '')
                sd.append('additional_files_existing', JSON.stringify(existingAttachments))
            }
            
            // New documents - matches server action
            documentInputs.forEach((doc, index) => {
                if (doc.file) {
                    sd.append(`document_file_${index}`, doc.file)
                    sd.append(`document_title_${index}`, doc.title || "")
                }
            })

            const res = selectedId ? await updateExpense(sd) : await createExpense(sd)
            if (res.success) {
                toast.success(selectedId ? "Gasto actualizado" : "Gasto guardado")
                setIsDialogOpen(false)
                handleResetForm()
                fetchData()
            } else if (res.error) {
                toast.error(res.error)
            }
        } catch (err) {
            const error = err as Error;
            console.error("Save error:", error);
            toast.error("Error al guardar: " + (error.message || "Desconocido"));
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este registro?")) return
        try {
            await deleteExpense(id)
            toast.success("Eliminado")
            fetchData()
        } catch {
            toast.error("Error al eliminar")
        }
    }

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const searchLower = searchTerm.toLowerCase()
            const matchSearch = e.description.toLowerCase().includes(searchLower) ||
                               e.connected_record_id?.toLowerCase().includes(searchLower) ||
                               e.provider_name?.toLowerCase().includes(searchLower)
            const matchCat = categoryFilter === 'all' || e.category === categoryFilter
            return matchSearch && matchCat
        })
    }, [expenses, searchTerm, categoryFilter])

    const paginatedItems = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    if (userRole === 'agent') {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                <div className="bg-red-50 p-6 rounded-full">
                    <ShieldCheck className="h-12 w-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Acceso Denegado</h2>
                <p className="text-slate-500 max-w-md">Lo sentimos, no tienes los permisos necesarios para acceder al módulo de Gastos Corporativos.</p>
                <Button onClick={() => window.location.href = '/dashboard'} variant="outline">
                    Regresar al Dashboard
                </Button>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500 pb-10">
            {/* Header section - EXACTLY matching chimi-otros-servicios */}
            <div className="flex flex-col items-center gap-4">
                <Button 
                    onClick={() => {
                        handleResetForm()
                        setIsDialogOpen(true)
                    }}
                    className="bg-linear-to-r from-chimipink to-chimicyan font-bold text-slate-700 shadow-lg hover:scale-105 transition-transform px-8"
                >
                    <Plus className="mr-2 h-5 w-5" /> Registrar Gasto Corporativo
                </Button>
            </div>

            {/* Table Area */}
            <Card className="border-slate-200 shadow-sm overflow-hidden rounded-xl">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between bg-white">
                    <div className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <Input 
                                placeholder="Buscar por descripción, PNR o proveedor..." 
                                value={searchTerm} 
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                                className="pl-9 h-10 border-slate-200 focus:ring-chimicyan text-xs rounded-lg" 
                            />
                            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        </div>
                        <select 
                            className="h-10 border-slate-200 rounded-lg text-xs px-2 bg-white min-w-[200px] outline-none focus:ring-1 focus:ring-chimicyan" 
                            value={categoryFilter} 
                            onChange={e => setCategoryFilter(e.target.value)}
                        >
                            <option value="all">Todas las categorías</option>
                            {EXPENSE_CATEGORIES.map(cat => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-100">
                                <th className="p-4">FECHA</th>
                                <th className="p-4 text-nowrap">CATEGORÍA</th>
                                <th className="p-4 text-nowrap">MOTIVO</th>
                                <th className="p-4">DESCRIPCIÓN</th>
                                <th className="p-4 text-nowrap">VINCULACIÓN</th>
                                <th className="p-4 text-nowrap">MONTO (€)</th>
                                <th className="p-4 text-nowrap">SEDE</th>
                                <th className="p-4 text-nowrap">MÉTODO</th>
                                <th className="p-4 text-right sticky right-0 bg-slate-50/90 backdrop-blur-sm z-10 border-l border-slate-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] text-[9px]">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr key="loading">
                                    <td colSpan={9} className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-chimiteal" /></td>
                                </tr>
                            ) : paginatedItems.length === 0 ? (
                                <tr key="empty">
                                    <td colSpan={9} className="p-20 text-center text-slate-400 italic text-sm">No se encontraron registros</td>
                                </tr>
                            ) : (
                                paginatedItems.map(item => (
                                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors text-sm">
                                        <td className="p-4 py-3">
                                            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">{new Date(item.expense_date).toLocaleDateString()}</span>
                                        </td>
                                        <td className="p-4 py-3">
                                            <span className="font-bold text-slate-700 text-xs text-nowrap uppercase">
                                                {EXPENSE_CATEGORIES.find(c => c.value === item.category)?.label.split('.')[1] || item.category}
                                            </span>
                                        </td>
                                        <td className="p-4 py-3 text-nowrap">
                                            <span className="text-[10px] text-chimipink font-bold uppercase tracking-tight">{item.sub_category || '--'}</span>
                                        </td>
                                        <td className="p-4 py-3">
                                            <span className="font-bold text-slate-700 line-clamp-1 max-w-[200px]">{item.description}</span>
                                        </td>
                                        <td className="p-4 py-3 text-nowrap">
                                            {item.connected_record_id ? (
                                                <div className="flex items-center gap-1.5 px-2 py-1 bg-cyan-50 border border-cyan-100 rounded-md w-fit">
                                                    <span className="text-[9px] font-bold text-chimicyan uppercase tracking-widest">
                                                        {item.connected_service}: {item.connected_record_id}
                                                    </span>
                                                </div>
                                            ) : <span className="text-[10px] text-slate-300 italic uppercase">Libre</span>}
                                        </td>
                                        <td className="p-4 py-3 text-nowrap">
                                            <span className="font-bold text-slate-800">€ {item.amount_eur.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="p-4 py-3 text-nowrap">
                                            <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
                                                {item.sede_it || item.sede_pe || '--'}
                                            </span>
                                        </td>
                                        <td className="p-4 py-3 text-nowrap">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase italic">{item.metodo_it || item.metodo_pe || 'Efectivo'}</span>
                                        </td>
                                        <td className="p-4 py-3 text-right sticky right-0 bg-pink-50/90 backdrop-blur-sm group-hover:bg-pink-100 z-10 border-l border-pink-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] transition-colors">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => handleEdit(item)}
                                                    className="text-slate-400 hover:text-slate-600 h-8 w-8 p-0"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>

                                                {(userRole === 'admin' || userRole === 'supervisor') && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleDelete(item.id)}
                                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Dialog Form */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) handleResetForm(); }}>
                <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden">
                    <DialogHeader className="border-b border-slate-100 pb-4 mb-4 text-left">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-2 bg-chimipink/10 rounded-lg">
                                <ClipboardList size={20} className="text-chimipink" />
                            </div>
                            <DialogTitle className="text-xl font-black text-slate-800 tracking-tight">
                                {selectedId ? 'Actualizar Gasto Corporativo' : 'Nueva Solicitud Gasto Corporativo'}
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-400 font-medium italic text-xs leading-none">Complete los campos de registro .</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-6 py-4">
                        {/* SECTION: CLASSIFICATION */}
                        <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                            <Label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                <Tag className="h-4 w-4 shrink-0 text-chimipink" /> Clasificación
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Fecha de Gasto</Label>
                                    <Input 
                                        type="date" 
                                        value={formData.expense_date}
                                        onChange={e => setFormData(p => ({ ...p, expense_date: e.target.value }))}
                                        className="h-10 text-sm border-slate-200 focus:ring-chimipink bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Categoría</Label>
                                    <select 
                                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-chimipink"
                                        value={formData.category} 
                                        onChange={e => setFormData(p => ({ ...p, category: e.target.value, sub_category: '' }))}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {EXPENSE_CATEGORIES.map(cat => (
                                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Motivo</Label>
                                    <select 
                                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-chimipink disabled:bg-slate-50"
                                        value={formData.sub_category} 
                                        onChange={e => setFormData(p => ({ ...p, sub_category: e.target.value }))}
                                        disabled={!formData.category}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {EXPENSE_CATEGORIES.find(c => c.value === formData.category)?.motifs.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* SECTION: VINCULACIÓN */}
                        <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                            <Label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                <ExternalLink className="h-4 w-4 shrink-0 text-chimicyan" /> Vinculación Operativa
                            </Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Servicio Relacionado</Label>
                                    <select 
                                        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-chimicyan"
                                        value={formData.connected_service} 
                                        onChange={e => setFormData(p => ({ ...p, connected_service: e.target.value }))}
                                    >
                                        {CONNECTED_SERVICES.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight">PNR / Identificador</Label>
                                    <Input 
                                        placeholder="Ej. ABC123..."
                                        value={formData.connected_record_id}
                                        onChange={e => setFormData(p => ({ ...p, connected_record_id: e.target.value.toUpperCase() }))}
                                        disabled={formData.connected_service === 'Ninguno'}
                                        className="h-10 text-sm border-slate-200 focus:ring-chimicyan bg-white"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Proveedor / Cliente</Label>
                                    <Input 
                                        placeholder="Nombre de la empresa o persona..."
                                        value={formData.provider_name}
                                        onChange={e => setFormData(p => ({ ...p, provider_name: e.target.value }))}
                                        className="h-10 text-sm border-slate-200 focus:ring-chimicyan bg-white font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* DESCRIPTION SECTION - MOVED BELOW VINCULACIÓN */}
                        <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                             <Label className="font-bold text-slate-700 text-sm flex items-center gap-2 uppercase tracking-wider">
                                <Paperclip className="h-4 w-4 text-chimiteal" /> Notas y Detalles
                            </Label>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                     <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Descripción detallada</Label>
                                     <textarea 
                                        value={formData.description}
                                        onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                        className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-chimipink outline-none shadow-sm resize-none"
                                        placeholder="Descripción del egreso..."
                                     />
                                </div>
                                <div className="space-y-2">
                                     <Label className="text-xs font-bold text-slate-500 uppercase tracking-tight">Notas internas</Label>
                                     <Input 
                                        value={formData.notes}
                                        onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                        className="h-10 bg-white border-slate-200"
                                        placeholder="Observaciones de administración..."
                                     />
                                </div>
                            </div>
                        </div>

                        {/* SECTION: REGISTRO ECONÓMICO */}
                        <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                            <Label className="font-bold text-slate-700 text-sm flex items-center gap-2 uppercase tracking-wider">
                                <NotebookPen className="h-4 w-4 shrink-0 text-chimipink" /> REGISTRO DE PAGO
                            </Label>
                            
                            <div className="grid gap-4">
                                <div className="space-y-2 relative">
                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-slate-700 uppercase">🏢 Sedes</Label>
                                    <div className="relative">
                                        <Input 
                                            value={formData.sede_it} 
                                            onChange={e => { setFormData(p => ({ ...p, sede_it: e.target.value })); setShowSedeList(true); }}
                                            onFocus={() => setShowSedeList(true)}
                                            onBlur={() => setTimeout(() => setShowSedeList(false), 200)}
                                            placeholder="Buscar sede..."
                                            autoComplete="off"
                                            className="h-10 text-sm border-slate-200 focus:ring-chimipink pr-8 bg-white"
                                        />
                                        {formData.sede_it ? (
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, sede_it: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 p-0.5"><X size={14} strokeWidth={3} /></button>
                                        ) : (
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        )}
                                    </div>
                                    {showSedeList && (
                                        <div className="absolute top-full z-100 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto font-medium">
                                            {SEDE_IT_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.sede_it.toLowerCase())).map((opt, idx) => (
                                                <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => { setFormData(p => ({ ...p, sede_it: opt })); setShowSedeList(false); }}>{opt}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2 relative">
                                        <Label className="text-xs flex items-center gap-1.5 font-bold text-blue-700 uppercase">
                                            <Image src="https://flagcdn.com/w20/it.png" width={16} height={12} alt="it" className="rounded-sm" /> Método Pago IT
                                        </Label>
                                        <div className="relative">
                                            <Input 
                                                value={formData.metodo_it} 
                                                onChange={e => { setFormData(p => ({ ...p, metodo_it: e.target.value })); setShowMetodoITList(true); }}
                                                onFocus={() => setShowMetodoITList(true)}
                                                onBlur={() => setTimeout(() => setShowMetodoITList(false), 200)}
                                                placeholder="Buscar método..."
                                                autoComplete="off"
                                                className="bg-blue-50/50 border-blue-200 focus:ring-blue-500 pr-8 h-10 text-sm"
                                            />
                                            {formData.metodo_it && (
                                                <button type="button" onClick={() => setFormData(p => ({ ...p, metodo_it: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400"><X size={14} strokeWidth={3}/></button>
                                            )}
                                        </div>
                                        {showMetodoITList && (
                                            <div className="absolute top-full z-100 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto font-medium">
                                                {paymentMethodsIT.map(m => m.name).filter(opt => opt.toLowerCase().includes(formData.metodo_it.toLowerCase())).map((opt, idx) => (
                                                    <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => { setFormData(p => ({ ...p, metodo_it: opt })); setShowMetodoITList(false); }}>{opt}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2 relative">
                                        <Label className="text-xs flex items-center gap-1.5 font-bold text-rose-700 uppercase">
                                            <Image src="https://flagcdn.com/w20/pe.png" width={16} height={12} alt="pe" className="rounded-sm" /> Método Pago PE
                                        </Label>
                                        <div className="relative">
                                            <Input 
                                                value={formData.metodo_pe} 
                                                onChange={e => { setFormData(p => ({ ...p, metodo_pe: e.target.value })); setShowMetodoPEList(true); }}
                                                onFocus={() => setShowMetodoPEList(true)}
                                                onBlur={() => setTimeout(() => setShowMetodoPEList(false), 200)}
                                                placeholder="Buscar método..."
                                                autoComplete="off"
                                                className="bg-rose-50/50 border-rose-200 focus:ring-rose-500 pr-8 h-10 text-sm"
                                            />
                                            {formData.metodo_pe && (
                                                <button type="button" onClick={() => setFormData(p => ({ ...p, metodo_pe: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400"><X size={14} strokeWidth={3}/></button>
                                            )}
                                        </div>
                                        {showMetodoPEList && (
                                            <div className="absolute top-full z-100 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto font-medium">
                                                {paymentMethodsPE.map(m => m.name).filter(opt => opt.toLowerCase().includes(formData.metodo_pe.toLowerCase())).map((opt, idx) => (
                                                    <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => { setFormData(p => ({ ...p, metodo_pe: opt })); setShowMetodoPEList(false); }}>{opt}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-tight">Moneda</Label>
                                        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                                            {CURRENCY_OPTIONS.map(curr => (
                                                <button
                                                    key={curr}
                                                    type="button"
                                                    className={`h-7 rounded-md text-[10px] font-black transition-all ${formData.currency === curr ? 'bg-chimipink text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                    onClick={() => setFormData(p => ({ ...p, currency: curr }))}
                                                >
                                                    {curr}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-tight">Cantidad</Label>
                                        <Input 
                                            type="number" 
                                            value={formData.original_amount} 
                                            onChange={e => setFormData(p => ({ ...p, original_amount: e.target.value }))} 
                                            className="h-10 border-slate-200 font-bold bg-white" 
                                            placeholder="0.00" 
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-tight">T. Cambio</Label>
                                        <Input 
                                            type="number" 
                                            step="0.0001" 
                                            value={formData.exchange_rate} 
                                            onChange={e => setFormData(p => ({ ...p, exchange_rate: e.target.value }))} 
                                            disabled={formData.currency === 'EUR'} 
                                            className="h-10 text-sm border-slate-200 font-medium bg-white disabled:bg-slate-50" 
                                            placeholder="1.0000"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-emerald-700 uppercase tracking-tight">Equivalente EUR (€)</Label>
                                        <div className="h-10 px-3 flex items-center bg-emerald-50 rounded-md border border-emerald-100 font-black text-emerald-600 text-lg">
                                            {formData.amount_eur || '0.00'}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-tight">Foto Comprobante</Label>
                                        <Input type="file" accept="image/*" onChange={e => setProofFile(e.target.files?.[0] || null)} className="h-10 bg-white cursor-pointer" />
                                        {existingProof && (
                                            <div className="flex items-center gap-2 mt-1 p-2 bg-emerald-50 rounded border border-emerald-100 animate-in fade-in duration-300">
                                                <Receipt size={14} className="text-emerald-600" />
                                                <span className="text-[10px] font-bold text-emerald-700 truncate flex-1">Comprobante guardado</span>
                                                <div className="flex gap-1">
                                                    <Button type="button" variant="ghost" size="sm" onClick={async () => {
                                                        const url = await getExpenseDocumentUrl(existingProof)
                                                        window.open(url, '_blank')
                                                    }} className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100">
                                                        <Download size={14} />
                                                    </Button>
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => setExistingProof(null)} className="h-6 w-6 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-100">
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-center pt-2 border-t border-slate-100/50 italic mt-2">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Vista Previa de Pago</span>
                                <span className="text-sm font-black text-chimiteal italic">
                                    € {formData.amount_eur || '0.00'}
                                </span>
                            </div>
                        </div>

                        {/* Section: Archivos/Fotos - EXACTLY MATCHING chimi-otros-servicios */}
                        <div className="space-y-4 border p-4 rounded-md bg-slate-50 mt-6">
                            <Label className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2 uppercase tracking-tight">
                                <Package className="h-4 w-4 text-chimicyan" /> Archivos del Servicio
                            </Label>

                            {/* Existing Documents */}
                            {existingAttachments.length > 0 && (
                                <div className="mb-4 space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {existingAttachments.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-white border rounded shadow-sm text-xs">
                                            <div className="flex items-center gap-2 truncate">
                                                <FileText className="h-5 w-5 text-slate-400" />
                                                <span className="truncate font-bold text-slate-700">
                                                    {file.title || file.name || `Archivo ${idx + 1}`}
                                                </span>
                                            </div>
                                                <div className="flex gap-1">
                                                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={async () => {
                                                        const url = await getExpenseDocumentUrl(file.path)
                                                        window.open(url, '_blank')
                                                    }}>
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => {
                                                        if(confirm('¿Borrar archivo?')) {
                                                            setExistingAttachments(prev => prev.filter((_, i) => i !== idx))
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center gap-4 mb-2 p-3 bg-white border border-dashed rounded-md border-slate-300">
                                <div className="flex flex-col gap-1">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Adjuntar archivos</Label>
                                </div>
                                <Input type="number" min="0" max="5" className="w-20 h-10 text-center font-bold text-chimicyan text-lg" value={numDocs} onChange={handleNumDocsChange} />
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {documentInputs.map((input, index) => (
                                    <div key={index} className="space-y-3 p-4 bg-white rounded border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                        <Input 
                                            value={input.title}
                                            onChange={e => handleDocInputChange(index, 'title', e.target.value)}
                                            placeholder="Título del documento..."
                                            className="h-9 text-xs"
                                        />
                                        <Input 
                                            type="file" 
                                            onChange={e => handleDocInputChange(index, 'file', e.target.files?.[0] || null)}
                                            className="h-9 text-[10px] bg-slate-50 cursor-pointer"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="border-t pt-4">
                            <Button type="submit" disabled={isSubmitting} className="bg-linear-to-r from-chimipink to-chimicyan text-slate-700 w-full sm:w-auto px-8 font-bold h-12 shadow-md">
                                {isSubmitting ? 'Guardando...' : (selectedId ? 'Actualizar Gasto' : 'Guardar Gasto')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
