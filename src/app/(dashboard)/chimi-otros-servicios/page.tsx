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
    Plus,
    Search,
    Trash2,
    Download,
    LayoutGrid,
    Pencil,
    ChevronLeft,
    ChevronRight,
    Wallet,
    NotebookPen,
    Package,
    ClipboardList,
    FileText,
    X,
    Check,
    Copy,
    Building2,
    Briefcase,
    User,
    MapPin,
    ArrowRight
} from 'lucide-react'
import { 
    getOtherServices, 
    createOtherService, 
    updateOtherService, 
    deleteOtherService, 
    deleteOtherServiceDocument, 
    getOtherServiceDocumentUrl 
} from '@/app/actions/manage-other-services'
import { getClientsForDropdown } from '@/app/actions/manage-transfers'
import { EditRequestModal } from '@/components/permissions/EditRequestModal'
import { getActivePermissionDetails, getActivePermissions } from '@/app/actions/manage-permissions'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getPaymentMethodsIT, getPaymentMethodsPE, PaymentMethod } from '@/app/actions/manage-payment-methods'

// Interfaces
interface ServiceDocument {
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

interface OtherService {
    id: string
    created_at: string
    tracking_code: string
    client_id: string
    service_type: string
    service_type_other?: string
    note?: string
    recipient_name?: string
    recipient_phone?: string
    origin_address?: string
    origin_address_client?: string
    destination_address?: string
    destination_address_client?: string
    documents?: ServiceDocument[]
    total_amount: number
    on_account: number
    balance: number
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

const SERVICE_OPTIONS = [
    "Cartas de invitación",
    "Seguros de viaje",
    "Servicio UMNR (menores)",
    "Reserva de hotel",
    "Asesorías personalizadas",
    "Activación de pasaje de retorno",
    "Trámites varios",
    "Asesoría de viaje",
    "Penalidades",
    "Otros servicios"
]

const SEDE_IT_OPTIONS = ["turro milano", "corsico milano", "roma", "lima"]
const CURRENCY_OPTIONS = ["EUR", "PEN", "USD"]

const generateTrackingCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `OTRO-${result}`
}

export default function OtherServicesPage() {
    // Main Data State
    const [services, setServices] = useState<OtherService[]>([])
    const [clients, setClients] = useState<ClientProfile[]>([])
    const [paymentMethodsIT, setPaymentMethodsIT] = useState<PaymentMethod[]>([])
    const [paymentMethodsPE, setPaymentMethodsPE] = useState<PaymentMethod[]>([])
    const [copiedId, setCopiedId] = useState<string | null>(null)
    
    // UI State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [searchClientTerm, setSearchClientTerm] = useState('')
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
    const [showOriginList, setShowOriginList] = useState(false)
    const [showDestinationList, setShowDestinationList] = useState(false)
    
    // Pagination & Filters
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    // Edit State
    const [selectedId, setSelectedId] = useState<string | null>(null)

    // Role & Permissions State
    const [userRole, setUserRole] = useState<string | null>(null)
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
    const [pendingResourceId, setPendingResourceId] = useState<string | null>(null)
    const [pendingResourceName, setPendingResourceName] = useState<string>('')

    // Sync Permissions
    useEffect(() => {
        const fetchPermissions = async () => {
            await getActivePermissions()
        }
        fetchPermissions()
    }, [isDialogOpen, isPermissionModalOpen])

    // Form Data
    const [formData, setFormData] = useState({
        client_id: "",
        client_email: "",
        client_phone: "",
        service_type: "",
        service_type_other: "",
        note: "",
        recipient_name: "",
        recipient_phone: "",
        origin_address: "",
        origin_address_client: "",
        destination_address: "",
        destination_address_client: "",
        total_amount: "0.00",
        on_account: "0.00",
        balance: "0.00",
        tracking_code: "",
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
    const [existingDocuments, setExistingDocuments] = useState<ServiceDocument[]>([])

    const financials = useMemo(() => {
        let totalOnAccount = 0
        tempPayments.forEach(p => totalOnAccount += parseFloat(p.cantidad) || 0)
        
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

    useEffect(() => {
        setFormData(prev => ({ 
            ...prev, 
            on_account: financials.on_account,
            balance: financials.balance
        }))
    }, [financials.on_account, financials.balance])

    // Dropdown visibility
    const [showServiceList, setShowServiceList] = useState(false)
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
            }
        }
        fetchUserData()
    }, [])

    const loadData = useCallback(async () => {
        setIsLoading(true)
        const [servData, clientsData, methodsIT, methodsPE] = await Promise.all([
            getOtherServices(),
            getClientsForDropdown(),
            getPaymentMethodsIT(),
            getPaymentMethodsPE()
        ])
        setServices(servData as unknown as OtherService[])
        setClients(clientsData as unknown as ClientProfile[])
        setPaymentMethodsIT(methodsIT)
        setPaymentMethodsPE(methodsPE)
        setIsLoading(false)
    }, [])

    useEffect(() => {
        loadData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Handlers
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        if (['total_amount', 'on_account', 'payment_quantity', 'payment_exchange_rate'].includes(name)) {
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
            service_type: "",
            service_type_other: "",
            note: "",
            recipient_name: "",
            recipient_phone: "",
            origin_address: "",
            origin_address_client: "",
            destination_address: "",
            destination_address_client: "",
            total_amount: "0.00",
            on_account: "0.00",
            balance: "0.00",
            tracking_code: "",
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

    const handleEdit = (serv: OtherService) => {
        setSelectedId(serv.id)
        setFormData({
            ...formData,
            client_id: serv.client_id,
            client_email: serv.profiles?.email || "",
            client_phone: serv.profiles?.phone || "",
            service_type: serv.service_type || "",
            service_type_other: serv.service_type_other || "",
            note: serv.note || "",
            recipient_name: serv.recipient_name || "",
            recipient_phone: serv.recipient_phone || "",
            origin_address: serv.origin_address || "",
            origin_address_client: serv.origin_address_client || "",
            destination_address: serv.destination_address || "",
            destination_address_client: serv.destination_address_client || "",
            total_amount: serv.total_amount.toString(),
            on_account: serv.on_account.toString(),
            balance: serv.balance.toString(),
            tracking_code: serv.tracking_code || "",
            status: serv.status,
            sede_it: "",
            sede_pe: "",
            payment_method_it: "",
            payment_method_pe: "",
            payment_quantity: "",
            payment_exchange_rate: "1.0",
            payment_currency: "EUR",
            payment_total: ""
        })
        setSearchClientTerm(`${serv.profiles?.first_name} ${serv.profiles?.last_name}`)
        setExistingDocuments(serv.documents || [])
        setTempPayments(serv.payment_details || [])
        setTempPaymentProofs(new Array(serv.payment_details?.length || 0).fill(null))
        setIsDialogOpen(true)
    }

    const handleActionClick = async (serv: OtherService, action: 'edit' | 'delete') => {
        if (userRole === 'admin') {
            if (action === 'edit') handleEdit(serv)
            else if (confirm('¿Borrar servicio?')) {
                await deleteOtherService(serv.id)
                loadData()
            }
            return
        }
        if (action === 'edit' && userRole === 'agent') {
            const permission = await getActivePermissionDetails('other_services', serv.id)
            if (permission.hasPermission) {
                handleEdit(serv)
            } else {
                setPendingResourceId(serv.id)
                setPendingResourceName(serv.tracking_code || serv.id)
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
            if (key === 'on_account') {
                payload.append(key, financials.on_account)
            } else if (key === 'balance') {
                payload.append(key, financials.balance)
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

        const result = selectedId ? await updateOtherService(payload) : await createOtherService(payload)

        if (result.error) alert(result.error)
        else {
            setIsDialogOpen(false)
            resetForm()
            loadData()
        }
        setIsLoading(false)
    }

    const handleCopyCode = (id: string, code: string) => {
        const url = `https://chimivuelos.pe/otros?code=${code}`
        const message = `El registro de tu solicitud fue realizado, tu código de seguimiento es ${code}, puedes rastrear ingresando a ${url}`
        
        navigator.clipboard.writeText(message)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const filteredServices = services.filter(s => {
        const matchesSearch = !searchTerm || 
            s.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.service_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            `${s.profiles?.first_name} ${s.profiles?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
        
        const matchesStatus = statusFilter === 'all' || s.status === statusFilter
        
        return matchesSearch && matchesStatus
    })

    const paginatedItems = filteredServices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    const totalPages = Math.ceil(filteredServices.length / itemsPerPage)

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
            {/* Header section */}
            <div className="flex flex-col items-center gap-4">
                <Dialog open={isDialogOpen} onOpenChange={(open) => { 
                    setIsDialogOpen(open); 
                    if (!open) {
                        resetForm(); 
                    } else if (!selectedId) {
                        setFormData(prev => ({ ...prev, tracking_code: generateTrackingCode() }));
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-linear-to-r from-chimipink to-chimicyan font-bold text-slate-700 shadow-lg hover:scale-105 transition-transform px-8">
                            <Plus className="mr-2 h-5 w-5" /> Registrar Otro Servicio
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden">
                            <DialogHeader className="border-b border-slate-100 pb-4 mb-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-2 bg-chimipink/10 rounded-lg">
                                        <ClipboardList size={20} className="text-chimipink" />
                                    </div>
                                    <DialogTitle className="text-xl font-black text-slate-800 tracking-tight">
                                        {selectedId ? 'Actualizar Registro' : 'Nueva Solicitud Otros Servicios'}
                                    </DialogTitle>
                                </div>
                                <DialogDescription className="text-slate-400 font-medium italic text-xs">Complete los campos de registro .</DialogDescription>
                            </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-6 py-4">
                            {/* Section: Client */}
                            <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                <Label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                    <NotebookPen className="h-4 w-4 text-chimipink" /> Datos del Cliente
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

                            {/* Service Details & Costs (Two Columns) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Service Details (Left) */}
                                <div className="space-y-4 border p-4 rounded-md bg-slate-50 flex flex-col h-full">
                                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2">
                                        <LayoutGrid className="h-4 w-4 text-chimipink" />
                                        Detalles del Servicio
                                    </h3>

                                    <div className="space-y-4 flex-1">
                                        <div className="space-y-2 relative">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Tipo de Servicio <span className="text-red-500">*</span></Label>
                                            <div className="relative">
                                                <Input 
                                                    placeholder="Seleccione o escriba..." 
                                                    value={formData.service_type}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFormData(prev => ({ ...prev, service_type: val }));
                                                        setShowServiceList(true);
                                                    }}
                                                    onClick={() => setShowServiceList(true)}
                                                    autoComplete="off"
                                                    className="bg-white pr-8"
                                                    required
                                                />
                                                {formData.service_type ? (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setFormData(p => ({ ...p, service_type: '' }))}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                    >
                                                        <X size={14} strokeWidth={3} />
                                                    </button>
                                                ) : (
                                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                )}
                                            </div>
                                            {showServiceList && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setShowServiceList(false)} />
                                                    <div className="absolute z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-48 overflow-y-auto">
                                                        {SERVICE_OPTIONS
                                                            .filter(opt => opt.toLowerCase().includes(formData.service_type.toLowerCase()))
                                                            .map(opt => (
                                                                <div 
                                                                    key={opt} 
                                                                    className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0 text-sm font-bold text-slate-700" 
                                                                    onClick={() => {
                                                                        setFormData(prev => ({ ...prev, service_type: opt }));
                                                                        setShowServiceList(false);
                                                                    }}
                                                                >
                                                                    {opt}
                                                                </div>
                                                            ))
                                                        }
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {formData.service_type === "Otros servicios" && (
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold text-slate-500 uppercase">Especifique el Servicio</Label>
                                                <Input 
                                                    name="service_type_other" 
                                                    value={formData.service_type_other}
                                                    onChange={handleInputChange}
                                                    className="h-10 bg-white"
                                                    placeholder="Especifique otro..."
                                                />
                                            </div>
                                        )}



                                    </div>

                                    {/* Datos del Destinatario */}
                                    <div className="space-y-3 border p-4 rounded-md bg-white mt-4">
                                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2">
                                            <User className="h-4 w-4 text-violet-500" />
                                            Datos del Destinatario
                                        </h3>
                                        
                                        <div className="grid gap-2 mb-2">
                                            <Label className="text-[10px] text-slate-400 font-semibold uppercase">Nombre Completo</Label>
                                            <Input name="recipient_name" value={formData.recipient_name} onChange={handleInputChange} className="h-10 text-sm bg-slate-50 border-slate-200" autoComplete="off" />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label className="text-[10px] text-slate-400 font-semibold uppercase">Teléfono</Label>
                                            <Input name="recipient_phone" value={formData.recipient_phone} onChange={handleInputChange} className="h-10 text-sm bg-slate-50 border-slate-200" autoComplete="off" />
                                        </div>
                                    </div>

                                    {/* Costos section */}
                                    <div className="border-t border-slate-200 pt-3 mt-4">
                                        <h4 className="font-semibold text-slate-700 text-xs mb-2 uppercase flex items-center gap-2">
                                            <Wallet className="h-3 w-3 text-chimipink" /> Costos
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
                                                    className="bg-white border-slate-200 h-10 text-sm focus:ring-slate-500 font-bold" 
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
                                            <div className={`h-10 px-3 flex items-center border border-slate-200 rounded-md bg-slate-100 font-black ${Number(financials.balance) > 0 ? 'text-chimipink' : 'text-emerald-600'}`}>
                                                € {financials.balance}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: Files & Payments (Right) */}
                                <div className="space-y-4 flex flex-col h-full">

                                    {/* Logistics (Right) */}
                                    <div className="space-y-4 border p-4 rounded-md bg-white flex flex-col">
                                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2">
                                            <MapPin className="h-4 w-4 text-chimiteal" />
                                            Logística de Entrega
                                        </h3>

                                        <div className="space-y-4 flex-1">
                                            <div className="grid gap-2 relative">
                                                <Label className="text-xs font-bold text-slate-700">Dirección de Partida</Label>
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
                                                <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                    {[...SEDE_IT_OPTIONS, "Dirección de cliente"].filter(opt => opt.toLowerCase().includes(formData.origin_address.toLowerCase())).map((opt, idx) => (
                                                        <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                            setFormData(p => ({ ...p, origin_address: opt }))
                                                            setShowOriginList(false)
                                                        }}>
                                                            {opt === "Dirección de cliente" ? "✓ Dirección de cliente" : opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {formData.origin_address === 'Dirección de cliente' && (
                                            <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 col-span-1 sm:col-span-2">
                                                <Label className="text-xs font-bold text-chimipink uppercase tracking-tight italic">Ingrese la dirección exacta de recogida</Label>
                                                <textarea 
                                                    name="origin_address_client"
                                                    value={formData.origin_address_client}
                                                    onChange={handleInputChange}
                                                    className="min-h-[60px] w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:ring-chimipink focus:border-chimipink outline-none shadow-sm"
                                                    placeholder="Calle, número, piso, referencia..."
                                                />
                                            </div>
                                        )}

                                        <div className="grid gap-2 relative">
                                            <Label className="text-xs font-bold text-slate-700">Llegada / Recojo</Label>
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
                                                <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                    {[...SEDE_IT_OPTIONS, "Dirección de cliente"].filter(o => o.toLowerCase().includes(formData.destination_address.toLowerCase())).map(o => (
                                                        <div key={o} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => setFormData(p => ({ ...p, destination_address: o }))}>
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
                                                <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><NotebookPen className="h-4 w-4 text-chimiteal" /> Notas Adicionales</Label>
                                                <textarea 
                                                    name="note"
                                                    value={formData.note}
                                                    onChange={handleInputChange}
                                                    className="min-h-[80px] w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:ring-chimiteal focus:border-chimiteal outline-none shadow-sm"
                                                    placeholder="Cualquier aclaración requerida..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Estado (Moved to Bottom) */}
                                    <div className="space-y-2 border p-4 rounded-md bg-white">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Estado del Servicio <span className="text-red-500">*</span></Label>
                                        <select 
                                            name="status" 
                                            value={formData.status} 
                                            onChange={handleInputChange}
                                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-sm font-bold text-slate-700 mt-1 focus:ring-chimiteal focus:border-chimiteal outline-none"
                                        >
                                            <option value="pending">Pendiente</option>
                                            <option value="in_progress">En Proceso</option>
                                            <option value="completed">Listo</option>
                                            <option value="delivered">Entregado</option>
                                            <option value="cancelled">Cancelado</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                                    {/* REGISTRO DE PAGO */}
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
                                                                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                                                                            <span className={cn(
                                                                                "text-[8px] font-bold px-1 rounded uppercase",
                                                                                payment.moneda === 'PEN' ? "bg-rose-50 text-rose-500" : 
                                                                                payment.moneda === 'USD' ? "bg-blue-50 text-blue-500" : 
                                                                                "bg-slate-100 text-slate-500"
                                                                            )}>
                                                                                {payment.moneda || 'EUR'}
                                                                            </span>
                                                                            <span className="text-[9px] text-slate-400 font-medium">
                                                                                {parseFloat(payment.monto_original || payment.cantidad).toFixed(2)} • TC: {(payment.tipo_cambio || 1).toFixed(4)}
                                                                            </span>
                                                                        </div>
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
                                                            <button type="button" onClick={() => setShowPaymentFields(false)} className="text-red-400 hover:text-red-600 transition-colors p-1"><X size={20} /></button>
                                                            <button type="button" onClick={handleAddPayment} className="text-emerald-400 hover:text-emerald-600 transition-colors p-1"><Check size={20} /></button>
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
                                                            <Building2 size={12} className="text-slate-400" /> Sede
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
                                                                    className="bg-blue-50/50 border-blue-200 h-10 text-sm focus:ring-blue-500 pr-8 font-medium"
                                                                />
                                                                {formData.payment_method_it ? (
                                                                    <button type="button" onClick={() => setFormData(p => ({ ...p, payment_method_it: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5"><X size={14} strokeWidth={3} /></button>
                                                                ) : (
                                                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                                )}
                                                            </div>
                                                            {showMetodoITList && (
                                                                <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                                    {paymentMethodsIT
                                                                        .map(m => m.name)
                                                                        .filter(opt => opt.toLowerCase().includes(formData.payment_method_it.toLowerCase()))
                                                                        .map((opt, idx) => (
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
                                                                    className="bg-rose-50/50 border-rose-200 h-10 text-sm focus:ring-rose-500 pr-8 font-medium"
                                                                />
                                                                {formData.payment_method_pe ? (
                                                                    <button type="button" onClick={() => setFormData(p => ({ ...p, payment_method_pe: '' }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5"><X size={14} strokeWidth={3} /></button>
                                                                ) : (
                                                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                                )}
                                                            </div>
                                                            {showMetodoPEList && (
                                                                <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                                    {paymentMethodsPE
                                                                        .map(m => m.name)
                                                                        .filter(opt => opt.toLowerCase().includes(formData.payment_method_pe.toLowerCase()))
                                                                        .map((opt, idx) => (
                                                                        <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => { setFormData(p => ({ ...p, payment_method_pe: opt })); setShowMetodoPEList(false); }}>{opt}</div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs font-bold text-slate-700">Moneda</Label>
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
                                                                        {curr}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs font-bold text-slate-700">Cantidad</Label>
                                                            <Input 
                                                                type="number" 
                                                                name="payment_quantity" 
                                                                value={formData.payment_quantity} 
                                                                onChange={handleInputChange} 
                                                                className="h-10 bg-white border-slate-200 font-bold" 
                                                                placeholder="0.00" 
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
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
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs font-bold text-emerald-700">Equivalente EUR (€)</Label>
                                                            <div className="h-10 px-3 flex items-center bg-emerald-50 rounded-md border border-emerald-100 font-black text-emerald-600 text-lg">
                                                                {formData.payment_total || '0.00'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Label className="text-xs font-bold text-slate-700">Foto Comprobante</Label>
                                                        <Input type="file" accept="image/*" onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)} className="h-10 bg-white cursor-pointer" />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex flex-col items-center pt-2 border-t border-slate-100/50 italic">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Vista Previa de Saldo</span>
                                                <span className={`text-sm font-black ${parseFloat(financials.balance) > 0 ? 'text-chimipink' : 'text-chimiteal'}`}>
                                                    € {financials.balance}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section: Archivos/Fotos */}
                                    <div className="space-y-4 border p-4 rounded-md bg-slate-50 mt-6">
                                        <Label className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2">
                                            <Package className="h-4 w-4 text-chimicyan" /> Archivos del Servicio
                                        </Label>

                                        {/* Existing Documents */}
                                        {existingDocuments.length > 0 && (
                                            <div className="mb-4 space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {existingDocuments.map((doc, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 bg-white border rounded shadow-sm text-xs">
                                                        <div className="flex items-center gap-2 truncate">
                                                            <FileText className="h-5 w-5 text-slate-400" />
                                                            <span className="truncate font-bold text-slate-700">{doc.title || doc.name}</span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 text-blue-500 hover:bg-blue-50" onClick={async () => {
                                                                const url = await getOtherServiceDocumentUrl(doc.path, doc.storage)
                                                                window.open(url, '_blank')
                                                            }}>
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={async () => {
                                                                    if(confirm('¿Borrar archivo?')) {
                                                                        await deleteOtherServiceDocument(selectedId!, doc.path)
                                                                        setExistingDocuments(prev => prev.filter(d => d.path !== doc.path))
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
                                            <Input type="number" min="0" max="10" className="w-20 h-10 text-center font-bold text-chimicyan text-lg" value={numDocs} onChange={handleNumDocsChange} />
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


                            <DialogFooter>
                                <Button type="submit" disabled={isLoading} className="bg-linear-to-r from-chimipink to-chimicyan text-slate-700 w-full sm:w-auto px-8 font-bold h-12">
                                    {isLoading ? 'Guardando...' : (selectedId ? 'Actualizar Registro' : 'Guardar Registro')}
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
                            <Input placeholder="Buscar servicio o cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 pr-8 h-10 border-slate-200 focus:ring-chimicyan" />
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
                                <th className="p-4 whitespace-nowrap">FECHA</th>
                                <th className="p-4 whitespace-nowrap">CÓDIGO</th>
                                <th className="p-4 whitespace-nowrap">SERVICIO</th>
                                <th className="p-4 whitespace-nowrap">CLIENTE</th>
                                <th className="p-4 whitespace-nowrap">AGENTE</th>
                                <th className="p-4 whitespace-nowrap">TOTAL A PAGAR</th>
                                <th className="p-4 whitespace-nowrap">A CUENTA</th>
                                <th className="p-4 whitespace-nowrap text-nowrap">SALDO PENDIENTE</th>
                                <th className="p-4 text-center whitespace-nowrap">ESTADO</th>
                                <th className="p-4 text-right sticky right-0 bg-slate-50/90 backdrop-blur-sm z-10 border-l border-slate-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] whitespace-nowrap">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-20 text-center text-slate-400 italic">No se encontraron servicios</td>
                                </tr>
                            ) : (
                                paginatedItems.map(s => (
                                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors text-sm whitespace-nowrap">
                                        <td className="p-4 py-3">
                                            <span className="text-[10px] text-slate-500 font-bold">
                                                {new Date(s.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </span>
                                        </td>
                                        <td className="p-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">{s.tracking_code}</span>
                                                <div className="flex items-center gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-6 w-6 p-0 text-slate-400 hover:text-chimipink" 
                                                        onClick={() => handleCopyCode(s.id, s.tracking_code)}
                                                        title="Copiar mensaje de seguimiento"
                                                    >
                                                        {copiedId === s.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                                    </Button>
                                                    {copiedId === s.id && (
                                                        <span className="text-[10px] text-emerald-600 font-bold animate-in fade-in zoom-in-95">¡Copiado!</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 py-3">
                                            <span className="font-bold text-slate-700">{s.service_type === "Otros servicios" ? s.service_type_other : s.service_type}</span>
                                        </td>
                                        <td className="p-4 py-3">
                                            <span className="font-bold text-slate-700">{s.profiles?.first_name} {s.profiles?.last_name}</span>
                                        </td>
                                        <td className="p-4 py-3">
                                            <span className="text-xs font-medium text-slate-500 uppercase">
                                                {s.agent ? `${s.agent.first_name} ${s.agent.last_name}` : 'S/D'}
                                            </span>
                                        </td>
                                        <td className="p-4 py-3 font-bold text-slate-700">€ {s.total_amount.toFixed(2)}</td>
                                        <td className="p-4 py-3 font-bold text-slate-500">€ {s.on_account.toFixed(2)}</td>
                                        <td className={`p-4 py-3 font-black ${s.balance > 0 ? 'text-chimipink' : 'text-chimiteal'}`}>
                                            € {s.balance.toFixed(2)}
                                        </td>
                                        <td className="p-4 py-3 text-center">
                                            <span className={cn(
                                                "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                                s.status === 'pending' ? "bg-amber-100 text-amber-700" :
                                                s.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                                                s.status === 'cancelled' ? "bg-red-100 text-red-700" :
                                                "bg-blue-100 text-blue-700"
                                            )}>
                                                {s.status === 'pending' ? 'Pendiente' : 
                                                 s.status === 'in_progress' ? 'En Proceso' : 
                                                 s.status === 'completed' ? 'Listo' : 
                                                 s.status === 'delivered' ? 'Entregado' : 'Cancelado'}
                                            </span>
                                        </td>
                                        <td className="p-4 py-3 text-right sticky right-0 bg-pink-50/90 backdrop-blur-sm group-hover:bg-pink-100 z-10 border-l border-pink-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] transition-colors">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => handleActionClick(s, 'edit')}
                                                    className="text-slate-400 hover:text-slate-600"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>

                                                {userRole === 'admin' && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleActionClick(s, 'delete')}>
                                                        <Trash2 className="h-4 w-4 text-red-400" />
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

                {/* Modern Pagination */}
                {!isLoading && totalPages > 1 && (
                    <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Página</span>
                            <span className="flex items-center justify-center h-8 w-8 bg-white border border-slate-200 rounded-lg text-xs font-black text-chimipink shadow-sm">{currentPage}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">de</span>
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{totalPages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button 
                                variant="outline" 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => prev - 1)}
                                className="h-10 px-6 rounded-xl border-slate-200 bg-white font-black text-[10px] uppercase tracking-widest transition-all hover:bg-chimipink hover:text-white hover:border-chimipink disabled:opacity-30 shadow-sm"
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Anterior
                            </Button>
                            <Button 
                                variant="outline" 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="h-10 px-6 rounded-xl border-slate-200 bg-white font-black text-[10px] uppercase tracking-widest transition-all hover:bg-chimicyan hover:text-white hover:border-chimicyan disabled:opacity-30 shadow-sm"
                            >
                                Siguiente
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Permission Request Modal for Agents */}
            <EditRequestModal 
                isOpen={isPermissionModalOpen}
                onClose={() => setIsPermissionModalOpen(false)}
                resourceId={pendingResourceId || ''}
                resourceType="other_services"
                resourceName={pendingResourceName}
                onSuccess={() => {
                    setIsPermissionModalOpen(false);
                    const serv = services.find(s => s.id === pendingResourceId);
                    if (serv) handleEdit(serv);
                }}
            />
        </div>
    )
}
