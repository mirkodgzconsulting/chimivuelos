"use client";

import { 
  type LucideIcon,
  LayoutDashboard, 
  Plane, 
  Banknote, 
  Package, 
  Users, 
  Settings, 
  LogOut,
  UserCog
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
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
      isActive 
        ? "bg-chimipink text-white shadow-md shadow-pink-200" 
        : "text-slate-600 hover:bg-slate-50 hover:text-chimipink"
    )}
  >
    <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-white" : "text-slate-400 group-hover:text-chimipink")} />
    <span>{label}</span>
  </Link>
);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-48 border-r border-slate-200 bg-white hidden md:flex flex-col shadow-sm">
      {/* Logo Section */}
      <div className="flex h-16 items-center justify-center border-b border-slate-100 px-4">
        <Link href="/dashboard" className="flex items-center justify-center w-full">
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
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Principal</div>
        
        <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" isActive={pathname === '/dashboard'} />
        <SidebarItem icon={UserCog} label="Agentes" href="/agents" isActive={pathname.startsWith('/agents')} />
        <SidebarItem icon={Users} label="Clientes" href="/clients" isActive={pathname.startsWith('/clients')} />
        
        <div className="my-4 border-t border-slate-100 mx-2" />
        
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2 mt-6">Operaciones</div>
        <SidebarItem icon={Plane} label="Vuelos" href="/chimi-vuelos" isActive={pathname.startsWith('/chimi-vuelos')} />
         <SidebarItem icon={Banknote} label="Giros" href="/chimi-giros" isActive={pathname.startsWith('/chimi-giros')} />
        <SidebarItem icon={Package} label="Encomiendas" href="/chimi-encomiendas" isActive={pathname.startsWith('/chimi-encomiendas')} />

        <div className="my-4 border-t border-slate-100 mx-2" />

        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2 mt-6">Sistema</div>
        <SidebarItem icon={Settings} label="Configuración" href="/settings" isActive={pathname.startsWith('/settings')} />
      </div>

      {/* Footer / User Profile */}
      <div className="border-t border-slate-100 p-4">
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
