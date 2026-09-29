(() => {
  const data = globalThis.SEDEKAHQR_QURAN;
  const lastReadingKey = 'sedekahqr-quran-last-reading';
  const search = document.querySelector('#surah-search');
  const surahList = document.querySelector('#surah-list');
  const juzList = document.querySelector('#juz-list');
  const empty = document.querySelector('#list-empty');
  const count = document.querySelector('#list-count');
  const tabs = document.querySelectorAll('[data-list]');
  if (!data || !surahList) return;

  const surahs = data.surahs.map(([name, meaning, arabic, english, ayahs, madaniyah, startPage], index) => ({
    number: index + 1, name, meaning, arabic, english, ayahs, madaniyah, startPage,
  }));
  const surahForPage = (page) => surahs.reduce((found, surah) => (surah.startPage <= page ? surah : found), surahs[0]);
  // Letters only, so "yasin", "Ya-Sin" and "Yaseen" all match; Arabic loses its harakat.
  const normalize = (text) => String(text).toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭ]/g, '')
    .replace(/[^a-z0-9؀-ۿ]/g, '');
  const describe = (surah) => [surah.meaning !== surah.name ? surah.meaning : '', surah.madaniyah ? 'Madaniyah' : 'Makkiyah', `${surah.ayahs} ayat`]
    .filter(Boolean).join(' · ');

  const row = (href, number, title, subtitle, arabic) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'qh-row';
    link.href = href;
    const badge = document.createElement('span');
    badge.className = 'qh-num';
    badge.textContent = number;
    const name = document.createElement('span');
    name.className = 'qh-name';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const small = document.createElement('small');
    small.textContent = subtitle;
    name.append(strong, small);
    link.append(badge, name);
    if (arabic) {
      const ar = document.createElement('span');
      ar.className = 'qh-ar';
      ar.lang = 'ar';
      ar.dir = 'rtl';
      ar.textContent = arabic;
      link.append(ar);
    }
    item.append(link);
    return item;
  };

  const surahRows = surahs.map((surah) => {
    const item = row(`quran-reader.html?surah=${surah.number}`, surah.number, surah.name, describe(surah), surah.arabic);
    item.dataset.search = normalize(`${surah.name} ${surah.english} ${surah.meaning} ${surah.arabic}`);
    item.dataset.number = String(surah.number);
    return item;
  });
  surahList.append(...surahRows);
  juzList.append(...data.juz.map(([page, surahNumber, ayah], index) => {
    const surah = surahs[surahNumber - 1];
    return row(`quran-reader.html?page=${page}`, index + 1, `Juz ${index + 1}`, `${surah.name} ${ayah} · Halaman ${page}`, '');
  }));

  let activeList = 'surah';
  const applyFilter = () => {
    const query = normalize(search.value);
    const isNumber = /^\d+$/.test(search.value.trim());
    let shown = 0;
    surahRows.forEach((item) => {
      const match = !query || (isNumber ? item.dataset.number === search.value.trim() : item.dataset.search.includes(query));
      item.hidden = !match;
      if (match) shown += 1;
    });
    if (query && activeList !== 'surah') setList('surah');
    empty.hidden = activeList !== 'surah' || shown > 0;
    count.textContent = activeList === 'juz' ? '30 juz' : query ? `${shown} daripada 114 surah` : '114 surah';
  };
  const setList = (list) => {
    activeList = list;
    tabs.forEach((tab) => {
      const active = tab.dataset.list === list;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    surahList.hidden = list !== 'surah';
    juzList.hidden = list !== 'juz';
    applyFilter();
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => setList(tab.dataset.list)));
  search.addEventListener('input', applyFilter);
  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const first = surahRows.find((item) => !item.hidden);
    if (first) window.location.href = first.querySelector('a').href;
  });

  // Surah text is fetched into the reader's on-device cache ahead of the click (on hover or touch,
  // and for "continue reading"), so the reader opens the surah without waiting. Same cache and URL as quran.js.
  const readsAyahMode = () => {
    try { return JSON.parse(localStorage.getItem('sedekahqr-quran-settings'))?.mode !== 'flip'; } catch { return true; }
  };
  const warmed = new Set();
  const prefetchSurah = async (number) => {
    if (!globalThis.caches || warmed.has(number) || navigator.connection?.saveData || !readsAyahMode()) return;
    warmed.add(number);
    try {
      const url = `https://api.alquran.cloud/v1/surah/${number}/editions/quran-uthmani,ms.basmeih`;
      const cache = await caches.open('sedekahqr-quran-text-v1');
      if (await cache.match(url)) return;
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    } catch {
      warmed.delete(number);
    }
  };
  ['pointerover', 'pointerdown', 'focusin'].forEach((type) => surahList.addEventListener(type, (event) => {
    const item = event.target.closest('li[data-number]');
    if (item) void prefetchSurah(Number(item.dataset.number));
  }, { passive: true }));

  // "Continue reading" returns to the last surah and ayah (or mushaf page) opened in the reader.
  try {
    const last = JSON.parse(localStorage.getItem(lastReadingKey));
    if (last?.type === 'surah' && surahs[last.value - 1]) {
      const idle = globalThis.requestIdleCallback || ((callback) => setTimeout(callback, 1500));
      idle(() => void prefetchSurah(last.value));
    }
    const link = document.querySelector('#continue-reading');
    if (last?.type === 'surah' && surahs[last.value - 1]) {
      const surah = surahs[last.value - 1];
      const ayah = Number(last.ayah) > 1 ? Number(last.ayah) : 0;
      link.href = `quran-reader.html?surah=${surah.number}${ayah ? `&ayah=${ayah}` : ''}`;
      document.querySelector('#continue-title').textContent = surah.name;
      document.querySelector('#continue-meta').textContent = ayah ? `Ayat ${ayah} daripada ${surah.ayahs}` : `${surah.ayahs} ayat`;
      link.hidden = false;
    } else if (last?.type === 'page' && last.value >= 1 && last.value <= 604) {
      link.href = `quran-reader.html?page=${last.value}${last.mode === 'flip' ? '&mode=flip' : ''}`;
      // Flip readers pick up on the page they left rather than page 1.
      if (last.mode === 'flip') document.querySelector('#flip-link').href = `quran-reader.html?page=${last.value}&mode=flip`;
      document.querySelector('#continue-title').textContent = `Halaman ${last.value}`;
      document.querySelector('#continue-meta').textContent = surahForPage(last.value).name;
      link.hidden = false;
    }
  } catch {}
})();
