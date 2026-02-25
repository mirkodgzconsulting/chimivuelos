'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { 
    Languages,
    Plus,
    Search,
    FileText,
    Trash2,
    Download,
    Briefcase,
    Pencil,
    ChevronLeft,
    ChevronRight,
    MapPin,
    ArrowRight,
    Wallet,
    Check,
    X,
    NotebookPen,
    Building2,
    Package,
    Lock,
    Unlock,
    User,
    Image as ImageIcon
} from 'lucide-react'
import { 
    getTranslations, 
    createTranslation, 
    updateTranslation, 
    deleteTranslation, 
    deleteTranslationDocument, 
    getTranslationDocumentUrl 
} from '@/app/actions/manage-translations'
import { getClientsForDropdown } from '@/app/actions/manage-transfers'
import { EditRequestModal } from '@/components/permissions/EditRequestModal'
import { getActivePermissionDetails, getActivePermissions } from '@/app/actions/manage-permissions'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// Interfaces
interface TranslationDocument {
    title: string
    path: string
    name: string
    size: number
    type: string
    storage: 'r2' | 'images'
}

interface PaymentDetail {
    sede_it: string
    sede_pe: string
    metodo_it: string
    metodo_pe: string
    cantidad: string       
    tipo_cambio: number    
    total: string          
    moneda?: string        
    monto_original?: string
    created_at?: string
    updated_at?: string
    proof_path?: string
}

interface Translation {
    id: string
    created_at: string
    tracking_code: string
    client_id: string
    document_types: string[]
    document_types_other?: string
    quantity: number
    documents?: TranslationDocument[]
    work_types: string[]
    work_types_other?: string
    source_language?: string
    target_language?: string
    origin_address: string
    destination_address: string
    destination_address_client?: string
    net_amount: number
    total_amount: number
    on_account: number
    balance: number
    notes?: string
    recipient_name?: string
    recipient_phone?: string
    status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled'
    payment_details?: PaymentDetail[]
    profiles?: {
        first_name: string | null
        last_name: string | null
        email: string | null
        phone: string | null
    }
    agent?: {
        first_name: string | null
        last_name: string | null
    }
}

interface ClientProfile {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
}

const LANGUAGE_OPTIONS = ["Español", "Italiano", "Inglés", "Francés", "Portugués"]
const DOCUMENT_TYPE_OPTIONS = ["Certificados de estudios", "Acta de matrimonio", "Certificados médicos", "Brevete", "Partida de nacimiento", "Otros documentos"]
const WORK_TYPE_OPTIONS = ["Traducir", "Legalizar", "Apostillar", "Entrega física", "Entrega digital", "Envío digital", "Consigna", "Otros"]
const SEDE_IT_OPTIONS = ["turro milano", "corsico milano", "roma", "lima"]

const PAYMENT_METHOD_IT_OPTIONS = [
    "EFEC TURRO — MILANO",
    "EFEC CORSICO — MILANO",
    "EFEC ROMA",
    "UNICREDIT CHIMI",
    "BANK WISE",
    "BONIFICO SUEMA",
    "WESTERN / RIA A PERSONAL",
    "OTRO GIRO"
]
const PAYMENT_METHOD_PE_OPTIONS = [
    "EFEC LIMA SOL",
    "EFEC LIMA EURO",
    "EFEC LIMA DOLAR",
    "BCP SOLES CHIMI",
    "BCP DOLAR",
    "BANCA EURO PERÚ"
]
const CURRENCY_OPTIONS = ["EUR", "PEN", "USD"]

