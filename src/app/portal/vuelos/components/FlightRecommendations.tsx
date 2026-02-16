'use client'

import { FileText, Luggage, Clock, ShieldCheck, Banknote, ListChecks, ChevronDown } from "lucide-react"
import { useState } from "react"


export function FlightRecommendations() {
    const [expandedRecId, setExpandedRecId] = useState<number | null>(null)

    const toggleRec = (idx: number) => {
        setExpandedRecId(expandedRecId === idx ? null : idx)
    }

    const recommendations = [
        {
            icon: FileText,
            color: "text-chimipink bg-pink-50",
            title: "Documentación Obligatoria",
            description: "Pasaporte, billetes, seguro, entre otros.",
            details: "Asegúrate de llevar tu pasaporte vigente (mínimo 6 meses), tu visa si el destino lo requiere, y copia impresa de tus billetes de avión y seguro de viaje. Revisa los requisitos de entrada específicos de cada país."
        },
        {
            icon: Luggage,
            color: "text-chimiblue bg-blue-50",
            title: "Equipaje y Restricciones",
            description: "Reglas sobre el equipaje, líquidos y más.",
            details: "Revisa las dimensiones y peso permitidos por tu aerolínea. Líquidos en envases de máximo 100ml en bolsa transparente. No lleves objetos punzocortantes en el equipaje de mano."
        },
        {
            icon: Clock,
            color: "text-chimiteal bg-teal-50",
            title: "Presentación en Aeropuerto",
            description: "Horario ideal para llegar y evitar problemas.",
            details: "Para vuelos internacionales, llega 3 horas antes. Para vuelos nacionales, 2 horas. Considera el tráfico y el tiempo en controles de seguridad."
        },
        {
            icon: ShieldCheck,
            color: "text-chimipink bg-pink-50",
            title: "Control Migratorio en Europa",
            description: "Detalles del control y preguntas comunes.",
            details: "Ten a mano tu pasaporte, billete de vuelta, reserva de alojamiento y medios económicos. Responde con calma y claridad a las preguntas del oficial de migración."
        },
        {
            icon: Banknote,
            color: "text-chimiblue bg-blue-50",
            title: "Medios Económicos",
            description: "Cuánto dinero demostrar y medios aceptados.",
            details: "Generalmente se requiere demostrar aprox. 100 euros por día de estancia. Se aceptan efectivo, tarjetas de crédito y cheques de viajero."
        },
        {
            icon: ListChecks,
            color: "text-chimiteal bg-teal-50",
            title: "Antes de Viajar",
            description: "Chequeos de documentos y tips importantes.",
            details: "Deja copia de tus documentos a un familiar. Activa el roaming o compra una SIM local. Lleva un adaptador de corriente universal."
        }
    ]

    return (
        <div className="p-6 relative overflow-hidden">
             <div className="flex flex-col xl:flex-row gap-8 items-start">
                
                {/* Left Image Section */}
                <div className="hidden xl:block w-1/4 sticky top-6">
                    <img 
                        src="/img_recomendacion.webp" 
                        alt="Recomendaciones" 
                        className="w-full h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                    />
                </div>

                {/* Right Grid Section */}
                <div className="flex-1 w-full">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <span className="text-chimipink">✈</span> Recomendaciones de Viaje
                        </h2>
                        <div className="text-xs font-medium text-chimipink bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
                            Tips Importantes
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {recommendations.map((rec, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => toggleRec(idx)}
                                className={`group flex flex-col p-4 rounded-xl border border-slate-100 transition-all cursor-pointer bg-white ${expandedRecId === idx ? 'ring-2 ring-chimipink/20 shadow-lg' : 'hover:border-chimipink/30 hover:shadow-md'}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg shrink-0 ${rec.color}`}>
                                        <rec.icon size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-slate-900 mb-1 group-hover:text-chimipink transition-colors">
                                            {rec.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            {rec.description}
                                        </p>
                                    </div>
                                    <ChevronDown size={16} className={`text-slate-300 transition-transform duration-300 ${expandedRecId === idx ? 'rotate-180 text-chimipink' : 'group-hover:text-chimipink'}`} />
                                </div>
                                
                                {/* Expanded Content */}
                                <div className={`grid transition-all duration-300 ease-in-out ${expandedRecId === idx ? 'grid-rows-[1fr] opacity-100 mt-3 pt-3 border-t border-slate-50' : 'grid-rows-[0fr] opacity-0'}`}>
                                    <div className="overflow-hidden">
                                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 leading-relaxed">
                                            {rec.details}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="mt-8 flex justify-center">
                 <button 
                    onClick={() => window.open('https://wa.me/51999999999', '_blank')}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full font-bold transition-all shadow-md hover:shadow-xl hover:-translate-y-0.5 transform duration-200"
                 >
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" className="mr-1"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    <span>Contacta con nuestros asistentes</span>
                 </button>
            </div>
        </div>
    )
}
