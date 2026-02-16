
"use client";
import * as React from 'react';
import { Search, LogOut, ChevronDown, User } from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { MobileSidebar } from '@/components/layout/MobileSidebar';

import { User as SupabaseUser } from '@supabase/supabase-js';

interface HeaderProps {
  user?: SupabaseUser | null;
  role?: 'admin' | 'client';
}

export function Header({ user, role }: HeaderProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Safe name extraction
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'Usuario';
  const displayRole = role === 'admin' ? 'Administrador' : 'Cliente';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
      {/* Mobile Sidebar Trigger (Hamburger) */}
      <div className="md:hidden mr-4">
        <MobileSidebar role={role} />
      </div>

      {/* Search Bar - Expanded */}
      <div className="flex flex-1 items-center max-w-lg">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar..."
            className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:border-chimipink focus:bg-white focus:outline-none focus:ring-1 focus:ring-chimipink transition-colors"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        {/* Notifications - Disabled for now */}
        {/* <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
          <Bell className="h-5 w-5 text-slate-600" />
          <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-chimipink ring-2 ring-white animate-pulse" />
        </button> */}

        {/* Profile Dropdown */}
        <div className="relative ml-2 border-l border-slate-200 pl-4">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-lg transition-colors outline-none cursor-pointer"
            >
                <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-slate-900 leading-none">{displayName}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{displayRole}</p>
                </div>
                <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-slate-100 p-0.5">
                    {/* Fallback pattern if image fails */}
                    <div className="absolute inset-0 bg-linear-to-tr from-chimipink to-chimicyan opacity-20" /> 
                    <Image 
                        src="/user.jpg" 
                        alt="Admin" 
                        width={40} 
                        height={40}
                        className="h-full w-full rounded-full object-cover"
                        unoptimized // Local file
                    />
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop to close on verify click outside */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        <div className="p-2 border-b border-slate-100 block sm:hidden">
                            <p className="text-sm font-semibold text-slate-900 px-2">{displayName}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider px-2">{displayRole}</p>
                        </div>
                        
                        <div className="p-1">
                            <button className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md transition-colors">
                                <User className="w-4 h-4 mr-2 text-slate-500" />
                                Mi Perfil
                            </button>
                            {/* <button className="flex items-center w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md transition-colors">
                                <Settings className="w-4 h-4 mr-2 text-slate-500" />
                                Configuración
                            </button> */}
                        </div>
                        
                        <div className="h-px bg-slate-100 my-1"/>
                        
                        <div className="p-1">
                            <button 
                                onClick={handleSignOut}
                                className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors font-medium"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
      </div>
    </header>
  );
}
