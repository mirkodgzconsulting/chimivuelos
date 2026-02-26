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
import { Card, CardContent } from "@/components/ui/card"
import { 
    Package, 
    Plus, 
    Search, 
    FileText, 
    Trash2, 
    Download, 
    User,
    Pencil, 
    ChevronLeft, 
    ChevronRight,
    MapPin,
    Link as LinkIcon,
    X,
    Building2,
    NotebookPen,
    Wallet,
    Check,
    Copy,
    ArrowRight
} from 'lucide-react'
import { getParcels, createParcel, updateParcel, deleteParcel, updateParcelStatus, deleteParcelDocument, getParcelDocumentUrl } from '@/app/actions/manage-parcels'
import { getClientsForDropdown } from '@/app/actions/manage-transfers'
import * as XLSX from 'xlsx'
import { EditRequestModal } from '@/components/permissions/EditRequestModal'
import { getActivePermissionDetails, getActivePermissions } from '@/app/actions/manage-permissions'
import { getPaymentMethodsIT, getPaymentMethodsPE, PaymentMethod } from '@/app/actions/manage-payment-methods'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Lock, Unlock } from 'lucide-react'

// Interfaces
interface ParcelDocument {
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
    cantidad: string       // EUR amount (affects accounting)
    tipo_cambio: number    // Exchange rate used
    total: string          // Formatted original amount (e.g. "S/ 400.00")
    moneda?: string        // 'EUR', 'PEN', 'USD'
    monto_original?: string
    created_at?: string
    updated_at?: string
    proof_path?: string
}

