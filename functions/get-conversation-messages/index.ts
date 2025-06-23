// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { Authorization: req.headers.get('Authorization')! } 
        }
      }
    )

    // Verify user
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse query parameters
    const url = new URL(req.url)
    const chatId = url.searchParams.get('chat_id')
    const perPage = parseInt(url.searchParams.get('per_page') || '50')
    const currentPage = parseInt(url.searchParams.get('page') || '1')

    // Validate parameters
    if (!chatId) {
      return new Response(JSON.stringify({ error: 'chat_id parameter is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify chat access
    const { data: chat, error: chatError } = await supabaseClient
      .from('chats')
      .select('id')
      .eq('id', chatId)
      .or(`user_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .single()

    if (chatError || !chat) {
      return new Response(JSON.stringify({ error: 'Chat not found or access denied' }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Calculate pagination values
    const from = (currentPage - 1) * perPage
    const to = from + perPage - 1

    // Get total count of messages
    const { count: total } = await supabaseClient
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId)

    // Get paginated messages
    const { data: messages, error } = await supabaseClient
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        read,
        sender:sender_id(id, first_name , last_name , email, profile_picture)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    // count my unread messages
    const myUnreadMessages = messages.filter(
      msg => !msg.read && msg.sender.id == user.id
    )

    // Mark messages as read
    const unreadMessages = messages.filter(
      msg => !msg.read && msg.sender.id !== user.id
    )

    if (unreadMessages.length > 0) {
      await supabaseClient
        .from('messages')
        .update({ read: true })
        .in('id', unreadMessages.map(msg => msg.id))
    }

    // Calculate last page
    const lastPage = Math.ceil((total || 0) / perPage)

    // Format response according to MessagesPaginationModel
    const response = {
      currentPage,
      data: messages, // Return in chronological order
      from: from + 1, // Supabase uses 0-based index, we convert to 1-based
      lastPage,
      perPage,
      to: Math.min(from + perPage, total || 0),
      total,
      total_unread: myUnreadMessages.length
    }

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/get-conversation-messages' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
