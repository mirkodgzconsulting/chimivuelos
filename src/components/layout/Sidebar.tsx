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
  MessageCircle
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  isActive?: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, isActive }: SidebarItemProps) => (
  <Link 
    href={href}
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

interface SidebarProps {
  role?: 'admin' | 'client';
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine if we should show client view
  // Priority: 1. explicit role prop, 2. pathname check
  const isClientView = role === 'client' || (role !== 'admin' && pathname.startsWith('/portal'));

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-48 border-r border-sidebar-border bg-sidebar hidden md:flex flex-col shadow-sm">
      {/* Logo Section */}
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
        <Link href={isClientView ? "/portal" : "/dashboard"} className="flex items-center justify-center w-full">
            <Image 
               src="/chimilogosidebar.svg" 
               alt="Chimivuelos" 
               width={140} 
               height={40} 
               className="h-10 w-auto object-contain"
               priority
            />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {/* Logic to switch between Admin and Client Menus */}
        {isClientView ? (
            /* CLIENT MENU */
            <>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Mi Portal</div>
                <SidebarItem icon={LayoutDashboard} label="Inicio" href="/portal" isActive={pathname === '/portal'} />
                <SidebarItem icon={Plane} label="Mis Vuelos" href="/portal/vuelos" isActive={pathname.startsWith('/portal/vuelos')} />
                <SidebarItem icon={Package} label="Mis Encomiendas" href="/portal/encomiendas" isActive={pathname.startsWith('/portal/encomiendas')} />
                <SidebarItem icon={Banknote} label="Mis Giros" href="/portal/giros" isActive={pathname.startsWith('/portal/giros')} />
            </>
        ) : (
            /* ADMIN MENU */
            <>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Principal</div>
                
                <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" isActive={pathname === '/dashboard'} />
                <SidebarItem icon={UserCog} label="Agentes" href="/agents" isActive={pathname.startsWith('/agents')} />
                <SidebarItem icon={Users} label="Clientes" href="/clients" isActive={pathname.startsWith('/clients')} />
                <SidebarItem icon={MessageCircle} label="Mensajes" href="/admin/chat" isActive={pathname.startsWith('/admin/chat')} />
                
                <div className="my-4 border-t border-sidebar-border mx-2" />
                
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2 mt-6">Operaciones</div>
                <SidebarItem icon={Plane} label="Vuelos" href="/chimi-vuelos" isActive={pathname.startsWith('/chimi-vuelos')} />
                 <SidebarItem icon={Banknote} label="Giros" href="/chimi-giros" isActive={pathname.startsWith('/chimi-giros')} />
                <SidebarItem icon={Package} label="Encomiendas" href="/chimi-encomiendas" isActive={pathname.startsWith('/chimi-encomiendas')} />
        
                <div className="my-4 border-t border-sidebar-border mx-2" />
            </>
        )}
      </div>

      {/* Footer / User Profile */}
      <div className="border-t border-sidebar-border p-4">
        <button 
          onClick={async () => {
            const supabase = createClient()
            await supabase.auth.signOut()
            router.refresh()
            router.push('/login')
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
