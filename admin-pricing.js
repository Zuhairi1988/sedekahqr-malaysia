(() => {
  const config = globalThis.SEDEKAHQR_BLOG;
  const sessionKey = 'sedekahqr-admin-session';
  const accessView = document.querySelector('#pricing-access-view');
  const adminView = document.querySelector('#pricing-admin-view');
  const adminEmail = document.querySelector('#pricing-admin-email');
  const logoutButton = document.querySelector('#pricing-logout');
  const plansView = document.querySelector('#pricing-plans');
  const reviewView = document.querySelector('#pricing-review');
  const disclaimerView = document.querySelector('#pricing-disclaimer');

  const readSession = () => {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || 'null');
    } catch {
      return null;
    }
  };

  const authRequest = (path, body, accessToken) => fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const refreshSession = async (session) => {
    if (!session?.refresh_token) return null;
    const response = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    if (!response.ok) return null;
    const refreshed = await response.json();
    refreshed.expires_at = Number(refreshed.expires_at)
      || Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600);
    localStorage.setItem(sessionKey, JSON.stringify(refreshed));
    return refreshed;
  };

  const verifyAdmin = async (session) => {
    const response = await fetch(
      `${config.supabaseUrl}/rest/v1/app_admins?select=user_id,email&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
      {
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );
    if (!response.ok) return false;
    const records = await response.json();
    return records.length > 0;
  };

  const loadPricing = async (session) => {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/admin_pricing_preview?select=payload&id=eq.1&limit=1`, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${session.access_token}`
      }
    });
    if (!response.ok) throw new Error('Pratonton pricing tidak dapat dimuatkan.');
    const records = await response.json();
    if (!records[0]?.payload) throw new Error('Data pratonton pricing belum tersedia.');
    return records[0].payload;
  };

  const appendTextElement = (parent, tag, text, className = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  };

  const renderPricing = (pricing) => {
    plansView.replaceChildren();
    (pricing.plans || []).forEach((plan) => {
      const article = document.createElement('article');
      article.className = `pricing-plan${plan.featured ? ' is-featured' : ''}`;
      if (plan.featured) appendTextElement(article, 'span', pricing.recommended_label, 'pricing-recommended');

      const heading = document.createElement('div');
      heading.className = 'pricing-plan-heading';
      appendTextElement(heading, 'p', plan.category);
      appendTextElement(heading, 'h2', plan.name);
      const price = document.createElement('div');
      price.className = 'pricing-price';
      appendTextElement(price, 'strong', plan.price);
      appendTextElement(price, 'span', plan.period);
      heading.append(price);
      if (plan.annual) appendTextElement(heading, 'small', plan.annual);
      article.append(heading);

      const features = document.createElement('ul');
      (plan.features || []).forEach((feature) => appendTextElement(features, 'li', feature));
      article.append(features);
      appendTextElement(article, 'p', plan.note, 'pricing-plan-note');
      plansView.append(article);
    });

    reviewView.replaceChildren();
    const reviewCopy = document.createElement('div');
    appendTextElement(reviewCopy, 'p', pricing.review.kicker, 'admin-kicker');
    const reviewTitle = appendTextElement(reviewCopy, 'h2', pricing.review.title);
    reviewTitle.id = 'pricing-review-title';
    appendTextElement(reviewCopy, 'p', pricing.review.description);
    reviewView.append(reviewCopy);

    const metrics = document.createElement('div');
    metrics.className = 'pricing-metrics';
    (pricing.review.metrics || []).forEach((metric) => {
      const item = document.createElement('div');
      appendTextElement(item, 'strong', metric.value);
      appendTextElement(item, 'span', metric.label);
      metrics.append(item);
    });
    reviewView.append(metrics);
    reviewView.hidden = false;

    disclaimerView.replaceChildren();
    appendTextElement(disclaimerView, 'strong', `${pricing.disclaimer_label}: `);
    disclaimerView.append(document.createTextNode(pricing.disclaimer));
    disclaimerView.hidden = false;
  };

  const denyAccess = () => {
    localStorage.removeItem(sessionKey);
    window.location.replace('admin.html');
  };

  const initialize = async () => {
    if (!config?.supabaseUrl || !config?.publishableKey) return denyAccess();
    let session = readSession();
    if (!session?.user?.id) return denyAccess();

    if (Number(session.expires_at) <= Math.floor(Date.now() / 1000) + 60) {
      session = await refreshSession(session);
      if (!session) return denyAccess();
    }

    try {
      if (!await verifyAdmin(session)) return denyAccess();
      const pricing = await loadPricing(session);
      renderPricing(pricing);
      adminEmail.textContent = session.user.email || 'Admin';
      accessView.hidden = true;
      adminView.hidden = false;
    } catch {
      denyAccess();
    }
  };

  logoutButton.addEventListener('click', async () => {
    const session = readSession();
    localStorage.removeItem(sessionKey);
    if (session?.access_token) await authRequest('logout', null, session.access_token).catch(() => {});
    window.location.replace('admin.html');
  });

  initialize();
})();
