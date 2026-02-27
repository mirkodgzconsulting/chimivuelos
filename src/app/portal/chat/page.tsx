'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getMyConversation, sendMessage, markAsRead, type Message, type Conversation } from '@/app/actions/chat'
import { Send, MessageCircle, Info } from 'lucide-react'

export default function ClientChatPage() {
    const [conversation, setConversation] = useState<Conversation | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const supabase = useMemo(() => createClient(), [])

    const loadChat = useCallback(async () => {
        const data = await getMyConversation()
        if (data) {
            setConversation(data)
            if (data.messages) setMessages(data.messages)
            
            // Mark as read
            if (data.unread_client_count > 0) {
                await markAsRead(data.id)
            }
        }
        setLoading(false)
    }, [])


    useEffect(() => {
        const timer = setTimeout(() => {
            void loadChat()
        }, 0)
        return () => clearTimeout(timer)
    }, [loadChat])

    useEffect(() => {
        if (!conversation) return

        const channel = supabase
            .channel(`client-chat-${conversation.id}`)
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages', 
                    filter: `conversation_id=eq.${conversation.id}` 
                },
                (payload) => {
                    const newMsg = payload.new as Message
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev
                        
                        // Replace optimistic
                        if (!newMsg.is_admin) {
                            const optIdx = prev.findIndex(m => m.isOptimistic && m.content === newMsg.content)
                            if (optIdx !== -1) {
                                const newList = [...prev]
                                newList[optIdx] = newMsg
                                return newList
                            }
                        }
                        return [...prev, newMsg]
                    })

                    // Mark as read if it's from admin
                    if (newMsg.is_admin) {
                        markAsRead(conversation.id)
                    }
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [conversation, supabase])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newMessage.trim()) return

        const content = newMessage
        const tempId = crypto.randomUUID()
        const optimisticMsg: Message & { isOptimistic: boolean } = {
            id: tempId,
            content: content,
            is_admin: false,
            created_at: new Date().toISOString(),
            sender_id: 'temp',
            isOptimistic: true
        }

        setMessages(prev => [...prev, optimisticMsg])
        setNewMessage('')
        
        await sendMessage(content)
        // If it was the first message, reload to get conversation ID
        if (!conversation) {
            void loadChat()
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Cargando chat...</div>
    }

    return (
        <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-chimiteal to-blue-500 flex items-center justify-center text-white shadow-sm">
                        <MessageCircle size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-slate-800">Soporte Chimivuelos</h1>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            Estamos en línea para ayudarte
                        </p>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-100 italic">
                    <Info size={12} className="text-chimiteal" />
                    Las respuestas pueden tardar unos minutos
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-50/20">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-8">
                        <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                             <MessageCircle size={40} className="text-slate-200" />
                        </div>
                        <h2 className="font-bold text-slate-700">¿En qué podemos ayudarte?</h2>
                        <p className="text-sm text-slate-500 max-w-xs">Escribe tu consulta y un agente te responderá lo antes posible.</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`flex w-full ${!msg.is_admin ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] md:max-w-[70%] p-3 rounded-2xl text-sm shadow-sm ${
                                !msg.is_admin
                                    ? 'bg-chimiteal text-white rounded-br-none'
                                    : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                            }`}>
                                <p>{msg.content}</p>
                                <span className={`block text-[10px] mt-1 text-right ${!msg.is_admin ? 'text-teal-100' : 'text-slate-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-50">
                <form onSubmit={handleSend} className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-chimiteal/20 focus-within:border-chimiteal transition-all">
                    <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe tu mensaje..." 
                        className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder:text-slate-400 px-3 py-2 outline-none text-sm"
                    />
                    <button 
                        type="submit" 
                        disabled={!newMessage.trim()}
                        className="p-2.5 bg-chimiteal hover:bg-teal-600 text-white rounded-lg transition-all disabled:opacity-50 shadow-sm"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    )
}
