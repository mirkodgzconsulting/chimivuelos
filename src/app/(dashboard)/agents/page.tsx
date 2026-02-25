"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Search, Trash2, UserCog } from "lucide-react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { createAgent } from "@/app/actions/create-agent"
import { deleteAgent, updateAgent } from "@/app/actions/manage-agents"

interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string | null
  phone: string | null
  avatar_url: string | null
  active: boolean | null
  created_at?: string
}

const initialAgents: Profile[] = []

export default function AgentsPage() {
  const [agents, setAgents] = useState<Profile[]>(initialAgents)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "", // Fixed: Start empty
    phone: "",
  })

  const supabase = useMemo(() => createClient(), [])

  const getAgentsList = useCallback(async () => {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq('role', 'client') // Exclude clients
        .order("created_at", { ascending: false })
    return { data, error }
  }, [supabase])



  const refreshAgents = async () => {
    const { data, error } = await getAgentsList()
    if (!error && data) {
        setAgents(data)
    }
  }

  useEffect(() => {
    let mounted = true
    
    // Get user role
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (mounted && user) {
        setUserRole(user.user_metadata?.role || 'agent')
      }
    })

    getAgentsList().then(({ data, error }) => {
      if (mounted && !error && data) {
        setAgents(data)
      }
    })
    return () => { mounted = false }
  }, [getAgentsList, supabase])

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    // Enforce numeric only for specific fields
    if (name === 'phone') {
        const numericValue = value.replace(/\D/g, '')
        setFormData(prev => ({ ...prev, [name]: numericValue }))
        return
    }

    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(Number(e.target.value))
    setCurrentPage(1)
  }

  const resetForm = () => {
    setFormData({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      role: "",
      phone: "",
    })
    setSelectedAgentId(null)
  }

  const handleOpenDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (agent: Profile) => {
    setFormData({
      first_name: agent.first_name || "",
      last_name: agent.last_name || "",
      email: agent.email || "",
      password: "", // Don't fill password on edit
      role: agent.role || "",
      phone: agent.phone || "",
    })
    setSelectedAgentId(agent.id)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este agente? Esta acción no se puede deshacer.")) {
      return
    }

    try {
      const result = await deleteAgent(id)
      if (result.error) {
        alert(result.error)
      } else {
        refreshAgents() // Refresh list
      }
    } catch (error) {
      console.error("Error deleting agent:", error)
      alert("Error al eliminar el agente")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
        const form = e.currentTarget as HTMLFormElement
        const formDataToSend = new FormData(form)

        let result
        if (selectedAgentId) {
          // Update
          formDataToSend.append('id', selectedAgentId)
          result = await updateAgent(formDataToSend)
        } else {
          // Create
          result = await createAgent(formDataToSend)
        }

        if (result?.error) {
            alert(result.error)
            return
        }

        // Success handling
        setIsDialogOpen(false)
        resetForm()
        refreshAgents() // Refresh data

    } catch (error) {
        console.error("Error handling agent:", error)
        alert("Ocurrió un error inesperado")
    }
  }

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(agents)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Agentes")
    XLSX.writeFile(workbook, "Agentes_Chimivuelos.xlsx")
  }

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentAgents = agents.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(agents.length / itemsPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center">
        {userRole === 'admin' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenDialog} className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 gap-2 font-bold shadow-md border-none">
                <Plus className="h-4 w-4" />
                Nuevo Agente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{selectedAgentId ? 'Editar Agente' : 'Registrar Nuevo Agente'}</DialogTitle>
                <DialogDescription>
                  {selectedAgentId ? 'Actualiza los datos del usuario.' : 'Ingresa los datos del nuevo usuario del sistema.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="first_name">Nombres <span className="text-red-500">*</span></Label>
                    <Input id="first_name" name="first_name" required value={formData.first_name} onChange={handleInputChange} placeholder="Ej. Juan" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">Apellidos <span className="text-red-500">*</span></Label>
                    <Input id="last_name" name="last_name" required value={formData.last_name} onChange={handleInputChange} placeholder="Ej. Pérez" />
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="email">Correo Electrónico <span className="text-red-500">*</span></Label>
                  <Input id="email" name="email" type="email" required value={formData.email} onChange={handleInputChange} placeholder="juan@chimivuelos.pe" disabled={!!selectedAgentId} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña {selectedAgentId ? '(Dejar en blanco para mantener)' : <span className="text-red-500">*</span>}</Label>
                  <Input id="password" name="password" type="password" required={!selectedAgentId} value={formData.password} onChange={handleInputChange} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                      <Label htmlFor="role">Rol <span className="text-red-500">*</span></Label>
                      <select
                        id="role"
                        name="role"
                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chimipink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.role}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="" disabled>Seleccione un rol</option>
                        <option value="agent">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                  </div>
                  <div className="grid gap-2">
                      <Label htmlFor="phone">Celular</Label>
                      <Input id="phone" name="phone" type="tel" inputMode="numeric" value={formData.phone} onChange={handleInputChange} placeholder="Ej. 987654321" />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="photo">Foto de Perfil</Label>
                  <Input 
                    id="photo" 
                    name="photo" 
                    type="file" 
                    className="cursor-pointer p-0 text-slate-500 file:h-full file:mr-4 file:py-2 file:px-4 file:border-0 file:border-r file:border-slate-200 file:text-sm file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100" 
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 w-full sm:w-auto font-bold shadow-md">
                    {selectedAgentId ? 'Actualizar Agente' : 'Crear Agente'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 p-4 border-b border-slate-100 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar por nombre o email..." 
              className="pl-10 border-slate-200 bg-slate-50 focus:bg-white focus:ring-chimiteal focus:border-chimiteal"
            />
          </div>
          <div className="flex items-center gap-2">
            <select 
              className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer w-24"
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
              title="Filas por página"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <select className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer">
              <option>Todos los roles</option>
              <option>Administrador</option>
              <option>Usuario</option>
            </select>
            <Button variant="outline" onClick={handleExportExcel} className="gap-2 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-medium">Usuario</th>
                  <th className="px-6 py-4 font-medium">Rol</th>
                  <th className="px-6 py-4 font-medium">Celular</th>
                  <th className="px-6 py-4 font-medium text-center">Estado</th>
                  {userRole === 'admin' && <th className="px-6 py-4 font-medium text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentAgents.map((agent) => (
                  <tr key={agent.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                           <Image 
                             src={agent.avatar_url || "/user.jpg"} 
                             alt={agent.first_name || "Agente"}
                             width={40}
                             height={40}
                             className="h-full w-full object-cover"
                             unoptimized
                           />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{agent.first_name} {agent.last_name}</div>
                          <div className="text-xs text-slate-500">{agent.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        agent.role === 'admin' 
                          ? "bg-slate-900 text-white"
                          : "bg-cyan-100 text-cyan-800"
                      )}>
                        {agent.role === 'admin' ? 'Administrador' : 'Agente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {agent.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                         <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                      </div>
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(agent)} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(agent.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 bg-slate-50/50 flex-wrap gap-4">
            <div className="text-xs text-slate-500">
              Mostrando <span className="font-medium">{Math.min(indexOfFirstItem + 1, agents.length)}</span> - <span className="font-medium">{Math.min(indexOfLastItem, agents.length)}</span> de <span className="font-medium">{agents.length}</span> resultados
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => paginate(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
