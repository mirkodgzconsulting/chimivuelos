import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ChatWidget } from "@/components/chat/ChatWidget";
import type { Metadata } from 'next';

import { getClientUser } from "@/app/actions/client-portal";

export const metadata: Metadata = {
  title: 'Mi Cuenta - Chimivuelos',
  description: 'Portal de clientes de Chimivuelos',
}

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getClientUser();

  return (
    <div className="min-h-screen bg-page font-sans text-slate-900">
      
      {/* Sidebar - Fixed Left (Shared Component) */}
      <Sidebar role="client" />

      {/* Main Content Area */}
      <div className="md:pl-48 flex flex-col min-h-screen transition-all duration-300">
        
        {/* Header - Sticky Top */}
        <Header user={user} role="client" />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 md:p-8 space-y-6 w-full">
          {children}
        </main>

        {/* Footer */}
        <footer className="py-6 px-8 border-t border-slate-200/60 text-center text-sm text-slate-500 bg-transparent">
          © {new Date().getFullYear()} Chimivuelos S.A.C. - Portal de Clientes
        </footer>
      
        {/* Chat Widget */}
        <ChatWidget />
      </div>
    </div>
  );
}
