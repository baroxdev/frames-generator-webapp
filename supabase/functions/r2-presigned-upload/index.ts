// Supabase Edge Function: issues a short-lived, presigned PUT URL for
// uploading a campaign background image directly to Cloudflare R2.
//
// Why a function at all, instead of uploading straight from the browser: R2
// is authenticated with an access key/secret pair (S3-compatible API) that
// must never reach the client bundle. This function holds those credentials
// as Supabase secrets, signs a presigned URL scoped to one object key, and
// hands only that URL back — the actual PUT still happens directly from the
// browser to R2 (not proxied through this function), so upload bandwidth
// doesn't pass through Supabase.
//
// Deploy: supabase functions deploy r2-presigned-upload
// Secrets (supabase secrets set):
//   R2_ACCOUNT_ID        Cloudflare account ID
//   R2_ACCESS_KEY_ID      R2 API token access key ID
//   R2_SECRET_ACCESS_KEY  R2 API token secret access key
//   R2_BUCKET_NAME        Bucket that holds campaign background images
//   R2_PUBLIC_BASE_URL    Public base URL for the bucket (custom domain or
//                         the bucket's r2.dev URL), no trailing slash
//
// SUPABASE_URL / SUPABASE_ANON_KEY are provided automatically in the Edge
// Function runtime and don't need to be set manually.
//
// The presigned PUT still has to land as a direct browser -> R2 request, so
// the *bucket itself* also needs a CORS policy allowing your app's origin —
// this function's own CORS headers only cover the call to this function,
// not the follow-up PUT to r2.cloudflarestorage.com. Configure it once via:
//   npx wrangler r2 bucket cors put <bucket-name> --rules '[{
//     "AllowedOrigins": ["https://your-app-domain.example", "http://localhost:5173"],
//     "AllowedMethods": ["PUT"],
//     "AllowedHeaders": ["content-type"]
//   }]'
// (or the same policy via the Cloudflare dashboard: R2 > bucket > Settings > CORS Policy).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PRESIGNED_URL_TTL_SECONDS = 60 * 5;

// The browser client (client.functions.invoke) sends Authorization and
// Content-Type headers, which makes this a CORS-preflighted request — the
// browser sends an OPTIONS request first and refuses to even attempt the
// POST if that preflight doesn't come back with these headers. Every
// response (including error responses) needs them too, or the browser
// discards the response before application code ever sees it.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucketName = Deno.env.get('R2_BUCKET_NAME');
  const publicBaseUrl = Deno.env.get('R2_PUBLIC_BASE_URL');

  if (!supabaseUrl || !supabaseAnonKey || !accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
    // A misconfigured secret would otherwise surface as an unhandled
    // exception with no CORS headers, which the browser reports as an
    // opaque "Failed to fetch" — this makes the actual cause visible in
    // `supabase functions logs r2-presigned-upload` and the response body.
    console.error('r2-presigned-upload is missing required secrets; run `supabase secrets set` for R2_* and retry.');
    return jsonResponse({ error: 'Server misconfigured: missing required secrets' }, 500);
  }

  // Resolve the caller's user id from their own JWT rather than trusting a
  // client-supplied owner id, so one owner can never write into another
  // owner's object prefix.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: { contentType?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const contentType = body.contentType;
  if (typeof contentType !== 'string' || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    return jsonResponse({ error: 'contentType must be one of image/jpeg, image/png, image/webp' }, 400);
  }

  const objectKey = `campaign-backgrounds/${user.id}/${crypto.randomUUID()}.${extensionFor(contentType)}`;

  const r2 = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  });

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;
  const url = new URL(endpoint);
  url.searchParams.set('X-Amz-Expires', String(PRESIGNED_URL_TTL_SECONDS));

  const signedRequest = await r2.sign(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    aws: { signQuery: true },
  });

  return jsonResponse(
    {
      uploadUrl: signedRequest.url,
      publicUrl: `${publicBaseUrl}/${objectKey}`,
    },
    200,
  );
});
