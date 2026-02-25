import { Briefcase } from "lucide-react"

export default function OtrosServiciosPage() {
    return (
        <div className="flex h-[80vh] flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
            <div className="rounded-full bg-slate-100 p-6 mb-6">
                <Briefcase className="h-12 w-12 text-slate-400" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-slate-800">Otros Servicios</h1>
            <p className="max-w-md text-slate-500 mb-4">
                Estamos trabajando en esto.
            </p>
            <p className="max-w-md text-sm text-slate-400">
                Esta sección está actualmente en desarrollo. Pronto estará disponible con todas las funcionalidades.
            </p>
        </div>
    )
}
