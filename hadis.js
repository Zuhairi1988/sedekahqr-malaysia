(() => {
  // Hadith from HadeethEnc.com (Encyclopedia of Translated Prophetic Hadiths). Its terms allow reuse
  // without modification and with clear credit, so texts are shown exactly as published; only the
  // grade and source labels get a Malay rendering alongside the original Arabic.
  const api = 'https://hadeethenc.com/api/v1';
  const savedKey = 'sedekahqr-hadis-saved';
  const $ = (selector) => document.querySelector(selector);
  const home = $('#hadis-home');
  const detail = $('#hadis-detail');
  const errorBox = $('#hadis-error');
  const search = $('#hadis-search');
  const list = $('#hadis-list');
  const filters = $('#hadis-filters');
  const count = $('#hadis-count');
  let hadiths = [];
  let activeFilter = 'all';
  let currentId = 0;

  const themes = [
    [5, 'Adab & Akhlak'], [3, 'Akidah'], [4, 'Fiqh & Ibadah'], [6, 'Dakwah'], [1, 'Al-Quran'], [2, 'Ilmu Hadis'], [7, 'Sirah'],
  ];
  const gradeLabels = {
    'صحيح': 'Sahih',
    'حسن': 'Hasan',
    'صحيح لغيره': 'Sahih li ghairihi',
    'صحيح بشواهده': 'Sahih dengan syawahid',
    'صحيح بمجموع طرقه': 'Sahih dengan himpunan jalur riwayat',
    'قال النووي: حديث حسن': 'Hasan (menurut al-Nawawi)',
    'قال النووي: حديث صحيح': 'Sahih (menurut al-Nawawi)',
  };
  const narrators = new Map([
    ['البخاري', 'al-Bukhari'], ['مسلم', 'Muslim'], ['أبو داود', 'Abu Dawud'], ['الترمذي', 'al-Tirmidhi'],
    ['النسائي', "al-Nasa'i"], ['النسائي في الكبرى', "al-Nasa'i (al-Sunan al-Kubra)"], ['ابن ماجه', 'Ibn Majah'],
    ['أحمد', 'Ahmad'], ['الإمام أحمد', 'Ahmad'], ['البيهقي', 'al-Baihaqi'], ['الدارقطني', 'al-Daraqutni'],
    ['الحاكم', 'al-Hakim'], ['الطبراني', 'al-Tabarani'], ['ابن حبان', 'Ibn Hibban'], ['أبو يعلى', "Abu Ya'la"],
    ['الضياء المقدسي', "al-Diya' al-Maqdisi"], ['الدارمي', 'al-Darimi'], ['غيره', 'lain-lain'], ['غيرهما', 'lain-lain'],
  ]);
  // "رواه مسلم وأحمد" becomes "Riwayat Muslim dan Ahmad". Anything more elaborate keeps only the Arabic.
  const attributionLabel = (attribution = '') => {
    if (attribution === 'متفق عليه') return "Muttafaq 'alaih (al-Bukhari dan Muslim)";
    if (!attribution.startsWith('رواه ')) return '';
    const names = attribution.slice(5).split(/\s+و(?=\S)/).map((part) => narrators.get(part.trim()));
    if (!names.length || names.some((name) => !name)) return '';
    return `Riwayat ${names.length > 1 ? `${names.slice(0, -1).join(', ')} dan ${names.at(-1)}` : names[0]}`;
  };
  const gradeLabel = (grade) => gradeLabels[grade] || grade;

  const readSaved = () => {
    try { return new Set(JSON.parse(localStorage.getItem(savedKey) || '[]').map(Number)); } catch { return new Set(); }
  };
  let saved = readSaved();
  const writeSaved = () => {
    try { localStorage.setItem(savedKey, JSON.stringify([...saved])); } catch {}
  };
  // Letters only, so accents and Arabic harakat do not get in the way of a search.
  const normalize = (text) => String(text).toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭ]/g, '')
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ');

  const createText = (tag, className, text, arabic = false) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    if (arabic) {
      element.lang = 'ar';
      element.dir = 'rtl';
    }
    return element;
  };
  const hadithUrl = (id) => `hadis.html?id=${id}`;

  // ---------- List ----------
  const renderFilters = () => {
    const options = [['all', 'Semua', hadiths.length], ...themes.map(([id, label]) => [String(id), label, hadiths.filter((h) => h.categories.includes(id)).length]), ['saved', '★ Simpanan', saved.size]];
    filters.replaceChildren(...options.filter(([value, , total]) => value === 'all' || value === 'saved' || total > 0).map(([value, label, total]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `qh-chip${activeFilter === value ? ' is-active' : ''}`;
      chip.dataset.filter = value;
      chip.setAttribute('aria-pressed', String(activeFilter === value));
      chip.append(label, createText('span', 'hd-chip-count', ` ${total}`));
      return chip;
    }));
  };
  const renderList = () => {
    const query = normalize(search.value).trim();
    const shown = hadiths.filter((hadith) => {
      if (activeFilter === 'saved' && !saved.has(hadith.id)) return false;
      if (activeFilter !== 'all' && activeFilter !== 'saved' && !hadith.categories.includes(Number(activeFilter))) return false;
      return !query || hadith.searchText.includes(query);
    });
    list.replaceChildren(...shown.map((hadith) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'hd-row';
      link.href = hadithUrl(hadith.id);
      link.dataset.hadisLink = '';
      link.append(
        createText('span', 'qh-num', String(hadith.position)),
        (() => {
          const body = document.createElement('span');
          body.className = 'hd-row-body';
          body.append(createText('strong', '', hadith.title), createText('small', '', [gradeLabel(hadith.grade), attributionLabel(hadith.attribution)].filter(Boolean).join(' · ')));
          return body;
        })(),
      );
      if (saved.has(hadith.id)) link.append(createText('span', 'hd-row-saved', '★'));
      item.append(link);
      return item;
    }));
    count.textContent = query || activeFilter !== 'all' ? `${shown.length} daripada ${hadiths.length} hadis` : `${hadiths.length} hadis`;
    $('#hadis-empty').hidden = shown.length > 0;
  };
  // One hadith a day, the same for everyone in Malaysia on a given date.
  const renderToday = () => {
    const day = Math.floor((Date.now() + 8 * 3_600_000) / 86_400_000);
    const hadith = hadiths[day % hadiths.length];
    const card = $('#hadis-today');
    card.href = hadithUrl(hadith.id);
    card.dataset.hadisLink = '';
    $('#hadis-today-arabic').textContent = hadith.arabic;
    $('#hadis-today-title').textContent = hadith.title;
    card.hidden = false;
  };

  // ---------- Single hadith ----------
  const extraCache = new Map();
  const loadExtra = (id) => {
    if (!extraCache.has(id)) {
      extraCache.set(id, fetch(`${api}/hadeeths/one/?language=ms&id=${id}`)
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('HadeethEnc request failed'))))
        .catch((fetchError) => { extraCache.delete(id); throw fetchError; }));
    }
    return extraCache.get(id);
  };
  const setNeighbour = (link, hadith) => {
    link.hidden = !hadith;
    if (!hadith) return;
    link.href = hadithUrl(hadith.id);
    link.querySelector('strong').textContent = hadith.title;
  };
  const updateSaveButton = () => {
    const button = $('#hadis-save');
    const isSaved = saved.has(currentId);
    button.setAttribute('aria-pressed', String(isSaved));
    button.setAttribute('aria-label', isSaved ? 'Buang daripada simpanan' : 'Simpan hadis');
    button.title = isSaved ? 'Buang daripada simpanan' : 'Simpan hadis';
  };
  const showDetail = async (id) => {
    const index = hadiths.findIndex((hadith) => hadith.id === id);
    if (index < 0) {
      showHome();
      return;
    }
    const hadith = hadiths[index];
    currentId = id;
    home.hidden = true;
    detail.hidden = false;
    errorBox.hidden = true;
    document.title = `${hadith.title.slice(0, 60)} - Hadis - SedekahQR`;
    $('#hadis-position').textContent = `${index + 1} daripada ${hadiths.length}`;
    $('#hadis-grade').textContent = gradeLabel(hadith.grade);
    $('#hadis-grade').title = hadith.grade;
    $('#hadis-source').textContent = attributionLabel(hadith.attribution) || hadith.attribution;
    $('#hadis-heading').textContent = hadith.title;
    $('#hadis-arabic').textContent = hadith.arabic;
    $('#hadis-text').textContent = hadith.hadeeth;
    $('#hadis-attribution-ar').textContent = `${hadith.attribution} · ${hadith.grade}`;
    $('#hadis-source-link').href = `https://hadeethenc.com/ms/browse/hadith/${id}`;
    setNeighbour($('#hadis-previous'), hadiths[index - 1]);
    setNeighbour($('#hadis-next'), hadiths[index + 1]);
    updateSaveButton();
    window.scrollTo({ top: 0 });

    const status = $('#hadis-extra-status');
    const explanationWrap = $('#hadis-explanation-wrap');
    const lessonsWrap = $('#hadis-lessons-wrap');
    explanationWrap.hidden = true;
    lessonsWrap.hidden = true;
    status.textContent = 'Memuatkan huraian dan pengajaran...';
    try {
      const extra = await loadExtra(id);
      if (currentId !== id) return;
      const paragraphs = String(extra.explanation || '').split(/\r?\n+/).map((text) => text.trim()).filter(Boolean);
      $('#hadis-explanation').replaceChildren(...paragraphs.map((text) => createText('p', '', text)));
      explanationWrap.hidden = !paragraphs.length;
      const lessons = (extra.hints || []).map((text) => String(text).trim()).filter(Boolean);
      $('#hadis-lessons').replaceChildren(...lessons.map((text) => createText('li', '', text)));
      lessonsWrap.hidden = !lessons.length;
      status.textContent = '';
    } catch {
      if (currentId === id) status.textContent = 'Huraian tidak dapat dimuatkan sekarang. Buka sumber di HadeethEnc.com untuk bacaan penuh.';
    }
  };
  const showHome = () => {
    currentId = 0;
    detail.hidden = true;
    home.hidden = false;
    document.title = 'Hadis - SedekahQR';
    renderFilters();
    renderList();
  };
  const route = () => {
    const id = Number(new URLSearchParams(location.search).get('id'));
    if (id) void showDetail(id);
    else showHome();
  };
  const navigate = (url) => {
    history.pushState(null, '', url);
    route();
  };

  // ---------- Events ----------
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-hadis-link], [data-hadis-home]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
    event.preventDefault();
    navigate(link.getAttribute('href'));
  });
  window.addEventListener('popstate', route);
  search.addEventListener('input', renderList);
  filters.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-filter]');
    if (!chip) return;
    activeFilter = chip.dataset.filter;
    renderFilters();
    renderList();
  });
  $('#hadis-save').addEventListener('click', () => {
    if (saved.has(currentId)) saved.delete(currentId);
    else saved.add(currentId);
    writeSaved();
    updateSaveButton();
  });
  $('#hadis-share').addEventListener('click', async () => {
    const hadith = hadiths.find((item) => item.id === currentId);
    if (!hadith) return;
    const url = new URL(hadithUrl(hadith.id), location.href).href;
    const source = attributionLabel(hadith.attribution) || hadith.attribution;
    const text = `${hadith.hadeeth}\n\n${source} · ${gradeLabel(hadith.grade)}\nSumber: HadeethEnc.com`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Hadis', text, url }); } catch {}
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
  });

  // The reader bar sits under the site's sticky header.
  const header = document.querySelector('.directory-header');
  const syncHeaderHeight = () => document.documentElement.style.setProperty('--site-header-height', `${header?.offsetHeight || 0}px`);
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight);

  const start = async () => {
    errorBox.hidden = true;
    try {
      const response = await fetch('hadis-data.json?v=20260930-1');
      if (!response.ok) throw new Error('Hadith list request failed');
      const data = await response.json();
      hadiths = data.hadiths.map((hadith, index) => ({
        ...hadith,
        position: index + 1,
        searchText: normalize(`${hadith.title} ${hadith.hadeeth} ${hadith.arabic} ${attributionLabel(hadith.attribution)}`),
      }));
      renderToday();
      route();
    } catch {
      home.hidden = true;
      detail.hidden = true;
      errorBox.hidden = false;
    }
  };
  $('#hadis-retry').addEventListener('click', () => { home.hidden = false; void start(); });
  void start();
})();
