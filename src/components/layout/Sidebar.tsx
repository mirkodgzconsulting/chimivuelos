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
  MessageCircle,
  ShieldCheck,
  Languages,
  Briefcase,
  Calculator,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useMemo } from 'react';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  href: string;
  isActive?: boolean;
  badge?: number;
}

const SidebarItem = ({ icon: Icon, label, href, isActive, badge }: SidebarItemProps) => (
  <Link 
    href={href}
    className={cn(
      "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
      isActive 
        ? "bg-chimipink text-white shadow-md shadow-pink-500/20 font-bold" 
        : "text-slate-600 font-medium hover:bg-white/40 hover:text-slate-900"
    )}
  >
    <div className="flex items-center gap-3">
      <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-800")} />
      <span>{label}</span>
    </div>
    {badge !== undefined && badge > 0 ? (
      <span className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-sidebar animate-in zoom-in duration-300",
        isActive ? "bg-white text-chimipink ring-chimipink" : "bg-red-500 text-white shadow-sm shadow-red-500/30"
      )}>
        {badge > 9 ? '9+' : badge}
      </span>
    ) : null}
  </Link>
);

interface SidebarProps {
  role?: 'admin' | 'client' | 'agent' | 'usuario' | 'supervisor';
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine if we should show client view
  // Priority: 1. explicit role prop, 2. pathname check
  const isClientView = role === 'client' || (role !== 'admin' && pathname.startsWith('/portal'));

  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isSubscribed = true;

    async function getInitialCount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isSubscribed) return;

      const { data, error } = await supabase
        .from('conversations')
        .select('id, unread_admin_count, unread_client_count');

      if (error || !data) return;

      const total = data.reduce((acc, conv) => {
        return acc + (isClientView ? (conv.unread_client_count || 0) : (conv.unread_admin_count || 0));
      }, 0);

      if (isSubscribed) setUnreadCount(total);
    }

    const timer = setTimeout(() => {
      getInitialCount();
    }, 0);

    // Realtime subscription for conversation updates (counters changing)
    const convChannel = supabase
      .channel('sidebar-unread-conv')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'conversations' 
      }, () => {
        getInitialCount();
      })
      .subscribe();

    // Also listen to new messages just in case, to trigger a refresh
    const msgChannel = supabase
      .channel('sidebar-unread-msg')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, () => {
        getInitialCount();
      })
      .subscribe();

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [supabase, isClientView]);

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

      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Logic to switch between Admin and Client Menus */}
        {isClientView ? (
            /* CLIENT MENU */
            <>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Mi Portal</div>
                <SidebarItem icon={LayoutDashboard} label="Inicio" href="/portal" isActive={pathname === '/portal'} />
                <SidebarItem icon={Plane} label="Mis Vuelos" href="/portal/vuelos" isActive={pathname.startsWith('/portal/vuelos')} />
                <SidebarItem icon={Package} label="Mis Encomiendas" href="/portal/encomiendas" isActive={pathname.startsWith('/portal/encomiendas')} />
                <SidebarItem icon={Banknote} label="Mis Giros" href="/portal/giros" isActive={pathname.startsWith('/portal/giros')} />
                <SidebarItem icon={Languages} label="Mis Traducciones" href="/portal/traducciones" isActive={pathname.startsWith('/portal/traducciones')} />
                <SidebarItem icon={Briefcase} label="Otros Servicios" href="/portal/otros" isActive={pathname.startsWith('/portal/otros')} />
                <div className="my-4 border-t border-sidebar-border mx-2" />
                <SidebarItem 
                    icon={MessageCircle} 
                    label="Soporte" 
                    href="/portal/chat" 
                    isActive={pathname.startsWith('/portal/chat')} 
                    badge={unreadCount ?? 0}
                />
            </>
        ) : (
            /* ADMIN MENU */
            <>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Principal</div>
                
                <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/dashboard" isActive={pathname === '/dashboard'} />
                {(role === 'admin' || role === 'agent' || role === 'supervisor') && (
                    <>
                        <SidebarItem icon={UserCog} label="Agentes" href="/agents" isActive={pathname.startsWith('/agents')} />
                        <SidebarItem icon={Users} label="Clientes" href="/clients" isActive={pathname.startsWith('/clients')} />
                        {role === 'admin' && (
                            <SidebarItem icon={ShieldCheck} label="Permisos" href="/admin/permissions" isActive={pathname.startsWith('/admin/permissions')} />
                        )}
                    </>
                )}
                <SidebarItem 
                    icon={MessageCircle} 
                    label="Mensajes" 
                    href="/admin/chat" 
                    isActive={pathname.startsWith('/admin/chat')} 
                    badge={unreadCount ?? 0}
                />
                
                <div className="my-4 border-t border-sidebar-border mx-2" />
                
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2 mt-6">Operaciones</div>
                <SidebarItem icon={Plane} label="Vuelos" href="/chimi-vuelos" isActive={pathname.startsWith('/chimi-vuelos')} />
                <SidebarItem icon={Banknote} label="Giros" href="/chimi-giros" isActive={pathname.startsWith('/chimi-giros')} />
                <SidebarItem icon={Package} label="Encomiendas" href="/chimi-encomiendas" isActive={pathname.startsWith('/chimi-encomiendas')} />
                <SidebarItem icon={Languages} label="Traducciones" href="/chimi-traducciones" isActive={pathname.startsWith('/chimi-traducciones')} />
                <SidebarItem icon={Briefcase} label="Otros Servicios" href="/chimi-otros-servicios" isActive={pathname.startsWith('/chimi-otros-servicios')} />
                {(role === 'admin' || role === 'supervisor') && (
                    <>
                        <SidebarItem icon={Wallet} label="Gastos" href="/chimi-gastos" isActive={pathname.startsWith('/chimi-gastos')} />
                        <SidebarItem icon={Calculator} label="Contabilidad" href="/chimi-contabilidad" isActive={pathname.startsWith('/chimi-contabilidad')} />
                    </>
                )}
        
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
