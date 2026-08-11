(() => {
  const endpoint = 'https://wfujqvmqlwqmqmzdkepi.supabase.co/functions/v1/track-visit';
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

  const webVitals = { lcpMs: null, inpMs: null, clsMilli: 0, ttfbMs: null };

  const observeWebVitals = () => {
    const navigation = performance.getEntriesByType?.('navigation')[0];
    if (navigation) webVitals.ttfbMs = Math.round(navigation.responseStart - navigation.startTime);

    try {
      new PerformanceObserver((entries) => {
        entries.getEntries().forEach((entry) => {
          webVitals.lcpMs = Math.round(entry.startTime);
        });
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      new PerformanceObserver((entries) => {
        entries.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) webVitals.clsMilli += Math.round(entry.value * 1000);
        });
      }).observe({ type: 'layout-shift', buffered: true });

      new PerformanceObserver((entries) => {
        entries.getEntries().forEach((entry) => {
          webVitals.inpMs = Math.max(webVitals.inpMs || 0, Math.round(entry.duration));
        });
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    } catch {
      // Some browsers do not expose every Web Vitals observer.
    }
  };

  observeWebVitals();

  const waitForArticleTitle = async (path) => {
    if (!path.startsWith('/artikel/')) return;
    for (let attempt = 0; attempt < 32; attempt += 1) {
      if (document.querySelector('#article-title')?.textContent.trim()) return;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  };

  const send = async (payload) => {
    try {
      await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: getVisitorId(), ...payload })
      });
    } catch {
      // Analytics must never interrupt the public experience.
    }
  };

  globalThis.SEDEKAHQR_ANALYTICS = Object.freeze({
    trackQrEvent(eventType, item) {
      if (!['qr_view', 'qr_download'].includes(eventType) || !item?.name || !item?.state) return;
      void send({ eventType, itemName: item.name, itemState: item.state });
    }
  });

  const track = async () => {
    const path = getAnalyticsPath();
    if (!path) return;
    await waitForArticleTitle(path);
    const pageTitle = document.title.replace(/\s+-\s+SedekahQR Malaysia$/, '').trim() || 'SedekahQR Malaysia';
    await send({ path, pageTitle, referrer: document.referrer });

    const enteredAt = Date.now();
    let engagementSent = false;
    const trackEngagement = () => {
      if (engagementSent) return;
      engagementSent = true;
      const engagementSeconds = Math.min(14_400, Math.max(0, Math.round((Date.now() - enteredAt) / 1000)));
      void send({
        eventType: 'page_engagement',
        path,
        engagementSeconds,
        lcpMs: webVitals.lcpMs,
        inpMs: webVitals.inpMs,
        clsMilli: webVitals.clsMilli,
        ttfbMs: webVitals.ttfbMs
      });
    };
    window.addEventListener('pagehide', trackEngagement, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') trackEngagement();
    }, { once: true });
  };

  const schedule = () => window.setTimeout(track, 900);
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
})();
