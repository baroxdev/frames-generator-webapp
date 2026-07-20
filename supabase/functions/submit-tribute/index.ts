// Supabase Edge Function: verifies a visitor's Turnstile challenge, then
// atomically enforces the campaign's 5,000-submission cap and inserts the
// submission row (see `create_submission` in
// supabase/migrations/0003_submissions.sql).
//
// This is the one place in the whole flow that actually gates a DB write —
// submission-presigned-upload only mints a storage URL, unauthenticated and
// ungated. Everything privileged happens here: Turnstile verification (the
// secret key never leaves this server context), re-validating the uploaded
// image actually exists in R2 (a client could otherwise pass an arbitrary
// imageUrl — e.g. another campaign's asset — straight into the DB row), and
// the atomic cap-check-and-insert RPC.
//
// `imageUrl` is always the visitor's *final composited tribute frame*
// (background + avatar + text, produced client-side by
// frameCompositor.service.ts) — never their raw avatar photo, which is
// never uploaded anywhere.
//
// Deploy: supabase functions deploy submit-tribute
// Secrets (supabase secrets set):
//   TURNSTILE_SECRET_KEY       Cloudflare Turnstile secret key (matches
//                              VITE_TURNSTILE_SITE_KEY's widget)
//   TURNSTILE_ALLOWED_HOSTNAMES  Comma-separated hostnames siteverify's
//                              response.hostname must match (prevents a
//                              token solved on another site from being
//                              replayed here) — e.g. "localhost,your-app-domain.example"
//   TURNSTILE_BYPASS_ENABLED  Temporary escape hatch ("true" to enable) while
//                              the Turnstile UX is being reworked — matches
//                              VITE_TURNSTILE_BYPASS on the frontend. Skips
//                              the siteverify call entirely. Unset (or
//                              anything other than "true") once Turnstile is
//                              reinstated.
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
//   R2_PUBLIC_BASE_URL          Same R2 secrets as the other two upload
//                              functions, needed here to HEAD-verify the
//                              image object.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

// Mirrors src/schemas/submission.schema.ts — kept in sync by hand since the
// two run in different languages/runtimes (same pattern as
// campaign.schema.ts's SLUG_PATTERN comment).
const FULL_NAME_MIN = 2;
const FULL_NAME_MAX = 25;
const ROLE_MIN = 3;
const ROLE_MAX = 50;
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 400;

// Only ever a JPEG — the fixed output format of frameCompositor.service.ts
// (modern-screenshot's domToBlob with `type: 'image/jpeg'`), not something a
// client chooses.
const IMAGE_CONTENT_TYPE = 'image/jpeg';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const EXPECTED_TURNSTILE_ACTION = 'submit-tribute';
const CAMPAIGN_FULL_MESSAGE = 'campaign_full';

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

