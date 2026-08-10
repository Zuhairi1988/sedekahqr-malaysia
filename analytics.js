(() => {
  const endpoint = 'https://cuzzbbenqeghmhvxqmtn.supabase.co/functions/v1/track-visit';
  const storageKey = 'sedekahqr-anonymous-visitor';
  const lifetime = 90 * 24 * 60 * 60 * 1000;

  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;

  const getVisitorId = () => {
    const now = Date.now();
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored?.id && stored.expiresAt > now) return stored.id;
      const id = crypto.randomUUID();
      localStorage.setItem(storageKey, JSON.stringify({ id, expiresAt: now + lifetime }));
      return id;
    } catch {
      return crypto.randomUUID();
    }
  };

  const getAnalyticsPath = () => {
    const pathname = location.pathname.replace(/^\/sedekahqr-malaysia(?=\/|$)/, '') || '/';
    if (/\/admin\.html$/.test(pathname)) return null;
    if (/\/blog\.html$/.test(pathname)) return '/blog';
    if (/\/article\.html$/.test(pathname)) {
      const slug = new URLSearchParams(location.search).get('slug') || 'tidak-diketahui';
      const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 160);
      return `/artikel/${safeSlug || 'tidak-diketahui'}`;
    }
    return '/';
  };

  const waitForArticleTitle = async (path) => {
    if (!path.startsWith('/artikel/')) return;
    for (let attempt = 0; attempt < 32; attempt += 1) {
      if (document.querySelector('#article-title')?.textContent.trim()) return;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  };

  const track = async () => {
    const path = getAnalyticsPath();
    if (!path) return;
    await waitForArticleTitle(path);
    const pageTitle = document.title.replace(/\s+-\s+SedekahQR Malaysia$/, '').trim() || 'SedekahQR Malaysia';
    try {
      await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: getVisitorId(),
          path,
          pageTitle,
          referrer: document.referrer
        })
      });
    } catch {
      // Analytics must never interrupt the public experience.
    }
  };

  const schedule = () => window.setTimeout(track, 900);
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
})();
