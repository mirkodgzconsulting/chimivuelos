
-- 1. Create Layout Tables for Chat System

-- Create ENUM for conversation status
DO $$ BEGIN
    CREATE TYPE chat_status AS ENUM ('active', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Table: conversations
-- Acts as the parent thread for a client's chat history.
-- Use ON DELETE CASCADE for client_id to clean up if a user is deleted.
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject text, -- Optional, mostly for context if needed later
    status chat_status DEFAULT 'active',
    last_message_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()),
    unread_admin_count integer DEFAULT 0, -- How many messages the admin hasn't read yet
    unread_client_count integer DEFAULT 0, -- How many messages the client hasn't read yet
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT conversations_client_id_key UNIQUE (client_id) -- One conversation thread per client (WhatsApp style)
);

-- Table: messages
-- Stores individual messages within a conversation.
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who sent it
    content text NOT NULL,
    is_admin boolean DEFAULT false, -- True if sent by an admin (optimization for UI styling)
    read_at timestamp WITH time zone, -- Null = unread
    created_at timestamp WITH time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. Policies for 'conversations'

-- ADMINS: Full access to all conversations
CREATE POLICY "Admins can view all conversations" ON public.conversations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
        OR
        (auth.uid() = client_id) -- Clients can see their own
    );

CREATE POLICY "Admins can insert/update conversations" ON public.conversations
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
    );

-- CLIENTS: Can view and insert their own conversation
CREATE POLICY "Clients can create their own conversation" ON public.conversations
    FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their own conversation metadata" ON public.conversations
    FOR UPDATE USING (auth.uid() = client_id);


-- 4. Policies for 'messages'

-- ADMINS & CLIENTS: View messages belonging to conversations they have access to
CREATE POLICY "Users can view messages in their conversations" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND (c.client_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
        )
    );

-- ADMINS & CLIENTS: Insert messages
CREATE POLICY "Users can insert messages in their accessible conversations" ON public.messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = conversation_id
            AND (c.client_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'superadmin')))
        )
    );

-- 5. Realtime
-- Enable Realtime for these tables so the chat feels instant
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