interface Parcel {
    id: string
    created_at: string
    tracking_code: string
    sender_id: string
    recipient_name: string
    recipient_document: string
    recipient_phone: string
    recipient_address: string
    package_type: string
    package_weight: string
    package_description: string
    shipping_cost: number
    on_account: number
    balance: number
    status: 'pending' | 'warehouse' | 'transit' | 'delivered' | 'cancelled'
    documents?: ParcelDocument[]
    payment_details?: PaymentDetail[]
    origin_address?: string
    origin_address_client?: string
    destination_address?: string
    destination_address_client?: string
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

const SEDE_IT_OPTIONS = ["turro milano", "corsico milano", "roma", "lima"]
const CURRENCY_OPTIONS = ["EUR", "PEN", "USD"]

export default function ParcelsPage() {
    // Main Data State
    const [parcels, setParcels] = useState<Parcel[]>([])
    const [clients, setClients] = useState<ClientProfile[]>([])
    
    // UI State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [searchClientTerm, setSearchClientTerm] = useState('')
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
    const [viewingRecipient, setViewingRecipient] = useState<Parcel | null>(null)
    const [viewingDescription, setViewingDescription] = useState<string | null>(null)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [paymentMethodsIT, setPaymentMethodsIT] = useState<PaymentMethod[]>([])
    const [paymentMethodsPE, setPaymentMethodsPE] = useState<PaymentMethod[]>([])
    
    // Pagination & Filters
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'warehouse' | 'transit' | 'delivered' | 'cancelled'>('all')

    // Dates
    const [dateFrom, setDateFrom] = useState(() => {
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        return `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
    })
    const [dateTo, setDateTo] = useState(() => {
        const now = new Date()
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
    })

    // Edit State
    const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null)
    const [docsViewerParcel, setDocsViewerParcel] = useState<Parcel | null>(null)

    // Role & Permissions State
    const [userRole, setUserRole] = useState<string | null>(null)
    const [unlockedResources, setUnlockedResources] = useState<Set<string>>(new Set())
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
    const [pendingResourceId, setPendingResourceId] = useState<string | null>(null)
    const [pendingResourceName, setPendingResourceName] = useState<string>('')

    useEffect(() => {
        const fetchInitialData = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const rawRole = user.user_metadata?.role || 'client'
                const role = rawRole === 'usuario' ? 'agent' : rawRole
                setUserRole(role)

                if (role === 'agent') {
                    const permissions = await getActivePermissions()
                    setUnlockedResources(new Set(permissions))
                }
            }
        }
        fetchInitialData()
    }, [])



    // Form Data
    const [formData, setFormData] = useState({
        // Sender
        sender_id: "",
        client_email: "",
        client_phone: "",
        
        // Recipient
        recipient_name: "",
        recipient_phone: "",
        recipient_address: "",
        
        // Package
        package_type: "Caja",
        package_weight: "",
        package_description: "",
        
        // Economics
        shipping_cost: "",
        on_account: "",
        balance: "",
        
        // Meta
        tracking_code: "",
        status: "pending",

        // Origins and Destinations
        origin_address: "",
        origin_address_client: "",
        destination_address: "",
        destination_address_client: "",

        // Registration Fields for Sub-Payments
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

    // Dropdown helpers
    const [showSedeITList, setShowSedeITList] = useState(false)
    const [showMetodoITList, setShowMetodoITList] = useState(false)
    const [showMetodoPEList, setShowMetodoPEList] = useState(false)
    const [showOriginList, setShowOriginList] = useState(false)
    const [showDestinationList, setShowDestinationList] = useState(false)

    // File Upload State
    const [numDocs, setNumDocs] = useState(0)
    const [documentInputs, setDocumentInputs] = useState<{title: string, file: File | null}[]>([])
    const [existingDocuments, setExistingDocuments] = useState<ParcelDocument[]>([])

    // Load Data Effect
    const loadData = useCallback(async () => {
        setIsLoading(true)
        const [parcelsData, clientsData, methodsIT, methodsPE] = await Promise.all([
            getParcels(),
            getClientsForDropdown(),
            getPaymentMethodsIT(),
            getPaymentMethodsPE()
        ])
        setParcels(parcelsData as unknown as Parcel[])
        setClients(clientsData as unknown as ClientProfile[])
        setPaymentMethodsIT(methodsIT)
        setPaymentMethodsPE(methodsPE)
        setIsLoading(false)
    }, [])

    useEffect(() => {
        const init = async () => {
             await loadData()
        }
        init()
    }, [loadData])
    
    // Derived Financial Summary
    const financials = useMemo(() => {
        let totalOnAccount = 0
        tempPayments.forEach(p => totalOnAccount += parseFloat(p.cantidad) || 0)
        
        // Add pending payment if visible and has value
        if (showPaymentFields && formData.payment_quantity && parseFloat(formData.payment_quantity) > 0) {
            totalOnAccount += parseFloat(formData.payment_total) || 0
        }

        const cost = parseFloat(formData.shipping_cost) || 0
        return {
            on_account: totalOnAccount.toFixed(2),
            balance: (cost - totalOnAccount).toFixed(2)
        }
    }, [tempPayments, showPaymentFields, formData.payment_quantity, formData.payment_total, formData.shipping_cost])



    // Handlers
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        
        // Numeric restrictions (Decimals allowed for cost)
        if (['shipping_cost', 'on_account', 'payment_quantity', 'payment_exchange_rate'].includes(name)) {
             if (!/^\d*\.?\d*$/.test(value)) return
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value }
            
            // Recalculate temp payment conversion (Like Vuelos/Giros)
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
        if (val < 0 || val > 5) return

        setNumDocs(val)
        // Add unique items logic
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
            sender_id: "",
            client_email: "",
            client_phone: "",
            recipient_name: "",
            recipient_phone: "",
            recipient_address: "",
            package_type: "Caja",
            package_weight: "",
            package_description: "",
            shipping_cost: "",
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
            payment_total: "",
            origin_address: "",
            origin_address_client: "",
            destination_address: "",
            destination_address_client: ""
        })
        setSelectedParcelId(null)
        setNumDocs(0)
        setDocumentInputs([])
        setExistingDocuments([])
        setSearchClientTerm('')
        
        // Reset Payments
        setTempPayments([])
        setTempPaymentProofs([])
        setPaymentProofFile(null)
        setShowPaymentFields(false)
    }

    const handleEdit = (parcel: Parcel) => {
        const cl = clients.find(c => c.id === parcel.sender_id)
        
        setSelectedParcelId(parcel.id)
        setFormData({
            sender_id: parcel.sender_id,
            client_email: cl?.email || "",
            client_phone: cl?.phone || "",
            recipient_name: parcel.recipient_name,
            recipient_phone: parcel.recipient_phone || "",
            recipient_address: parcel.recipient_address || "",
            package_type: parcel.package_type || "Caja",
            package_weight: parcel.package_weight || "",
            package_description: parcel.package_description || "",
            shipping_cost: parcel.shipping_cost.toString(),
            on_account: parcel.on_account.toString(),
            balance: parcel.balance.toString(),
            tracking_code: parcel.tracking_code || "",
            status: parcel.status,
            sede_it: "",
            sede_pe: "",
            payment_method_it: "",
            payment_method_pe: "",
            payment_quantity: "",
            payment_exchange_rate: "1.0",
            payment_currency: "EUR",
            payment_total: "",
            origin_address: parcel.origin_address || "",
            origin_address_client: parcel.origin_address_client || "",
            destination_address: parcel.destination_address || "",
            destination_address_client: parcel.destination_address_client || ""
        })
        
        if (cl) setSearchClientTerm(`${cl.first_name} ${cl.last_name}`)
        
        if (parcel.documents) {
            setExistingDocuments(parcel.documents)
        } else {
            setExistingDocuments([])
        }
        setNumDocs(0)
        setDocumentInputs([])
        
        // Load Payments
        let paymentsToShow: PaymentDetail[] = []
        if (parcel.payment_details) {
            if (Array.isArray(parcel.payment_details)) {
                paymentsToShow = parcel.payment_details
            } else if (typeof parcel.payment_details === 'string') {
                try {
                    paymentsToShow = JSON.parse(parcel.payment_details)
                } catch (e) {
                    console.error("Error parsing payment_details:", e)
                    paymentsToShow = []
                }
            }
        }
        
        setTempPayments(paymentsToShow)
        setTempPaymentProofs(new Array(paymentsToShow.length).fill(null))
        
        setIsDialogOpen(true)
    }

    const handleEditClick = async (parcel: Parcel) => {
        if (userRole === 'admin') {
            handleEdit(parcel)
            return
        }

        if (userRole === 'agent') {
            const permission = await getActivePermissionDetails('parcels', parcel.id)
            const isUnlocked = unlockedResources.has(parcel.id) || permission.hasPermission
            if (isUnlocked) {
                setUnlockedResources(prev => new Set(prev).add(parcel.id))
                handleEdit(parcel)
            } else {
                setPendingResourceId(parcel.id)
                setPendingResourceName(parcel.tracking_code || parcel.id)
                setIsPermissionModalOpen(true)
            }
        }
    }

    const handlePaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPaymentProofFile(e.target.files[0])
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

    const handleRemovePayment = (index: number) => {
        const updated = tempPayments.filter((_, i) => i !== index)
        const updatedProofs = tempPaymentProofs.filter((_, i) => i !== index)
        setTempPayments(updated)
        setTempPaymentProofs(updatedProofs)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        // Capture any "unsaved" payment in the fields
        const finalPayments = [...tempPayments]
        const finalProofs = [...tempPaymentProofs]
        
        if (formData.payment_quantity && parseFloat(formData.payment_quantity) > 0) {
            const pCurrency = formData.payment_currency || 'EUR'
            const symbol = pCurrency === 'EUR' ? '€' : pCurrency === 'PEN' ? 'S/' : '$'
            const eurAmount = formData.payment_total || formData.payment_quantity
            
            const lastPayment: PaymentDetail = {
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
            finalPayments.push(lastPayment)
            finalProofs.push(paymentProofFile)
        }

        // IMPORTANT: The total 'on_account' MUST be the sum of ALL final payments
        const currentOnAccount = parseFloat(financials.on_account)
        const currentBalance = parseFloat(financials.balance)

        const payload = new FormData()
        Object.entries(formData).forEach(([key, value]) => {
            // Update on_account and balance in payload based on our verified calculation
            if (key === 'on_account') {
                payload.append(key, currentOnAccount.toFixed(2))
            } else if (key === 'balance') {
                payload.append(key, currentBalance.toFixed(2))
            } else {
                payload.append(key, value)
            }
        })

        if (selectedParcelId) {
            payload.append('id', selectedParcelId)
        }

        documentInputs.forEach((doc, index) => {
            if (doc.file) {
                payload.append(`document_title_${index}`, doc.title)
                payload.append(`document_file_${index}`, doc.file)
            }
        })

        // Add Payments list to payload
        payload.append('payment_details', JSON.stringify(finalPayments))
        finalProofs.forEach((file, index) => {
            if (file) {
                payload.append(`payment_proof_${index}`, file)
            }
        })

        const result = selectedParcelId 
            ? await updateParcel(payload)
            : await createParcel(payload)

        if (result.error) {
            alert(result.error)
        } else {
            // Ensure the resource is locked again for the agent
            if (selectedParcelId) {
                setUnlockedResources(prev => {
                    const next = new Set(prev)
                    next.delete(selectedParcelId)
                    return next
                })
            }
            setIsDialogOpen(false)
            resetForm()
            loadData()
        }
        setIsLoading(false)
    }

    const handleStatusChange = async (id: string, newStatus: string) => {
        // Optimistic UI
        setParcels(prev => prev.map(p => p.id === id ? { ...p, status: newStatus as Parcel['status'] } : p))
        
        const result = await updateParcelStatus(id, newStatus)
        if (result.error) {
            alert("Error updating status")
            loadData()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar esta encomienda? Se borrarán los datos y archivos.")) return
        const result = await deleteParcel(id)
        if (!result.error) loadData()
    }

    const handleDownload = async (doc: ParcelDocument) => {
        const url = await getParcelDocumentUrl(doc.path, doc.storage || 'r2')
        if (typeof url === 'string') {
             window.open(url, '_blank')
        } else {
            alert('Error al obtener URL del documento')
        }
    }

    const handleCopyCode = (id: string, code: string) => {
        const url = `https://chimivuelos.pe/encomienda?code=${code}`
        const message = `El registro de tu encomienda fue realizado, tu código de seguimiento es ${code}, puedes rastrear ingresando a ${url}`
        
        navigator.clipboard.writeText(message)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    // Filter Logic
    const filteredParcels = useMemo(() => {
        return parcels.filter(p => {
            const lower = searchTerm.toLowerCase()
            const matchesSearch = !searchTerm || 
                p.tracking_code?.toLowerCase().includes(lower) ||
                p.recipient_name?.toLowerCase().includes(lower) ||
                p.profiles?.first_name?.toLowerCase().includes(lower) ||
                p.profiles?.last_name?.toLowerCase().includes(lower)

            const matchesStatus = statusFilter === 'all' || p.status === statusFilter

            const parcelDate = new Date(p.created_at).toISOString().split('T')[0]
            const matchesDateFrom = !dateFrom || parcelDate >= dateFrom
            const matchesDateTo = !dateTo || parcelDate <= dateTo

            return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
        })
    }, [parcels, searchTerm, statusFilter, dateFrom, dateTo])

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    const currentItems = filteredParcels.slice(indexOfFirstItem, indexOfLastItem)
    const totalPages = Math.ceil(filteredParcels.length / itemsPerPage)

    const handleExportExcel = () => {
        const data = filteredParcels.map(p => ({
            Fecha: new Date(p.created_at).toLocaleDateString('es-PE'),
            Codigo: p.tracking_code,
            Remitente: `${p.profiles?.first_name} ${p.profiles?.last_name}`,
            Agente: p.agent ? `${p.agent.first_name} ${p.agent.last_name}` : '-',
            Destinatario: p.recipient_name,
            Direccion: p.recipient_address,
            Tipo: p.package_type,
            Peso: p.package_weight,
            Costo: p.shipping_cost,
            A_Cuenta: p.on_account,
            Saldo: p.balance,
            Estado: p.status
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Encomiendas")
        XLSX.writeFile(wb, "Encomiendas_Chimivuelos.xlsx")
    }

    return (
        <div className="space-y-6">
            
            {/* Header Area */}

            <div className="flex items-center justify-center">
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                         <Button onClick={() => { resetForm(); setIsDialogOpen(true) }} className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 gap-2 font-bold shadow-md border-none">
                            <Plus className="h-4 w-4" />
                            Nueva Encomienda
                        </Button>
                    </DialogTrigger>
                    
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden">
                        <DialogHeader>
                            <DialogTitle>{selectedParcelId ? 'Editar Encomienda' : 'Registrar Encomienda'}</DialogTitle>
                            <DialogDescription>
                                Ingrese los detalles del paquete y envío.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                            {/* Client (Sender) Selection */}
                            <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                <Label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                    <User className="h-4 w-4 text-chimipink" /> Datos del Cliente
                                </Label>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2 relative">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Remitente (Cliente) <span className="text-red-500">*</span></Label>
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
                                                        setFormData(prev => ({ ...prev, sender_id: '', client_email: '', client_phone: '' }))
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
                                                        .filter(c => {
                                                            const term = searchClientTerm.toLowerCase()
                                                            return `${c.first_name} ${c.last_name}`.toLowerCase().includes(term) ||
                                                                   c.email?.toLowerCase().includes(term)
                                                        })
                                                        .map(client => (
                                                            <div key={client.id} className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0" onClick={() => {
                                                                setFormData(prev => ({ 
                                                                    ...prev, 
                                                                    sender_id: client.id,
                                                                    client_email: client.email || "",
                                                                    client_phone: client.phone || ""
                                                                }))
                                                                setSearchClientTerm(`${client.first_name} ${client.last_name}`)
                                                                setIsClientDropdownOpen(false)
                                                            }}>
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

                            {/* Two Column Layout */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* Package Details (Left) */}
                                <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                    <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                        <Package className="h-4 w-4 text-chimicyan" />
                                        Detalles del Paquete
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="grid gap-2">
                                            <Label>Tipo</Label>
                                            <select 
                                                name="package_type"
                                                value={formData.package_type}
                                                onChange={handleInputChange}
                                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                            >
                                                <option value="Caja">Caja</option>
                                                <option value="Sobre">Sobre / Documentos</option>
                                                <option value="Maleta">Maleta</option>
                                                <option value="Mochila">Mochila</option>
                                                <option value="Saco">Saco / Costal</option>
                                                <option value="Paquete Pequeño">Paquete Pequeño</option>
                                                <option value="Paquete Mediano">Paquete Mediano</option>
                                                <option value="Paquete Grande">Paquete Grande</option>
                                                <option value="Barril">Barril / Bidón</option>
                                                <option value="Electrónico">Electrónico (TV, Laptop)</option>
                                                <option value="Otro">Otro</option>
                                            </select>
                                        </div>
                                         <div className="grid gap-2">
                                            <Label>Peso / Tamaño</Label>
                                            <Input name="package_weight" value={formData.package_weight} onChange={handleInputChange} placeholder="Ej. 5kg, Grande" />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Descripción</Label>
                                        <textarea 
                                            name="package_description"
                                            value={formData.package_description}
                                            onChange={handleInputChange}
                                            className="min-h-[60px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                            placeholder="Ej. Ropa y juguetes"
                                        />
                                    </div>

                                    <div className="border-t border-slate-200 pt-3 mt-2">
                                        <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-3"><Wallet className="h-4 w-4 text-emerald-500" /> Costos</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="grid gap-2">
                                                <Label>Total a Pagar (€)</Label>
                                                <Input name="shipping_cost" type="number" step="0.01" value={formData.shipping_cost} onChange={handleInputChange} required />
                                            </div>
                                             <div className="grid gap-2">
                                                <Label>A Cuenta (€)</Label>
                                                <Input 
                                                    name="on_account" 
                                                    value={financials.on_account} 
                                                    readOnly 
                                                    className="bg-slate-100 font-bold text-slate-700"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-2 mt-2">
                                            <Label>Saldo Pendiente (€)</Label>
                                            <Input name="balance" value={financials.balance} readOnly className={`bg-slate-100 font-bold ${Number(financials.balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="flex flex-col gap-4">
                                    <div className="space-y-4 border p-4 rounded-md bg-white">
                                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                            <User className="h-4 w-4 text-violet-500" />
                                            Datos del Destinatario
                                        </h3>
                                        
                                        <div className="grid gap-2">
                                            <Label>Nombre Completo</Label>
                                            <Input name="recipient_name" value={formData.recipient_name} onChange={handleInputChange} required />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Teléfono</Label>
                                            <Input name="recipient_phone" value={formData.recipient_phone} onChange={handleInputChange} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label>Notas de Envio</Label>
                                            <textarea 
                                                name="recipient_address"
                                                value={formData.recipient_address}
                                                onChange={handleInputChange}
                                                className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                                placeholder="Dirección exacta, referencia, notas..."
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4 border p-4 rounded-md bg-white flex-1">
                                        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-2">
                                            <MapPin className="h-4 w-4 text-chimiteal" />
                                            Logística de Entrega
                                        </h3>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="grid gap-2 relative">
                                            <Label className="text-xs font-bold text-slate-700">Dirección de Partida</Label>
                                            <div className="relative">
                                                <Input 
                                                    name="origin_address"
                                                    value={formData.origin_address}
                                                    onChange={(e) => {
                                                        const { value } = e.target
                                                        setFormData(prev => ({ ...prev, origin_address: value }))
                                                        setShowOriginList(true)
                                                    }}
                                                    onFocus={() => setShowOriginList(true)}
                                                    onBlur={() => setTimeout(() => setShowOriginList(false), 200)}
                                                    placeholder="Buscar origen..."
                                                    autoComplete="off"
                                                    className="h-10 text-sm bg-white pr-8"
                                                />
                                                {formData.origin_address ? (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setFormData(p => ({ ...p, origin_address: '' }))}
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
                                            <Label className="text-xs font-bold text-slate-700">Dirección de Llegada</Label>
                                            <div className="relative">
                                                <Input 
                                                    name="destination_address"
                                                    value={formData.destination_address}
                                                    onChange={(e) => {
                                                        const { value } = e.target
                                                        setFormData(prev => ({ ...prev, destination_address: value }))
                                                        setShowDestinationList(true)
                                                    }}
                                                    onFocus={() => setShowDestinationList(true)}
                                                    onBlur={() => setTimeout(() => setShowDestinationList(false), 200)}
                                                    placeholder="Buscar destino..."
                                                    autoComplete="off"
                                                    className="h-10 text-sm bg-white pr-8"
                                                />
                                                {formData.destination_address ? (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setFormData(p => ({ ...p, destination_address: '' }))}
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
                                                    {[...SEDE_IT_OPTIONS, "Dirección de cliente"].filter(opt => opt.toLowerCase().includes(formData.destination_address.toLowerCase())).map((opt, idx) => (
                                                        <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                            setFormData(p => ({ ...p, destination_address: opt }))
                                                            setShowDestinationList(false)
                                                        }}>
                                                            {opt === "Dirección de cliente" ? "✓ Dirección de cliente" : opt}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {formData.destination_address === 'Dirección de cliente' && (
                                        <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 col-span-1 sm:col-span-2">
                                                <Label className="text-xs font-bold text-chimipink uppercase tracking-tight italic">Ingrese la dirección exacta del cliente</Label>
                                                <textarea 
                                                    name="destination_address_client"
                                                    value={formData.destination_address_client}
                                                    onChange={handleInputChange}
                                                    className="min-h-[60px] w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:ring-chimipink focus:border-chimipink outline-none shadow-sm"
                                                    placeholder="Calle, número, piso, referencia..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* REGISTRO DE PAGO (Exactly like Vuelos) */}
                            <div className="space-y-4 pt-4 border-t border-slate-200">
                                {tempPayments.length > 0 && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 px-1 pb-2">
                                        <div className="flex items-center gap-2 opacity-60">
                                            <div className="h-px flex-1 bg-slate-200"></div>
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abonos añadidos (sin guardar)</Label>
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
                                                                    <Building2 size={10} className="h-2.5 w-2.5" /> {payment.sede_it || payment.sede_pe || 'S/D'}
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
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleRemovePayment(idx)}
                                                                className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                                title="Remover"
                                                            >
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
                                                    <button 
                                                        type="button"
                                                        onClick={() => setShowPaymentFields(false)}
                                                        className="text-red-400 hover:text-red-600 transition-colors p-1"
                                                        title="Cerrar"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={handleAddPayment}
                                                        className="text-emerald-400 hover:text-emerald-600 transition-colors p-1"
                                                        title="Añadir Pago"
                                                    >
                                                        <Check size={20} className="h-5 w-5" />
                                                    </button>
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
                                                        onChange={(e) => {
                                                            const { value } = e.target
                                                            setFormData(prev => ({ ...prev, sede_it: value }))
                                                            setShowSedeITList(true)
                                                        }}
                                                        onFocus={() => setShowSedeITList(true)}
                                                        onBlur={() => setTimeout(() => setShowSedeITList(false), 200)}
                                                        placeholder="Buscar sede..."
                                                        autoComplete="off"
                                                        className="bg-slate-50 border-slate-200 focus:ring-slate-500 pr-8 h-10 text-sm"
                                                    />
                                                    {formData.sede_it ? (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setFormData(p => ({ ...p, sede_it: '' }))}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
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
                                                            <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                setFormData(p => ({ ...p, sede_it: opt }))
                                                                setShowSedeITList(false)
                                                            }}>{opt}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-blue-700">
                                                        <Image src="https://flagcdn.com/w20/it.png" width={16} height={12} alt="italia" className="rounded-sm inline-block shadow-sm" />
                                                        Método Pago IT
                                                    </Label>
                                                    <div className="relative">
                                                        <Input 
                                                            name="payment_method_it" 
                                                            value={formData.payment_method_it} 
                                                            onChange={(e) => {
                                                                const { value } = e.target
                                                                setFormData(prev => ({ ...prev, payment_method_it: value }))
                                                                setShowMetodoITList(true)
                                                            }}
                                                            onFocus={() => setShowMetodoITList(true)}
                                                            onBlur={() => setTimeout(() => setShowMetodoITList(false), 200)}
                                                            placeholder="Buscar método..."
                                                            autoComplete="off"
                                                            className="bg-blue-50/50 border-blue-200 focus:ring-blue-500 pr-8 h-10 text-sm"
                                                        />
                                                        {formData.payment_method_it ? (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormData(p => ({ ...p, payment_method_it: '' }))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
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
                                                                <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                    setFormData(p => ({ ...p, payment_method_it: opt }))
                                                                    setShowMetodoITList(false)
                                                                }}>{opt}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-rose-700">
                                                        <Image src="https://flagcdn.com/w20/pe.png" width={16} height={12} alt="peru" className="rounded-sm inline-block shadow-sm" />
                                                        Método Pago PE
                                                    </Label>
                                                    <div className="relative">
                                                        <Input 
                                                            name="payment_method_pe" 
                                                            value={formData.payment_method_pe} 
                                                            onChange={(e) => {
                                                                const { value } = e.target
                                                                setFormData(prev => ({ ...prev, payment_method_pe: value }))
                                                                setShowMetodoPEList(true)
                                                            }}
                                                            onFocus={() => setShowMetodoPEList(true)}
                                                            onBlur={() => setTimeout(() => setShowMetodoPEList(false), 200)}
                                                            placeholder="Buscar método..."
                                                            autoComplete="off"
                                                            className="bg-rose-50/50 border-rose-200 focus:ring-rose-500 pr-8 h-10 text-sm"
                                                        />
                                                        {formData.payment_method_pe ? (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormData(p => ({ ...p, payment_method_pe: '' }))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
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
                                                                <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                    setFormData(p => ({ ...p, payment_method_pe: opt }))
                                                                    setShowMetodoPEList(false)
                                                                }}>{opt}</div>
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
                                                                onClick={() => setFormData(p => ({ ...p, payment_currency: curr }))}
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
                                                        className="h-10 text-lg font-bold bg-yellow-50/50 border-yellow-200 text-slate-700" 
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
                                                        className="h-10 text-sm bg-white font-medium border-slate-200" 
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

                                            <div className="grid gap-2 mt-2">
                                                <Label className="text-xs font-bold text-slate-700">Foto de Comprobante (Opcional)</Label>
                                                <Input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="cursor-pointer file:bg-chimiteal/10 file:text-chimiteal file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 file:text-xs file:font-semibold h-10 border-slate-200" 
                                                    onChange={handlePaymentFileChange}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Footer Info like Vuelos */}
                                    <div className="flex flex-col items-center pt-2 border-t border-slate-100 italic">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Vista Previa de Saldo</span>
                                        <span className={`text-sm font-bold ${parseFloat(financials.balance) > 0 ? 'text-chimipink' : 'text-chimiteal'}`}>€ {financials.balance}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-2 mt-4 pt-4 border-t border-slate-200 px-1">
                                <Label className="font-bold text-slate-700">Estado del Envío</Label>
                                <select 
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-chimiteal outline-none"
                                >
                                    <option value="pending">Pendiente (Recibido)</option>
                                    <option value="warehouse">En Almacén</option>
                                    <option value="transit">En Tránsito</option>
                                    <option value="delivered">Entregado</option>
                                    <option value="cancelled">Cancelado</option>
                                </select>
                            </div>

                            {/* Documents Section */}
                             <div className="space-y-4 border-t pt-4">
                                <Label className="block mb-2 font-bold text-slate-700">Fotos / Guía de Remisión</Label>
                                
                                {/* Existing Files */}
                                {existingDocuments.length > 0 && (
                                    <div className="mb-4 space-y-2">
                                        <p className="text-xs font-semibold text-slate-500">Archivos Cargados:</p>
                                        {existingDocuments.map((doc, idx) => (
                                             <div key={idx} className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded text-sm">
                                                 <span className="truncate max-w-[200px] font-medium">{doc.title || doc.name}</span>
                                                 <div className="flex gap-2">
                                                     <Button type="button" variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                                                         <FileText className="h-4 w-4" />
                                                     </Button>
                                                     <Button type="button" variant="ghost" size="sm" onClick={async () => {
                                                            if(confirm('¿Borrar archivo?')) {
                                                                if (selectedParcelId) {
                                                                    await deleteParcelDocument(selectedParcelId, doc.path)
                                                                    setExistingDocuments(prev => prev.filter(d => d.path !== doc.path))
                                                                }
                                                            }
                                                        }}
                                                        className="text-red-500 hover:text-red-700"
                                                     >
                                                         <Trash2 className="h-4 w-4" />
                                                     </Button>
                                                 </div>
                                             </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mb-4">
                                    <Label>¿Cuántos archivos nuevos?</Label>
                                    <Input 
                                        type="number" 
                                        min="0" 
                                        max="5" 
                                        className="w-20"
                                        value={numDocs}
                                        onChange={handleNumDocsChange}
                                    />
                                </div>

                                {documentInputs.map((input, index) => (
                                    <div key={index} className="grid grid-cols-2 gap-4 mb-2 p-3 bg-slate-50 rounded border border-slate-200">
                                        <div>
                                            <Label className="text-xs">Título (Opcional)</Label>
                                            <Input 
                                                value={input.title}
                                                onChange={e => handleDocInputChange(index, 'title', e.target.value)}
                                                placeholder="Ej. Foto Paquete"
                                                className="mt-1"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Archivo</Label>
                                            <Input 
                                                type="file" 
                                                onChange={e => handleDocInputChange(index, 'file', e.target.files?.[0] || null)}
                                                className="mt-1 w-full"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={isLoading} className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 w-full sm:w-auto font-bold shadow-md">
                                    {isLoading ? 'Guardando...' : (selectedParcelId ? 'Actualizar Encomienda' : 'Guardar Encomienda')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                 </Dialog>
            </div>

            {/* Recipient Details Modal */}
            <Dialog open={!!viewingRecipient} onOpenChange={(open) => !open && setViewingRecipient(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Datos del Destinatario</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid gap-1">
                            <Label className="text-slate-500 text-xs uppercase">Nombre Completo</Label>
                            <div className="font-medium text-slate-900">{viewingRecipient?.recipient_name}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1">
                                <Label className="text-slate-500 text-xs uppercase">Partida</Label>
                                <div className="font-medium text-slate-900 capitalize italic">{viewingRecipient?.origin_address || '-'}</div>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-slate-500 text-xs uppercase">Llegada</Label>
                                <div className="font-medium text-slate-900 capitalize italic">{viewingRecipient?.destination_address || '-'}</div>
                            </div>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-slate-500 text-xs uppercase">Notas de Envio</Label>
                            <div className="font-medium text-slate-900 bg-slate-50 p-2 rounded border border-slate-100">
                                {viewingRecipient?.recipient_address || '-'}
                            </div>
                        </div>

                        <div className="grid gap-1">
                            <Label className="text-slate-500 text-xs uppercase">Teléfono</Label>
                            <div className="font-medium text-slate-900">{viewingRecipient?.recipient_phone || '-'}</div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal Versión Completa Descripción */}
            <Dialog open={!!viewingDescription} onOpenChange={(open) => !open && setViewingDescription(null)}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Descripción del Paquete</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 p-4 bg-slate-50 rounded-md border border-slate-100 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap">
                        {viewingDescription}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingDescription(null)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Docs Viewer Modal */}
            <Dialog open={!!docsViewerParcel} onOpenChange={(open) => !open && setDocsViewerParcel(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Archivos Adjuntos</DialogTitle>
                        <DialogDescription>
                             Encomienda {docsViewerParcel?.tracking_code}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        {docsViewerParcel?.documents && docsViewerParcel.documents.length > 0 ? (
                            docsViewerParcel.documents.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border rounded-md hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="bg-blue-100 p-2 rounded text-blue-600">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <div className="flex flex-col truncate">
                                            <span className="font-medium text-sm truncate">{doc.title || doc.name}</span>
                                            <span className="text-xs text-slate-500">{(doc.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-800" onClick={() => handleDownload(doc)}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 text-slate-500 text-sm">
                                No hay archivos adjuntos.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Main Table Card */}
             <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50">
                     {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-1">
                         <div className="relative min-w-[200px] flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input 
                                placeholder="Buscar por código, nombre..." 
                                className="pl-10 pr-10 border-slate-200 bg-white focus:ring-chimiteal"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => {setSearchTerm(''); setCurrentPage(1);}}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        
                        <select 
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'warehouse' | 'transit' | 'delivered' | 'cancelled')}
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendiente</option>
                            <option value="warehouse">En Almacén</option>
                            <option value="transit">En Tránsito</option>
                            <option value="delivered">Entregado</option>
                            <option value="cancelled">Cancelado</option>
                        </select>

                          <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-2 h-10 relative pr-8">
                            <input 
                                type="date" 
                                className="text-sm border-none focus:ring-0 p-0 text-slate-700 w-full outline-none"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                title="Fecha Desde"
                            />
                            {dateFrom && (
                                <button 
                                    onClick={() => setDateFrom('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                          <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-2 h-10 relative pr-8">
                            <input 
                                type="date" 
                                className="text-sm border-none focus:ring-0 p-0 text-slate-700 w-full outline-none"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                title="Fecha Hasta"
                            />
                            {dateTo && (
                                <button 
                                    onClick={() => setDateTo('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <select 
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer w-24"
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <Button variant="outline" onClick={handleExportExcel} className="gap-2 text-slate-600 border-slate-200 hover:bg-slate-50">
                            <FileText className="h-4 w-4 text-emerald-600" />
                            <span className="hidden sm:inline">Exportar Excel</span>
                        </Button>
                    </div>
                </div>

                <CardContent className="p-0">
                    <div className="w-full overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Fecha</th>
                                    <th className="px-6 py-4 font-medium">Codigo</th>
                                    <th className="px-6 py-4 font-medium">Remitente</th>
                                    <th className="px-6 py-4 font-medium">Agente</th>
                                    <th className="px-6 py-4 font-medium">Destinatario</th>
                                    <th className="px-6 py-4 font-medium">Paquete</th>
                                    <th className="px-6 py-4 font-medium">Descripción</th>
                                    <th className="px-6 py-4 font-medium">Costo (€)</th>
                                    <th className="px-6 py-4 font-medium">A Cuenta (€)</th>
                                    <th className="px-6 py-4 font-medium">Saldo (€)</th>
                                    <th className="px-6 py-4 font-medium text-center">Fotos</th>
                                    <th className="px-6 py-4 font-medium">Estado</th>
                                    <th className="px-6 py-4 font-medium text-right sticky right-0 bg-pink-100/90 backdrop-blur-sm z-20 border-l border-pink-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] text-pink-700">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={14} className="py-8 text-center text-slate-500">
                                            No se encontraron encomiendas.
                                        </td>
                                    </tr>
                                ) : (
                                    currentItems.map((parcel) => (
                                        <tr key={parcel.id} className="bg-white hover:bg-slate-50/50 group">
                                             <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                {new Date(parcel.created_at).toLocaleDateString('es-PE')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-slate-600 font-bold">{parcel.tracking_code || '-'}</span>
                                                    {parcel.tracking_code && (
                                                        <div className="flex items-center gap-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-6 w-6 p-0 text-slate-400 hover:text-chimipink" 
                                                                onClick={() => handleCopyCode(parcel.id, parcel.tracking_code)}
                                                                title="Copiar mensaje de seguimiento"
                                                            >
                                                                {copiedId === parcel.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                                            </Button>
                                                            {copiedId === parcel.id && (
                                                                <span className="text-[10px] text-emerald-600 font-bold animate-in fade-in zoom-in-95">¡Copiado!</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-slate-900 truncate max-w-[150px]" title={`${parcel.profiles?.first_name} ${parcel.profiles?.last_name}`}>
                                                    {parcel.profiles?.first_name} {parcel.profiles?.last_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-slate-600 font-medium whitespace-nowrap">
                                                    {parcel.agent ? `${parcel.agent.first_name} ${parcel.agent.last_name}` : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <button 
                                                    onClick={() => setViewingRecipient(parcel)}
                                                    className="font-medium text-chimiteal hover:underline text-left truncate max-w-[150px] block"
                                                    title={`Ver Datos: ${parcel.recipient_name} \nDirección: ${parcel.recipient_address}`}
                                                >
                                                    {parcel.recipient_name}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <User size={18} className="text-slate-400 shrink-0" />
                                                    <div className="text-slate-700 text-sm">
                                                        {parcel.package_type} <span className="text-slate-400">({parcel.package_weight})</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {parcel.package_description && parcel.package_description.length > 20 ? (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs text-slate-500 truncate max-w-[80px]" title={parcel.package_description}>
                                                            {parcel.package_description.substring(0, 20)}...
                                                        </span>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setViewingDescription(parcel.package_description)
                                                            }}
                                                            className="text-[10px] text-chimiteal font-medium underline hover:text-chimipink cursor-pointer ml-1"
                                                            title="Leer toda la descripción"
                                                        >
                                                            Ver más
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-500">{parcel.package_description || '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">€ {parcel.shipping_cost.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">€ {parcel.on_account.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">
                                                <span className={parcel.balance > 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>
                                                     € {parcel.balance.toFixed(2)}
                                                </span>
                                            </td>
                                             <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center">
                                                    {parcel.documents && parcel.documents.length > 0 ? (
                                                        <Button size="sm" variant="ghost" className="text-chimiteal hover:bg-teal-50" onClick={() => setDocsViewerParcel(parcel)}>
                                                            <FileText className="h-5 w-5" />
                                                            <span className="ml-1 text-xs">{parcel.documents.length}</span>
                                                        </Button>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={parcel.status}
                                                    onChange={(e) => handleStatusChange(parcel.id, e.target.value)}
                                                    className={`
                                                        px-2 py-1 rounded-full text-xs font-medium border-none focus:ring-0 cursor-pointer w-32 text-center
                                                        ${parcel.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 
                                                          parcel.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                                                          parcel.status === 'warehouse' ? 'bg-blue-100 text-blue-700' : 
                                                          parcel.status === 'transit' ? 'bg-purple-100 text-purple-700' :
                                                          'bg-amber-100 text-amber-700'}
                                                    `}
                                                >
                                                    <option value="pending">Pendiente</option>
                                                    <option value="warehouse">En Almacén</option>
                                                    <option value="transit">En Tránsito</option>
                                                    <option value="delivered">Entregado</option>
                                                    <option value="cancelled">Cancelado</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-right sticky right-0 bg-pink-50/90 backdrop-blur-sm group-hover:bg-pink-100 z-10 border-l border-pink-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] transition-colors">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => handleEditClick(parcel)}
                                                        className={cn(
                                                            userRole === 'agent' && !unlockedResources.has(parcel.id) && "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                        )}
                                                        title={userRole === 'agent' && !unlockedResources.has(parcel.id) ? "Solicitar permiso para editar" : "Editar"}
                                                    >
                                                        {userRole === 'agent' && !unlockedResources.has(parcel.id) ? (
                                                            <Lock className="h-4 w-4" />
                                                        ) : unlockedResources.has(parcel.id) ? (
                                                            <Unlock className="h-4 w-4 text-emerald-600" />
                                                        ) : (
                                                            <Pencil className="h-4 w-4 text-slate-400" />
                                                        )}
                                                    </Button>
                                                    {userRole === 'admin' && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(parcel.id)}>
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

                    {/* Pagination */}
                    {filteredParcels.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 bg-slate-50/50 flex-wrap gap-4">
                            <div className="text-xs text-slate-500">
                                Mostrando <span className="font-medium">{Math.min(indexOfFirstItem + 1, filteredParcels.length)}</span> - <span className="font-medium">{Math.min(indexOfLastItem, filteredParcels.length)}</span> de <span className="font-medium">{filteredParcels.length}</span> resultados
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            <EditRequestModal 
                isOpen={isPermissionModalOpen}
                onClose={() => setIsPermissionModalOpen(false)}
                resourceType="parcels"
                resourceId={pendingResourceId || ''}
                resourceName={pendingResourceName}
            />
        </div>
    )
}
