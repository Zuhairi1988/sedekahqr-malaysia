(() => {
  const config = globalThis.SEDEKAHQR_BLOG;
  const sessionKey = 'sedekahqr-admin-session';
  const categories = ['Al-Quran', 'Hadis', 'Doa', 'Sirah', 'Akhlak', 'Sedekah'];
  const blockLabels = {
    paragraph: 'Perenggan',
    heading: 'Tajuk kecil',
    quote: 'Petikan',
    list: 'Senarai'
  };

  const elements = {
    loginView: document.querySelector('#login-view'),
    loginForm: document.querySelector('#login-form'),
    loginEmail: document.querySelector('#login-email'),
    loginPassword: document.querySelector('#login-password'),
    loginSubmit: document.querySelector('#login-submit'),
    loginMessage: document.querySelector('#login-message'),
    togglePassword: document.querySelector('#toggle-password'),
    dashboardView: document.querySelector('#dashboard-view'),
    dashboardMessage: document.querySelector('#dashboard-message'),
    adminIdentity: document.querySelector('#admin-identity'),
    analyticsPeriod: document.querySelector('#analytics-period'),
    analyticsRefresh: document.querySelector('#analytics-refresh'),
    analyticsStatus: document.querySelector('#analytics-status'),
    todayViews: document.querySelector('#today-views'),
    todayVisitors: document.querySelector('#today-visitors'),
    periodViews: document.querySelector('#period-views'),
    periodVisitors: document.querySelector('#period-visitors'),
    periodViewsLabel: document.querySelector('#period-views-label'),
    periodVisitorsLabel: document.querySelector('#period-visitors-label'),
    averagePageTime: document.querySelector('#average-page-time'),
    bounceRate: document.querySelector('#bounce-rate'),
    analyticsChart: document.querySelector('#analytics-chart'),
    analyticsPages: document.querySelector('#analytics-pages'),
    analyticsReferrers: document.querySelector('#analytics-referrers'),
    analyticsDevices: document.querySelector('#analytics-devices'),
    qrViews: document.querySelector('#qr-views'),
    qrDownloads: document.querySelector('#qr-downloads'),
    qrDownloaders: document.querySelector('#qr-downloaders'),
    qrTodayDownloads: document.querySelector('#qr-today-downloads'),
    qrAnalyticsList: document.querySelector('#qr-analytics-list'),
    totalCount: document.querySelector('#total-count'),
    publishedCount: document.querySelector('#published-count'),
    draftCount: document.querySelector('#draft-count'),
    search: document.querySelector('#admin-search'),
    articleList: document.querySelector('#admin-article-list'),
    newArticleButton: document.querySelector('#new-article-button'),
    logoutButton: document.querySelector('#logout-button'),
    editorPanel: document.querySelector('#editor-panel'),
    editorMode: document.querySelector('#editor-mode'),
    editorTitle: document.querySelector('#editor-title'),
    closeEditor: document.querySelector('#close-editor'),
    cancelEditor: document.querySelector('#cancel-editor'),
    form: document.querySelector('#article-form'),
    title: document.querySelector('#article-title'),
    slug: document.querySelector('#article-slug'),
    excerpt: document.querySelector('#article-excerpt'),
    category: document.querySelector('#article-category'),
    author: document.querySelector('#article-author'),
    cover: document.querySelector('#article-cover'),
    readingMinutes: document.querySelector('#article-reading-minutes'),
    publishedAt: document.querySelector('#article-published-at'),
    isPublished: document.querySelector('#article-is-published'),
    contentBlocks: document.querySelector('#content-blocks'),
    sourceRows: document.querySelector('#source-rows'),
    addSource: document.querySelector('#add-source'),
    saveArticle: document.querySelector('#save-article'),
    previewArticle: document.querySelector('#preview-article')
  };

  let session = null;
  let refreshPromise = null;
  let articles = [];
  let currentArticle = null;
  let editorBlocks = [];
  let editorSources = [];
  let slugTouched = false;

  const showMessage = (element, message, success = false) => {
    element.textContent = message;
    element.classList.toggle('is-success', success);
    element.hidden = !message;
  };

  const parseResponseError = async (response, fallback) => {
    try {
      const body = await response.json();
      return body.msg || body.message || body.error_description || body.error || fallback;
    } catch {
      return fallback;
    }
  };

  const persistSession = (value) => {
    session = value;
    if (value) localStorage.setItem(sessionKey, JSON.stringify(value));
    else localStorage.removeItem(sessionKey);
  };

  const normalizeSession = (value) => ({
    ...value,
    expires_at: Number(value.expires_at) || Math.floor(Date.now() / 1000) + Number(value.expires_in || 3600)
  });

  const authRequest = async (path, body, accessToken) => {
    const headers = {
      apikey: config.publishableKey,
      'Content-Type': 'application/json'
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  };

  const refreshSession = async () => {
    if (!session?.refresh_token) throw new Error('Sesi telah tamat. Sila log masuk semula.');
    if (!refreshPromise) {
      refreshPromise = authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
        .then(async (response) => {
          if (!response.ok) throw new Error(await parseResponseError(response, 'Sesi tidak dapat diperbaharui.'));
          const nextSession = normalizeSession(await response.json());
          persistSession(nextSession);
          return nextSession;
        })
        .finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  };

  const getAccessToken = async () => {
    if (!session) throw new Error('Sila log masuk semula.');
    if (session.expires_at <= Math.floor(Date.now() / 1000) + 60) await refreshSession();
    return session.access_token;
  };

  const restRequest = async (path, options = {}, retried = false) => {
    const accessToken = await getAccessToken();
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (response.status === 401 && !retried) {
      await refreshSession();
      return restRequest(path, options, true);
    }
    return response;
  };

  const verifyAdmin = async () => {
    const userId = session?.user?.id;
    if (!userId) return false;
    const response = await restRequest(`app_admins?select=user_id,email&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
    if (!response.ok) throw new Error(await parseResponseError(response, 'Akses admin tidak dapat disahkan.'));
    const memberships = await response.json();
    return memberships.length > 0;
  };

  const setAuthenticatedView = (authenticated) => {
    elements.loginView.hidden = authenticated;
    elements.dashboardView.hidden = !authenticated;
    if (authenticated) {
      elements.adminIdentity.textContent = session?.user?.email || '';
      elements.loginPassword.value = '';
    }
  };

  const login = async (email, password) => {
    const response = await authRequest('token?grant_type=password', { email, password });
    if (!response.ok) throw new Error(await parseResponseError(response, 'E-mel atau kata laluan tidak sah.'));
    persistSession(normalizeSession(await response.json()));
    if (!await verifyAdmin()) {
      persistSession(null);
      throw new Error('Akaun ini belum diberi akses admin.');
    }
  };

  const logout = async () => {
    const accessToken = session?.access_token;
    persistSession(null);
    setAuthenticatedView(false);
    articles = [];
    renderArticleList();
    if (accessToken) await authRequest('logout', null, accessToken).catch(() => {});
  };

  const formatDate = (value) => {
    if (!value) return 'Belum ditetapkan';
    return new Intl.DateTimeFormat('ms-MY', {
      day: 'numeric', month: 'short', year: 'numeric'
    }).format(new Date(value));
  };

  const toDatetimeLocal = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  };

  const slugify = (value) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150);

  const loadArticles = async () => {
    elements.articleList.innerHTML = '<p class="admin-list-empty">Memuatkan artikel...</p>';
    const response = await restRequest('islamic_articles?select=*&order=updated_at.desc');
    if (!response.ok) throw new Error(await parseResponseError(response, 'Artikel tidak dapat dimuatkan.'));
    articles = await response.json();
    renderSummary();
    renderArticleList();
  };

  const renderSummary = () => {
    const published = articles.filter((article) => article.is_published).length;
    elements.totalCount.textContent = String(articles.length);
    elements.publishedCount.textContent = String(published);
    elements.draftCount.textContent = String(articles.length - published);
  };

  const formatNumber = (value) => new Intl.NumberFormat('ms-MY').format(Number(value) || 0);

  const formatDuration = (seconds) => {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return '-';
    const minutes = Math.floor(value / 60);
    const remainder = Math.round(value % 60);
    return minutes ? `${minutes} min ${remainder} saat` : `${remainder} saat`;
  };

  const setAnalyticsStatus = (message, isError = false) => {
    elements.analyticsStatus.textContent = message;
    elements.analyticsStatus.classList.toggle('is-error', isError);
    elements.analyticsStatus.hidden = !message;
  };

  const emptyAnalyticsElement = (message = 'Belum ada data untuk tempoh ini.') => {
    const empty = document.createElement('p');
    empty.className = 'analytics-empty';
    empty.textContent = message;
    return empty;
  };

  const renderAnalyticsChart = (daily) => {
    elements.analyticsChart.replaceChildren();
    if (!daily.length || !daily.some((item) => Number(item.views))) {
      elements.analyticsChart.append(emptyAnalyticsElement());
      return;
    }

    const maximum = Math.max(...daily.map((item) => Number(item.views) || 0), 1);
    const labelInterval = daily.length <= 7 ? 1 : daily.length <= 30 ? 5 : 15;
    daily.forEach((item, index) => {
      const views = Number(item.views) || 0;
      const visitors = Number(item.visitors) || 0;
      const date = new Date(`${item.day}T00:00:00`);
      const fullDate = new Intl.DateTimeFormat('ms-MY', {
        day: 'numeric', month: 'short', year: 'numeric'
      }).format(date);
      const slot = document.createElement('div');
      slot.className = 'analytics-bar-slot';
      slot.title = `${fullDate}: ${formatNumber(views)} lawatan, ${formatNumber(visitors)} pelawat`;

      const bar = document.createElement('i');
      bar.className = 'analytics-bar';
      bar.style.height = `${Math.max((views / maximum) * 100, views ? 3 : 1)}%`;
      slot.append(bar);

      if (index % labelInterval === 0 || index === daily.length - 1) {
        const label = document.createElement('span');
        label.textContent = new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'short' }).format(date);
        slot.append(label);
      }
      elements.analyticsChart.append(slot);
    });

    elements.analyticsChart.setAttribute(
      'aria-label',
      `Carta ${formatNumber(daily.reduce((sum, item) => sum + (Number(item.views) || 0), 0))} lawatan sepanjang tempoh dipilih.`
    );
  };

  const renderTopPages = (pages) => {
    elements.analyticsPages.replaceChildren();
    if (!pages.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 3;
      cell.append(emptyAnalyticsElement());
      row.append(cell);
      elements.analyticsPages.append(row);
      return;
    }

    pages.forEach((page) => {
      const row = document.createElement('tr');
      const title = document.createElement('td');
      const views = document.createElement('td');
      const visitors = document.createElement('td');
      title.textContent = page.title || page.path;
      title.title = page.path;
      views.textContent = formatNumber(page.views);
      visitors.textContent = formatNumber(page.visitors);
      row.append(title, views, visitors);
      elements.analyticsPages.append(row);
    });
  };

  const renderRankedList = (container, rows, labelKey) => {
    container.replaceChildren();
    if (!rows.length) {
      container.append(emptyAnalyticsElement());
      return;
    }
    rows.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'analytics-ranked-row';
      const label = document.createElement('span');
      const value = document.createElement('strong');
      label.textContent = item[labelKey];
      value.textContent = formatNumber(item.views);
      row.append(label, value);
      container.append(row);
    });
  };

  const renderAnalytics = (data) => {
    const days = Number(data.period_days) || Number(elements.analyticsPeriod.value);
    const totals = data.totals || {};
    elements.todayViews.textContent = formatNumber(totals.today_views);
    elements.todayVisitors.textContent = formatNumber(totals.today_visitors);
    elements.periodViews.textContent = formatNumber(totals.views);
    elements.periodVisitors.textContent = formatNumber(totals.visitors);
    elements.averagePageTime.textContent = formatDuration(totals.average_page_seconds);
    elements.bounceRate.textContent = totals.bounce_rate === null || totals.bounce_rate === undefined
      ? '-'
      : `${Number(totals.bounce_rate).toLocaleString('ms-MY', { maximumFractionDigits: 1 })}%`;
    elements.periodViewsLabel.textContent = `Lawatan ${days} hari`;
    elements.periodVisitorsLabel.textContent = `Pelawat ${days} hari`;
    renderAnalyticsChart(Array.isArray(data.daily) ? data.daily : []);
    renderTopPages(Array.isArray(data.top_pages) ? data.top_pages : []);
    renderRankedList(elements.analyticsReferrers, Array.isArray(data.referrers) ? data.referrers : [], 'source');

    const deviceLabels = { desktop: 'Komputer', mobile: 'Telefon', tablet: 'Tablet' };
    const devices = (Array.isArray(data.devices) ? data.devices : []).map((item) => ({
      ...item,
      device: deviceLabels[item.device] || item.device
    }));
    renderRankedList(elements.analyticsDevices, devices, 'device');
  };

  const renderQrAnalytics = (data) => {
    const totals = data.totals || {};
    elements.qrViews.textContent = formatNumber(totals.views);
    elements.qrDownloads.textContent = formatNumber(totals.downloads);
    elements.qrDownloaders.textContent = formatNumber(totals.unique_downloaders);
    elements.qrTodayDownloads.textContent = formatNumber(totals.today_downloads);
    elements.qrAnalyticsList.replaceChildren();

    const rows = Array.isArray(data.top_qr) ? data.top_qr : [];
    if (!rows.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 4;
      cell.append(emptyAnalyticsElement('Belum ada aktiviti QR untuk tempoh ini.'));
      row.append(cell);
      elements.qrAnalyticsList.append(row);
      return;
    }

    rows.forEach((item) => {
      const row = document.createElement('tr');
      [item.name, item.state, formatNumber(item.views), formatNumber(item.downloads)].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      elements.qrAnalyticsList.append(row);
    });
  };

  const loadAnalytics = async () => {
    const days = Number(elements.analyticsPeriod.value) || 30;
    elements.analyticsRefresh.disabled = true;
    elements.analyticsRefresh.classList.add('is-loading');
    setAnalyticsStatus('Memuatkan statistik...');
    try {
      const options = { method: 'POST', body: JSON.stringify({ period_days: days }) };
      const [response, qrResponse] = await Promise.all([
        restRequest('rpc/get_site_analytics', options),
        restRequest('rpc/get_qr_analytics', options)
      ]);
      if (!response.ok) throw new Error(await parseResponseError(response, 'Statistik laman tidak dapat dimuatkan.'));
      if (!qrResponse.ok) throw new Error(await parseResponseError(qrResponse, 'Statistik QR tidak dapat dimuatkan.'));
      const [analytics, qrAnalytics] = await Promise.all([response.json(), qrResponse.json()]);
      renderAnalytics(analytics);
      renderQrAnalytics(qrAnalytics);
      setAnalyticsStatus('');
    } catch (error) {
      setAnalyticsStatus(error.message || 'Statistik tidak dapat dimuatkan.', true);
    } finally {
      elements.analyticsRefresh.disabled = false;
      elements.analyticsRefresh.classList.remove('is-loading');
    }
  };

  const createIconButton = (label, symbol, className, handler) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-icon-button${className ? ` ${className}` : ''}`;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.textContent = symbol;
    button.addEventListener('click', handler);
    return button;
  };

  const renderArticleList = () => {
    const query = elements.search.value.trim().toLocaleLowerCase('ms');
    const filtered = articles.filter((article) => `${article.title} ${article.category}`.toLocaleLowerCase('ms').includes(query));
    elements.articleList.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-list-empty';
      empty.textContent = query ? 'Tiada artikel sepadan dengan carian.' : 'Belum ada artikel.';
      elements.articleList.append(empty);
      return;
    }

    filtered.forEach((article) => {
      const row = document.createElement('article');
      row.className = 'admin-article-row';
      if (currentArticle?.id === article.id) row.classList.add('is-active');

      const details = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = article.title;
      const meta = document.createElement('div');
      meta.className = 'admin-row-meta';
      const status = document.createElement('span');
      status.className = `admin-status-pill${article.is_published ? ' is-published' : ''}`;
      status.textContent = article.is_published ? 'Diterbitkan' : 'Draf';
      const category = document.createElement('span');
      category.textContent = article.category;
      const date = document.createElement('span');
      date.textContent = formatDate(article.published_at);
      meta.append(status, category, date);
      details.append(title, meta);

      const actions = document.createElement('div');
      actions.className = 'admin-row-actions';
      actions.append(
        createIconButton('Edit artikel', '\u270e', '', () => openEditor(article)),
        createIconButton('Padam artikel', '\u00d7', 'is-danger', () => deleteArticle(article))
      );
      row.append(details, actions);
      elements.articleList.append(row);
    });
  };

  const defaultBlock = (type = 'paragraph') => {
    if (type === 'list') return { type, items: [''] };
    if (type === 'quote') return { type, text: '', source: '' };
    return { type, text: '' };
  };

  const createField = (labelText, control) => {
    const label = document.createElement('label');
    label.className = 'admin-block-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.append(span, control);
    return label;
  };

  const renderContentBlocks = () => {
    elements.contentBlocks.replaceChildren();
    editorBlocks.forEach((block, index) => {
      const wrapper = document.createElement('article');
      wrapper.className = 'admin-content-block';

      const toolbar = document.createElement('div');
      toolbar.className = 'admin-block-toolbar';
      const typeSelect = document.createElement('select');
      Object.entries(blockLabels).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = block.type === value;
        typeSelect.append(option);
      });
      typeSelect.setAttribute('aria-label', 'Jenis blok');
      typeSelect.addEventListener('change', () => {
        editorBlocks[index] = defaultBlock(typeSelect.value);
        renderContentBlocks();
      });

      const actions = document.createElement('div');
      actions.className = 'admin-block-actions';
      const move = (direction) => {
        const target = index + direction;
        if (target < 0 || target >= editorBlocks.length) return;
        [editorBlocks[index], editorBlocks[target]] = [editorBlocks[target], editorBlocks[index]];
        renderContentBlocks();
      };
      actions.append(
        createIconButton('Alih ke atas', '\u2191', '', () => move(-1)),
        createIconButton('Alih ke bawah', '\u2193', '', () => move(1)),
        createIconButton('Buang blok', '\u00d7', 'is-danger', () => {
          editorBlocks.splice(index, 1);
          renderContentBlocks();
        })
      );
      toolbar.append(typeSelect, actions);
      wrapper.append(toolbar);

      if (block.type === 'list') {
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.placeholder = 'Satu isi bagi setiap baris';
        textarea.value = Array.isArray(block.items) ? block.items.join('\n') : '';
        textarea.required = true;
        textarea.addEventListener('input', () => { block.items = textarea.value.split('\n'); });
        wrapper.append(createField('Isi senarai', textarea));
      } else {
        const textarea = document.createElement('textarea');
        textarea.rows = block.type === 'heading' ? 2 : 4;
        textarea.value = block.text || '';
        textarea.required = true;
        textarea.addEventListener('input', () => { block.text = textarea.value; });
        wrapper.append(createField(block.type === 'heading' ? 'Tajuk kecil' : 'Teks', textarea));

        if (block.type === 'quote') {
          const source = document.createElement('input');
          source.type = 'text';
          source.value = block.source || '';
          source.placeholder = 'Contoh: Ibrahim 14:7';
          source.required = true;
          source.addEventListener('input', () => { block.source = source.value; });
          wrapper.append(createField('Sumber petikan', source));
        }
      }

      elements.contentBlocks.append(wrapper);
    });
  };

  const renderSources = () => {
    elements.sourceRows.replaceChildren();
    editorSources.forEach((source, index) => {
      const row = document.createElement('div');
      row.className = 'admin-source-row';
      const label = document.createElement('input');
      label.type = 'text';
      label.placeholder = 'Nama sumber';
      label.value = source.label || '';
      label.required = true;
      label.setAttribute('aria-label', 'Nama sumber');
      label.addEventListener('input', () => { source.label = label.value; });
      const url = document.createElement('input');
      url.type = 'url';
      url.placeholder = 'https://...';
      url.value = source.url || '';
      url.required = true;
      url.setAttribute('aria-label', 'Pautan sumber');
      url.addEventListener('input', () => { source.url = url.value; });
      row.append(label, url, createIconButton('Buang sumber', '\u00d7', 'is-danger', () => {
        editorSources.splice(index, 1);
        renderSources();
      }));
      elements.sourceRows.append(row);
    });
  };

  const openEditor = (article = null) => {
    currentArticle = article;
    slugTouched = Boolean(article);
    elements.form.reset();
    elements.editorMode.textContent = article ? 'Edit artikel' : 'Artikel baharu';
    elements.editorTitle.textContent = article ? article.title : 'Tulis artikel';
    elements.title.value = article?.title || '';
    elements.slug.value = article?.slug || '';
    elements.excerpt.value = article?.excerpt || '';
    elements.category.value = categories.includes(article?.category) ? article.category : 'Al-Quran';
    elements.author.value = article?.author || 'Editorial SedekahQR';
    elements.cover.value = article?.cover_image || 'assets/blog-hero-quran.jpg';
    elements.readingMinutes.value = article?.reading_minutes || 5;
    elements.isPublished.checked = Boolean(article?.is_published);
    elements.publishedAt.value = toDatetimeLocal(article?.published_at);
    editorBlocks = Array.isArray(article?.content) && article.content.length
      ? structuredClone(article.content)
      : [defaultBlock('paragraph')];
    editorSources = Array.isArray(article?.sources) ? structuredClone(article.sources) : [];
    elements.previewArticle.hidden = !article?.is_published;
    elements.previewArticle.href = article ? `article.html?slug=${encodeURIComponent(article.slug)}` : 'article.html';
    elements.editorPanel.hidden = false;
    renderContentBlocks();
    renderSources();
    renderArticleList();
    if (window.innerWidth < 981) elements.editorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const closeEditor = () => {
    currentArticle = null;
    elements.editorPanel.hidden = true;
    renderArticleList();
  };

  const cleanBlocks = () => editorBlocks.map((block) => {
    if (block.type === 'list') {
      return { type: 'list', items: (block.items || []).map((item) => item.trim()).filter(Boolean) };
    }
    const clean = { type: block.type, text: (block.text || '').trim() };
    if (block.type === 'quote') clean.source = (block.source || '').trim();
    return clean;
  }).filter((block) => block.type === 'list' ? block.items.length : block.text);

  const cleanSources = () => editorSources
    .map((source) => ({ label: (source.label || '').trim(), url: (source.url || '').trim() }))
    .filter((source) => source.label && source.url);

  const getArticlePayload = () => {
    const isPublished = elements.isPublished.checked;
    let publishedAt = elements.publishedAt.value;
    if (isPublished && !publishedAt) {
      publishedAt = toDatetimeLocal(new Date().toISOString());
      elements.publishedAt.value = publishedAt;
    }
    const content = cleanBlocks();
    if (!content.length) throw new Error('Tambah sekurang-kurangnya satu blok kandungan.');
    return {
      title: elements.title.value.trim(),
      slug: elements.slug.value.trim(),
      excerpt: elements.excerpt.value.trim(),
      category: elements.category.value,
      author: elements.author.value.trim(),
      cover_image: elements.cover.value.trim(),
      reading_minutes: Number(elements.readingMinutes.value),
      content,
      sources: cleanSources(),
      is_published: isPublished,
      published_at: publishedAt ? new Date(publishedAt).toISOString() : null
    };
  };

  const saveArticle = async () => {
    const payload = getArticlePayload();
    const isEditing = Boolean(currentArticle?.id);
    const path = isEditing
      ? `islamic_articles?id=eq.${encodeURIComponent(currentArticle.id)}&select=*`
      : 'islamic_articles?select=*';
    const response = await restRequest(path, {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(await parseResponseError(response, 'Artikel tidak dapat disimpan.'));
    const [saved] = await response.json();
    await loadArticles();
    openEditor(saved);
    showMessage(elements.dashboardMessage, 'Artikel berjaya disimpan.', true);
  };

  const deleteArticle = async (article) => {
    if (!window.confirm(`Padam artikel "${article.title}"? Tindakan ini tidak boleh dibatalkan.`)) return;
    const response = await restRequest(`islamic_articles?id=eq.${encodeURIComponent(article.id)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      showMessage(elements.dashboardMessage, await parseResponseError(response, 'Artikel tidak dapat dipadam.'));
      return;
    }
    if (currentArticle?.id === article.id) closeEditor();
    await loadArticles();
    showMessage(elements.dashboardMessage, 'Artikel telah dipadam.', true);
  };

  elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage(elements.loginMessage, '');
    elements.loginSubmit.disabled = true;
    elements.loginSubmit.textContent = 'Sedang log masuk...';
    try {
      await login(elements.loginEmail.value.trim(), elements.loginPassword.value);
      setAuthenticatedView(true);
      await Promise.all([loadArticles(), loadAnalytics()]);
    } catch (error) {
      persistSession(null);
      showMessage(elements.loginMessage, error.message || 'Log masuk gagal.');
    } finally {
      elements.loginSubmit.disabled = false;
      elements.loginSubmit.textContent = 'Log masuk';
    }
  });

  elements.togglePassword.addEventListener('click', () => {
    const revealing = elements.loginPassword.type === 'password';
    elements.loginPassword.type = revealing ? 'text' : 'password';
    elements.togglePassword.textContent = revealing ? 'Sembunyi' : 'Lihat';
    elements.togglePassword.setAttribute('aria-label', revealing ? 'Sembunyikan kata laluan' : 'Tunjukkan kata laluan');
  });

  elements.logoutButton.addEventListener('click', logout);
  elements.analyticsPeriod.addEventListener('change', loadAnalytics);
  elements.analyticsRefresh.addEventListener('click', loadAnalytics);
  elements.newArticleButton.addEventListener('click', () => openEditor());
  elements.closeEditor.addEventListener('click', closeEditor);
  elements.cancelEditor.addEventListener('click', closeEditor);
  elements.search.addEventListener('input', renderArticleList);
  elements.title.addEventListener('input', () => {
    if (!slugTouched) elements.slug.value = slugify(elements.title.value);
  });
  elements.slug.addEventListener('input', () => {
    slugTouched = Boolean(elements.slug.value);
    elements.slug.value = slugify(elements.slug.value);
  });
  elements.isPublished.addEventListener('change', () => {
    if (elements.isPublished.checked && !elements.publishedAt.value) {
      elements.publishedAt.value = toDatetimeLocal(new Date().toISOString());
    }
  });
  document.querySelectorAll('[data-add-block]').forEach((button) => {
    button.addEventListener('click', () => {
      editorBlocks.push(defaultBlock(button.dataset.addBlock));
      renderContentBlocks();
    });
  });
  elements.addSource.addEventListener('click', () => {
    editorSources.push({ label: '', url: '' });
    renderSources();
  });
  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage(elements.dashboardMessage, '');
    elements.saveArticle.disabled = true;
    elements.saveArticle.textContent = 'Menyimpan...';
    try {
      await saveArticle();
    } catch (error) {
      showMessage(elements.dashboardMessage, error.message || 'Artikel tidak dapat disimpan.');
      elements.dashboardMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
      elements.saveArticle.disabled = false;
      elements.saveArticle.textContent = 'Simpan artikel';
    }
  });

  const initialize = async () => {
    if (!config?.supabaseUrl || !config?.publishableKey) {
      showMessage(elements.loginMessage, 'Konfigurasi Supabase tidak lengkap.');
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(sessionKey));
      if (!stored?.refresh_token) return;
      session = normalizeSession(stored);
      await getAccessToken();
      if (!await verifyAdmin()) throw new Error('Akaun ini belum diberi akses admin.');
      setAuthenticatedView(true);
      await Promise.all([loadArticles(), loadAnalytics()]);
    } catch (error) {
      persistSession(null);
      setAuthenticatedView(false);
      showMessage(elements.loginMessage, error.message || 'Sesi telah tamat. Sila log masuk semula.');
    }
  };

  initialize();
})();
