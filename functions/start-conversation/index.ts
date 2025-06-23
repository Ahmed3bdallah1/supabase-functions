// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// serve(async (req) => {
//   try {
//     const supabaseClient = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_ANON_KEY') ?? '',
//       { 
//         global: { 
//           headers: { Authorization: req.headers.get('Authorization')! } 
//         }
//       }
//     )

//     const { data: { user } } = await supabaseClient.auth.getUser()
//     if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

//     const { recipient_id } = await req.json()

//     // Check if recipient is valid (admin or seller)
//     const { data: recipient, error: recipientError } = await supabaseClient
//       .from('users')
//       .select('id, user_type')
//       .eq('id', recipient_id)
//       .in('user_type', ['Admin', 'Seller'])
//       .single()

//     if (recipientError || !recipient) {
//       return new Response(JSON.stringify({ error: 'Recipient must be an admin or seller' }), { status: 400 })
//     }

//     // Check for existing chat
//     const { data: existingChat, error: existingError } = await supabaseClient
//       .from('chats')
//       .select('id')
//       .or(`and(user_id.eq.${user.id},recipient_id.eq.${recipient_id}),and(user_id.eq.${recipient_id},recipient_id.eq.${user.id})`)
//       .maybeSingle()

//     if (existingError) throw existingError

//     if (existingChat) {
//       return new Response(JSON.stringify({ chat_id: existingChat.id }), {
//         headers: { 'Content-Type': 'application/json' },
//       })
//     }

//     // Create new chat
//     const { data: newChat, error: createError } = await supabaseClient
//       .from('chats')
//       .insert({
//         user_id: user.id,
//         recipient_id: recipient_id
//       })
//       .select('id')
//       .single()

//     if (createError) throw createError

//     return new Response(JSON.stringify({ chat_id: newChat.id }), {
//       headers: { 'Content-Type': 'application/json' },
//     })
//   } catch (error) {
//     return new Response(JSON.stringify({ error: error.message }), {
//       headers: { 'Content-Type': 'application/json' },
//       status: 500
//     })
//   }
// })

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

    // Get user and validate
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse query parameters
    const url = new URL(req.url)
    const currentPage = parseInt(url.searchParams.get('page') || '1')
    const perPage = parseInt(url.searchParams.get('per_page') || '20')
    const from = (currentPage - 1) * perPage
    const to = from + perPage - 1

    // Get total count of conversations
    const { count: total } = await supabaseClient
      .from('chats')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${user.id},recipient_id.eq.${user.id}`)

    // Get paginated conversations
    const { data, error } = await supabaseClient
      .from('chats')
      .select(`
        id,
        created_at,
        updated_at,
        recipient:recipient_id(id, first_name, profile_picture, user_type),
        user:user_id(id, first_name, profile_picture, user_type),
        last_message:messages(
          content,
          created_at,
          sender_id
        )(order=created_at.desc, limit=1),
        unread_count:messages(
          count
        )(filter=read.eq.false.and.not.sender_id.eq.${user.id})`)
      .or(`user_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    // Format conversations
    const conversations = data.map(chat => ({
      id: chat.id,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      otherUser: user.id === chat.user.id ? chat.recipient : chat.user,
      lastMessage: chat.last_message[0] || null,
      unreadCount: chat.unread_count[0]?.count || 0
    }))

    // Calculate pagination metadata
    const lastPage = Math.ceil((total || 0) / perPage)

    // Return paginated response
    return new Response(JSON.stringify({
      currentPage,
      data: conversations,
      from: from + 1,
      lastPage,
      perPage,
      to: Math.min(from + perPage, total || 0),
      total
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
