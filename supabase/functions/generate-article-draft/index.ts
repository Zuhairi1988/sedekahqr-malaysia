import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const categories = new Set(['Al-Quran', 'Hadis', 'Doa', 'Sirah', 'Akhlak', 'Sedekah']);
const keywordDiscoverySeeds = [
  'sedekah', 'infak', 'doa harian', 'doa selepas solat', 'solat sunat',
  'wuduk', 'al quran', 'tafsir al quran', 'hadis nabi', 'sirah nabi',
  'akhlak islam', 'adab islam', 'puasa sunat', 'zikir harian', 'selawat',
  'doa ibu bapa', 'amalan islam', 'doa rezeki',
];
const articleCoverBucket = 'article-covers';
type KeywordCandidate = {
  keyword: string;
  search_volume?: number | null;
  competition_index?: number | null;
  competition?: string | null;
};
type KeywordSelection = {
  keyword: string;
  source: 'dataforseo' | 'manual';
  searchVolume?: number | null;
  competition?: number | null;
  researchedAt?: string | null;
};
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

const recordAutomationCost = async (supabase: any, event: Record<string, unknown>) => {
  const { error } = await supabase.from('automation_cost_events').insert(event);
  if (error) console.error('Automation cost recording failed.', error);
};

const deepSeekCost = (usage: Record<string, unknown> | undefined) => {
  const now = new Date();
  const hour = now.getUTCHours();
  const weekday = now.getUTCDay();
  const peak = weekday >= 1 && weekday <= 5 && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10));
  const cacheHit = Number(usage?.prompt_cache_hit_tokens || 0);
  const cacheMiss = Number(usage?.prompt_cache_miss_tokens ?? usage?.prompt_tokens ?? 0);
  const output = Number(usage?.completion_tokens || 0);
  const multiplier = peak ? 2 : 1;
  return (
    (cacheHit * 0.007 + cacheMiss * 0.22 + output * 0.66) * multiplier
  ) / 1_000_000;
};

const normalizedKeyword = (value: string) => value.toLowerCase().trim().replace(/\s+/g, ' ');
const isSuitableKeyword = (value: string) => {
  const words = value.split(/\s+/).filter(Boolean);
  const excluded = /\b(?:pinjaman|pelaburan|forex|crypto|judi|ubat|rawatan|penyakit|hukum|fatwa|cerai|kahwin|seks)\b/i;
  return words.length >= 2 && words.length <= 8 && !excluded.test(value);
};

