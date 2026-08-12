(() => {
  const api = 'https://api.alquran.cloud/v1';
  const lastKey = 'sedekahqr-quran-last-surah';
  const fontKey = 'sedekahqr-quran-arabic-font-size';
  const list = document.querySelector('#surah-list');
  const status = document.querySelector('#surah-status');
  const search = document.querySelector('#surah-search');
  const empty = document.querySelector('#quran-empty');
  const reader = document.querySelector('#surah-reader');
  const error = document.querySelector('#quran-error');
  const ayahList = document.querySelector('#ayah-list');
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
  const renderSurahs = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = surahs.filter((surah) => `${surah.number} ${surah.englishName} ${surah.englishNameTranslation} ${surah.name}`.toLowerCase().includes(query));
    list.replaceChildren();
    filtered.forEach((surah) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-current', String(surah.number === selectedId));
      button.innerHTML = `<span class="surah-number">${surah.number}</span><span><strong>${surah.englishName}</strong><small>${surah.englishNameTranslation} · ${surah.numberOfAyahs} ayat</small></span><span lang="ar" dir="rtl">${surah.name}</span>`;
      button.addEventListener('click', () => loadSurah(surah.number));
      item.append(button);
      list.append(item);
    });
    status.textContent = filtered.length ? `${filtered.length} surah` : 'Tiada surah ditemui.';
  };
  const loadSurah = async (id) => {
    selectedId = id;
    renderSurahs();
    empty.hidden = true; error.hidden = true; reader.hidden = false;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    ayahList.replaceChildren();
    const loading = document.createElement('p'); loading.className = 'quran-status'; loading.textContent = 'Memuatkan ayat...'; ayahList.append(loading);
    try {
      const editions = await request(`/surah/${id}/editions/quran-uthmani,ms.basmeih`);
      const arabic = editions.find((edition) => edition.identifier === 'quran-uthmani') || editions[0];
      const malay = editions.find((edition) => edition.identifier === 'ms.basmeih') || editions[1];
      const detail = arabic;
      document.querySelector('#surah-meta').textContent = `SURAH ${detail.number} · ${detail.revelationType === 'Meccan' ? 'MAKKIYAH' : 'MADANIYAH'} · ${detail.numberOfAyahs} AYAT`;
      document.querySelector('#surah-title').textContent = detail.englishName;
      document.querySelector('#surah-translation').textContent = detail.englishNameTranslation;
      document.querySelector('#surah-arabic-name').textContent = detail.name;
      document.querySelector('#translation-credit').textContent = 'Terjemahan Bahasa Melayu: Abdullah Muhammad Basmeih.';
      audio.src = `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${id}.mp3`;
      audio.load();
      ayahList.replaceChildren();
      detail.ayahs.forEach((ayah, index) => {
        const block = document.createElement('section'); block.className = 'ayah';
        const number = document.createElement('span'); number.className = 'ayah-number'; number.textContent = ayah.numberInSurah;
        const arabicText = document.createElement('p'); arabicText.className = 'ayah-arabic'; arabicText.lang = 'ar'; arabicText.dir = 'rtl'; arabicText.textContent = ayah.text;
        const translation = document.createElement('p'); translation.className = 'ayah-translation'; translation.textContent = malay?.ayahs?.[index]?.text || '';
        block.append(number, arabicText, translation); ayahList.append(block);
      });
      localStorage.setItem(lastKey, String(id));
      continueButton.hidden = false;
      history.replaceState(null, '', `quran.html?surah=${id}`);
    } catch { showError(); }
  };
  const loadList = async () => {
    try {
      surahs = await request('/surah'); renderSurahs();
      const fromUrl = Number(new URLSearchParams(location.search).get('surah'));
      const last = Number(localStorage.getItem(lastKey));
      if (fromUrl >= 1 && fromUrl <= 114) loadSurah(fromUrl);
      else if (last >= 1 && last <= 114) continueButton.hidden = false;
    } catch { showError(); }
  };
  search.addEventListener('input', renderSurahs);
  continueButton.addEventListener('click', () => loadSurah(Number(localStorage.getItem(lastKey)) || 1));
  document.querySelector('#increase-font').addEventListener('click', () => { arabicSize = Math.min(48, arabicSize + 2); localStorage.setItem(fontKey, arabicSize); setFontSize(); });
  document.querySelector('#decrease-font').addEventListener('click', () => { arabicSize = Math.max(24, arabicSize - 2); localStorage.setItem(fontKey, arabicSize); setFontSize(); });
  document.querySelector('#retry-quran').addEventListener('click', () => { error.hidden = true; loadList(); });
  setFontSize(); loadList();
})();
