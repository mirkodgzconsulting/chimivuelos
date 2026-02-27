
'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { MessageCircle, X, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, getMyConversation, markAsRead } from '@/app/actions/chat'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

interface Message {
    id: string
    content: string
    is_admin: boolean
    created_at: string
    isOptimistic?: boolean
}

export function ChatWidget() {
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [unreadCount, setUnreadCount] = useState(0)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const pathname = usePathname()
    
    // Memoize supabase client
    const supabase = useMemo(() => createClient(), [])

    const isClientPortal = pathname?.startsWith('/portal')

    // 1. Initial Load
    useEffect(() => {
        if (!isClientPortal) return

        const loadInitialData = async () => {
            const data = await getMyConversation()
            if (data) {
                setConversationId(data.id)
                setMessages(data.messages || [])
                setUnreadCount(data.unread_client_count || 0)
            }
        }
        loadInitialData()
    }, [isClientPortal])

    // Use a Ref to track isOpen for the real-time listener without re-subscribing
    const isOpenRef = useRef(isOpen)
    useEffect(() => {
        isOpenRef.current = isOpen
    }, [isOpen])

    // 2. Realtime Subscription
    useEffect(() => {
        if (!isClientPortal || !conversationId) return

        let mounted = true

        // Ensure auth is healthy for Realtime
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'TOKEN_REFRESHED') {
                console.log('--- CHAT DEBUG: Auth token refreshed')
            }
        })

        const channel = supabase
            .channel(`client-chat-${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`
                },
                (payload) => {
                    const newMsg = payload.new as Message
                    
                    if (!mounted) return

                    setMessages((prev) => {
                        if (prev.some(m => m.id === newMsg.id)) return prev
                        if (!newMsg.is_admin) {
                            const optimisticIdx = prev.findIndex(m => 
                                m.isOptimistic && m.content === newMsg.content
                            )
                            if (optimisticIdx !== -1) {
                                const newList = [...prev]
                                newList[optimisticIdx] = newMsg 
                                return newList
                            }
                        }
                        return [...prev, newMsg]
                    })
                    
                    if (newMsg.is_admin) {
                         if (isOpenRef.current) {
                             markAsRead(conversationId)
                             setUnreadCount(0)
                         } else {
                             setUnreadCount(prev => prev + 1)
                         }
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('--- CHAT DEBUG: Connected to', conversationId)
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('--- CHAT DEBUG: Connection error:', status)
                }
            })

        return () => {
            mounted = false
            authSub.unsubscribe()
            supabase.removeChannel(channel)
        }
    }, [isClientPortal, supabase, conversationId])

    // Auto-scroll
    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isOpen])

    const toggleChat = () => {
        const newState = !isOpen
        setIsOpen(newState)
        
        if (newState && conversationId && unreadCount > 0) {
            markAsRead(conversationId)
            setUnreadCount(0)
        }
    }

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!newMessage.trim()) return

        const tempContent = newMessage
        const tempId = crypto.randomUUID()
        const optimisticMsg: Message & { isOptimistic: boolean } = {
            id: tempId,
            content: tempContent,
            is_admin: false,
            created_at: new Date().toISOString(),
            isOptimistic: true
        }

        setMessages(prev => [...prev, optimisticMsg])
        setNewMessage('') 
        
        try {
            const result = await sendMessage(tempContent)
            if (result?.error) {
                setMessages(prev => prev.filter(m => m.id !== tempId))
                setNewMessage(tempContent)
                alert('No se pudo enviar: ' + result.error)
            } else if (result?.conversationId && !conversationId) {
                setConversationId(result.conversationId)
            }
        } catch {
            setMessages(prev => prev.filter(m => m.id !== tempId))
            setNewMessage(tempContent)
        }
    }

    if (!isClientPortal) return null

    return (
        <div className="fixed bottom-0 right-6 z-50 flex flex-col items-end font-sans focus-within:outline-none">
            {isOpen && (
                <div className="w-[350px] h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 mb-20 z-50">
                    <div className="bg-linear-to-r from-chimipink to-chimicyan p-4 flex justify-between items-center text-slate-900 border-b border-white/20">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/30 p-2 rounded-full backdrop-blur-sm border border-white/40 shadow-sm">
                                <MessageCircle size={20} className="text-white drop-shadow-sm fill-white/20" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">Soporte Chat</h3>
                            </div>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-slate-700 hover:text-slate-900 hover:bg-white/20 p-1.5 rounded-full transition-all cursor-pointer">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 relative custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="text-center text-slate-500 text-sm mt-10 px-4 flex flex-col items-center animate-in fade-in duration-500">
                                <div className="w-16 h-16 bg-linear-to-br from-chimipink/10 to-chimicyan/10 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                     <span className="text-2xl animate-bounce">👋</span>
                                </div>
                                <p className="font-bold text-slate-700">¡Hola!</p>
                                <p className="text-slate-400 text-xs mt-1">¿Cómo podemos ayudarte hoy?</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => (
                                <div 
                                    key={msg.id || idx} 
                                    className={`flex w-full ${!msg.is_admin ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm transition-all hover:shadow-md ${
                                        !msg.is_admin 
                                            ? 'bg-chimipink text-white rounded-br-none' 
                                            : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none'
                                    }`}>
                                        <p className="leading-relaxed">{msg.content}</p>
                                        <p className={`text-[10px] mt-1 text-right ${!msg.is_admin ? 'text-pink-100/80' : 'text-slate-400'}`}>
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Escribe aquí..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-chimipink/20 focus:border-chimipink transition-all text-slate-800 placeholder:text-slate-400 outline-none"
                        />
                        <button 
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="bg-chimipink hover:bg-pink-600 text-white p-2.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow shadow-pink-200 hover:scale-105 active:scale-95 cursor-pointer"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            )}

            <div className="flex items-end relative">
                {!isOpen && (
                    <div className="absolute right-full bottom-0 mr-[-5px] w-48 h-48 animate-in slide-in-from-right-10 fade-in duration-1000 pointer-events-none overflow-hidden">
                        <Image 
                            src="/bot2.webp" 
                            alt="Bot Asistente" 
                            width={200} 
                            height={200} 
                            className="object-contain object-bottom drop-shadow-xl translate-y-[2px]"
                            priority
                        />
                    </div>
                )}

                <button 
                    onClick={toggleChat}
                    className="mb-14 mr-2 relative bg-chimipink hover:bg-pink-600 text-white p-4 rounded-full shadow-xl shadow-pink-300/40 transition-all hover:scale-110 active:scale-95 group z-50 cursor-pointer"
                >
                    {isOpen ? <X size={24} /> : <MessageCircle size={24} className="fill-current" />}
                    {!isOpen && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce shadow-sm">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>
        </div>
    )
}
