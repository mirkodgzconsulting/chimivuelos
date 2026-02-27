import { getMyTranslations, getActiveTerms } from '@/app/actions/client-portal'
import TranslationList from './TranslationList'

export const dynamic = 'force-dynamic'

export default async function ClientTranslationsPage() {
    const translations = await getMyTranslations()
    const terms = await getActiveTerms('translation')

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                    Mis Traducciones
                </h1>
                <p className="text-slate-500 text-sm">Gestiona tus trámites y revisa el estado de tus traducciones.</p>
            </header>

            <TranslationList 
                translations={translations as any[]} 
                termsContent={terms?.content || '<p>Términos y condiciones para traducciones.</p>'} 
                termsVersion={terms?.version || '1.0'} 
            />
        </div>
    )
}
