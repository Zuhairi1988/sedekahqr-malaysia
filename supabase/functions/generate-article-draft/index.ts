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
const articleCoverBucket = 'article-covers';
type KeywordCandidate = { keyword: string; search_volume?: number | null; competition_index?: number | null };
const slugify = (value: string) => value.toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 110);

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (character) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
}[character] || character));

const hashValue = (value: string) => [...value].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0) >>> 0;

const createArticleCoverSvg = (title: string, category: string, slug: string) => {
  const hash = hashValue(slug);
  const palettes = [
    ['#0c513e', '#187453', '#d6a933'], ['#123d5e', '#1d6a83', '#e3b250'],
    ['#5b3548', '#9a5968', '#d7b161'], ['#254d43', '#4c806a', '#d9c27a'],
    ['#443763', '#75649a', '#d7b35d'], ['#5b4526', '#9a7650', '#d9bc72'],
  ][hash % 6];
  const titleLines = title.match(/.{1,28}(?:\s|$)/g)?.slice(0, 3).map((line) => line.trim()) || [title];
  const titleMarkup = titleLines.map((line, index) => `<text x="108" y="${510 + index * 72}" fill="#ffffff" font-family="Arial, sans-serif" font-size="54" font-weight="700">${escapeXml(line)}</text>`).join('');
  const stars = Array.from({ length: 14 }, (_, index) => {
    const x = 80 + ((hash >> (index % 16)) % 1320);
    const y = 70 + ((hash >> ((index + 7) % 16)) % 320);
    return `<circle cx="${x}" cy="${y}" r="${2 + (index % 3)}" fill="#fff" opacity="0.55"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024" role="img" aria-label="${escapeXml(title)}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palettes[0]}"/><stop offset="1" stop-color="${palettes[1]}"/></linearGradient></defs><rect width="1536" height="1024" fill="url(#g)"/><circle cx="1230" cy="228" r="132" fill="none" stroke="#fff" stroke-width="26" opacity="0.92"/><circle cx="1280" cy="190" r="132" fill="url(#g)"/><path d="M0 900 Q260 700 520 900 T1040 900 T1536 860 V1024 H0Z" fill="#071f19" opacity="0.28"/>${stars}<text x="108" y="130" fill="${palettes[2]}" font-family="Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="4">SEDEKAHQR · ${escapeXml(category.toUpperCase())}</text><path d="M108 195 H310" stroke="${palettes[2]}" stroke-width="8"/>${titleMarkup}<text x="108" y="870" fill="#fff" font-family="Arial, sans-serif" font-size="30" opacity="0.82">Bacaan dan renungan Islam</text></svg>`;
};

async function createUniqueArticleCover(supabase: any, title: string, category: string, slug: string) {
  const { data: buckets, error: bucketListError } = await supabase.storage.listBuckets();
  if (bucketListError) throw bucketListError;
  if (!buckets?.some((bucket: { id: string }) => bucket.id === articleCoverBucket)) {
    const { error: bucketError } = await supabase.storage.createBucket(articleCoverBucket, {
      public: true,
      allowedMimeTypes: ['image/svg+xml'],
      fileSizeLimit: '1MB',
    });
    if (bucketError) throw bucketError;
  }
  const path = `${slug}.svg`;
  const svg = createArticleCoverSvg(title, category, slug);
  const { error: uploadError } = await supabase.storage.from(articleCoverBucket).upload(
    path,
    new Blob([svg], { type: 'image/svg+xml' }),
    { contentType: 'image/svg+xml', cacheControl: '31536000', upsert: false },
  );
  if (uploadError) throw uploadError;
  return supabase.storage.from(articleCoverBucket).getPublicUrl(path).data.publicUrl;
}

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

  const qualityResponse = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'system', content: 'You are a strict Malay Islamic content quality reviewer. Return valid JSON only.' }, { role: 'user', content: `Review this article before publication. Reject it if it is generic, repetitive, contains unsupported religious claims, uses sources that do not support its claims, lacks practical value, or needs qualified human review for a legal/fatwa issue. Return {"approved":boolean,"score":number,"reason":"..."}. Require score 85 or higher.\n\n${JSON.stringify({ title, excerpt, category, content, sources })}` }],
      response_format: { type: 'json_object' }, max_tokens: 350, thinking: { type: 'disabled' },
    }),
  });
  if (!qualityResponse.ok) return json({ error: 'Article quality review failed.' }, 502);
  let quality: { approved?: boolean; score?: number; reason?: string } = {};
  try { quality = JSON.parse((await qualityResponse.json()).choices?.[0]?.message?.content || '{}'); }
  catch { return json({ error: 'Article quality review was invalid.' }, 502); }
  if (!quality.approved || Number(quality.score || 0) < 85) {
    return json({ error: 'Article did not pass publication quality checks.', quality }, 422);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const baseSlug = slugify(title) || `artikel-${Date.now()}`;
  const slug = `${baseSlug.slice(0, 95)}-${Date.now().toString().slice(-6)}`;
  let coverImage: string;
  try { coverImage = await createUniqueArticleCover(supabase, title, category, slug); }
  catch (error) {
    console.error('Unique article cover generation failed.', error);
    return json({ error: 'Article cover generation failed.' }, 502);
  }
  const { data, error } = await supabase.from('islamic_articles').insert({
    slug, title, excerpt, category, author: 'SedekahQR', cover_image: coverImage,
    reading_minutes: Math.min(10, Math.max(4, Number(draft.reading_minutes) || 5)), content, sources,
    is_published: true, published_at: new Date().toISOString(),
  }).select('id, slug, title').single();
  if (error) return json({ error: 'Draft could not be saved.' }, 500);
  return json({ ok: true, draft: data, keyword: keywordSelection }, 201);
});
