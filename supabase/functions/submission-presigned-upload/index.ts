// Supabase Edge Function: issues a short-lived, presigned PUT URL for a
// visitor to upload their final composited tribute image directly to
// Cloudflare R2. Never the visitor's raw avatar photo — that never leaves
// the browser; only the composited frame (background + avatar + text,
// produced by `frameCompositor.service.ts`) gets uploaded, and it's always a
// JPEG (`frameCompositor.service.ts`'s fixed compositor output format), so
// there's no client-supplied content-type to validate here at all.
//
// Unlike r2-presigned-upload (owner background uploads), the caller here is
// never signed in — a visitor submitting a tribute has no Supabase session —
// so this function is deliberately anonymous. It does not gate on Turnstile:
// minting a presigned URL / accepting one orphan upload is low-severity
// (storage cost only, no DB/business-logic impact), and a Turnstile token is
// single-use, so spending it here would leave none for the submit-tribute
// call that actually matters. The real gate — the 5,000-submission cap and
// the DB write — happens in submit-tribute, which verifies Turnstile and
// re-validates this upload's object actually exists before trusting it.
//
// Abuse mitigation for this endpoint specifically: a short presigned URL
// TTL and an R2 lifecycle rule (configured out-of-band via
// `wrangler r2 bucket lifecycle`) that deletes anything under
// `submissions/` older than a day with no matching submission row.
//
// Deploy: supabase functions deploy submission-presigned-upload
// Secrets (supabase secrets set) — same R2_* secrets as r2-presigned-upload:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
//   R2_PUBLIC_BASE_URL
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically in the
// Edge Function runtime. The service-role key (not the anon key) is used
// here specifically to check campaign status while bypassing RLS — an
// anonymous visitor has no row-level access of their own to check against.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const IMAGE_CONTENT_TYPE = 'image/jpeg';
const PRESIGNED_URL_TTL_SECONDS = 60 * 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucketName = Deno.env.get('R2_BUCKET_NAME');
  const publicBaseUrl = Deno.env.get('R2_PUBLIC_BASE_URL');

  if (!supabaseUrl || !serviceRoleKey || !accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicBaseUrl) {
    console.error(
      'submission-presigned-upload is missing required secrets; run `supabase secrets set` for R2_* and retry.',
    );
    return jsonResponse({ error: 'Server misconfigured: missing required secrets' }, 500);
  }

  let body: { campaignId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const campaignId = body.campaignId;
  if (typeof campaignId !== 'string' || !UUID_PATTERN.test(campaignId)) {
    return jsonResponse({ error: 'campaignId must be a valid UUID' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .maybeSingle();

  // A pending/rejected/suspended campaign and one that doesn't exist are
  // deliberately indistinguishable here, mirroring getCampaignBySlug's RLS
  // behavior — no reason to let this endpoint leak campaign existence.
  if (campaignError || !campaign || campaign.status !== 'approved') {
    return jsonResponse({ error: 'Chiến dịch không khả dụng.' }, 404);
  }

  const objectKey = `submissions/${campaignId}/${crypto.randomUUID()}.jpg`;

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
    headers: { 'Content-Type': IMAGE_CONTENT_TYPE },
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
