// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// supabase/functions/upload-image/index.ts
// supabase/functions/upload-image/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Invalid content-type" }), { status: 400 })
    }

    const authHeader = req.headers.get("Authorization") || ""
    const jwt = authHeader.replace("Bearer ", "")
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing JWT token" }), { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return new Response(JSON.stringify({ error: "File is required" }), { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const fileName = `${Date.now()}-${file.name}`
    const bucketName = "users"

    const uploadResponse = await fetch(
      `https://opseomlsxapjjypnestj.supabase.co/storage/v1/object/${bucketName}/${fileName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": file.type,
          "Authorization": `Bearer ${jwt}`,
        },
        body: buffer,
      }
    )

    if (!uploadResponse.ok) {
      const err = await uploadResponse.text()
      return new Response(JSON.stringify({ error: "Upload failed", details: err }), { status: 500 })
    }

    const path = `https://opseomlsxapjjypnestj.supabase.co/storage/v1/object/${bucketName}/${fileName}`
    return new Response(JSON.stringify({ path }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: "Unexpected error", message: e.message }), {
      status: 500,
    })
  }
})



/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/upload-image' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
