'use client'

import Image from 'next/image'
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Eye, FileText, Loader2, AlertCircle } from "lucide-react"
import { getTranslationDocumentUrl } from '@/app/actions/manage-translations'
import { getOtherServiceDocumentUrl } from '@/app/actions/manage-other-services'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ServiceDocument {
    title: string
    path: string
    name: string
    storage: 'r2' | 'images'
}

export function ServiceDocumentRow({ doc, type }: { doc: ServiceDocument, type: 'translation' | 'other' }) {
    const [isOpen, setIsOpen] = useState(false)
    const [url, setUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const name = doc.name.toLowerCase()
    const isPdf = name.endsWith('.pdf')
    const isImage = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp')
    const isViewable = isPdf || isImage

    const handleAction = async (e?: React.MouseEvent) => {
        e?.stopPropagation()
        
        if (!isViewable) {
            await downloadFile()
            return
        }

        setIsOpen(true)
        if (!url) {
            setLoading(true)
            const result = type === 'translation' 
                ? await getTranslationDocumentUrl(doc.path, doc.storage as any) 
                : await getOtherServiceDocumentUrl(doc.path, doc.storage as any)
            
            if (result) {
                setUrl(result)
            }
            setLoading(false)
        }
    }

    const downloadFile = async () => {
        const result = type === 'translation' 
            ? await getTranslationDocumentUrl(doc.path, doc.storage as any) 
            : await getOtherServiceDocumentUrl(doc.path, doc.storage as any)
        
        if (result) {
            window.open(result, '_blank')
        }
    }

    return (
        <>
            <div 
                onClick={handleAction}
                className="cursor-pointer flex items-center justify-between p-3 bg-white/60 border border-white/50 rounded-lg hover:bg-white/80 hover:border-chimiteal/30 active:scale-[0.98] active:bg-white/90 transition-all duration-200 group shadow-sm hover:shadow-md"
            >
                <div className="flex items-center gap-3 flex-1 mr-2 min-w-0">
                    <div className="bg-teal-50 text-chimiteal p-2 rounded shrink-0 group-hover:bg-chimiteal group-hover:text-white transition-colors">
                        <FileText size={16} />
                    </div>
                    <span className="text-sm font-medium text-slate-700 leading-tight group-hover:text-chimiteal transition-colors whitespace-normal break-all">
                        {doc.title || doc.name}
                    </span>
                </div>
                
                <div className="text-slate-400 group-hover:text-chimiteal transition-colors shrink-0">
                    {isViewable ? <Eye size={18} /> : <Download size={18} />}
                </div>
            </div>

            {isViewable && (
                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent className="w-[95vw] sm:w-full max-w-4xl h-[85vh] sm:h-[80vh] flex flex-col p-0 overflow-hidden rounded-xl">
                        <DialogHeader className="p-4 border-b flex flex-row items-center justify-between bg-slate-50 shrink-0">
                            <DialogTitle className="text-sm font-bold text-slate-700 truncate pr-8">
                                {doc.title || doc.name}
                            </DialogTitle>
                        </DialogHeader>
                        
                        <div className="flex-1 bg-slate-100 relative w-full h-full flex items-center justify-center overflow-auto p-4">
                            {loading ? (
                                <Loader2 className="w-8 h-8 text-chimiteal animate-spin" />
                            ) : url ? (
                                <>
                                    {isImage && (
                                        <div className="relative w-full h-full">
                                            <Image 
                                                src={url} 
                                                alt={doc.name} 
                                                fill
                                                className="object-contain shadow-md rounded"
                                                unoptimized
                                            />
                                        </div>
                                    )}
                                    {isPdf && (
                                        <div className="w-full h-full bg-white rounded shadow-sm border border-slate-200">
                                            <iframe 
                                                src={`${url}#view=FitH&toolbar=0`} 
                                                className="w-full h-full border-none"
                                                title={doc.name}
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-red-500 text-sm flex items-center gap-2">
                                    <AlertCircle size={16} /> Error cargando el archivo.
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t bg-white flex justify-end gap-3 shrink-0">
                             <Button variant="outline" size="sm" onClick={() => setIsOpen(false)} className="h-9 px-4">
                                Cerrar
                             </Button>
                             <Button size="sm" onClick={() => window.open(url || '', '_blank')} className="bg-chimiteal hover:bg-teal-700 h-9 px-4 gap-2">
                                <Download size={16} /> <span className="hidden sm:inline">Descargar</span><span className="sm:hidden">Bajar</span>
                             </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}
