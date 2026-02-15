'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Plane, Package, Banknote, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ClientNav() {
  const pathname = usePathname()
  
  const links = [
    { href: '/portal', label: 'Inicio', icon: Home },
    { href: '/portal/vuelos', label: 'Vuelos', icon: Plane },
    { href: '/portal/encomiendas', label: 'Encomiendas', icon: Package },
    { href: '/portal/giros', label: 'Giros', icon: Banknote },
    { href: '/portal/perfil', label: 'Mi Perfil', icon: User },
  ]
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex justify-around items-center sm:hidden z-50 px-2 pb-[env(safe-area-inset-bottom)]">
       {links.map(({ href, label, icon: Icon }) => {
           const isActive = pathname === href || (href !== '/portal' && pathname.startsWith(href))
           return (
               <Link key={href} href={href} className={cn(
                   "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative",
                   isActive ? "text-chimiteal font-medium" : "text-slate-400 hover:text-slate-600"
               )}>
                   {isActive && (
                       <span className="absolute top-0 w-8 h-0.5 bg-chimiteal rounded-b-md" />
                   )}
                   <Icon size={20} className={isActive ? "stroke-[2.5px]" : "stroke-2"} />
                   <span className="text-[10px]">{label}</span>
               </Link>
           )
       })}
    </nav>
  )
}
