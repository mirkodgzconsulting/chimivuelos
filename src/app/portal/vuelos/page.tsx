import { getMyFlights, getActiveTerms } from '@/app/actions/client-portal'
import FlightList from './FlightList'

export const dynamic = 'force-dynamic'

export default async function ClientFlightsPage() {
    const flights = await getMyFlights()
    const terms = await getActiveTerms('flight')

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                    Mis Vuelos
                </h1>
                <p className="text-slate-500 text-sm">Gestiona tus pasajes y revisa el estado de tus vuelos.</p>
            </header>

            <FlightList 
                flights={flights} 
                termsContent={terms?.content || '<p>No terms defined yet.</p>'} 
                termsVersion={terms?.version || '1.0'} 
            />
        </div>
    )
}
