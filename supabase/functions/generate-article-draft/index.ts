import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const categories = new Set(['Al-Quran', 'Hadis', 'Doa', 'Sirah', 'Akhlak', 'Sedekah']);
const scheduledKeywords = [
  'kelebihan sedekah subuh',
  'doa selepas solat fardu',
  'cara solat taubat',
  'amalan selepas solat subuh',
  'doa untuk ibu bapa',
  'adab bersedekah dalam islam',
  'cara menjaga lisan menurut islam',
  'amalan kecil yang konsisten dalam islam',
];
const slugify = (value: string) => value.toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 110);

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const automationSecret = Deno.env.get('ARTICLE_AUTOMATION_SECRET');
  const authorization = request.headers.get('authorization') || '';
  if (!automationSecret || authorization !== `Bearer ${automationSecret}`) return json({ error: 'Unauthorized.' }, 401);

  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!deepseekKey || !supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration incomplete.' }, 500);

  const input = await request.json().catch(() => ({}));
  const requestedKeyword = String(input.keyword || '').trim().slice(0, 120);
  // Scheduled requests rotate a reviewed keyword list; manual calls can still supply a specific keyword.
  const keyword = requestedKeyword || scheduledKeywords[Math.floor(Date.now() / 604_800_000) % scheduledKeywords.length];

  const prompt = `Create one Malay-language Islamic SEO article draft for the keyword: "${keyword}".
Return valid JSON only with title, excerpt, category, reading_minutes, content, sources.
Use 700-1000 original Malay words, clear H2 headings, practical advice, and a neutral educational tone.
content must be an array of objects: {"type":"heading"|"paragraph"|"quote"|"list","text":"...","source":"..."?,"items":["..."]?}.
sources must use only Quran.com or Sunnah.com URLs. Never invent Quran verses, hadith grades, citations, or legal rulings. If a reliable source cannot be cited, omit the claim. This is a DRAFT for human editorial review and must not include financial, medical, or legal advice.`;

  const aiResponse = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-v4-pro',
      messages: [{ role: 'system', content: 'You are a careful Malay Islamic content drafting assistant. Output valid JSON only.' }, { role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 5000,
      thinking: { type: 'disabled' },
    }),
  });
  if (!aiResponse.ok) return json({ error: 'Draft generation failed.' }, 502);

  let draft: Record<string, unknown>;
  try { draft = JSON.parse((await aiResponse.json()).choices?.[0]?.message?.content || '{}'); }
  catch { return json({ error: 'Draft response was invalid.' }, 502); }

  const title = String(draft.title || '').trim().slice(0, 180);
  const excerpt = String(draft.excerpt || '').trim().slice(0, 360);
  const category = String(draft.category || 'Akhlak');
  const content = Array.isArray(draft.content) ? draft.content : [];
  const sources = Array.isArray(draft.sources) ? draft.sources.filter((source) => {
    try { return ['quran.com', 'sunnah.com'].includes(new URL(String(source?.url || '')).hostname); } catch { return false; }
  }) : [];
  if (title.length < 8 || excerpt.length < 30 || content.length < 5 || !categories.has(category)) return json({ error: 'Generated draft did not meet editorial checks.' }, 422);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const baseSlug = slugify(title) || `artikel-${Date.now()}`;
  const slug = `${baseSlug.slice(0, 95)}-${Date.now().toString().slice(-6)}`;
  const coverImage = category === 'Sedekah' ? 'assets/banner-sedekah-komuniti.jpg' : category === 'Hadis' ? 'assets/banner-sedekah-subuh.jpg' : 'assets/blog-hero-quran.jpg';
  const { data, error } = await supabase.from('islamic_articles').insert({
    slug, title, excerpt, category, author: 'Draf AI SedekahQR', cover_image: coverImage,
    reading_minutes: Math.min(10, Math.max(4, Number(draft.reading_minutes) || 5)), content, sources,
    is_published: false, published_at: null,
  }).select('id, slug, title').single();
  if (error) return json({ error: 'Draft could not be saved.' }, 500);
  return json({ ok: true, draft: data }, 201);
});
