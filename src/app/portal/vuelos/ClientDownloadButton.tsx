'use client'

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { getFlightDocumentUrl } from '@/app/actions/manage-flights'

interface FlightDocument {
    title: string
    path: string
    name: string
    storage: 'r2' | 'images'
}

export function ClientDownloadButton({ doc }: { doc: FlightDocument }) {
    const handleDownload = async () => {
        const result = await getFlightDocumentUrl(doc.path, doc.storage)
        if (result.url) {
            window.open(result.url, '_blank')
        }
    }

    return (
        <Button 
            size="sm" 
            variant="ghost" 
            onClick={handleDownload}
            className="text-slate-400 hover:text-chimipink"
        >
            <Download size={16} />
        </Button>
    )
}
