// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// supabase/functions/send-push/index.ts
// import { initializeApp, cert } from 'firebase-admin/app';
// import { getMessaging } from 'firebase-admin/messaging';
// @ts-ignore - Deno workaround
// Use the Firebase REST API instead of Admin SDK to avoid Deno compatibility issues
// Firebase REST API implementation (no Admin SDK needed)
// Firebase Cloud Messaging Service for Supabase Edge Functions
// Enhanced with comprehensive error handling and logging

// ========================
// Firebase Notification Service
// ========================
// const sendPushNotification = async (
//   fcmToken: string,
//   title: string,
//   body: string,
//   image?: string,
//   data?: Record<string, string>
// ) => {
//   try {
//     console.log("Starting push notification for token:", fcmToken.slice(0, 6) + "...");

//     // 1. Load Firebase credentials
//     const serviceAccount = getFirebaseCreds();
//     console.log("Firebase project:", serviceAccount.project_id);

//     // 2. Get access token
//     const accessToken = await getFirebaseAccessToken(serviceAccount);
//     console.log("Successfully obtained Firebase access token");

//     // 3. Prepare message payload
//     const message = {
//       message: {
//         token: fcmToken,
//         notification: { title, body },
//         ...(image && { 
//           android: { notification: { image } },
//           apns: { 
//             payload: { 
//               aps: { 
//                 'mutable-content': 1,
//                 'alert': { title, body }
//               }
//             },
//             fcm_options: { image }
//           }
//         }),
//         data: data || {},
//       },
//     };
//     console.log("Notification payload:", JSON.stringify(message, null, 2));

//     // 4. Send to FCM
//     const fcmUrl = `https://fcm.googleapis.com/v1/projects/art-store-76678/messages:send`;
//     console.log("Sending to FCM endpoint:", fcmUrl);

//     const controller = new AbortController();
//     const timeout = setTimeout(() => controller.abort(), 10000);

//     const response = await fetch(fcmUrl, {
//       method: "POST",
//       signal: controller.signal,
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer ${accessToken}`,
//       },
//       body: JSON.stringify(message),
//     });
//     clearTimeout(timeout);

//     const responseText = await response.text();
//     console.log("FCM response status:", response.status, "body:", responseText);

//     if (!response.ok) {
//       throw new Error(`FCM API error ${response.status}: ${responseText}`);
//     }

//     return await response.json();
//   } catch (error) {
//     console.error("Push notification failed:", error);
//     throw error;
//   }
// };

// ========================
// Firebase Access Token Generator
// ========================
async function getFirebaseAccessToken(serviceAccount: any) {
  try {
    // 1. Prepare JWT
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    };

    // 2. NEW: Properly decode and format private key
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = serviceAccount.private_key
      .replace(/\\n/g, "\n")
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .trim();

    // Convert PEM to ArrayBuffer
    const binaryDer = atob(pemContents);
    const bytes = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      bytes[i] = binaryDer.charCodeAt(i);
    }

    // 3. Import key with correct parameters
    const key = await crypto.subtle.importKey(
      "pkcs8",
      bytes,
      { 
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );

    // 4. Sign JWT
    const unsignedJwt = `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}`;
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsignedJwt)
    );

    const signedJwt = `${unsignedJwt}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

    // 5. Get access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signedJwt
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return (await tokenResponse.json()).access_token;
  } catch (error) {
    console.error("Access token generation failed:", error);
    throw new Error("Failed to generate Firebase access token");
  }
}

