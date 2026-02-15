import { Plane, Banknote, Package, Users, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <div className="flex gap-2">
          <Button className="bg-chimipink text-white hover:bg-pink-600">
            Nuevo Vuelo
          </Button>
          <Button className="bg-chimicyan text-slate-900 hover:bg-cyan-300">
            Nuevo Giro
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:border-chimipink/30 transition-all duration-300 cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
            <CardTitle className="text-sm font-medium text-slate-500">Vuelos Activos</CardTitle>
            <Plane className="h-4 w-4 text-chimipink group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">12</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600 font-medium">+2 esta semana</span>
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:border-chimicyan/50 transition-all duration-300 cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
            <CardTitle className="text-sm font-medium text-slate-500">Giros Pendientes</CardTitle>
            <Banknote className="h-4 w-4 text-chimicyan group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">€ 5,240.00</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-amber-500 font-medium">3 urgentes por revisar</span>
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-purple-300 transition-all duration-300 cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
            <CardTitle className="text-sm font-medium text-slate-500">Encomiendas</CardTitle>
            <Package className="h-4 w-4 text-purple-500 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">28</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <span className="text-slate-400">8 en tránsito internacional</span>
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-blue-300 transition-all duration-300 cursor-pointer group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
            <CardTitle className="text-sm font-medium text-slate-500">Clientes Totales</CardTitle>
            <Users className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">1,240</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-600 font-medium">+15 nuevos hoy</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Sections */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Large Chart Section */}
        <Card className="col-span-4 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Resumen de Ventas</CardTitle>
            <CardDescription>
               Ingresos mensuales comparados con el año anterior.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full bg-slate-50 rounded-lg flex items-center justify-center border border-dashed border-slate-200">
              <p className="text-slate-400 text-sm">Integración de Gráficos (Recharts / Visx)</p>
            </div>
          </CardContent>
        </Card>
        
        {/* Recent Activity List */}
        <Card className="col-span-3 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>
              Últimas transacciones y registros.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center">
                  <span className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-100 bg-slate-50 items-center justify-center">
                     <Users className="h-4 w-4 text-slate-500" />
                  </span>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none text-slate-900">Nuevo Cliente Registrado</p>
                    <p className="text-xs text-slate-500">Juan Pérez se ha unido.</p>
                  </div>
                  <div className="ml-auto text-xs font-medium text-slate-400">Hace {i}h</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
