"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Image from "next/image"
import { 
    Search, Plus, FileSpreadsheet, Pencil, Trash2, 
    ChevronLeft, ChevronRight, FileText, FolderOpen, Download, X,
    Building2, Calendar, Check, NotebookPen, Copy
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

interface ExpenseDetail {
    description: string
    amount: number
    currency: string
    category: string
    sede_it?: string
    sede_pe?: string
    metodo_it?: string
    metodo_pe?: string
    total_formatted?: string
    tipo_cambio?: number
    created_at?: string
    proof_path?: string
}

const SEDE_IT_OPTIONS = ["turro milano", "corsico milano", "roma", "lima"]
const PAYMENT_METHOD_IT_OPTIONS = [
    "EFEC TURRO — MILANO",
    "EFEC CORSICO — MILANO",
    "EFEC ROMA",
    "UNICREDIT CHIMI",
    "BANK WISE",
    "BONIFICO SUEMA",
    "POS — UNICREDIT CHIMI",
    "WESTERN UNION",
    "RIA",
    "OTRO GIRO"
]
const PAYMENT_METHOD_PE_OPTIONS = [
    "EFEC LIMA SOL",
    "EFEC LIMA EURO",
    "EFEC LIMA DOLAR",
    "BCP SOLES CHIMI",
    "BCP DOLAR",
    "BANCA EURO PERÚ",
    "POS / LINK — BCP CHIMI",
    "WESTERN UNION",
    "RIA",
    "OTRO GIRO"
]
const CURRENCY_OPTIONS = ["EUR", "PEN", "USD"]
const PERU_BANK_OPTIONS = [
    "BCP",
    "BBVA",
    "INTERBANK",
    "SCOTIABANK",
    "BANCO DE LA NACIÓN",
    "YAPE",
    "PLIN",
    "CAJA AREQUIPA",
    "CAJA PIURA",
    "CAJA HUANCAYO",
    "CAJA CUSCO",
    "CAJA TRUJILLO",
    "BANBIF",
    "INTERAMERICANO",
    "BANCO PICHINCHA",
    "OTROS"
]

export default function MoneyTransfersPage() {
    // Main Data State
    const [transfers, setTransfers] = useState<MoneyTransfer[]>([])
    const [clients, setClients] = useState<ClientProfile[]>([])
    
    // UI State
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [searchClientTerm, setSearchClientTerm] = useState('')
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    
    // Pagination & Filters
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'delivered' | 'cancelled'>('all')

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
        transfer_mode: "pen_to_eur",
        amount_sent: "",
        exchange_rate: "",
        amount_received: "",
        commission_percentage: "",
        commission: "",
        total_amount: "",
        on_account: "0.00",
        balance: "0.00",
        beneficiary_name: "",
        beneficiary_document: "",
        beneficiary_phone: "",
        beneficiary_bank: "",
        beneficiary_account: "",
        transfer_code: "",
        status: "scheduled",
        payment_total: "",
        // Multi-payment temp fields
        sede_it: "",
        sede_pe: "",
        payment_method_it: "",
        payment_method_pe: "",
        payment_quantity: "",
        payment_exchange_rate: "1.0",
        payment_currency: "EUR",
        // Multi-expense temp fields
        expense_sede_it: "",
        expense_sede_pe: "",
        expense_method_it: "",
        expense_method_pe: "",
        expense_quantity: "",
        expense_exchange_rate: "1.0",
        expense_currency: "EUR",
        expense_total: "",
        expense_category: "Comisión Bancaria",
        expense_description: ""
    })

    // Additional multi-item states
    const [tempPayments, setTempPayments] = useState<PaymentDetail[]>([])
    const [tempExpenses, setTempExpenses] = useState<ExpenseDetail[]>([])
    const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null)
    const [expenseProofFile, setExpenseProofFile] = useState<File | null>(null)
    const [tempPaymentProofs, setTempPaymentProofs] = useState<(File | null)[]>([])
    const [tempExpenseProofs, setTempExpenseProofs] = useState<(File | null)[]>([])
    const [showPaymentFields, setShowPaymentFields] = useState(false)
    const [showExpenseFields, setShowExpenseFields] = useState(false)
    
    // Dropdown visibility states
    const [showSedeITList, setShowSedeITList] = useState(false)
    const [showMetodoITList, setShowMetodoITList] = useState(false)
    const [showMetodoPEList, setShowMetodoPEList] = useState(false)

    const [showExSedeITList, setShowExSedeITList] = useState(false)
    const [showExMetodoITList, setShowExMetodoITList] = useState(false)
    const [showExMetodoPEList, setShowExMetodoPEList] = useState(false)
    const [showBankList, setShowBankList] = useState(false)

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
        if (['amount_sent', 'exchange_rate', 'commission', 'commission_percentage', 'payment_quantity', 'payment_exchange_rate', 'expense_quantity', 'expense_exchange_rate'].includes(name)) {
             if (!/^\d*\.?\d*$/.test(value)) return
        }

        // Restriction for integer-like fields (Phone, Account - Numbers only, no letters)
        if (['beneficiary_phone', 'beneficiary_account'].includes(name)) {
            if (!/^\d*$/.test(value)) return
        }

        setFormData(prev => {
            const newData = { ...prev, [name]: value }
            
            // Recalculate economic fields
            if (['amount_sent', 'exchange_rate', 'commission_percentage', 'transfer_mode'].includes(name)) {
                const sent = parseFloat(newData.amount_sent) || 0
                const rate = parseFloat(newData.exchange_rate) || 0
                const commPerc = parseFloat(newData.commission_percentage) || 0

                const calculatedCommission = (sent * commPerc / 100)
                newData.commission = calculatedCommission.toFixed(2)

                let received = 0
                if (newData.transfer_mode === 'eur_to_pen') {
                    received = sent * rate
                } else if (newData.transfer_mode === 'pen_to_eur') {
                    received = rate !== 0 ? sent / rate : 0
                } else if (newData.transfer_mode === 'eur_to_eur') {
                    received = sent
                    newData.exchange_rate = "1.00"
                }
                newData.amount_received = received.toFixed(2)
                newData.total_amount = (sent + calculatedCommission).toFixed(2)
            }

            // Recalculate temp payment conversion (Like Vuelos)
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

            // Recalculate temp expense conversion (Same as payment)
            if (['expense_quantity', 'expense_exchange_rate', 'expense_currency'].includes(name)) {
                const qty = parseFloat(newData.expense_quantity) || 0
                const rate = parseFloat(newData.expense_exchange_rate) || 1.0
                const curr = newData.expense_currency

                let result = 0
                if (curr === 'EUR') {
                    result = qty
                    newData.expense_exchange_rate = '1.0'
                } else if (curr === 'PEN') {
                    result = rate !== 0 ? qty / rate : 0
                } else {
                    result = qty * rate
                }
                newData.expense_total = result.toFixed(2)
            }

            const currentTotal = parseFloat(newData.total_amount) || 0
            const currentAcuenta = parseFloat(newData.on_account) || 0
            
            // CONVERT TO EUR FOR ACCOUNTING BALANCE
            let totalInEur = currentTotal
            if (newData.transfer_mode === 'pen_to_eur') {
                const rate = parseFloat(newData.exchange_rate) || 0
                // If rate is 0, we use currentTotal directly just for UI feedback
                // until the rate is entered, preventing the balance from showing 0.
                totalInEur = rate !== 0 ? currentTotal / rate : currentTotal
            }
            
            newData.balance = (totalInEur - currentAcuenta).toFixed(2)

            return newData
        })
    }

    const handleAddPayment = () => {
        if (!formData.payment_quantity || parseFloat(formData.payment_quantity) === 0) return

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

        const newPayments = [...tempPayments, newPayment]
        setTempPayments(newPayments)
        setTempPaymentProofs(prev => [...prev, paymentProofFile])
        
        const newOnAccount = newPayments.reduce((sum, p) => sum + (parseFloat(p.cantidad) || 0), 0)
        
        const totalAmount = parseFloat(formData.total_amount) || 0
        let totalInEur = totalAmount
        if (formData.transfer_mode === 'pen_to_eur') {
            const rate = parseFloat(formData.exchange_rate) || 1.0
            totalInEur = rate !== 0 ? totalAmount / rate : 0
        }

        setFormData(prev => ({
            ...prev,
            on_account: newOnAccount.toFixed(2),
            balance: (totalInEur - newOnAccount).toFixed(2),
            sede_it: "", sede_pe: "", payment_method_it: "", payment_method_pe: "",
            payment_quantity: "", payment_total: "", payment_exchange_rate: "1.0",
            payment_currency: "EUR"
        }))
        setPaymentProofFile(null)
        setShowPaymentFields(false)
    }

    const handleRemovePayment = (index: number) => {
        const newPayments = tempPayments.filter((_, i) => i !== index)
        const newProofs = tempPaymentProofs.filter((_, i) => i !== index)
        setTempPayments(newPayments)
        setTempPaymentProofs(newProofs)
        
        const newOnAccount = newPayments.reduce((sum, p) => sum + (parseFloat(p.cantidad) || 0), 0)
        const totalAmount = parseFloat(formData.total_amount) || 0
        let totalInEur = totalAmount
        if (formData.transfer_mode === 'pen_to_eur') {
            const rate = parseFloat(formData.exchange_rate) || 1.0
            totalInEur = rate !== 0 ? totalAmount / rate : 0
        }

        setFormData(prev => ({
            ...prev,
            on_account: newOnAccount.toFixed(2),
            balance: (totalInEur - newOnAccount).toFixed(2)
        }))
    }

    const handleAddExpense = () => {
        if (!formData.expense_quantity || parseFloat(formData.expense_quantity) === 0) return
        
        const eCurrency = formData.expense_currency || 'EUR'
        const symbol = eCurrency === 'EUR' ? '€' : eCurrency === 'PEN' ? 'S/' : '$'
        
        const eurAmount = formData.expense_total || formData.expense_quantity

        const newExpense: ExpenseDetail = {
            description: formData.expense_description || formData.expense_category,
            amount: parseFloat(eurAmount),
            currency: eCurrency,
            category: formData.expense_category,
            created_at: new Date().toISOString(),
            sede_it: formData.expense_sede_it,
            sede_pe: formData.expense_sede_pe,
            metodo_it: formData.expense_method_it,
            metodo_pe: formData.expense_method_pe,
            tipo_cambio: parseFloat(formData.expense_exchange_rate) || 1.0,
            total_formatted: `${symbol} ${parseFloat(formData.expense_quantity).toFixed(2)}`
        }

        setTempExpenses(prev => [...prev, newExpense])
        setTempExpenseProofs(prev => [...prev, expenseProofFile])
        
        setFormData(prev => ({
            ...prev,
            expense_sede_it: "",
            expense_sede_pe: "",
            expense_method_it: "",
            expense_method_pe: "",
            expense_quantity: "",
            expense_total: "",
            expense_exchange_rate: "1.0",
            expense_currency: "EUR",
            expense_description: ""
        }))
        setExpenseProofFile(null)
        setShowExpenseFields(false)
    }

    const handleRemoveExpense = (index: number) => {
        setTempExpenses(prev => prev.filter((_, i) => i !== index))
        setTempExpenseProofs(prev => prev.filter((_, i) => i !== index))
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
            transfer_mode: "pen_to_eur",
            amount_sent: "",
            exchange_rate: "",
            amount_received: "",
            commission_percentage: "",
            commission: "",
            total_amount: "",
            on_account: "0.00",
            balance: "0.00",
            beneficiary_name: "",
            beneficiary_document: "",
            beneficiary_phone: "",
            beneficiary_bank: "",
            beneficiary_account: "",
            transfer_code: "",
            status: "scheduled",
            sede_it: "",
            sede_pe: "",
            payment_method_it: "",
            payment_method_pe: "",
            payment_quantity: "",
            payment_exchange_rate: "1.0",
            payment_currency: "EUR",
            payment_total: "",
            expense_sede_it: "",
            expense_sede_pe: "",
            expense_method_it: "",
            expense_method_pe: "",
            expense_quantity: "",
            expense_exchange_rate: "1.0",
            expense_currency: "EUR",
            expense_total: "",
            expense_category: "Comisión Bancaria",
            expense_description: ""
        })
        setSearchClientTerm("")
        setSelectedTransferId(null)
        setNumDocs(0)
        setDocumentInputs([])
        setExistingDocuments([])
        setTempPayments([])
        setTempExpenses([])
        setTempPaymentProofs([])
        setTempExpenseProofs([])
        setPaymentProofFile(null)
        setExpenseProofFile(null)
        setShowPaymentFields(false)
        setShowExpenseFields(false)
    }

    const handleEdit = (transfer: MoneyTransfer) => {
        setSelectedTransferId(transfer.id)
        setFormData({
            client_id: transfer.client_id,
            transfer_mode: transfer.transfer_mode,
            amount_sent: transfer.amount_sent.toString(),
            exchange_rate: transfer.exchange_rate.toString(),
            amount_received: transfer.amount_received.toString(),
            commission_percentage: transfer.commission_percentage?.toString() || "",
            commission: transfer.commission.toString(),
            total_amount: transfer.total_amount.toString(),
            on_account: transfer.on_account.toString(),
            balance: transfer.balance.toString(),
            beneficiary_name: transfer.beneficiary_name,
            beneficiary_document: transfer.beneficiary_document,
            beneficiary_phone: transfer.beneficiary_phone,
            beneficiary_bank: transfer.beneficiary_bank,
            beneficiary_account: transfer.beneficiary_account,
            transfer_code: transfer.transfer_code || "",
            status: transfer.status,
            sede_it: "", sede_pe: "", payment_method_it: "", payment_method_pe: "", payment_quantity: "", payment_exchange_rate: "1.0", payment_currency: "EUR", payment_total: "",
            expense_sede_it: "", expense_sede_pe: "", expense_method_it: "", expense_method_pe: "", expense_quantity: "", expense_exchange_rate: "1.0", expense_currency: "EUR", expense_total: "", expense_category: "Comisión Bancaria", expense_description: ""
        })
        setSearchClientTerm(`${transfer.profiles?.first_name} ${transfer.profiles?.last_name}`)
        setExistingDocuments(transfer.documents || [])
        const pDetails = transfer.payment_details || []
        setTempPayments(pDetails)
        setTempPaymentProofs(new Array(pDetails.length).fill(null))
        const eDetails = transfer.expense_details || []
        setTempExpenses(eDetails)
        setTempExpenseProofs(new Array(eDetails.length).fill(null))
        setIsDialogOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        const submission = new FormData()
        Object.entries(formData).forEach(([key, value]) => {
            submission.append(key, value)
        })

        // Add Multi-Payments and Expenses
        submission.append('payment_details', JSON.stringify(tempPayments))
        submission.append('expense_details', JSON.stringify(tempExpenses))

        // Add Payment Proofs
        tempPaymentProofs.forEach((file, index) => {
            if (file) {
                submission.append(`payment_proof_${index}`, file)
            }
        })

        // Add Expense Proofs
        tempExpenseProofs.forEach((file, index) => {
            if (file) {
                submission.append(`expense_proof_${index}`, file)
            }
        })

        // Add Documents
        documentInputs.forEach((doc, index) => {
            if (doc.file) {
                submission.append(`document_title_${index}`, doc.title)
                submission.append(`document_file_${index}`, doc.file)
            }
        })

        let result
        if (selectedTransferId) {
            submission.append('id', selectedTransferId)
            result = await updateTransfer(submission)
        } else {
            result = await createTransfer(submission)
        }

        if (result.success) {
            setIsDialogOpen(false)
            resetForm()
            loadData()
        } else {
            alert("Error: " + result.error)
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

    const handleCopyCode = (id: string, code: string) => {
        const url = `${window.location.origin}/giros?code=${code}`
        const message = `El registro de tu envío de dinero fue realizado, tu código de seguimiento es ${code}, puedes rastrear ingresando a ${url}`
        
        navigator.clipboard.writeText(message)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
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
            Modo: t.transfer_mode === 'eur_to_pen' ? 'Euro -> Soles' : 'Soles -> Euro',
            Cliente: `${t.profiles?.first_name} ${t.profiles?.last_name}`,
            Beneficiario: t.beneficiary_name,
            Enviado: `${t.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} ${t.amount_sent}`,
            Tasa: t.exchange_rate,
            Comision_Perc: `${t.commission_percentage}%`,
            Comision_Monto: `${t.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} ${t.commission}`,
            Recibido: `${t.transfer_mode === 'eur_to_pen' ? 'S/' : '€'} ${t.amount_received}`,
            Total: `${t.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} ${t.total_amount}`,
            A_Cuenta: `${t.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} ${t.on_account}`,
            Saldo: `${t.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} ${t.balance}`,
            Estado: t.status
        }))
        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Giros")
        XLSX.writeFile(wb, "Giros_Chimivuelos.xlsx")
    }

    // Docs Helpers
    const handleDownload = async (path: string, storage: 'r2' | 'images' = 'r2') => {
        const url = await getTransferDocumentUrl(path, storage)
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
                                    <div className="relative">
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
                                            className={`${selectedTransferId ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""} pr-8`}
                                        />
                                        {searchClientTerm && !selectedTransferId && (
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setSearchClientTerm('')
                                                    setFormData(prev => ({ ...prev, client_id: '' }))
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                            >
                                                <X size={14} strokeWidth={3} />
                                            </button>
                                        )}
                                    </div>
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
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-slate-700 text-sm">Detalles Económicos</h3>
                                        <div 
                                            className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-slate-50 transition-colors shadow-xs"
                                            onClick={() => {
                                                const currentMode = formData.transfer_mode;
                                                const nextMode = 
                                                    currentMode === 'eur_to_pen' ? 'pen_to_eur' : 
                                                    currentMode === 'pen_to_eur' ? 'eur_to_eur' : 'eur_to_pen';
                                                
                                                setFormData(prev => {
                                                    const sent = parseFloat(prev.amount_sent) || 0
                                                    const rate = parseFloat(prev.exchange_rate) || 0
                                                    const commPerc = parseFloat(prev.commission_percentage) || 0
                                                    const currentAcuenta = parseFloat(prev.on_account) || 0

                                                    let received = 0
                                                    let newRate = prev.exchange_rate
                                                    
                                                    if (nextMode === 'eur_to_pen') {
                                                        received = sent * rate
                                                    } else if (nextMode === 'pen_to_eur') {
                                                        received = rate !== 0 ? sent / rate : 0
                                                    } else { // eur_to_eur
                                                        received = sent
                                                        newRate = "1.00"
                                                    }

                                                    const calculatedCommission = (sent * commPerc / 100)
                                                    const totalAmount = sent + calculatedCommission
                                                    
                                                    let totalInEur = totalAmount
                                                    if (nextMode === 'pen_to_eur') {
                                                        const r = parseFloat(newRate) || 0
                                                        totalInEur = r !== 0 ? totalAmount / r : totalAmount
                                                    }

                                                    return { 
                                                        ...prev, 
                                                        transfer_mode: nextMode,
                                                        exchange_rate: newRate,
                                                        amount_received: received.toFixed(2),
                                                        total_amount: totalAmount.toFixed(2),
                                                        commission: calculatedCommission.toFixed(2),
                                                        balance: (totalInEur - currentAcuenta).toFixed(2)
                                                    }
                                                })
                                            }}
                                        >
                                            {formData.transfer_mode === 'eur_to_pen' ? (
                                                <>
                                                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                                                        <span className="text-[10px] font-bold text-emerald-700">€</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-600">Euro → Soles</span>
                                                </>
                                            ) : formData.transfer_mode === 'pen_to_eur' ? (
                                                <>
                                                    <Image src="https://flagcdn.com/w20/pe.png" width={16} height={12} alt="PE" className="rounded-sm" />
                                                    <span className="text-xs font-semibold text-slate-600">Soles → Euro</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                                                        <span className="text-[10px] font-bold text-blue-700">€</span>
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-600">Euro → Euro</span>
                                                </>
                                            )}
                                            <ChevronRight className="h-3 w-3 text-slate-400 rotate-90" />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="grid gap-2">
                                            <Label>Monto Enviado ({formData.transfer_mode === 'pen_to_eur' ? 'S/' : '€'})</Label>
                                            <Input name="amount_sent" type="number" step="0.01" value={formData.amount_sent} onChange={handleInputChange} required />
                                        </div>
                                         <div className="grid gap-2">
                                            <Label>Tasa Cambio</Label>
                                            <Input name="exchange_rate" type="number" step="0.0001" value={formData.exchange_rate} onChange={handleInputChange} required />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                         <div className="grid gap-2">
                                            <Label>Comisión (%)</Label>
                                            <Input name="commission_percentage" type="number" step="0.1" value={formData.commission_percentage} onChange={handleInputChange} placeholder="Ej. 5" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Monto Comisión ({formData.transfer_mode === 'pen_to_eur' ? 'S/' : '€'})</Label>
                                            <Input name="commission" value={formData.commission} readOnly className="bg-slate-100 border-slate-200 text-slate-800" />
                                        </div>
                                    </div>

                                     <div className="grid gap-2">
                                        <Label className="text-slate-700 font-bold">Monto a Recibir ({formData.transfer_mode === 'eur_to_pen' ? 'S/' : '€'})</Label>
                                        <Input name="amount_received" value={formData.amount_received} readOnly className="bg-slate-100 border-slate-200 font-bold text-slate-900" />
                                    </div>

                                    <div className="pt-2 border-t border-slate-200 mt-2">
                                         <div className="grid gap-2">
                                            <Label className="text-chimipink font-bold">Total a Pagar ({formData.transfer_mode === 'pen_to_eur' ? 'S/' : '€'})</Label>
                                            <Input name="total_amount" value={formData.total_amount} readOnly className="bg-pink-50 border-pink-100 font-bold text-chimipink" />
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
                                            <Label>Notas</Label>
                                            <Input 
                                                name="beneficiary_document" 
                                                value={formData.beneficiary_document} 
                                                onChange={handleInputChange} 
                                                placeholder="Ej. Entregar solo con DNI"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Teléfono</Label>
                                            <Input name="beneficiary_phone" value={formData.beneficiary_phone} onChange={handleInputChange} />
                                        </div>
                                    </div>

                                    <div className="grid gap-2 relative">
                                        <Label>Banco o billetera digital</Label>
                                        <div className="relative">
                                            <Input 
                                                name="beneficiary_bank" 
                                                value={formData.beneficiary_bank} 
                                                onChange={(e) => {
                                                    handleInputChange(e)
                                                    setShowBankList(true)
                                                }}
                                                onFocus={() => setShowBankList(true)}
                                                onBlur={() => setTimeout(() => setShowBankList(false), 200)}
                                                placeholder="Buscar banco..." 
                                                autoComplete="off"
                                            />
                                            {formData.beneficiary_bank && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => setFormData(p => ({ ...p, beneficiary_bank: '' }))}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                >
                                                    <X size={14} strokeWidth={3} />
                                                </button>
                                            )}
                                        </div>
                                        {showBankList && (
                                            <div className="absolute top-full z-[100] w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                {PERU_BANK_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.beneficiary_bank.toLowerCase())).map((opt, idx) => (
                                                    <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                        setFormData(p => ({ ...p, beneficiary_bank: opt }))
                                                        setShowBankList(false)
                                                    }}>{opt}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Nº Cuenta / CCI o número de billetera digital</Label>
                                        <Input name="beneficiary_account" value={formData.beneficiary_account} onChange={handleInputChange} />
                                    </div>
                                </div>
                            </div>

                            {/* PAYMENT & EXPENSE REGISTRATION (Vertical Layout) */}
                            <div className="flex flex-col gap-6 mt-4">
                                {/* NUEVO ABONO Section */}
                                <div className="space-y-4 border p-5 rounded-xl bg-slate-50/50 border-slate-200 shadow-sm min-w-0 font-sans">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-2 truncate">
                                            <NotebookPen className="h-4 w-4 shrink-0 text-chimipink" /> REGISTRAR PAGO
                                        </h3>
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
                                                        className="text-chimiteal hover:text-teal-600 transition-colors p-1"
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
                                                        const total = parseFloat(formData.total_amount) || 0
                                                        const acuenta = parseFloat(formData.on_account) || 0
                                                        const rate = parseFloat(formData.exchange_rate) || 1.0
                                                        
                                                        let totalEur = total
                                                        if (formData.transfer_mode === 'pen_to_eur') {
                                                            totalEur = rate !== 0 ? total / rate : 0
                                                        }
                                                        
                                                        const balEur = totalEur - acuenta
                                                        
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            payment_quantity: balEur > 0 ? balEur.toFixed(2) : "",
                                                            payment_total: balEur > 0 ? balEur.toFixed(2) : "",
                                                            payment_currency: "EUR",
                                                            payment_exchange_rate: "1.00",
                                                            sede_it: prev.sede_it || "turro milano"
                                                        }))
                                                        setShowPaymentFields(true)
                                                    }}
                                                    className="bg-white text-chimiteal border-slate-200 hover:bg-slate-50 h-7 text-[10px] uppercase font-bold shadow-sm"
                                                >
                                                    + Registrar Pago
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* History of Payments */}
                                    <div className="space-y-3">
                                        {tempPayments.length > 0 && (
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                                {tempPayments.map((p, idx) => (
                                                    <div key={idx} className="group relative bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all border-l-4 border-l-chimiteal">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <div className="grid gap-0.5">
                                                                    <span className="font-bold text-slate-700 flex items-center gap-2 text-xs">
                                                                        <span className="w-5 h-5 flex items-center justify-center bg-teal-50 text-chimiteal rounded-full text-[10px] shrink-0 font-black">
                                                                            {idx + 1}
                                                                        </span>
                                                                        {p.metodo_it || p.metodo_pe || 'Otros'}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium italic">
                                                                        <Calendar className="h-2.5 w-2.5" /> {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Pendiente'} • <Building2 className="h-2.5 w-2.5" /> {p.sede_it || p.sede_pe || 'S/D'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-right">
                                                                    <span className="font-bold text-emerald-600 text-sm leading-none block">€ {parseFloat(p.cantidad || '0').toFixed(2)}</span>
                                                                    <span className="text-[9px] text-slate-400 uppercase tracking-tighter">
                                                                        {p.moneda && p.moneda !== 'EUR' 
                                                                            ? `Original: ${p.total} (TC: ${p.tipo_cambio})`
                                                                            : `€ ${parseFloat(p.cantidad || '0').toFixed(2)}`
                                                                        }
                                                                    </span>
                                                                </div>
                                                                {p.proof_path && (
                                                                    <Button variant="ghost" size="sm" onClick={() => handleDownload(p.proof_path!)} className="h-7 w-7 p-0 text-chimiteal hover:bg-teal-50">
                                                                        <Download className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleRemovePayment(idx)}
                                                                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {showPaymentFields && (
                                        <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 border-t pt-4 border-chimiteal/20">
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
                                                        className="h-10 text-sm border-slate-200 focus:ring-chimipink pr-8"
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
                                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-blue-700 uppercase">
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
                                                            className="bg-blue-50/50 border-blue-200 focus:ring-blue-500 pr-8 h-10 text-sm"
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
                                                            {PAYMENT_METHOD_IT_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.payment_method_it.toLowerCase())).map((opt, idx) => (
                                                                <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                    setFormData(p => ({ ...p, payment_method_it: opt }))
                                                                    setShowMetodoITList(false)
                                                                }}>{opt}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-rose-700 uppercase">
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
                                                            className="bg-rose-50/50 border-rose-200 focus:ring-rose-500 pr-8 h-10 text-sm"
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
                                                            {PAYMENT_METHOD_PE_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.payment_method_pe.toLowerCase())).map((opt, idx) => (
                                                                <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                    setFormData(p => ({ ...p, payment_method_pe: opt }))
                                                                    setShowMetodoPEList(false)
                                                                }}>{opt}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Moneda de Pago</Label>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {CURRENCY_OPTIONS.map(curr => (
                                                            <Button
                                                                key={curr}
                                                                type="button"
                                                                variant={formData.payment_currency === curr ? 'primary' : 'outline'}
                                                                className={`h-9 text-[10px] font-bold transition-all ${formData.payment_currency === curr ? 'bg-chimipink text-white shadow-md' : 'bg-white'}`}
                                                                onClick={() => setFormData(p => ({ ...p, payment_currency: curr }))}
                                                            >
                                                                {curr}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Cantidad (EUR €)</Label>
                                                    <Input 
                                                        type="number" 
                                                        name="payment_quantity" 
                                                        value={formData.payment_quantity} 
                                                        onChange={handleInputChange} 
                                                        className="h-9 text-sm font-bold border-slate-200 focus:ring-chimipink" 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight text-right">Tipo de Cambio</Label>
                                                    <Input 
                                                        name="payment_exchange_rate" 
                                                        type="number" 
                                                        step="0.0001" 
                                                        value={formData.payment_exchange_rate} 
                                                        onChange={handleInputChange} 
                                                        disabled={formData.payment_currency === 'EUR'} 
                                                        className="h-9 text-right text-xs bg-white font-medium border-slate-200" 
                                                        placeholder="1.0000"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] font-bold text-chimiteal uppercase tracking-tight">Equivalente a Abonar (EUR €)</Label>
                                                    <Input name="payment_total" value={formData.payment_total} readOnly className="h-9 text-right bg-teal-50 text-chimiteal font-bold border-teal-100 text-sm" />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Foto de Comprobante (Opcional)</Label>
                                                    <Input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="h-9 text-[10px] cursor-pointer file:bg-teal-50 file:text-chimiteal file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 file:text-[10px] file:font-bold" 
                                                        onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payment Footer */}
                                    <div className="flex flex-col items-center pt-3 border-t border-slate-100 italic">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Saldo Pendiente</span>
                                        {(() => {
                                            const currentBalance = parseFloat(formData.balance) || 0
                                            const draft = showPaymentFields ? (parseFloat(formData.payment_total) || 0) : 0
                                            const displayBalance = currentBalance - draft
                                            return <span className={`text-sm font-bold ${displayBalance > 0 ? 'text-chimipink' : 'text-chimiteal'}`}>€ {displayBalance.toFixed(2)}</span>
                                        })()}
                                    </div>
                                </div>

                                {/* NUEVO GASTO Section */}
                                <div className="space-y-4 border p-5 rounded-xl bg-slate-50/50 border-slate-200 shadow-sm min-w-0 font-sans">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-2 truncate">
                                            <NotebookPen className="h-4 w-4 shrink-0 text-chimipink" /> REGISTRAR GASTO
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {showExpenseFields ? (
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setShowExpenseFields(false)}
                                                        className="text-red-400 hover:text-red-600 transition-colors p-1"
                                                        title="Cerrar"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={handleAddExpense}
                                                        className="text-chimiteal hover:text-teal-600 transition-colors p-1"
                                                        title="Añadir Gasto"
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
                                                         const sent = parseFloat(formData.amount_sent) || 0
                                                         const received = parseFloat(formData.amount_received) || 0
                                                         const targetEur = formData.transfer_mode === 'eur_to_pen' ? sent : received
                                                         const paidEur = tempExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
                                                         const balEur = targetEur - paidEur
                                                         
                                                         setFormData(prev => ({
                                                             ...prev,
                                                             expense_currency: "EUR",
                                                             expense_exchange_rate: "1.00",
                                                             expense_quantity: balEur > 0 ? balEur.toFixed(2) : "",
                                                             expense_total: balEur > 0 ? balEur.toFixed(2) : "",
                                                             expense_sede_it: prev.expense_sede_it || "turro milano"
                                                         }))
                                                         setShowExpenseFields(true)
                                                     }}
                                                     className="bg-white text-chimiteal border-slate-200 hover:bg-slate-50 h-7 text-[10px] uppercase font-bold shadow-sm"
                                                 >
                                                     + Registrar Gasto
                                                 </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* History of Expenses */}
                                    <div className="space-y-3">
                                        {tempExpenses.length > 0 && (
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                                {tempExpenses.map((ex, idx) => (
                                                    <div key={idx} className="group relative bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all border-l-4 border-l-chimipink">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <div className="grid gap-0.5">
                                                                     <span className="font-bold text-slate-700 flex items-center gap-2 text-xs">
                                                                         <span className="w-5 h-5 flex items-center justify-center bg-pink-50 text-chimipink rounded-full text-[10px] shrink-0 font-black">
                                                                             {idx + 1}
                                                                         </span>
                                                                         {ex.metodo_it || ex.metodo_pe || 'Otros'}
                                                                     </span>
                                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium italic">
                                                                        <Calendar className="h-2.5 w-2.5" /> {ex.created_at ? new Date(ex.created_at).toLocaleDateString() : 'Pendiente'} • <Building2 className="h-2.5 w-2.5" /> {ex.sede_it || ex.sede_pe || 'S/D'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-right">
                                                                    <span className="font-bold text-chimipink text-sm leading-none block">€ {parseFloat(ex.amount.toString() || '0').toFixed(2)}</span>
                                                                    <span className="text-[9px] text-slate-400 uppercase tracking-tighter">
                                                                        {ex.currency !== 'EUR' 
                                                                            ? `${ex.total_formatted} (TC: ${ex.tipo_cambio})`
                                                                            : `€ ${parseFloat(ex.amount.toString() || '0').toFixed(2)}`
                                                                        }
                                                                    </span>
                                                                </div>
                                                                {ex.proof_path && (
                                                                    <Button variant="ghost" size="sm" onClick={() => handleDownload(ex.proof_path!)} className="h-7 w-7 p-0 text-chimiteal hover:bg-teal-50">
                                                                        <Download className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleRemoveExpense(idx)}
                                                                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {showExpenseFields && (
                                         <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 border-t pt-4 border-chimipink/20">

                                            <div className="grid gap-2 relative">
                                                <Label className="text-xs flex items-center gap-1.5 font-bold text-slate-700 uppercase">🏢 Sedes</Label>
                                                <div className="relative">
                                                    <Input 
                                                        name="expense_sede_it" 
                                                        value={formData.expense_sede_it} 
                                                        onChange={(e) => {
                                                            handleInputChange(e)
                                                            setShowExSedeITList(true)
                                                        }}
                                                        onFocus={() => setShowExSedeITList(true)}
                                                        onBlur={() => setTimeout(() => setShowExSedeITList(false), 200)}
                                                        placeholder="Buscar sede..." 
                                                        autoComplete="off"
                                                        className="h-10 text-sm border-slate-200 focus:ring-chimipink pr-8" 
                                                    />
                                                    {formData.expense_sede_it && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setFormData(p => ({ ...p, expense_sede_it: '' }))}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                        >
                                                            <X size={14} strokeWidth={3} />
                                                        </button>
                                                    )}
                                                </div>
                                                {showExSedeITList && (
                                                    <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                        {SEDE_IT_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.expense_sede_it.toLowerCase())).map((opt, idx) => (
                                                            <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                setFormData(p => ({ ...p, expense_sede_it: opt }))
                                                                setShowExSedeITList(false)
                                                            }}>{opt}</div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {/* Métodos */}
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-blue-700 uppercase">
                                                        <Image src="https://flagcdn.com/w20/it.png" width={16} height={12} alt="italia" className="rounded-sm inline-block shadow-sm" />
                                                        Método IT
                                                    </Label>
                                                    <div className="relative">
                                                        <Input 
                                                            name="expense_method_it" 
                                                            value={formData.expense_method_it} 
                                                            onChange={(e) => {
                                                                handleInputChange(e)
                                                                setShowExMetodoITList(true)
                                                            }}
                                                            onFocus={() => setShowExMetodoITList(true)}
                                                            onBlur={() => setTimeout(() => setShowExMetodoITList(false), 200)}
                                                            placeholder="Buscar método..."
                                                            autoComplete="off"
                                                            className="bg-blue-50/50 border-blue-200 focus:ring-blue-500 pr-8 h-10 text-sm"
                                                        />
                                                        {formData.expense_method_it && (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormData(p => ({ ...p, expense_method_it: '' }))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {showExMetodoITList && (
                                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                            {PAYMENT_METHOD_IT_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.expense_method_it.toLowerCase())).map((opt, idx) => (
                                                                <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                    setFormData(p => ({ ...p, expense_method_it: opt }))
                                                                    setShowExMetodoITList(false)
                                                                }}>{opt}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="grid gap-2 relative">
                                                    <Label className="text-xs flex items-center gap-1.5 font-bold text-rose-700 uppercase">
                                                        <Image src="https://flagcdn.com/w20/pe.png" width={16} height={12} alt="peru" className="rounded-sm inline-block shadow-sm" />
                                                        Método PE
                                                    </Label>
                                                    <div className="relative">
                                                        <Input 
                                                            name="expense_method_pe" 
                                                            value={formData.expense_method_pe} 
                                                            onChange={(e) => {
                                                                handleInputChange(e)
                                                                setShowExMetodoPEList(true)
                                                            }}
                                                            onFocus={() => setShowExMetodoPEList(true)}
                                                            onBlur={() => setTimeout(() => setShowExMetodoPEList(false), 200)}
                                                            placeholder="Buscar método..."
                                                            autoComplete="off"
                                                            className="bg-rose-50/50 border-rose-200 focus:ring-rose-500 pr-8 h-10 text-sm"
                                                        />
                                                        {formData.expense_method_pe && (
                                                            <button 
                                                                type="button" 
                                                                onClick={() => setFormData(p => ({ ...p, expense_method_pe: '' }))}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={14} strokeWidth={3} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {showExMetodoPEList && (
                                                        <div className="absolute top-full z-50 w-full bg-white border border-slate-200 shadow-xl rounded-md mt-1 max-h-40 overflow-y-auto">
                                                            {PAYMENT_METHOD_PE_OPTIONS.filter(opt => opt.toLowerCase().includes(formData.expense_method_pe.toLowerCase())).map((opt, idx) => (
                                                                <div key={idx} className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0" onClick={() => {
                                                                    setFormData(p => ({ ...p, expense_method_pe: opt }))
                                                                    setShowExMetodoPEList(false)
                                                                }}>{opt}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Moneda de Gasto</Label>
                                                    <div className="grid grid-cols-3 gap-1">
                                                        {CURRENCY_OPTIONS.map(curr => (
                                                            <Button
                                                                key={curr}
                                                                type="button"
                                                                variant={formData.expense_currency === curr ? 'primary' : 'outline'}
                                                                className={`h-9 text-[10px] font-bold transition-all ${formData.expense_currency === curr ? 'bg-chimipink text-white shadow-md' : 'bg-white'}`}
                                                                onClick={() => setFormData(p => ({ ...p, expense_currency: curr }))}
                                                            >
                                                                {curr}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Cantidad (EUR €)</Label>
                                                    <Input 
                                                        type="number" 
                                                        name="expense_quantity" 
                                                        value={formData.expense_quantity} 
                                                        onChange={handleInputChange} 
                                                        className="h-9 text-sm font-bold border-slate-200 focus:ring-chimipink" 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight text-right">Tipo de Cambio</Label>
                                                    <Input 
                                                        name="expense_exchange_rate" 
                                                        type="number" 
                                                        step="0.0001" 
                                                        value={formData.expense_exchange_rate} 
                                                        onChange={handleInputChange} 
                                                        disabled={formData.expense_currency === 'EUR'} 
                                                        className="h-9 text-right text-xs bg-white font-medium border-slate-200" 
                                                        placeholder="1.0000"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                 <div className="grid gap-1.5">
                                                     <Label className="text-[10px] font-bold text-chimipink uppercase tracking-tight">Monto a Pagar (€)</Label>
                                                     <Input name="expense_total" value={formData.expense_total} readOnly className="h-9 text-right bg-pink-50 text-chimipink font-bold border-pink-100 text-sm" />
                                                 </div>
                                                <div className="grid gap-1.5">
                                                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Foto de Comprobante (Opcional)</Label>
                                                    <Input 
                                                        type="file" 
                                                        accept="image/*" 
                                                        className="h-9 text-[10px] cursor-pointer file:bg-pink-50 file:text-chimipink file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 file:text-[10px] file:font-bold" 
                                                        onChange={(e) => setExpenseProofFile(e.target.files?.[0] || null)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                     {/* Expense Footer */}
                                     <div className="flex flex-col items-center pt-3 border-t border-slate-100 italic">
                                         <span className="text-[10px] uppercase font-bold text-slate-400">Saldo Pendiente</span>
                                         {(() => {
                                             const sent = parseFloat(formData.amount_sent) || 0
                                             const received = parseFloat(formData.amount_received) || 0
                                             const targetEur = formData.transfer_mode === 'eur_to_pen' ? sent : received
                                             const totalEx = tempExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
                                             const draft = showExpenseFields ? (parseFloat(formData.expense_total) || 0) : 0
                                             const bal = targetEur - (totalEx + draft)
                                             return <span className={`text-sm font-bold ${bal > 0 ? 'text-chimipink' : 'text-chimiteal'}`}>€ {bal.toFixed(2)}</span>
                                         })()}
                                     </div>
                                </div>
                            </div>


                            <div className="grid gap-2">
                                <Label className="font-bold text-slate-700">Estado del Giro</Label>
                                <select 
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-chimiteal focus:ring-2 focus:ring-chimiteal shadow-sm"
                                >
                                    <option value="scheduled">Programado</option>
                                    <option value="delivered">Entregado</option>
                                    <option value="cancelled">Cancelado</option>
                                </select>
                            </div>

                            {/* DOCUMENT UPLOAD (Simplified like flights) */}
                            <div className="border border-slate-200 rounded-md p-4 bg-slate-50 space-y-4">
                                <Label className="font-bold text-chimipink flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4" /> SOPORTES ADICIONALES
                                </Label>
                                
                                {existingDocuments.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-4 border-b border-slate-200">
                                        {existingDocuments.map((doc, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs shadow-xs">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-slate-700 truncate max-w-[150px]">{doc.title}</span>
                                                    <span className="text-[10px] text-slate-400 capitalize">{doc.type?.split('/')[1] || 'Doc'}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.path, doc.storage)} className="h-7 w-7 p-0 text-chimiteal hover:bg-teal-50">
                                                        <Download className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={async () => {
                                                        if(confirm('¿Borrar archivo?')) {
                                                            if (selectedTransferId) {
                                                                await deleteTransferDocument(selectedTransferId, doc.path)
                                                                setExistingDocuments(prev => prev.filter(d => d.path !== doc.path))
                                                            }
                                                        }
                                                    }} className="h-7 w-7 p-0 text-red-400 hover:bg-red-50">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="grid gap-3">
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs">Número de Documentos a Subir (Máx 5)</Label>
                                        <Input type="number" value={numDocs} onChange={handleNumDocsChange} className="w-16 h-8 text-sm" />
                                    </div>
                                    
                                    {documentInputs.map((doc, idx) => (
                                        <div key={idx} className="grid grid-cols-2 gap-2 bg-white p-2 rounded-lg border border-slate-100 shadow-sm animate-in slide-in-from-left-2 duration-200">
                                            <Input 
                                                placeholder="Título del documento..." 
                                                value={doc.title} 
                                                onChange={(e) => handleDocInputChange(idx, 'title', e.target.value)}
                                                className="h-9 text-xs"
                                            />
                                            <Input 
                                                type="file" 
                                                onChange={(e) => handleDocInputChange(idx, 'file', e.target.files?.[0] || null)}
                                                className="h-9 text-xs"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <DialogFooter className="sticky bottom-0 bg-white pt-4 border-t z-50">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isLoading} className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 w-full sm:w-auto font-bold shadow-md">
                                    {isLoading ? 'Guardando...' : (selectedTransferId ? 'Actualizar Giro' : 'Guardar Giro')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                 </Dialog>
            </div>

            {/* Beneficiary Details Modal */}
            <Dialog open={!!viewingBeneficiary} onOpenChange={(isOpen) => !isOpen && setViewingBeneficiary(null)}>
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
            <Dialog open={!!docsViewerTransfer} onOpenChange={(isOpen) => !isOpen && setDocsViewerTransfer(null)}>
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
                                    <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-800" onClick={() => handleDownload(doc.path, doc.storage)}>
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
                         <div className="relative min-w-[200px] flex-1 group">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input 
                                placeholder="Buscar por código, beneficiario..." 
                                className="pl-10 pr-10 border-slate-200 bg-white focus:ring-chimiteal"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => {setSearchTerm(''); setCurrentPage(1);}}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full p-0.5 transition-colors"
                                >
                                    <X size={14} strokeWidth={3} />
                                </button>
                            )}
                        </div>
                        
                        <select 
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as MoneyTransfer['status'] | 'all')}
                        >
                            <option value="all">Todos</option>
                            <option value="scheduled">Programado</option>
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
                                    <th className="px-6 py-4 font-medium">Enviado</th>
                                    <th className="px-6 py-4 font-medium">Comisión</th>
                                    <th className="px-6 py-4 font-medium text-red-600">Gastos</th>
                                    <th className="px-6 py-4 font-medium text-blue-700">C. Neta</th>
                                    <th className="px-6 py-4 font-medium">Total</th>
                                    <th className="px-6 py-4 font-medium">Tasa</th>
                                    <th className="px-6 py-4 font-medium text-emerald-700">Recibido</th>
                                    <th className="px-6 py-4 font-medium">A Cuenta</th>
                                    <th className="px-6 py-4 font-medium">Saldo</th>
                                    <th className="px-6 py-4 font-medium text-center">Docs</th>
                                    <th className="px-6 py-4 font-medium">Estado</th>
                                    <th className="px-6 py-4 font-medium text-right sticky right-0 bg-pink-100/90 backdrop-blur-sm z-20 border-l border-pink-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] text-pink-700">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={14} className="py-8 text-center text-slate-500">
                                            No se encontraron giros.
                                        </td>
                                    </tr>
                                ) : (
                                    currentItems.map((transfer) => (
                                        <tr key={transfer.id} className="bg-white hover:bg-slate-50/50 group">
                                             <td className="px-6 py-4 text-xs text-slate-500">
                                                {new Date(transfer.created_at).toLocaleDateString('es-PE')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-slate-600">{transfer.transfer_code || '-'}</span>
                                                    {transfer.transfer_code && (
                                                        <div className="flex items-center gap-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-6 w-6 p-0 text-slate-400 hover:text-chimipink" 
                                                                onClick={() => handleCopyCode(transfer.id, transfer.transfer_code)}
                                                                title="Copiar mensaje de seguimiento"
                                                            >
                                                                {copiedId === transfer.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                                                            </Button>
                                                            {copiedId === transfer.id && (
                                                                <span className="text-[10px] text-emerald-600 font-bold animate-in fade-in zoom-in-95">¡Copiado!</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
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
                                             <td className="px-6 py-4 whitespace-nowrap">
                                                {transfer.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} {transfer.amount_sent.toFixed(2)}
                                            </td>
                                             <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span>{transfer.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} {transfer.commission.toFixed(2)}</span>
                                                    {transfer.commission_percentage > 0 && (
                                                        <span className="text-[10px] text-slate-400">({transfer.commission_percentage}%)</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-red-600 font-medium">
                                                € {(transfer.total_expenses || 0).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-blue-700 font-bold">
                                                € {(transfer.net_profit ?? transfer.commission).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-semibold">
                                                {transfer.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} {transfer.total_amount.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">{transfer.exchange_rate.toFixed(4)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-emerald-700">
                                                {transfer.transfer_mode === 'eur_to_pen' ? 'S/' : '€'} {transfer.amount_received.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {transfer.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} {transfer.on_account.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium">
                                                <span className={transfer.balance > 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>
                                                     {transfer.transfer_mode === 'eur_to_pen' ? '€' : 'S/'} {transfer.balance.toFixed(2)}
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
                                                        ${transfer.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 
                                                          transfer.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                                                          'bg-yellow-100 text-yellow-700'}
                                                    `}
                                                >
                                                    <option value="scheduled">Programado</option>
                                                    <option value="delivered">Entregado</option>
                                                    <option value="cancelled">Cancelado</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-right sticky right-0 bg-pink-50/90 backdrop-blur-sm group-hover:bg-pink-100 z-10 border-l border-pink-100 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.15)] transition-colors">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(transfer)}>
                                                        <Pencil className="h-4 w-4 text-slate-400" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(transfer.id)}>
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
