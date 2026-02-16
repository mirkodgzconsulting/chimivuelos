
"use client";

import { 
  type LucideIcon,
  LayoutDashboard, 
  Plane, 
  Banknote, 
  Package, 
  Users, 
  LogOut,
  UserCog,
  Menu,
  X
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  isActive?: boolean;
  onClick?: () => void;
}

const SidebarItem = ({ icon: Icon, label, href, isActive, onClick }: SidebarItemProps) => (
  <Link 
    href={href}
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
      isActive 
        ? "bg-chimipink text-white shadow-md shadow-pink-500/20 font-bold" 
        : "text-slate-600 font-medium hover:bg-white/40 hover:text-slate-900"
    )}
  >
    <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-800")} />
    <span>{label}</span>
  </Link>
);

interface MobileSidebarProps {
  role?: 'admin' | 'client';
}

export function MobileSidebar({ role }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Determine if we should show client view
  const isClientView = role === 'client' || (role !== 'admin' && pathname.startsWith('/portal'));

  return (
    <div className="md:hidden flex items-center">
      <button 
        onClick={() => setIsOpen(true)}
        className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div 
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Panel */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            <div className="flex items-center">
                <Link href={isClientView ? "/portal" : "/dashboard"} onClick={() => setIsOpen(false)}>
                    <Image 
                    src="/chimilogosidebar.svg" 
                    alt="Chimivuelos" 
                    width={120} 
                    height={32} 
                    className="h-8 w-auto object-contain"
                    priority
                    />
                </Link>
            </div>
            <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none"
            >
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
            {isClientView ? (
                /* CLIENT MENU */
                <>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Mi Portal</div>
                    <SidebarItem icon={LayoutDashboard} label="Inicio" href="/portal" isActive={pathname === '/portal'} onClick={() => setIsOpen(false)} />
                    <SidebarItem icon={Plane} label="Mis Vuelos" href="/portal/vuelos" isActive={pathname.startsWith('/portal/vuelos')} onClick={() => setIsOpen(false)} />
                    <SidebarItem icon={Package} label="Mis Encomiendas" href="/portal/encomiendas" isActive={pathname.startsWith('/portal/encomiendas')} onClick={() => setIsOpen(false)} />
                    <SidebarItem icon={Banknote} label="Mis Giros" href="/portal/giros" isActive={pathname.startsWith('/portal/giros')} onClick={() => setIsOpen(false)} />
                </>
            ) : (
                /* ADMIN MENU */
                <>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Principal</div>
                    
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" isActive={pathname === '/dashboard'} onClick={() => setIsOpen(false)} />
                    <SidebarItem icon={UserCog} label="Agentes" href="/agents" isActive={pathname.startsWith('/agents')} onClick={() => setIsOpen(false)} />
                    <SidebarItem icon={Users} label="Clientes" href="/clients" isActive={pathname.startsWith('/clients')} onClick={() => setIsOpen(false)} />
                    
                    <div className="my-4 border-t border-sidebar-border mx-2" />
                    
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2 mt-6">Operaciones</div>
                    <SidebarItem icon={Plane} label="Vuelos" href="/chimi-vuelos" isActive={pathname.startsWith('/chimi-vuelos')} onClick={() => setIsOpen(false)} />
                    <SidebarItem icon={Banknote} label="Giros" href="/chimi-giros" isActive={pathname.startsWith('/chimi-giros')} onClick={() => setIsOpen(false)} />
                    <SidebarItem icon={Package} label="Encomiendas" href="/chimi-encomiendas" isActive={pathname.startsWith('/chimi-encomiendas')} onClick={() => setIsOpen(false)} />

                    <div className="my-4 border-t border-sidebar-border mx-2" />
                </>
            )}
        </div>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
            <button 
            onClick={async () => {
                await supabase.auth.signOut()
                setIsOpen(false)
                router.refresh()
                router.push('/login')
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
            <LogOut className="h-5 w-5" />
            <span>Cerrar Sesión</span>
            </button>
        </div>

      </div>
    </div>
  );
}
