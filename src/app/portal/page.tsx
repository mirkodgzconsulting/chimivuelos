import { getClientUser } from '@/app/actions/client-portal'
import { Plane, Package, Banknote, ShieldCheck, Info, CheckCircle2, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PortalPage() {
    const user = await getClientUser()

    return (
       <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto pb-20 md:pb-0">
          {/* Welcome Section */}
          <div className="flex flex-col gap-2 px-1 md:px-0">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
                Hola, <span className="text-chimiteal">{user?.user_metadata?.first_name || 'Cliente'}</span> 👋
            </h1>
            <p className="text-slate-500 text-base md:text-lg">
                Bienvenido al portal de servicios de Chimivuelos. Aquí podrás gestionar todos tus trámites de forma segura.
            </p>
          </div>
          
          {/* Main Instructions Card */}
          <div className="bg-white rounded-2xl p-5 md:p-8 border border-slate-100 shadow-sm relative overflow-hidden">
             
             {/* Decorative Background */}
             <div className="absolute top-0 right-0 w-40 md:w-64 h-40 md:h-64 bg-chimiteal/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             
             <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-start md:items-center">
                <div className="space-y-6">
                    <div className="flex items-center gap-3 text-chimiteal mb-2">
                        <Info size={24} className="shrink-0" />
                        <h2 className="text-lg md:text-xl font-bold">¿Cómo consultar tus servicios?</h2>
                    </div>
                    
                    <div className="space-y-4">
                        <Step 
                            number="1" 
                            title="Selecciona el Servicio" 
                            desc="Navega desde el menú a Mis Vuelos, Encomiendas o Giros según lo que necesites consultar." 
                        />
                        <Step 
                            number="2" 
                            title="Acepta los Términos (Importante)" 
                            desc="Por seguridad normativa, deberás aceptar los términos y condiciones actualizados para ver los detalles."
                            highlight
                        />
                        <Step 
                            number="3" 
                            title="Accede a tu Información" 
                            desc="Visualiza itinerarios, rastrea paquetes o descarga tus comprobantes al instante." 
                        />
                    </div>
                </div>

                {/* Important Notice Box */}
                <div 
                    className="w-full text-white rounded-2xl shadow-lg border border-slate-800/50 relative overflow-hidden mb-8 transform md:rotate-1 hover:rotate-0 transition-transform duration-500 p-6 md:p-8"
                    style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
                >
                    <div className="absolute top-4 right-4">
                        <ShieldCheck className="text-chimipink opacity-20" size={48} />
                    </div>
                    
                    <ShieldCheck className="text-chimipink mb-4" size={32} />
                    
                    <h3 className="text-lg md:text-xl font-bold mb-3">Seguridad y Normativa</h3>
                    <p className="text-slate-300 text-sm leading-relaxed mb-6">
                        Para garantizar la transparencia y seguridad de tus operaciones, 
                        <span className="text-chimipink font-bold"> es obligatorio aceptar los términos legales </span> 
                        antes de descargar documentos o ver detalles sensibles.
                    </p>

                    <div className="flex items-center gap-3 text-xs font-medium text-slate-400 bg-white/5 p-3 rounded-lg border border-white/10">
                        <CheckCircle2 size={16} className="text-green-400 shrink-0" />
                        <span>Tus datos están protegidos y encriptados.</span>
                    </div>
                </div>
             </div>
          </div>

          {/* Quick Access Grid */}
          <div className="px-1 md:px-0">
            <h3 className="text-lg font-bold text-slate-700 mb-4">Accesos Directos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                <QuickLink 
                    href="/portal/vuelos" 
                    icon={Plane} 
                    title="Mis Vuelos" 
                    desc="Itinerarios y tickets"
                    color="text-chimiteal"
                    hoverBorder="hover:border-chimiteal/50"
                />
                <QuickLink 
                    href="/portal/giros" 
                    icon={Banknote} 
                    title="Mis Giros" 
                    desc="Estado de transferencias"
                    color="text-green-600"
                    hoverBorder="hover:border-green-300"
                />
                <QuickLink 
                    href="/portal/encomiendas" 
                    icon={Package} 
                    title="Mis Encomiendas" 
                    desc="Rastreo de envíos"
                    color="text-chimipink"
                    hoverBorder="hover:border-chimipink/50"
                />
            </div>
          </div>
       </div>
    )
}

function Step({ number, title, desc, highlight }: { number: string, title: string, desc: string, highlight?: boolean }) {
    return (
        <div className="flex gap-4 group">
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors",
                highlight ? "bg-chimipink text-white shadow-lg shadow-chimipink/30" : "bg-slate-100 text-slate-500 group-hover:bg-chimiteal/20 group-hover:text-chimiteal"
            )}>
                {number}
            </div>
            <div>
                <h4 className={cn("font-bold text-sm mb-1", highlight ? "text-chimipink" : "text-slate-800")}>{title}</h4>
                <p className="text-sm text-slate-500 leading-snug">{desc}</p>
            </div>
        </div>
    )
}

interface QuickLinkProps {
    href: string;
    icon: LucideIcon;
    title: string;
    desc: string;
    color: string;
    hoverBorder: string;
}

function QuickLink({ href, icon: Icon, title, desc, color, hoverBorder }: QuickLinkProps) {
    return (
        <Link href={href} className={cn(
            "flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all group",
            hoverBorder
        )}>
            <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center bg-slate-50 group-hover:bg-white transition-colors", color)}>
                <Icon size={24} />
            </div>
            <div>
                <h4 className="font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{title}</h4>
                <span className="text-xs text-slate-400 font-medium">{desc}</span>
            </div>
        </Link>
    )
}
