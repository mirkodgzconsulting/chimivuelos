'use client'

import { HelpCircle, Send, Paperclip } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export function FlightFAQ() {
    const questions = [
        "¿Me cambiaron el horario de mi vuelo?",
        "¿Necesito visa para viajar a Europa?",
        "¿Qué documentos necesito para viajar?",
        "¿Ya no quieres viajar y deseas hacer un cambio de fecha?",
        "¿Quieres pedir un reembolso?",
        "¿Qué cubre un seguro de viaje?",
        "¿Necesito una carta de invitación para viajar a Europa?",
        "¿Qué requisitos tiene la carta de invitación?",
        "¿Puedo seleccionar mi asiento?",
        "¿Qué pasa si pierdo mi vuelo?",
        "¿Cuánto tiempo antes debo estar en el aeropuerto?",
        "¿Necesito asistencia aeroportuaria para mi vuelo?",
        "¿Cuánto dinero debo tener para mi bolsa de viaje?",
        "¿Qué hago si me detienen y paso a interrogación en migración?",
        "¿Qué hago si se pierde mi maleta?"
    ]

    const [expandedQId, setExpandedQId] = useState<number | null>(null)
    const [message, setMessage] = useState("")
    
    // Generic placeholder answer text
    const genericAnswer = "Esta es una respuesta genérica para la pregunta. Aquí podrás encontrar información detallada sobre los procedimientos, requisitos y recomendaciones para esta situación específica. Si necesitas más ayuda, contáctanos."

    const toggleQuestion = (idx: number) => {
        setExpandedQId(expandedQId === idx ? null : idx)
    }

    return (
        <div className="flex flex-col md:flex-row h-full">
            
            {/* Left Side: Questions List (Now First) */}
            <div className="flex-1 flex flex-col order-2 md:order-1 border-r border-white/30">
                {/* Header for Mobile only */}
                <div className="md:hidden p-4 border-b border-white/30 bg-white/40">
                    <h2 className="text-lg font-bold text-slate-800">Preguntas Frecuentes</h2>
                    <p className="text-xs text-slate-500">¿Tienes dudas? Aquí te ayudamos.</p>
                </div>

                {/* Questions List (No Scroll) */}
                <div className="p-6 space-y-2 bg-transparent">
                    {questions.map((q, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => toggleQuestion(idx)}
                            className={`p-3 rounded-lg hover:bg-white/40 group cursor-pointer border transition-all ${expandedQId === idx ? 'bg-white/60 border-chimipink/30 shadow-sm' : 'border-transparent hover:border-white/30 hover:shadow-sm'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`border p-1.5 rounded-full shrink-0 shadow-sm transition-colors ${expandedQId === idx ? 'bg-chimipink text-white border-chimipink' : 'bg-white/60 border-white/40 text-chimipink group-hover:border-chimipink/30'}`}>
                                    <HelpCircle size={16} />
                                </div>
                                <span className={`text-sm font-medium transition-colors ${expandedQId === idx ? 'text-chimipink font-bold' : 'text-slate-700 group-hover:text-chimipink'}`}>
                                    {q}
                                </span>
                            </div>
                            
                            {/* Answer Expansion */}
                            <div className={`grid transition-all duration-300 ease-in-out ${expandedQId === idx ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="overflow-hidden pl-9">
                                    <p className="text-xs text-slate-500 leading-relaxed bg-white/40 p-2 rounded border border-white/30">
                                        {genericAnswer}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Chat Input Area */}
                <div className="p-4 border-t border-white/30 bg-white/30">
                    <div className="mb-2 text-xs font-semibold text-slate-500 px-1">
                        ¿Tienes alguna duda de tu vuelo?
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <input 
                                type="text" 
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Escribe tu consulta aquí..."
                                className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-white/40 bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-chimipink focus:border-transparent shadow-sm placeholder:text-slate-400"
                            />
                            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-chimipink p-1 rounded-md transition-colors">
                                <Paperclip size={18} />
                            </button>
                        </div>
                        <Button className="bg-chimipink hover:bg-pink-600 text-white px-4 shrink-0 shadow-sm">
                            <Send size={18} className="mr-2 md:mr-0" />
                            <span className="hidden md:inline">Enviar</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Right Side: Image Panel (Now Second) */}
            {/* Right Side: Image Panel (Now Second) */}
            <div className="hidden md:flex flex-col bg-white/20 p-0 md:w-1/3 border-l border-white/30 relative overflow-visible order-1 md:order-2 justify-start">
                <div className="p-8 pb-4 relative z-10">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Preguntas Frecuentes</h2>
                    <p className="text-sm text-slate-600">
                        Encuentra las respuestas que necesitas para tu viaje.
                    </p>
                </div>
                
                <div className="mt-8 flex items-center justify-center relative z-10">
                     <img 
                        src="/img-faq.webp" 
                        alt="FAQ" 
                        className="w-[90%] h-auto object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
                     />
                </div>
            </div>
        </div>
    )
}