const DocumentPreview = ({ 
    doc, 
    onDownload, 
    onDelete 
}: { 
    doc: TranslationDocument, 
    onDownload: () => void, 
    onDelete: () => void 
}) => {
    const [url, setUrl] = useState<string | null>(null)

    useEffect(() => {
        if (doc.type.startsWith('image/')) {
            getTranslationDocumentUrl(doc.path, doc.storage).then(res => {
                if(res) setUrl(res)
            }).catch(() => {})
        }
    }, [doc])

    return (
        <div className="flex items-center justify-between p-3 bg-white border rounded shadow-sm text-xs">
            <div className="flex items-center gap-2 truncate">
                {doc.type.startsWith('image/') ? (
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center overflow-hidden relative">
                        {url ? <Image src={url} alt="preview" fill className="object-cover" /> : <ImageIcon className="h-5 w-5 text-slate-400" />}
                    </div>
                ) : <FileText className="h-5 w-5 text-slate-400" />}
                <span className="truncate font-bold text-slate-700">{doc.title || doc.name}</span>
            </div>
            <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={onDownload}>
                    <Download className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

export default function TranslationsPage() {
    // Main Data State
    const [translations, setTranslations] = useState<Translation[]>([])
    const [clients, setClients] = useState<ClientProfile[]>([])
    
    // UI State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [searchClientTerm, setSearchClientTerm] = useState('')
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
    const [showSourceLanguageList, setShowSourceLanguageList] = useState(false)
    const [showTargetLanguageList, setShowTargetLanguageList] = useState(false)
    
    // Pagination & Filters
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    // Dates
    const [dateFrom] = useState(() => {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        return `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    })
    const [dateTo] = useState(() => {
        const now = new Date()
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
    })

    // Edit State
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [docsViewerTranslation, setDocsViewerTranslation] = useState<Translation | null>(null)

    // Role & Permissions State
    const [userRole, setUserRole] = useState<string | null>(null)
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
    const [pendingResourceId, setPendingResourceId] = useState<string | null>(null)
    const [pendingResourceName, setPendingResourceName] = useState<string>('')
    const [unlockedResources, setUnlockedResources] = useState<Set<string>>(new Set())

    // Sync Permissions
    useEffect(() => {
        const fetchPermissions = async () => {
            const permissions = await getActivePermissions()
            setUnlockedResources(new Set(permissions))
        }
        fetchPermissions()
    }, [isDialogOpen, isPermissionModalOpen])

    // Form Data
    const [formData, setFormData] = useState({
        client_id: "",
        client_email: "",
        client_phone: "",
        document_types: [] as string[],
        document_types_other: "",
        quantity: "1",
        work_types: [] as string[],
        work_types_other: "",
        source_language: "",
        target_language: "",
        origin_address: "",
        destination_address: "",
        destination_address_client: "",
        net_amount: "",
        total_amount: "0.00",
        on_account: "0.00",
        balance: "0.00",
        tracking_code: "",
        notes: "",
        recipient_name: "",
        recipient_phone: "",
        status: "pending",
        sede_it: "",
        sede_pe: "",
        payment_method_it: "",
        payment_method_pe: "",
        payment_quantity: "",
        payment_exchange_rate: "1.0",
        payment_currency: "EUR",
        payment_total: ""
    })

    const [tempPayments, setTempPayments] = useState<PaymentDetail[]>([])
    const [tempPaymentProofs, setTempPaymentProofs] = useState<(File | null)[]>([])
    const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
    const [showPaymentFields, setShowPaymentFields] = useState(false)
    // File Upload State
    const [numDocs, setNumDocs] = useState(0)
    const [documentInputs, setDocumentInputs] = useState<{title: string, file: File | null}[]>([])
    const [existingDocuments, setExistingDocuments] = useState<TranslationDocument[]>([])

    // Derived Financial Summary
    const financials = useMemo(() => {
        let totalOnAccount = 0
        tempPayments.forEach(p => totalOnAccount += parseFloat(p.cantidad) || 0)
        
        // Add pending payment if visible and has value (Live update as user types)
        if (showPaymentFields && formData.payment_quantity && parseFloat(formData.payment_quantity) > 0) {
            totalOnAccount += parseFloat(formData.payment_total) || 0
        }

        const totalCost = parseFloat(formData.total_amount) || 0
        return {
            on_account: totalOnAccount.toFixed(2),
            balance: (totalCost - totalOnAccount).toFixed(2),
            total_sum: totalOnAccount.toFixed(2)
        }
    }, [tempPayments, showPaymentFields, formData.payment_quantity, formData.payment_total, formData.total_amount])



    // Address Lists
    const [showOriginList, setShowOriginList] = useState(false)
    const [showDestinationList, setShowDestinationList] = useState(false)
    const [showSedeITList, setShowSedeITList] = useState(false)
    const [showMetodoITList, setShowMetodoITList] = useState(false)
    const [showMetodoPEList, setShowMetodoPEList] = useState(false)

    useEffect(() => {
        const fetchUserData = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const role = user.user_metadata?.role || 'client'
                setUserRole(role === 'usuario' ? 'agent' : role)
                if (role === 'agent' || role === 'usuario') {
                    await getActivePermissions()
                }
            }
        }
        fetchUserData()
    }, [])

    const loadData = useCallback(async () => {
        setIsLoading(true)
        const [transData, clientsData] = await Promise.all([
            getTranslations(),
            getClientsForDropdown()
        ])
        setTranslations(transData as unknown as Translation[])
        setClients(clientsData as unknown as ClientProfile[])
        setIsLoading(false)
    }, [])

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Handlers
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        if (['net_amount', 'total_amount', 'on_account', 'payment_quantity', 'payment_exchange_rate', 'quantity'].includes(name)) {
             if (!/^\d*\.?\d*$/.test(value)) return
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value }
            
            if (['payment_quantity', 'payment_exchange_rate', 'payment_currency'].includes(name)) {
                const qty = parseFloat(newData.payment_quantity) || 0
                const rate = parseFloat(newData.payment_exchange_rate) || 1.0
                const curr = newData.payment_currency

                let result = 0
                if (curr === 'EUR') {
                    result = qty
                    newData.payment_exchange_rate = '1.0'
                } else if (curr === 'PEN') {
                    result = rate !== 0 ? qty / rate : 0
                } else {
                    result = qty * rate
                }
                newData.payment_total = result.toFixed(2)
            }
            return newData
        })
    }

    const handleCheckboxChange = (group: 'document_types' | 'work_types', value: string, checked: boolean) => {
        setFormData(prev => {
            const list = [...prev[group]]
            if (checked) {
                if (!list.includes(value)) list.push(value)
            } else {
                const idx = list.indexOf(value)
                if (idx > -1) list.splice(idx, 1)
            }
            return { ...prev, [group]: list }
        })
    }

    const handleNumDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value) || 0
        if (val < 0 || val > 10) return
        setNumDocs(val)
        setDocumentInputs(prev => {
            if (val > prev.length) {
                const newItems = Array.from({ length: val - prev.length }, () => ({ title: "", file: null }))
                return [...prev, ...newItems]
            } else {
                return prev.slice(0, val)
            }
        })
    }

    const handleDocInputChange = (index: number, field: 'title' | 'file', value: string | File | null) => {
        const newInputs = [...documentInputs]
        if (field === 'title') {
            newInputs[index].title = value as string
        } else {
            newInputs[index].file = value as File | null
        }
        setDocumentInputs(newInputs)
    }

    const resetForm = () => {
        setFormData({
            client_id: "",
            client_email: "",
            client_phone: "",
            document_types: [],
            document_types_other: "",
            quantity: "1",
            work_types: [],
            work_types_other: "",
            source_language: "",
            target_language: "",
            origin_address: "",
            destination_address: "",
            destination_address_client: "",
            net_amount: "",
            total_amount: "0.00",
            on_account: "0.00",
            balance: "0.00",
            tracking_code: "",
            notes: "",
            recipient_name: "",
            recipient_phone: "",
            status: "pending",
            sede_it: "",
            sede_pe: "",
            payment_method_it: "",
            payment_method_pe: "",
            payment_quantity: "",
            payment_exchange_rate: "1.0",
            payment_currency: "EUR",
            payment_total: ""
        })
        setSelectedId(null)
        setNumDocs(0)
        setDocumentInputs([])
        setExistingDocuments([])
        setSearchClientTerm('')
        setTempPayments([])
        setTempPaymentProofs([])
        setPaymentProofFile(null)
        setShowPaymentFields(false)
    }

    const handleEdit = (trans: Translation) => {
        setSelectedId(trans.id)
        setFormData({
            ...formData,
            client_id: trans.client_id,
            client_email: trans.profiles?.email || "",
            client_phone: trans.profiles?.phone || "",
            document_types: trans.document_types || [],
            document_types_other: trans.document_types_other || "",
            quantity: trans.quantity.toString(),
            work_types: trans.work_types || [],
            work_types_other: trans.work_types_other || "",
            source_language: trans.source_language || "",
            target_language: trans.target_language || "",
            origin_address: trans.origin_address || "",
            destination_address: trans.destination_address || "",
            destination_address_client: trans.destination_address_client || "",
            net_amount: trans.net_amount.toString(),
            total_amount: trans.total_amount.toString(),
            on_account: trans.on_account.toString(),
            balance: trans.balance.toString(),
            tracking_code: trans.tracking_code || "",
            notes: trans.notes || "",
            recipient_name: trans.recipient_name || "",
            recipient_phone: trans.recipient_phone || "",
            status: trans.status,
            sede_it: "",
            sede_pe: "",
            payment_method_it: "",
            payment_method_pe: "",
            payment_quantity: "",
            payment_exchange_rate: "1.0",
            payment_currency: "EUR",
            payment_total: ""
        })
        setSearchClientTerm(`${trans.profiles?.first_name} ${trans.profiles?.last_name}`)
        setExistingDocuments(trans.documents || [])
        setTempPayments(trans.payment_details || [])
        setTempPaymentProofs(new Array(trans.payment_details?.length || 0).fill(null))
        setIsDialogOpen(true)
    }

    const handleActionClick = async (trans: Translation, action: 'edit' | 'delete') => {
        if (userRole === 'admin') {
            if (action === 'edit') handleEdit(trans)
            else if (confirm('¿Borrar traducción?')) {
                await deleteTranslation(trans.id)
                loadData()
            }
            return
        }
        // Agents need permission for edit
        if (action === 'edit' && userRole === 'agent') {
            const permission = await getActivePermissionDetails('translations', trans.id)
            if (permission.hasPermission) {
                handleEdit(trans)
            } else {
                setPendingResourceId(trans.id)
                setPendingResourceName(trans.tracking_code || trans.id)
                setIsPermissionModalOpen(true)
            }
        }
    }

    const handleAddPayment = () => {
        if (!formData.payment_quantity || parseFloat(formData.payment_quantity) === 0) return
        const pCurrency = formData.payment_currency || 'EUR'
        const symbol = pCurrency === 'EUR' ? '€' : pCurrency === 'PEN' ? 'S/' : '$'
        const eurAmount = formData.payment_total || formData.payment_quantity
        
        const newPayment: PaymentDetail = {
            sede_it: formData.sede_it,
            sede_pe: formData.sede_pe,
            metodo_it: formData.payment_method_it,
            metodo_pe: formData.payment_method_pe,
            cantidad: eurAmount,
            tipo_cambio: parseFloat(formData.payment_exchange_rate) || 1.0,
            total: `${symbol} ${parseFloat(formData.payment_quantity).toFixed(2)}`,
            moneda: pCurrency,
            monto_original: formData.payment_quantity,
            created_at: new Date().toISOString()
        }

        setTempPayments([...tempPayments, newPayment])
        setTempPaymentProofs([...tempPaymentProofs, paymentProofFile])
        setFormData(prev => ({
            ...prev,
            payment_quantity: "",
            payment_total: "",
            payment_exchange_rate: "1.0",
            payment_currency: "EUR",
            sede_it: "",
            sede_pe: "",
            payment_method_it: "",
            payment_method_pe: ""
        }))
        setPaymentProofFile(null)
        setShowPaymentFields(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const finalPayments = [...tempPayments]
        const finalProofs = [...tempPaymentProofs]
        
        if (formData.payment_quantity && parseFloat(formData.payment_quantity) > 0) {
            const pCurrency = formData.payment_currency || 'EUR'
            const symbol = pCurrency === 'EUR' ? '€' : pCurrency === 'PEN' ? 'S/' : '$'
            const eurAmount = formData.payment_total || formData.payment_quantity
            finalPayments.push({
                sede_it: formData.sede_it,
                sede_pe: formData.sede_pe,
                metodo_it: formData.payment_method_it,
                metodo_pe: formData.payment_method_pe,
                cantidad: eurAmount,
                tipo_cambio: parseFloat(formData.payment_exchange_rate) || 1.0,
                total: `${symbol} ${parseFloat(formData.payment_quantity).toFixed(2)}`,
                moneda: pCurrency,
                monto_original: formData.payment_quantity,
                created_at: new Date().toISOString()
            })
            finalProofs.push(paymentProofFile)
        }

        const payload = new FormData()
        Object.entries(formData).forEach(([key, value]) => {
            if (key === 'document_types' || key === 'work_types') {
                payload.append(key, JSON.stringify(value))
            } else if (key === 'on_account') {
                payload.append(key, financials.on_account)
            } else if (key === 'balance') {
                payload.append(key, financials.balance)
            } else if (key === 'total_amount') {
                payload.append(key, formData.total_amount)
            } else {
                payload.append(key, value as string)
            }
        })
        if (selectedId) payload.append('id', selectedId)

        documentInputs.forEach((doc, index) => {
            if (doc.file) {
                payload.append(`document_title_${index}`, doc.title)
                payload.append(`document_file_${index}`, doc.file)
            }
        })

        payload.append('payment_details', JSON.stringify(finalPayments))
        finalProofs.forEach((file, index) => {
            if (file) payload.append(`payment_proof_${index}`, file)
        })

        const result = selectedId ? await updateTranslation(payload) : await createTranslation(payload)

        if (result.error) alert(result.error)
        else {
            setIsDialogOpen(false)
            resetForm()
            loadData()
        }
        setIsLoading(false)
    }

    // Filters & Search
    const filteredTranslations = translations.filter(t => {
        const matchesSearch = !searchTerm || 
            t.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `${t.profiles?.first_name} ${t.profiles?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
        
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter
        
        const tDate = new Date(t.created_at)
        const dFrom = dateFrom ? new Date(dateFrom) : null
        const dTo = dateTo ? new Date(dateTo) : null
        
        if (dFrom) dFrom.setHours(0,0,0,0)
        if (dTo) dTo.setHours(23,59,59,999)
        
        const matchesDate = (!dFrom || tDate >= dFrom) && (!dTo || tDate <= dTo)
        
        return matchesSearch && matchesStatus && matchesDate
    })

    const paginatedItems = filteredTranslations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filteredTranslations.length / itemsPerPage)

    const handleDownload = async (doc: TranslationDocument) => {
        const url = await getTranslationDocumentUrl(doc.path, doc.storage)
        window.open(url, '_blank')
    }

    const selectClient = (client: ClientProfile) => {
        setFormData(prev => ({
            ...prev,
            client_id: client.id,
            client_email: client.email || "",
            client_phone: client.phone || ""
        }))
        setSearchClientTerm(`${client.first_name} ${client.last_name}`)
        setIsClientDropdownOpen(false)
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Header section with centered button */}
            <div className="flex flex-col items-center gap-4">

                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button className="bg-linear-to-r from-chimipink to-chimicyan font-bold text-slate-700 shadow-lg hover:scale-105 transition-transform px-8">
                            <Plus className="mr-2 h-5 w-5" /> Registrar Traducción
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden">
                            <DialogHeader className="border-b border-slate-100 pb-4 mb-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-2 bg-chimipink/10 rounded-lg">
                                        <Languages size={20} className="text-chimipink" />
                                    </div>
                                    <DialogTitle className="text-xl font-black text-slate-800 tracking-tight">
                                        {selectedId ? 'Actualizar Registro' : 'Nueva Traducción / Trámite'}
                                    </DialogTitle>
                                </div>
                                <DialogDescription className="text-slate-400 font-medium italic">Complete los campos de registro .</DialogDescription>
                            </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-6 py-4">
                            {/* Section: Client */}
                            <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                <Label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                    <Languages className="h-4 w-4 text-chimipink" /> Datos del Cliente
                                </Label>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2 relative">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Cliente <span className="text-red-500">*</span></Label>
                                        <div className="relative">
                                            <Input 
                                                placeholder="Buscar cliente..." 
                                                value={searchClientTerm}
                                                onChange={(e) => { 
                                                    setSearchClientTerm(e.target.value); 
                                                    setIsClientDropdownOpen(true); 
                                                }}
                                                onClick={() => setIsClientDropdownOpen(true)}
                                                autoComplete="off"
                                                className="bg-white pr-8"
                                            />
                                            {searchClientTerm ? (
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchClientTerm('')
                                                        setFormData(prev => ({ ...prev, client_id: '', client_email: '', client_phone: '' }))
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                >
                                                    <X size={14} strokeWidth={3} />
                                                </button>
                                            ) : (
                                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            )}
                                        </div>
                                        {isClientDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setIsClientDropdownOpen(false)} />
                                                <div className="absolute z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-48 overflow-y-auto">
                                                    {clients
                                                        .filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchClientTerm.toLowerCase()))
                                                        .map(client => (
                                                            <div key={client.id} className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0" onClick={() => selectClient(client)}>
                                                                <p className="font-bold text-slate-700 text-sm">{client.first_name} {client.last_name}</p>
                                                                <p className="text-xs text-slate-500">{client.email}</p>
                                                            </div>
                                                        ))
                                                    }
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Correo</Label>
                                        <Input value={formData.client_email} readOnly className="bg-slate-100 h-10" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Teléfono</Label>
                                        <Input value={formData.client_phone} readOnly className="bg-slate-100 h-10" />
                                    </div>
                                </div>
                            </div>

                            {/* Two Column Layout like Encomiendas */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* Document Details (Left) */}
                                <div className="space-y-4 border p-4 rounded-md bg-slate-50 flex flex-col h-full">
                                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2">
                                        <FileText className="h-4 w-4 text-chimicyan" />
                                        Detalles de la Traducción
                                    </h3>

                                    <div className="space-y-4 flex-1">
                                        <div className="space-y-3 p-3 bg-white rounded border border-slate-200">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Tipo de Documento</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {DOCUMENT_TYPE_OPTIONS.map(opt => (
                                                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer group">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={formData.document_types.includes(opt)}
                                                            onChange={(e) => handleCheckboxChange('document_types', opt, e.target.checked)}
                                                            className="rounded border-slate-300 text-chimipink focus:ring-chimipink h-4 w-4"
                                                        />
                                                        <span className="group-hover:text-chimipink transition-colors font-medium text-slate-600">{opt}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            {formData.document_types.includes('Otros documentos') && (
                                                <Input 
                                                    placeholder="Especifique otro..." 
                                                    value={formData.document_types_other}
                                                    name="document_types_other"
                                                    onChange={handleInputChange}
                                                    className="mt-2 h-9 border-slate-200 bg-slate-50 focus:ring-chimipink"
                                                />
                                            )}
                                        </div>

                                        <div className="grid gap-2">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Cantidad de documentos</Label>
                                            <Input 
                                                type="number" 
                                                name="quantity" 
                                                value={formData.quantity} 
                                                onChange={handleInputChange}
                                                className="h-10 bg-white"
                                            />
                                        </div>

                                        <div className="space-y-3 p-3 bg-white rounded border border-slate-200">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Trabajo a Realizar</Label>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                {WORK_TYPE_OPTIONS.map(opt => (
                                                    <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={formData.work_types.includes(opt)}
                                                            onChange={(e) => handleCheckboxChange('work_types', opt, e.target.checked)}
                                                            className="rounded border-slate-300 text-chimicyan focus:ring-chimicyan h-3.5 w-3.5"
                                                        />
                                                        <span className="group-hover:text-chimicyan transition-colors font-medium text-slate-600">{opt}</span>
                                                    </label>
                                                ))}
                                            </div>
                                            {formData.work_types.includes('Otros') && (
                                                <Input 
                                                    placeholder="Detalle del trabajo..." 
                                                    value={formData.work_types_other}
                                                    name="work_types_other"
                                                    onChange={handleInputChange}
                                                    className="mt-2 text-xs h-8 border-slate-200 bg-slate-50 focus:ring-chimicyan"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Costos section strictly as requested */}
                                    <div className="border-t border-slate-200 pt-3 mt-2">
                                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3">
                                            <Wallet className="h-4 w-4 text-emerald-500" /> Costos
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="grid gap-2">
                                                <Label className="text-xs font-bold text-slate-500">Total a Pagar (€)</Label>
                                                <Input 
                                                    name="total_amount" 
                                                    type="number" 
                                                    step="0.01" 
                                                    value={formData.total_amount} 
                                                    onChange={handleInputChange} 
                                                    required
                                                    className="bg-white border-slate-200 h-10 text-sm focus:ring-slate-500" 
                                                />
                                            </div>
                                             <div className="grid gap-2">
                                                <Label className="text-xs font-bold text-slate-500">A Cuenta (€)</Label>
                                                <Input 
                                                    name="on_account" 
                                                    value={financials.on_account} 
                                                    readOnly 
                                                    className="bg-slate-100 font-bold text-slate-700 h-10 border-slate-200"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-2 mt-2">
                                            <Label className="text-xs font-bold text-slate-500">Saldo Pendiente (€)</Label>
                                            <Input 
                                                name="balance" 
                                                value={financials.balance} 
                                                readOnly 
                                                className={`h-10 border-slate-200 bg-slate-100 font-black ${Number(financials.balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column containing Recipient and Logistics */}
                                <div className="flex flex-col gap-4 h-full">
                                    {/* Datos del Destinatario */}
                                    <div className="space-y-3 border p-4 rounded-md bg-white">
                                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2">
                                            <User className="h-4 w-4 text-violet-500" />
                                            Datos del Destinatario
                                        </h3>
                                        
                                        <div className="grid gap-2 mb-2">
                                            <Label className="text-[10px] text-slate-400 font-semibold uppercase">Nombre Completo</Label>
                                            <Input name="recipient_name" value={formData.recipient_name} onChange={handleInputChange} required className="h-10 text-sm bg-slate-50 border-slate-200" autoComplete="off" />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label className="text-[10px] text-slate-400 font-semibold uppercase">Teléfono</Label>
                                            <Input name="recipient_phone" value={formData.recipient_phone} onChange={handleInputChange} className="h-10 text-sm bg-slate-50 border-slate-200" autoComplete="off" />
                                        </div>
                                    </div>

                                    {/* Logistics (Right) */}
                                    <div className="space-y-4 border p-4 rounded-md bg-white flex flex-col flex-1">
                                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2">
                                            <MapPin className="h-4 w-4 text-chimiteal" />
                                            Logística de Entrega
                                        </h3>

                                    <div className="space-y-4 flex-1">
                                        <div className="grid gap-2 relative">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Dirección de Partida</Label>
                                            <div className="relative">
                                                <Input 
                                                    name="origin_address"
                                                    value={formData.origin_address}
                                                    onChange={(e) => { handleInputChange(e); setShowOriginList(true); }}
                                                    onFocus={() => setShowOriginList(true)}
                                                    onBlur={() => setTimeout(() => setShowOriginList(false), 200)}
                                                    placeholder="Buscar oficina..."
                                                    autoComplete="off"
                                                    className="bg-slate-50 border-slate-200 h-10 pr-8"
                                                />
                                                {formData.origin_address ? (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, origin_address: '' }))}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                    >
                                                        <X size={14} strokeWidth={3} />
                                                    </button>
                                                ) : (
                                                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                                )}
                                            </div>
                                            {showOriginList && (
                                                <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto font-medium">
                                                    {SEDE_IT_OPTIONS.filter(o => o.toLowerCase().includes(formData.origin_address.toLowerCase())).map(o => (
                                                        <div key={o} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => setFormData(p => ({ ...p, origin_address: o }))}>{o}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid gap-2 relative">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Llegada / Recojo</Label>
                                            <div className="relative">
                                                <Input 
                                                    name="destination_address"
                                                    value={formData.destination_address}
                                                    onChange={(e) => { handleInputChange(e); setShowDestinationList(true); }}
                                                    onFocus={() => setShowDestinationList(true)}
                                                    onBlur={() => setTimeout(() => setShowDestinationList(false), 200)}
                                                    placeholder="Sede o Dirección..."
                                                    autoComplete="off"
                                                    className="bg-slate-50 border-slate-200 h-10 pr-8"
                                                />
                                                {formData.destination_address ? (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, destination_address: '' }))}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                    >
                                                        <X size={14} strokeWidth={3} />
                                                    </button>
                                                ) : (
                                                    <ArrowRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                                )}
                                            </div>
                                            {showDestinationList && (
                                                <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto font-medium">
                                                    {[...SEDE_IT_OPTIONS, "Dirección de cliente"].filter(o => o.toLowerCase().includes(formData.destination_address.toLowerCase())).map(o => (
                                                        <div key={o} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm font-bold border-b last:border-0" onClick={() => setFormData(p => ({ ...p, destination_address: o }))}>
                                                            {o === "Dirección de cliente" ? "✓ Dirección de cliente" : o}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {formData.destination_address === 'Dirección de cliente' && (
                                            <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                                                <Label className="text-xs font-bold text-chimipink uppercase tracking-tight italic">Ingrese la dirección exacta del cliente</Label>
                                                <textarea 
                                                    name="destination_address_client"
                                                    value={formData.destination_address_client}
                                                    onChange={handleInputChange}
                                                    className="min-h-[100px] w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:ring-chimipink focus:border-chimipink outline-none shadow-sm"
                                                    placeholder="Calle, número, piso, referencia..."
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-3 pt-4 border-t border-slate-100">
                                            <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Languages className="h-4 w-4 text-chimipink" /> Idioma</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-[10px] text-slate-400 font-semibold uppercase">Idioma Origen</Label>
                                                    <div className="relative">
                                                        <Input 
                                                            name="source_language"
                                                            value={formData.source_language}
                                                            onChange={(e) => { handleInputChange(e); setShowSourceLanguageList(true); }}
                                                            onFocus={() => setShowSourceLanguageList(true)}
                                                            onBlur={() => setTimeout(() => setShowSourceLanguageList(false), 200)}
                                                            className="h-10 text-sm bg-slate-50 border-slate-200 pr-8"
                                                            placeholder="Ej. Español"
                                                            autoComplete="off"
                                                        />
                                                        {formData.source_language ? (
                                                            <button 
                                                                type="button"
                                                                onClick={() => setFormData(prev => ({ ...prev, source_language: '' }))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
                                                        ) : (
                                                            <ArrowRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                                        )}
                                                    </div>
                                                    {showSourceLanguageList && (
                                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto font-medium">
                                                            {LANGUAGE_OPTIONS.filter(o => o.toLowerCase().includes(formData.source_language.toLowerCase())).map(o => (
                                                                <div key={o} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => setFormData(p => ({ ...p, source_language: o }))}>{o}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-[10px] text-slate-400 font-semibold uppercase">Idioma a Traducir</Label>
                                                    <div className="relative">
                                                        <Input 
                                                            name="target_language"
                                                            value={formData.target_language}
                                                            onChange={(e) => { handleInputChange(e); setShowTargetLanguageList(true); }}
                                                            onFocus={() => setShowTargetLanguageList(true)}
                                                            onBlur={() => setTimeout(() => setShowTargetLanguageList(false), 200)}
                                                            className="h-10 text-sm bg-slate-50 border-slate-200 pr-8"
                                                            placeholder="Ej. Italiano"
                                                            autoComplete="off"
                                                        />
                                                        {formData.target_language ? (
                                                            <button 
                                                                type="button"
                                                                onClick={() => setFormData(prev => ({ ...prev, target_language: '' }))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
                                                        ) : (
                                                            <ArrowRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                                        )}
                                                    </div>
                                                    {showTargetLanguageList && (
                                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto font-medium">
                                                            {LANGUAGE_OPTIONS.filter(o => o.toLowerCase().includes(formData.target_language.toLowerCase())).map(o => (
                                                                <div key={o} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => setFormData(p => ({ ...p, target_language: o }))}>{o}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-slate-100">
                                            <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><NotebookPen className="h-4 w-4 text-chimiteal" /> Notas Adicionales</Label>
                                            <textarea 
                                                name="notes"
                                                value={formData.notes}
                                                onChange={handleInputChange}
                                                className="min-h-[80px] w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:ring-chimiteal focus:border-chimiteal outline-none shadow-sm"
                                                placeholder="Cualquier aclaración requerida..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section: Archivos/Fotos */}
                            <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                <Label className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2">
                                    <Package className="h-4 w-4 text-chimicyan" /> Archivos de los documentos
                                </Label>
                                
                                {/* Existing Files */}
                                {existingDocuments.length > 0 && (
                                    <div className="mb-4 space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {existingDocuments.map((doc, idx) => (
                                            <DocumentPreview 
                                                key={idx} 
                                                doc={doc} 
                                                onDownload={() => handleDownload(doc)} 
                                                onDelete={async () => {
                                                    if(confirm('¿Borrar archivo?')) {
                                                        await deleteTranslationDocument(selectedId!, doc.path)
                                                        setExistingDocuments(prev => prev.filter(d => d.path !== doc.path))
                                                    }
                                                }} 
                                            />
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-4 mb-2 p-3 bg-white border border-dashed rounded-md border-slate-300">
                                    <div className="flex flex-col gap-1">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">¿Subir nuevos archivos?</Label>
                                        <p className="text-[10px] text-slate-400 italic">Indique cuántos documentos desea adjuntar</p>
                                    </div>
                                    <Input type="number" min="0" max="10" className="w-20 h-10 text-center font-bold text-chimicyan text-lg" value={numDocs} onChange={handleNumDocsChange} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {documentInputs.map((input, index) => (
                                        <div key={index} className="space-y-3 p-4 bg-white rounded border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                            <Input 
                                                value={input.title}
                                                onChange={e => handleDocInputChange(index, 'title', e.target.value)}
                                                placeholder="Ej: Foto del anverso..."
                                                className="h-9 text-xs border-slate-200"
                                            />
                                            <div className="flex items-center gap-3">
                                                <Input 
                                                    type="file" 
                                                    onChange={e => handleDocInputChange(index, 'file', e.target.files?.[0] || null)}
                                                    className="h-9 text-[10px] bg-slate-50 cursor-pointer border-slate-100 flex-1"
                                                />
                                                {input.file && input.file.type.startsWith('image/') && (
                                                    <div className="w-10 h-10 rounded-md border bg-slate-100 overflow-hidden shrink-0 shadow-sm relative">
                                                        <Image src={URL.createObjectURL(input.file)} alt="preview" fill className="object-cover" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* REGISTRO DE PAGO (Exactly like Encomiendas) */}
                            <div className="space-y-4 pt-4 border-t border-slate-200">
                                {tempPayments.length > 0 && (
                                    <div className="space-y-3 px-1 pb-2">
                                        <div className="flex items-center gap-2 opacity-60">
                                            <div className="h-px flex-1 bg-slate-200"></div>
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abonos añadidos</Label>
                                            <div className="h-px flex-1 bg-slate-200"></div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {tempPayments.map((payment, idx) => (
                                                <div key={idx} className="group relative bg-emerald-50/30 border border-emerald-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all border-l-4 border-l-emerald-400">
                                                    <div className="flex justify-between items-center transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="grid gap-0.5">
                                                                <span className="font-bold text-slate-700 flex items-center gap-2 text-xs">
                                                                    {payment.metodo_it || payment.metodo_pe || 'Otros'}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 flex items-center gap-1 font-medium italic">
                                                                    <Briefcase size={10} className="h-2.5 w-2.5" /> {payment.sede_it || payment.sede_pe || 'S/D'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <span className="font-bold text-emerald-600 text-sm leading-none block">€ {parseFloat(payment.cantidad || '0').toFixed(2)}</span>
                                                                <span className="text-[9px] text-slate-400 uppercase tracking-tighter">
                                                                    {payment.moneda && payment.moneda !== 'EUR' ? `${payment.total}` : `€ ${parseFloat(payment.cantidad || '0').toFixed(2)}`}
                                                                </span>
                                                            </div>
                                                            <button type="button" onClick={() => setTempPayments(prev => prev.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="border rounded-xl p-4 bg-slate-50/50 space-y-4 border-dashed border-slate-300 relative">
                                    <div className="flex justify-between items-center">
                                        <Label className="font-bold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wide">
                                            {showPaymentFields ? (
                                                <><NotebookPen size={14} className="text-chimipink" /> Nuevo Abono</>
                                            ) : (
                                                <><Wallet size={14} className="text-chimipink" /> Registrar Nuevo Pago</>
                                            )}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            {showPaymentFields ? (
                                                <div className="flex items-center gap-2">
                                                    <button type="button" onClick={() => setShowPaymentFields(false)} className="text-red-400 hover:text-red-600 transition-colors p-1" title="Cerrar"><X size={20} /></button>
                                                    <button type="button" onClick={handleAddPayment} className="text-emerald-400 hover:text-emerald-600 transition-colors p-1" title="Añadir Pago"><Check size={20} className="h-5 w-5" /></button>
                                                </div>
                                            ) : (
                                                 <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            payment_currency: "EUR",
                                                            payment_exchange_rate: "1.00",
                                                            payment_quantity: "",
                                                            payment_total: "",
                                                            sede_it: prev.sede_it || "turro milano"
                                                        }))
                                                        setShowPaymentFields(true)
                                                    }}
                                                    className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 h-7 text-[10px] uppercase font-bold"
                                                 >
                                                     + Agregar Pago
                                                 </Button>
                                            )}
                                        </div>
                                    </div>

                                    {showPaymentFields && (
                                        <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 border-t pt-4 border-slate-200">
                                            <div className="grid gap-2 relative">
                                                <Label className="text-xs flex items-center gap-1.5 font-bold text-slate-700">
                                                    <Building2 size={12} className="text-slate-400" /> Sedes
                                                </Label>
                                                <div className="relative">
                                                    <Input 
                                                        name="sede_it" 
                                                        value={formData.sede_it} 
                                                        onChange={(e) => { setFormData(prev => ({ ...prev, sede_it: e.target.value })); setShowSedeITList(true); }}
                                                        onFocus={() => setShowSedeITList(true)}
                                                        onBlur={() => setTimeout(() => setShowSedeITList(false), 200)}
                                                        placeholder="Buscar sede..."
                                                        autoComplete="off"
                                                        className="bg-white border-slate-200 h-10 text-sm focus:ring-slate-500 pr-8"
                                                    />
                                                    {formData.sede_it ? (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setFormData(p => ({ ...p, sede_it: '' }))}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5"
                                                        >
                                                            <X size={14} strokeWidth={3} />
                                                        </button>
                                                    ) : (
                                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    )}
                                                </div>
                                                {showSedeITList && (
                                                    <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                        {SEDE_IT_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.sede_it.toLowerCase())).map((opt, idx) => (
                                                            <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => { setFormData(p => ({ ...p, sede_it: opt })); setShowSedeITList(false); }}>{opt}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-blue-700">
                                                        <Image src="https://flagcdn.com/w20/it.png" width={16} height={12} alt="italia" className="rounded-sm inline-block shadow-sm" /> Método Pago IT
                                                    </Label>
                                                    <div className="relative">
                                                        <Input 
                                                            name="payment_method_it" 
                                                            value={formData.payment_method_it} 
                                                            onChange={(e) => { setFormData(prev => ({ ...prev, payment_method_it: e.target.value })); setShowMetodoITList(true); }}
                                                            onFocus={() => setShowMetodoITList(true)}
                                                            onBlur={() => setTimeout(() => setShowMetodoITList(false), 200)}
                                                            placeholder="Buscar método..."
                                                            className="bg-blue-50/50 border-blue-200 h-10 text-sm focus:ring-blue-500 pr-8"
                                                        />
                                                        {formData.payment_method_it ? (
                                                            <button type="button" onClick={() => setFormData(p => ({ ...p, payment_method_it: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5"><X size={14} strokeWidth={3} /></button>
                                                        ) : (
                                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                        )}
                                                    </div>
                                                    {showMetodoITList && (
                                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                            {PAYMENT_METHOD_IT_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.payment_method_it.toLowerCase())).map((opt, idx) => (
                                                                <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => { setFormData(p => ({ ...p, payment_method_it: opt })); setShowMetodoITList(false); }}>{opt}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-rose-700">
                                                        <Image src="https://flagcdn.com/w20/pe.png" width={16} height={12} alt="peru" className="rounded-sm inline-block shadow-sm" /> Método Pago PE
                                                    </Label>
                                                    <div className="relative">
                                                        <Input 
                                                            name="payment_method_pe" 
                                                            value={formData.payment_method_pe} 
                                                            onChange={(e) => { setFormData(prev => ({ ...prev, payment_method_pe: e.target.value })); setShowMetodoPEList(true); }}
                                                            onFocus={() => setShowMetodoPEList(true)}
                                                            onBlur={() => setTimeout(() => setShowMetodoPEList(false), 200)}
                                                            placeholder="Buscar método..."
                                                            className="bg-rose-50/50 border-rose-200 h-10 text-sm focus:ring-rose-500 pr-8"
                                                        />
                                                        {formData.payment_method_pe ? (
                                                            <button type="button" onClick={() => setFormData(p => ({ ...p, payment_method_pe: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5"><X size={14} strokeWidth={3} /></button>
                                                        ) : (
                                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                        )}
                                                    </div>
                                                    {showMetodoPEList && (
                                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                            {PAYMENT_METHOD_PE_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.payment_method_pe.toLowerCase())).map((opt, idx) => (
                                                                <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => { setFormData(p => ({ ...p, payment_method_pe: opt })); setShowMetodoPEList(false); }}>{opt}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="grid gap-1.5">
                                                    <Label className="text-xs font-bold text-slate-700">Moneda de Pago</Label>
                                                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                                                        {CURRENCY_OPTIONS.map(curr => (
                                                            <button
                                                                key={curr}
                                                                type="button"
                                                                className={`h-7 rounded-md text-[10px] font-black transition-all ${formData.payment_currency === curr ? 'bg-chimipink text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                                onClick={() => {
                                                                    handleInputChange({ 
                                                                        target: { name: 'payment_currency', value: curr } 
                                                                    } as React.ChangeEvent<HTMLInputElement>)
                                                                }}
                                                            >
                                                                {curr === 'EUR' ? '€ EUR' : curr === 'PEN' ? 'S/ PEN' : '$ USD'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-xs font-bold text-slate-700">Cantidad</Label>
                                                    <Input 
                                                        type="number" 
                                                        name="payment_quantity" 
                                                        value={formData.payment_quantity} 
                                                        onChange={handleInputChange} 
                                                        className="h-10 bg-yellow-50/50 border-yellow-200 text-lg font-bold text-slate-700" 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="grid gap-1.5">
                                                    <Label className="text-xs font-bold text-slate-700">Tipo de Cambio (Base EUR)</Label>
                                                    <Input 
                                                        name="payment_exchange_rate" 
                                                        type="number" 
                                                        step="0.0001" 
                                                        value={formData.payment_exchange_rate} 
                                                        onChange={handleInputChange} 
                                                        disabled={formData.payment_currency === 'EUR'} 
                                                        className="h-10 text-sm bg-white border-slate-200 font-medium" 
                                                        placeholder="1.0000"
                                                    />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-xs font-bold text-emerald-700">Equivalente a Abonar (EUR €)</Label>
                                                    <div className="h-10 px-3 flex items-center bg-emerald-50 rounded-md border border-emerald-100 font-black text-emerald-600 text-lg">
                                                        {formData.payment_total || '0.00'}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label className="text-xs font-bold text-slate-700">Foto Comprobante</Label>
                                                <Input type="file" accept="image/*" onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)} className="h-10 bg-white cursor-pointer file:bg-slate-100 file:text-slate-600 file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 file:text-xs" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer Info like Encomiendas */}
                                    <div className="flex flex-col items-center pt-2 border-t border-slate-100/50 italic">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Vista Previa de Saldo</span>
                                        <span className={`text-sm font-black ${parseFloat(financials.balance) > 0 ? 'text-chimipink' : 'text-chimiteal'}`}>
                                            € {financials.balance}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={isLoading} className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 w-full sm:w-auto px-8 font-bold shadow-md h-12">
                                    {isLoading ? 'Guardando...' : (selectedId ? 'Actualizar Traducción' : 'Guardar Traducción')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Main Table area */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between bg-white">
                    <div className="flex-1 flex gap-2">
                        <div className="relative flex-1">
                            <Input placeholder="Buscar traducción o cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-8 h-10 border-slate-200 focus:ring-chimicyan" />
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <select className="h-10 border-slate-200 rounded-md text-sm px-2 bg-white" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all">Todos los estados</option>
                            <option value="pending">Pendiente</option>
                            <option value="in_progress">En Proceso</option>
                            <option value="completed">Completado</option>
                            <option value="delivered">Entregado</option>
                            <option value="cancelled">Cancelado</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 text-[10px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-100">
                                <th className="p-4">CÓDIGO</th>
                                <th className="p-4">CLIENTE</th>
                                <th className="p-4">AGENTE</th>
                                <th className="p-4">TOTAL A PAGAR</th>
                                <th className="p-4">A CUENTA</th>
                                <th className="p-4">SALDO PENDIENTE</th>
                                <th className="p-4 text-center">ESTADO</th>
                                <th className="p-4 text-right sticky right-0 bg-slate-50/90 backdrop-blur-sm z-10 border-l border-slate-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)]">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedItems.map(t => (
                                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors text-sm">
                                    <td className="p-4 py-3 font-bold text-slate-400 mt-1">{t.tracking_code}</td>
                                    <td className="p-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700">{t.profiles?.first_name} {t.profiles?.last_name}</span>
                                            <span className="text-[10px] text-slate-400 font-medium italic">{t.profiles?.email}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 py-3">
                                        <div className="flex flex-col text-[10px] font-bold text-slate-500 uppercase">
                                            {t.agent ? `${t.agent.first_name} ${t.agent.last_name}` : '-'}
                                        </div>
                                    </td>
                                    <td className="p-4 py-3 font-bold text-slate-700">€ {t.total_amount.toFixed(2)}</td>
                                    <td className="p-4 py-3 font-bold text-slate-500">€ {t.on_account.toFixed(2)}</td>
                                    <td className={`p-4 py-3 font-black ${t.balance > 0 ? 'text-chimipink' : 'text-chimiteal'}`}>
                                        € {t.balance.toFixed(2)}
                                    </td>
                                    <td className="p-4 py-3 text-center">
                                         <span className={cn(
                                            "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                            t.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                            t.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                                            t.status === 'cancelled' ? "bg-red-100 text-red-700" :
                                            "bg-blue-100 text-blue-700"
                                        )}>
                                            {t.status === 'pending' ? 'Pendiente' : 
                                             t.status === 'in_progress' ? 'En Proceso' : 
                                             t.status === 'completed' ? 'Listo' : 
                                             t.status === 'delivered' ? 'Entregado' : 'Cancelado'}
                                        </span>
                                    </td>
                                    <td className="p-4 py-3 text-right sticky right-0 bg-pink-50/90 backdrop-blur-sm group-hover:bg-pink-100 z-10 border-l border-pink-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] transition-colors">
                                        <div className="flex items-center justify-end gap-2">
                                            {t.documents && t.documents.length > 0 && (
                                                <Button size="sm" variant="ghost" className="text-chimiteal hover:bg-teal-50" onClick={() => setDocsViewerTranslation(t)}>
                                                    <FileText className="h-5 w-5" />
                                                </Button>
                                            )}
                                            
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleActionClick(t, 'edit')}
                                                className={cn(
                                                    userRole === 'agent' && !unlockedResources.has(t.id) && "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                )}
                                                title={userRole === 'agent' && !unlockedResources.has(t.id) ? "Solicitar permiso para editar" : "Editar"}
                                            >
                                                {userRole === 'agent' && !unlockedResources.has(t.id) ? (
                                                    <Lock className="h-4 w-4" />
                                                ) : unlockedResources.has(t.id) ? (
                                                    <Unlock className="h-4 w-4 text-emerald-600" />
                                                ) : (
                                                    <Pencil className="h-4 w-4 text-slate-400" />
                                                )}
                                            </Button>

                                            {userRole === 'admin' && (
                                                <Button variant="ghost" size="sm" onClick={() => handleActionClick(t, 'delete')}>
                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="p-4 flex items-center justify-between bg-slate-50/50">
                        <span className="text-xs text-slate-400">Página {currentPage} de {totalPages}</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            <EditRequestModal 
                isOpen={isPermissionModalOpen}
                onClose={() => setIsPermissionModalOpen(false)}
                resourceId={pendingResourceId || ''}
                resourceType="translations"
                resourceName={pendingResourceName}
            />

            {/* Document Viewer Modal */}
            <Dialog open={!!docsViewerTranslation} onOpenChange={o => !o && setDocsViewerTranslation(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Descargar Archivos</DialogTitle></DialogHeader>
                    <div className="space-y-2 py-4">
                        {docsViewerTranslation?.documents?.map((d, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 border rounded-lg">
                                <span className="text-xs font-bold truncate max-w-[150px]">{d.title}</span>
                                <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold" onClick={() => handleDownload(d)}>Descargar</Button>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
