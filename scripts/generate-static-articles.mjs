import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteOrigin = 'https://sedekahqr.com';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const headingId = (text, index) => {
  const value = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return value || `bahagian-${index + 1}`;
};

const absoluteAssetUrl = (value) => {
  if (/^https?:\/\//i.test(String(value || ''))) return String(value);
  return new URL(String(value || '').replace(/^\/+/, ''), `${siteOrigin}/`).href;
};

const readPublicConfig = async () => {
  const source = await readFile(path.join(root, 'blog-config.js'), 'utf8');
  const url = process.env.SUPABASE_URL || source.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || source.match(/publishableKey:\s*'([^']+)'/)?.[1];
  if (!url || !key) throw new Error('Supabase public configuration is missing.');
  return { url, key };
};

const fetchPublishedArticles = async () => {
  const { url, key } = await readPublicConfig();
  const endpoint = new URL('/rest/v1/islamic_articles', url);
  endpoint.searchParams.set('select', 'slug,title,excerpt,category,author,cover_image,reading_minutes,content,sources,published_at,updated_at,is_published');
  endpoint.searchParams.set('is_published', 'eq.true');
  endpoint.searchParams.set('order', 'published_at.desc');
  const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}: ${await response.text()}`);
  const articles = await response.json();
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error('Supabase returned no published articles; existing static pages were left unchanged.');
  }
  return articles;
};

const renderBlock = (block, index) => {
  const type = String(block?.type || 'paragraph');
  if (type === 'heading') return `<h2 id="${headingId(block.text, index)}">${escapeHtml(block.text)}</h2>`;
  if (type === 'quote') {
    const citation = block.source ? `<cite>${escapeHtml(block.source)}</cite>` : '';
    return `<blockquote><p>${escapeHtml(block.text)}</p>${citation}</blockquote>`;
  }
  if (type === 'list') {
    const items = Array.isArray(block.items) ? block.items : [];
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }
  return `<p>${escapeHtml(block?.text)}</p>`;
};

const renderArticle = (article) => {
  const canonical = `${siteOrigin}/artikel/${encodeURIComponent(article.slug)}/`;
  const cover = absoluteAssetUrl(article.cover_image);
  const content = Array.isArray(article.content) ? article.content : [];
  const headings = content
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block?.type === 'heading');
  const body = content.map(renderBlock).join('\n');
  const toc = headings.map(({ block, index }) => `<li><a href="#${headingId(block.text, index)}">${escapeHtml(block.text)}</a></li>`).join('');
  const sources = (Array.isArray(article.sources) ? article.sources : [])
    .map((source) => `<li><a href="${escapeHtml(source?.url)}" rel="noopener noreferrer">${escapeHtml(source?.label || source?.url)}</a></li>`)
    .join('');
  const published = new Date(article.published_at);
  const modified = new Date(article.updated_at || article.published_at);
  const schema = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article', headline: article.title,
    description: article.excerpt, image: [cover], datePublished: published.toISOString(),
    dateModified: modified.toISOString(), inLanguage: 'ms-MY', articleSection: article.category,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    author: { '@type': 'Organization', name: article.author || 'Editorial SedekahQR' },
    publisher: { '@type': 'Organization', name: 'SedekahQR', logo: { '@type': 'ImageObject', url: `${siteOrigin}/assets/sedekahqr-icon-512.png` } },
  }).replaceAll('<', '\\u003c');

  return `<!DOCTYPE html>
