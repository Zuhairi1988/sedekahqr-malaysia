import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/http.ts';

type PushPayload = {
  action?: 'subscribe' | 'unsubscribe';
  zone?: string;
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
};

const allowedPushHost = (hostname: string) => hostname === 'fcm.googleapis.com'
  || hostname === 'updates.push.services.mozilla.com'
  || hostname === 'web.push.apple.com'
  || hostname.endsWith('.notify.windows.com');

const hashEndpoint = async (endpoint: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse(request, { error: 'Kaedah tidak dibenarkan.' }, 405);
  if (!isAllowedOrigin(request)) return jsonResponse(request, { error: 'Asal permintaan tidak dibenarkan.' }, 403);
  if (Number(request.headers.get('content-length') || 0) > 12000) {
    return jsonResponse(request, { error: 'Permintaan terlalu besar.' }, 413);
  }

  let payload: PushPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Data permintaan tidak sah.' }, 400);
  }

  const action = payload.action;
  const zone = String(payload.zone || '');
  const endpoint = String(payload.subscription?.endpoint || '');
  const p256dh = String(payload.subscription?.keys?.p256dh || '');
  const auth = String(payload.subscription?.keys?.auth || '');

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return jsonResponse(request, { error: 'Langganan peranti tidak sah.' }, 400);
  }

  if (endpointUrl.protocol !== 'https:' || !allowedPushHost(endpointUrl.hostname)) {
    return jsonResponse(request, { error: 'Perkhidmatan push tidak disokong.' }, 400);
  }
  if (!['subscribe', 'unsubscribe'].includes(action || '')) {
    return jsonResponse(request, { error: 'Tindakan tidak sah.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(request, { error: 'Konfigurasi server tidak lengkap.' }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const subscriptionId = await hashEndpoint(endpoint);

  if (action === 'unsubscribe') {
    const { error } = await supabase.from('push_subscriptions').delete().eq('subscription_id', subscriptionId);
    if (error) return jsonResponse(request, { error: 'Peringatan tidak dapat dimatikan.' }, 500);
    return jsonResponse(request, { ok: true });
  }

  if (!/^[A-Z]{3}[0-9]{2}$/.test(zone) || p256dh.length < 40 || auth.length < 12) {
    return jsonResponse(request, { error: 'Zon atau kunci peranti tidak sah.' }, 400);
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    subscription_id: subscriptionId,
    endpoint,
    p256dh,
    auth,
    zone,
    user_agent: (request.headers.get('user-agent') || '').slice(0, 255),
    enabled: true
  }, { onConflict: 'subscription_id' });

  if (error) return jsonResponse(request, { error: 'Peringatan tidak dapat disimpan.' }, 500);
  return jsonResponse(request, { ok: true });
});
