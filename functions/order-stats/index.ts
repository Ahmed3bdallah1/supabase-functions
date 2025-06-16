// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// serve(async (req) => {
//   try {
//     // Initialize Supabase client
//     const supabase = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_ANON_KEY') ?? '',
//       { 
//         global: { 
//           headers: { Authorization: req.headers.get('Authorization')! } 
//         } 
//       }
//     )

//     // 1. Verify the user is an admin
//     const { data: { user }, error: userError } = await supabase.auth.getUser()
    
//     if (userError || !user) {
//       return new Response(
//         JSON.stringify({ error: 'Unauthorized - Please log in' }),
//         { status: 401, headers: { 'Content-Type': 'application/json' } }
//       )
//     }

//     // Check user_type in the users table
//     const { data: userData, error: userDataError } = await supabase
//       .from('users')
//       .select('user_type')
//       .eq('id', user.id)
//       .single()


//     // if (userDataError || userData?.user_type !== 'Admin') {
//     //   return new Response(
//     //     JSON.stringify({ error: 'Forbidden - Admin access required' }),
//     //     { status: 403, headers: { 'Content-Type': 'application/json' } }
//     //   )
//     // }

//     // 2. Get query parameters for date range filtering
//     const url = new URL(req.url)
//     const startDate = url.searchParams.get('start_date')
//     const endDate = url.searchParams.get('end_date')

//     // Main stats query - using RPC for more reliable aggregation
//     const { data: statsData } = await supabase.rpc('get_order_stats', {
//       start_date: startDate,
//       end_date: endDate
//     })

//     // Status counts query
//     const { data: statusCounts } = await supabase.rpc('get_status_counts', {
//       start_date: startDate,
//       end_date: endDate
//     }).neq('status', null)

//     // Recent orders query
//     const { data: recentOrders } = await supabase
//       .from('orders')
//       .select('*')
//       .order('purchased_at', { ascending: false })
//       .limit(5)
//       .gte('purchased_at', startDate || '1900-01-01')
//       .lte('purchased_at', endDate || '3000-01-01')

//     // Unique customers count
//     const { count: uniqueCustomers } = await supabase
//       .from('orders')
//       .select('user_id', { count: 'exact', distinct: true })
//       .gte('purchased_at', startDate || '1900-01-01')
//       .lte('purchased_at', endDate || '3000-01-01')

//     // 4. Return the comprehensive response
//     return new Response(
//       JSON.stringify({
//         success: true,
//         stats: {
//           total_orders: statsData?.[0]?.total_orders || 0,
//           total_revenue: statsData?.[0]?.total_revenue || 0,
//           average_order_value: statsData?.[0]?.avg_order_value || 0,
//           unique_customers: uniqueCustomers || 0
//         },
//         status_counts: statusCounts || [],
//         recent_orders: recentOrders || []
//       }),
//       { headers: { 'Content-Type': 'application/json' } }
//     )

//   } catch (error) {
//     return new Response(
//       JSON.stringify({ 
//         error: 'Failed to fetch order stats',
//         details: error.message 
//       }),
//       { status: 500, headers: { 'Content-Type': 'application/json' } }
//     )
//   }
// })


import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // CORS headers configuration
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET'
  }

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    })
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { Authorization: req.headers.get('Authorization')! } 
        } 
      }
    )

    // 1. Verify the user is an admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Please log in' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      )
    }

    // Check user_type in the users table
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single()

    // if (userDataError || userData?.user_type !== 'Admin') {
    //   return new Response(
    //     JSON.stringify({ error: 'Forbidden - Admin access required' }),
    //     { 
    //       status: 403, 
    //       headers: { 
    //         'Content-Type': 'application/json',
    //         ...corsHeaders 
    //       } 
    //     }
    //   )
    // }

    // 2. Get query parameters for date range filtering
    const url = new URL(req.url)
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')

    // Main stats query - using RPC for more reliable aggregation
    const { data: statsData } = await supabase.rpc('get_order_stats', {
      start_date: startDate,
      end_date: endDate
    })

    // Status counts query
    const { data: statusCounts } = await supabase.rpc('get_status_counts', {
      start_date: startDate,
      end_date: endDate
    }).neq('status', null)

    // Recent orders query
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('*')
      .order('purchased_at', { ascending: false })
      .limit(5)
      .gte('purchased_at', startDate || '1900-01-01')
      .lte('purchased_at', endDate || '3000-01-01')

    // Unique customers count
    const { count: uniqueCustomers } = await supabase
      .from('orders')
      .select('user_id', { count: 'exact', distinct: true })
      .gte('purchased_at', startDate || '1900-01-01')
      .lte('purchased_at', endDate || '3000-01-01')

    // 4. Return the comprehensive response
    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_orders: statsData?.[0]?.total_orders || 0,
          total_revenue: statsData?.[0]?.total_revenue || 0,
          average_order_value: statsData?.[0]?.avg_order_value || 0,
          unique_customers: uniqueCustomers || 0
        },
        status_counts: statusCounts || [],
        recent_orders: recentOrders || []
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch order stats',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    )
  }
})
/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/order-stats' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
