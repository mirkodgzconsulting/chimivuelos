'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Trash2, Edit, FileText, Download, FileSpreadsheet, ChevronLeft, ChevronRight, ListChecks, Wallet, Check, X, Calendar, Building2, Lock, Unlock, User, Copy } from 'lucide-react'
import Image from 'next/image'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { EditRequestModal } from '@/components/permissions/EditRequestModal'
import { getActivePermissionDetails, getActivePermissions } from '@/app/actions/manage-permissions'
import { getPaymentMethodsIT, getPaymentMethodsPE, PaymentMethod } from '@/app/actions/manage-payment-methods'
import { cn } from '@/lib/utils'
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getFlights, getClientsForDropdown, createFlight, updateFlight, deleteFlight, deleteFlightDocument, updateFlightStatus, getFlightDocumentUrl, deleteFlightPayment, updateFlightPayment, getItineraries } from '@/app/actions/manage-flights'

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
    cantidad: string     // Amount in EUR (the one that affects accounting)
    tipo_cambio: number  // Exchange rate (Moneda/EUR)
    total: string        // Formatted original amount (e.g., "S/ 400.00")
    moneda?: string
    monto_original?: string
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

    status: string
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
        document_number: string
    } | null
    agent: {
        first_name: string
        last_name: string
    } | null
    payment_details: PaymentDetail[]
    payment_proof_path: string | null
    exchange_rate: number
    ticket_type?: string
    pax_adt?: number
    pax_chd?: number
    pax_inf?: number
    pax_total?: number
    iata_gds?: string
}

interface ClientOption {
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    document_number: string
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
    insurance_tourism_date_from: string
    insurance_tourism_date_to: string
    insurance_tourism_active: boolean
    insurance_migratory: boolean
    svc_stewardess_um: boolean
    svc_stewardess_um_unpaid: boolean
    svc_pet_travel: boolean
    hotel_custom_active: boolean
    hotel_custom_days: string
    hotel_custom_nights: string
    special_note: string
}

const DETAILS_LABELS: Record<string, string> = {
    ticket_one_way: "Pasaje solo ida",
    ticket_round_trip: "Pasaje ida y vuelta",
    insurance_1m: "Seguro x 1 mes",
    insurance_2m: "Seguro x 2 meses",
    insurance_3m: "Seguro x 3 meses",
    doc_invitation_letter: "Redacción carta de invitación con documentos del anfitrión (El cliente envía copia del documento de identidad o Permesso di soggiorno y Tessera sanitaria del familiar en Italia.)",
    doc_agency_managed: "Carta inv. gestionada por agencia",
    svc_airport_assistance: "Asistencia aeroportuaria",
    svc_return_activation: "Activación pasaje retorno",
    hotel_3d_2n: "Hotel 3 días / 2 noches (Utilizable 1 día)",
    hotel_custom_active: "Hotel personalizado",
    hotel_2d_1n: "Hotel 2 días / 1 noche",
    baggage_1pc_23kg: "1 pc 23kg",
    baggage_2pc_23kg: "2 pc 23kg",
    baggage_1pc_10kg: "1 pc 10kg",
    baggage_backpack: "1 Mochila",
    insurance_tourism_active: "Seguro (Turista / Schengen)",
    insurance_migratory: "Seguro migratorio",
    svc_stewardess_um: "Solicitud de azafata para menor de edad (UMNR) +225 EURO PAGO SÍ INCLUIDO EN EL PRECIO",
    svc_stewardess_um_unpaid: "Solicitud de azafata para menor de edad (UMNR) +225 EURO PAGO NO INCLUIDO EN EL PRECIO",
    svc_pet_travel: "Viaja con mascota",
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

const TICKET_TYPE_OPTIONS = [
    "Exprés migratorio — Italia",
    "Exprés turismo — Italia",
    "Exprés migratorio — Europa",
    "Exprés turismo — Mundo",
    "Étnico — solo ida",
    "Étnico — ida y vuelta",
    "Exprés con documento",
    "Pasaje low cost (económico, servicios básicos)"
]

const IATA_OPTIONS = [
    "sabre suema",
    "dolar continental",
    "otro 1",
    "otro 2"
]

const SEDE_IT_OPTIONS = ["turro milano", "corsico milano", "roma", "lima"]

const FLIGHT_STATUSES = [
    "Programado",
    "En tránsito",
    "Reprogramado",
    "Cambio de horario",
    "Cancelado",
    "No-show (no se presentó)",
    "En migración",
    "Deportado",
    "Finalizado"
]

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
    insurance_tourism_date_from: '',
    insurance_tourism_date_to: '',
    insurance_tourism_active: false,
    insurance_migratory: false,
    svc_stewardess_um: false,
    svc_stewardess_um_unpaid: false,
    svc_pet_travel: false,
    hotel_custom_active: false,
    hotel_custom_days: '',
    hotel_custom_nights: '',
    special_note: ''
}

