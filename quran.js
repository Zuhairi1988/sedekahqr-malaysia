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
  const request = async (path) => {
    const response = await fetch(`${api}${path}`);
    if (!response.ok) throw new Error('Quran API request failed');
    const payload = await response.json();
    if (!payload?.data) throw new Error('Invalid Quran API response');
    return payload.data;
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
    reader.hidden = false;
  };
  const showError = () => {
    loading.hidden = true;
    reader.hidden = true;
    error.hidden = false;
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
      link.querySelector('strong').textContent = `${target.number}. ${target.name}`;
    });
  };

  const loadSurah = async (number, scrollToAyah = 0) => {
    const surah = surahs[number - 1];
    if (!surah) return;
    currentSurah = surah.number;
    if (readerMode === 'flip') {
      void loadPage(surah.startPage, 0, surah.number);
      return;
    }
    currentPage = 0;
    barTitle.textContent = surah.name;
    barMeta.textContent = `${surah.ayahs} ayat`;
    document.title = `${surah.name} - Al-Quran - SedekahQR`;
    showLoading();
    resetAudio();
    try {
      const editions = await request(`/surah/${surah.number}/editions/quran-uthmani,ms.basmeih`);
      const arabic = editions.find((edition) => edition.identifier === 'quran-uthmani') || editions[0];
      const malay = editions.find((edition) => edition.identifier === 'ms.basmeih') || editions[1];
      // Surah responses omit the per-ayah surah object that page responses include.
      const ayahs = arabic.ayahs.map((ayah) => ({ ...ayah, surah: { number: arabic.number, name: arabic.name } }));
      $('#surah-arabic-name').textContent = arabic.name;
      $('#surah-title').textContent = surah.name;
      $('#surah-meta').textContent = [surah.meaning !== surah.name ? surah.meaning : '', surah.madaniyah ? 'Madaniyah' : 'Makkiyah', `${surah.ayahs} ayat`].filter(Boolean).join(' · ');
      audioWrap.hidden = false;
      audio.src = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${surah.number}.mp3`;
      setSurahNav(surah);
      renderAyahs(ayahs, malay?.ayahs);
      showReader();
      updateHistory({ surah: surah.number });
      saveReading({ type: 'surah', value: surah.number, ayah: scrollToAyah || 1 });
      const target = scrollToAyah > 1 ? document.getElementById(`ayah-${scrollToAyah}`) : null;
      if (target) {
        target.scrollIntoView({ block: 'start' });
        // The Arabic web font can shift the layout once it arrives, so settle on the ayah again.
        document.fonts?.ready.then(() => target.scrollIntoView({ block: 'start' }));
      } else window.scrollTo({ top: 0 });
    } catch { showError(); }
  };

  const updateFlipNavigation = () => {
    const isFlip = readerMode === 'flip';
    flipNavigation.hidden = !isFlip;
    flipPrevious.disabled = currentPage <= 1;
    flipNext.disabled = currentPage >= 604;
  };
  // Name the surah being read: the one asked for, else the page's first surah.
  const nameSurahOnPage = (ayahs, surahHint) => {
    const pageSurahs = ayahs.map((ayah) => ayah.surah?.number);
    currentSurah = pageSurahs.includes(surahHint) ? surahHint : pageSurahs[0];
    barTitle.textContent = surahs[currentSurah - 1]?.name || 'Al-Quran';
  };

  // ---------- Flip book: pages turn like paper leaves, by button, key or drag ----------
  const pageData = new Map();
  const pageRequests = new Map();
  const fetchPage = (page) => {
    if (pageData.has(page)) return Promise.resolve(pageData.get(page));
    if (!pageRequests.has(page)) {
      pageRequests.set(page, request(`/page/${page}/quran-uthmani`)
        .then((result) => { pageData.set(page, result.ayahs); return result.ayahs; })
        .finally(() => pageRequests.delete(page)));
    }
    return pageRequests.get(page);
  };
  // Neighbouring pages are fetched ahead so a turn or drag can start instantly.
  const prefetchAround = (page) => [page + 1, page - 1].forEach((neighbour) => {
    if (neighbour >= 1 && neighbour <= 604) fetchPage(neighbour).catch(() => {});
  });
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let book = null;
  let turn = null;

  const showBookPage = (ayahs) => {
    book = document.createElement('div');
    book.className = 'book';
    const page = buildMushafPage(ayahs);
    page.classList.add('is-current');
    book.append(page);
    ayahList.replaceChildren(book);
    fitMushafPage(page);
  };
  const setLeafAngle = (leafTurn, angle) => {
    leafTurn.angle = angle;
    leafTurn.leaf.style.transform = `rotateY(${angle}deg)`;
    // 0 while the leaf lies flat, 1 when it stands upright: drives the shading and cast shadow.
    book.style.setProperty('--lift', Math.sin((Math.abs(angle) / 180) * Math.PI).toFixed(3));
  };
  // The leaf turns on the page's left edge, the spine: 0deg lies on the book, -180deg has turned over.
  const beginTurn = (step, ayahs) => {
    const current = book.querySelector('.mushaf-page.is-current');
    const incoming = buildMushafPage(ayahs);
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
  const endTurn = (leafTurn, completed) => {
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
  const commitFlipPage = (page, ayahs, surahHint = 0) => {
    currentPage = page;
    pageSelect.value = String(page);
    updateFlipNavigation();
    nameSurahOnPage(ayahs, surahHint);
    barMeta.textContent = `Halaman ${page} / 604`;
    document.title = `Halaman ${page} - Al-Quran - SedekahQR`;
    saveReading({ type: 'page', value: page, mode: 'flip' });
    updateHistory({ page });
    prefetchAround(page);
  };
  const loadFlipPage = async (page, direction, surahHint) => {
    if (turn) return;
    const animate = Boolean(direction) && book?.isConnected && Math.abs(page - currentPage) === 1 && !reduceMotion.matches;
    audioWrap.hidden = true;
    if (!animate) {
      currentPage = page;
      pageSelect.value = String(page);
      updateFlipNavigation();
      barMeta.textContent = `Halaman ${page} / 604`;
      if (!book?.isConnected) showLoading();
    }
    try {
      const ayahs = await fetchPage(page);
      if (animate) {
        if (turn) return;
        turn = beginTurn(direction, ayahs);
        await animateLeaf(turn, turn.to, 760, easeInOut);
        endTurn(turn, true);
        turn = null;
      } else {
        if (currentPage !== page) return;
        showBookPage(ayahs);
        showReader();
      }
      commitFlipPage(page, ayahs, surahHint);
    } catch {
      turn = null;
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
    showLoading();
    try {
      const [arabicPage, malayPage] = await Promise.all([
        request(`/page/${selectedPage}/quran-uthmani`),
        request(`/page/${selectedPage}/ms.basmeih`),
      ]);
      if (currentPage !== selectedPage || readerMode === 'flip') return;
      nameSurahOnPage(arabicPage.ayahs, surahHint);
      document.title = `Halaman ${selectedPage} - Al-Quran - SedekahQR`;
      audioWrap.hidden = true;
      renderAyahs(arabicPage.ayahs, malayPage.ayahs, true);
      showReader();
      window.scrollTo({ top: 0 });
      saveReading({ type: 'page', value: selectedPage, mode: 'ayah' });
      updateHistory({ page: selectedPage });
    } catch { showError(); }
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
    settingsPanel.hidden = !open;
    settingsToggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (event) => {
    if (!settingsPanel.hidden && !event.target.closest('#reader-settings, #settings-toggle')) closeSettings();
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

  // → and a swipe to the left go forward; ← and a swipe to the right go back.
  const turnPage = (step) => {
    if (readerMode !== 'flip') return;
    const target = currentPage + step;
    if (target >= 1 && target <= 604) void loadPage(target, step);
  };
  flipPrevious.addEventListener('click', () => turnPage(-1));
  flipNext.addEventListener('click', () => turnPage(1));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSettings();
    if (readerMode !== 'flip' || event.target.closest?.('select, input, textarea')) return;
    if (event.key === 'ArrowRight') turnPage(1);
    else if (event.key === 'ArrowLeft') turnPage(-1);
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
      const step = deltaX < 0 ? 1 : -1;
      const target = currentPage + step;
      if (target < 1 || target > 604 || turn) {
        drag = null;
        return;
      }
      if (!pageData.has(target)) {
        // Not fetched yet: fall back to a normal turn when the finger lifts.
        drag.pendingStep = step;
        fetchPage(target).catch(() => {});
        return;
      }
      drag.active = true;
      drag.step = step;
      drag.target = target;
      try { content.setPointerCapture(event.pointerId); } catch {}
      turn = beginTurn(step, pageData.get(target));
    }
    drag.progress = Math.max(0, Math.min(1, (drag.step > 0 ? -deltaX : deltaX) / book.clientWidth));
    setLeafAngle(turn, drag.step > 0 ? -180 * drag.progress : -180 + 180 * drag.progress);
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
    if (completed) commitFlipPage(released.target, pageData.get(released.target));
  };
  content.addEventListener('pointerup', (event) => { void releaseDrag(event); });
  content.addEventListener('pointercancel', (event) => { void releaseDrag(event, true); });
  window.addEventListener('resize', () => {
    const mushafPage = book?.isConnected ? book.querySelector('.mushaf-page.is-current') : null;
    if (mushafPage && !turn) fitMushafPage(mushafPage);
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