// ========================
// Credential Management
// ========================
function getFirebaseCreds() {
  try {
    const env = Deno.env.get("FIREBASE_ACCOUNT_SECRETS");
    if (!env) {
      console.error("FIREBASE_ACCOUNT_SECRETS is not set");
      throw new Error("Firebase credentials not configured");
    }

    let creds;
    try {
      creds = JSON.parse("{\"type\": \"service_account\", \"project_id\": \"art-store-76678\", \"private_key_id\": \"fe02e003cf659d39db1021df46cca5c2f2568441\", \"private_key\": \"-----BEGIN PRIVATE KEY-----\\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC0i8ZhMthWH4KN\\n7tWsKQ+iZ6kJEOKCG1lHL3xDZihS0G1jr6LnU5xOWZCtphCcn/D2prfKgGuoSJXt\\nOm2VFAgn7A78VUV1XDUYG5qqPiMgOxup02/n7Mill+ZsBTlWWkfmnuo2FMLqK59O\\ncBj+hdgItcq5NhVG/IIQLNQryAKskSHuxFBd6o2tzh8cqfv3OmOriw0VRTuQ3EBK\\nsUla93/glCttzXbIFN1/5lN3rzDVoST7eQZSHfy2eS4IMqGeJBkEoBN9eU11klKQ\\nLDz17WxtqD5foVwrVN/d6/pcibRFc29CupuYx91mGGBGCK/K70lXJUii6giXemMV\\nnKTrrgIDAgMBAAECggEAKHua7NqAxbblCDxAbwz583l43o6Jq5DEUQDlxRsX+ZHA\\npXSRe3s09iCBH164JNZ8KmIxnddzzFUSQRIz1hSay5DTv2LDY1Bcm149LOUn7Scz\\nyb2ePwvJ5c+MnDYDqEgwDRce/ydimS1U2DqscA3E5hcVMLhexv8BjuzuWi7L4rN7\\nvJhXmMJKRiWmaR5MANRf8VVRaBYrFhnP1+FjV539AI8QpPptzgQBnCrDofVtr0pB\\nKkgqFavZbgTgIoZZy4cYz4o6kKdypqLrJwXDPMwR3Lc00ny+0KyFPVLJV1GjHsaW\\n9RODd7CGprBt2rJNrCq68rlrUHheiVs2lohT5C2ViQKBgQDg6Nj/JTz9gjM3fwz3\\nLN4y/DBgJTV437/zui9qOupCEzInZRGLUvyjifL8g10mvPXhUcXVq6haeV7dmCcx\\n6qGL3bTyA8nu3ShhNxkaQR8rUDRH+AlIxkJgeqjUVDtimVoTFUXhtBqjE7Lxtx7E\\n4mXt9YrHNtpSmgeiybhhLB0PNwKBgQDNgPqgfBTVaSeIrQS9ls4b/nmwcyBXmdaH\\nhargYSFi+AujsiIvJbGJahbP5SDd0T6RQ3xgpcx1LFI3FVNckz+UXt+qfiCMOB5f\\n5uZTEwepgTiikDE3sVFRoDM7UaX0tQqBM+kxWEOvpddEltHwpifrfxLC5EnYI8dQ\\nKaBQ1wqRlQKBgAk4osT7Qt/l+bGZzO9JcKbIfjdC70lQay9T/+OsHLSu0syYsTp0\\nIZWW71Z5EFWpQ6+ESccz7YggF8qgFWNPimYQpf2SODJJ8QDjYG0aJGwDMtGMktzf\\n/BK2lLt35KNrRC0qHx5c4waypRCSAHn0ClfSTGlUj2j5lbyP5rZdN6fLAoGAPyft\\nXlbj3DZl5PYvZ8ip7SaG5XhsLx/jM2EcA7s2FIFgql07bjvqVO3atueW8zS0QtZ3\\nqggqTrRhS/Zs2R2Tw5hoqq/6dr1kcFq43D0T9L721db0mUYQVMKkHA3ar9rXsJ9w\\ngi67FockIjsrqAaYbCJwdJ7OJvPP9E3mrBF6eQUCgYAK3SPP42Dm2b/dCDUeKwTq\\nmnqwtoB846aUgs2HkdJmD+QGsv7q5ufaGNlX3gnVq2LYK4ctnO6t/g6pV3OsBXVV\\n7BiK6tiOB9TanqkF/EkUb8gq/4de7ms5PJSHuYChVMv0eQigqSCVCNeihiwX/28I\\nssqVvgUJCyw9ixBsXfVsYQ==\\n-----END PRIVATE KEY-----\\n\", \"client_email\": \"firebase-adminsdk-fbsvc@art-store-76678.iam.gserviceaccount.com\", \"client_id\": \"110224151525586685104\", \"auth_uri\": \"https://accounts.google.com/o/oauth2/auth\", \"token_uri\": \"https://oauth2.googleapis.com/token\", \"auth_provider_x509_cert_url\": \"https://www.googleapis.com/oauth2/v1/certs\", \"client_x509_cert_url\": \"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40art-store-76678.iam.gserviceaccount.com\", \"universe_domain\": \"googleapis.com\"}");
    } catch (e) {
      console.error("Failed to parse FIREBASE_ACCOUNT_SECRETS:", e);
      throw new Error("Invalid Firebase credentials format");
    }

    // Verify all required fields exist
    const requiredFields = [
      'type',
      'project_id',
      'private_key_id',
      'private_key',
      'client_email',
      'client_id',
      'auth_uri',
      'token_uri',
      'auth_provider_x509_cert_url',
      'client_x509_cert_url'
    ];

    const missingFields = requiredFields.filter(field => !creds[field]);
    if (missingFields.length > 0) {
      console.error("Missing fields in service account:", missingFields);
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Verify private key format
    if (!creds.private_key.includes('BEGIN PRIVATE KEY')) {
      console.error("Invalid private key format");
      throw new Error("Private key format is invalid");
    }

    return creds;
  } catch (error) {
    console.error("Credential loading failed:", error);
    throw new Error("Invalid Firebase credentials configuration");
  }
}

// Updated sendPushNotification function (must be completely independent)
const sendPushNotification = async (
  fcmToken: string,
  title: string,
  body: string,
  image?: string,
  data?: Record<string, string>
) => {
  try {
    console.log("Starting push notification for token:", fcmToken.slice(0, 6) + "...");

    // 1. Load Firebase credentials
    const serviceAccount = getFirebaseCreds();
    console.log("Firebase project:", serviceAccount.project_id);

    // 2. Get access token
    const accessToken = await getFirebaseAccessToken(serviceAccount);
    console.log("Successfully obtained Firebase access token");

    // 3. Prepare message payload
    const message = {
      message: {
        token: fcmToken,
        notification: { title, body },
        ...(image && { 
          android: { notification: { image } },
          apns: { 
            payload: { 
              aps: { 
                'mutable-content': 1,
                'alert': { title, body }
              }
            },
            fcm_options: { image }
          }
        }),
        data: data || {},
      },
    };

    // 4. Send to FCM
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
    const response = await fetch(fcmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000)
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`FCM API error ${response.status}: ${responseText}`);
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error("Push notification failed:", error);
    throw error;
  }
};

