'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
    Link as LinkIcon
} from 'lucide-react'
import { getParcels, createParcel, updateParcel, deleteParcel, updateParcelStatus, deleteParcelDocument, getParcelDocumentUrl } from '@/app/actions/manage-parcels'
import { getClientsForDropdown } from '@/app/actions/manage-transfers'
import * as XLSX from 'xlsx'

// Interfaces
interface ParcelDocument {
    title: string
    path: string
    name: string
    size: number
    type: string
    storage: 'r2' | 'images'
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
    profiles?: {
        first_name: string | null
        last_name: string | null
        email: string | null
        phone: string | null
    }
}

interface ClientProfile {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
}

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

    // Form Data
    const [formData, setFormData] = useState({
        // Sender
        sender_id: "",
        
        // Recipient
        recipient_name: "",
        recipient_document: "",
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
        status: "pending"
    })

    // File Upload State
    const [numDocs, setNumDocs] = useState(0)
    const [documentInputs, setDocumentInputs] = useState<{title: string, file: File | null}[]>([])
    const [existingDocuments, setExistingDocuments] = useState<ParcelDocument[]>([])

    // Load Data Effect
    const loadData = useCallback(async () => {
        setIsLoading(true)
        const [parcelsData, clientsData] = await Promise.all([
            getParcels(),
            getClientsForDropdown()
        ])
        setParcels(parcelsData as unknown as Parcel[])
        setClients(clientsData as unknown as ClientProfile[])
        setIsLoading(false)
    }, [])

    useEffect(() => {
        const init = async () => {
             await loadData()
        }
        init()
    }, [loadData])

    // Handlers
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        
        // Numeric restrictions (Decimals allowed for cost)
        if (['shipping_cost', 'on_account'].includes(name)) {
             if (!/^\d*\.?\d*$/.test(value)) return
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value }
            
            // Auto-calculate balance if cost or on_account changes
            if (name === 'shipping_cost' || name === 'on_account') {
                const cost = parseFloat(newData.shipping_cost) || 0
                const onAccount = parseFloat(newData.on_account) || 0
                const balance = (cost - onAccount).toFixed(2)
                newData.balance = balance
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
            recipient_name: "",
            recipient_document: "",
            recipient_phone: "",
            recipient_address: "",
            package_type: "Caja",
            package_weight: "",
            package_description: "",
            shipping_cost: "",
            on_account: "",
            balance: "",
            tracking_code: "",
            status: "pending"
        })
        setSelectedParcelId(null)
        setNumDocs(0)
        setDocumentInputs([])
        setExistingDocuments([])
        setSearchClientTerm('')
    }

    const handleEdit = (parcel: Parcel) => {
        setSelectedParcelId(parcel.id)
        setFormData({
            sender_id: parcel.sender_id,
            recipient_name: parcel.recipient_name,
            recipient_document: parcel.recipient_document || "",
            recipient_phone: parcel.recipient_phone || "",
            recipient_address: parcel.recipient_address || "",
            package_type: parcel.package_type || "Caja",
            package_weight: parcel.package_weight || "",
            package_description: parcel.package_description || "",
            shipping_cost: parcel.shipping_cost.toString(),
            on_account: parcel.on_account.toString(),
            balance: parcel.balance.toString(),
            tracking_code: parcel.tracking_code || "",
            status: parcel.status
        })
        
        const cl = clients.find(c => c.id === parcel.sender_id)
        if (cl) setSearchClientTerm(`${cl.first_name} ${cl.last_name}`)
        
        if (parcel.documents) {
            setExistingDocuments(parcel.documents)
        } else {
            setExistingDocuments([])
        }
        setNumDocs(0)
        setDocumentInputs([])
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const payload = new FormData()
        Object.entries(formData).forEach(([key, value]) => {
            payload.append(key, value)
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

        const result = selectedParcelId 
            ? await updateParcel(payload)
            : await createParcel(payload)

        if (result.error) {
            alert(result.error)
        } else {
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

    const openTrackingLink = (code: string) => {
        const url = `${window.location.origin}/encomienda?code=${code}`
        window.open(url, '_blank')
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
                             <div className="grid gap-2 relative">
                                <Label>Remitente (Cliente) <span className="text-red-500">*</span></Label>
                                <Input 
                                    placeholder="Buscar cliente..." 
                                    value={searchClientTerm}
                                    onChange={(e) => {
                                        setSearchClientTerm(e.target.value)
                                        setIsClientDropdownOpen(true)
                                        if (e.target.value === '') {
                                            setFormData(prev => ({ ...prev, sender_id: '' }))
                                        }
                                    }}
                                    onClick={() => !selectedParcelId && setIsClientDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setIsClientDropdownOpen(false), 200)}
                                    required={!formData.sender_id}
                                    disabled={!!selectedParcelId}
                                    className={selectedParcelId ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""}
                                />
                                {isClientDropdownOpen && (
                                    <div className="absolute top-[70px] z-50 w-full max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg">
                                        {clients.filter(c => {
                                            if (!searchClientTerm) return true
                                            const term = searchClientTerm.toLowerCase()
                                            return c.first_name?.toLowerCase().includes(term) || 
                                                   c.last_name?.toLowerCase().includes(term)
                                        }).map(client => (
                                            <div 
                                                key={client.id}
                                                className="px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, sender_id: client.id }))
                                                    setSearchClientTerm(`${client.first_name} ${client.last_name}`)
                                                    setIsClientDropdownOpen(false)
                                                }}
                                            >
                                                <div className="font-medium">{client.first_name} {client.last_name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Two Column Layout */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* Package Details (Left) */}
                                <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                    <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                                        <Package className="h-4 w-4" />
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
                                        <h4 className="font-semibold text-slate-700 text-xs mb-2 uppercase">Costos</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <div className="grid gap-2">
                                                <Label>Costo Envío (€)</Label>
                                                <Input name="shipping_cost" type="number" step="0.01" value={formData.shipping_cost} onChange={handleInputChange} required />
                                            </div>
                                             <div className="grid gap-2">
                                                <Label>A Cuenta (€)</Label>
                                                <Input name="on_account" type="number" step="0.01" value={formData.on_account} onChange={handleInputChange} />
                                            </div>
                                        </div>
                                        <div className="grid gap-2 mt-2">
                                            <Label>Saldo Pendiente (€)</Label>
                                            <Input name="balance" value={formData.balance} readOnly className={`bg-slate-100 font-bold ${Number(formData.balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Recipient (Right) */}
                                <div className="space-y-4 border p-4 rounded-md bg-white">
                                    <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        Datos del Destinatario
                                    </h3>
                                    
                                    <div className="grid gap-2">
                                        <Label>Nombre Completo</Label>
                                        <Input name="recipient_name" value={formData.recipient_name} onChange={handleInputChange} required />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                         <div className="grid gap-2">
                                            <Label>DNI / Pasaporte</Label>
                                            <Input name="recipient_document" value={formData.recipient_document} onChange={handleInputChange} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Teléfono</Label>
                                            <Input name="recipient_phone" value={formData.recipient_phone} onChange={handleInputChange} />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label>Dirección de Recojo</Label>
                                        <textarea 
                                            name="recipient_address"
                                            value={formData.recipient_address}
                                            onChange={handleInputChange}
                                            className="min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                            placeholder="Dirección exacta, referencia..."
                                            required
                                        />
                                    </div>
                                    
                                    <div className="grid gap-2 mt-4">
                                        <Label>Estado del Envío</Label>
                                        <select 
                                            name="status"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                        >
                                            <option value="pending">Pendiente (Recibido)</option>
                                            <option value="warehouse">En Almacén</option>
                                            <option value="transit">En Tránsito</option>
                                            <option value="delivered">Entregado</option>
                                            <option value="cancelled">Cancelado</option>
                                        </select>
                                    </div>
                                </div>
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
                        <div className="grid gap-1">
                            <Label className="text-slate-500 text-xs uppercase">Dirección de Recojo</Label>
                            <div className="font-medium text-slate-900 bg-slate-50 p-2 rounded border border-slate-100">
                                {viewingRecipient?.recipient_address}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1">
                                <Label className="text-slate-500 text-xs uppercase">Documento</Label>
                                <div className="font-medium text-slate-900">{viewingRecipient?.recipient_document || '-'}</div>
                            </div>
                             <div className="grid gap-1">
                                <Label className="text-slate-500 text-xs uppercase">Teléfono</Label>
                                <div className="font-medium text-slate-900">{viewingRecipient?.recipient_phone || '-'}</div>
                            </div>
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
                                className="pl-10 border-slate-200 bg-white focus:ring-chimiteal"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                            />
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

                         <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-2 h-10">
                            <input 
                                type="date" 
                                className="text-sm border-none focus:ring-0 p-0 text-slate-700 w-full outline-none"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                title="Fecha Desde"
                            />
                        </div>
                         <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-2 h-10">
                            <input 
                                type="date" 
                                className="text-sm border-none focus:ring-0 p-0 text-slate-700 w-full outline-none"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                title="Fecha Hasta"
                            />
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
                                    <th className="px-6 py-4 font-medium">Tracking</th>
                                    <th className="px-6 py-4 font-medium">Remitente</th>
                                    <th className="px-6 py-4 font-medium">Destinatario</th>
                                    <th className="px-6 py-4 font-medium">Paquete</th>
                                    <th className="px-6 py-4 font-medium">Descripción</th>
                                    <th className="px-6 py-4 font-medium">Costo (€)</th>
                                    <th className="px-6 py-4 font-medium">A Cuenta (€)</th>
                                    <th className="px-6 py-4 font-medium">Saldo (€)</th>
                                    <th className="px-6 py-4 font-medium text-center">Fotos</th>
                                    <th className="px-6 py-4 font-medium">Estado</th>
                                    <th className="px-6 py-4 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="py-8 text-center text-slate-500">
                                            No se encontraron encomiendas.
                                        </td>
                                    </tr>
                                ) : (
                                    currentItems.map((parcel) => (
                                        <tr key={parcel.id} className="bg-white hover:bg-slate-50/50">
                                             <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                                                {new Date(parcel.created_at).toLocaleDateString('es-PE')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-slate-600 font-bold">{parcel.tracking_code || '-'}</span>
                                                    {parcel.tracking_code && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-6 w-6 p-0 text-slate-400 hover:text-chimipink" 
                                                            onClick={() => openTrackingLink(parcel.tracking_code)}
                                                            title="Abrir enlace de seguimiento"
                                                        >
                                                            <LinkIcon className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-slate-900 truncate max-w-[150px]" title={`${parcel.profiles?.first_name} ${parcel.profiles?.last_name}`}>
                                                    {parcel.profiles?.first_name} {parcel.profiles?.last_name}
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
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(parcel)} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(parcel.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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
        </div>
    )
}
