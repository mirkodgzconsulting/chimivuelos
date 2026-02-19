'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Trash2, Edit, FileText, Download, FileSpreadsheet, ChevronLeft, ChevronRight, ListChecks, Wallet, Check, X, Calendar, Building2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getFlights, getClientsForDropdown, createFlight, updateFlight, deleteFlight, deleteFlightDocument, updateFlightStatus, getFlightDocumentUrl, deleteFlightPayment, updateFlightPayment } from '@/app/actions/manage-flights'

interface FlightDocument {
    title: string
    path: string
    name: string
    type: string
    size: number
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
    created_at?: string
    updated_at?: string
    proof_path?: string
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
    return_date?: string
    sold_price: number
    fee_agv: number
    payment_method_it?: string
    payment_method_pe?: string
    details?: FlightDetails
    documents: FlightDocument[]
    profiles: {
        first_name: string
        last_name: string
        email: string
        phone: string
    } | null
    agent: {
        first_name: string
        last_name: string
    } | null
    payment_details: PaymentDetail[]
    payment_proof_path: string | null
    exchange_rate: number
}

interface ClientOption {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
}

interface FlightDetails {
    ticket_one_way: boolean
    ticket_round_trip: boolean
    insurance_1m: boolean
    insurance_2m: boolean
    insurance_3m: boolean
    doc_invitation_letter: boolean
    doc_agency_managed: boolean
    svc_airport_assistance: boolean
    svc_return_activation: boolean
    hotel_3d_2n: boolean
    hotel_2d_1n: boolean
    baggage_1pc_23kg: boolean
    baggage_2pc_23kg: boolean
    baggage_1pc_10kg: boolean
    baggage_backpack: boolean
    special_note: string
}

const DETAILS_LABELS: Record<string, string> = {
    ticket_one_way: "Pasaje solo ida",
    ticket_round_trip: "Pasaje ida y vuelta",
    insurance_1m: "Seguro x 1 mes",
    insurance_2m: "Seguro x 2 meses",
    insurance_3m: "Seguro x 3 meses",
    doc_invitation_letter: "Redacción carta invitación",
    doc_agency_managed: "Carta inv. gestionada por agencia",
    svc_airport_assistance: "Asistencia aeroportuaria",
    svc_return_activation: "Activación pasaje retorno",
    hotel_3d_2n: "Hotel 3 días / 2 noches",
    hotel_2d_1n: "Hotel 2 días / 1 noche",
    baggage_1pc_23kg: "1 pc 23kg",
    baggage_2pc_23kg: "2 pc 23kg",
    baggage_1pc_10kg: "1 pc 10kg",
    baggage_backpack: "1 Mochila",
}

const DOCUMENT_TYPES = [
    "Pasaje de Ida",
    "Pasaje de Retorno",
    "Pasaje Ida y Vuelta",
    "Itinerario de Viaje",
    "Carta de Invitación",
    "Reserva de Hotel",
    "Permiso Notarial",
    "Seguro de Viaje",
    "Otros"
]

const ITINERARY_OPTIONS = [
    "Lima - Milano - Lima",
    "Milano - Lima - Milano",
    "Roma - Lima - Roma",
    "Lima - Roma - Lima",
    "Madrid - Lima - Madrid",
    "Lima - Madrid - Lima",
    "Lima - Buenos Aires - Lima",
    "Buenos Aires - Lima - Buenos Aires",
    "Lima - Santiago - Lima",
    "Santiago - Lima - Santiago",
    "Lima - Miami - Lima",
    "Miami - Lima - Miami",
    "Lima - New York - Lima",
    "New York - Lima - New York",
    "Lima - Cusco - Lima",
    "Cusco - Lima - Cusco"
]

const SEDE_IT_OPTIONS = ["Milano", "Roma", "Firenze", "Venezia", "Torino", "Genova"]
const SEDE_PE_OPTIONS = ["Lima", "Cusco", "Arequipa", "Trujillo", "Piura", "Iquitos"]
const PAYMENT_METHOD_IT_OPTIONS = ["Efectivo", "Transferencia IT", "Tarjeta", "PayPal"]
const PAYMENT_METHOD_PE_OPTIONS = ["Efectivo", "Transferencia PE", "Yape/Plin", "Tarjeta"]

