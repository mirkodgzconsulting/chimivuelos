'use client'

import React, { useState } from 'react'
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, ShieldCheck, FileCheck } from 'lucide-react'
import { acceptServiceTerms } from '@/app/actions/client-portal'
import { useRouter } from 'next/navigation'

interface TermsGuardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    serviceId: string
    serviceType: 'flight' | 'parcel' | 'transfer'
    termsContent: string
    termsVersion: string
    onSuccess: () => void
}

export function TermsGuard({ 
    open, 
    onOpenChange, 
    serviceId, 
    serviceType, 
    termsContent, 
    termsVersion,
    onSuccess 
}: TermsGuardProps) {
    const [accepted, setAccepted] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleAccept = async () => {
        if (!accepted) return
        setLoading(true)

        try {
            const result = await acceptServiceTerms(serviceId, serviceType, termsVersion)
            if (result.success) {
                onSuccess()
                onOpenChange(false)
                router.refresh() // Refresh server data so the lock is removed
            } else {
                alert('Hubo un error al registrar su aceptación. Intente nuevamente.')
            }
        } catch (error) {
            console.error(error)
            alert('Error de conexión.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(val) => {
            // Prevent closing if not accepted? Or allow closing (cancel)?
            // Better allow closing so user isn't trapped, but they can't proceed.
            if (!loading) onOpenChange(val)
        }}>
            <DialogContent className="max-w-md md:max-w-2xl h-[90vh] md:h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
                <div className="p-6 pb-2 border-b bg-slate-50">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
                            <ShieldCheck className="text-chimiteal h-6 w-6" />
                            Términos y Condiciones
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            Para acceder a este servicio, debe leer y aceptar las condiciones legales vigentes (v{termsVersion}).
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <ScrollArea className="flex-1 p-6 bg-white">
                    <div 
                        className="prose prose-sm prose-slate max-w-none"
                        dangerouslySetInnerHTML={{ __html: termsContent }} 
                    />
                </ScrollArea>

                <div className="p-6 border-t bg-slate-50 space-y-4">
                    <div className="flex items-start space-x-3 p-4 bg-white border border-slate-200 rounded-lg">
                        <Checkbox 
                            id="terms" 
                            checked={accepted} 
                            onCheckedChange={(checked: boolean | string) => setAccepted(checked === true)}
                            className="mt-1"
                        />
                        <div className="grid gap-1.5 leading-none">
                            <Label 
                                htmlFor="terms" 
                                className="text-sm font-medium leading-tight cursor-pointer"
                            >
                                He leído, comprendo y acepto los términos y condiciones.
                            </Label>
                            <p className="text-xs text-slate-500">
                                Al aceptar, se registrará su IP y fecha como constancia legal.
                            </p>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button 
                            onClick={handleAccept} 
                            disabled={!accepted || loading}
                            className="bg-chimiteal hover:bg-teal-700 text-white gap-2"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
                            Aceptar y Continuar
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    )
}
