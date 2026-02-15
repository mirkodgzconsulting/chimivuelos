'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Trash2, Edit, FileText, Download, FolderOpen, X, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getFlights, getClientsForDropdown, createFlight, updateFlight, deleteFlight, deleteFlightDocument, updateFlightStatus, getFlightDocumentUrl } from '@/app/actions/manage-flights'

interface FlightDocument {
    title: string
    path: string
    name: string
    type: string
    size: number
    storage: 'r2' | 'images'
}

interface Flight {
    id: string
    client_id: string
    created_at: string
    travel_date: string
    pnr: string
    itinerary: string
    cost: number
    on_account: number
    balance: number
    status: 'pending' | 'finished'
    documents: FlightDocument[]
    profiles: any
}

interface ClientOption {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
}

export default function FlightsPage() {
    const [flights, setFlights] = useState<Flight[]>([])
    const [clients, setClients] = useState<ClientOption[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Filters State
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'finished'>('all')
    
    // Initialize dates to current month (Local Time Safe)
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

    // Docs Viewer State
    const [docsViewerFlight, setDocsViewerFlight] = useState<Flight | null>(null)

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

    // Form Data
    const [formData, setFormData] = useState({
        client_id: '',
        client_email: '',
        client_phone: '',
        travel_date: '',
        pnr: '',
        itinerary: '',
        cost: '',
        on_account: '',
        balance: '',
        status: 'pending',
    })

    // Dynamic Documents State
    const [numDocs, setNumDocs] = useState(0)
    const [documentInputs, setDocumentInputs] = useState<{ title: string, file: File | null }[]>([])
    
    // Existing Docs (Load separate from form data)
    const [existingDocs, setExistingDocs] = useState<FlightDocument[]>([])

    // Client Selector State
    const [clientSearch, setClientSearch] = useState('')
    const [showClientList, setShowClientList] = useState(false)

    // Load Data
    const loadData = useCallback(async () => {
        const flightsData = await getFlights()
        const clientsData = await getClientsForDropdown()
        setFlights(flightsData as unknown as Flight[])
        setClients(clientsData as unknown as ClientOption[])
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    // Handle Input Change (Manual)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        
        const newFormData = { ...formData, [name]: value }

        // Auto-calculate Balance if cost or on_account changes
        if (name === 'cost' || name === 'on_account') {
            const cost = parseFloat(name === 'cost' ? value : formData.cost) || 0
            const onAccount = parseFloat(name === 'on_account' ? value : formData.on_account) || 0
            newFormData.balance = (cost - onAccount).toFixed(2)
        }

        setFormData(newFormData)
    }

    // Handle Client Selection
    const selectClient = (client: ClientOption) => {
        setFormData(prev => ({
            ...prev,
            client_id: client.id,
            client_email: client.email || '',
            client_phone: client.phone || ''
        }))
        setClientSearch(`${client.first_name} ${client.last_name}`)
        setShowClientList(false)
    }

    // Handle Document Count Change
    const handleNumDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const count = parseInt(e.target.value) || 0
        if (count > 5) {
            alert('Máximo 5 documentos')
            return
        }
        setNumDocs(count)
        
        setDocumentInputs(prev => {
            const newInputs = [...prev]
            if (count > prev.length) {
                // Add
                for (let i = prev.length; i < count; i++) {
                    newInputs.push({ title: '', file: null })
                }
            } else {
                // Remove
                newInputs.splice(count)
            }
            return newInputs
        })
    }

    // Handle Document Input Change
    const handleDocInputChange = (index: number, field: 'title' | 'file', value: string | File | null) => {
        setDocumentInputs(prev => {
            const newInputs = [...prev]
            newInputs[index] = { ...newInputs[index], [field]: value }
            return newInputs
        })
    }

    const resetForm = () => {
        setFormData({
            client_id: '',
            client_email: '',
            client_phone: '',
            travel_date: '',
            pnr: '',
            itinerary: '',
            cost: '',
            on_account: '',
            balance: '',
            status: 'pending',
        })
        setNumDocs(0)
        setDocumentInputs([])
        setExistingDocs([])
        setClientSearch('')
        setSelectedFlightId(null)
    }

    const handleEdit = (flight: Flight) => {
        if (!flight.profiles) return 
        
        setFormData({
            client_id: flight.client_id,
            client_email: flight.profiles.email || '',
            client_phone: flight.profiles.phone || '',
            travel_date: flight.travel_date,
            pnr: flight.pnr || '',
            itinerary: flight.itinerary || '',
            cost: flight.cost.toString(),
            on_account: flight.on_account.toString(),
            balance: flight.balance.toString(),
            status: flight.status,
        })
        setClientSearch(`${flight.profiles.first_name} ${flight.profiles.last_name}`)
        setExistingDocs(flight.documents || [])
        setDocumentInputs([])
        setNumDocs(0)
        setSelectedFlightId(flight.id)
        setIsDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
         if (confirm('¿Eliminar vuelo? Se borrarán todos los documentos asociados.')) {
             await deleteFlight(id)
             loadData()
         }
    }

    const deleteDoc = async (path: string) => {
        if (!selectedFlightId) return
        if (confirm('¿Eliminar este documento?')) {
             await deleteFlightDocument(selectedFlightId, path)
             // Update local state without reload
             setExistingDocs(prev => prev.filter(d => d.path !== path))
             loadData() // Refresh list later
        }
    }

    const handleStatusChange = async (id: string, newStatus: string) => {
        // Optimistic update locally first for speed
        setFlights(prev => prev.map(f => f.id === id ? { ...f, status: newStatus as any } : f))
        await updateFlightStatus(id, newStatus)
        // No need to reload all data if successful, but loadData ensures sync
    }

    const handleDownload = async (path: string, storage: 'r2' | 'images') => {
        const result = await getFlightDocumentUrl(path, storage)
        if (result.url) {
            window.open(result.url, '_blank')
        } else {
            alert('Error al abrir el documento. Intente nuevamente.')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!formData.client_id) {
            alert('Seleccione un cliente')
            return
        }

        const data = new FormData()
        if (selectedFlightId) data.append('id', selectedFlightId)
        
        // Append main fields
        Object.entries(formData).forEach(([key, val]) => {
            data.append(key, val)
        })

        // Append Documents
        documentInputs.forEach((doc, idx) => {
             if (doc.file) {
                 data.append(`document_title_${idx}`, doc.title)
                 data.append(`document_file_${idx}`, doc.file)
             }
        })

        if (selectedFlightId) {
             await updateFlight(data)
        } else {
             await createFlight(data)
        }

        setIsDialogOpen(false)
        resetForm()
        loadData()
    }

    const handleExportExcel = () => {
        const dataToExport = filteredFlights.map(f => ({
            Fecha_Registro: new Date(f.created_at).toLocaleDateString('es-PE'),
            Fecha_Viaje: new Date(f.travel_date).toLocaleDateString('es-PE'),
            PNR: f.pnr,
            Cliente: `${f.profiles?.first_name} ${f.profiles?.last_name}`,
            Email: f.profiles?.email,
            Itinerario: f.itinerary,
            Costo: f.cost,
            A_Cuenta: f.on_account,
            Saldo: f.balance,
            Estado: f.status === 'finished' ? 'Terminado' : 'Pendiente'
        }))
        const worksheet = XLSX.utils.json_to_sheet(dataToExport)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Vuelos")
        XLSX.writeFile(workbook, "Vuelos_Chimivuelos.xlsx")
    }

    // Handle Pagination Change
    const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setItemsPerPage(Number(e.target.value))
        setCurrentPage(1)
    }

    // Filtered Clients Logic
    const filteredClients = useMemo(() => {
        if (!clientSearch) return clients
        return clients.filter(c => 
            c.first_name?.toLowerCase().includes(clientSearch.toLowerCase()) || 
            c.last_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
            c.email?.toLowerCase().includes(clientSearch.toLowerCase())
        )
    }, [clientSearch, clients])

    // Filtered Flights Logic
    const filteredFlights = useMemo(() => {
        return flights.filter(f => {
            // Text Search
            const lower = searchTerm.toLowerCase()
            const matchesSearch = !searchTerm || 
                f.pnr?.toLowerCase().includes(lower) ||
                f.profiles?.first_name?.toLowerCase().includes(lower) ||
                f.profiles?.last_name?.toLowerCase().includes(lower)

            // Status Filter
            const matchesStatus = statusFilter === 'all' || f.status === statusFilter

            // Date Range Filter (Based on created_at / Fecha Registro)
            // Normalize dates to YYYY-MM-DD for comparison
            const flightDate = new Date(f.created_at).toISOString().split('T')[0]
            const matchesDateFrom = !dateFrom || flightDate >= dateFrom
            const matchesDateTo = !dateTo || flightDate <= dateTo

            return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
        })
    }, [flights, searchTerm, statusFilter, dateFrom, dateTo])

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    const currentFlights = filteredFlights.slice(indexOfFirstItem, indexOfLastItem)
    const totalPages = Math.ceil(filteredFlights.length / itemsPerPage)

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

    return (
        <div className="space-y-6">
            {/* Modal for Viewing Documents */}
            <Dialog open={!!docsViewerFlight} onOpenChange={(open) => !open && setDocsViewerFlight(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Documentos del Vuelo</DialogTitle>
                        <DialogDescription>
                            PNR: {docsViewerFlight?.pnr} - {docsViewerFlight?.profiles?.first_name} {docsViewerFlight?.profiles?.last_name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        {docsViewerFlight?.documents && docsViewerFlight.documents.length > 0 ? (
                            docsViewerFlight.documents.map((doc, idx) => (
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
                                    <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-800" onClick={() => handleDownload(doc.path, doc.storage)}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-6 text-slate-500 text-sm">
                                No hay documentos adjuntos a este vuelo.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex justify-center">
                 <Dialog open={isDialogOpen} onOpenChange={(open) => {
                     setIsDialogOpen(open)
                     if (!open) resetForm()
                 }}>
                    <DialogTrigger asChild>
                        <Button className="bg-linear-to-r from-chimipink to-chimicyan font-bold text-slate-700 shadow-md">
                            <Plus className="mr-2 h-4 w-4" /> Registrar Vuelo
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
                        <DialogHeader>
                            <DialogTitle>{selectedFlightId ? 'Editar Vuelo' : 'Registrar Nuevo Vuelo'}</DialogTitle>
                            <DialogDescription>Ingrese los detalles del viaje.</DialogDescription>
                        </DialogHeader>
                        
                        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                            {/* Client Search */}
                            <div className="grid gap-2 relative">
                                <Label>Cliente <span className="text-red-500">*</span></Label>
                                <Input 
                                    placeholder="Buscar cliente..." 
                                    value={clientSearch}
                                    onChange={(e) => {
                                        setClientSearch(e.target.value)
                                        setShowClientList(true)
                                    }}
                                    onFocus={() => setShowClientList(true)}
                                    onBlur={() => setTimeout(() => setShowClientList(false), 200)}
                                    // Disable search if editing to lock client? (Optional, user didn't specify edit lock. Assume editable but careful)
                                    disabled={!!selectedFlightId} 
                                />
                                {showClientList && filteredClients.length > 0 && !selectedFlightId && (
                                    <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-lg rounded-md mt-1 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                                        {filteredClients.map(client => (
                                            <div 
                                                key={client.id}
                                                className="p-2 hover:bg-slate-50 cursor-pointer text-sm"
                                                onClick={() => selectClient(client)}
                                            >
                                                <div className="font-medium">{client.first_name} {client.last_name}</div>
                                                <div className="text-xs text-slate-500">{client.email}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Auto-filled Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Correo</Label>
                                    <Input value={formData.client_email} readOnly className="bg-slate-50 text-slate-500" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Teléfono</Label>
                                    <Input value={formData.client_phone} readOnly className="bg-slate-50 text-slate-500" />
                                </div>
                            </div>
                            
                            {/* Flight Details */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                     <Label>Fecha de Viaje</Label>
                                     <Input type="date" name="travel_date" value={formData.travel_date} onChange={handleInputChange} required />
                                </div>
                                <div className="grid gap-2">
                                     <Label>PNR</Label>
                                     <Input name="pnr" value={formData.pnr} onChange={handleInputChange} placeholder="Código de reserva" />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Itinerario</Label>
                                <Input 
                                    name="itinerary"
                                    value={formData.itinerary}
                                    onChange={handleInputChange}
                                    placeholder="Ej. EZE - MAD - EZE"
                                />
                            </div>

                            {/* Financials */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label>Costo</Label>
                                    <Input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleInputChange} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>A Cuenta</Label>
                                    <Input type="number" step="0.01" name="on_account" value={formData.on_account} onChange={handleInputChange} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Saldo</Label>
                                    <Input type="number" step="0.01" name="balance" value={formData.balance} onChange={handleInputChange} />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Estado de Viaje</Label>
                                <select 
                                    name="status"
                                    className="w-full border rounded-md p-2 text-sm bg-white"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                >
                                    <option value="pending">Pendiente</option>
                                    <option value="finished">Terminado</option>
                                </select>
                            </div>
                            
                            {/* Documents Section */}
                            <div className="border-t border-slate-100 my-2 pt-4">
                                <Label className="block mb-2 font-bold text-slate-700">Documentos de Viaje</Label>
                                
                                {existingDocs.length > 0 && (
                                     <div className="mb-4 space-y-2">
                                         <p className="text-xs font-semibold text-slate-500">Archivos Cargados:</p>
                                         {existingDocs.map((doc, idx) => (
                                             <div key={idx} className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded text-sm">
                                                 <span className="font-medium truncate max-w-[200px]">{doc.title || doc.name}</span>
                                                 <div className="flex gap-2">
                                                     <Button type="button" variant="ghost" size="sm" onClick={() => handleDownload(doc.path, doc.storage)}><FileText className="h-4 w-4" /></Button>
                                                     <Button type="button" variant="ghost" size="sm" onClick={() => deleteDoc(doc.path)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
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

                                {documentInputs.map((input, idx) => (
                                    <div key={idx} className="grid grid-cols-2 gap-4 mb-2 p-3 bg-slate-50 rounded border border-slate-200">
                                        <div>
                                            <Label className="text-xs">Título del Archivo</Label>
                                            <Input 
                                                value={input.title} 
                                                onChange={(e) => handleDocInputChange(idx, 'title', e.target.value)}
                                                placeholder="Ej. Ticket Aéreo"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Archivo</Label>
                                            <Input 
                                                type="file" 
                                                onChange={(e) => handleDocInputChange(idx, 'file', e.target.files?.[0] || null)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <DialogFooter>
                                <Button type="submit" className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 w-full sm:w-auto font-bold shadow-md">
                                    {selectedFlightId ? 'Actualizar Vuelo' : 'Guardar Vuelo'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                 </Dialog>
            </div>

            {/* Flights List Card */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50">
                    
                    {/* Filters Group */}
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-1">
                        <div className="relative min-w-[200px] flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input 
                                placeholder="Buscar por PNR o nombre..." 
                                className="pl-10 border-slate-200 bg-white focus:ring-chimiteal"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    setCurrentPage(1) 
                                }}
                            />
                        </div>
                        
                        <select 
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendiente</option>
                            <option value="finished">Terminado</option>
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

                    {/* Actions Group */}
                     <div className="flex items-center gap-2">
                        <select 
                        className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer w-24"
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChange}
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <Button variant="outline" onClick={handleExportExcel} className="gap-2 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900">
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
                                    <th className="px-6 py-4 font-medium">Fecha Registro</th>
                                    <th className="px-6 py-4 font-medium">Fecha Viaje</th>
                                    <th className="px-6 py-4 font-medium">PNR</th>
                                    <th className="px-6 py-4 font-medium">Cliente</th>
                                    <th className="px-6 py-4 font-medium">Itinerario</th>
                                    <th className="px-6 py-4 font-medium">Costo</th>
                                    <th className="px-6 py-4 font-medium">A Cuenta</th>
                                    <th className="px-6 py-4 font-medium">Saldo</th>
                                    <th className="px-6 py-4 font-medium text-center">Docs</th>
                                    <th className="px-6 py-4 font-medium">Estado</th>
                                    <th className="px-6 py-4 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentFlights.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-6 py-8 text-center text-slate-500">No se encontraron vuelos.</td>
                                    </tr>
                                ) : (
                                    currentFlights.map((flight) => (
                                        <tr key={flight.id} className="bg-white hover:bg-slate-50/50">
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {new Date(flight.created_at).toLocaleDateString('es-PE')}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-700">{new Date(flight.travel_date).toLocaleDateString('es-PE')}</td>
                                            <td className="px-6 py-4 font-mono text-slate-600">{flight.pnr || '-'}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900">{flight.profiles?.first_name} {flight.profiles?.last_name}</div>
                                                <div className="text-xs text-slate-500">{flight.profiles?.email}</div>
                                            </td>
                                            <td className="px-6 py-4 max-w-[150px] truncate" title={flight.itinerary}>
                                                {flight.itinerary || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">S/ {flight.cost.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">S/ {flight.on_account.toFixed(2)}</td>
                                            <td className="px-6 py-4 font-medium whitespace-nowrap">
                                                {flight.balance > 0 ? (
                                                    <span className="text-red-600">S/ {flight.balance.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-emerald-600">Pagado</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {flight.documents && flight.documents.length > 0 ? (
                                                    <Button size="sm" variant="ghost" className="text-chimiteal hover:bg-teal-50" onClick={() => setDocsViewerFlight(flight)}>
                                                        <FolderOpen className="h-5 w-5" />
                                                        <span className="ml-1 text-xs">{flight.documents.length}</span>
                                                    </Button>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="relative">
                                                    <select
                                                        value={flight.status}
                                                        onChange={(e) => handleStatusChange(flight.id, e.target.value)}
                                                        className={`appearance-none px-3 py-1 pr-8 rounded-full text-xs font-semibold border-0 cursor-pointer focus:ring-2 focus:ring-offset-1 transition-colors ${
                                                            flight.status === 'finished' 
                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 focus:ring-emerald-500' 
                                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200 focus:ring-amber-500'
                                                        }`}
                                                    >
                                                        <option value="pending">Pendiente</option>
                                                        <option value="finished">Terminado</option>
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(flight)}>
                                                        <Edit className="h-4 w-4 text-slate-400" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(flight.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-400" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {filteredFlights.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 bg-slate-50/50 flex-wrap gap-4">
                            <div className="text-xs text-slate-500">
                                Mostrando <span className="font-medium">{Math.min(indexOfFirstItem + 1, filteredFlights.length)}</span> - <span className="font-medium">{Math.min(indexOfLastItem, filteredFlights.length)}</span> de <span className="font-medium">{filteredFlights.length}</span> resultados
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => paginate(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
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