export default function FlightsPage() {
    const [flights, setFlights] = useState<Flight[]>([])
    const [clients, setClients] = useState<ClientOption[]>([])
    const [itineraries, setItineraries] = useState<string[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [showDeudaOnly, setShowDeudaOnly] = useState(false)

    // Filters State
    const [statusFilter, setStatusFilter] = useState<string>('all')
    
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
    const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null)

    const handleCopyPhone = (id: string, phone: string) => {
        navigator.clipboard.writeText(phone)
        setCopiedPhoneId(id)
        setTimeout(() => setCopiedPhoneId(null), 2000)
    }
    const [detailsViewerFlight, setDetailsViewerFlight] = useState<Flight | null>(null)

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)

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

            // Load itineraries from DB
            const dbItineraries = await getItineraries()
            setItineraries(dbItineraries)
        }
        fetchInitialData()
    }, [])



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
        status: 'Programado',
        return_date: '',
        sold_price: '',
        fee_agv: '',
        payment_method_it: '',
        payment_method_pe: '',
        // New Payment Fields
        sede_it: '',
        sede_pe: '',
        payment_currency: 'EUR',
        payment_quantity: '',
        payment_exchange_rate: '1.0',
        payment_total: '',
        ticket_type: '',
        pax_adt: '1',
        pax_chd: '0',
        pax_inf: '0',
        pax_total: '1',
        iata_gds: 'sabre suema',
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
    const [showMetodoITList, setShowMetodoITList] = useState(false)
    const [showMetodoPEList, setShowMetodoPEList] = useState(false)
    const [paymentMethodsIT, setPaymentMethodsIT] = useState<PaymentMethod[]>([])
    const [paymentMethodsPE, setPaymentMethodsPE] = useState<PaymentMethod[]>([])
    const [showTicketTypeList, setShowTicketTypeList] = useState(false)
    const [showIATAOptions, setShowIATAOptions] = useState(false)
    const [baseOnAccount, setBaseOnAccount] = useState(0) // Track existing payments sum
    const [tempPayments, setTempPayments] = useState<PaymentDetail[]>([])
    const [tempPaymentProofs, setTempPaymentProofs] = useState<(File | null)[]>([])

    // Load Data
    const loadData = useCallback(async () => {
        const [flightsData, clientsData, methodsIT, methodsPE] = await Promise.all([
            getFlights(),
            getClientsForDropdown(),
            getPaymentMethodsIT(),
            getPaymentMethodsPE()
        ])
        setFlights(flightsData as unknown as Flight[])
        setClients(clientsData as unknown as ClientOption[])
        setPaymentMethodsIT(methodsIT)
        setPaymentMethodsPE(methodsPE)
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

        // Logic for Payment Quantity and Currency -> A Cuenta
        if (name === 'payment_quantity' || name === 'payment_exchange_rate' || name === 'payment_currency') {
            const currency = name === 'payment_currency' ? value : newFormData.payment_currency
            
            // Do not suggest values as exchange rates fluctuate constantly
            let currentRate = parseFloat(name === 'payment_exchange_rate' ? value : newFormData.payment_exchange_rate) || 1
            if (name === 'payment_currency' && value === 'EUR') {
                currentRate = 1.0
                newFormData.payment_exchange_rate = '1.0'
            }

            const qty = parseFloat(name === 'payment_quantity' ? value : newFormData.payment_quantity) || 0
            const rate = currentRate

            let amount_eur = 0
            if (currency === 'EUR') {
                amount_eur = qty
                newFormData.payment_exchange_rate = '1.0'
            } else if (currency === 'PEN') {
                // Division logic for Soles: Amount / Rate = EUR
                // This means the rate represents "How many Soles for 1 EUR"
                amount_eur = rate !== 0 ? qty / rate : 0
            } else {
                // Multiplication logic (matches Google's direct rate): Foreign Amount * (Value of 1 unit in EUR)
                // If Google says 1 USD = 0.85 EUR, then: 500 USD * 0.85 = 425 EUR
                amount_eur = qty * rate
            }

            newFormData.payment_total = amount_eur.toFixed(2)
            newFormData.on_account = (baseOnAccount + amount_eur).toFixed(2)
        }

        // Auto-calculate Balance and Fee
        if (name === 'cost' || name === 'sold_price' || name === 'on_account' || name === 'payment_quantity') {
            const neto = parseFloat(newFormData.cost) || 0
            const vendido = parseFloat(newFormData.sold_price) || 0
            const aCuenta = parseFloat(newFormData.on_account) || 0
            
            newFormData.balance = (vendido - aCuenta).toFixed(2)
            newFormData.fee_agv = (vendido - neto).toFixed(2)
        }

        // Logic for PAX Total calculation
        if (name === 'pax_adt' || name === 'pax_chd' || name === 'pax_inf') {
            const adt = parseInt(name === 'pax_adt' ? value : newFormData.pax_adt) || 0
            const chd = parseInt(name === 'pax_chd' ? value : newFormData.pax_chd) || 0
            const inf = parseInt(name === 'pax_inf' ? value : newFormData.pax_inf) || 0
            newFormData.pax_total = (adt + chd + inf).toString()
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
            on_account: '0.00',
            balance: '0.00',
            status: 'Programado',
            return_date: '',
            sold_price: '',
            fee_agv: '0.00',
            payment_method_it: '',
            payment_method_pe: '',
            sede_it: '',
            sede_pe: '',
            payment_currency: 'EUR',
            payment_quantity: '',
            payment_exchange_rate: '1.0',
            payment_total: '',
            ticket_type: '',
            pax_adt: '1',
            pax_chd: '0',
            pax_inf: '0',
            pax_total: '1',
            iata_gds: 'sabre suema',
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
        setTempPayments([])
        setTempPaymentProofs([])
    }

    const handleAddPaymentToTemp = () => {
        if (!formData.payment_quantity || parseFloat(formData.payment_quantity) === 0) {
            alert("Por favor ingrese una cantidad")
            return
        }

        const pCurrency = formData.payment_currency || 'EUR'
        const symbol = pCurrency === 'EUR' ? '€' : pCurrency === 'PEN' ? 'S/' : '$'
        
        // Use either the manually entered payment_total (EUR equiv) or the quantity
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

        setTempPayments(prev => [...prev, newPayment])
        setTempPaymentProofs(prev => [...prev, paymentProofFile])
        
        setPaymentProofFile(null)
        setShowPaymentFields(false)
        
        // Form resetting of payment fields will be handled by existing code or just reset manually
        setFormData(prev => ({
            ...prev,
            sede_it: '',
            sede_pe: '',
            payment_quantity: '',
            payment_total: '',
            payment_method_it: '',
            payment_method_pe: '',
            payment_exchange_rate: '1.0',
            payment_currency: 'EUR'
        }))
    }
    const handleRemoveTempPayment = (index: number) => {
        setTempPayments(prev => prev.filter((_, i) => i !== index))
        setTempPaymentProofs(prev => prev.filter((_, i) => i !== index))
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
            payment_currency: 'EUR',
            payment_quantity: '',
            payment_exchange_rate: (flight.exchange_rate || 1.0).toString(),
            payment_total: '',
            ticket_type: flight.ticket_type || '',
            pax_adt: (flight.pax_adt || 1).toString(),
            pax_chd: (flight.pax_chd || 0).toString(),
            pax_inf: (flight.pax_inf || 0).toString(),
            pax_total: (flight.pax_total || 1).toString(),
            iata_gds: flight.iata_gds || 'sabre suema',
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

    const handleDeleteFlight = async (id: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este vuelo? Esta acción no se puede deshacer.')) return
        
        const result = await deleteFlight(id)
        if (result.success) {
            toast.success('Vuelo eliminado correctamente')
            loadData()
        } else {
            toast.error(result.error || 'Error al eliminar vuelo')
        }
    }

    const handleEditClick = async (flight: Flight) => {
        if (userRole === 'admin' || userRole === 'supervisor') {
            handleEdit(flight)
            return
        }

        if (userRole === 'agent') {
            const permission = await getActivePermissionDetails('flights', flight.id)
            const isUnlocked = unlockedResources.has(flight.id) || permission.hasPermission
            if (isUnlocked) {
                setUnlockedResources(prev => new Set(prev).add(flight.id))
                handleEdit(flight)
            } else {
                setPendingResourceId(flight.id)
                setPendingResourceName(flight.pnr || flight.id)
                setIsPermissionModalOpen(true)
            }
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
        const flight = flights.find(f => f.id === id)
        if (!flight) return

        if (userRole === 'agent' && !unlockedResources.has(id)) {
            setPendingResourceId(id)
            setPendingResourceName(flight.pnr || id)
            setIsPermissionModalOpen(true)
            return
        }

        // Optimistic update locally first for speed
        setFlights(prev => prev.map(f => f.id === id ? { ...f, status: newStatus as Flight['status'] } : f))
        const result = await updateFlightStatus(id, newStatus)
        if (result?.error) {
            alert("Error al actualizar estado: " + result.error)
            loadData() // Revert
        }
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
                
                // Update local formData if the edited flight is the current one
                if (selectedFlightId === flightId) {
                    const flight = flights.find(f => f.id === flightId)
                    if (flight && flight.payment_details) {
                        const remainingPayments = [...flight.payment_details]
                        remainingPayments.splice(originalIndex, 1)
                        let totalOnAccount = 0
                        remainingPayments.forEach(p => totalOnAccount += parseFloat(p.cantidad) || 0)
                        
                        setFormData(prev => ({
                            ...prev,
                            on_account: totalOnAccount.toFixed(2),
                            balance: (parseFloat(prev.sold_price || '0') - totalOnAccount).toFixed(2)
                        }))
                        setBaseOnAccount(totalOnAccount)
                    }
                }
            } else {
                alert('Error al eliminar el pago: ' + (res.error || ''))
            }
        }
    }

    const [editingPaymentIndex, setEditingPaymentIndex] = useState<number | null>(null)
    const [editPaymentData, setEditPaymentData] = useState<PaymentDetail | null>(null)
    const [showEditSedeITList, setShowEditSedeITList] = useState(false)
    const [showEditMetodoITList, setShowEditMetodoITList] = useState(false)
    const [showEditMetodoPEList, setShowEditMetodoPEList] = useState(false)
    const [editPaymentFile, setEditPaymentFile] = useState<File | null>(null)

    const handleSaveEditPayment = async (flightId: string) => {
        if (!editPaymentData || editingPaymentIndex === null) return
        
        const formDataPayload = new FormData()
        formDataPayload.append('flightId', flightId)
        formDataPayload.append('paymentIndex', editingPaymentIndex.toString())
        formDataPayload.append('sede_it', editPaymentData.sede_it)
        formDataPayload.append('sede_pe', editPaymentData.sede_pe)
        formDataPayload.append('metodo_it', editPaymentData.metodo_it)
        formDataPayload.append('metodo_pe', editPaymentData.metodo_pe)
        formDataPayload.append('cantidad', editPaymentData.cantidad)
        formDataPayload.append('tipo_cambio', editPaymentData.tipo_cambio.toString())
        formDataPayload.append('total', editPaymentData.total)
        if (editPaymentData.moneda) formDataPayload.append('moneda', editPaymentData.moneda)
        if (editPaymentData.monto_original) formDataPayload.append('monto_original', editPaymentData.monto_original)
        if (editPaymentData.moneda && editPaymentData.monto_original) {
            const sym = editPaymentData.moneda === 'EUR' ? '€' : editPaymentData.moneda === 'PEN' ? 'S/' : '$'
            formDataPayload.append('total_display', `${sym} ${parseFloat(editPaymentData.monto_original).toFixed(2)}`)
        }
        
        if (editPaymentFile) {
            formDataPayload.append('proofFile', editPaymentFile)
        }

        const res = await updateFlightPayment(formDataPayload)
        if (res.success) {
            await loadData()
            
            // Update local formData if the edited flight is the current one
            if (selectedFlightId === flightId) {
                const flight = flights.find(f => f.id === flightId)
                if (flight && flight.payment_details) {
                    const updatedPayments = [...flight.payment_details]
                    updatedPayments[editingPaymentIndex] = {
                        ...updatedPayments[editingPaymentIndex],
                        cantidad: editPaymentData.cantidad
                    }
                    let totalOnAccount = 0
                    updatedPayments.forEach(p => totalOnAccount += parseFloat(p.cantidad) || 0)
                    
                    setFormData(prev => ({
                        ...prev,
                        on_account: totalOnAccount.toFixed(2),
                        balance: (parseFloat(prev.sold_price || '0') - totalOnAccount).toFixed(2)
                    }))
                    setBaseOnAccount(totalOnAccount)
                }
            }
            setEditingPaymentIndex(null)
            setEditPaymentData(null)
            setEditPaymentFile(null)
        } else {
        }
    }

    const [isSubmitting, setIsSubmitting] = useState(false)

    // Derived Financial Summary
    const financials = useMemo(() => {
        const flight = flights.find(f => f.id === selectedFlightId)
        let totalOnAccount = 0
        const dbPayments = (flight?.payment_details as PaymentDetail[]) || []
        
        dbPayments.forEach((p, idx) => {
            if (idx === editingPaymentIndex && editPaymentData) {
                totalOnAccount += parseFloat(editPaymentData.cantidad) || 0
            } else {
                totalOnAccount += parseFloat(p.cantidad) || 0
            }
        })
        
        tempPayments.forEach(p => totalOnAccount += parseFloat(p.cantidad) || 0)
        
        // Also add the "current" pending payment fields if they have a value and aren't in temp yet
        if (!showPaymentFields && formData.payment_quantity && parseFloat(formData.payment_quantity) > 0) {
            totalOnAccount += parseFloat(formData.payment_total) || 0
        }

        const soldPrice = parseFloat(formData.sold_price) || 0
        const cost = parseFloat(formData.cost) || 0
        
        return {
            on_account: totalOnAccount.toFixed(2),
            balance: (soldPrice - totalOnAccount).toFixed(2),
            fee_agv: (soldPrice - cost).toFixed(2)
        }
    }, [flights, selectedFlightId, editingPaymentIndex, editPaymentData, tempPayments, formData.sold_price, formData.cost, formData.payment_total, formData.payment_quantity, showPaymentFields])

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
                if (key === 'payment_quantity') {
                    // Send the EUR equivalent for accounting
                    data.append(key, formData.payment_total || '0')
                } else if (key === 'on_account') {
                    data.append(key, financials.on_account)
                } else if (key === 'balance') {
                    data.append(key, financials.balance)
                } else if (key === 'fee_agv') {
                    data.append(key, financials.fee_agv)
                } else {
                    data.append(key, val)
                }
            })

            // Meta-data for the new multi-currency payment details
            const pCurrency = formData.payment_currency || 'EUR'
            const symbol = pCurrency === 'EUR' ? '€' : pCurrency === 'PEN' ? 'S/' : '$'
            
            // Handle multiple payments added in the UI
            if (tempPayments.length > 0) {
                data.append('multi_payments', JSON.stringify(tempPayments))
                // Append each proof file with a specific index key
                tempPaymentProofs.forEach((file, i) => {
                    if (file) data.append(`payment_proof_${i}`, file)
                })
            }

            // Handle current payment fields if they have a value (user didn't click "Add" yet)
            if (formData.payment_quantity && parseFloat(formData.payment_quantity) > 0) {
                data.append('payment_original_amount', formData.payment_quantity)
                data.append('payment_total_display', `${symbol} ${parseFloat(formData.payment_quantity || '0').toFixed(2)}`)
                data.append('payment_currency', pCurrency)
                data.append('payment_quantity', formData.payment_total || '0')
            } else {
                data.append('payment_quantity', '0')
            }

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
                 // Ensure the resource is locked again for the agent
                 setUnlockedResources(prev => {
                     const next = new Set(prev)
                     next.delete(selectedFlightId)
                     return next
                 })
            } else {
                 const result = await createFlight(data)
                 if (!result.success) {
                    alert("Error: " + result.error)
                    setIsSubmitting(false)
                    return
                 }
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
            Tipo_Pasaje: f.ticket_type || '-',
            IATA_GDS: f.iata_gds || '-',
            PAX_ADT: f.pax_adt || 0,
            PAX_CHD: f.pax_chd || 0,
            PAX_INF: f.pax_inf || 0,
            PAX_Total: f.pax_total || 0,
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
            // Debt Filter
            if (showDeudaOnly && (f.balance || 0) <= 0) return false

            // Text Search
            const lower = searchTerm.toLowerCase()
            const matchesSearch = !searchTerm || 
                (f.pnr || '').toLowerCase().includes(lower) ||
                `${f.profiles?.first_name} ${f.profiles?.last_name}`.toLowerCase().includes(lower) ||
                (f.profiles?.email || '').toLowerCase().includes(lower) ||
                (f.profiles?.document_number || '').toLowerCase().includes(lower)

            // Status Filter
            const matchesStatus = statusFilter === 'all' || f.status === statusFilter

            // Date Range Filter
            // When in deuda mode, filter by Travel Date. Otherwise by Created At (Registration Date)
            const dateToCompare = showDeudaOnly ? f.travel_date : f.created_at
            const flightDate = new Date(dateToCompare).toISOString().split('T')[0]
            
            const matchesDateFrom = !dateFrom || flightDate >= dateFrom
            const matchesDateTo = !dateTo || flightDate <= dateTo

            return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo
        })
    }, [flights, searchTerm, statusFilter, dateFrom, dateTo, showDeudaOnly])

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
                        {detailsViewerFlight && (
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-3">
                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Resumen de Viaje</span>
                                    <span className="bg-chimipink/10 text-chimipink px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                        {detailsViewerFlight.ticket_type || 'Estándar'}
                                    </span>
                                    <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                        {detailsViewerFlight.iata_gds || 'S/D'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Total Pax</span>
                                        <span className="text-lg font-bold text-slate-700">{detailsViewerFlight.pax_total || 1} Personas</span>
                                    </div>
                                    <div className="flex gap-2 items-center justify-end">
                                        <div className="text-center px-2">
                                            <span className="text-[8px] text-slate-400 uppercase block">ADT</span>
                                            <span className="font-bold text-slate-600">{detailsViewerFlight.pax_adt || 1}</span>
                                        </div>
                                        <div className="text-center px-2 border-l border-slate-200">
                                            <span className="text-[8px] text-slate-400 uppercase block">CHD</span>
                                            <span className="font-bold text-slate-600">{detailsViewerFlight.pax_chd || 0}</span>
                                        </div>
                                        <div className="text-center px-2 border-l border-slate-200">
                                            <span className="text-[8px] text-slate-400 uppercase block">INF</span>
                                            <span className="font-bold text-slate-600">{detailsViewerFlight.pax_inf || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {detailsViewerFlight?.details && (
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-chimipink">Servicios Incluidos:</h4>
                                <ul className="grid grid-cols-1 gap-2">
                                    {Object.entries(detailsViewerFlight.details).map(([key, value]) => {
                                        if (key === 'hotel_custom_days' || key === 'hotel_custom_nights' || key === 'special_note' || key.startsWith('insurance_tourism_date') || !value) return null
                                        
                                        let label = DETAILS_LABELS[key] || key;
                                        
                                        // Specific formatting for dates if it's the tourism insurance
                                        if (key === 'insurance_tourism_active') {
                                            const from = detailsViewerFlight.details?.insurance_tourism_date_from;
                                            const to = detailsViewerFlight.details?.insurance_tourism_date_to;
                                            if (from && to) {
                                                const fromFormatted = new Date(from).toLocaleDateString('es-PE');
                                                const toFormatted = new Date(to).toLocaleDateString('es-PE');
                                                label = `Seguro desde ${fromFormatted} hasta ${toFormatted} (turista / Schengen)`;
                                            }
                                        }

                                        // Custom hotel text
                                        if (key === 'hotel_custom_active') {
                                            const days = detailsViewerFlight.details?.hotel_custom_days || '__';
                                            const nights = detailsViewerFlight.details?.hotel_custom_nights || '__';
                                            label = `Hotel — ${days} días / ${nights} noches`;
                                        }

                                        return (
                                            <li key={key} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                                                <span className="text-green-500">✔</span>
                                                {label}
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

                                                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] bg-white/50 p-2 rounded-md border border-slate-200/50">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-slate-400 text-[9px] uppercase font-bold tracking-tight">Método / Sede</span>
                                                        <span className="font-bold text-slate-700 truncate">
                                                            {payment.metodo_it || payment.metodo_pe || '-'} / {payment.sede_it || payment.sede_pe || '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-slate-400 text-[9px] uppercase font-bold tracking-tight">Monto Recibido</span>
                                                        <span className="font-bold text-slate-700">
                                                            {payment.moneda || 'EUR'} {parseFloat(payment.monto_original || payment.cantidad).toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-slate-400 text-[9px] uppercase font-bold tracking-tight">T. Cambio</span>
                                                        <span className="font-medium text-slate-600">
                                                            {payment.moneda === 'EUR' ? '1.0000 (Base)' : (payment.tipo_cambio || 1).toFixed(4)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 border-l-2 border-emerald-400 pl-3">
                                                        <span className="text-emerald-600 text-[9px] uppercase font-bold tracking-tight italic">Equiv. Abonado</span>
                                                        <span className="font-black text-emerald-700 text-xs">
                                                            € {parseFloat(payment.cantidad).toFixed(2)}
                                                        </span>
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



            <div className="flex justify-center items-center gap-4">
                <Button 
                    variant={showDeudaOnly ? "primary" : "outline"}
                    onClick={() => {
                        setShowDeudaOnly(!showDeudaOnly)
                        setCurrentPage(1)
                    }}
                    className={cn(
                        "font-bold shadow-md transition-all h-10",
                        showDeudaOnly 
                            ? "bg-red-600 hover:bg-red-700 text-white border-red-700" 
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                >
                    <Wallet className={cn("mr-2 h-4 w-4", showDeudaOnly ? "text-white" : "text-red-500")} /> 
                    {showDeudaOnly ? "Ver Todos los Vuelos" : "Vuelos con Deudas"}
                </Button>

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
                            {/* Client Search and Details */}
                            <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                <Label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                    <User className="h-4 w-4 text-chimipink" /> Datos del Cliente
                                </Label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="grid gap-2 relative">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Cliente <span className="text-red-500">*</span></Label>
                                        <div className="relative">
                                            <Input 
                                                placeholder="Buscar cliente..." 
                                                value={clientSearch}
                                                onChange={(e) => {
                                                    setClientSearch(e.target.value)
                                                    setShowClientList(true)
                                                }}
                                                onFocus={() => setShowClientList(true)}
                                                onBlur={() => setTimeout(() => setShowClientList(false), 200)}
                                                disabled={!!selectedFlightId} 
                                                className="bg-white pr-8"
                                            />
                                            {clientSearch && !selectedFlightId ? (
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setClientSearch('')
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

                                    <div className="grid gap-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Correo</Label>
                                        <Input value={formData.client_email} readOnly className="bg-slate-100 h-10" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Teléfono</Label>
                                        <Input value={formData.client_phone} readOnly className="bg-slate-100 h-10" />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Flight Details */}
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                     <Label>Fecha de Viaje</Label>
                                     <div className="relative">
                                         <Input 
                                            type="date" 
                                            name="travel_date" 
                                            value={formData.travel_date} 
                                            onChange={handleInputChange} 
                                            required 
                                            className="pr-8"
                                         />
                                         {formData.travel_date && (
                                             <button 
                                                 type="button"
                                                 onClick={() => setFormData(prev => ({ ...prev, travel_date: '' }))}
                                                 className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                             >
                                                 <X size={14} strokeWidth={3} />
                                             </button>
                                         )}
                                     </div>
                                </div>
                                <div className="grid gap-2">
                                     <Label>Fecha de Retorno</Label>
                                     <div className="relative">
                                         <Input 
                                            type="date" 
                                            name="return_date" 
                                            value={formData.return_date} 
                                            onChange={handleInputChange} 
                                            className="pr-8"
                                         />
                                         {formData.return_date && (
                                             <button 
                                                 type="button"
                                                 onClick={() => setFormData(prev => ({ ...prev, return_date: '' }))}
                                                 className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                             >
                                                 <X size={14} strokeWidth={3} />
                                             </button>
                                         )}
                                     </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2 relative">
                                    <Label className="font-semibold text-slate-700">Tipo de Pasaje</Label>
                                    <div className="relative">
                                        <Input 
                                            name="ticket_type"
                                            value={formData.ticket_type}
                                            onChange={(e) => {
                                                handleInputChange(e)
                                                setShowTicketTypeList(true)
                                            }}
                                            onFocus={() => setShowTicketTypeList(true)}
                                            onBlur={() => setTimeout(() => setShowTicketTypeList(false), 200)}
                                            placeholder="Seleccione o busque el tipo de pasaje..."
                                            autoComplete="off"
                                            className="border-slate-300 focus:ring-chimiteal pr-8"
                                        />
                                        {formData.ticket_type ? (
                                            <button 
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, ticket_type: '' }))}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        ) : (
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        )}
                                    </div>
                                    {showTicketTypeList && (
                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                                            {TICKET_TYPE_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.ticket_type.toLowerCase())).map((opt, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, ticket_type: opt }))
                                                        setShowTicketTypeList(false)
                                                    }}
                                                >
                                                    {opt}
                                                </div>
                                            ))}
                                            {TICKET_TYPE_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.ticket_type.toLowerCase())).length === 0 && (
                                                <div className="p-3 text-xs text-slate-400 italic">No se encontraron coincidencias</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-2 relative">
                                    <Label className="font-semibold text-slate-700">IATA / GDS</Label>
                                    <div className="relative">
                                        <Input 
                                            name="iata_gds"
                                            value={formData.iata_gds}
                                            onChange={(e) => {
                                                handleInputChange(e)
                                                setShowIATAOptions(true)
                                            }}
                                            onFocus={() => setShowIATAOptions(true)}
                                            onBlur={() => setTimeout(() => setShowIATAOptions(false), 200)}
                                            placeholder="Buscar..."
                                            autoComplete="off"
                                            className="border-slate-300 focus:ring-chimiteal pr-8"
                                        />
                                        {formData.iata_gds ? (
                                            <button 
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, iata_gds: '' }))}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        ) : (
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        )}
                                    </div>
                                    {showIATAOptions && (
                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                                            {IATA_OPTIONS.filter(opt => {
                                                // Si el texto es el valor por defecto, mostrar todas las opciones
                                                if (formData.iata_gds === 'sabre suema') return true;
                                                // Si no, filtrar por lo que el usuario escriba
                                                return opt.toLowerCase().includes(formData.iata_gds.toLowerCase());
                                            }).map((opt, idx) => (
                                                <div 
                                                    key={idx}
                                                    className="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, iata_gds: opt }))
                                                        setShowIATAOptions(false)
                                                    }}
                                                >
                                                    {opt}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        👥 TOTAL PAX: <span className="text-chimipink text-lg">{formData.pax_total}</span>
                                    </Label>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="grid gap-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-center gap-1">👤 ADT</Label>
                                        <select 
                                            name="pax_adt" 
                                            value={formData.pax_adt} 
                                            onChange={handleInputChange} 
                                            className="h-9 w-full text-center font-bold border border-slate-200 rounded-md focus:ring-2 focus:ring-chimiteal/20 focus:outline-none bg-white text-sm appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                                        >
                                            {[1, 2, 3, 4, 5].map(n => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </select>
                                        <span className="text-[9px] text-slate-400">Adultos</span>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-center gap-1">🧒 CHD</Label>
                                        <select 
                                            name="pax_chd" 
                                            value={formData.pax_chd} 
                                            onChange={handleInputChange} 
                                            className="h-9 w-full text-center font-bold border border-slate-200 rounded-md focus:ring-2 focus:ring-chimiteal/20 focus:outline-none bg-white text-sm appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                                        >
                                            {[0, 1, 2, 3, 4, 5].map(n => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </select>
                                        <span className="text-[9px] text-slate-400">Niños</span>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-center gap-1">👶 INF</Label>
                                        <select 
                                            name="pax_inf" 
                                            value={formData.pax_inf} 
                                            onChange={handleInputChange} 
                                            className="h-9 w-full text-center font-bold border border-slate-200 rounded-md focus:ring-2 focus:ring-chimiteal/20 focus:outline-none bg-white text-sm appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                                        >
                                            {[0, 1, 2, 3, 4, 5].map(n => (
                                                <option key={n} value={n}>{n}</option>
                                            ))}
                                        </select>
                                        <span className="text-[9px] text-slate-400">Bebés</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                     <Label>PNR</Label>
                                     <Input name="pnr" value={formData.pnr} onChange={handleInputChange} placeholder="Código de reserva" />
                                </div>
                                <div className="grid gap-2 relative">
                                    <Label>Itinerario</Label>
                                    <div className="relative">
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
                                            className="pr-8"
                                        />
                                        {formData.itinerary ? (
                                            <button 
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, itinerary: '' }))}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        ) : (
                                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        )}
                                    </div>
                                    {showItineraryList && (
                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-lg rounded-md mt-1 max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                                            {(itineraries.length > 0 ? itineraries : ITINERARY_OPTIONS).filter(opt => opt.toLowerCase().includes(formData.itinerary.toLowerCase())).map((opt, idx) => (
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

                                    {/* New Insurance Options */}
                                    <div className="mt-3 space-y-3">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-2 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={flightDetails.insurance_tourism_active} 
                                                    onChange={(e) => handleDetailChange('insurance_tourism_active', e.target.checked)} 
                                                    className="rounded border-slate-300 text-chimipink focus:ring-chimipink" 
                                                />
                                                <span className="font-medium">Seguro desde</span>
                                            </label>
                                             <div className="flex items-center gap-2">
                                                <div className="relative">
                                                    <input 
                                                        type="date" 
                                                        value={flightDetails.insurance_tourism_date_from}
                                                        onChange={(e) => handleDetailChange('insurance_tourism_date_from', e.target.value)}
                                                        className="text-xs border rounded p-1 focus:ring-1 focus:ring-chimipink outline-none pr-6"
                                                    />
                                                    {flightDetails.insurance_tourism_date_from && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDetailChange('insurance_tourism_date_from', '')}
                                                            className="absolute right-1 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                        >
                                                            <X size={12} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-500">hasta</span>
                                                <div className="relative">
                                                    <input 
                                                        type="date" 
                                                        value={flightDetails.insurance_tourism_date_to}
                                                        onChange={(e) => handleDetailChange('insurance_tourism_date_to', e.target.value)}
                                                        className="text-xs border rounded p-1 focus:ring-1 focus:ring-chimipink outline-none pr-6"
                                                    />
                                                    {flightDetails.insurance_tourism_date_to && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleDetailChange('insurance_tourism_date_to', '')}
                                                            className="absolute right-1 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                        >
                                                            <X size={12} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-xs text-slate-400 italic">(turista / Schengen)</span>
                                        </div>

                                        <label className="flex items-center gap-2 text-sm cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                            <input 
                                                type="checkbox" 
                                                checked={flightDetails.insurance_migratory} 
                                                onChange={(e) => handleDetailChange('insurance_migratory', e.target.checked)} 
                                                className="rounded border-slate-300 text-chimipink focus:ring-chimipink" 
                                            />
                                            <span className="font-medium text-slate-700">Seguro migratorio (solo para control migratorio)</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Documentación */}
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">📄 Documentación</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <label className="flex items-start gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                            <input type="checkbox" checked={flightDetails.doc_invitation_letter} onChange={(e) => handleDetailChange('doc_invitation_letter', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink mt-1" />
                                            <div className="flex flex-col">
                                                <span className="font-medium">Redacción carta de invitación con documentos del anfitrión</span>
                                                <span className="text-[10px] text-slate-500 leading-tight">
                                                    (El cliente envía copia del documento de identidad o Permesso di soggiorno y Tessera sanitaria del familiar en Italia.)
                                                </span>
                                            </div>
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
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                <input type="checkbox" checked={flightDetails.svc_airport_assistance} onChange={(e) => handleDetailChange('svc_airport_assistance', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                                Asistencia aeroportuaria
                                            </label>
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                <input type="checkbox" checked={flightDetails.svc_return_activation} onChange={(e) => handleDetailChange('svc_return_activation', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                                Activación pasaje retorno
                                            </label>
                                            <label className="flex items-center gap-2 text-[11px] cursor-pointer bg-emerald-50 border border-emerald-100 text-emerald-800 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                                                <input type="checkbox" checked={flightDetails.svc_stewardess_um} onChange={(e) => handleDetailChange('svc_stewardess_um', e.target.checked)} className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" />
                                                Solicitud de azafata para menor de edad (UMNR) +225 EURO PAGO SÍ INCLUIDO EN EL PRECIO
                                            </label>
                                            <label className="flex items-center gap-2 text-[11px] cursor-pointer bg-rose-50 border border-rose-100 text-rose-800 p-1.5 rounded-lg hover:bg-rose-100 transition-colors">
                                                <input type="checkbox" checked={flightDetails.svc_stewardess_um_unpaid} onChange={(e) => handleDetailChange('svc_stewardess_um_unpaid', e.target.checked)} className="rounded border-rose-300 text-rose-600 focus:ring-rose-500" />
                                                Solicitud de azafata para menor de edad (UMNR) +225 EURO PAGO NO INCLUIDO EN EL PRECIO
                                            </label>
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                <input type="checkbox" checked={flightDetails.svc_pet_travel} onChange={(e) => handleDetailChange('svc_pet_travel', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                                Viaja con mascota
                                            </label>
                                        </div>

                                        {/* Viaje Especial inside Additional Services */}
                                        <div className="pt-1">
                                            <Label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-tight">📝 Viaje especial (Observaciones)</Label>
                                            <Input 
                                                value={flightDetails.special_note} 
                                                onChange={(e) => handleDetailChange('special_note', e.target.value)} 
                                                placeholder="Ej: Viaja con silla de ruedas, requiere comida especial..." 
                                                className="bg-white h-9 text-sm border-slate-200 focus:ring-chimipink"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Hotel */}
                                <div>
                                    <Label className="text-xs font-semibold text-slate-700 mb-2 block">🏨 Reserva de hotel</Label>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                <input type="checkbox" checked={flightDetails.hotel_3d_2n} onChange={(e) => handleDetailChange('hotel_3d_2n', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                                3 días / 2 noches <span className="text-[10px] text-slate-500 font-normal ml-0.5">(Utilizable 1 día)</span>
                                            </label>
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                <input type="checkbox" checked={flightDetails.hotel_2d_1n} onChange={(e) => handleDetailChange('hotel_2d_1n', e.target.checked)} className="rounded border-slate-300 text-chimipink focus:ring-chimipink" />
                                                2 días / 1 noche
                                            </label>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                                                <input 
                                                    type="checkbox" 
                                                    checked={flightDetails.hotel_custom_active} 
                                                    onChange={(e) => handleDetailChange('hotel_custom_active', e.target.checked)} 
                                                    className="rounded border-slate-300 text-chimipink focus:ring-chimipink" 
                                                />
                                                <span className="font-medium">Hotel —</span>
                                            </label>
                                            <div className="flex items-center gap-1.5 flex-1">
                                                <Input 
                                                    type="number"
                                                    value={flightDetails.hotel_custom_days}
                                                    onChange={(e) => handleDetailChange('hotel_custom_days', e.target.value)}
                                                    placeholder="0"
                                                    className="h-7 w-12 text-center text-xs border-slate-200 focus:ring-chimipink bg-white p-0"
                                                />
                                                <span className="text-[10px] text-slate-500 font-medium">días /</span>
                                                <Input 
                                                    type="number"
                                                    value={flightDetails.hotel_custom_nights}
                                                    onChange={(e) => handleDetailChange('hotel_custom_nights', e.target.value)}
                                                    placeholder="0"
                                                    className="h-7 w-12 text-center text-xs border-slate-200 focus:ring-chimipink bg-white p-0"
                                                />
                                                <span className="text-[10px] text-slate-500 font-medium">noches</span>
                                            </div>
                                        </div>
                                    </div>
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
                                        value={financials.on_account} 
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
                                    <Input type="number" step="0.01" name="balance" value={financials.balance} readOnly className="bg-slate-100 font-bold" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>FEE-AGV (Automático)</Label>
                                    <Input type="number" step="0.01" name="fee_agv" value={financials.fee_agv} readOnly className="bg-slate-100 font-bold text-emerald-600" />
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
                                                                    <div className="flex gap-2">
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => {
                                                                                setEditingPaymentIndex(null)
                                                                                setEditPaymentData(null)
                                                                            }}
                                                                            className="text-red-400 hover:text-red-600 transition-colors p-1"
                                                                            title="Cancelar"
                                                                        >
                                                                            <X size={18} />
                                                                        </button>
                                                                        <button 
                                                                            type="button" 
                                                                            onClick={() => handleSaveEditPayment(selectedFlightId!)}
                                                                            className="text-emerald-400 hover:text-emerald-600 transition-colors p-1"
                                                                            title="Guardar"
                                                                        >
                                                                            <Check size={18} />
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {editPaymentData && (
                                                                    <>
                                                                        <div className="grid grid-cols-1 gap-y-3">
                                                                            <div className="grid gap-1 relative">
                                                                                <Label className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-1">🏢 Sedes</Label>
                                                                                <div className="relative">
                                                                                    <Input 
                                                                                        className="h-8 text-xs bg-slate-50 border-slate-200 pr-8"
                                                                                        value={editPaymentData.sede_it}
                                                                                        onChange={(e) => {
                                                                                            const val = e.target.value
                                                                                            setEditPaymentData(prev => prev ? {...prev, sede_it: val} : null)
                                                                                            setShowEditSedeITList(true)
                                                                                        }}
                                                                                        onFocus={() => setShowEditSedeITList(true)}
                                                                                        onBlur={() => setTimeout(() => setShowEditSedeITList(false), 200)}
                                                                                    />
                                                                                    {editPaymentData.sede_it && (
                                                                                        <button 
                                                                                            type="button" 
                                                                                            onClick={() => setEditPaymentData(prev => prev ? {...prev, sede_it: ''} : null)}
                                                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                                                        >
                                                                                            <X size={12} strokeWidth={3} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                {showEditSedeITList && (
                                                                                    <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-32 overflow-y-auto">
                                                                                        {SEDE_IT_OPTIONS.filter(opt => opt.toLowerCase().includes(editPaymentData.sede_it.toLowerCase())).map((opt, sidx) => (
                                                                                            <div key={sidx} className="p-2 hover:bg-slate-50 cursor-pointer text-[11px] border-b last:border-0" onClick={() => {
                                                                                                setEditPaymentData(prev => prev ? {...prev, sede_it: opt} : null)
                                                                                                setShowEditSedeITList(false)
                                                                                            }}>{opt}</div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-3">
                                                                            <div className="grid gap-1 relative">
                                                                                    <Label className="text-[10px] uppercase font-bold text-blue-600 flex items-center gap-1">
                                                                                    <Image src="https://flagcdn.com/w20/it.png" width={14} height={10} alt="italia" className="rounded-sm inline-block" />
                                                                                    Método Pago IT
                                                                                </Label>
                                                                                <div className="relative">
                                                                                    <Input 
                                                                                        className="h-8 text-xs bg-blue-50/50 border-blue-200 pr-8"
                                                                                        value={editPaymentData.metodo_it}
                                                                                        onChange={(e) => {
                                                                                            const val = e.target.value
                                                                                            setEditPaymentData(prev => prev ? {...prev, metodo_it: val} : null)
                                                                                            setShowEditMetodoITList(true)
                                                                                        }}
                                                                                        onFocus={() => setShowEditMetodoITList(true)}
                                                                                        onBlur={() => setTimeout(() => setShowEditMetodoITList(false), 200)}
                                                                                        placeholder="Buscar método..."
                                                                                    />
                                                                                    {editPaymentData.metodo_it && (
                                                                                        <button 
                                                                                            type="button" 
                                                                                            onClick={() => setEditPaymentData(prev => prev ? {...prev, metodo_it: ''} : null)}
                                                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                                                        >
                                                                                            <X size={12} strokeWidth={3} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                {showEditMetodoITList && (
                                                                                    <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-32 overflow-y-auto">
                                                                                        {paymentMethodsIT
                                                                                            .map(m => m.name)
                                                                                            .filter(opt => opt.toLowerCase().includes(editPaymentData.metodo_it.toLowerCase()))
                                                                                            .map((opt, sidx) => (
                                                                                            <div key={sidx} className="p-2 hover:bg-slate-50 cursor-pointer text-xs" onClick={() => {
                                                                                                setEditPaymentData(prev => prev ? {...prev, metodo_it: opt} : null)
                                                                                                setShowEditMetodoITList(false)
                                                                                            }}>{opt}</div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="grid gap-1 relative">
                                                                                    <Label className="text-[10px] uppercase font-bold text-rose-600 flex items-center gap-1">
                                                                                    <Image src="https://flagcdn.com/w20/pe.png" width={14} height={10} alt="peru" className="rounded-sm inline-block" />
                                                                                    Método Pago PE
                                                                                </Label>
                                                                                <div className="relative">
                                                                                    <Input 
                                                                                        className="h-8 text-xs bg-rose-50/50 border-rose-200 pr-8"
                                                                                        value={editPaymentData.metodo_pe}
                                                                                        onChange={(e) => {
                                                                                            const val = e.target.value
                                                                                            setEditPaymentData(prev => prev ? {...prev, metodo_pe: val} : null)
                                                                                            setShowEditMetodoPEList(true)
                                                                                        }}
                                                                                        onFocus={() => setShowEditMetodoPEList(true)}
                                                                                        onBlur={() => setTimeout(() => setShowEditMetodoPEList(false), 200)}
                                                                                        placeholder="Buscar método..."
                                                                                    />
                                                                                    {editPaymentData.metodo_pe && (
                                                                                        <button 
                                                                                            type="button" 
                                                                                            onClick={() => setEditPaymentData(prev => prev ? {...prev, metodo_pe: ''} : null)}
                                                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                                                        >
                                                                                            <X size={12} strokeWidth={3} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                                {showEditMetodoPEList && (
                                                                                    <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-32 overflow-y-auto">
                                                                                        {paymentMethodsPE
                                                                                            .map(m => m.name)
                                                                                            .filter(opt => opt.toLowerCase().includes(editPaymentData.metodo_pe.toLowerCase()))
                                                                                            .map((opt, sidx) => (
                                                                                            <div key={sidx} className="p-2 hover:bg-slate-50 cursor-pointer text-xs" onClick={() => {
                                                                                                setEditPaymentData(prev => prev ? {...prev, metodo_pe: opt} : null)
                                                                                                setShowEditMetodoPEList(false)
                                                                                            }}>{opt}</div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="grid gap-1">
                                                                                <Label className="text-[10px] uppercase font-bold text-slate-500">Cantidad ({editPaymentData.moneda || 'EUR'} {editPaymentData.moneda === 'EUR' ? '€' : editPaymentData.moneda === 'PEN' ? 'S/' : '$'})</Label>
                                                                                <Input 
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    className="h-8 text-xs font-bold bg-yellow-50/50 border-yellow-200"
                                                                                    value={editPaymentData.monto_original || editPaymentData.cantidad}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value
                                                                                        setEditPaymentData(prev => {
                                                                                            if (!prev) return null
                                                                                            const rate = prev.tipo_cambio || 1
                                                                                            const currency = prev.moneda || 'EUR'
                                                                                            
                                                                                            let amount_eur = 0
                                                                                            if (currency === 'EUR') {
                                                                                                amount_eur = parseFloat(val) || 0
                                                                                            } else if (currency === 'PEN') {
                                                                                                amount_eur = rate !== 0 ? (parseFloat(val) || 0) / rate : 0
                                                                                            } else {
                                                                                                amount_eur = (parseFloat(val) || 0) * rate
                                                                                            }
                                                                                            
                                                                                            const sym = currency === 'EUR' ? '€' : currency === 'PEN' ? 'S/' : '$'
                                                                                            return {
                                                                                                ...prev, 
                                                                                                monto_original: val, 
                                                                                                cantidad: amount_eur.toFixed(2),
                                                                                                total: `${sym} ${parseFloat(val || '0').toFixed(2)}`
                                                                                            }
                                                                                        })
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div className="grid gap-1">
                                                                                <Label className="text-[10px] uppercase font-bold text-slate-500">Equiv. EUR (€)</Label>
                                                                                <Input 
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    className="h-8 text-xs font-bold bg-emerald-50 text-emerald-700 border-emerald-100"
                                                                                    value={editPaymentData.cantidad}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value
                                                                                        setEditPaymentData(prev => prev ? {...prev, cantidad: val} : null)
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div className="grid gap-1">
                                                                                <Label className="text-[10px] uppercase font-bold text-slate-500">T. Cambio</Label>
                                                                                <Input 
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    className="h-8 text-xs bg-white"
                                                                                    value={editPaymentData.tipo_cambio}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value
                                                                                        setEditPaymentData(prev => {
                                                                                            if (!prev) return null
                                                                                            const amt = parseFloat(prev.monto_original || prev.cantidad)
                                                                                            const rate = parseFloat(val) || 1
                                                                                            const currency = prev.moneda || 'EUR'
                                                                                            
                                                                                            let amount_eur = 0
                                                                                            if (currency === 'EUR') {
                                                                                                amount_eur = amt
                                                                                            } else if (currency === 'PEN') {
                                                                                                amount_eur = rate !== 0 ? amt / rate : 0
                                                                                            } else {
                                                                                                amount_eur = amt * rate
                                                                                            }
                                                                                            
                                                                                            const sym = currency === 'EUR' ? '€' : currency === 'PEN' ? 'S/' : '$'
                                                                                            return {
                                                                                                ...prev, 
                                                                                                tipo_cambio: rate, 
                                                                                                cantidad: amount_eur.toFixed(2),
                                                                                                total: `${sym} ${amt.toFixed(2)}`
                                                                                            }
                                                                                        })
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                            <div className="grid gap-1">
                                                                                <Label className="text-[10px] uppercase font-bold text-slate-500 italic">Pagaría Total</Label>
                                                                                <Input 
                                                                                    readOnly
                                                                                    className="h-8 text-xs font-medium bg-slate-50 text-slate-500"
                                                                                    value={editPaymentData.total}
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
                                                                    </>
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
                                                                        <span className="font-bold text-emerald-600 text-base leading-none block">€ {parseFloat(payment.cantidad || '0').toFixed(2)}</span>
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
                                                                                // Ensure we have correct fields for multicurrency editing
                                                                                setEditPaymentData({
                                                                                    ...payment,
                                                                                    moneda: payment.moneda || 'EUR',
                                                                                    monto_original: payment.monto_original || payment.cantidad,
                                                                                    tipo_cambio: payment.tipo_cambio || 1.0,
                                                                                    total: payment.total || `€ ${payment.cantidad}`
                                                                                })
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

                                {tempPayments.length > 0 && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 px-1 pb-2">
                                        <div className="flex items-center gap-2 opacity-60">
                                            <div className="h-px flex-1 bg-slate-200"></div>
                                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abonos añadidos (sin guardar)</Label>
                                            <div className="h-px flex-1 bg-slate-200"></div>
                                        </div>
                                        <div className="space-y-2">
                                            {tempPayments.map((payment, idx) => (
                                                <div key={idx} className="group relative bg-emerald-50/30 border border-emerald-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all border-l-4 border-l-emerald-400">
                                                    <div className="flex justify-between items-center transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="grid gap-0.5">
                                                                <span className="font-bold text-slate-700 flex items-center gap-2 text-xs">
                                                                    {payment.metodo_it || payment.metodo_pe || 'Otros'}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 flex items-center gap-1 font-medium italic">
                                                                    <Building2 className="h-2.5 w-2.5" /> {payment.sede_it || payment.sede_pe || 'S/D'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-right">
                                                                <span className="font-bold text-emerald-600 text-sm leading-none block">€ {parseFloat(payment.cantidad || '0').toFixed(2)}</span>
                                                                <span className="text-[9px] text-slate-400 uppercase tracking-tighter">
                                                                    {payment.moneda && payment.moneda !== 'EUR' 
                                                                        ? `${payment.total}`
                                                                        : `€ ${parseFloat(payment.cantidad || '0').toFixed(2)}`
                                                                    }
                                                                </span>
                                                            </div>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleRemoveTempPayment(idx)}
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
                                            {showPaymentFields ? '📝 Nuevo Abono' : '💰 Registrar Nuevo Pago'}
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
                                                        onClick={handleAddPaymentToTemp}
                                                        className="text-emerald-400 hover:text-emerald-600 transition-colors p-1"
                                                        title="Añadir Pago"
                                                    >
                                                        <Check size={20} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <Button 
                                                    type="button" 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => setShowPaymentFields(true)}
                                                    className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                                >
                                                    + Agregar Pago
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {showPaymentFields && (
                                        <>
                                            <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 border-t pt-4 border-slate-200">
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-slate-700">🏢 Sedes</Label>
                                                    <div className="relative">
                                                        <Input 
                                                            name="sede_it" 
                                                            value={formData.sede_it} 
                                                            onChange={(e) => {
                                                                handleInputChange(e)
                                                                setShowSedeITList(true)
                                                            }}
                                                            onFocus={() => setShowSedeITList(true)}
                                                            onBlur={() => setTimeout(() => setShowSedeITList(false), 200)}
                                                            placeholder="Buscar sede..."
                                                            autoComplete="off"
                                                            className="bg-slate-50 border-slate-200 focus:ring-slate-500 pr-8"
                                                        />
                                                        {formData.sede_it && (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormData(p => ({ ...p, sede_it: '' }))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {showSedeITList && (
                                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                            {SEDE_IT_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.sede_it.toLowerCase())).map((opt, idx) => (
                                                                <div key={idx} className="p-2 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                    setFormData(p => ({ ...p, sede_it: opt }))
                                                                    setShowSedeITList(false)
                                                                }}>{opt}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
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
                                                                handleInputChange(e)
                                                                setShowMetodoITList(true)
                                                            }}
                                                            onFocus={() => setShowMetodoITList(true)}
                                                            onBlur={() => setTimeout(() => setShowMetodoITList(false), 200)}
                                                            placeholder="Buscar método..."
                                                            autoComplete="off"
                                                            className="bg-blue-50/50 border-blue-200 focus:ring-blue-500 pr-8"
                                                        />
                                                        {formData.payment_method_it && (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormData(p => ({ ...p, payment_method_it: '' }))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
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
                                                                handleInputChange(e)
                                                                setShowMetodoPEList(true)
                                                            }}
                                                            onFocus={() => setShowMetodoPEList(true)}
                                                            onBlur={() => setTimeout(() => setShowMetodoPEList(false), 200)}
                                                            placeholder="Buscar método..."
                                                            autoComplete="off"
                                                            className="bg-rose-50/50 border-rose-200 focus:ring-rose-500 pr-8"
                                                        />
                                                        {formData.payment_method_pe && (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormData(p => ({ ...p, payment_method_pe: '' }))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
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

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                                                <div className="grid gap-2">
                                                    <Label className="text-xs font-bold text-slate-700">Moneda de Pago</Label>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {['EUR', 'PEN', 'USD'].map(curr => (
                                                            <Button
                                                                key={curr}
                                                                type="button"
                                                                variant={formData.payment_currency === curr ? 'primary' : 'outline'}
                                                                className={`h-9 text-[10px] font-bold transition-all ${
                                                                    formData.payment_currency === curr 
                                                                    ? 'text-white shadow-sm' 
                                                                    : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'
                                                                }`}
                                                                onClick={() => {
                                                                    const fakeEvent = {
                                                                        target: { name: 'payment_currency', value: curr }
                                                                    } as React.ChangeEvent<HTMLInputElement>;
                                                                    handleInputChange(fakeEvent);
                                                                }}
                                                            >
                                                                {curr === 'EUR' ? '€ EUR' : curr === 'PEN' ? 'S/ PEN' : '$ USD'}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-xs font-bold text-slate-700">
                                                        {formData.payment_currency === 'EUR' ? 'Cantidad (EUR €)' : 
                                                         formData.payment_currency === 'PEN' ? 'Cantidad (Soles S/)' : 'Cantidad (Dólares $)'}
                                                    </Label>
                                                    <Input 
                                                        type="number" 
                                                        step="0.01"
                                                        name="payment_quantity" 
                                                        value={formData.payment_quantity} 
                                                        onChange={handleInputChange} 
                                                        className="bg-yellow-50/50 border-yellow-200 focus:ring-yellow-500 font-bold"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                                                <div className="grid gap-2">
                                                    <Label className="text-xs font-bold text-slate-700 flex justify-between">
                                                        <span>Tipo de Cambio</span>
                                                        <span className="text-[10px] font-normal text-slate-400">
                                                            {formData.payment_currency === 'EUR' ? 'Base EUR' : 
                                                             formData.payment_currency === 'PEN' ? `1 € = ${formData.payment_exchange_rate} S/` : 
                                                             `1 $ = ${formData.payment_exchange_rate} €`}
                                                        </span>
                                                    </Label>
                                                    <Input 
                                                        type="number" 
                                                        step="0.01" 
                                                        name="payment_exchange_rate" 
                                                        value={formData.payment_exchange_rate} 
                                                        onChange={handleInputChange} 
                                                        disabled={formData.payment_currency === 'EUR'}
                                                        className={formData.payment_currency === 'EUR' ? "bg-slate-50 opacity-60" : "bg-white border-blue-100 focus:ring-blue-500"}
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label className="text-xs font-bold text-emerald-700">Equivalente a Abonar (EUR €)</Label>
                                                    <div className="relative">
                                                        <Input 
                                                            type="number"
                                                            step="0.01"
                                                            name="payment_total" 
                                                            value={formData.payment_total} 
                                                            onChange={handleInputChange}
                                                            className="bg-emerald-50 text-emerald-700 font-black border-emerald-100 flex items-center"
                                                        />
                                                        {formData.payment_currency !== 'EUR' && (
                                                            <div className="text-[9px] text-emerald-600 mt-1 italic">
                                                                Sugerido: {formData.payment_quantity} {formData.payment_currency} {formData.payment_currency === 'PEN' ? '÷' : '×'} {formData.payment_exchange_rate} = € {
                                                                    (formData.payment_currency === 'PEN' 
                                                                        ? (parseFloat(formData.payment_exchange_rate) !== 0 ? parseFloat(formData.payment_quantity) / parseFloat(formData.payment_exchange_rate) : 0)
                                                                        : (parseFloat(formData.payment_quantity) * parseFloat(formData.payment_exchange_rate))
                                                                    ).toFixed(2)
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 gap-4 mt-3">
                                                <div className="grid gap-2">
                                                    <Label className="text-xs font-bold text-slate-700">Foto de Comprobante (Opcional)</Label>
                                                    <Input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                                                        className="cursor-pointer file:bg-chimiteal/10 file:text-chimiteal file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 file:text-xs file:font-semibold"
                                                    />
                                                </div>
                                            </div>
                                        </>
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
                                    {FLIGHT_STATUSES.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
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
                        <div className="relative min-w-[200px] flex-1 group">
                             <Input 
                                placeholder="Buscar por PNR, nombre, email o doc..." 
                                className="pl-10 pr-10 border-slate-200 bg-white focus:ring-chimiteal"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value)
                                    setCurrentPage(1) 
                                }}
                            />
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            {searchTerm && (
                                <button 
                                    onClick={() => {setSearchTerm(''); setCurrentPage(1);}}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        
                        <select 
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Todos los Estados</option>
                            {FLIGHT_STATUSES.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
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
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                >
                                    <X size={14} strokeWidth={3} />
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
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                >
                                    <X size={14} strokeWidth={3} />
                                </button>
                            )}
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
                                    {showDeudaOnly && <th className="px-6 py-4 font-medium">Teléfono</th>}
                                    <th className="px-6 py-4 font-medium">Agente</th>
                                    {!showDeudaOnly && (
                                        <>
                                            <th className="px-6 py-4 font-medium">Itinerario</th>
                                            <th className="px-6 py-4 font-medium">Tipo Pasaje</th>
                                            <th className="px-6 py-4 font-medium">IATA / GDS</th>
                                            <th className="px-6 py-4 font-medium text-center">PAX</th>
                                            <th className="px-6 py-4 font-medium text-center">Incluye</th>
                                            <th className="px-6 py-4 font-medium">Neto</th>
                                        </>
                                    )}
                                    <th className="px-6 py-4 font-medium">Vendido</th>
                                    {!showDeudaOnly && <th className="px-6 py-4 font-medium">Fee AGV</th>}
                                    <th className="px-6 py-4 font-medium">A Cuenta</th>
                                    <th className="px-6 py-4 font-medium">Saldo</th>
                                    {!showDeudaOnly && (
                                        <>
                                            <th className="px-6 py-4 font-medium">Pago</th>
                                            <th className="px-6 py-4 font-medium text-center">Docs</th>
                                            <th className="px-6 py-4 font-medium">Estado</th>
                                            <th className="px-2 sm:px-6 py-4 font-medium text-right sticky right-0 bg-pink-100/90 backdrop-blur-sm z-20 border-l border-pink-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] text-pink-700">Acciones</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentFlights.length === 0 ? (
                                    <tr>
                                        <td colSpan={19} className="px-6 py-8 text-center text-slate-500">No se encontraron vuelos.</td>
                                    </tr>
                                ) : (
                                                                        currentFlights.map((flight) => (
                                        <tr key={flight.id} className="bg-white hover:bg-slate-50/50 group">
                                            <td className="px-6 py-4 text-xs text-slate-500">
                                                {new Date(flight.created_at).toLocaleDateString('es-PE', { timeZone: 'UTC' })}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-700">{new Date(flight.travel_date).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</td>
                                            <td className="px-6 py-4 font-mono text-slate-600">{flight.pnr || '-'}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900">{flight.profiles?.first_name} {flight.profiles?.last_name}</div>
                                                <div className="text-xs text-slate-500">{flight.profiles?.email}</div>
                                            </td>
                                            {showDeudaOnly && (
                                                <td className="px-6 py-4">
                                                    {flight.profiles?.phone ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-600 font-medium">{flight.profiles.phone}</span>
                                                            <button 
                                                                onClick={() => handleCopyPhone(flight.id, flight.profiles!.phone)}
                                                                className="text-slate-400 hover:text-chimipink transition-colors"
                                                                title="Copiar teléfono"
                                                            >
                                                                {copiedPhoneId === flight.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                                            </button>
                                                            {copiedPhoneId === flight.id && (
                                                                <span className="text-[10px] text-emerald-600 font-bold animate-in fade-in zoom-in-95">¡Copiado!</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-slate-600 font-medium">
                                                    {flight.agent ? `${flight.agent.first_name} ${flight.agent.last_name}` : '-'}
                                                </div>
                                            </td>
                                            {!showDeudaOnly && (
                                                <>
                                                    <td className="px-6 py-4 max-w-[150px] truncate" title={flight.itinerary}>
                                                        {flight.itinerary || '-'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium inline-block whitespace-nowrap">
                                                            {flight.ticket_type || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[10px] text-chimiteal font-bold uppercase whitespace-nowrap">
                                                            {flight.iata_gds || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm font-bold text-slate-700">{flight.pax_total || 1}</span>
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
                                                </>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap">€ {(flight.sold_price || 0).toFixed(2)}</td>
                                            {!showDeudaOnly && (
                                                <td className="px-6 py-4 whitespace-nowrap text-emerald-600 font-semibold">€ {(flight.fee_agv || 0).toFixed(2)}</td>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap">€ {flight.on_account.toFixed(2)}</td>
                                            <td className="px-6 py-4 font-medium whitespace-nowrap">
                                                {flight.balance > 0 ? (
                                                    <span className="text-red-600 font-black">€ {flight.balance.toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-emerald-600">Pagado</span>
                                                )}
                                            </td>
                                            {!showDeudaOnly && (
                                                <>
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
                                                                flight.status === 'Finalizado' 
                                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 focus:ring-emerald-500' 
                                                                    : flight.status === 'Cancelado' || flight.status === 'Deportado'
                                                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500'
                                                                    : flight.status === 'En tránsito' || flight.status === 'En migración'
                                                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 focus:ring-blue-500'
                                                                    : flight.status === 'No-show (no se presentó)'
                                                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-500'
                                                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200 focus:ring-amber-500'
                                                                }`}
                                                            >
                                                                {FLIGHT_STATUSES.map(s => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 sm:px-6 py-4 text-right sticky right-0 bg-pink-50/90 backdrop-blur-sm group-hover:bg-pink-100 z-10 border-l border-pink-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] transition-colors">
                                                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                onClick={() => handleEditClick(flight)}
                                                                className={cn(
                                                                    userRole === 'agent' && !unlockedResources.has(flight.id) && "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                                )}
                                                                title={userRole === 'agent' && !unlockedResources.has(flight.id) ? "Solicitar permiso para editar" : "Editar"}
                                                            >
                                                                {userRole === 'agent' && !unlockedResources.has(flight.id) ? (
                                                                    <Lock className="h-4 w-4" />
                                                                ) : unlockedResources.has(flight.id) ? (
                                                                    <Unlock className="h-4 w-4 text-emerald-600" />
                                                                ) : (
                                                                    <Edit className="h-4 w-4 text-slate-400" />
                                                                )}
                                                            </Button>
                                                            {(userRole === 'admin' || userRole === 'supervisor') && (
                                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteFlight(flight.id)}>
                                                                    <Trash2 className="h-4 w-4 text-red-400" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>
                                            )}
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
            <EditRequestModal 
            isOpen={isPermissionModalOpen}
            onClose={() => setIsPermissionModalOpen(false)}
            resourceType="flights"
            resourceId={pendingResourceId || ''}
            resourceName={pendingResourceName}
        />
    </div>
    )
}
