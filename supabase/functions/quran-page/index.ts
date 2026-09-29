// Serves one Madinah mushaf page (15-line KFGQPC layout) from the Quran Foundation Content API.
// The QF client secret stays here; the browser only receives glyph codes per line.
// QF terms allow caching QF Content for at most one week, so responses are cached for a day.

const allowedOrigins = new Set([
  'https://sedekahqr.com',
  'https://www.sedekahqr.com',
  'https://zuhairi1988.github.io',
  'http://127.0.0.1:8010',
  'http://localhost:8010',
]);

const corsHeaders = (request: Request) => {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://sedekahqr.com',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
};

const json = (request: Request, body: unknown, status = 200, cacheSeconds = 0) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders(request),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
  },
});

const tokenUrl = 'https://oauth2.quran.foundation/oauth2/token';
const apiBase = 'https://apis.quran.foundation/content/api/v4';
let cachedToken: { value: string; expiresAt: number } | null = null;

const getToken = async (clientId: string, clientSecret: string) => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=content',
  });
  if (!response.ok) throw new Error(`QF token HTTP ${response.status}`);
  const token = await response.json();
  cachedToken = { value: token.access_token, expiresAt: Date.now() + (Number(token.expires_in) || 3600) * 1000 };
  return cachedToken.value;
};

type Word = { code_v2?: string; line_number?: number };
type Verse = { verse_key: string; words?: Word[] };
type Line =
  | { n: number; t: 'w'; w: string[] }
  | { n: number; t: 'h'; s: number }
  | { n: number; t: 'b'; s: number }
  | { n: number; t: 'x' };

const hasSeparateBismillah = (surah: number) => surah !== 1 && surah !== 9;

// Lines without words hold a surah header and its bismillah. They sit just before the line
// where the surah's first ayah begins, or at the foot of the page before a surah that starts overleaf.
export const layoutPage = (page: number, verses: Verse[]) => {
  const lines = new Map<number, { words: string[]; firstKey: string }>();
  verses.forEach((verse) => (verse.words || []).forEach((word) => {
    const n = Number(word.line_number);
    if (!n || !word.code_v2) return;
    if (!lines.has(n)) lines.set(n, { words: [], firstKey: verse.verse_key });
    lines.get(n)!.words.push(word.code_v2);
  }));
  const surahs = [...new Set(verses.map((verse) => Number(verse.verse_key.split(':')[0])))];
  const numbers = [...lines.keys()].sort((a, b) => a - b);
  const result: Line[] = [];

  // Pages 1 and 2 use a short centred layout: header, (bismillah), then the text lines.
  if (page <= 2) {
    result.push({ n: 0, t: 'h', s: surahs[0] });
    if (hasSeparateBismillah(surahs[0])) result.push({ n: 0, t: 'b', s: surahs[0] });
    numbers.forEach((n) => result.push({ n, t: 'w', w: lines.get(n)!.words }));
    return { page, surahs, centered: true, lines: result };
  }

  const special = new Map<number, Line>();
  numbers.forEach((n) => {
    const [surah, ayah] = lines.get(n)!.firstKey.split(':').map(Number);
    if (ayah !== 1) return;
    const gap: number[] = [];
    for (let k = n - 1; k >= 1 && !lines.has(k); k -= 1) gap.unshift(k);
    const kinds: Array<'h' | 'b'> = hasSeparateBismillah(surah) ? ['h', 'b'] : ['h'];
    const used = gap.slice(-kinds.length);
    used.forEach((k, index) => special.set(k, { n: k, t: kinds[kinds.length - used.length + index], s: surah }));
  });
  const lastLine = numbers.at(-1) || 0;
  const nextSurah = (surahs.at(-1) || 0) + 1;
  for (let k = lastLine + 1; k <= 15 && nextSurah <= 114; k += 1) {
    const kind = k === lastLine + 1 ? 'h' : 'b';
    if (kind === 'b' && !hasSeparateBismillah(nextSurah)) break;
    special.set(k, { n: k, t: kind, s: nextSurah });
  }
  for (let n = 1; n <= 15; n += 1) {
    if (lines.has(n)) result.push({ n, t: 'w', w: lines.get(n)!.words });
    else result.push(special.get(n) || { n, t: 'x' });
  }
  return { page, surahs, centered: false, lines: result };
};

const pageCache = new Map<number, { body: unknown; expiresAt: number }>();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'GET') return json(request, { error: 'Kaedah tidak dibenarkan.' }, 405);
  const page = Number(new URL(request.url).searchParams.get('page'));
  if (!Number.isInteger(page) || page < 1 || page > 604) return json(request, { error: 'Halaman mesti antara 1 dan 604.' }, 400);

  const cached = pageCache.get(page);
  if (cached && cached.expiresAt > Date.now()) return json(request, cached.body, 200, 86400);

  const clientId = Deno.env.get('QF_CLIENT_ID');
  const clientSecret = Deno.env.get('QF_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json(request, { error: 'Konfigurasi server tidak lengkap.' }, 500);

  try {
    const token = await getToken(clientId, clientSecret);
    const response = await fetch(`${apiBase}/verses/by_page/${page}?words=true&word_fields=code_v2,line_number&per_page=50`, {
      headers: { 'x-auth-token': token, 'x-client-id': clientId },
    });
    if (!response.ok) throw new Error(`QF content HTTP ${response.status}`);
    const { verses } = await response.json();
    const body = layoutPage(page, verses || []);
    pageCache.set(page, { body, expiresAt: Date.now() + 86_400_000 });
    return json(request, body, 200, 86400);
  } catch (error) {
    console.error(error);
    return json(request, { error: 'Halaman mushaf tidak dapat dimuatkan.' }, 502);
  }
});
