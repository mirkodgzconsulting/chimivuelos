"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ShieldAlert, Send, FileEdit } from "lucide-react"
import { createEditRequest } from "@/app/actions/manage-permissions"
import { toast } from "sonner"

interface EditRequestModalProps {
    isOpen: boolean
    onClose: () => void
    resourceType: string
    resourceId: string
    resourceName?: string
    draftData?: Record<string, unknown> // The clean JSON of changed data
    onSuccess?: () => void
}

export function EditRequestModal({ 
    isOpen, 
    onClose, 
    resourceType, 
    resourceId, 
    resourceName, 
    draftData,
    onSuccess 
}: EditRequestModalProps) {
    const [reason, setReason] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!reason.trim()) {
            toast.error("Por favor, ingresa un motivo para la solicitud.")
            return
        }

        setIsSubmitting(true)
        try {
            // New Draft & Approval Logic: If draftData is present, we store it in metadata
            const metadata = {
                displayId: resourceName,
                draftData: draftData || null,
                isDraftSubmission: !!draftData
            }

            const result = await createEditRequest(resourceType, resourceId, reason, metadata)
            
            if (result.success) {
                toast.success(draftData ? "Borrador enviado" : "Solicitud enviada", {
                    description: draftData 
                        ? "Tu edición ha sido guardada como borrador y espera la aprobación del administrador." 
                        : "Un administrador revisará tu solicitud de permiso pronto."
                })
                setReason("")
                onClose()
                if (onSuccess) onSuccess()
            } else {
                toast.error("Error al enviar", {
                    description: result.error
                })
            }
        } catch (error) {
            console.error("Error submitting request:", error)
            toast.error("Ocurrió un error inesperado")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[450px] border-none shadow-2xl rounded-2xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-chimipink via-chimipurple to-chimicyan" />
                
                <DialogHeader className="pt-6">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
                        {draftData ? (
                            <FileEdit className="h-6 w-6 text-chimicyan" />
                        ) : (
                            <ShieldAlert className="h-6 w-6 text-chimipink" />
                        )}
                        {draftData ? "Confirmar Envío de Edición" : "Permiso de Edición Requerido"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 text-sm leading-relaxed">
                        {draftData 
                            ? "Has realizado cambios. Como agente, tu edición debe ser revisada por un administrador antes de aplicarse permanentemente." 
                            : "Para editar este registro, debes enviar una breve justificación al administrador."
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-4">
                    <div className="space-y-3">
                        <Label htmlFor="reason" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Motivo o Justificación del Cambio
                        </Label>
                        <div className="relative group">
                            <Textarea
                                id="reason"
                                placeholder="Describa brevemente por qué es necesario este cambio..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="min-h-[120px] bg-slate-50 border-slate-200 focus:border-chimicyan/50 focus:ring-4 focus:ring-chimicyan/5 transition-all rounded-xl resize-none"
                            />
                        </div>
                        {resourceName && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Afecta a:</span>
                                <span className="text-[11px] font-bold text-chimiteal truncate">{resourceName}</span>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="bg-slate-50/50 p-4 -mx-6 -mb-6 mt-2 border-t border-slate-100 gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={onClose} 
                        disabled={isSubmitting}
                        className="text-slate-500 font-bold text-xs"
                    >
                        CANCELAR
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className={cn(
                            "gap-2 shadow-lg shadow-chimicyan/10 font-bold text-xs px-6",
                            draftData ? "bg-chimicyan hover:bg-chimicyan/90 text-white" : "bg-chimipink hover:bg-chimipink/90 text-white"
                        )}
                    >
                        <Send className="h-4 w-4" />
                        {isSubmitting ? "PROCESANDO..." : (draftData ? "ENVIAR BORRADOR" : "SOLICITAR PERMISO")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function cn(...classes: (string | boolean | undefined | null)[]) {
    return classes.filter(Boolean).join(' ')
}
