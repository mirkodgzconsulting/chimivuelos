"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { 
    Search, Plus, FileSpreadsheet, Pencil, Trash2, 
    ChevronLeft, ChevronRight, FileText, FolderOpen, Download 
} from "lucide-react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { 
    Dialog, DialogContent, DialogDescription, DialogFooter, 
    DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog"
import {
    getTransfers,
    createTransfer,
    updateTransfer,
    deleteTransfer,
    updateTransferStatus,
    getClientsForDropdown,
    deleteTransferDocument,
    getTransferDocumentUrl,
    type MoneyTransfer
} from "@/app/actions/manage-transfers"

interface TransferDocument {
    title: string
    path: string
    name: string
    type: string
    size: number
    storage: 'r2' | 'images'
}

interface ClientProfile {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
}

export default function MoneyTransfersPage() {
    // Main Data State
    const [transfers, setTransfers] = useState<MoneyTransfer[]>([])
    const [clients, setClients] = useState<ClientProfile[]>([])
    
    // UI State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [searchClientTerm, setSearchClientTerm] = useState('')
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
    
    // Pagination & Filters
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processing' | 'available' | 'completed' | 'cancelled'>('all')

    // Dates (Local Time Safe)
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
    const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null)
    const [docsViewerTransfer, setDocsViewerTransfer] = useState<MoneyTransfer | null>(null)
    const [viewingBeneficiary, setViewingBeneficiary] = useState<MoneyTransfer | null>(null)

    // Form Data
    const [formData, setFormData] = useState({
        client_id: "",
        amount_sent: "",      // EUR
        exchange_rate: "",
        amount_received: "",  // PEN
        commission: "",       // EUR
        total_amount: "",     // EUR
        on_account: "",       // EUR
        balance: "",          // EUR
        beneficiary_name: "",
        beneficiary_document: "",
        beneficiary_phone: "",
        beneficiary_bank: "",
        beneficiary_account: "",
        transfer_code: "",
        status: "pending"
    })

    // File Upload State
    const [numDocs, setNumDocs] = useState(0)
    const [documentInputs, setDocumentInputs] = useState<{title: string, file: File | null}[]>([])
    const [existingDocuments, setExistingDocuments] = useState<TransferDocument[]>([])

    // Load Data Effect
    const loadData = useCallback(async () => {
        setIsLoading(true)
        const [transfersData, clientsData] = await Promise.all([
            getTransfers(),
            getClientsForDropdown()
        ])
        setTransfers(transfersData as unknown as MoneyTransfer[])
        setClients(clientsData as unknown as ClientProfile[])
        setIsLoading(false)
    }, [])

    useEffect(() => {
        let mounted = true
        // Delay slightly to avoid synchronous setState warning during strict mode double-invoke or mounting
        const timer = setTimeout(() => {
            if (mounted) loadData()
        }, 0)
        return () => { 
            mounted = false
            clearTimeout(timer)
        }
    }, [loadData])



    // Handlers
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        
        // Restriction for numeric fields (Decimals allowed)
        if (['amount_sent', 'exchange_rate', 'commission', 'on_account'].includes(name)) {
             if (!/^\d*\.?\d*$/.test(value)) return
        }

        // Restriction for integer-like fields (Phone, Account - Numbers only, no letters)
        // Allowing "-" for account formatting ease if needed, but strict numbers requested?
        // User said "escribo letras... esta mal". I will block everything except digits.
        if (['beneficiary_phone', 'beneficiary_account'].includes(name)) {
            if (!/^\d*$/.test(value)) return
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value }
            
            // Recalculate derived fields
            const sent = parseFloat(newData.amount_sent) || 0
            const rate = parseFloat(newData.exchange_rate) || 0
            const commission = parseFloat(newData.commission) || 0
            const onAccount = parseFloat(newData.on_account) || 0

            const received = (sent * rate).toFixed(2)
            const total = (sent + commission).toFixed(2)
            const balance = (parseFloat(total) - onAccount).toFixed(2)

            return {
                ...newData,
                amount_received: received,
                total_amount: total,
                balance: balance
            }
        })
    }

    const handleNumDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value) || 0
        if (val < 0 || val > 5) return // Limit 5

        setNumDocs(val)
        // Adjust inputs array size
        setDocumentInputs(prev => {
            if (val > prev.length) {
                // Add
                const newItems = Array.from({ length: val - prev.length }, () => ({ title: "", file: null }))
                return [...prev, ...newItems]
            } else {
                // Remove
                return prev.slice(0, val)
            }
        })
    }

    const handleDocInputChange = (index: number, field: 'title' | 'file', value: string | File | null) => {
        const newInputs = [...documentInputs]
        if (field === 'title') newInputs[index].title = value as string
        else newInputs[index].file = value as File | null
        setDocumentInputs(newInputs)
    }

    const resetForm = () => {
        setFormData({
            client_id: "",
            amount_sent: "",
            exchange_rate: "",
            amount_received: "",
            commission: "",
            total_amount: "",
            on_account: "",
            balance: "",
            beneficiary_name: "",
            beneficiary_document: "",
            beneficiary_phone: "",
            beneficiary_bank: "",
            beneficiary_account: "",
            transfer_code: "",
            status: "pending"
        })
        setSelectedTransferId(null)
        setNumDocs(0)
        setDocumentInputs([])
        setExistingDocuments([])
        setSearchClientTerm('')
    }

    const handleEdit = (transfer: MoneyTransfer) => {
        setSelectedTransferId(transfer.id)
        setFormData({
            client_id: transfer.client_id,
            amount_sent: transfer.amount_sent.toString(),
            exchange_rate: transfer.exchange_rate.toString(),
            amount_received: transfer.amount_received.toString(),
            commission: transfer.commission.toString(),
            total_amount: transfer.total_amount.toString(),
            on_account: transfer.on_account.toString(),
            balance: transfer.balance.toString(),
            beneficiary_name: transfer.beneficiary_name || "",
            beneficiary_document: transfer.beneficiary_document || "",
            beneficiary_phone: transfer.beneficiary_phone || "",
            beneficiary_bank: transfer.beneficiary_bank || "",
            beneficiary_account: transfer.beneficiary_account || "",
            transfer_code: transfer.transfer_code || "",
            status: transfer.status
        })
        
        // Find client name for search input
        const cl = clients.find(c => c.id === transfer.client_id)
        if (cl) setSearchClientTerm(`${cl.first_name} ${cl.last_name}`)
        
        if (transfer.documents) {
            setExistingDocuments(transfer.documents)
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

        if (selectedTransferId) {
            payload.append('id', selectedTransferId)
        }

        // Files
        documentInputs.forEach((doc, index) => {
            if (doc.file) {
                payload.append(`document_title_${index}`, doc.title)
                payload.append(`document_file_${index}`, doc.file)
            }
        })

        const result = selectedTransferId 
            ? await updateTransfer(payload)
            : await createTransfer(payload)

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
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: newStatus as MoneyTransfer['status'] } : t))
        
        const result = await updateTransferStatus(id, newStatus)
        if (result.error) {
            alert("Error updating status")
            loadData() // Revert
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este giro? Se borrarán los archivos adjuntos.")) return
        const result = await deleteTransfer(id)
        if (!result.error) loadData()
    }

    // Filter Logic
    const filteredTransfers = useMemo(() => {
        return transfers.filter(t => {
            // Search
            const lower = searchTerm.toLowerCase()
            const matchesSearch = !searchTerm || 
                t.transfer_code?.toLowerCase().includes(lower) ||
                t.beneficiary_name?.toLowerCase().includes(lower) ||
                t.profiles?.first_name?.toLowerCase().includes(lower) ||
                t.profiles?.last_name?.toLowerCase().includes(lower)

            // Status
            const matchesStatus = statusFilter === 'all' || t.status === statusFilter

            // Date
            const transferDate = new Date(t.created_at).toISOString().split('T')[0]
            const matchesDateFrom = !dateFrom || transferDate >= dateFrom
            const matchesDateTo = !dateTo || transferDate <= dateTo

            return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
        })
    }, [transfers, searchTerm, statusFilter, dateFrom, dateTo])

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    const currentItems = filteredTransfers.slice(indexOfFirstItem, indexOfLastItem)
    const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage)

    const handleExportExcel = () => {
        const data = filteredTransfers.map(t => ({
            Fecha_Registro: new Date(t.created_at).toLocaleDateString('es-PE'),
            Codigo: t.transfer_code,
            Cliente: `${t.profiles?.first_name} ${t.profiles?.last_name}`,
            Beneficiario: t.beneficiary_name,
            Enviado_EUR: t.amount_sent,
            Tasa: t.exchange_rate,
            Recibido_PEN: t.amount_received,
            Total_EUR: t.total_amount,
            A_Cuenta_EUR: t.on_account,
            Saldo_EUR: t.balance,
            Estado: t.status
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Giros")
        XLSX.writeFile(wb, "Giros_Chimivuelos.xlsx")
    }

    // Docs Helpers
    const handleDownload = async (doc: TransferDocument) => {
        const url = await getTransferDocumentUrl(doc.path, doc.storage || 'r2')
        if (typeof url === 'string') {
             window.open(url, '_blank')
        } else {
            alert('Error al obtener URL del documento')
        }
    }

    return (
        <div className="space-y-6">
            
            {/* Header Area with Add Button centered */}
            <div className="flex items-center justify-center">
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                         <Button onClick={() => { resetForm(); setIsDialogOpen(true) }} className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 gap-2 font-bold shadow-md border-none">
                            <Plus className="h-4 w-4" />
                            Registrar Giro
                        </Button>
                    </DialogTrigger>
                    
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden">
                        <DialogHeader>
                            <DialogTitle>{selectedTransferId ? 'Editar Giro' : 'Registrar Nuevo Giro'}</DialogTitle>
                            <DialogDescription>
                                Ingrese los detalles del envío de dinero.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                            {/* Client Selection (Searchable) */}
                             <div className="grid gap-2 relative">
                                <Label>Cliente <span className="text-red-500">*</span></Label>
                                <Input 
                                    placeholder="Buscar cliente..." 
                                    value={searchClientTerm}
                                    onChange={(e) => {
                                        setSearchClientTerm(e.target.value)
                                        setIsClientDropdownOpen(true)
                                        if (e.target.value === '') {
                                            setFormData(prev => ({ ...prev, client_id: '' }))
                                        }
                                    }}
                                    onFocus={() => {}} // Remove auto-open on focus
                                    onClick={() => !selectedTransferId && setIsClientDropdownOpen(true)} // Open on click instead, ONLY if not editing
                                    onBlur={() => setTimeout(() => setIsClientDropdownOpen(false), 200)}
                                    required={!formData.client_id}
                                    disabled={!!selectedTransferId} // Lock if editing
                                    className={selectedTransferId ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""}
                                />
                                {isClientDropdownOpen && (
                                    <div className="absolute top-[70px] z-50 w-full max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg">
                                        {clients.filter(c => {
                                            if (!searchClientTerm) return true
                                            const term = searchClientTerm.toLowerCase()
                                            return c.first_name?.toLowerCase().includes(term) || 
                                                   c.last_name?.toLowerCase().includes(term) ||
                                                   c.email?.toLowerCase().includes(term)
                                        }).map(client => (
                                            <div 
                                                key={client.id}
                                                className="px-3 py-2 cursor-pointer hover:bg-slate-50 text-sm"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, client_id: client.id }))
                                                    setSearchClientTerm(`${client.first_name} ${client.last_name}`)
                                                    setIsClientDropdownOpen(false)
                                                }}
                                            >
                                                <div className="font-medium">{client.first_name} {client.last_name}</div>
                                                <div className="text-xs text-slate-500">{client.email}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Two Column Layout: Economic & Beneficiary */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* Financials (Left) */}
                                <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                    <h3 className="font-semibold text-slate-700 text-sm">Detalles Económicos</h3>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="grid gap-2">
                                            <Label>Monto Enviado (€)</Label>
                                            <Input name="amount_sent" type="number" step="0.01" value={formData.amount_sent} onChange={handleInputChange} required />
                                        </div>
                                         <div className="grid gap-2">
                                            <Label>Tasa Cambio</Label>
                                            <Input name="exchange_rate" type="number" step="0.0001" value={formData.exchange_rate} onChange={handleInputChange} required />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="text-slate-700 font-bold">Monto a Recibir (S/)</Label>
                                        <Input name="amount_received" value={formData.amount_received} readOnly className="bg-slate-100 border-slate-200 font-bold text-slate-800" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="grid gap-2">
                                            <Label>Comisión (€)</Label>
                                            <Input name="commission" type="number" step="0.01" value={formData.commission} onChange={handleInputChange} />
                                        </div>
                                         <div className="grid gap-2">
                                            <Label>Total a Pagar (€)</Label>
                                            <Input name="total_amount" value={formData.total_amount} readOnly className="bg-slate-100 font-semibold" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="grid gap-2">
                                            <Label>A Cuenta (€)</Label>
                                            <Input name="on_account" type="number" step="0.01" value={formData.on_account} onChange={handleInputChange} />
                                        </div>
                                         <div className="grid gap-2">
                                            <Label>Saldo (€)</Label>
                                            <Input name="balance" value={formData.balance} readOnly className={`bg-slate-100 font-bold ${Number(formData.balance) > 0 ? 'text-red-600' : 'text-slate-600'}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Beneficiary (Right) */}
                                <div className="space-y-4 border p-4 rounded-md bg-white">
                                    <h3 className="font-semibold text-slate-700 text-sm">Datos del Beneficiario</h3>
                                    
                                    <div className="grid gap-2">
                                        <Label>Nombre Completo</Label>
                                        <Input name="beneficiary_name" value={formData.beneficiary_name} onChange={handleInputChange} required />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                         <div className="grid gap-2">
                                            <Label>DNI / Pasaporte</Label>
                                            <Input name="beneficiary_document" value={formData.beneficiary_document} onChange={handleInputChange} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Teléfono</Label>
                                            <Input name="beneficiary_phone" value={formData.beneficiary_phone} onChange={handleInputChange} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                         <div className="grid gap-2">
                                            <Label>Banco</Label>
                                            <Input name="beneficiary_bank" value={formData.beneficiary_bank} onChange={handleInputChange} placeholder="Ej. BCP" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Nº Cuenta / CCI</Label>
                                            <Input name="beneficiary_account" value={formData.beneficiary_account} onChange={handleInputChange} />
                                        </div>
                                    </div>


                                    
                                    <div className="grid gap-2">
                                        <Label>Estado</Label>
                                        <select 
                                            name="status"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-chimiteal"
                                        >
                                            <option value="pending">Pendiente (Recibido)</option>
                                            <option value="processing">En Proceso (Enviando)</option>
                                            <option value="available">Disponible (Para Cobro)</option>
                                            <option value="completed">Completado (Entregado)</option>
                                            <option value="cancelled">Cancelado</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Documents Section */}
                             <div className="space-y-4 border-t pt-4">
                                <Label className="block mb-2 font-bold text-slate-700">Comprobantes / Vouchers</Label>
                                
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
                                                                if (selectedTransferId) {
                                                                    await deleteTransferDocument(selectedTransferId, doc.path)
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
                                    <Label>¿Cuántos documentos nuevos?</Label>
                                    <Input 
                                        type="number" 
                                        min="0" 
                                        max="5" 
                                        className="w-20"
                                        value={numDocs}
                                        onChange={handleNumDocsChange}
                                    />
                                </div>

                                {/* New Files */}
                                {documentInputs.map((input, index) => (
                                    <div key={index} className="grid grid-cols-2 gap-4 mb-2 p-3 bg-slate-50 rounded border border-slate-200">
                                        <div>
                                            <Label className="text-xs">Título (Opcional)</Label>
                                            <Input 
                                                value={input.title}
                                                onChange={e => handleDocInputChange(index, 'title', e.target.value)}
                                                placeholder="Ej. Voucher Depósito"
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
                                    {isLoading ? 'Guardando...' : (selectedTransferId ? 'Actualizar Giro' : 'Guardar Giro')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                 </Dialog>
            </div>

            {/* Beneficiary Details Modal */}
            <Dialog open={!!viewingBeneficiary} onOpenChange={(open) => !open && setViewingBeneficiary(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Datos del Beneficiario</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid gap-1">
                            <Label className="text-slate-500 text-xs uppercase">Nombre Completo</Label>
                            <div className="font-medium text-slate-900">{viewingBeneficiary?.beneficiary_name}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1">
                                <Label className="text-slate-500 text-xs uppercase">Documento</Label>
                                <div className="font-medium text-slate-900">{viewingBeneficiary?.beneficiary_document || '-'}</div>
                            </div>
                             <div className="grid gap-1">
                                <Label className="text-slate-500 text-xs uppercase">Teléfono</Label>
                                <div className="font-medium text-slate-900">{viewingBeneficiary?.beneficiary_phone || '-'}</div>
                            </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-1">
                                <Label className="text-slate-500 text-xs uppercase">Banco</Label>
                                <div className="font-medium text-slate-900">{viewingBeneficiary?.beneficiary_bank || '-'}</div>
                            </div>
                             <div className="grid gap-1">
                                <Label className="text-slate-500 text-xs uppercase">Cuenta / CCI</Label>
                                <div className="font-medium text-slate-900 break-all">{viewingBeneficiary?.beneficiary_account || '-'}</div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Docs Viewer Modal */}
            <Dialog open={!!docsViewerTransfer} onOpenChange={(open) => !open && setDocsViewerTransfer(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Documentos Adjuntos</DialogTitle>
                        <DialogDescription>
                             Archivos del giro {docsViewerTransfer?.transfer_code || 'seleccionado'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        {docsViewerTransfer?.documents && docsViewerTransfer.documents.length > 0 ? (
                            docsViewerTransfer.documents.map((doc, idx) => (
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
                                No hay documentos adjuntos.
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
                                placeholder="Buscar por código, beneficiario..." 
                                className="pl-10 border-slate-200 bg-white focus:ring-chimiteal"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                            />
                        </div>
                        
                        <select 
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as MoneyTransfer['status'] | 'all')}
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendiente</option>
                            <option value="processing">En Proceso</option>
                            <option value="available">Disponible</option>
                            <option value="completed">Completado</option>
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
                            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
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
                                    <th className="px-6 py-4 font-medium">Código</th>
                                    <th className="px-6 py-4 font-medium">Cliente</th>
                                    <th className="px-6 py-4 font-medium">Beneficiario</th>
                                    <th className="px-6 py-4 font-medium">Enviado (€)</th>
                                    <th className="px-6 py-4 font-medium">Comisión (€)</th>
                                    <th className="px-6 py-4 font-medium">Total (€)</th>
                                    <th className="px-6 py-4 font-medium">Tasa</th>
                                    <th className="px-6 py-4 font-medium text-emerald-700">Recibido (S/)</th>
                                    <th className="px-6 py-4 font-medium">A Cuenta (€)</th>
                                    <th className="px-6 py-4 font-medium">Saldo (€)</th>
                                    <th className="px-6 py-4 font-medium text-center">Docs</th>
                                    <th className="px-6 py-4 font-medium">Estado</th>
                                    <th className="px-6 py-4 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="py-8 text-center text-slate-500">
                                            No se encontraron giros.
                                        </td>
                                    </tr>
                                ) : (
                                    currentItems.map((transfer) => (
                                        <tr key={transfer.id} className="bg-white hover:bg-slate-50/50">
                                             <td className="px-6 py-4 text-xs text-slate-500">
                                                {new Date(transfer.created_at).toLocaleDateString('es-PE')}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-slate-600">{transfer.transfer_code || '-'}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900">{transfer.profiles?.first_name} {transfer.profiles?.last_name}</div>
                                                <div className="text-xs text-slate-500">{transfer.profiles?.email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => setViewingBeneficiary(transfer)}
                                                    className="font-medium text-chimiteal hover:underline text-left"
                                                >
                                                    {transfer.beneficiary_name}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">€ {transfer.amount_sent.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">€ {transfer.commission.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap font-semibold">€ {transfer.total_amount.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">{transfer.exchange_rate.toFixed(4)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-emerald-700">S/ {transfer.amount_received.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">€ {transfer.on_account.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">
                                                <span className={transfer.balance > 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>
                                                     € {transfer.balance.toFixed(2)}
                                                </span>
                                            </td>
                                             <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center">
                                                    {transfer.documents && transfer.documents.length > 0 ? (
                                                        <Button size="sm" variant="ghost" className="text-chimiteal hover:bg-teal-50" onClick={() => setDocsViewerTransfer(transfer)}>
                                                            <FolderOpen className="h-5 w-5" />
                                                            <span className="ml-1 text-xs">{transfer.documents.length}</span>
                                                        </Button>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={transfer.status}
                                                    onChange={(e) => handleStatusChange(transfer.id, e.target.value)}
                                                    className={`
                                                        px-2 py-1 rounded-full text-xs font-medium border-none focus:ring-0 cursor-pointer w-36 text-center
                                                        ${transfer.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                                                          transfer.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                                                          transfer.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                                                          transfer.status === 'available' ? 'bg-purple-100 text-purple-700' :
                                                          'bg-amber-100 text-amber-700'}
                                                    `}
                                                >
                                                    <option value="pending">Pendiente (Recibido)</option>
                                                    <option value="processing">En Proceso (Enviando)</option>
                                                    <option value="available">Disponible (Para Cobro)</option>
                                                    <option value="completed">Completado (Entregado)</option>
                                                    <option value="cancelled">Cancelado</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(transfer)} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(transfer.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50">
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
                    {filteredTransfers.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 bg-slate-50/50 flex-wrap gap-4">
                            <div className="text-xs text-slate-500">
                                Mostrando <span className="font-medium">{Math.min(indexOfFirstItem + 1, filteredTransfers.length)}</span> - <span className="font-medium">{Math.min(indexOfLastItem, filteredTransfers.length)}</span> de <span className="font-medium">{filteredTransfers.length}</span> resultados
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
