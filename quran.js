(() => {
  const api = 'https://api.alquran.cloud/v1';
  const data = globalThis.SEDEKAHQR_QURAN;
  const lastReadingKey = 'sedekahqr-quran-last-reading';
  const settingsKey = 'sedekahqr-quran-settings';
  const $ = (selector) => document.querySelector(selector);
  const readerShell = $('.quran-reader');
  const content = $('.quran-content');
  const loading = $('#quran-loading');
  const reader = $('#surah-reader');
  const error = $('#quran-error');
  const ayahList = $('#ayah-list');
  const pageSelect = $('#page-select');
  const barTitle = $('#bar-title');
  const barMeta = $('#bar-meta');
  const settingsToggle = $('#settings-toggle');
  const settingsPanel = $('#reader-settings');
  const modeTabs = document.querySelectorAll('[data-reader-mode]');
  const modeToggle = $('#mode-toggle');
  const flipNavigation = $('#quran-flip-navigation');
  const flipPrevious = $('#flip-previous');
  const flipNext = $('#flip-next');
  const audioWrap = $('#surah-audio');
  const audio = $('#surah-audio-player');
  const audioToggle = $('#audio-toggle');
  const audioProgress = $('#audio-progress');
  const audioTime = $('#audio-time');
  if (!data || !readerShell) return;

  const surahs = data.surahs.map(([name, meaning, arabic, english, ayahs, madaniyah, startPage], index) => ({
    number: index + 1, name, meaning, arabic, english, ayahs, madaniyah, startPage,
  }));
  const surahForPage = (page) => surahs.reduce((found, surah) => (surah.startPage <= page ? surah : found), surahs[0]);
  let readerMode = 'ayah';
  let currentSurah = 0;
  let currentPage = 0;

  const loadSettings = () => {
    try { return { mode: 'ayah', scale: 1, translation: true, ...JSON.parse(localStorage.getItem(settingsKey)) }; } catch { return { mode: 'ayah', scale: 1, translation: true }; }
  };
  const settings = loadSettings();
  const saveSettings = () => {
    try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch {}
  };
  const saveReading = (reading) => {
    try { localStorage.setItem(lastReadingKey, JSON.stringify(reading)); } catch {}
  };
  // Quran text never changes, so every response is kept on the device: a surah opened once,
  // or fetched ahead of time, opens instantly afterwards. Requests already on their way are shared.
  const textCacheName = 'sedekahqr-quran-text-v1';
  const openTextCache = () => (globalThis.caches ? caches.open(textCacheName).catch(() => null) : Promise.resolve(null));
  const requests = new Map();
  const request = (path) => {
    const url = `${api}${path}`;
    if (!requests.has(url)) {
      requests.set(url, (async () => {
        const cache = await openTextCache();
        let response = await cache?.match(url).catch(() => null);
        if (!response) {
          response = await fetch(url);
          if (!response.ok) throw new Error('Quran API request failed');
          if (cache) cache.put(url, response.clone()).catch(() => {});
        }
        const payload = await response.json();
        if (!payload?.data) throw new Error('Invalid Quran API response');
        return payload.data;
      })().finally(() => requests.delete(url)));
    }
    return requests.get(url);
  };
  const surahPath = (number) => `/surah/${number}/editions/quran-uthmani,ms.basmeih`;
  // Fetch ahead only when the reader is not saving data.
  const warmed = new Set();
  const prefetchSurah = (number) => {
    if (number < 1 || number > 114 || warmed.has(number) || navigator.connection?.saveData) return;
    warmed.add(number);
    request(surahPath(number)).catch(() => warmed.delete(number));
  };
  const updateHistory = (params) => {
    const search = new URLSearchParams(params);
    if (readerMode === 'flip') search.set('mode', 'flip');
    history.replaceState(null, '', `quran-reader.html?${search}`);
  };
  const toArabicDigits = (value) => String(value).replace(/\d/g, (digit) => String.fromCharCode(0x0660 + Number(digit)));
  // Copied from the API text (1:1) so the order of the marks matches exactly.
  const bismillah = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
  // Al-Fatihah counts the bismillah as ayah 1 and At-Taubah has none; every other surah shows it as a separate line.
  const hasSeparateBismillah = (surahNumber) => surahNumber !== 1 && surahNumber !== 9;
  // The API prefixes ayah 1 with the bismillah (and 1:1 with a BOM), which made it appear twice.
  const ayahText = (ayah) => {
    const text = String(ayah.text || '').replace(/^﻿/, '').trim();
    if (ayah.numberInSurah !== 1 || !hasSeparateBismillah(ayah.surah?.number)) return text;
    const words = text.split(/\s+/);
    // Compare bare letters: At-Tin and Al-Qadr add a shaddah on the first letter.
    const bare = (word = '') => word.replace(/[ً-ٰٟۖ-ۭ]/g, '');
    return bare(words[0]) === 'بسم' && bare(words[1]) === 'ٱلله' ? words.slice(4).join(' ') : text;
  };
  const createArabicLine = (className, text) => {
    const line = document.createElement('p');
    line.className = className;
    line.lang = 'ar';
    line.dir = 'rtl';
    line.textContent = text;
    return line;
  };
  const ayahEnd = (number) => `${String.fromCharCode(0xFD3F)}${toArabicDigits(number)}${String.fromCharCode(0xFD3E)}`;

  // Shrink the mushaf text until the whole page fits its frame. Below a readable size the
  // page scrolls inside the frame instead, so no ayah is ever cut off.
  const minimumMushafFontSize = 15;
  const fitNow = (page) => {
    if (!page.isConnected) return;
    if (page.classList.contains('is-glyph')) {
      fitGlyphPage(page);
      return;
    }
    const bookElement = page.closest('.book');
    if (bookElement) bookElement.style.maxWidth = '';
    const texts = [...page.querySelectorAll('.mushaf-text')];
    if (!texts.length) return;
    page.classList.remove('is-scrollable');
    page.scrollTop = 0;
    texts.forEach((text) => { text.style.fontSize = ''; });
    // Layout offsets, not screen rectangles: a page may be mid-turn in 3D while it is measured.
    const overflows = () => {
      const last = texts.at(-1);
      return last.offsetTop + last.offsetHeight > page.clientHeight - Number.parseFloat(getComputedStyle(page).paddingBottom) + 1;
    };
    let fontSize = Number.parseFloat(getComputedStyle(texts[0]).fontSize);
    while (overflows() && fontSize > minimumMushafFontSize) {
      fontSize -= 0.5;
      texts.forEach((text) => { text.style.fontSize = `${fontSize}px`; });
    }
    page.classList.toggle('is-scrollable', overflows());
  };
  const fitMushafPage = (page) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => fitNow(page)));
    document.fonts?.ready.then(() => fitNow(page));
  };
  const buildMushafPage = (arabicAyahs) => {
    const mushafPage = document.createElement('section');
    mushafPage.className = 'mushaf-page';
    // A page can hold the end of one surah and the start of the next, so each new surah
    // gets its own heading and bismillah followed by a fresh text block.
    let mushafText = null;
    arabicAyahs.forEach((ayah) => {
      if (ayah.numberInSurah === 1) {
        if (ayah.surah?.name) mushafPage.append(createArabicLine('mushaf-surah-heading', ayah.surah.name));
        if (hasSeparateBismillah(ayah.surah?.number)) mushafPage.append(createArabicLine('mushaf-bismillah', bismillah));
        mushafText = null;
      }
      if (!mushafText) {
        mushafText = createArabicLine('mushaf-text', '');
        mushafPage.append(mushafText);
      }
      mushafText.append(`${ayahText(ayah)} ${ayahEnd(ayah.numberInSurah)} `);
    });
    return mushafPage;
  };

  // ---------- Madinah mushaf pages drawn with the KFGQPC page fonts, via Quran Foundation ----------
  // Every page has its own font whose glyphs are whole words, so the 15 lines match the printed
  // mushaf. Colour tajweed (COLRv1) where the browser supports it; Safari gets the black edition.
  const mushafApi = globalThis.SEDEKAHQR_MUSHAF_API
    || (globalThis.SEDEKAHQR_BLOG?.supabaseUrl ? `${globalThis.SEDEKAHQR_BLOG.supabaseUrl}/functions/v1/quran-page` : '');
  const tajweedFonts = Boolean(globalThis.CSS?.supports?.('font-tech(color-COLRv1)'));
  const pageFontUrl = (page) => `https://verses.quran.foundation/fonts/quran/hafs/${tajweedFonts ? 'v4/colrv1' : 'v2'}/woff2/p${page}.woff2`;
  const phoneLayout = window.matchMedia('(max-width: 640px)');
  const pageFonts = new Map();
  const loadPageFont = (page) => {
    if (!pageFonts.has(page)) {
      const face = new FontFace(`qpc-p${page}`, `url(${pageFontUrl(page)})`, { display: 'block' });
      pageFonts.set(page, face.load()
        .then((loaded) => { document.fonts.add(loaded); return loaded; })
        .catch((fontError) => { pageFonts.delete(page); throw fontError; }));
    }
    return pageFonts.get(page);
  };
  const juzForPage = (page) => data.juz.reduce((found, [start], index) => (start <= page ? index + 1 : found), 1);
  const glyphBlock = (className, text = '') => {
    const block = document.createElement('div');
    block.className = className;
    if (text) block.textContent = text;
    return block;
  };
  const buildGlyphPage = ({ page, layout }) => {
    const sheet = document.createElement('section');
    sheet.className = 'mushaf-page is-glyph';
    sheet.dataset.page = page;
    const running = glyphBlock('glyph-running');
    running.lang = 'ar';
    running.dir = 'rtl';
    running.append(glyphBlock('', `سُورَةُ ${surahs[(layout.surahs[0] || 1) - 1].arabic}`), glyphBlock('', `الجُزْءُ ${toArabicDigits(juzForPage(page))}`));
    const lines = glyphBlock(`glyph-lines${layout.centered ? ' is-centered' : ''}`);
    lines.dir = 'rtl';
    lines.style.fontFamily = `qpc-p${page}`;
    lines.setAttribute('role', 'img');
    lines.setAttribute('aria-label', `Halaman ${page} mushaf Al-Quran`);
    layout.lines.forEach((line) => {
      if (line.t === 'w') {
        const row = glyphBlock('glyph-line');
        line.w.forEach((code) => {
          const word = document.createElement('span');
          word.textContent = code;
          row.append(word);
        });
        lines.append(row);
      } else if (line.t === 'h') {
        // Surah header band: a medallion at each end around the name cartouche.
        const header = glyphBlock('glyph-header');
        header.append(
          glyphBlock('glyph-medallion'),
          createArabicLine('glyph-header-name', `سُورَةُ ${surahs[line.s - 1]?.arabic || ''}`),
          glyphBlock('glyph-medallion'),
        );
        lines.append(header);
      } else if (line.t === 'b') {
        lines.append(createArabicLine('glyph-bismillah', bismillah));
      } else {
        lines.append(glyphBlock('glyph-line is-empty'));
      }
    });
    // The patterned border band is the sheet itself; the text sits on a paper panel inside it.
    const panel = glyphBlock('glyph-panel');
    const folio = glyphBlock('glyph-folio');
    folio.append(glyphBlock('', toArabicDigits(page)));
    panel.append(running, lines, folio);
    sheet.append(panel);
    return sheet;
  };
  // One font size for the whole page: the widest line just fills the text block and every
  // row keeps its height. Short lines (such as a surah's last) are centred, as in print.
  const fitGlyphPage = (sheet) => {
    // Keep the proportions of a printed page on wide screens; on phones the page fills the width
    // and its patterned side bands sit under the page-turn buttons.
    const bookElement = sheet.closest('.book');
    if (bookElement) {
      const pages = bookElement.classList.contains('is-spread') ? 2 : 1;
      bookElement.style.maxWidth = phoneLayout.matches ? '' : `${Math.min(760 * pages, Math.round(bookElement.clientHeight * 0.64 * pages))}px`;
    }
    const container = sheet.querySelector('.glyph-lines');
    const rows = [...container.querySelectorAll('.glyph-line:not(.is-empty)')];
    if (!rows.length || !container.clientWidth) return;
    const probe = 100;
    container.style.fontSize = `${probe}px`;
    rows.forEach((row) => row.classList.add('is-measuring'));
    const widths = rows.map((row) => [...row.children].reduce((sum, word) => sum + word.offsetWidth, 0));
    rows.forEach((row) => row.classList.remove('is-measuring'));
    const rowHeight = container.clientHeight / (container.classList.contains('is-centered') ? 15 : container.children.length);
    const size = Math.min((container.clientWidth * 0.985 * probe) / Math.max(...widths), rowHeight / 1.55);
    container.style.fontSize = `${size.toFixed(2)}px`;
    rows.forEach((row, index) => row.classList.toggle('is-short', widths[index] * (size / probe) < container.clientWidth * 0.8));
  };
  const buildFlipPage = (pageInfo) => (pageInfo.kind === 'glyph' ? buildGlyphPage(pageInfo) : buildMushafPage(pageInfo.ayahs));
  const renderAyahs = (arabicAyahs, malayAyahs, isPageView = false) => {
    const translationByNumber = new Map((malayAyahs || []).map((ayah) => [ayah.number, ayah.text]));
    ayahList.replaceChildren();
    let previousSurah = null;
    arabicAyahs.forEach((ayah) => {
      if (isPageView && ayah.surah?.number !== previousSurah) {
        previousSurah = ayah.surah?.number;
        const separator = document.createElement('p');
        separator.className = 'quran-page-surah';
        const info = surahs[previousSurah - 1];
        separator.textContent = ayah.numberInSurah === 1 ? `Surah ${info?.name || ''}` : `${info?.name || ''} · Ayat ${ayah.numberInSurah}`;
        ayahList.append(separator);
      }
      if (ayah.numberInSurah === 1 && hasSeparateBismillah(ayah.surah?.number)) {
        ayahList.append(createArabicLine('ayah-bismillah', bismillah));
      }
      const block = document.createElement('section');
      block.className = 'ayah';
      block.dataset.ayah = ayah.numberInSurah;
      if (!isPageView) block.id = `ayah-${ayah.numberInSurah}`;
      const arabicText = createArabicLine('ayah-arabic', `${ayahText(ayah)} `);
      const end = document.createElement('span');
      end.className = 'ayah-end';
      end.textContent = ayahEnd(ayah.numberInSurah);
      arabicText.append(end);
      const translation = document.createElement('p');
      translation.className = 'ayah-translation';
      const number = document.createElement('span');
      number.className = 'ayah-no';
      number.textContent = ayah.numberInSurah;
      translation.append(number, translationByNumber.get(ayah.number) || '');
      block.append(arabicText, translation);
      ayahList.append(block);
    });
  };

  const showLoading = () => {
    loading.hidden = false;
    reader.hidden = true;
    error.hidden = true;
  };
  const showReader = () => {
    loading.hidden = true;
    error.hidden = true;
    reader.hidden = false;
  };
  const showError = () => {
    loading.hidden = true;
    reader.hidden = true;
    error.hidden = false;
  };
  // A thin line under the bar while the next surah or page is on its way; the current text stays.
  // It only appears if the wait is noticeable, so cached pages never flash it.
  let busyTimer = 0;
  const setBusy = (busy) => {
    clearTimeout(busyTimer);
    if (busy) busyTimer = setTimeout(() => document.body.classList.add('quran-busy'), 150);
    else document.body.classList.remove('quran-busy');
  };

  // A small custom player: one button, a progress line and the time.
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return '0:00';
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };
  const setPlaying = (playing) => {
    // SVG elements have no hidden property, so toggle the attribute.
    audioToggle.querySelector('.icon-play').toggleAttribute('hidden', playing);
    audioToggle.querySelector('.icon-pause').toggleAttribute('hidden', !playing);
    audioToggle.setAttribute('aria-label', playing ? 'Jeda bacaan' : 'Main bacaan');
  };
  const resetAudio = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audioProgress.value = 0;
    audioTime.textContent = '0:00';
    setPlaying(false);
  };
  audioToggle.addEventListener('click', () => {
    if (!audio.src) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  });
  audio.addEventListener('play', () => setPlaying(true));
  audio.addEventListener('pause', () => setPlaying(false));
  audio.addEventListener('ended', () => setPlaying(false));
  audio.addEventListener('loadedmetadata', () => { audioTime.textContent = formatTime(audio.duration); });
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    audioProgress.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
    audioTime.textContent = formatTime(audio.currentTime);
  });
  audioProgress.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (Number(audioProgress.value) / 1000) * audio.duration;
  });

  const setSurahNav = (surah) => {
    const previous = surahs[surah.number - 2];
    const next = surahs[surah.number];
    [[$('#previous-surah'), previous], [$('#next-surah'), next]].forEach(([link, target]) => {
      link.hidden = !target;
      if (!target) return;
      link.href = `quran-reader.html?surah=${target.number}`;
      link.dataset.surah = target.number;
      link.querySelector('strong').textContent = `${target.number}. ${target.name}`;
    });
  };
  // Previous/next surah open in place (already fetched ahead) instead of reloading the page.
  $('#surah-nav').addEventListener('click', (event) => {
    const link = event.target.closest('a[data-surah]');
    if (!link || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void loadSurah(Number(link.dataset.surah));
  });

  const setSurahHead = (surah) => {
    $('#surah-arabic-name').textContent = `سُورَةُ ${surah.arabic}`;
    $('#surah-title').textContent = surah.name;
    $('#surah-meta').textContent = [surah.meaning !== surah.name ? surah.meaning : '', surah.madaniyah ? 'Madaniyah' : 'Makkiyah', `${surah.ayahs} ayat`].filter(Boolean).join(' · ');
  };
  // Placeholder lines shaped like ayahs, shown only on the very first load of the reader.
  const showSkeleton = () => {
    ayahList.replaceChildren(...Array.from({ length: 4 }, () => {
      const block = document.createElement('div');
      block.className = 'ayah-skeleton';
      block.setAttribute('aria-hidden', 'true');
      block.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
      return block;
    }));
  };
  let surahLoad = 0;
  const loadSurah = async (number, scrollToAyah = 0) => {
    const surah = surahs[number - 1];
    if (!surah) return;
    currentSurah = surah.number;
    if (readerMode === 'flip') {
      void loadPage(surah.startPage, 0, surah.number);
      return;
    }
    const load = ++surahLoad;
    currentPage = 0;
    barTitle.textContent = surah.name;
    barMeta.textContent = `${surah.ayahs} ayat`;
    document.title = `${surah.name} - Al-Quran - SedekahQR`;
    resetAudio();
    // Everything known without the network is shown at once. A surah already on the device
    // renders straight away; otherwise the current text stays until the new one arrives.
    const firstLoad = reader.hidden || !ayahList.querySelector('.ayah');
    let skeletonTimer = 0;
    if (firstLoad) {
      setSurahHead(surah);
      setSurahNav(surah);
      audioWrap.hidden = true;
      ayahList.replaceChildren();
      skeletonTimer = setTimeout(showSkeleton, 120);
      showReader();
    } else setBusy(true);
    try {
      const editions = await request(surahPath(surah.number));
      clearTimeout(skeletonTimer);
      // A newer choice (another surah, a page, or Flip) wins over a surah that arrives late.
      if (load !== surahLoad || currentPage || readerMode === 'flip') return;
      const arabic = editions.find((edition) => edition.identifier === 'quran-uthmani') || editions[0];
      const malay = editions.find((edition) => edition.identifier === 'ms.basmeih') || editions[1];
      // Surah responses omit the per-ayah surah object that page responses include.
      const ayahs = arabic.ayahs.map((ayah) => ({ ...ayah, surah: { number: arabic.number, name: arabic.name } }));
      setSurahHead(surah);
      audioWrap.hidden = false;
      audio.src = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surah.number}.mp3`;
      setSurahNav(surah);
      renderAyahs(ayahs, malay?.ayahs);
      setBusy(false);
      showReader();
      updateHistory({ surah: surah.number });
      prefetchSurah(surah.number + 1);
      prefetchSurah(surah.number - 1);
      saveReading({ type: 'surah', value: surah.number, ayah: scrollToAyah || 1 });
      const target = scrollToAyah > 1 ? document.getElementById(`ayah-${scrollToAyah}`) : null;
      if (target) {
        target.scrollIntoView({ block: 'start' });
        // The Arabic web font can shift the layout once it arrives, so settle on the ayah again.
        document.fonts?.ready.then(() => target.scrollIntoView({ block: 'start' }));
      } else window.scrollTo({ top: 0 });
    } catch {
      clearTimeout(skeletonTimer);
      if (load !== surahLoad || currentPage || readerMode === 'flip') return;
      setBusy(false);
      showError();
    }
  };

  // Wider screens show an open mushaf: the odd page on the right and the even page on the left,
  // read right to left, so the next spread comes by turning the left page over to the right.
  // Phones show one page at a time.
  const isSpread = () => readerMode === 'flip' && !phoneLayout.matches;
  const spreadStart = (page) => (page % 2 ? page : page - 1);
  const pageStep = () => (isSpread() ? 2 : 1);
  const lastStart = () => (isSpread() ? 603 : 604);
  const updateFlipNavigation = () => {
    const isFlip = readerMode === 'flip';
    flipNavigation.hidden = !isFlip;
    // In an open mushaf the next spread lies to the left, so the left button goes forward.
    const [forward, back] = isSpread() ? [flipPrevious, flipNext] : [flipNext, flipPrevious];
    forward.disabled = currentPage >= lastStart();
    back.disabled = currentPage <= 1;
    [[forward, 'Halaman seterusnya'], [back, 'Halaman sebelumnya']].forEach(([button, label]) => {
      button.setAttribute('aria-label', label);
      button.title = label;
    });
  };
  const pagesLabel = (page) => (isSpread() ? `Halaman ${page}–${page + 1}` : `Halaman ${page}`);
  // Name the surah being read: the one asked for, else the page's first surah.
  const nameSurahOnPage = (pageSurahs, surahHint) => {
    currentSurah = pageSurahs.includes(surahHint) ? surahHint : pageSurahs[0];
    barTitle.textContent = surahs[currentSurah - 1]?.name || 'Al-Quran';
  };

  // ---------- Flip book: pages turn like paper leaves, by button, key or drag ----------
  const pageData = new Map();
  const pageRequests = new Map();
  let glyphFailures = 0;
  const fetchGlyphPage = async (page) => {
    // The page layout and its font come from different servers, so both are fetched together.
    const font = loadPageFont(page);
    font.catch(() => {});
    const response = await fetch(`${mushafApi}?page=${page}`);
    if (!response.ok) throw new Error('Mushaf page request failed');
    const layout = await response.json();
    if (!Array.isArray(layout?.lines)) throw new Error('Invalid mushaf page');
    await font;
    return { kind: 'glyph', page, layout, surahs: layout.surahs };
  };
  const fetchTextPage = (page) => request(`/page/${page}/quran-uthmani`).then((result) => ({
    kind: 'text', page, ayahs: result.ayahs, surahs: [...new Set(result.ayahs.map((ayah) => ayah.surah?.number))],
  }));
  // The printed-mushaf page first; if the mushaf service or its font is unavailable, the
  // Amiri text page instead. After two failures in a row this visit stays on text pages.
  const fetchPage = (page) => {
    if (pageData.has(page)) return Promise.resolve(pageData.get(page));
    if (!pageRequests.has(page)) {
      const pending = mushafApi && glyphFailures < 2
        ? fetchGlyphPage(page).then((result) => { glyphFailures = 0; return result; }, () => { glyphFailures += 1; return fetchTextPage(page); })
        : fetchTextPage(page);
      pageRequests.set(page, pending
        .then((result) => { pageData.set(page, result); return result; })
        .finally(() => pageRequests.delete(page)));
    }
    return pageRequests.get(page);
  };
  // What the book shows at a position: one page on phones, or a right/left pair when open.
  const spreadView = (page, right, left) => ({ page, right, left, surahs: [...right.surahs, ...left.surahs] });
  const fetchView = (page) => (isSpread()
    ? Promise.all([fetchPage(page), fetchPage(page + 1)]).then(([right, left]) => spreadView(page, right, left))
    : fetchPage(page));
  const viewReady = (page) => pageData.has(page) && (!isSpread() || pageData.has(page + 1));
  const cachedView = (page) => (isSpread() ? spreadView(page, pageData.get(page), pageData.get(page + 1)) : pageData.get(page));
  // Neighbouring pages are fetched ahead so a turn or drag can start instantly.
  const prefetchAround = (page) => (isSpread() ? [page + 2, page + 3, page - 2, page - 1] : [page + 1, page - 1]).forEach((neighbour) => {
    if (neighbour >= 1 && neighbour <= 604) fetchPage(neighbour).catch(() => {});
  });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let book = null;
  let turn = null;

  // Pages lying in the open book sit in the right or left half; pages on a turning leaf fill it.
  const placePage = (pageElement, side) => {
    pageElement.classList.remove('at-right', 'at-left');
    if (side) pageElement.classList.add(`at-${side}`);
    return pageElement;
  };
  const showBookPage = (view) => {
    book = document.createElement('div');
    book.className = view.right ? 'book is-spread' : 'book';
    const pages = view.right
      ? [placePage(buildFlipPage(view.right), 'right'), placePage(buildFlipPage(view.left), 'left')]
      : [buildFlipPage(view)];
    pages.forEach((page) => page.classList.add('is-current'));
    book.append(...pages);
    ayahList.replaceChildren(book);
    pages.forEach(fitMushafPage);
  };
  const setLeafAngle = (leafTurn, angle) => {
    leafTurn.angle = angle;
    leafTurn.leaf.style.transform = `rotateY(${angle}deg)`;
    // 0 while the leaf lies flat, 1 when it stands upright: drives the shading and cast shadow.
    book.style.setProperty('--lift', Math.sin((Math.abs(angle) / 180) * Math.PI).toFixed(3));
  };
  // One page: the leaf turns on the page's left edge, the spine: 0deg lies on the book, -180deg has turned over.
  const beginPageTurn = (step, pageInfo) => {
    const current = book.querySelector('.mushaf-page.is-current');
    const incoming = buildFlipPage(pageInfo);
    const leaf = document.createElement('div');
    leaf.className = 'book-leaf';
    const front = document.createElement('div');
    front.className = 'book-face book-front';
    const back = document.createElement('div');
    back.className = 'book-face book-back';
    leaf.append(front, back);
    if (step > 0) {
      // Next: the current page lifts from its right edge and turns over, uncovering the next page.
      book.insertBefore(incoming, current);
      front.append(current);
    } else {
      // Previous: the earlier page swings back from the left and settles on top.
      front.append(incoming);
    }
    book.append(leaf);
    fitNow(incoming);
    book.classList.add('is-turning');
    const leafTurn = { step, leaf, current, incoming, from: step > 0 ? 0 : -180, to: step > 0 ? -180 : 0, angle: 0 };
    setLeafAngle(leafTurn, leafTurn.from);
    return leafTurn;
  };
  // Open mushaf: a leaf turns on the spine in the middle. Next lifts the left page and lays it
  // on the right (0 to 180deg), its back being the new right page, with the new left page beneath.
  // Previous lifts the right page over to the left (0 to -180deg).
  const beginSpreadTurn = (step, view) => {
    const currentRight = book.querySelector(':scope > .mushaf-page.at-right');
    const currentLeft = book.querySelector(':scope > .mushaf-page.at-left');
    const incomingRight = placePage(buildFlipPage(view.right), 'right');
    const incomingLeft = placePage(buildFlipPage(view.left), 'left');
    const leaf = document.createElement('div');
    leaf.className = `book-leaf at-${step > 0 ? 'left' : 'right'}`;
    const front = document.createElement('div');
    front.className = 'book-face book-front';
    const back = document.createElement('div');
    back.className = 'book-face book-back';
    leaf.append(front, back);
    if (step > 0) {
      book.prepend(incomingLeft);
      front.append(placePage(currentLeft, null));
      back.append(placePage(incomingRight, null));
    } else {
      book.prepend(incomingRight);
      front.append(placePage(currentRight, null));
      back.append(placePage(incomingLeft, null));
    }
    book.append(leaf);
    fitNow(incomingRight);
    fitNow(incomingLeft);
    book.classList.add('is-turning');
    const leafTurn = { spread: true, step, leaf, currentRight, currentLeft, incomingRight, incomingLeft, from: 0, to: step > 0 ? 180 : -180, angle: 0 };
    setLeafAngle(leafTurn, 0);
    return leafTurn;
  };
  const endSpreadTurn = (leafTurn, completed) => {
    const { step, leaf, currentRight, currentLeft, incomingRight, incomingLeft } = leafTurn;
    if (completed) {
      currentRight.remove();
      currentLeft.remove();
      // The page on the back of the leaf now lies flat on the other side.
      book.append(step > 0 ? placePage(incomingRight, 'right') : placePage(incomingLeft, 'left'));
      incomingRight.classList.add('is-current');
      incomingLeft.classList.add('is-current');
    } else {
      book.append(step > 0 ? placePage(currentLeft, 'left') : placePage(currentRight, 'right'));
      incomingRight.remove();
      incomingLeft.remove();
    }
    leaf.remove();
    book.classList.remove('is-turning');
    book.style.removeProperty('--lift');
    (completed ? [incomingRight, incomingLeft] : [currentRight, currentLeft]).forEach(fitMushafPage);
  };
  const beginTurn = (step, view) => (view.right ? beginSpreadTurn(step, view) : beginPageTurn(step, view));
  const endTurn = (leafTurn, completed) => (leafTurn.spread ? endSpreadTurn(leafTurn, completed) : endPageTurn(leafTurn, completed));
  const endPageTurn = (leafTurn, completed) => {
    const { step, leaf, current, incoming } = leafTurn;
    if (step > 0 && !completed) book.append(current);
    if (step < 0 && completed) {
      book.append(incoming);
      current.remove();
    }
    if (completed) {
      current.classList.remove('is-current');
      incoming.classList.add('is-current');
    } else if (step > 0) {
      incoming.remove();
    }
    leaf.remove();
    book.classList.remove('is-turning');
    book.style.removeProperty('--lift');
    fitMushafPage(completed ? incoming : current);
  };
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2);
  const easeOut = (k) => 1 - ((1 - k) ** 3);
  const animateLeaf = (leafTurn, target, fullDuration, easing) => new Promise((resolve) => {
    const start = leafTurn.angle;
    const duration = Math.max(1, fullDuration * (Math.abs(target - start) / 180));
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      setLeafAngle(leafTurn, start + (target - start) * easing(progress));
      if (progress < 1) window.requestAnimationFrame(tick);
      else resolve();
    };
    window.requestAnimationFrame(tick);
  });
  const commitFlipPage = (page, pageInfo, surahHint = 0) => {
    currentPage = page;
    pageSelect.value = String(page);
    updateFlipNavigation();
    nameSurahOnPage(pageInfo.surahs, surahHint);
    barMeta.textContent = `${pagesLabel(page)} / 604`;
    document.title = `${pagesLabel(page)} - Al-Quran - SedekahQR`;
    saveReading({ type: 'page', value: page, mode: 'flip' });
    updateHistory({ page });
    prefetchAround(page);
  };
  const loadFlipPage = async (requested, direction, surahHint) => {
    if (turn) return;
    // An open book always starts a spread on its odd, right-hand page.
    const page = isSpread() ? spreadStart(requested) : requested;
    const sameLayout = book?.isConnected && book.classList.contains('is-spread') === isSpread();
    const animate = Boolean(direction) && sameLayout && Math.abs(page - currentPage) === pageStep() && !reduceMotion.matches;
    audioWrap.hidden = true;
    if (!animate) {
      currentPage = page;
      pageSelect.value = String(page);
      updateFlipNavigation();
      barMeta.textContent = `${pagesLabel(page)} / 604`;
      if (!book?.isConnected) showLoading();
      else setBusy(true);
    }
    try {
      const pageInfo = await fetchView(page);
      setBusy(false);
      if (animate) {
        if (turn) return;
        turn = beginTurn(direction, pageInfo);
        await animateLeaf(turn, turn.to, 760, easeInOut);
        endTurn(turn, true);
        turn = null;
      } else {
        if (currentPage !== page) return;
        showBookPage(pageInfo);
        showReader();
      }
      commitFlipPage(page, pageInfo, surahHint);
    } catch {
      turn = null;
      setBusy(false);
      showError();
    }
  };

  const loadPage = async (page, direction = 0, surahHint = 0) => {
    const selectedPage = Number(page);
    if (!selectedPage || selectedPage < 1 || selectedPage > 604) return;
    resetAudio();
    if (readerMode === 'flip') {
      await loadFlipPage(selectedPage, direction, surahHint);
      return;
    }
    currentPage = selectedPage;
    pageSelect.value = String(selectedPage);
    updateFlipNavigation();
    barTitle.textContent = (surahs[surahHint - 1] || surahForPage(selectedPage)).name;
    barMeta.textContent = `Halaman ${selectedPage} / 604`;
    if (!reader.hidden && ayahList.querySelector('.ayah')) setBusy(true);
    else showLoading();
    try {
      const [arabicPage, malayPage] = await Promise.all([
        request(`/page/${selectedPage}/quran-uthmani`),
        request(`/page/${selectedPage}/ms.basmeih`),
      ]);
      if (currentPage !== selectedPage || readerMode === 'flip') return;
      setBusy(false);
      nameSurahOnPage(arabicPage.ayahs.map((ayah) => ayah.surah?.number), surahHint);
      document.title = `Halaman ${selectedPage} - Al-Quran - SedekahQR`;
      audioWrap.hidden = true;
      renderAyahs(arabicPage.ayahs, malayPage.ayahs, true);
      showReader();
      window.scrollTo({ top: 0 });
      saveReading({ type: 'page', value: selectedPage, mode: 'ayah' });
      updateHistory({ page: selectedPage });
    } catch {
      setBusy(false);
      showError();
    }
  };

  // Settings: reading mode, Arabic size and translation, remembered on this device.
  const scales = [0.85, 1, 1.15, 1.3, 1.5];
  const applyAppearance = () => {
    readerShell.style.setProperty('--arabic-scale', settings.scale);
    readerShell.classList.toggle('hide-translation', !settings.translation);
    $('#font-size-label').textContent = `${Math.round(settings.scale * 100)}%`;
    $('#font-smaller').disabled = settings.scale <= scales[0];
    $('#font-larger').disabled = settings.scale >= scales.at(-1);
    $('#translation-toggle').checked = settings.translation;
    const isFlip = readerMode === 'flip';
    $('#font-setting').classList.toggle('is-disabled', isFlip);
    $('#translation-setting').classList.toggle('is-disabled', isFlip);
  };
  const setReaderMode = (mode, { load = true } = {}) => {
    readerMode = mode === 'flip' ? 'flip' : 'ayah';
    const isFlip = readerMode === 'flip';
    readerShell.classList.toggle('is-flip-mode', isFlip);
    document.body.classList.toggle('quran-flip-active', isFlip);
    modeTabs.forEach((tab) => {
      const active = tab.dataset.readerMode === readerMode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    // The bar button always offers the other mode.
    modeToggle.querySelector('.icon-flip').toggleAttribute('hidden', isFlip);
    modeToggle.querySelector('.icon-ayah').toggleAttribute('hidden', !isFlip);
    $('#mode-toggle-label').textContent = isFlip ? 'Ayat' : 'Flip';
    modeToggle.setAttribute('aria-label', isFlip ? 'Tukar ke paparan ayat dan terjemahan' : 'Tukar ke paparan Flip mushaf');
    updateFlipNavigation();
    applyAppearance();
    if (!load) return;
    if (isFlip) void loadPage(currentPage || surahs[currentSurah - 1]?.startPage || 1, 0, currentSurah);
    else if (currentPage && !currentSurah) void loadPage(currentPage);
    else void loadSurah(currentSurah || 1);
  };
  const closeSettings = () => {
    settingsPanel.hidden = true;
    settingsToggle.setAttribute('aria-expanded', 'false');
  };
  settingsToggle.addEventListener('click', () => {
    const open = settingsPanel.hidden;
    closeSurahPicker();
    settingsPanel.hidden = !open;
    settingsToggle.setAttribute('aria-expanded', String(open));
  });

  // Surah picker: the surah name in the bar opens a searchable list of all 114 surahs.
  const pickerToggle = $('#surah-picker-toggle');
  const picker = $('#surah-picker');
  const pickerSearch = $('#surah-picker-search');
  const pickerList = $('#surah-picker-list');
  // Letters only, so "yasin", "Ya-Sin" and "Yaseen" all match; Arabic loses its harakat.
  const normalizeSearch = (text) => String(text).toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭ]/g, '')
    .replace(/[^a-z0-9؀-ۿ]/g, '');
  const pickerItems = surahs.map((surah) => {
    const item = document.createElement('li');
    const choose = document.createElement('button');
    choose.type = 'button';
    choose.className = 'qr-picker-item';
    choose.dataset.surah = surah.number;
    const number = document.createElement('span');
    number.className = 'qr-picker-number';
    number.textContent = surah.number;
    const name = document.createElement('span');
    name.className = 'qr-picker-name';
    const title = document.createElement('strong');
    title.textContent = surah.name;
    const detail = document.createElement('small');
    detail.textContent = `${surah.meaning !== surah.name ? `${surah.meaning} · ` : ''}${surah.ayahs} ayat`;
    name.append(title, detail);
    choose.append(number, name, createArabicLine('qr-picker-arabic', surah.arabic));
    item.append(choose);
    item.dataset.search = normalizeSearch(`${surah.name} ${surah.english} ${surah.meaning} ${surah.arabic}`);
    return item;
  });
  pickerList.append(...pickerItems);
  const filterPicker = () => {
    const raw = pickerSearch.value.trim();
    const query = normalizeSearch(raw);
    let shown = 0;
    pickerItems.forEach((item, index) => {
      const match = !query || (/^\d+$/.test(raw) ? String(index + 1) === raw : item.dataset.search.includes(query));
      item.hidden = !match;
      if (match) shown += 1;
    });
    $('#surah-picker-empty').hidden = shown > 0;
  };
  function closeSurahPicker() {
    picker.hidden = true;
    pickerToggle.setAttribute('aria-expanded', 'false');
  }
  const openSurahPicker = () => {
    closeSettings();
    picker.hidden = false;
    pickerToggle.setAttribute('aria-expanded', 'true');
    pickerSearch.value = '';
    filterPicker();
    pickerItems.forEach((item, index) => item.firstChild.classList.toggle('is-current', index + 1 === currentSurah));
    const currentItem = pickerItems[currentSurah - 1];
    if (currentItem) pickerList.scrollTop = currentItem.offsetTop - pickerList.clientHeight / 2 + currentItem.offsetHeight / 2;
    // Focus the search box only with a keyboard or mouse; on phones it would pop the keyboard over the list.
    if (!phoneLayout.matches) pickerSearch.focus();
  };
  pickerToggle.addEventListener('click', () => (picker.hidden ? openSurahPicker() : closeSurahPicker()));
  pickerSearch.addEventListener('input', filterPicker);
  pickerSearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    pickerItems.find((item) => !item.hidden)?.firstChild.click();
  });
  // Start fetching as soon as a finger or pointer rests on a surah, before the click lands.
  const warmSurah = (number) => {
    if (readerMode === 'flip') fetchPage(surahs[number - 1].startPage).catch(() => {});
    else prefetchSurah(number);
  };
  ['pointerdown', 'pointerover'].forEach((type) => pickerList.addEventListener(type, (event) => {
    const choice = event.target.closest('.qr-picker-item');
    if (choice) warmSurah(Number(choice.dataset.surah));
  }, { passive: true }));
  pickerList.addEventListener('click', (event) => {
    const choice = event.target.closest('.qr-picker-item');
    if (!choice) return;
    const number = Number(choice.dataset.surah);
    closeSurahPicker();
    currentPage = 0;
    void loadSurah(number);
  });

  document.addEventListener('click', (event) => {
    if (!settingsPanel.hidden && !event.target.closest('#reader-settings, #settings-toggle')) closeSettings();
    if (!picker.hidden && !event.target.closest('#surah-picker, #surah-picker-toggle')) closeSurahPicker();
  });
  const switchMode = (mode) => {
    if (mode === readerMode) return;
    settings.mode = mode;
    saveSettings();
    closeSettings();
    setReaderMode(mode);
  };
  modeTabs.forEach((tab) => tab.addEventListener('click', () => switchMode(tab.dataset.readerMode)));
  modeToggle.addEventListener('click', () => switchMode(readerMode === 'flip' ? 'ayah' : 'flip'));
  const stepScale = (step) => {
    const index = Math.max(0, Math.min(scales.length - 1, scales.indexOf(settings.scale) + step));
    settings.scale = scales[index];
    saveSettings();
    applyAppearance();
  };
  $('#font-smaller').addEventListener('click', () => stepScale(-1));
  $('#font-larger').addEventListener('click', () => stepScale(1));
  $('#translation-toggle').addEventListener('change', (event) => {
    settings.translation = event.target.checked;
    saveSettings();
    applyAppearance();
  });
  for (let page = 1; page <= 604; page += 1) pageSelect.add(new Option(`Halaman ${page}`, page));
  pageSelect.addEventListener('change', () => {
    if (!pageSelect.value) return;
    currentSurah = 0;
    closeSettings();
    void loadPage(pageSelect.value);
  });

  // Remember the ayah being read so "Sambung bacaan" can return to it.
  let scrollFrame = 0;
  window.addEventListener('scroll', () => {
    if (readerMode !== 'ayah' || currentPage || !currentSurah || scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      const barBottom = $('.qr-bar').getBoundingClientRect().bottom;
      const visible = [...ayahList.querySelectorAll('.ayah')].find((block) => block.getBoundingClientRect().bottom > barBottom + 24);
      if (visible) saveReading({ type: 'surah', value: currentSurah, ayah: Number(visible.dataset.ayah) });
    });
  }, { passive: true });

  // One page (phones): → and a swipe to the left go forward; ← and a swipe to the right go back.
  // Open mushaf: the other way round, since the next spread lies to the left.
  const forwardSign = () => (isSpread() ? -1 : 1);
  const turnPage = (step) => {
    if (readerMode !== 'flip') return;
    const target = currentPage + step * pageStep();
    if (target >= 1 && target <= lastStart()) void loadPage(target, step);
  };
  flipPrevious.addEventListener('click', () => turnPage(-forwardSign()));
  flipNext.addEventListener('click', () => turnPage(forwardSign()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSettings();
      closeSurahPicker();
    }
    if (readerMode !== 'flip' || event.target.closest?.('select, input, textarea')) return;
    if (event.key === 'ArrowRight') turnPage(forwardSign());
    else if (event.key === 'ArrowLeft') turnPage(-forwardSign());
  });
  // Drag a page with a finger or mouse: the leaf follows the hand, and letting go past about
  // a third of the way (or with a quick flick) completes the turn; otherwise it falls back.
  let drag = null;
  content.addEventListener('pointerdown', (event) => {
    if (readerMode !== 'flip' || turn || !book?.isConnected || event.button > 0) return;
    if (event.target.closest('.quran-flip-button')) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), active: false, progress: 0 };
  });
  content.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(deltaX) < 10 || Math.abs(deltaX) < Math.abs(deltaY)) {
        if (Math.abs(deltaY) > 14) drag = null;
        return;
      }
      // One page turns forward with a drag to the left; an open mushaf with a drag to the right.
      const step = (deltaX < 0) === !isSpread() ? 1 : -1;
      const target = currentPage + step * pageStep();
      if (target < 1 || target > lastStart() || turn) {
        drag = null;
        return;
      }
      if (!viewReady(target)) {
        // Not fetched yet: fall back to a normal turn when the finger lifts.
        drag.pendingStep = step;
        fetchView(target).catch(() => {});
        return;
      }
      drag.active = true;
      drag.step = step;
      drag.target = target;
      drag.span = isSpread() ? book.clientWidth / 2 : book.clientWidth;
      try { content.setPointerCapture(event.pointerId); } catch {}
      turn = beginTurn(step, cachedView(target));
    }
    // How far the hand has moved in the direction this leaf travels.
    const along = (drag.step > 0) === isSpread() ? deltaX : -deltaX;
    drag.progress = Math.max(0, Math.min(1, along / drag.span));
    setLeafAngle(turn, turn.from + (turn.to - turn.from) * drag.progress);
  });
  const releaseDrag = async (event, cancelled = false) => {
    if (!drag || event.pointerId !== drag.id) return;
    const released = drag;
    drag = null;
    if (!released.active) {
      if (released.pendingStep && !cancelled && Math.abs(event.clientX - released.x) > 50) turnPage(released.pendingStep);
      return;
    }
    const speed = Math.abs(event.clientX - released.x) / Math.max(1, performance.now() - released.time);
    const completed = !cancelled && (released.progress > 0.33 || (speed > 0.6 && released.progress > 0.06));
    const leafTurn = turn;
    await animateLeaf(leafTurn, completed ? leafTurn.to : leafTurn.from, 560, easeOut);
    endTurn(leafTurn, completed);
    turn = null;
    if (completed) commitFlipPage(released.target, cachedView(released.target));
  };
  content.addEventListener('pointerup', (event) => { void releaseDrag(event); });
  content.addEventListener('pointercancel', (event) => { void releaseDrag(event, true); });
  window.addEventListener('resize', () => {
    if (!book?.isConnected || turn) return;
    book.querySelectorAll('.mushaf-page.is-current').forEach(fitMushafPage);
  });
  // Rotating a tablet or resizing a window across the phone width switches between one page
  // and the open mushaf, staying on the same place.
  phoneLayout.addEventListener('change', () => {
    if (readerMode !== 'flip' || !book?.isConnected || turn) return;
    updateFlipNavigation();
    void loadFlipPage(currentPage, 0, currentSurah);
  });

  // The bar sits under the site's sticky header, whose height differs between phone and desktop.
  const header = document.querySelector('.directory-header');
  const syncHeaderHeight = () => document.documentElement.style.setProperty('--site-header-height', `${header?.offsetHeight || 0}px`);
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight);

  const start = () => {
    const params = new URLSearchParams(location.search);
    const page = Number(params.get('page'));
    const surah = Number(params.get('surah'));
    const ayah = Number(params.get('ayah'));
    const mode = params.get('mode') || settings.mode;
    if (!(page >= 1 && page <= 604) && !(surah >= 1 && surah <= 114)) {
      location.replace('quran.html');
      return;
    }
    setReaderMode(mode, { load: false });
    if (page >= 1 && page <= 604) void loadPage(page);
    else if (readerMode === 'flip') void loadPage(surahs[surah - 1].startPage, 0, surah);
    else void loadSurah(surah, ayah);
  };
  $('#retry-quran').addEventListener('click', start);
  start();
})();
