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
type KeywordCandidate = { keyword: string; search_volume?: number | null; competition_index?: number | null };
const slugify = (value: string) => value.toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 110);

const fallbackKeyword = () => scheduledKeywords[Math.floor(Date.now() / 86_400_000) % scheduledKeywords.length];

async function findKeyword(login: string | undefined, password: string | undefined) {
  if (!login || !password) return { keyword: fallbackKeyword(), source: 'reviewed_fallback' };

  try {
    const basicAuth = btoa(`${login}:${password}`);
    // Search-volume is a stable fit for the curated Malay keyword pool. Keyword
    // suggestion requests can return oversized payloads and are unnecessary here.
    const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        location_name: 'Malaysia',
        language_name: 'Malay',
        keywords: scheduledKeywords,
      }]),
    });
    if (!response.ok) throw new Error(`DataForSEO HTTP ${response.status}`);
    const payload = await response.json();
    const candidates: KeywordCandidate[] = payload?.tasks?.[0]?.result || [];
    const shortlist = candidates.filter((item) => {
      const keyword = String(item?.keyword || '').trim();
      const words = keyword.split(/\s+/).filter(Boolean);
      const volume = Number(item?.search_volume || 0);
      const competition = Number(item?.competition_index ?? 100);
      return words.length >= 2 && words.length <= 10 && volume > 0 && competition <= 70;
    });
    if (!shortlist.length) throw new Error('No suitable keyword candidates.');
    shortlist.sort((a, b) => Number(b.search_volume || 0) - Number(a.search_volume || 0));
    // Rotate between the five strongest terms so repeated scheduled drafts vary.
    const candidate = shortlist[Math.floor(Date.now() / 86_400_000) % Math.min(shortlist.length, 5)];
    return {
      keyword: candidate.keyword.trim(),
      source: 'dataforseo',
      searchVolume: Number(candidate.search_volume || 0),
      competition: Number(candidate.competition_index ?? 0),
    };
  } catch (error) {
    console.error('DataForSEO keyword research failed.', error);
    return { keyword: fallbackKeyword(), source: 'reviewed_fallback' };
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const automationSecret = Deno.env.get('ARTICLE_AUTOMATION_SECRET');
  const authorization = request.headers.get('authorization') || '';
  if (!automationSecret || authorization !== `Bearer ${automationSecret}`) return json({ error: 'Unauthorized.' }, 401);

  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
  const dataForSeoLogin = Deno.env.get('DATAFORSEO_LOGIN');
  const dataForSeoPassword = Deno.env.get('DATAFORSEO_PASSWORD');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!deepseekKey || !supabaseUrl || !serviceRoleKey) return json({ error: 'Server configuration incomplete.' }, 500);

  const input = await request.json().catch(() => ({}));
  const requestedKeyword = String(input.keyword || '').trim().slice(0, 120);
  // Manual calls retain editorial control; scheduled runs use Malaysian keyword data when available.
  const keywordSelection = requestedKeyword ? { keyword: requestedKeyword, source: 'manual' } : await findKeyword(dataForSeoLogin, dataForSeoPassword);
  const keyword = keywordSelection.keyword;

  const prompt = `Create one Malay-language Islamic SEO article draft for the keyword: "${keyword}".
Return valid JSON only with title, excerpt, category, reading_minutes, content, sources.
Use 700-1000 original Malay words, clear H2 headings, practical advice, and a neutral educational tone.
content must be an array with at least 7 objects: {"type":"heading"|"paragraph"|"quote"|"list","text":"...","source":"..."?,"items":["..."]?}.
sources must contain at least one source object with label and url, and may use only Quran.com or Sunnah.com URLs. Never invent Quran verses, hadith grades, citations, or legal rulings. If a reliable source cannot be cited, omit the claim. This article will be published automatically and must not include financial, medical, or legal advice.`;

  const aiResponse = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'system', content: 'You are a careful Malay Islamic content drafting assistant. Output valid JSON only.' }, { role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 3000,
      thinking: { type: 'disabled' },
    }),
  });
  if (!aiResponse.ok) return json({ error: 'Draft generation failed.' }, 502);

  let draft: Record<string, unknown>;
  try { draft = JSON.parse((await aiResponse.json()).choices?.[0]?.message?.content || '{}'); }
  catch { return json({ error: 'Draft response was invalid.' }, 502); }

  const title = String(draft.title || '').trim().slice(0, 180);
  const excerpt = String(draft.excerpt || '').trim().slice(0, 360);
  const generatedCategory = String(draft.category || 'Akhlak').trim();
  const category = categories.has(generatedCategory) ? generatedCategory : ({
    Ibadah: 'Akhlak', Keimanan: 'Akhlak', Motivasi: 'Akhlak', Fiqh: 'Akhlak', Sejarah: 'Sirah',
  }[generatedCategory] || 'Akhlak');
  const content = Array.isArray(draft.content) ? draft.content : typeof draft.content === 'string'
    ? draft.content.split(/\n{2,}/).map((text) => ({ type: 'paragraph', text: text.trim() })).filter((block) => block.text)
    : [];
  const sources = Array.isArray(draft.sources) ? draft.sources.filter((source) => {
    try { return ['quran.com', 'sunnah.com'].includes(new URL(String(source?.url || '')).hostname); } catch { return false; }
  }) : [];
  if (title.length < 8 || excerpt.length < 30 || content.length < 7 || !sources.length) {
    return json({ error: 'Generated draft did not meet editorial checks.', checks: { titleLength: title.length, excerptLength: excerpt.length, contentBlocks: content.length, category } }, 422);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const baseSlug = slugify(title) || `artikel-${Date.now()}`;
  const slug = `${baseSlug.slice(0, 95)}-${Date.now().toString().slice(-6)}`;
  const coverImage = category === 'Sedekah' ? 'assets/banner-sedekah-komuniti.jpg' : category === 'Hadis' ? 'assets/banner-sedekah-subuh.jpg' : 'assets/blog-hero-quran.jpg';
  const { data, error } = await supabase.from('islamic_articles').insert({
    slug, title, excerpt, category, author: 'SedekahQR', cover_image: coverImage,
    reading_minutes: Math.min(10, Math.max(4, Number(draft.reading_minutes) || 5)), content, sources,
    is_published: true, published_at: new Date().toISOString(),
  }).select('id, slug, title').single();
  if (error) return json({ error: 'Draft could not be saved.' }, 500);
  return json({ ok: true, draft: data, keyword: keywordSelection }, 201);
});