<html lang="ms"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(article.title)} - SedekahQR</title><meta name="description" content="${escapeHtml(article.excerpt)}">
<link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
<meta property="og:type" content="article"><meta property="og:site_name" content="SedekahQR"><meta property="og:title" content="${escapeHtml(article.title)} - SedekahQR"><meta property="og:description" content="${escapeHtml(article.excerpt)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${cover}"><meta name="twitter:card" content="summary_large_image">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-7WNM31R53T"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-7WNM31R53T');</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3569037848347426" crossorigin="anonymous"></script><script type="application/ld+json">${schema}</script>
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/blog.css"></head>
<body class="directory-body blog-body"><header class="directory-header"><div class="directory-container header-inner"><a class="directory-brand" href="/" aria-label="SedekahQR"><span class="brand-mark"><img src="/assets/sedekahqr-logo.svg" alt=""></span><span class="brand-wordmark"><strong><span>Sedekah</span><b>QR</b></strong></span></a><nav class="directory-nav" aria-label="Navigasi utama"><a href="/">Homepage</a><a href="/blog.html">Artikel</a><a href="/quran.html">Al-Quran</a></nav></div></header>
<main><article class="article-page"><header class="article-header"><div class="article-reading-column"><nav class="article-breadcrumb" aria-label="Jejak halaman"><a href="/blog.html">Artikel</a><span>/</span><span>${escapeHtml(article.category)}</span></nav><h1>${escapeHtml(article.title)}</h1><p class="article-excerpt">${escapeHtml(article.excerpt)}</p><div class="article-meta"><span>${escapeHtml(article.author || 'Editorial SedekahQR')}</span><time datetime="${published.toISOString()}">${published.toLocaleDateString('ms-MY', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'long', day: 'numeric' })}</time><span>${Number(article.reading_minutes) || 5} minit bacaan</span></div></div></header>
<figure class="article-cover-wrap"><img src="${cover}" alt="Imej muka hadapan untuk ${escapeHtml(article.title)}" width="1536" height="1024"></figure><div class="article-reading-column"><nav class="article-toc" aria-label="Kandungan artikel"><p class="blog-eyebrow">DALAM ARTIKEL INI</p><h2>Panduan ringkas</h2><ol>${toc}</ol></nav><div class="article-content">${body}</div><aside class="article-sources"><p class="blog-eyebrow">SEMAK RUJUKAN</p><h2>Sumber utama</h2><ul>${sources}</ul><p>Artikel ini ialah bahan pendidikan umum dan bukan fatwa atau nasihat hukum khusus.</p></aside></div></article></main>
<footer class="directory-footer"><div class="directory-container"><div class="footer-bottom"><p>&copy; 2026 SedekahQR.</p><p><a href="/about.html">Tentang SedekahQR</a> &middot; <a href="/contact.html">Hubungi</a> &middot; <a href="/privacy.html">Notis Privasi</a> &middot; <a href="/editorial.html">Dasar Editorial</a></p></div></div></footer></body></html>\n`;
};

const updateSitemap = async (articles) => {
  const sitemapPath = path.join(root, 'sitemap.xml');
  const current = await readFile(sitemapPath, 'utf8');
  const staticEntries = [...current.matchAll(/\s*<url>.*?<\/url>/gs)]
    .map(([entry]) => entry.trim())
    .filter((entry) => !entry.includes('/artikel/') && !entry.includes('/article.html?slug='));
  const articleEntries = articles.map((article) => {
    const modified = String(article.updated_at || article.published_at).slice(0, 10);
    return `<url><loc>${siteOrigin}/artikel/${escapeHtml(article.slug)}/</loc><lastmod>${modified}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${[...staticEntries, ...articleEntries].join('\n  ')}\n</urlset>\n`;
  await writeFile(sitemapPath, xml, 'utf8');
};

const articles = await fetchPublishedArticles();
const manifestPath = path.join(root, 'scripts', 'generated-article-slugs.json');
let previousSlugs = [];
try { previousSlugs = JSON.parse(await readFile(manifestPath, 'utf8')); } catch {}
const publishedSlugs = new Set(articles.map((article) => String(article.slug)));
for (const slug of previousSlugs) {
  if (publishedSlugs.has(slug)) continue;
  const articleRoot = path.resolve(root, 'artikel');
  const staleDirectory = path.resolve(articleRoot, slug);
  if (!staleDirectory.startsWith(`${articleRoot}${path.sep}`)) throw new Error(`Unsafe article path: ${slug}`);
  await rm(staleDirectory, { recursive: true, force: true });
}
for (const article of articles) {
  const directory = path.join(root, 'artikel', article.slug);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), renderArticle(article), 'utf8');
}
await updateSitemap(articles);
await writeFile(manifestPath, `${JSON.stringify([...publishedSlugs].sort(), null, 2)}\n`, 'utf8');
console.log(`Generated ${articles.length} static article pages and updated sitemap.xml.`);
