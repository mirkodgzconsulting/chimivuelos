import * as React from 'react';
import { Search, Bell } from 'lucide-react';
import Image from 'next/image';

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
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
        <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
          <Bell className="h-5 w-5 text-slate-600" />
          <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-chimipink ring-2 ring-white animate-pulse" />
        </button>

        {/* Profile Dropdown Logic would go here */}
        <div className="ml-2 flex items-center gap-3 border-l border-slate-200 pl-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-900 leading-none">Admin User</p>
            <p className="text-xs text-slate-500 mt-1">admin@chimivuelos.pe</p>
          </div>
          <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-slate-100 p-0.5">
             <div className="absolute inset-0 bg-linear-to-tr from-chimipink to-chimicyan opacity-20" /> {/* Avatar bg */}
             <Image 
                src="/user.jpg" 
                alt="Admin" 
                width={40} 
                height={40}
                className="h-full w-full rounded-full object-cover"
                unoptimized
             />
          </div>
        </div>
      </div>
    </header>
  );
}
