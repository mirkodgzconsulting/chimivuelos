"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Search, Trash2, UserCog, FileText, X, Download, FolderOpen } from "lucide-react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
// import { cn } from "@/lib/utils" // Unused
import { createClient } from "@/lib/supabase/client"
import { createClient as createClientAction, updateClient, deleteClient, deleteClientFile, getSignedDownloadUrl } from "@/app/actions/manage-clients"

interface ClientFile {
  path: string
  name: string
  type: string
  size: number
  storage?: 'r2' | 'images'
}

interface ClientProfile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string | null
  phone: string | null
  document_type: string | null
  document_number: string | null
  client_files: ClientFile[] | null
  active: boolean | null
  created_at?: string
}

const initialClients: ClientProfile[] = []

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientProfile[]>(initialClients)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  
  // Docs Viewer State
  const [docsViewerClient, setDocsViewerClient] = useState<ClientProfile | null>(null)

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone: "",
    document_type: "",
    document_number: "",
  })

  // Start with empty array for new files
  const [newFiles, setNewFiles] = useState<File[]>([])
  // Keep track of existing files for display/delete during edit
  const [existingFiles, setExistingFiles] = useState<ClientFile[]>([])

  const supabase = useMemo(() => createClient(), [])

  const getClientsList = useCallback(async () => {
    // Filter by role = 'client'
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq('role', 'client') // Assuming role column exists and is populated
        .order("created_at", { ascending: false })
    return { data, error }
  }, [supabase])

  const refreshClients = async () => {
    const { data, error } = await getClientsList()
    if (!error && data) {
        setClients(data as unknown as ClientProfile[])
    }
  }

  useEffect(() => {
    let mounted = true
    getClientsList().then(({ data, error }) => {
      if (mounted && !error && data) {
        setClients(data as unknown as ClientProfile[])
      }
    })
    return () => { mounted = false }
  }, [getClientsList])

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    
    // Enforce numeric only for specific fields
    if (name === 'phone' || name === 'document_number') {
        const numericValue = value.replace(/\D/g, '')
        setFormData(prev => ({ ...prev, [name]: numericValue }))
        return
    }

    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files)
      // Basic validation: max 5 files total (existing + new)
      const totalCount = existingFiles.length + newFiles.length + selected.length
      if (totalCount > 5) {
        alert(`Solo puedes subir un máximo de 5 archivos. Actualmente tienes ${existingFiles.length + newFiles.length} y seleccionaste ${selected.length}.`)
        return
      }
      setNewFiles(prev => [...prev, ...selected])
    }
  }

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingFile = async (file: ClientFile) => {
      if (!selectedClientId) return
      if (!confirm(`¿Eliminar archivo ${file.name}?`)) return

      // Call server action to delete single file
      const res = await deleteClientFile(selectedClientId, file.path)
      if (res.error) {
          alert(res.error)
      } else {
          // Remove from local state immediately for UI responsiveness
          setExistingFiles(prev => prev.filter(f => f.path !== file.path))
          refreshClients() // Sync with DB
      }
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
      phone: "",
      document_type: "",
      document_number: "",
    })
    setSelectedClientId(null)
    setNewFiles([])
    setExistingFiles([])
  }

  const handleOpenDialog = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleEdit = (client: ClientProfile) => {
    setFormData({
      first_name: client.first_name || "",
      last_name: client.last_name || "",
      email: client.email || "",
      password: "", 
      phone: client.phone || "",
      document_type: client.document_type || "",
      document_number: client.document_number || "",
    })
    setSelectedClientId(client.id)
    setExistingFiles(client.client_files || [])
    setNewFiles([])
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este cliente? Se borrarán todos sus datos y archivos.")) {
      return
    }

    try {
      const result = await deleteClient(id)
      if (result.error) {
        alert(result.error)
      } else {
        refreshClients()
      }
    } catch (error) {
      console.error("Error deleting client:", error)
      alert("Error al eliminar el cliente")
    }
  }

  const handleViewFile = async (file: ClientFile) => {
    try {
        // Default to 'r2' if storage is missing (migration assumption)
        const storageType = file.storage || (file.path.includes('/') ? 'r2' : 'images');
        
        // Ensure storageType is correctly typed as 'r2' | 'images'
        const validStorage = (storageType === 'images') ? 'images' : 'r2';

        const url = await getSignedDownloadUrl(file.path, validStorage);
        if (url && url !== '#error-url') {
            window.open(url, '_blank');
        } else {
            alert("No se pudo generar el enlace. Intente nuevamente.");
        }
    } catch (e) {
        console.error("Error viewing file:", e);
        alert("Error al abrir el archivo.");
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
        const formDataToSend = new FormData()
        formDataToSend.append('first_name', formData.first_name)
        formDataToSend.append('last_name', formData.last_name)
        formDataToSend.append('email', formData.email)
        formDataToSend.append('password', formData.password)
        formDataToSend.append('phone', formData.phone)
        formDataToSend.append('document_type', formData.document_type)
        formDataToSend.append('document_number', formData.document_number)
        
        // Append all new files
        newFiles.forEach(file => {
            formDataToSend.append('documents', file)
        })

        let result
        if (selectedClientId) {
          formDataToSend.append('id', selectedClientId)
          result = await updateClient(formDataToSend)
        } else {
          result = await createClientAction(formDataToSend)
        }

        if (result?.error) {
            alert(result.error)
            return
        }

        setIsDialogOpen(false)
        resetForm()
        refreshClients()

    } catch (error) {
        console.error("Error handling client:", error)
        alert("Ocurrió un error inesperado")
    }
  }

  const handleExportExcel = () => {
    const dataToExport = clients.map(c => ({
        Nombre: c.first_name,
        Apellido: c.last_name,
        Email: c.email,
        Celular: c.phone,
        Documento: `${c.document_type || ''} ${c.document_number || ''}`,
        Estado: c.active ? 'Activo' : 'Inactivo',
        FechaRegistro: c.created_at
    }))
    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes")
    XLSX.writeFile(workbook, "Clientes_Chimivuelos.xlsx")
  }

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentClients = clients.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(clients.length / itemsPerPage)

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)

  return (
    <div className="space-y-6">
      {/* Modal for Viewing Documents */}
      <Dialog open={!!docsViewerClient} onOpenChange={(open) => !open && setDocsViewerClient(null)}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Documentos del Cliente</DialogTitle>
                  <DialogDescription>
                      {docsViewerClient?.first_name} {docsViewerClient?.last_name}
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                  {docsViewerClient?.client_files && docsViewerClient.client_files.length > 0 ? (
                      docsViewerClient.client_files.map((doc, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border rounded-md hover:bg-slate-100 transition-colors">
                              <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="bg-blue-100 p-2 rounded text-blue-600">
                                      <FileText className="h-4 w-4" />
                                  </div>
                                  <div className="flex flex-col truncate">
                                      <span className="font-medium text-sm truncate">{doc.name}</span>
                                      <span className="text-xs text-slate-500">{(doc.size / 1024).toFixed(1)} KB</span>
                                  </div>
                              </div>
                              <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-800" onClick={() => handleViewFile(doc)}>
                                  <Download className="h-4 w-4" />
                              </Button>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-6 text-slate-500 text-sm">
                          No hay documentos adjuntos.
                      </div>
                  )}
              </div>
          </DialogContent>
      </Dialog>

      <div className="flex items-center justify-center">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 gap-2 font-bold shadow-md border-none">
              <Plus className="h-4 w-4" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedClientId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}</DialogTitle>
              <DialogDescription>
                {selectedClientId ? 'Actualiza los datos del cliente.' : 'Ingresa los datos del nuevo cliente.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="first_name">Nombres <span className="text-red-500">*</span></Label>
                  <Input id="first_name" name="first_name" required value={formData.first_name} onChange={handleInputChange} placeholder="Ej. Maria" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="last_name">Apellidos <span className="text-red-500">*</span></Label>
                  <Input id="last_name" name="last_name" required value={formData.last_name} onChange={handleInputChange} placeholder="Ej. Lopez" />
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="email">Correo Electrónico <span className="text-red-500">*</span></Label>
                <Input id="email" name="email" type="email" required value={formData.email} onChange={handleInputChange} placeholder="maria@chimivuelos.pe" disabled={!!selectedClientId} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña {selectedClientId ? '(Dejar en blanco para mantener)' : <span className="text-red-500">*</span>}</Label>
                <Input id="password" name="password" type="password" required={!selectedClientId} value={formData.password} onChange={handleInputChange} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                 <div className="grid gap-2 col-span-1">
                    <Label htmlFor="document_type">Tipo Doc <span className="text-red-500">*</span></Label>
                    <select
                      id="document_type"
                      name="document_type"
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chimipink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={formData.document_type}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="" disabled>Seleccione</option>
                      <option value="DNI">DNI</option>
                      <option value="PASAPORTE">Pasaporte</option>
                      <option value="CE">CE</option>
                      <option value="RUC">RUC</option>
                    </select>
                 </div>
                 <div className="grid gap-2 col-span-2">
                    <Label htmlFor="document_number">Nro. Documento <span className="text-red-500">*</span></Label>
                    <Input id="document_number" name="document_number" type="tel" inputMode="numeric" required value={formData.document_number} onChange={handleInputChange} placeholder="Ej. 78945612" />
                 </div>
              </div>

              <div className="grid gap-2">
                 <Label htmlFor="phone">Celular</Label>
                 <Input id="phone" name="phone" type="tel" inputMode="numeric" value={formData.phone} onChange={handleInputChange} placeholder="Ej. 987654321" />
              </div>

              <div className="grid gap-2">
                 <Label htmlFor="documents">Adjuntar Documentos (Max 5)</Label>
                 <Input 
                   id="documents" 
                   name="documents" 
                   type="file" 
                   multiple
                   accept="image/*,.pdf,.doc,.docx"
                   className="cursor-pointer p-0 text-slate-500 file:h-full file:mr-4 file:py-2 file:px-4 file:border-0 file:border-r file:border-slate-200 file:text-sm file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100" 
                   onChange={handleFileChange}
                 />
                 <div className="text-xs text-slate-500">
                    Permitido: Imágenes, PDF, Word.
                 </div>
                 
                 {/* Files List - New */}
                 {newFiles.length > 0 && (
                     <div className="mt-2 space-y-2">
                         <p className="text-xs font-semibold text-slate-700">Archivos Nuevos:</p>
                         {newFiles.map((file, idx) => (
                             <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-md border border-slate-200 text-sm">
                                 <span className="truncate max-w-[200px]">{file.name}</span>
                                 <Button type="button" variant="ghost" size="sm" onClick={() => removeNewFile(idx)} className="h-6 w-6 p-0 text-slate-400 hover:text-red-500">
                                     <X className="h-4 w-4" />
                                 </Button>
                             </div>
                         ))}
                     </div>
                 )}

                 {/* Files List - Existing (Edit Mode) */}
                 {existingFiles.length > 0 && (
                      <div className="mt-2 space-y-2">
                          <p className="text-xs font-semibold text-slate-700">Archivos Actuales:</p>
                          {existingFiles.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between p-2 bg-blue-50 rounded-md border border-blue-100 text-sm">
                                  <div className="flex flex-col">
                                      <button 
                                        type="button"
                                        onClick={() => handleViewFile(file)}
                                        className="truncate max-w-[200px] text-blue-600 hover:underline font-medium text-left cursor-pointer focus:outline-none"
                                      >
                                          {file.name}
                                      </button>
                                      <span className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                                      {file.storage && <span className="text-[9px] text-slate-400 capitalize">{file.storage === 'images' ? 'Imagen' : 'Doc'}</span>}
                                  </div>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeExistingFile(file)} className="h-6 w-6 p-0 text-slate-400 hover:text-red-500">
                                      <Trash2 className="h-4 w-4" />
                                  </Button>
                              </div>
                          ))}
                      </div>
                 )}
              </div>

              <DialogFooter>
                <Button type="submit" className="bg-linear-to-r from-chimipink to-chimicyan hover:opacity-90 transition-opacity text-slate-700 w-full sm:w-auto font-bold shadow-md">
                   {selectedClientId ? 'Actualizar Cliente' : 'Crear Cliente'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 p-4 border-b border-slate-100 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar por nombre, email o DNI..." 
              className="pl-10 border-slate-200 bg-slate-50 focus:bg-white focus:ring-chimiteal focus:border-chimiteal"
            />
          </div>
          <div className="flex items-center gap-2">
            <select 
              className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-chimiteal cursor-pointer w-24"
              value={itemsPerPage}
              onChange={handleItemsPerPageChange}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
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
                  <th className="px-6 py-4 font-medium">Cliente</th>
                  <th className="px-6 py-4 font-medium">Documento</th>
                  <th className="px-6 py-4 font-medium">Celular</th>
                  <th className="px-6 py-4 font-medium text-center">Docs</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentClients.map((client) => (
                  <tr key={client.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                       <div>
                         <div className="font-medium text-slate-900">{client.first_name} {client.last_name}</div>
                         <div className="text-xs text-slate-500">{client.email}</div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-700">{client.document_type}</span>
                        <span className="text-slate-500">{client.document_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {client.phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {client.client_files && client.client_files.length > 0 ? (
                            <Button size="sm" variant="ghost" className="text-chimiteal hover:bg-teal-50" onClick={() => setDocsViewerClient(client)}>
                                <FolderOpen className="h-5 w-5" />
                                <span className="ml-1 text-xs">{client.client_files.length}</span>
                            </Button>
                        ) : (
                            <span className="text-slate-300">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(client)} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                          <UserCog className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(client.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {currentClients.length === 0 && (
                    <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                            No se encontraron clientes.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {clients.length > 0 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-slate-100 bg-slate-50/50 flex-wrap gap-4">
                <div className="text-xs text-slate-500">
                Mostrando <span className="font-medium">{Math.min(indexOfFirstItem + 1, clients.length)}</span> - <span className="font-medium">{Math.min(indexOfLastItem, clients.length)}</span> de <span className="font-medium">{clients.length}</span> resultados
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
