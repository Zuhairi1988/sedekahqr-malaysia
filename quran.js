(() => {
  const api = 'https://api.alquran.cloud/v1';
  const lastReadingKey = 'sedekahqr-quran-last-reading';
  const surahSelect = document.querySelector('#surah-select');
  const pageSelect = document.querySelector('#page-select');
  const status = document.querySelector('#surah-status');
  const empty = document.querySelector('#quran-empty');
  const reader = document.querySelector('#surah-reader');
  const readerShell = document.querySelector('.quran-reader');
  const error = document.querySelector('#quran-error');
  const ayahList = document.querySelector('#ayah-list');
  const audioSection = document.querySelector('.surah-audio');
  const audio = document.querySelector('#surah-audio');
  const modeTabs = document.querySelectorAll('[data-reader-mode]');
  const flipNavigation = document.querySelector('#quran-flip-navigation');
  const flipPrevious = document.querySelector('#flip-previous');
  const flipNext = document.querySelector('#flip-next');
  const flipPageIndicator = document.querySelector('#flip-page-indicator');
  let surahs = [];
  let selectedId = null;
  let readerMode = 'ayah';
  const surahStartPages = new Map();

  const request = async (path) => {
    const response = await fetch(`${api}${path}`);
    if (!response.ok) throw new Error('Quran API request failed');
    const payload = await response.json();
    if (!payload?.data) throw new Error('Invalid Quran API response');
    return payload.data;
  };
  const updateHistory = (key, value) => {
    const params = new URLSearchParams({ [key]: value });
    if (readerMode === 'flip') params.set('mode', 'flip');
    history.replaceState(null, '', `quran-reader.html?${params}`);
  };
  const updateFlipNavigation = (page) => {
    const isFlip = readerMode === 'flip';
    flipNavigation.hidden = !isFlip;
    if (!isFlip) return;
    flipPageIndicator.textContent = `Halaman ${page} daripada 604`;
    flipPrevious.disabled = page <= 1;
    flipNext.disabled = page >= 604;
  };
  const showError = () => {
    error.hidden = false;
    empty.hidden = true;
    reader.hidden = true;
    flipNavigation.hidden = true;
  };
  const showLoading = () => {
    empty.hidden = true;
    error.hidden = true;
    reader.hidden = false;
    ayahList.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'quran-status';
    loading.textContent = 'Memuatkan ayat...';
    ayahList.append(loading);
  };
  const saveReading = (reading) => {
    try { localStorage.setItem(lastReadingKey, JSON.stringify(reading)); } catch {}
  };
  const clearAudio = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
  const toArabicDigits = (value) => String(value).replace(/\d/g, (digit) => String.fromCharCode(0x0660 + Number(digit)));
  const fitMushafPage = (mushafText) => {
    window.requestAnimationFrame(() => {
      const content = mushafText.closest('.quran-content');
      if (!content) return;
      mushafText.style.fontSize = '';
      let fontSize = Number.parseFloat(getComputedStyle(mushafText).fontSize);
      while (mushafText.scrollHeight > content.clientHeight - 8 && fontSize > 14) {
        fontSize -= 1;
        mushafText.style.fontSize = `${fontSize}px`;
      }
    });
  };
  const renderAyahs = (arabicAyahs, malayAyahs, includeSurahName = false, includeTranslation = true) => {
    if (!includeTranslation) {
      ayahList.replaceChildren();
      const mushafText = document.createElement('p');
      mushafText.className = 'mushaf-text';
      mushafText.lang = 'ar';
      mushafText.dir = 'rtl';
      mushafText.textContent = arabicAyahs.map((ayah) => `${ayah.text} \uFD3F${toArabicDigits(ayah.numberInSurah)}\uFD3E`).join('  ');
      ayahList.append(mushafText);
      return;
    }
    const translationByNumber = new Map((malayAyahs || []).map((ayah) => [ayah.number, ayah.text]));
    ayahList.replaceChildren();
    let previousSurah = null;
    arabicAyahs.forEach((ayah) => {
      if (includeSurahName && ayah.surah?.number !== previousSurah) {
        previousSurah = ayah.surah?.number;
        const separator = document.createElement('p');
        separator.className = 'quran-page-surah';
        separator.textContent = `${ayah.surah?.englishName || 'Surah'} · Ayat ${ayah.numberInSurah}`;
        ayahList.append(separator);
      }
      const block = document.createElement('section');
      block.className = 'ayah';
      const number = document.createElement('span');
      number.className = 'ayah-number';
      number.textContent = ayah.numberInSurah;
      const arabicText = document.createElement('p');
      arabicText.className = 'ayah-arabic';
      arabicText.lang = 'ar';
      arabicText.dir = 'rtl';
      arabicText.textContent = ayah.text;
      const translation = document.createElement('p');
      translation.className = 'ayah-translation';
      translation.textContent = translationByNumber.get(ayah.number) || '';
      block.append(number, arabicText);
      if (includeTranslation) block.append(translation);
      ayahList.append(block);
    });
  };
  const loadSurah = async (id) => {
    selectedId = Number(id);
    if (readerMode === 'flip') {
      void loadPage(surahStartPages.get(selectedId) || 1);
      return;
    }
    surahSelect.value = String(selectedId);
    pageSelect.value = '';
    updateFlipNavigation(1);
    showLoading();
    clearAudio();
    audioSection.hidden = false;
    try {
      const editions = await request(`/surah/${selectedId}/editions/quran-uthmani,ms.basmeih`);
      const arabic = editions.find((edition) => edition.identifier === 'quran-uthmani') || editions[0];
      const malay = editions.find((edition) => edition.identifier === 'ms.basmeih') || editions[1];
      document.querySelector('#surah-meta').textContent = `SURAH ${arabic.number} · ${arabic.revelationType === 'Meccan' ? 'MAKKIYAH' : 'MADANIYAH'} · ${arabic.numberOfAyahs} AYAT`;
      document.querySelector('#surah-title').textContent = arabic.englishName;
      document.querySelector('#surah-translation').textContent = arabic.englishNameTranslation;
      document.querySelector('#surah-arabic-name').textContent = arabic.name;
      document.querySelector('#translation-credit').textContent = 'Terjemahan Bahasa Melayu: Abdullah Muhammad Basmeih.';
      audio.src = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${selectedId}.mp3`;
      audio.load();
      renderAyahs(arabic.ayahs, malay?.ayahs);
      saveReading({ type: 'surah', value: selectedId });
      updateHistory('surah', selectedId);
    } catch { showError(); }
  };
  const animatePageTurn = (direction) => {
    if (!direction) return;
    const className = direction > 0 ? 'is-turning-next' : 'is-turning-previous';
    readerShell.classList.remove('is-turning-next', 'is-turning-previous');
    void readerShell.offsetWidth;
    readerShell.classList.add(className);
    window.setTimeout(() => readerShell.classList.remove(className), 360);
  };
  const loadPage = async (page, direction = 0) => {
    const selectedPage = Number(page);
    if (!selectedPage || selectedPage < 1 || selectedPage > 604) return;
    selectedId = null;
    surahSelect.value = '';
    pageSelect.value = String(selectedPage);
    updateFlipNavigation(selectedPage);
    showLoading();
    clearAudio();
    audioSection.hidden = true;
    try {
      const [arabicPage, malayPage] = await Promise.all([
        request(`/page/${selectedPage}/quran-uthmani`),
        request(`/page/${selectedPage}/ms.basmeih`),
      ]);
      document.querySelector('#surah-meta').textContent = `HALAMAN ${selectedPage} · AL-QURAN`;
      document.querySelector('#surah-title').textContent = `Halaman ${selectedPage}`;
      document.querySelector('#surah-translation').textContent = 'Teks Arab dan terjemahan Bahasa Melayu';
      document.querySelector('#surah-arabic-name').textContent = '';
      document.querySelector('#translation-credit').textContent = 'Terjemahan Bahasa Melayu: Abdullah Muhammad Basmeih.';
      renderAyahs(arabicPage.ayahs, malayPage.ayahs, readerMode !== 'flip', readerMode !== 'flip');
      animatePageTurn(direction);
      saveReading({ type: 'page', value: selectedPage });
      updateHistory('page', selectedPage);
    } catch { showError(); }
  };
  const setReaderMode = (mode, pageOverride = 0) => {
    readerMode = mode;
    const isFlip = mode === 'flip';
    readerShell.classList.toggle('is-flip-mode', isFlip);
    document.body.classList.toggle('quran-flip-active', isFlip);
    modeTabs.forEach((tab) => {
      const active = tab.dataset.readerMode === mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    if (!isFlip) {
      flipNavigation.hidden = true;
      return;
    }
    const currentPage = Number(pageOverride) || Number(pageSelect.value) || surahStartPages.get(Number(surahSelect.value)) || 1;
    void loadPage(currentPage);
  };
  const populateFilters = () => {
    const surahFragment = document.createDocumentFragment();
    surahs.forEach((surah) => {
      const option = document.createElement('option');
      option.value = surah.number;
      const startPage = surahStartPages.get(surah.number);
      option.textContent = `${surah.number}. ${surah.englishName} (${surah.name})${startPage ? ` - Halaman ${startPage}` : ''}`;
      surahFragment.append(option);
    });
    surahSelect.append(surahFragment);
    const pageFragment = document.createDocumentFragment();
    for (let page = 1; page <= 604; page += 1) {
      const option = document.createElement('option');
      option.value = page;
      option.textContent = `Halaman ${page}`;
      pageFragment.append(option);
    }
    pageSelect.append(pageFragment);
    status.textContent = 'Pilih Surah atau halaman mushaf.';
  };
  const loadList = async () => {
    try {
      const [surahList, mushaf] = await Promise.all([request('/surah'), request('/quran/quran-uthmani')]);
      surahs = surahList;
      (mushaf.surahs || []).forEach((surah) => {
        const firstAyah = surah.ayahs?.[0];
        if (firstAyah?.page) surahStartPages.set(surah.number, firstAyah.page);
      });
      populateFilters();
      const params = new URLSearchParams(location.search);
      const page = Number(params.get('page'));
      const surah = Number(params.get('surah'));
      if (params.get('mode') === 'flip') setReaderMode('flip', page);
      else if (page >= 1 && page <= 604) void loadPage(page);
      else if (surah >= 1 && surah <= 114) void loadSurah(surah);
    } catch { showError(); }
  };
  surahSelect.addEventListener('change', () => { if (surahSelect.value) void loadSurah(surahSelect.value); });
  pageSelect.addEventListener('change', () => { if (pageSelect.value) void loadPage(pageSelect.value); });
  modeTabs.forEach((tab) => tab.addEventListener('click', () => setReaderMode(tab.dataset.readerMode)));
  flipPrevious.addEventListener('click', () => void loadPage(Number(pageSelect.value) - 1, -1));
  flipNext.addEventListener('click', () => void loadPage(Number(pageSelect.value) + 1, 1));
  document.querySelector('#retry-quran').addEventListener('click', () => { error.hidden = true; loadList(); });
  loadList();
})();