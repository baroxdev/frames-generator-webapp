// Supabase Edge Function: lets a signed-in campaign owner delete one of
// their campaign's submissions (ticket #7's private dashboard) — removes
// the DB row (and decrements campaigns.submission_count, via the
// delete_submission RPC) and the submission's R2 avatar object.
//
// Why an Edge Function rather than a plain client-side delete: R2 object
// deletion needs the same S3-compatible credentials as
// r2-presigned-upload/submission-presigned-upload, which must never reach
// the browser bundle. The DB delete is bundled in here too (rather than
// exposed as its own RLS DELETE policy) so the two steps happen in the
// right order — the DB row is the authoritative record, so it's deleted
// first; if the R2 delete that follows fails, the row is still gone (no
// broken image will ever show up in the list again) and the orphaned
// object is swept up later by the same R2 lifecycle rule that already
// cleans up abandoned submission uploads (see
// submission-presigned-upload's comment).
//
// Deploy: supabase functions deploy delete-submission
// Secrets (supabase secrets set) — same R2_* secrets as r2-presigned-upload
// / submission-presigned-upload:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
//   R2_PUBLIC_BASE_URL
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are provided
// automatically in the Edge Function runtime.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucketName = Deno.env.get('R2_BUCKET_NAME');
  const publicBaseUrl = Deno.env.get('R2_PUBLIC_BASE_URL');

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !serviceRoleKey ||
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !publicBaseUrl
  ) {
    console.error('delete-submission is missing required secrets; run `supabase secrets set` for R2_* and retry.');
    return jsonResponse({ error: 'Server misconfigured: missing required secrets' }, 500);
  }

  // Resolve the caller's user id from their own JWT — same pattern as
  // r2-presigned-upload — so one owner can never delete another owner's
  // submission just by guessing an id.
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: { submissionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const submissionId = body.submissionId;
  if (typeof submissionId !== 'string' || submissionId.length === 0) {
    return jsonResponse({ error: 'submissionId is required' }, 400);
  }

  // Service role from here on — bypasses RLS to look up the owning
  // campaign, but the ownership check right below (not RLS) is the actual
  // authorization boundary for this request.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: submission, error: lookupError } = await admin
    .from('submissions')
    .select('id, image_url, campaigns!inner(owner_id)')
    .eq('id', submissionId)
    .maybeSingle();

  const ownerId = (submission as { campaigns?: { owner_id?: string } } | null)?.campaigns?.owner_id;
  if (lookupError || !submission || ownerId !== user.id) {
    // A submission that doesn't exist and one that belongs to someone
    // else's campaign are deliberately indistinguishable here, same as
    // getCampaignBySlug.
    return jsonResponse({ error: 'Không tìm thấy thông điệp này.' }, 404);
  }

  const { data: deleted, error: deleteError } = await admin.rpc('delete_submission', {
    submission_id_input: submissionId,
  });
  if (deleteError || !deleted) {
    console.error('delete_submission RPC failed', deleteError);
    return jsonResponse({ error: 'Không thể xoá thông điệp. Vui lòng thử lại.' }, 500);
  }

  const imageUrl = (deleted as { image_url?: string }).image_url;
  if (imageUrl && imageUrl.startsWith(`${publicBaseUrl}/`)) {
    const objectKey = imageUrl.slice(publicBaseUrl.length + 1);
    const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;
    try {
      const deleteResponse = await r2.fetch(endpoint, { method: 'DELETE' });
      if (!deleteResponse.ok && deleteResponse.status !== 404) {
        console.error(`Failed to delete R2 object ${objectKey}: status ${deleteResponse.status}`);
      }
    } catch (error) {
      // Best-effort: the DB row (the authoritative record) is already
      // gone, so the submission is fully deleted from the app's point of
      // view either way — an orphaned object here just waits for the R2
      // lifecycle rule to sweep it up.
      console.error(`Failed to delete R2 object ${objectKey}`, error);
    }
  }

  return jsonResponse({ id: submissionId }, 200);
});
