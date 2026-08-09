(() => {
  const fields = [
    'slug',
    'title',
    'excerpt',
    'category',
    'author',
    'cover_image',
    'reading_minutes',
    'published_at',
    'content',
    'sources'
  ].join(',');

  const normalizeArticles = (articles) => (Array.isArray(articles) ? articles : [])
    .filter((article) => article?.slug && article?.title)
    .map((article) => ({
      ...article,
      reading_minutes: Number(article.reading_minutes) || 1,
      content: Array.isArray(article.content) ? article.content : [],
      sources: Array.isArray(article.sources) ? article.sources : []
    }))
    .sort((first, second) => new Date(second.published_at) - new Date(first.published_at));

  const loadStaticArticles = async () => {
    const response = await fetch('./articles.json?v=20260809-1');
    if (!response.ok) throw new Error('Artikel sandaran tidak dapat dimuatkan.');
    return normalizeArticles(await response.json());
  };

  const loadSupabaseArticles = async () => {
    const config = globalThis.SEDEKAHQR_BLOG;
    if (!config?.supabaseUrl || !config?.publishableKey) throw new Error('Konfigurasi blog tidak lengkap.');

    const endpoint = new URL(`${config.supabaseUrl}/rest/v1/islamic_articles`);
    endpoint.searchParams.set('select', fields);
    endpoint.searchParams.set('is_published', 'eq.true');
    endpoint.searchParams.set('published_at', `lte.${new Date().toISOString()}`);
    endpoint.searchParams.set('order', 'published_at.desc');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(endpoint, {
        headers: { apikey: config.publishableKey },
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Supabase tidak dapat dimuatkan.');
      const articles = normalizeArticles(await response.json());
      if (!articles.length) throw new Error('Tiada artikel diterbitkan.');
      return articles;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  let articlePromise;
  const getArticles = () => {
    if (!articlePromise) {
      articlePromise = loadSupabaseArticles().catch(() => loadStaticArticles());
    }
    return articlePromise;
  };

  const formatDate = (value) => new Intl.DateTimeFormat('ms-MY', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));

  globalThis.SedekahQRBlogApi = {
    getArticles,
    formatDate
  };
})();
