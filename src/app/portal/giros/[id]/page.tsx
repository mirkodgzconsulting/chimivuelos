import { getTransferById } from '@/app/actions/client-portal'
import { redirect } from 'next/navigation'
import { Banknote, User, ArrowLeft, Download, FileText, History, CheckCircle2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from "@/lib/utils"

const formatCurrency = (amount: number | null | undefined, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', { 
        style: 'currency', 
        currency: currency 
    }).format(amount || 0)
}

interface TransferDocument {
    title: string
    path: string
    name: string
    storage: 'r2' | 'images'
}

export default async function TransferDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params
    const transfer = await getTransferById(id)

    if (!transfer) {
        redirect('/portal/giros')
    }

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                        Detalle de Giro
                    </h1>
                    <p className="text-slate-500 text-sm">Transferencia #{transfer.transfer_code}</p>
                </div>
                <Link href="/portal/giros">
                    <Button variant="outline" size="sm">
                        Volver
                    </Button>
                </Link>
            </header>

            {/* Main Content Card - Glassmorphism */}
            <div className="bg-white/30 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl overflow-hidden relative z-10">
                
                {/* 1. Giro Details Section */}
                <div className="p-6 border-b border-white/30 relative overflow-hidden">
                   <div className="flex flex-col lg:flex-row gap-8 relative z-10">
                        {/* Left Content (Info) */}
                        <div className="flex-1 space-y-8">
                             {/* Header Line */}
                             <div className="flex items-start gap-4">
                                <div className="bg-white/80 p-3 rounded-xl border border-white/50 text-chimipink shadow-sm">
                                    <Banknote size={24} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Giro de Dinero</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-semibold px-2 py-0.5 bg-white/60 text-slate-600 rounded border border-white/40">
                                            COD: {transfer.transfer_code}
                                        </span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded capitalize ${
                                            transfer.status === 'completed' || transfer.status === 'delivered' ? 'bg-green-100/80 text-green-700' :
                                            transfer.status === 'cancelled' ? 'bg-red-100/80 text-red-700' :
                                            'bg-yellow-100/80 text-yellow-700'
                                        }`}>
                                            {transfer.status === 'completed' ? 'Completado' : 
                                             transfer.status === 'delivered' ? 'Entregado' :
                                             transfer.status === 'cancelled' ? 'Cancelado' :
                                             transfer.status === 'available' ? 'Disponible' :
                                             transfer.status === 'processing' ? 'En Proceso' :
                                             transfer.status === 'scheduled' ? 'Programado' :
                                             'Pendiente'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Data Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Beneficiary & Details */}
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <User size={14} /> Datos del Beneficiario
                                        </h3>
                                        <div className="bg-white/40 p-4 rounded-lg border border-white/40 space-y-3">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Nombre Completo</p>
                                                <p className="text-base font-bold text-slate-800">{transfer.beneficiary_name}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Documento</p>
                                                    <p className="text-sm font-semibold text-slate-700">{transfer.beneficiary_document || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Teléfono</p>
                                                    <p className="text-sm font-semibold text-slate-700">{transfer.beneficiary_phone || '—'}</p>
                                                </div>
                                            </div>
                                            {transfer.beneficiary_bank && (
                                                <div className="pt-2 border-t border-white/30">
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Banco / Nro de Cuenta</p>
                                                    <p className="text-sm font-semibold text-slate-700">{transfer.beneficiary_bank}</p>
                                                    <p className="text-xs font-mono text-slate-500 mt-0.5">{transfer.beneficiary_account || '—'}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-2">Detalles del Envío</h3>
                                        <div className="bg-white/40 p-4 rounded-lg border border-white/40 text-sm leading-relaxed text-slate-700">
                                            <ul className="space-y-2">
                                                <li className="flex justify-between items-center py-1 border-b border-white/20">
                                                    <span>Modo de Envío:</span>
                                                    <span className="font-bold text-slate-800 capitalize">{transfer.transfer_mode?.replace(/_/g, ' ') || 'Giro Normal'}</span>
                                                </li>
                                                <li className="flex justify-between items-center py-1 border-b border-white/20">
                                                    <span>Fecha de Creación:</span>
                                                    <span className="font-bold text-slate-800">{new Date(transfer.created_at).toLocaleDateString()}</span>
                                                </li>
                                                {transfer.terms_accepted_at && (
                                                    <li className="flex justify-between items-center py-1">
                                                        <span>Términos Aceptados:</span>
                                                        <span className="font-bold text-chimiteal flex items-center gap-1"><CheckCircle2 size={12} /> {new Date(transfer.terms_accepted_at).toLocaleDateString()}</span>
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Documents & Financials */}
                                <div className="space-y-8">
                                    {/* Documents */}
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <FileText size={14} /> Comprobantes
                                        </h3>
                                        
                                        <div className="grid grid-cols-1 gap-3">
                                            {transfer.documents && transfer.documents.length > 0 ? (
                                                transfer.documents.map((doc: TransferDocument, idx: number) => (
                                                    <div key={idx} className="bg-white/40 p-3 rounded-xl border border-white/40 flex items-center justify-between group hover:bg-white/60 transition-all">
                                                        <div className="flex items-center gap-3">
                                                            <div className="bg-white/80 p-2 rounded-lg text-chimipink">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{doc.title || doc.name}</p>
                                                                <p className="text-[10px] text-slate-400 uppercase">{doc.storage === 'r2' ? 'Oficial' : 'Imagen'}</p>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-chimipink">
                                                            <Download size={16} />
                                                        </Button>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-400 italic">No hay documentos cargados.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Integrated Payment Info */}
                                    <div>
                                        <h3 className="text-xs font-bold text-chimipink uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <Banknote size={14} /> Información Económica
                                        </h3>
                                        <div className="bg-white/40 border border-white/40 rounded-xl p-4 space-y-3">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600">Total Enviado (EUR)</span>
                                                <span className="font-bold text-slate-800">{formatCurrency(transfer.amount_sent, 'EUR')}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600">Total Recibe (PEN)</span>
                                                <span className="font-bold text-emerald-600">{formatCurrency(transfer.amount_received, 'PEN')}</span>
                                            </div>
                                            {transfer.exchange_rate && (
                                                <div className="text-[10px] text-slate-400 text-right font-medium">
                                                    Tasa aplicada: 1 EUR = {transfer.exchange_rate} PEN
                                                </div>
                                            )}
                                            
                                            {transfer.balance > 0 && (
                                                <div className="border-t border-white/30 pt-3 flex justify-between items-center">
                                                    <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Saldo Pendiente</span>
                                                    <div className="px-4 py-2 rounded-xl border-2 bg-red-600 border-red-700 text-white shadow-lg animate-pulse-fast">
                                                        <span className="font-bold text-lg">{formatCurrency(transfer.balance, 'EUR')}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Content (Image) */}
                        <div className="w-full lg:w-1/3 flex items-center justify-center lg:justify-end">
                             <div className="relative w-full max-w-[200px] md:max-w-[350px] aspect-4/5 lg:mr-8 transition-transform hover:scale-105 duration-500">
                                <img 
                                    src="/img-giro-detail.webp" 
                                    alt="Detalle de Giro" 
                                    className="object-contain w-full h-full drop-shadow-2xl"
                                />
                             </div>
                        </div>
                   </div>

                </div>

                {/* Generic Info (Full Width) */}
                <div className="bg-white/40 border-t border-white/30 p-6 flex flex-col md:flex-row gap-8">
                    <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 mb-2">Aviso de Privacidad</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Esta información es confidencial y solo para uso del cliente. Si detectas algún error en los datos del beneficiario, por favor comunícate de inmediato con soporte antes de que la transferencia sea cobrada.
                        </p>
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 mb-2">Tiempos de Cobro</h4>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Los giros bancarios pueden tardar entre 24 a 48 horas hábiles en reflejarse. Los cobros en ventanilla son inmediatamentes una vez el estado cambie a &quot;Disponible&quot;.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
