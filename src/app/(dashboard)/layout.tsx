import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Second layer of security: Check role in the layout
  const role = user?.user_metadata?.role || 'client';

  if (role === 'client') {
    const { redirect } = await import("next/navigation");
    redirect('/portal');
  }

  return (
    <div className="min-h-screen bg-page font-sans text-slate-900">
      
      {/* Sidebar - Fixed Left */}
      <Sidebar role={role as 'admin'} />

      {/* Main Content Area */}
      <div className="md:pl-48 flex flex-col min-h-screen transition-all duration-300">
        
        {/* Header - Sticky Top */}
        <div className="z-30 w-full">
             <Header user={user} role={role as 'admin'} />
        </div>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 md:p-5 space-y-4">
          {children}
        </main>

        {/* Footer */}
        <footer className="py-6 px-8 border-t border-slate-200/60 dark:border-slate-800 text-center text-sm text-slate-500 bg-transparent">
          © {new Date().getFullYear()} Chimivuelos S.A.C. - Todos los derechos reservados.
        </footer>
      </div>
    </div>
  );
}
