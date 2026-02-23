"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ShieldAlert, Send } from "lucide-react"
import { createEditRequest } from "@/app/actions/manage-permissions"
import { toast } from "sonner"

interface EditRequestModalProps {
    isOpen: boolean
    onClose: () => void
    resourceType: string
    resourceId: string
    resourceName?: string
}

export function EditRequestModal({ isOpen, onClose, resourceType, resourceId, resourceName }: EditRequestModalProps) {
    const [reason, setReason] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async () => {
        if (!reason.trim()) {
            toast.error("Por favor, ingresa un motivo para la solicitud.")
            return
        }

        setIsSubmitting(true)
        try {
            const result = await createEditRequest(resourceType, resourceId, reason, { displayId: resourceName })
            if (result.success) {
                toast.success("Solicitud enviada", {
                    description: "Un administrador la revisará pronto."
                })
                setReason("")
                onClose()
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <ShieldAlert className="h-5 w-5" />
                        Permiso de Edición Requerido
                    </DialogTitle>
                    <DialogDescription>
                        No tienes permisos para editar este registro directamente. 
                        Debes enviar una solicitud al administrador explicando el motivo.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason" className="text-slate-700 font-semibold">
                            Motivo de la modificación
                        </Label>
                        <Textarea
                            id="reason"
                            placeholder="Ej: El cliente solicitó cambio de fecha por motivos de salud..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[120px] bg-slate-50 border-slate-200 focus:ring-amber-500"
                        />
                        {resourceName && (
                            <p className="text-[10px] text-slate-400 italic">
                                Afectará a: {resourceName}
                            </p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                        className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
                    >
                        <Send className="h-4 w-4" />
                        {isSubmitting ? "Enviando..." : "Enviar Solicitud"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
