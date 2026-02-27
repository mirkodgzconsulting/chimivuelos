import { getMyOtherServices, getActiveTerms } from '@/app/actions/client-portal'
import OtherServicesList from './OtherServicesList'

export const dynamic = 'force-dynamic'

export default async function ClientOtherServicesPage() {
    const services = await getMyOtherServices()
    const terms = await getActiveTerms('other')

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                    Otros Servicios
                </h1>
                <p className="text-slate-500 text-sm">Consulta el estado y detalles de tus servicios adicionales.</p>
            </header>

            <OtherServicesList 
                services={services as any[]} 
                termsContent={terms?.content || '<p>Términos y condiciones para servicios adicionales.</p>'} 
                termsVersion={terms?.version || '1.0'} 
            />
        </div>
    )
}
