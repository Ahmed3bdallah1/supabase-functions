// import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// serve(async (req) => {
//   if (req.headers.get('upgrade') === 'websocket') {
//     const { socket, response } = upgradeWebSocket(req);
    
//     const supabaseClient = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_ANON_KEY') ?? '',
//       {
//         global: { headers: { Authorization: req.headers.get('Authorization')! } }
//       }
//     );

//     const { data: { user } } = await supabaseClient.auth.getUser();
//     if (!user) {
//       socket.close(1008, 'Unauthorized');
//       return response;
//     }

//     socket.onopen = () => {
//       console.log('Connection established for user:', user.id);
//       socket.send(JSON.stringify({
//         type: 'connection_established',
//         userId: user.id
//       }));
//     };

//     socket.onmessage = async (e) => {
//       try {
//         const message = JSON.parse(e.data);
        
//         if (message.type === 'get_history') {
//           await handleMessageHistory(supabaseClient, socket, user.id, message.chatId);
//           // Close connection after sending history
//           socket.close(1000, 'History sent');
//         } else {
//           socket.send(JSON.stringify({
//             type: 'error',
//             message: 'Only get_history messages are accepted'
//           }));
//         }
//       } catch (error) {
//         socket.send(JSON.stringify({
//           type: 'error',
//           message: 'Invalid message format'
//         }));
//       }
//     };

//     socket.onclose = () => console.log('Connection closed');
//     socket.onerror = (e) => console.error('WebSocket error:', e);

//     return response;
//   }

//   return new Response(
//     JSON.stringify({ error: 'WebSocket upgrade required' }),
//     { status: 426, headers: { 'Content-Type': 'application/json' } }
//   );
// });

// async function handleMessageHistory(
//   supabaseClient: any,
//   socket: WebSocket,
//   userId: string,
//   chatId: string
// ) {
//   try {
//     // 1. Verify chat access
//     const { data: chat, error: chatError } = await supabaseClient
//       .from('chats')
//       .select('id')
//       .eq('id', chatId)
//       .or(`user_id.eq.${userId},recipient_id.eq.${userId}`)
//       .single();

//     if (chatError || !chat) throw new Error('Chat not found or access denied');

//     // 2. Get message history
//     const { data: messages, error: messagesError } = await supabaseClient
//       .from('messages')
//       .select(`
//         id,
//         content,
//         created_at,
//         read,
//         sender:sender_id(id, first_name, profile_picture)
//       `)
//       .eq('chat_id', chatId)
//       .order('created_at', { ascending: false })
//       .limit(50);

//     if (messagesError) throw messagesError;

//     // 3. Send message history and close connection
//     socket.send(JSON.stringify({
//       type: 'message_history',
//       chatId,
//       messages: messages.reverse() // Oldest first
//     }));

//   } catch (error) {
//     socket.send(JSON.stringify({
//       type: 'error',
//       message: error.message
//     }));
//     socket.close(1008, error.message);
//   }
// }
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Important: Verify the connection is a WebSocket upgrade
  // if (req.headers.get('upgrade') !== 'websocket') {
  //   return new Response(
  //     JSON.stringify({ error: 'WebSocket upgrade required' }),
  //     { 
  //       status: 426,
  //       headers: {
  //         'Content-Type': 'application/json',
  //         'Upgrade': 'websocket' // Explicitly tell client to upgrade
  //       }
  //     }
  //   );
  // }

  // Proper WebSocket upgrade handling
  const { socket, response } = upgradeWebSocket(req);
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { 
          headers: { 
            Authorization: req.headers.get('Authorization')!,
            'Connection': 'Upgrade',
          'Upgrade': 'websocket',
          } 
        }
      }
    );

    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
      socket.close(1008, 'Unauthorized');
      return response;
    }

    socket.onopen = () => {
      console.log('WS Connected:', user.id);
      socket.send(JSON.stringify({
        type: 'connection_established', 
        userId: user.id
      }));
    };

    socket.onmessage = async (e) => {
      try {
        const message = JSON.parse(e.data);
        if (message.type === 'get_history') {
          await handleMessageHistory(supabaseClient, socket, user.id, message.chatId);
          socket.close(1000, 'History delivered');
        }
      } catch (err) {
        socket.close(1003, `Invalid message: ${err.message}`);
      }
    };

    socket.onerror = (e) => console.error('WS Error:', e);
    socket.onclose = () => console.log('WS Closed');

  } catch (err) {
    socket.close(1011, `Server error: ${err.message}`);
  }

  return response;
});

async function handleMessageHistory(
  supabaseClient: any,
  socket: WebSocket,
  userId: string,
  chatId: string
) {
  // Verify chat access
  const { data: chat, error: chatError } = await supabaseClient
    .from('chats')
    .select('id,user_id,recipient_id')
    .eq('id', chatId)
    .or(`user_id.eq.${userId},recipient_id.eq.${userId}`)
    .single();

  if (!chat) throw new Error('Chat access denied');

  // Get messages
  const { data: messages, error } = await supabaseClient
    .from('messages')
    .select(`
      id,content,created_at,read,
      sender:sender_id(id,first_name,profile_picture)
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  // Send response
  socket.send(JSON.stringify({
    type: 'message_history',
    chatId,
    participants: [chat.user_id, chat.recipient_id],
    messages: messages.reverse()
  }));
}