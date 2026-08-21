(() => {
  const api = 'https://api.alquran.cloud/v1';
  const lastReadingKey = 'sedekahqr-quran-last-reading';
  const fontKey = 'sedekahqr-quran-arabic-font-size';
  const surahSelect = document.querySelector('#surah-select');
  const pageSelect = document.querySelector('#page-select');
  const status = document.querySelector('#surah-status');
  const empty = document.querySelector('#quran-empty');
  const reader = document.querySelector('#surah-reader');
  const error = document.querySelector('#quran-error');
  const ayahList = document.querySelector('#ayah-list');
  const audioSection = document.querySelector('.surah-audio');
  const audio = document.querySelector('#surah-audio');
  const continueButton = document.querySelector('#continue-reading');
  let surahs = [];
  let selectedId = null;
  let arabicSize = Number(localStorage.getItem(fontKey)) || 32;

  const setFontSize = () => document.documentElement.style.setProperty('--arabic-size', `${arabicSize}px`);
  const request = async (path) => {
    const response = await fetch(`${api}${path}`);
    if (!response.ok) throw new Error('Quran API request failed');
    const payload = await response.json();
    if (!payload?.data) throw new Error('Invalid Quran API response');
    return payload.data;
  };
  const showError = () => { error.hidden = false; empty.hidden = true; reader.hidden = true; };
  const showLoading = () => {
    empty.hidden = true; error.hidden = true; reader.hidden = false;
    ayahList.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'quran-status';
    loading.textContent = 'Memuatkan ayat...';
    ayahList.append(loading);
  };
  const saveReading = (reading) => {
    try { localStorage.setItem(lastReadingKey, JSON.stringify(reading)); } catch {}
    continueButton.hidden = false;
  };
  const getLastReading = () => {
    try { return JSON.parse(localStorage.getItem(lastReadingKey) || 'null'); } catch { return null; }
  };
  const clearAudio = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
  const renderAyahs = (arabicAyahs, malayAyahs, includeSurahName = false) => {
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
      block.append(number, arabicText, translation);
      ayahList.append(block);
    });
  };
  const loadSurah = async (id) => {
    selectedId = Number(id);
    surahSelect.value = String(selectedId);
    pageSelect.value = '';
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
      history.replaceState(null, '', `quran.html?surah=${selectedId}`);
    } catch { showError(); }
  };
  const loadPage = async (page) => {
    const selectedPage = Number(page);
    if (!selectedPage || selectedPage < 1 || selectedPage > 604) return;
    selectedId = null;
    surahSelect.value = '';
    pageSelect.value = String(selectedPage);
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
      renderAyahs(arabicPage.ayahs, malayPage.ayahs, true);
      saveReading({ type: 'page', value: selectedPage });
      history.replaceState(null, '', `quran.html?page=${selectedPage}`);
    } catch { showError(); }
  };
  const populateFilters = () => {
    const surahFragment = document.createDocumentFragment();
    surahs.forEach((surah) => {
      const option = document.createElement('option');
      option.value = surah.number;
      option.textContent = `${surah.number}. ${surah.englishName} (${surah.name})`;
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
      surahs = await request('/surah');
      populateFilters();
      const params = new URLSearchParams(location.search);
      const page = Number(params.get('page'));
      const surah = Number(params.get('surah'));
      const last = getLastReading();
      if (page >= 1 && page <= 604) void loadPage(page);
      else if (surah >= 1 && surah <= 114) void loadSurah(surah);
      else if (last?.value) continueButton.hidden = false;
    } catch { showError(); }
  };
  surahSelect.addEventListener('change', () => { if (surahSelect.value) void loadSurah(surahSelect.value); });
  pageSelect.addEventListener('change', () => { if (pageSelect.value) void loadPage(pageSelect.value); });
  continueButton.addEventListener('click', () => {
    const last = getLastReading();
    if (last?.type === 'page') void loadPage(last.value);
    else void loadSurah(last?.value || 1);
  });
  document.querySelector('#increase-font').addEventListener('click', () => { arabicSize = Math.min(48, arabicSize + 2); localStorage.setItem(fontKey, arabicSize); setFontSize(); });
  document.querySelector('#decrease-font').addEventListener('click', () => { arabicSize = Math.max(24, arabicSize - 2); localStorage.setItem(fontKey, arabicSize); setFontSize(); });
  document.querySelector('#retry-quran').addEventListener('click', () => { error.hidden = true; loadList(); });
  setFontSize();
  loadList();
})();