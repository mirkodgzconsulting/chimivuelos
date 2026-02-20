
'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAdminConversations, getAdminConversationDetails, sendAdminMessage, markAdminMessagesAsRead, type Message, type Conversation } from '@/app/actions/chat'
import { Search, Send, User, MessageCircle, ArrowLeft } from 'lucide-react'

// Layout for Admin Chat
// Left Sidebar: List of conversations
// Main: Selected Conversation

export default function AdminChatPage() {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState(true)
    const [isInitialLoadDone, setIsInitialLoadDone] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = useMemo(() => createClient(), [])

    // Load Conversations List
    const loadConversations = useCallback(async () => {
        const result = await getAdminConversations()
        if (result) setConversations(result)
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!isInitialLoadDone) {
            const timer = setTimeout(() => {
                loadConversations()
                setIsInitialLoadDone(true)
            }, 0)
            return () => clearTimeout(timer)
        }
    }, [loadConversations, isInitialLoadDone])

    useEffect(() => {
        const channel = supabase
            .channel('admin-chat-list')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'conversations' 
            }, (payload) => {
                console.log('--- ADMIN DEBUG: Conversation list change:', payload)
                loadConversations()
            })
            .subscribe((status) => {
                console.log('--- ADMIN DEBUG: List subscription status:', status)
            })

        return () => { 
            supabase.removeChannel(channel) 
        }
    }, [supabase, loadConversations])

    // Load Selected Conversation Messages
    useEffect(() => {
        if (!selectedConvId) return

        let mounted = true

        const loadDetails = async () => {
            const data = await getAdminConversationDetails(selectedConvId)
            
            if (!mounted) return;

            if (data && data.messages) {
                setMessages(data.messages)
                // Mark as read immediately in DB
                if (data.unread_admin_count > 0) {
                    await markAdminMessagesAsRead(selectedConvId)
                    // Update local state for immediate feedback
                    setConversations(prev => prev.map(c => 
                        c.id === selectedConvId ? { ...c, unread_admin_count: 0 } : c
                    ))
                }
            }
        }
        loadDetails()

        // Realtime for Messages in ACTIVE chat
        const msgChannel = supabase
            .channel(`admin-chat-messages-${selectedConvId}`)
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages', 
                    filter: `conversation_id=eq.${selectedConvId}` 
                },
                async (payload) => {
                    const newMsg = payload.new as Message
                    
                    if (!mounted) return;

                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev
                        
                        // Handle optimistic message replacement
                        if (newMsg.is_admin) {
                            const optIdx = prev.findIndex(m => m.isOptimistic && m.content === newMsg.content)
                            if (optIdx !== -1) {
                                const newList = [...prev]
                                newList[optIdx] = newMsg
                                return newList
                            }
                        }
                        return [...prev, newMsg]
                    })

                    // If a message arrives while we ARE in this chat, mark it as read automatically
                    if (!newMsg.is_admin) {
                        await markAdminMessagesAsRead(selectedConvId)
                        // Ensure local list also clears
                        setConversations(prev => prev.map(c => 
                            c.id === selectedConvId ? { ...c, unread_admin_count: 0 } : c
                        ))
                    }
                }
            )
            .subscribe()

        return () => { 
            mounted = false
            supabase.removeChannel(msgChannel) 
        }
    }, [selectedConvId, supabase])


    // Auto-scroll logic (With flex-col-reverse we don't need intense scrolling manually usually)
    useEffect(() => {
        if (selectedConvId && messagesEndRef.current) {
            // No manual scroll needed for flex-col-reverse in most cases as it anchors to bottom,
            // but we keep the ref to be safe if behavior is forced.
        }
    }, [messages, selectedConvId])


    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim() || !selectedConvId) return

        const content = newMessage
        const tempId = crypto.randomUUID()
        const optimisticMsg: Message & { isOptimistic: boolean } = {
            id: tempId,
            content: content,
            is_admin: true,
            created_at: new Date().toISOString(),
            sender_id: 'temp-admin',
            isOptimistic: true
        }

        // Optimistic update
        setMessages(prev => [...prev, optimisticMsg])
        setNewMessage('')
        
        const result = await sendAdminMessage(selectedConvId, content)
        if (result?.error) {
            setMessages(prev => prev.filter(m => m.id !== tempId))
            setNewMessage(content)
            alert('Error al enviar: ' + result.error)
        }
    }

    // Filter Logic
    const filteredConversations = conversations.filter(c => {
        const name = `${c.profiles?.first_name || ''} ${c.profiles?.last_name || ''}`.toLowerCase()
        const email = (c.profiles?.email || '').toLowerCase()
        const query = searchTerm.toLowerCase()
        return name.includes(query) || email.includes(query)
    })

    const selectedConversation = conversations.find(c => c.id === selectedConvId)

    return (
        <div className="flex h-[calc(100vh-100px)] bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden font-sans relative">
            
            {/* Sidebar List */}
            <div className={`
                ${selectedConvId ? 'hidden md:flex' : 'flex'} 
                w-full md:w-1/3 border-r border-slate-100 flex-col bg-slate-50/50
            `}>
                <div className="p-4 border-b border-slate-100 bg-white">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <MessageCircle className="text-chimipink" /> 
                        Mensajes
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar cliente..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-chimipink/20 focus:bg-white transition-all outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400">Cargando chats...</div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No hay conversaciones activas.</div>
                    ) : (
                        filteredConversations.map(chat => (
                            <button
                                key={chat.id}
                                onClick={() => setSelectedConvId(chat.id)}
                                className={`w-full p-4 flex items-start gap-3 border-b border-slate-100 hover:bg-white transition-colors text-left group ${
                                    selectedConvId === chat.id ? 'bg-white border-l-4 border-l-chimipink shadow-sm' : 'border-l-4 border-l-transparent'
                                }`}
                            >
                                <div className={`p-2.5 rounded-full ${selectedConvId === chat.id ? 'bg-chimipink text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-pink-100 group-hover:text-chimipink'}`}>
                                    <User size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h4 className={`font-bold text-sm truncate ${selectedConvId === chat.id ? 'text-slate-900' : 'text-slate-700'}`}>
                                            {chat.profiles?.first_name} {chat.profiles?.last_name}
                                        </h4>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(chat.last_message_at).toLocaleDateString([], {month: 'short', day: 'numeric'})}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate h-4">
                                        {/* Unread count logic visual */}
                                        {chat.unread_admin_count > 0 ? (
                                            <span className="flex items-center gap-1 text-red-500 font-bold">
                                                 <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                                 {chat.unread_admin_count} nuevos
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">Ver conversación</span>
                                        )}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`
                ${selectedConvId ? 'flex' : 'hidden md:flex'} 
                flex-1 flex-col bg-slate-50/30
            `}>
                {selectedConvId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-3 md:p-4 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                {/* Back Button Mobile */}
                                <button 
                                    onClick={() => setSelectedConvId(null)}
                                    className="md:hidden p-2 -ml-2 text-slate-500 hover:text-chimipink"
                                >
                                    <ArrowLeft size={20} />
                                </button>

                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-linear-to-br from-chimipink to-chimicyan flex items-center justify-center text-white font-bold text-xs md:text-sm">
                                    {selectedConversation?.profiles?.first_name?.[0]}
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm md:text-base text-slate-800 leading-tight">
                                        {selectedConversation?.profiles?.first_name} {selectedConversation?.profiles?.last_name}
                                    </h3>
                                    <p className="text-[10px] md:text-xs text-slate-500 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        Cliente registrado
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div className="hidden sm:block px-3 py-1 bg-slate-100 text-slate-500 text-xs rounded-full font-medium">
                                    {selectedConversation?.profiles?.email}
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col-reverse gap-4 md:gap-6">
                            <div ref={messagesEndRef} />
                            {[...messages].reverse().map((msg) => (
                                <div key={msg.id} className={`flex w-full ${msg.is_admin ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] md:max-w-[70%] p-3 md:p-4 rounded-2xl text-sm shadow-sm ${
                                        msg.is_admin
                                            ? 'bg-chimipink text-white rounded-br-none'
                                            : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
                                    }`}>
                                        <p className="leading-relaxed">{msg.content}</p>
                                        <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${msg.is_admin ? 'text-pink-100' : 'text-slate-400'}`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {messages.length === 0 && (
                                <div className="text-center text-slate-400 my-10">Inicio de la conversación</div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-4 bg-white border-t border-slate-100">
                            <form onSubmit={handleSend} className="flex gap-3 items-center bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-chimipink/20 focus-within:border-chimipink transition-all">
                                <input 
                                    type="text" 
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Escribe una respuesta..." 
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder:text-slate-400 px-2 outline-none"
                                />
                                <button 
                                    type="submit" 
                                    disabled={!newMessage.trim()}
                                    className="p-2.5 bg-chimipink hover:bg-pink-600 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-pink-200"
                                >
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <MessageCircle size={32} className="text-slate-300" />
                        </div>
                        <p>Selecciona un chat para comenzar</p>
                    </div>
                )}
            </div>
        </div>
    )
}
