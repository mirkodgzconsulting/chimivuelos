
'use server'

import { createClient } from '@/lib/supabase/server'

// Define the shape of a conversation and message
export interface Message {
    id: string
    content: string
    is_admin: boolean
    created_at: string
    sender_id: string
    isOptimistic?: boolean
}

export interface Conversation {
    id: string
    client_id: string
    unread_client_count: number
    unread_admin_count: number
    last_message_at: string
    status: 'active' | 'archived'
    messages?: Message[]
    profiles?: {
        first_name: string
        last_name: string
        email: string
        phone?: string
    }
}

// ==============
// Client Actions
// ==============

export async function sendMessage(content: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    try {
        let conversationId: string | null = null

        const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('client_id', user.id)
            .maybeSingle()

        if (existingConv) {
            conversationId = existingConv.id
        } else {
            const { data: newConv, error: createError } = await supabase
                .from('conversations')
                .insert({ client_id: user.id })
                .select('id')
                .single()
            
            if (createError) throw createError
            conversationId = newConv.id
        }

        if (!conversationId) throw new Error('Failed to determine conversation ID')

        const { error: msgError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                sender_id: user.id,
                content: content,
                is_admin: false
            })

        if (msgError) throw msgError

        // 4. Update Conversation: timestamp + increment unread_admin_count
        const { data: conv } = await supabase
            .from('conversations')
            .select('unread_admin_count')
            .eq('id', conversationId)
            .single()

        await supabase
            .from('conversations')
            .update({ 
                last_message_at: new Date().toISOString(),
                status: 'active',
                unread_admin_count: (conv?.unread_admin_count || 0) + 1
            })
            .eq('id', conversationId)

        return { success: true, conversationId }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
        return { error: errorMessage }
    }
}

export async function getMyConversation() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    // Get conversation + messages
    const { data, error } = await supabase
        .from('conversations')
        .select(`
            *,
            messages (
                id,
                content,
                is_admin,
                created_at,
                sender_id
            )
        `)
        .eq('client_id', user.id)
        .single()
    
    if (error || !data) return null

    // Sort messages
    if (data.messages && Array.isArray(data.messages)) {
        data.messages.sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }

    return data as Conversation
}

export async function markAsRead(conversationId: string) {
    const supabase = await createClient()
    await supabase
        .from('conversations')
        .update({ unread_client_count: 0 })
        .eq('id', conversationId)
    
    return { success: true }
}

// ==============
// Admin Actions
// ==============

export async function getAdminConversations() {
    const supabase = await createClient()
    // Normally check admin role here
    
    const { data, error } = await supabase
        .from('conversations')
        .select(`
            *,
            profiles:client_id (
                first_name,
                last_name,
                email
            )
        `)
        .order('last_message_at', { ascending: false })

    if (error) {
        console.error('Error fetching admin conversations:', error)
        return []
    }
    return data as Conversation[]
}

export async function getAdminConversationDetails(conversationId: string) {
    const supabase = await createClient()
    
    const { data, error } = await supabase
        .from('conversations')
        .select(`
            *,
            profiles:client_id (
                first_name,
                last_name,
                email,
                phone
            ),
            messages (
                id,
                content,
                sender_id,
                is_admin,
                created_at
            )
        `)
        .eq('id', conversationId)
        .single()
        
    if (error) return null

    if (data.messages && Array.isArray(data.messages)) {
        data.messages.sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
    return data as Conversation
}

export async function sendAdminMessage(conversationId: string, content: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
        .from('messages')
        .insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content,
            is_admin: true
        })

    if (error) return { error: error.message }

    // Update conversation timestamp + increment unread_client_count
    const { data: conv } = await supabase
        .from('conversations')
        .select('unread_client_count')
        .eq('id', conversationId)
        .single()

    await supabase.from('conversations')
        .update({ 
            last_message_at: new Date().toISOString(),
            status: 'active',
            unread_client_count: (conv?.unread_client_count || 0) + 1
        })
        .eq('id', conversationId)
        
    return { success: true }
}

export async function markAdminMessagesAsRead(conversationId: string) {
    const supabase = await createClient()
    await supabase
        .from('conversations')
        .update({ unread_admin_count: 0 })
        .eq('id', conversationId)
    return { success: true }
}
