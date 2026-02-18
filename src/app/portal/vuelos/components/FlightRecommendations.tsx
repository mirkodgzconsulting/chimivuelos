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
            

        </div>
    )
}
