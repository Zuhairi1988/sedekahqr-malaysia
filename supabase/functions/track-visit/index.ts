import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/http.ts';

type VisitPayload = {
  visitorId?: string;
  path?: string;
  pageTitle?: string;
  referrer?: string;
  eventType?: string;
  itemName?: string;
  itemState?: string;
  engagementSeconds?: number;
  lcpMs?: number | null;
  inpMs?: number | null;
  clsMilli?: number | null;
  ttfbMs?: number | null;
};

const visitorPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pathPattern = /^\/[a-z0-9/_-]*$/;
const botPattern = /bot|crawler|spider|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp/i;

const metricValue = (value: unknown, maximum: number) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= maximum ? numeric : null;
};

const hashVisitor = async (visitorId: string, pepper: string) => {
  const input = new TextEncoder().encode(`${visitorId}:${pepper}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

const classifyDevice = (userAgent: string) => {
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
};

const externalReferrerHost = (value: string, origin: string) => {
  if (!value) return null;
  try {
    const referrer = new URL(value);
    const requestOrigin = new URL(origin);
    if (!['http:', 'https:'].includes(referrer.protocol) || referrer.hostname === requestOrigin.hostname) return null;
    return referrer.hostname.toLowerCase().slice(0, 180);
  } catch {
    return null;
  }
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Kaedah tidak dibenarkan.' }, 405);
  if (!isAllowedOrigin(request)) return jsonResponse(request, { error: 'Asal permintaan tidak dibenarkan.' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 3000) {
    return jsonResponse(request, { error: 'Permintaan terlalu besar.' }, 413);
  }

  const userAgent = (request.headers.get('user-agent') || '').slice(0, 500);
  if (!userAgent || botPattern.test(userAgent)) return jsonResponse(request, { ok: true, skipped: true });

  let payload: VisitPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Data permintaan tidak sah.' }, 400);
  }

  const visitorId = String(payload.visitorId || '');
  if (!visitorPattern.test(visitorId)) {
    return jsonResponse(request, { error: 'Butiran lawatan tidak sah.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(request, { error: 'Konfigurasi server tidak lengkap.' }, 500);

  const visitorHash = await hashVisitor(visitorId, serviceRoleKey.slice(-32));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const duplicateThreshold = new Date(Date.now() - 30_000).toISOString();
  const eventType = String(payload.eventType || '');
  if (['qr_view', 'qr_download'].includes(eventType)) {
    const itemName = String(payload.itemName || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const itemState = String(payload.itemState || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!itemName || !itemState) return jsonResponse(request, { error: 'Butiran QR tidak sah.' }, 400);

    const { data: duplicate, error: duplicateError } = await supabase
      .from('site_qr_events')
      .select('id')
      .eq('visitor_hash', visitorHash)
      .eq('event_type', eventType)
      .eq('qr_name', itemName)
      .gte('occurred_at', duplicateThreshold)
      .limit(1)
      .maybeSingle();

    if (duplicateError) return jsonResponse(request, { error: 'Aktiviti QR tidak dapat disemak.' }, 500);
    if (duplicate) return jsonResponse(request, { ok: true, deduplicated: true });

    const { error } = await supabase.from('site_qr_events').insert({
      visitor_hash: visitorHash,
      event_type: eventType,
      qr_name: itemName,
      qr_state: itemState
    });
    if (error) return jsonResponse(request, { error: 'Aktiviti QR tidak dapat direkodkan.' }, 500);
    return jsonResponse(request, { ok: true }, 201);
  }

  const path = String(payload.path || '').toLowerCase().slice(0, 240);
  if (eventType === 'page_engagement') {
    const engagementSeconds = Number(payload.engagementSeconds);
    if (!pathPattern.test(path) || !Number.isInteger(engagementSeconds) || engagementSeconds < 0 || engagementSeconds > 14_400) {
      return jsonResponse(request, { error: 'Tempoh lawatan tidak sah.' }, 400);
    }

    const recentThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: recentView, error: recentViewError } = await supabase
      .from('site_page_views')
      .select('id, engagement_seconds')
      .eq('visitor_hash', visitorHash)
      .eq('path', path)
      .gte('viewed_at', recentThreshold)
      .order('viewed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentViewError) return jsonResponse(request, { error: 'Tempoh lawatan tidak dapat disemak.' }, 500);
    if (!recentView) return jsonResponse(request, { ok: true, skipped: true });

    const { error } = await supabase
      .from('site_page_views')
      .update({
        engagement_seconds: Math.max(Number(recentView.engagement_seconds) || 0, engagementSeconds),
        lcp_ms: metricValue(payload.lcpMs, 60_000),
        inp_ms: metricValue(payload.inpMs, 60_000),
        cls_milli: metricValue(payload.clsMilli, 10_000),
        ttfb_ms: metricValue(payload.ttfbMs, 60_000)
      })
      .eq('id', recentView.id);
    if (error) return jsonResponse(request, { error: 'Tempoh lawatan tidak dapat direkodkan.' }, 500);
    return jsonResponse(request, { ok: true });
  }

  const pageTitle = String(payload.pageTitle || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  if (!pathPattern.test(path) || !pageTitle) {
    return jsonResponse(request, { error: 'Butiran lawatan tidak sah.' }, 400);
  }

  const { data: duplicate, error: duplicateError } = await supabase
    .from('site_page_views')
    .select('id')
    .eq('visitor_hash', visitorHash)
    .eq('path', path)
    .gte('viewed_at', duplicateThreshold)
    .limit(1)
    .maybeSingle();

  if (duplicateError) return jsonResponse(request, { error: 'Lawatan tidak dapat disemak.' }, 500);
  if (duplicate) return jsonResponse(request, { ok: true, deduplicated: true });

  const origin = request.headers.get('origin') || '';
  const { error } = await supabase.from('site_page_views').insert({
    visitor_hash: visitorHash,
    path,
    page_title: pageTitle,
    referrer_host: externalReferrerHost(String(payload.referrer || ''), origin),
    device_type: classifyDevice(userAgent)
  });

  if (error) return jsonResponse(request, { error: 'Lawatan tidak dapat direkodkan.' }, 500);
  return jsonResponse(request, { ok: true }, 201);
});