async function findKeyword(
  supabase: any,
  login: string | undefined,
  password: string | undefined,
  retryAttempt = 1,
): Promise<KeywordSelection> {
  if (!login || !password) throw new Error('DataForSEO credentials are not configured.');

  const basicAuth = btoa(login + ':' + password);
  const response = await fetch('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + basicAuth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      location_name: 'Malaysia',
      language_name: 'Malay',
      keywords: keywordDiscoverySeeds,
      sort_by: 'search_volume',
      include_adult_keywords: false,
      tag: 'sedekahqr-article-research',
    }]),
  });
  if (!response.ok) throw new Error('DataForSEO HTTP ' + response.status);

  const payload = await response.json();
  const task = payload?.tasks?.[0];
  await recordAutomationCost(supabase, {
    provider: 'dataforseo',
    event_type: 'keyword_research',
    cost_usd: Math.max(0, Number(task?.cost ?? payload?.cost ?? 0)),
    metadata: { task_id: task?.id || null, status_code: task?.status_code || null }
  });
  if (Number(task?.status_code) !== 20000 || !Array.isArray(task?.result)) {
    throw new Error(task?.status_message || 'DataForSEO did not return keyword suggestions.');
  }

  const { data: publishedKeywords, error: keywordHistoryError } = await supabase
    .from('islamic_articles')
    .select('seo_keyword')
    .not('seo_keyword', 'is', null)
    .limit(500);
  if (keywordHistoryError) throw keywordHistoryError;
  const usedKeywords = new Set((publishedKeywords || [])
    .map((article: { seo_keyword?: string | null }) => normalizedKeyword(String(article.seo_keyword || '')))
    .filter(Boolean));

  const shortlist = (task.result as KeywordCandidate[])
    .map((item) => ({
      keyword: String(item?.keyword || '').trim(),
      searchVolume: Number(item?.search_volume || 0),
      competition: Number.isFinite(Number(item?.competition_index))
        ? Number(item?.competition_index) : null,
    }))
    .filter((item) => item.searchVolume >= 50
      && isSuitableKeyword(item.keyword)
      && !usedKeywords.has(normalizedKeyword(item.keyword))
      && (item.competition === null || item.competition <= 70))
    .sort((first, second) => second.searchVolume - first.searchVolume
      || (first.competition ?? 70) - (second.competition ?? 70));

  if (!shortlist.length) throw new Error('No unused Malaysian keyword with sufficient search volume was found.');

  // Rotate within the strongest ten candidates to avoid repeatedly targeting one keyword.
  const selectionWindow = shortlist.slice(0, Math.min(10, shortlist.length));
  const selected = selectionWindow[(Math.floor(Date.now() / 86_400_000) + retryAttempt - 1) % selectionWindow.length];
  return {
    keyword: selected.keyword,
    source: 'dataforseo',
    searchVolume: selected.searchVolume,
    competition: selected.competition,
    researchedAt: new Date().toISOString(),
  };
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const input = await request.json().catch(() => ({}));
  const retryAttempt = Math.min(2, Math.max(1, Number(input.retryAttempt) || 1));
  const retryOrReject = async (error: string, details: Record<string, unknown>) => {
    if (retryAttempt < 2) {
      const retryResponse = await fetch(`${supabaseUrl}/functions/v1/generate-article-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${automationSecret}` },
        body: JSON.stringify({ retryAttempt: retryAttempt + 1 }),
      });
      return new Response(await retryResponse.text(), {
        status: retryResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return json({ error, details, attempts: retryAttempt }, 422);
  };
  const requestedKeyword = String(input.keyword || '').trim().slice(0, 120);
  let keywordSelection: KeywordSelection;
  try {
    // Scheduled articles use live Malaysian Google Ads keyword ideas, not a fixed keyword list.
    keywordSelection = requestedKeyword
      ? { keyword: requestedKeyword, source: 'manual', researchedAt: new Date().toISOString() }
      : await findKeyword(supabase, dataForSeoLogin, dataForSeoPassword, retryAttempt);
  } catch (error) {
    console.error('DataForSEO keyword discovery failed.', error);
    return json({
      error: 'Keyword research unavailable. No article was published.',
      details: error instanceof Error ? error.message : 'Unknown keyword research error.',
    }, 503);
  }
  const keyword = keywordSelection.keyword;
  if (input.researchOnly === true) return json({ ok: true, keyword: keywordSelection });

  const prompt = `Create one Malay-language Islamic SEO article draft for the keyword: "${keyword}".
Return valid JSON only with title, excerpt, category, reading_minutes, content, sources.
Use 850-1100 original Malay words, clear H2 headings, and a neutral educational tone. Include at least three specific, realistic everyday Malaysian scenarios, include one short section headed "Salah Faham" that corrects a common misunderstanding, and give a practical checklist or steps readers can apply. Write in clear standard Bahasa Melayu using accurate, familiar Malaysian usage. Check spelling, grammar, and word choice carefully. Avoid Indonesian vocabulary, awkward literal translations, unexplained Arabic terms, and jargon; when an Islamic term is necessary, explain it briefly in plain language. Avoid generic motivational filler and repeated advice. Do not make specific reward, merit, or time-based religious claims unless they are directly and accurately supported by the cited source; choose a safer educational angle when a source does not support the proposed keyword.
content must be an array with at least 7 objects: {"type":"heading"|"paragraph"|"quote"|"list","text":"...","source":"..."?,"items":["..."]?}.
sources must contain at least one source object with label and url, and may use only Quran.com or Sunnah.com URLs. Never invent Quran verses, hadith grades, citations, or legal rulings. If a reliable source cannot be cited, omit the claim. This article may be published automatically only after it passes all editorial checks. It must not include financial, medical, or legal advice.`;

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

  const aiPayload = await aiResponse.json();
  await recordAutomationCost(supabase, {
    provider: 'deepseek',
    event_type: 'article_draft',
    cost_usd: deepSeekCost(aiPayload?.usage),
    input_tokens: Number(aiPayload?.usage?.prompt_tokens || 0),
    output_tokens: Number(aiPayload?.usage?.completion_tokens || 0),
    metadata: { model: aiPayload?.model || 'deepseek-v4-flash' }
  });
  let draft: Record<string, unknown>;
  try { draft = JSON.parse(aiPayload?.choices?.[0]?.message?.content || '{}'); }
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
    return retryOrReject('Generated draft did not meet editorial checks.', { titleLength: title.length, excerptLength: excerpt.length, contentBlocks: content.length, category });
  }

  const qualityResponse = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'system', content: 'You are a strict Malay Islamic content quality reviewer. Return valid JSON only.' }, { role: 'user', content: `Review this article before publication. Reject it if it is generic, repetitive, contains unsupported religious claims, uses sources that do not support its claims, lacks practical value, needs qualified human review for a legal/fatwa issue, or has incorrect/non-standard Bahasa Melayu spelling, grammar, confusing vocabulary, Indonesian wording, awkward translations, or unnecessary jargon. Require clear, natural Malaysian Malay that a general reader can understand. Return {"approved":boolean,"score":number,"reason":"..."}. Approve only when the score is 80 or higher; sources and safety requirements are non-negotiable.\n\n${JSON.stringify({ title, excerpt, category, content, sources })}` }],
      response_format: { type: 'json_object' }, max_tokens: 350, thinking: { type: 'disabled' },
    }),
  });
  if (!qualityResponse.ok) return json({ error: 'Article quality review failed.' }, 502);
  const qualityPayload = await qualityResponse.json();
  await recordAutomationCost(supabase, {
    provider: 'deepseek',
    event_type: 'quality_review',
    cost_usd: deepSeekCost(qualityPayload?.usage),
    input_tokens: Number(qualityPayload?.usage?.prompt_tokens || 0),
    output_tokens: Number(qualityPayload?.usage?.completion_tokens || 0),
    metadata: { model: qualityPayload?.model || 'deepseek-v4-flash' }
  });
  let quality: { approved?: boolean; score?: number; reason?: string } = {};
  try { quality = JSON.parse(qualityPayload?.choices?.[0]?.message?.content || '{}'); }
  catch { return json({ error: 'Article quality review was invalid.' }, 502); }
  if (!quality.approved || Number(quality.score || 0) < 80) {
    return retryOrReject('Article did not pass publication quality checks.', { quality });
  }


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
    seo_keyword: keyword,
    seo_keyword_source: keywordSelection.source,
    seo_search_volume: keywordSelection.searchVolume ?? null,
    seo_competition_index: keywordSelection.competition ?? null,
    seo_keyword_researched_at: keywordSelection.researchedAt ?? new Date().toISOString(),
    is_published: true, published_at: new Date().toISOString(),
  }).select('id, slug, title').single();
  if (error) return json({ error: 'Draft could not be saved.' }, 500);
  return json({ ok: true, draft: data, keyword: keywordSelection }, 201);
});