const INITIAL_FLIGHT_DETAILS: FlightDetails = {
    ticket_one_way: false,
    ticket_round_trip: false,
    insurance_1m: false,
    insurance_2m: false,
    insurance_3m: false,
    doc_invitation_letter: false,
    doc_agency_managed: false,
    svc_airport_assistance: false,
    svc_return_activation: false,
    hotel_3d_2n: false,
    hotel_2d_1n: false,
    baggage_1pc_23kg: false,
    baggage_2pc_23kg: false,
    baggage_1pc_10kg: false,
    baggage_backpack: false,
    special_note: ''
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
    const [paymentHistoryFlight, setPaymentHistoryFlight] = useState<Flight | null>(null)
    const [detailsViewerFlight, setDetailsViewerFlight] = useState<Flight | null>(null)

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
        cost: '', // Now Neto
        on_account: '',
        balance: '',
        status: 'pending',
        return_date: '',
        sold_price: '',
        fee_agv: '',
        payment_method_it: '',
        payment_method_pe: '',
        // New Payment Fields
        sede_it: '',
        sede_pe: '',
        payment_quantity: '',
        payment_exchange_rate: '1.0',
        payment_total: '',
    })

    const [showPaymentFields, setShowPaymentFields] = useState(false)
    const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)

    const [flightDetails, setFlightDetails] = useState(INITIAL_FLIGHT_DETAILS)

    // Handle Detail Change
    const handleDetailChange = (key: string, value: boolean | string) => {
        setFlightDetails(prev => ({ ...prev, [key]: value }))
    }

    // Dynamic Documents State
    const [documentInputs, setDocumentInputs] = useState<{ title: string, file: File | null }[]>(
        DOCUMENT_TYPES.map(type => ({ title: type, file: null }))
    )
    
    // Existing Docs (Load separate from form data)
    const [existingDocs, setExistingDocs] = useState<FlightDocument[]>([])

    // Client Selector State
    const [clientSearch, setClientSearch] = useState('')
    const [showClientList, setShowClientList] = useState(false)
    const [showItineraryList, setShowItineraryList] = useState(false)
    const [showSedeITList, setShowSedeITList] = useState(false)
    const [showSedePEList, setShowSedePEList] = useState(false)
    const [baseOnAccount, setBaseOnAccount] = useState(0) // Track existing payments sum

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

    // Sync Modals with data updates
    useEffect(() => {
        if (paymentHistoryFlight) {
            const updated = flights.find(f => f.id === paymentHistoryFlight.id)
            if (updated) setPaymentHistoryFlight(updated)
            else setPaymentHistoryFlight(null)
        }
        if (docsViewerFlight) {
            const updated = flights.find(f => f.id === docsViewerFlight.id)
            if (updated) setDocsViewerFlight(updated)
            else setDocsViewerFlight(null)
        }
    }, [flights, paymentHistoryFlight, docsViewerFlight])

    // Handle Input Change (Manual)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        
        const newFormData = { ...formData, [name]: value }

        // Logic for Payment Quantity -> A Cuenta
        if (name === 'payment_quantity') {
            newFormData.on_account = value
        }

        if (name === 'payment_quantity') {
            const qty = parseFloat(value) || 0
            const rate = parseFloat(newFormData.payment_exchange_rate) || 1
            newFormData.payment_total = (qty * rate).toFixed(2)
            newFormData.on_account = (baseOnAccount + qty).toString()
        }

        if (name === 'payment_exchange_rate') {
            const rate = parseFloat(value) || 1
            const qty = parseFloat(newFormData.payment_quantity) || 0
            newFormData.payment_total = (qty * rate).toFixed(2)
        }

        // Auto-calculate Balance and Fee
        if (name === 'cost' || name === 'sold_price' || name === 'on_account' || name === 'payment_quantity') {
            const neto = parseFloat(newFormData.cost) || 0
            const vendido = parseFloat(newFormData.sold_price) || 0
            const aCuenta = parseFloat(newFormData.on_account) || 0
            
            newFormData.balance = (vendido - aCuenta).toFixed(2)
            newFormData.fee_agv = (vendido - neto).toFixed(2)
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

    // Handle Document Input Change

    // Handle Document Input Change
    const handleDocInputChange = (index: number, value: File | null) => {
        setDocumentInputs(prev => {
            const newInputs = [...prev]
            newInputs[index] = { ...newInputs[index], file: value }
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
            return_date: '',
            sold_price: '',
            fee_agv: '',
            payment_method_it: '',
            payment_method_pe: '',
            sede_it: '',
            sede_pe: '',
            payment_quantity: '',
            payment_exchange_rate: '1.0',
            payment_total: '',
        })
        const initialDocs = DOCUMENT_TYPES.map(type => ({ 
            title: type, 
            file: null 
        }))
        setDocumentInputs(initialDocs)
        setExistingDocs([])
        setClientSearch('')
        setSelectedFlightId(null)
        setFlightDetails(INITIAL_FLIGHT_DETAILS)
        setShowPaymentFields(false)
        setPaymentProofFile(null)
        setBaseOnAccount(0)
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
            cost: (flight.cost || 0).toString(),
            on_account: (flight.on_account || 0).toString(),
            balance: (flight.balance || 0).toString(),
            status: flight.status,
            return_date: flight.return_date || '',
            sold_price: (flight.sold_price || 0).toString(),
            fee_agv: (flight.fee_agv || 0).toString(),
            payment_method_it: '',
            payment_method_pe: '',
            sede_it: '',
            sede_pe: '',
            payment_quantity: '',
            payment_exchange_rate: (flight.exchange_rate || 1.0).toString(),
            payment_total: '',
        })
        setBaseOnAccount(flight.on_account || 0)
        setClientSearch(`${flight.profiles.first_name} ${flight.profiles.last_name}`)
        setExistingDocs(flight.documents || [])
        setShowPaymentFields(false) 
        setSelectedFlightId(flight.id)
        
        // Initialize with fixed list
        const initialDocs = DOCUMENT_TYPES.map(type => ({ 
            title: type, 
            file: null 
        }))
        setDocumentInputs(initialDocs)
        
        let details = flight.details
        if (typeof details === 'string') {
            try {
                details = JSON.parse(details)
            } catch (e) {
                console.error("Error parsing details JSON:", e)
                details = INITIAL_FLIGHT_DETAILS
            }
        }
        setFlightDetails({ ...INITIAL_FLIGHT_DETAILS, ...(details || {}) })
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
        setFlights(prev => prev.map(f => f.id === id ? { ...f, status: newStatus as Flight['status'] } : f))
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

    const handleDeletePayment = async (flightId: string, originalIndex: number) => {
        if (confirm('¿Eliminar este registro de pago? Se actualizará el saldo automáticamente.')) {
            const res = await deleteFlightPayment(flightId, originalIndex)
            if (res.success) {
                await loadData()
            } else {
                alert('Error al eliminar el pago: ' + (res.error || ''))
            }
        }
    }

    const [editingPaymentIndex, setEditingPaymentIndex] = useState<number | null>(null)
    const [editPaymentData, setEditPaymentData] = useState<PaymentDetail | null>(null)
    const [showEditSedeITList, setShowEditSedeITList] = useState(false)
    const [showEditSedePEList, setShowEditSedePEList] = useState(false)
    const [editPaymentFile, setEditPaymentFile] = useState<File | null>(null)

    const handleSaveEditPayment = async (flightId: string) => {
        if (!editPaymentData || editingPaymentIndex === null) return
        
        const formData = new FormData()
        formData.append('flightId', flightId)
        formData.append('paymentIndex', editingPaymentIndex.toString())
        formData.append('sede_it', editPaymentData.sede_it)
        formData.append('sede_pe', editPaymentData.sede_pe)
        formData.append('metodo_it', editPaymentData.metodo_it)
        formData.append('metodo_pe', editPaymentData.metodo_pe)
        formData.append('cantidad', editPaymentData.cantidad)
        formData.append('tipo_cambio', editPaymentData.tipo_cambio.toString())
        formData.append('total', editPaymentData.total)
        
        if (editPaymentFile) {
            formData.append('proofFile', editPaymentFile)
        }

        const res = await updateFlightPayment(formData)
        if (res.success) {
            await loadData()
            setEditingPaymentIndex(null)
            setEditPaymentData(null)
            setEditPaymentFile(null)
        } else {
            alert('Error al actualizar el pago: ' + (res.error || ''))
        }
    }

    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!formData.client_id) {
            alert('Seleccione un cliente')
            return
        }

        setIsSubmitting(true)

        try {
            const data = new FormData()
            if (selectedFlightId) data.append('id', selectedFlightId)
            
            // Append main fields
            Object.entries(formData).forEach(([key, val]) => {
                data.append(key, val)
            })

            // Append Details
            data.append('details', JSON.stringify(flightDetails))

            // Append Documents
            let uploadIndex = 0
            documentInputs.forEach((doc) => {
                 if (doc.file) {
                     data.append(`document_title_${uploadIndex}`, doc.title)
                     data.append(`document_file_${uploadIndex}`, doc.file)
                     uploadIndex++
                 }
            })

            // Append Payment Proof if exists
            if (paymentProofFile) {
                data.append('payment_proof_file', paymentProofFile)
            }

            if (selectedFlightId) {
                 await updateFlight(data)
            } else {
                 await createFlight(data)
            }

            setIsDialogOpen(false)
            resetForm()
            loadData()
        } catch (error) {
            console.error(error)
            alert('Error al guardar el vuelo')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleExportExcel = () => {
        const dataToExport = filteredFlights.map(f => ({
            Fecha_Registro: new Date(f.created_at).toLocaleDateString('es-PE'),
            Fecha_Viaje: new Date(f.travel_date).toLocaleDateString('es-PE'),
            Agente: f.agent ? `${f.agent.first_name} ${f.agent.last_name}` : '-',
            PNR: f.pnr,
            Cliente: `${f.profiles?.first_name} ${f.profiles?.last_name}`,
            Email: f.profiles?.email,
            Itinerario: f.itinerary,
            Neto_EUR: f.cost,
            Vendido_EUR: f.sold_price || 0,
            Fee_AGV_EUR: f.fee_agv || 0,
            A_Cuenta_EUR: f.on_account,
            Saldo_EUR: f.balance,
            Metodo_Pago: f.payment_method_it ? `IT: ${f.payment_method_it}` : (f.payment_method_pe ? `PE: ${f.payment_method_pe}` : '-'),
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
                (f.pnr || '').toLowerCase().includes(lower) ||
                (f.profiles?.first_name || '').toLowerCase().includes(lower) ||
                (f.profiles?.last_name || '').toLowerCase().includes(lower)

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

            {/* Modal for Viewing Details */}
            <Dialog open={!!detailsViewerFlight} onOpenChange={(open) => !open && setDetailsViewerFlight(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalles del Vuelo</DialogTitle>
                        <DialogDescription>
                            Servicios incluidos para {detailsViewerFlight?.profiles?.first_name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {detailsViewerFlight?.details && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-chimipink">Incluye:</h4>
                                <ul className="grid grid-cols-1 gap-2">
                                    {Object.entries(detailsViewerFlight.details).map(([key, value]) => {
                                        if (key === 'special_note' || !value) return null
                                        return (
                                            <li key={key} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                                                <span className="text-green-500">✔</span>
                                                {DETAILS_LABELS[key] || key}
                                            </li>
                                        )
                                    })}
                                </ul>
                                
                                {Object.values(detailsViewerFlight.details).filter(v => v === true).length === 0 && (
                                    <p className="text-sm text-slate-400 italic">No hay servicios adicionales seleccionados.</p>
                                )}

                                {detailsViewerFlight.details.special_note && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-700 mb-1">Nota Especial:</h4>
                                        <p className="text-sm text-slate-600 bg-yellow-50 p-3 rounded border border-yellow-100 italic">
                                            &quot;{detailsViewerFlight.details.special_note}&quot;
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        {!detailsViewerFlight?.details && (
                            <p className="text-sm text-slate-500">Sin detalles registrados.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Payment History Viewer Dialog */}
            <Dialog open={!!paymentHistoryFlight} onOpenChange={(open) => !open && setPaymentHistoryFlight(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-chimipink">Historial de Pagos</DialogTitle>
                        <DialogDescription>
                            Registro de abonos para {paymentHistoryFlight?.profiles?.first_name} {paymentHistoryFlight?.profiles?.last_name}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detalle de Transacciones:</h4>
                            <div className="space-y-2 pr-1">
                                {paymentHistoryFlight?.payment_details && paymentHistoryFlight.payment_details.length > 0 ? (
                                    [...paymentHistoryFlight.payment_details].reverse().map((payment, idx) => {
                                        return (
                                            <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2 group relative transition-all">
                                                <div className="flex justify-between items-center mb-1 border-b border-slate-200/50 pb-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        Abono #{paymentHistoryFlight.payment_details!.length - idx}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px]">
                                                    <div className="flex items-center">
                                                        <span className="text-slate-500 font-medium mr-1">Método:</span>
                                                        <span className="font-bold text-slate-700">{payment.metodo_it || payment.metodo_pe || '-'}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="text-slate-500 font-medium mr-1">Sede:</span>
                                                        <span className="font-bold text-slate-700">{payment.sede_it || payment.sede_pe || '-'}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="text-slate-500 font-medium mr-1">Cantidad:</span>
                                                        <span className="font-bold text-chimipink">€ {parseFloat(payment.cantidad).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <span className="text-slate-500 font-medium mr-1">Total:</span>
                                                        <span className="font-bold text-slate-700">€ {payment.total}</span>
                                                    </div>
                                                </div>

                                                <div className="mt-2 pt-2 border-t border-slate-200/50 flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" /> {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '-'}
                                                    </span>
                                                    
                                                    {payment.proof_path && (
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-7 text-[10px] font-bold text-chimiteal hover:text-chimiteal hover:bg-teal-50 gap-1 px-2"
                                                            onClick={() => handleDownload(payment.proof_path!, payment.proof_path?.startsWith('clients/') ? 'r2' : 'images')}
                                                        >
                                                            <FileText className="h-3 w-3" />
                                                            Ver Comprobante
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <p className="text-sm text-slate-400 italic text-center py-4">No hay pagos registrados.</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                            <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100 text-center">
                                <span className="text-[10px] text-emerald-600 font-bold block uppercase">Total Pagado</span>
                                <span className="text-sm font-black text-emerald-700">€ {paymentHistoryFlight?.on_account.toFixed(2)}</span>
                            </div>
                            <div className="bg-red-50 p-2 rounded-lg border border-red-100 text-center">
                                <span className="text-[10px] text-red-600 font-bold block uppercase">Saldo Pendiente</span>
                                <span className="text-sm font-black text-red-700">€ {paymentHistoryFlight?.balance.toFixed(2)}</span>
                            </div>
                        </div>
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                     <Label>Fecha de Viaje</Label>
                                     <Input type="date" name="travel_date" value={formData.travel_date} onChange={handleInputChange} required />
                                </div>
                                <div className="grid gap-2">
                                     <Label>Fecha de Retorno</Label>
                                     <Input type="date" name="return_date" value={formData.return_date} onChange={handleInputChange} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                     <Label>PNR</Label>
                                     <Input name="pnr" value={formData.pnr} onChange={handleInputChange} placeholder="Código de reserva" />
                                </div>
                                <div className="grid gap-2 relative">
                                    <Label>Itinerario</Label>
                                    <Input 
                                        name="itinerary"
                                        value={formData.itinerary}
                                        onChange={(e) => {
                                            handleInputChange(e)
                                            setShowItineraryList(true)
                                        }}
                                        onFocus={() => setShowItineraryList(true)}
                                        onBlur={() => setTimeout(() => setShowItineraryList(false), 200)}
                                        placeholder="Buscar itinerario..."
                                        autoComplete="off"
                                    />
                                    {showItineraryList && (
                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-lg rounded-md mt-1 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                                            {ITINERARY_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.itinerary.toLowerCase())).map((opt, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="p-2 hover:bg-slate-50 cursor-pointer text-sm"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, itinerary: opt }))
                                                        setShowItineraryList(false)
                                                    }}
                                                >
                                                    {opt}
                                                </div>
                                            ))}
                                            {ITINERARY_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.itinerary.toLowerCase())).length === 0 && (
                                                <div className="p-2 text-xs text-slate-400 italic">No se encontraron coincidencias</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Flight Details & Inclusions */}
                            <div className="border rounded-md p-4 bg-slate-50 space-y-4">
                                <Label className="font-bold text-chimipink flex items-center gap-2">
                                    ✈️ TU VUELO INCLUYE
                                </Label>
                                
                                {/* Pasajes */}
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">🎟️ Pasajes</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.ticket_one_way} onChange={(e) => handleDetailChange('ticket_one_way', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            Pasaje solo ida
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.ticket_round_trip} onChange={(e) => handleDetailChange('ticket_round_trip', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            Pasaje ida y vuelta
                                        </label>
                                    </div>
                                </div>

                                {/* Equipaje */}
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">🧳 Equipaje</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.baggage_1pc_23kg} onChange={(e) => handleDetailChange('baggage_1pc_23kg', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            1 pc 23kg
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.baggage_2pc_23kg} onChange={(e) => handleDetailChange('baggage_2pc_23kg', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            2 pc 23kg
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.baggage_1pc_10kg} onChange={(e) => handleDetailChange('baggage_1pc_10kg', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            1 pc 10kg
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.baggage_backpack} onChange={(e) => handleDetailChange('baggage_backpack', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            1 Mochila
                                        </label>
                                    </div>
                                </div>

                                {/* Seguro */}
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">🛡️ Seguro de viaje</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.insurance_1m} onChange={(e) => handleDetailChange('insurance_1m', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            Seguro x 1 mes
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.insurance_2m} onChange={(e) => handleDetailChange('insurance_2m', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            Seguro x 2 meses
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.insurance_3m} onChange={(e) => handleDetailChange('insurance_3m', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            Seguro x 3 meses
                                        </label>
                                    </div>
                                </div>

                                {/* Documentación */}
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">📄 Documentación</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.doc_invitation_letter} onChange={(e) => handleDetailChange('doc_invitation_letter', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            Redacción carta invitación
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.doc_agency_managed} onChange={(e) => handleDetailChange('doc_agency_managed', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            Carta inv. gestionada por agencia
                                        </label>
                                    </div>
                                </div>

                                {/* Servicios Adicionales */}
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">🛄 Servicios adicionales</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.svc_airport_assistance} onChange={(e) => handleDetailChange('svc_airport_assistance', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            Asistencia aeroportuaria
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.svc_return_activation} onChange={(e) => handleDetailChange('svc_return_activation', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            Activación pasaje retorno
                                        </label>
                                    </div>
                                </div>

                                {/* Hotel */}
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">🏨 Reserva de hotel</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.hotel_3d_2n} onChange={(e) => handleDetailChange('hotel_3d_2n', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            3 días / 2 noches
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.hotel_2d_1n} onChange={(e) => handleDetailChange('hotel_2d_1n', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                            2 días / 1 noche
                                        </label>
                                    </div>
                                </div>

                                {/* Nota Especial */}
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">📝 Nota especial</Label>
                                    <Input 
                                        value={flightDetails.special_note} 
                                        onChange={(e) => handleDetailChange('special_note', e.target.value)} 
                                        placeholder="Tu pasaje es especial..." 
                                        className="bg-white"
                                    />
                                </div>
                            </div>

                            {/* Financials */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label>Neto (€)</Label>
                                    <Input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleInputChange} placeholder="0.00" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Vendido (€)</Label>
                                    <Input type="number" step="0.01" name="sold_price" value={formData.sold_price} onChange={handleInputChange} placeholder="0.00" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>A Cuenta (€)</Label>
                                    <Input 
                                        type="number" 
                                        step="0.01" 
                                        name="on_account" 
                                        value={formData.on_account} 
                                        onChange={handleInputChange} 
                                        placeholder="0.00" 
                                        readOnly
                                        className="bg-slate-100 font-bold"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-2 rounded">
                                <div className="grid gap-2">
                                    <Label>Saldo (Automático)</Label>
                                    <Input type="number" step="0.01" name="balance" value={formData.balance} readOnly className="bg-slate-100 font-bold" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>FEE-AGV (Automático)</Label>
                                    <Input type="number" step="0.01" name="fee_agv" value={formData.fee_agv} readOnly className="bg-slate-100 font-bold text-emerald-600" />
                                </div>
                            </div>

                                {/* AGREGAR PAGO SECTION */}
                                {selectedFlightId && flights.find(f => f.id === selectedFlightId)?.payment_details?.length ? (
                                    <div className="border rounded-xl p-4 bg-emerald-50/20 space-y-3 border-emerald-100/50">
                                        <div className="flex items-center gap-2">
                                            <ListChecks className="h-4 w-4 text-emerald-600" />
                                            <Label className="font-bold text-emerald-800 text-xs uppercase tracking-wider">
                                                Historial de Pagos
                                            </Label>
                                        </div>
                                        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                                            {flights.find(f => f.id === selectedFlightId)?.payment_details.map((payment, idx) => {
                                                const isEditing = editingPaymentIndex === idx;
                                                return (
                                                    <div key={idx} className={`p-3 rounded-lg border text-sm shadow-sm transition-all ${isEditing ? 'bg-blue-50/50 border-blue-200' : 'bg-white/80 border-emerald-100 hover:border-emerald-300'} group relative`}>
                                                        {isEditing ? (
                                                            <div className="animate-in fade-in zoom-in-95 duration-200 space-y-3">
                                                                <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                                                                    <span className="font-bold text-blue-700 flex items-center gap-2">
                                                                        <Edit className="h-3 w-3" /> Editando Abono #{idx + 1}
                                                                    </span>
                                                                    <div className="flex gap-1">
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="ghost" 
                                                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                            onClick={() => {
                                                                                setEditingPaymentIndex(null)
                                                                                setEditPaymentData(null)
                                                                            }}
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="ghost" 
                                                                            className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                                            onClick={() => handleSaveEditPayment(selectedFlightId!)}
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {editPaymentData && (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                                                                        <div className="grid gap-1 relative">
                                                                            <Label className="text-[10px] uppercase font-bold text-slate-500">Sede IT</Label>
                                                                            <Input 
                                                                                className="h-8 text-xs bg-white"
                                                                                value={editPaymentData.sede_it}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value
                                                                                    setEditPaymentData(prev => prev ? {...prev, sede_it: val} : null)
                                                                                    setShowEditSedeITList(true)
                                                                                }}
                                                                                onFocus={() => setShowEditSedeITList(true)}
                                                                                onBlur={() => setTimeout(() => setShowEditSedeITList(false), 200)}
                                                                            />
                                                                            {showEditSedeITList && (
                                                                                <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-32 overflow-y-auto">
                                                                                    {SEDE_IT_OPTIONS.filter(opt => opt.toLowerCase().includes(editPaymentData.sede_it.toLowerCase())).map((opt, sidx) => (
                                                                                        <div key={sidx} className="p-2 hover:bg-slate-50 cursor-pointer text-xs" onClick={() => {
                                                                                            setEditPaymentData(prev => prev ? {...prev, sede_it: opt} : null)
                                                                                            setShowEditSedeITList(false)
                                                                                        }}>{opt}</div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="grid gap-1 relative">
                                                                            <Label className="text-[10px] uppercase font-bold text-slate-500">Sede PE</Label>
                                                                            <Input 
                                                                                className="h-8 text-xs bg-white"
                                                                                value={editPaymentData.sede_pe}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value
                                                                                    setEditPaymentData(prev => prev ? {...prev, sede_pe: val} : null)
                                                                                    setShowEditSedePEList(true)
                                                                                }}
                                                                                onFocus={() => setShowEditSedePEList(true)}
                                                                                onBlur={() => setTimeout(() => setShowEditSedePEList(false), 200)}
                                                                            />
                                                                            {showEditSedePEList && (
                                                                                <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-32 overflow-y-auto">
                                                                                    {SEDE_PE_OPTIONS.filter(opt => opt.toLowerCase().includes(editPaymentData.sede_pe.toLowerCase())).map((opt, sidx) => (
                                                                                        <div key={sidx} className="p-2 hover:bg-slate-50 cursor-pointer text-xs" onClick={() => {
                                                                                            setEditPaymentData(prev => prev ? {...prev, sede_pe: opt} : null)
                                                                                            setShowEditSedePEList(false)
                                                                                        }}>{opt}</div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="grid gap-1">
                                                                            <Label className="text-[10px] uppercase font-bold text-slate-500">Método IT</Label>
                                                                            <select 
                                                                                className="h-8 w-full border rounded-md px-2 text-xs bg-white"
                                                                                value={editPaymentData.metodo_it}
                                                                                onChange={(e) => setEditPaymentData(prev => prev ? {...prev, metodo_it: e.target.value} : null)}
                                                                            >
                                                                                <option value="">Seleccionar...</option>
                                                                                {PAYMENT_METHOD_IT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                            </select>
                                                                        </div>
                                                                        <div className="grid gap-1">
                                                                            <Label className="text-[10px] uppercase font-bold text-slate-500">Método PE</Label>
                                                                            <select 
                                                                                className="h-8 w-full border rounded-md px-2 text-xs bg-white"
                                                                                value={editPaymentData.metodo_pe}
                                                                                onChange={(e) => setEditPaymentData(prev => prev ? {...prev, metodo_pe: e.target.value} : null)}
                                                                            >
                                                                                <option value="">Seleccionar...</option>
                                                                                {PAYMENT_METHOD_PE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                            </select>
                                                                        </div>
                                                                        <div className="grid gap-1">
                                                                            <Label className="text-[10px] uppercase font-bold text-slate-500">Cantidad (€)</Label>
                                                                            <Input 
                                                                                type="number"
                                                                                step="0.01"
                                                                                className="h-8 text-xs font-bold bg-yellow-50/50 border-yellow-200"
                                                                                value={editPaymentData.cantidad}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value
                                                                                    setEditPaymentData(prev => {
                                                                                        if (!prev) return null
                                                                                        const total = (parseFloat(val) * (prev.tipo_cambio || 1)).toFixed(2)
                                                                                        return {...prev, cantidad: val, total}
                                                                                    })
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="grid gap-1">
                                                                            <Label className="text-[10px] uppercase font-bold text-slate-500">T. Cambio</Label>
                                                                            <Input 
                                                                                type="number"
                                                                                step="0.0001"
                                                                                className="h-8 text-xs bg-white"
                                                                                value={editPaymentData.tipo_cambio}
                                                                                onChange={(e) => {
                                                                                    const val = e.target.value
                                                                                    setEditPaymentData(prev => {
                                                                                        if (!prev) return null
                                                                                        const total = (parseFloat(prev.cantidad) * parseFloat(val)).toFixed(2)
                                                                                        return {...prev, tipo_cambio: parseFloat(val), total}
                                                                                    })
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="grid gap-1">
                                                                            <Label className="text-[10px] uppercase font-bold text-slate-500">Total Procesado</Label>
                                                                            <Input 
                                                                                readOnly
                                                                                className="h-8 text-xs font-bold bg-slate-100 text-emerald-700"
                                                                                value={`€ ${editPaymentData.total}`}
                                                                            />
                                                                        </div>
                                                                        <div className="grid gap-1">
                                                                            <Label className="text-[10px] uppercase font-bold text-slate-500">Nuevo Comprobante</Label>
                                                                            <Input 
                                                                                type="file" 
                                                                                accept="image/*" 
                                                                                className="w-full text-[11px] cursor-pointer file:bg-blue-50 file:text-blue-700 file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 file:text-[10px] file:font-semibold" 
                                                                                onChange={(e) => setEditPaymentFile(e.target.files?.[0] || null)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex justify-between items-center transition-all">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="grid gap-0.5">
                                                                        <span className="font-bold text-slate-700 flex items-center gap-2">
                                                                            <span className="w-5 h-5 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-full text-[10px] shrink-0 font-black">
                                                                                {idx + 1}
                                                                            </span>
                                                                            {payment.metodo_it || payment.metodo_pe || 'Otros'}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium italic">
                                                                            <Calendar className="h-2.5 w-2.5" /> {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : 'Pendiente'} • <Building2 className="h-2.5 w-2.5" /> {payment.sede_it || payment.sede_pe || 'S/D'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="text-right">
                                                                        <span className="font-bold text-emerald-600 text-base leading-none block">€ {parseFloat(payment.cantidad).toFixed(2)}</span>
                                                                        <span className="text-[9px] text-slate-400 uppercase tracking-tighter">Procesado: € {payment.total}</span>
                                                                        {payment.proof_path && (
                                                                            <button 
                                                                                type="button"
                                                                                onClick={() => handleDownload(payment.proof_path!, payment.proof_path?.startsWith('clients/') ? 'r2' : 'images')}
                                                                                className="text-[9px] font-bold text-chimiteal hover:underline flex items-center gap-1 mt-0.5 justify-end w-full"
                                                                            >
                                                                                <FileText className="h-2 w-2" /> Ver Comprobante
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setEditingPaymentIndex(idx)
                                                                                setEditPaymentData(payment)
                                                                            }}
                                                                            className="text-slate-300 hover:text-chimiteal transition-colors p-1"
                                                                            title="Editar Pago"
                                                                        >
                                                                            <Edit className="h-3.5 w-3.5" />
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => handleDeletePayment(selectedFlightId!, idx)}
                                                                            className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                                            title="Eliminar Pago"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}

                                <div className="border rounded-xl p-4 bg-slate-50/50 space-y-4 border-dashed border-slate-300 relative">
                                    <div className="flex justify-between items-center">
                                        <Label className="font-bold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wide">
                                            💰 Registrar Nuevo Pago
                                        </Label>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => setShowPaymentFields(!showPaymentFields)}
                                            className={showPaymentFields ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"}
                                        >
                                            {showPaymentFields ? "Cerrar" : "+ Agregar Pago"}
                                        </Button>
                                    </div>

                                    {showPaymentFields && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 border-t pt-4 border-slate-200">
                                            <div className="grid gap-2 relative">
                                                <Label className="text-xs">Sede IT</Label>
                                                <Input 
                                                    name="sede_it" 
                                                    value={formData.sede_it} 
                                                    onChange={(e) => {
                                                        handleInputChange(e)
                                                        setShowSedeITList(true)
                                                    }}
                                                    onFocus={() => setShowSedeITList(true)}
                                                    onBlur={() => setTimeout(() => setShowSedeITList(false), 200)}
                                                    placeholder="Buscar sede IT..."
                                                    autoComplete="off"
                                                />
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
                                            <div className="grid gap-2 relative">
                                                <Label className="text-xs">Sede PE</Label>
                                                <Input 
                                                    name="sede_pe" 
                                                    value={formData.sede_pe} 
                                                    onChange={(e) => {
                                                        handleInputChange(e)
                                                        setShowSedePEList(true)
                                                    }}
                                                    onFocus={() => setShowSedePEList(true)}
                                                    onBlur={() => setTimeout(() => setShowSedePEList(false), 200)}
                                                    placeholder="Buscar sede PE..."
                                                    autoComplete="off"
                                                />
                                                {showSedePEList && (
                                                    <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                        {SEDE_PE_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.sede_pe.toLowerCase())).map((opt, idx) => (
                                                            <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                setFormData(p => ({ ...p, sede_pe: opt }))
                                                                setShowSedePEList(false)
                                                            }}>{opt}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs">Método Pago IT</Label>
                                                <select name="payment_method_it" value={formData.payment_method_it} onChange={handleInputChange} className="w-full border rounded-md p-2 text-sm bg-white focus:ring-chimiteal">
                                                    <option value="">Seleccionar...</option>
                                                    {PAYMENT_METHOD_IT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs">Método Pago PE</Label>
                                                <select name="payment_method_pe" value={formData.payment_method_pe} onChange={handleInputChange} className="w-full border rounded-md p-2 text-sm bg-white focus:ring-chimiteal">
                                                    <option value="">Seleccionar...</option>
                                                    {PAYMENT_METHOD_PE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs font-bold text-slate-700">Cantidad (Paga Cliente)</Label>
                                                <Input type="number" step="0.01" name="payment_quantity" value={formData.payment_quantity} onChange={handleInputChange} placeholder="0.00" className="bg-yellow-50 border-yellow-200 focus:ring-yellow-500 font-bold" />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs">Tipo de Cambio</Label>
                                                <Input type="number" step="0.0001" name="payment_exchange_rate" value={formData.payment_exchange_rate} onChange={handleInputChange} placeholder="1.00" />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs">Total Procesado</Label>
                                                <Input type="number" step="0.01" name="payment_total" value={formData.payment_total} readOnly className="bg-slate-100 font-bold text-emerald-700" />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs font-semibold">Foto de Comprobante (Opcional)</Label>
                                                <Input type="file" accept="image/*" onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)} className="text-xs cursor-pointer file:bg-emerald-50 file:text-emerald-700 file:border-0 file:rounded-md file:px-2 file:py-1 file:mr-2" />
                                            </div>
                                        </div>
                                    )}
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

                                {documentInputs.map((input, idx) => {
                                    // Check if this document type is already uploaded
                                    const isAlreadyUploaded = existingDocs.some(doc => (doc.title || doc.name) === input.title)
                                    // If uploaded and not "Otros", hide the input
                                    if (isAlreadyUploaded && input.title !== "Otros") return null

                                    return (
                                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2 p-3 bg-slate-50 rounded border border-slate-200 items-center">
                                        <div>
                                            <Label className="text-xs font-semibold text-slate-700 block mb-1">
                                                {idx === documentInputs.length - 1 ? "Otros (Especificar Título)" : input.title}
                                            </Label>
                                            
                                            {idx === documentInputs.length - 1 && (
                                                <Input 
                                                    placeholder="Especifique el título..."
                                                    onChange={(e) => {
                                                        const newVal = e.target.value
                                                        setDocumentInputs(prev => {
                                                            const copy = [...prev]
                                                            copy[idx].title = newVal || "Otros"
                                                            return copy
                                                        })
                                                    }}
                                                    className="h-8 text-xs mb-1"
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <Input 
                                                type="file" 
                                                className="text-xs"
                                                onChange={(e) => handleDocInputChange(idx, e.target.files?.[0] || null)}
                                            />
                                        </div>
                                    </div>
                                )})}
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={isSubmitting} className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 w-full sm:w-auto font-bold shadow-md">
                                    {isSubmitting ? 'Guardando...' : (selectedFlightId ? 'Actualizar Vuelo' : 'Guardar Vuelo')}
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
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'finished')}
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
                                    <th className="px-6 py-4 font-medium">Agente</th>
                                    <th className="px-6 py-4 font-medium">Itinerario</th>
                                    <th className="px-6 py-4 font-medium text-center">Incluye</th>
                                    <th className="px-6 py-4 font-medium">Neto</th>
                                    <th className="px-6 py-4 font-medium">Vendido</th>
                                    <th className="px-6 py-4 font-medium">Fee AGV</th>
                                    <th className="px-6 py-4 font-medium">A Cuenta</th>
                                    <th className="px-6 py-4 font-medium">Saldo</th>
                                    <th className="px-6 py-4 font-medium">Pago</th>
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
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-slate-600 font-medium">
                                                    {flight.agent ? `${flight.agent.first_name} ${flight.agent.last_name}` : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-[150px] truncate" title={flight.itinerary}>
                                                {flight.itinerary || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {flight.details && (Object.values(flight.details).some(v => v === true || (typeof v === 'string' && v.length > 0))) ? (
                                                    <Button size="sm" variant="ghost" className="text-chimipink hover:bg-pink-50" onClick={() => setDetailsViewerFlight(flight)}>
                                                        <ListChecks className="h-5 w-5" />
                                                    </Button>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">€ {flight.cost.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">€ {(flight.sold_price || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-emerald-600 font-semibold">€ {(flight.fee_agv || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">€ {flight.on_account.toFixed(2)}</td>
                                            <td className="px-6 py-4 font-medium whitespace-nowrap">
                                                {flight.balance > 0 ? (
                                                    <span className="text-red-600">€ {flight.balance.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-emerald-600">Pagado</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="group relative flex flex-col items-center gap-1 hover:bg-emerald-50 transition-all duration-300 rounded-xl py-2 px-3"
                                                    onClick={() => setPaymentHistoryFlight(flight)}
                                                >
                                                    <div className="bg-emerald-100 text-emerald-700 p-1.5 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
                                                        <Wallet className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-400 group-hover:text-emerald-600 uppercase tracking-tighter">
                                                        {flight.payment_details?.length || 0} pagos
                                                    </span>
                                                </Button>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {flight.documents && flight.documents.length > 0 ? (
                                                    <Button size="sm" variant="ghost" className="text-chimiteal hover:bg-teal-50" onClick={() => setDocsViewerFlight(flight)}>
                                                        <FileText className="h-5 w-5" />
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