// Main handler function
Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] New request received`);

  // 1. Read body ONCE and store it
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch (e) {
    console.error(`[${requestId}] Failed to read body:`, e);
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Parse the stored body text
  let input;
  try {
    input = JSON.parse(bodyText);
    console.log(`[${requestId}] Parsed input:`, {
      user_id: input.user_id,
      title: input.title?.slice(0, 20),
      description: input.description?.slice(0, 20)
    });
  } catch (e) {
    console.error(`[${requestId}] JSON parse error:`, e);
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Validate required fields
  if (!input.user_id || !input.title || !input.description) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. Get FCM token
  let fcmToken;
  try {
    const tokenRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/fcm_tokens?user_id=eq.${input.user_id}`,
      {
        headers: {
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        }
      }
    );
    
    const tokens = await tokenRes.json();
    fcmToken = tokens?.[0]?.token;
    
    if (!fcmToken) {
      throw new Error("No token found");
    }
  } catch (e) {
    console.error(`[${requestId}] Token fetch failed:`, e);
    return new Response(
      JSON.stringify({ error: "Failed to get FCM token" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // 5. Send notification
  try {
    console.log(`[${requestId}] Sending to token: ${fcmToken.slice(0, 6)}...`);
    const result = await sendPushNotification(
      fcmToken,
      input.title,
      input.description,
      input.image,
      { 
        id: crypto.randomUUID(),
        description: input.description,
        title: input.title,
        user_id: input.user_id,
        read: "false",
        // Optional fields
        ...(input.order_id && { order_id: input.order_id }),
        ...(input.product_id && { product_id: input.product_id }),
        ...(input.seller_id && { seller_id: input.seller_id }),
        ...(input.image && { logo: input.image }),
      }
    );

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(`[${requestId}] Notification failed:`, e);
    return new Response(
      JSON.stringify({ 
        error: "Notification failed",
        message: e.message 
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
});

// ========================
// Main Function Handler
// ========================
// Main function handler with proper body handling
// Deno.serve(async (req) => {
//   const requestId = crypto.randomUUID();
//   console.log(`[${requestId}] New request: ${req.method} ${req.url}`);

//   // Clone the request to preserve the body
//   const reqClone = req.clone();
//   let input;

//   try {
//     // 1. Parse input ONCE from the cloned request
//     try {
//       input = await reqClone.json();
//       console.log(`[${requestId}] Parsed input:`, JSON.stringify(input, null, 2));
//     } catch (e) {
//       console.error(`[${requestId}] JSON parse error:`, e);
//       return new Response(
//         JSON.stringify({ 
//           error: "Invalid JSON",
//           message: "Request body must be valid JSON"
//         }),
//         { status: 400, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     // 2. Validate required fields
//     const requiredFields = ['user_id', 'title', 'description'];
//     const missingFields = requiredFields.filter(field => !input[field]);
    
//     if (missingFields.length > 0) {
//       console.error(`[${requestId}] Missing fields:`, missingFields);
//       return new Response(
//         JSON.stringify({ 
//           error: "Missing required fields",
//           missing: missingFields
//         }),
//         { status: 400, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     // 3. Get FCM token
//     let fcmToken;
//     try {
//       const supabaseUrl = Deno.env.get("SUPABASE_URL");
//       const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
//       const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

//       const tokenRes = await fetch(
//         `${supabaseUrl}/rest/v1/fcm_tokens?user_id=eq.${input.user_id}&select=token`,
//         {
//           headers: {
//             apikey: supabaseKey,
//             Authorization: `Bearer ${serviceRoleKey}`,
//           },
//           signal: AbortSignal.timeout(5000)
//         }
//       );

//       if (!tokenRes.ok) {
//         throw new Error(`Supabase API error: ${tokenRes.status}`);
//       }

//       const [tokenData] = await tokenRes.json();
//       fcmToken = tokenData?.token;

//       if (!fcmToken) {
//         throw new Error("No FCM token found for user");
//       }
//     } catch (error) {
//       console.error(`[${requestId}] Token fetch error:`, error);
//       return new Response(
//         JSON.stringify({ 
//           error: "Token retrieval failed",
//           message: error.message
//         }),
//         { status: 404, headers: { "Content-Type": "application/json" } }
//       );
//     }

//     // 4. Send notification
//     try {
//     console.log(`[${requestId}] Sending to token: ${fcmToken.slice(0, 6)}...`);
    
//     // Modified sendPushNotification to take explicit parameters
//     const result = await sendPushNotification(
//       fcmToken,
//       input.title,
//       input.description,
//       input.image,
//       { user_id: input.user_id }
//     );

//     return new Response(
//       JSON.stringify({ success: true, result }),
//       { headers: { "Content-Type": "application/json" } }
//     );
//   } catch (e) {
//     console.error(`[${requestId}] Notification failed:`, e);
//     return new Response(
//       JSON.stringify({ 
//         error: "Notification failed",
//         message: e.message 
//       }),
//       { status: 502, headers: { "Content-Type": "application/json" } }
//     );
//   }
//   } catch (error) {
//     console.error(`[${requestId}] Unhandled error:`, error);
//     return new Response(
//       JSON.stringify({ 
//         error: "Internal server error",
//         message: "An unexpected error occurred"
//       }),
//       { status: 500, headers: { "Content-Type": "application/json" } }
//     );
//   }
// });




/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-push' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
