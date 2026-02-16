import { Plane, Banknote, Package, Users, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="space-y-6 relative">
      {/* Decorative Background Fade */}
      <div className="absolute inset-0 -top-6 -left-6 -right-6 h-32 bg-linear-to-b from-sidebar/20 to-transparent pointer-events-none z-0" />



      {/* KPI Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 relative z-10">
        <Card className="border-slate-100 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-chimipink/40 hover:shadow-lg hover:shadow-pink-100/50 transition-all duration-300 cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-5">
            <CardTitle className="text-sm font-bold text-slate-600 group-hover:text-chimipink transition-colors">Vuelos Activos</CardTitle>
            <div className="p-2 rounded-full bg-pink-50 group-hover:bg-chimipink/10 transition-colors">
              <Plane className="h-5 w-5 text-chimipink group-hover:scale-110 transition-transform" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-3xl font-extrabold text-slate-900">12</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">+2 esta semana</span>
            </p>
          </CardContent>
        </Card>
        
        <Card className="border-slate-100 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-chimicyan/50 hover:shadow-lg hover:shadow-cyan-100/50 transition-all duration-300 cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-5">
            <CardTitle className="text-sm font-bold text-slate-600 group-hover:text-chimicyan transition-colors">Giros Pendientes</CardTitle>
             <div className="p-2 rounded-full bg-cyan-50 group-hover:bg-chimicyan/10 transition-colors">
              <Banknote className="h-5 w-5 text-chimicyan group-hover:scale-110 transition-transform" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-3xl font-extrabold text-slate-900">€ 5,240.00</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span className="text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-bold">3 urgentes</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-100 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100/50 transition-all duration-300 cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-5">
            <CardTitle className="text-sm font-bold text-slate-600 group-hover:text-purple-600 transition-colors">Encomiendas</CardTitle>
             <div className="p-2 rounded-full bg-purple-50 group-hover:bg-purple-100 transition-colors">
              <Package className="h-5 w-5 text-purple-600 group-hover:scale-110 transition-transform" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-3xl font-extrabold text-slate-900">28</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span className="text-slate-400">8 en tránsito internacional</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-100 bg-white/80 backdrop-blur-sm hover:bg-white hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-5">
            <CardTitle className="text-sm font-bold text-slate-600 group-hover:text-blue-600 transition-colors">Clientes Totales</CardTitle>
            <div className="p-2 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
              <Users className="h-5 w-5 text-blue-600 group-hover:scale-110 transition-transform" />
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="text-3xl font-extrabold text-slate-900">1,240</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600">+15 nuevos hoy</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Sections */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7 relative z-10">
        
        {/* Large Chart Section */}
        <Card className="col-span-4 shadow-sm border-slate-100 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-800">Resumen de Ventas</CardTitle>
            <CardDescription className="text-slate-500">
               Ingresos mensuales comparados con el año anterior.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-6 pr-6 pb-6">
            <div className="h-[320px] w-full bg-slate-50/50 rounded-xl flex items-center justify-center border border-dashed border-slate-200/60 hover:bg-white transition-colors cursor-crosshair group">
              <div className="text-center group-hover:scale-105 transition-transform">
                <p className="text-slate-400 text-sm font-medium mb-2">Área de Gráficos</p>
                <p className="text-xs text-slate-300">Recharts / Chart.js</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Recent Activity List */}
        <Card className="col-span-3 shadow-sm border-slate-100 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-800">Actividad Reciente</CardTitle>
            <CardDescription className="text-slate-500">
              Últimas transacciones y registros.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center group">
                  <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-100 bg-white items-center justify-center shadow-sm group-hover:border-chimipink/30 transition-colors">
                     <Users className="h-5 w-5 text-slate-400 group-hover:text-chimipink transition-colors" />
                  </span>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-bold leading-none text-slate-800">Nuevo Cliente Registrado</p>
                    <p className="text-xs text-slate-500">Juan Pérez se ha unido.</p>
                  </div>
                  <div className="ml-auto text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full">Hace {i}h</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