type SubmitTributeBody = {
  campaignId?: unknown;
  turnstileToken?: unknown;
  fullName?: unknown;
  role?: unknown;
  message?: unknown;
  imageUrl?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const turnstileSecretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
  const allowedHostnames = Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES');
  const turnstileBypassEnabled = Deno.env.get('TURNSTILE_BYPASS_ENABLED') === 'true';
  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  const bucketName = Deno.env.get('R2_BUCKET_NAME');
  const publicBaseUrl = Deno.env.get('R2_PUBLIC_BASE_URL');

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    (!turnstileBypassEnabled && (!turnstileSecretKey || !allowedHostnames)) ||
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !publicBaseUrl
  ) {
    console.error('submit-tribute is missing required secrets; run `supabase secrets set` and retry.');
    return jsonResponse({ error: 'Server misconfigured: missing required secrets' }, 500);
  }

  if (turnstileBypassEnabled) {
    console.warn('submit-tribute: TURNSTILE_BYPASS_ENABLED is set — skipping CAPTCHA verification.');
  }

  let body: SubmitTributeBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { campaignId, turnstileToken, fullName, role, message, imageUrl } = body;

  if (typeof campaignId !== 'string' || !new RegExp(`^${UUID_PATTERN}$`, 'i').test(campaignId)) {
    return jsonResponse({ error: 'campaignId must be a valid UUID' }, 400);
  }
  if (!turnstileBypassEnabled && !isNonEmptyString(turnstileToken)) {
    return jsonResponse({ error: 'Vui lòng xác thực CAPTCHA trước khi gửi.' }, 400);
  }
  if (!isNonEmptyString(fullName) || fullName.trim().length < FULL_NAME_MIN || fullName.trim().length > FULL_NAME_MAX) {
    return jsonResponse({ error: `Họ và tên phải từ ${FULL_NAME_MIN} đến ${FULL_NAME_MAX} ký tự.` }, 400);
  }
  if (!isNonEmptyString(role) || role.trim().length < ROLE_MIN || role.trim().length > ROLE_MAX) {
    return jsonResponse({ error: `Đơn vị phải từ ${ROLE_MIN} đến ${ROLE_MAX} ký tự.` }, 400);
  }
  if (!isNonEmptyString(message) || message.trim().length < MESSAGE_MIN || message.trim().length > MESSAGE_MAX) {
    return jsonResponse({ error: `Thông điệp phải từ ${MESSAGE_MIN} đến ${MESSAGE_MAX} ký tự.` }, 400);
  }
  if (!isNonEmptyString(imageUrl)) {
    return jsonResponse({ error: 'Thiếu ảnh.' }, 400);
  }

  // The uploaded object's key is entirely server-generated (see
  // submission-presigned-upload) — this must match exactly, so a client
  // can never point a submission at an unrelated object (another
  // campaign's asset, or something outside `submissions/` entirely).
  const imageUrlPattern = new RegExp(
    `^${publicBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/submissions/${campaignId}/${UUID_PATTERN}\\.jpg$`,
    'i',
  );
  if (!imageUrlPattern.test(imageUrl)) {
    return jsonResponse({ error: 'Ảnh không hợp lệ.' }, 400);
  }

  // Verify the Turnstile token server-side. Checking `hostname`/`action`
  // (not just `success`) closes the token-replay gap — without it, a token
  // solved on a different site (or for a different action on this one)
  // would still pass.
  if (!turnstileBypassEnabled) {
    const turnstileForm = new URLSearchParams();
    turnstileForm.set('secret', turnstileSecretKey!);
    turnstileForm.set('response', turnstileToken as string);
    const remoteIp = req.headers.get('cf-connecting-ip');
    if (remoteIp) turnstileForm.set('remoteip', remoteIp);

    let turnstileResult: { success?: boolean; hostname?: string; action?: string; 'error-codes'?: string[] };
    try {
      const turnstileResponse = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body: turnstileForm });
      turnstileResult = await turnstileResponse.json();
    } catch (error) {
      console.error('Turnstile siteverify request failed', error);
      return jsonResponse({ error: 'Không thể xác thực CAPTCHA. Vui lòng thử lại.' }, 502);
    }

    const allowedHostnameList = allowedHostnames!.split(',').map((hostname) => hostname.trim());
    if (
      !turnstileResult.success ||
      !turnstileResult.hostname ||
      !allowedHostnameList.includes(turnstileResult.hostname) ||
      turnstileResult.action !== EXPECTED_TURNSTILE_ACTION
    ) {
      // None of these fields are sensitive (no token, no PII) — logging them
      // is what actually makes a "CAPTCHA invalid" report debuggable instead
      // of a black box, since the client only ever sees the generic message.
      console.error('Turnstile verification rejected', {
        success: turnstileResult.success,
        hostname: turnstileResult.hostname,
        action: turnstileResult.action,
        errorCodes: turnstileResult['error-codes'],
        allowedHostnames: allowedHostnameList,
        expectedAction: EXPECTED_TURNSTILE_ACTION,
      });
      return jsonResponse({ error: 'Xác thực CAPTCHA không hợp lệ. Vui lòng thử lại.' }, 400);
    }
  }

  // Confirm the object this URL claims to point at actually exists, is one
  // of the allowed image types, and isn't oversized — the presign step
  // couldn't enforce a max size itself (SigV4 presigned PUT URLs don't
  // support S3 POST-policy content-length-range conditions), so this HEAD
  // check is where that enforcement actually happens.
  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const objectKey = imageUrl.slice(`${publicBaseUrl}/`.length);
  const headEndpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucketName}/${objectKey}`;
  let headResponse: Response;
  try {
    const signedHead = await r2.sign(headEndpoint, { method: 'HEAD' });
    headResponse = await fetch(signedHead);
  } catch (error) {
    console.error('R2 HEAD check failed', error);
    return jsonResponse({ error: 'Không thể xác minh ảnh. Vui lòng thử lại.' }, 502);
  }
  if (!headResponse.ok) {
    return jsonResponse({ error: 'Ảnh không tồn tại. Vui lòng thử gửi lại.' }, 400);
  }
  const uploadedContentType = headResponse.headers.get('content-type') ?? '';
  const uploadedContentLength = Number(headResponse.headers.get('content-length') ?? '0');
  if (uploadedContentType !== IMAGE_CONTENT_TYPE || uploadedContentLength > MAX_IMAGE_BYTES) {
    return jsonResponse({ error: 'Ảnh không hợp lệ.' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: submission, error: submissionError } = await supabase
    .rpc('create_submission', {
      campaign_id_input: campaignId,
      full_name_input: fullName.trim(),
      role_input: role.trim(),
      message_input: message.trim(),
      image_url_input: imageUrl,
    })
    .single();

  if (submissionError) {
    if (submissionError.message?.includes(CAMPAIGN_FULL_MESSAGE)) {
      return jsonResponse({ error: 'Chiến dịch đã đủ số lượng gửi. Vui lòng thử lại sau.', code: 'CAMPAIGN_FULL' }, 409);
    }
    console.error('create_submission RPC failed', submissionError);
    return jsonResponse({ error: 'Không thể gửi thông điệp. Vui lòng thử lại.' }, 500);
  }

  return jsonResponse({ id: submission.id }, 201);
});
