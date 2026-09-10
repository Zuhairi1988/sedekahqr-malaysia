(() => {
  const storageKey = 'sedekahqr-language';
  const translations = {
    'Pengurusan': 'Management', 'Pengurusan - SedekahQR': 'Management - SedekahQR', 'Lihat laman awam': 'View public site', 'Akses terhad': 'Restricted access', 'Log masuk admin': 'Admin sign in',
    'Gunakan akaun yang telah diluluskan untuk mengurus kandungan SedekahQR.': 'Use an approved account to manage SedekahQR content.', 'Alamat e-mel': 'Email address', 'Kata laluan': 'Password', 'Lihat': 'Show', 'Log masuk': 'Sign in',
    'Dashboard admin': 'Admin dashboard', 'Pratonton pricing': 'Preview pricing', 'Artikel baharu': 'New article', 'Log keluar': 'Sign out',
    'Overview': 'Overview', 'Campaign': 'Campaign', 'SEO & Artikel': 'SEO & Articles', 'Direktori QR': 'QR directory', 'Kos': 'Costs',
    'Kawalan perbelanjaan': 'Spending controls', 'Kos website': 'Website costs', 'Anggaran dikira dalam Ringgit Malaysia berdasarkan artikel automatik yang telah diterbitkan dan kos tetap yang anda masukkan.': 'Estimates are calculated in Malaysian Ringgit from published automated articles and fixed costs you enter.',
    'Anggaran bulan ini': 'Estimate this month', 'Kos tetap dan automasi artikel': 'Fixed costs and article automation', 'Kos automasi terkumpul': 'Cumulative automation cost', 'Anggaran setiap artikel': 'Estimate per article', 'DataForSEO dan DeepSeek': 'DataForSEO and DeepSeek', 'Kos tetap sebulan': 'Fixed monthly cost', 'Termasuk pecahan domain tahunan': 'Includes annual domain allocation',
    'Pecahan': 'Breakdown', 'Kos semasa': 'Current costs', 'Tetapan anggaran': 'Estimate settings', 'Masukkan kos anda': 'Enter your costs', 'Masukkan caj sebenar daripada invois atau dashboard penyedia servis. Nilai RM0 bermaksud tiada caj.': 'Enter actual charges from invoices or provider dashboards. RM0 means no charge.',
    'Supabase sebulan (RM)': 'Supabase per month (RM)', 'Domain setahun (RM)': 'Domain per year (RM)', 'DataForSEO setiap artikel (RM)': 'DataForSEO per article (RM)', 'DeepSeek setiap artikel (RM)': 'DeepSeek per article (RM)', 'Nama perkhidmatan lain': 'Other service name', 'Perkhidmatan lain sebulan (RM)': 'Other service per month (RM)', 'Simpan kos': 'Save costs',
    'GitHub Pages dan imej SVG artikel direkodkan sebagai RM0 pada tetapan semasa. Kos automasi hanya mengira artikel yang berjaya diterbitkan melalui DataForSEO; caj untuk percubaan gagal tidak dapat dikesan daripada rekod artikel.': 'GitHub Pages and article SVG images are recorded as RM0 under the current setup. Automation counts only articles successfully published through DataForSEO; charges for failed attempts cannot be determined from article records.',
    'Contoh: E-mel atau storan': 'Example: Email or storage', 'artikel automatik bulan ini': 'automated articles this month', 'artikel menggunakan DataForSEO': 'articles using DataForSEO', 'Dikemas kini': 'Updated', 'Belum disimpan': 'Not saved', 'Kos tetap bulanan': 'Fixed monthly cost', 'Pecahan daripada kos tahunan': 'Allocation from annual cost', 'Hosting statik semasa': 'Current static hosting', 'Perkhidmatan lain': 'Other service', 'Kos berjaya disimpan.': 'Costs saved successfully', 'Tetapan kos tidak dapat disimpan.': 'Cost settings could not be saved.', 'Menyimpan...': 'Saving...',
    'Statistik laman': 'Website analytics', 'Pelawat dan paparan halaman': 'Visitors and page views', 'Tempoh': 'Period', '7 hari terakhir': 'Last 7 days', '14 hari terakhir': 'Last 14 days',
    '30 hari terakhir': 'Last 30 days', 'Bulan ini': 'This month', 'Hari ini': 'Today', 'Semalam': 'Yesterday', 'Semua masa': 'All time', 'hari': 'days', 'hingga': 'through', 'min': 'min', 'saat': 'sec', 'Tarikh mula': 'Start date', 'Tarikh akhir': 'End date', 'Batal': 'Cancel', 'Terapkan': 'Apply',
    'Memuatkan statistik...': 'Loading analytics...', 'Lawatan hari ini': 'Views today', 'Pelawat hari ini': 'Visitors today', 'Lawatan 30 hari': 'Views, last 30 days', 'Pelawat 30 hari': 'Visitors, last 30 days',
    'Purata masa halaman': 'Average page time', 'Bounce rate': 'Bounce rate', 'Trend harian': 'Daily trend', 'Lawatan': 'Views', 'Halaman popular': 'Top pages', 'Halaman': 'Page', 'Pelawat': 'Visitors',
    'Sumber trafik': 'Traffic sources', 'Jenis peranti': 'Device type', 'Negeri pelawat': 'Visitor states', 'Daerah pelawat': 'Visitor districts',
    'Pengalaman pengguna sebenar': 'Real user experience', 'Prestasi laman': 'Website performance', 'Persentil ke-75 daripada lawatan sebenar. Nilai lebih rendah adalah lebih baik.': '75th percentile from real visits. Lower values are better.',
    'Belum ada sampel prestasi daripada lawatan baharu.': 'No performance samples from new visits yet.', 'Tindakan pengguna': 'User actions', 'Aktiviti kod QR': 'QR code activity',
    'Screenshot telefon tidak boleh dikesan; bukaan QR digunakan sebagai petunjuk.': 'Phone screenshots cannot be detected; QR opens are used as an indicator.', 'QR dibuka': 'QR opens', 'QR dimuat turun': 'QR downloads',
    'Pengguna memuat turun': 'Downloaders', 'Muat turun hari ini': 'Downloads today', 'Masjid atau surau': 'Mosque or surau', 'Negeri': 'State', 'Dibuka': 'Opened', 'Muat turun': 'Downloads',
    'Pangkalan data statistik tidak menyimpan nama, e-mel, nombor telefon atau alamat IP.': 'The analytics database does not store names, email addresses, phone numbers or IP addresses.',
    'Paparan awam': 'Public display', 'Kempen': 'Campaign', 'Popup muncul setiap kali homepage dibuka selepas kelewatan yang ditetapkan, selagi kempen aktif.': 'The popup appears whenever the homepage opens after the selected delay while the campaign is active.',
    'Tajuk kempen': 'Campaign title', 'Mesej ringkas': 'Short message', 'QR penerima': 'Recipient QR', 'Belum memilih QR penerima.': 'No recipient QR selected.',
    'Poster kempen (pilihan)': 'Campaign poster (optional)', 'Mula': 'Start', 'Tamat': 'End', 'Papar selepas': 'Show after', '3 saat': '3 seconds', '5 saat': '5 seconds', '7 saat': '7 seconds', '10 saat': '10 seconds',
    'Aktifkan kempen': 'Activate campaign', 'Popup akan dipaparkan setiap kali pengguna membuka homepage dalam tempoh kempen.': 'The popup will show whenever a user opens the homepage during the campaign period.', 'Simpan kempen': 'Save campaign',
    'Semakan direktori': 'Directory review', 'Laporan QR': 'QR reports', 'Semak isu yang dihantar pengguna sebelum membetulkan, menyahaktifkan atau mengemas kini QR.': 'Review user-submitted issues before correcting, disabling or updating a QR code.',
    'Memuatkan laporan...': 'Loading reports...', 'Pengesahan QR': 'QR verification', 'Tandakan hanya QR yang telah disemak dengan pihak masjid atau surau.': 'Mark only QR codes that have been checked with the mosque or surau.',
    'Status': 'Status', 'Belum disahkan': 'Pending verification', 'Disahkan': 'Verified', 'Digantung': 'Suspended', 'Catatan admin': 'Admin note', 'Simpan status': 'Save status',
    'Semua artikel': 'All articles', 'Diterbitkan': 'Published', 'Draf': 'Drafts', 'Senarai artikel': 'Article list', 'Tulis artikel': 'Write article',
    'Tajuk artikel': 'Article title', 'Slug pautan': 'Link slug', 'Ringkasan': 'Excerpt', 'Kategori': 'Category', 'Penulis': 'Author', 'Imej muka depan': 'Cover image', 'Masa bacaan (minit)': 'Reading time (minutes)', 'Tarikh terbit': 'Publish date',
    'Terbitkan artikel': 'Publish article', 'Artikel draf tidak dipaparkan kepada pengguna awam.': 'Draft articles are not shown to public users.', 'Kandungan artikel': 'Article content', 'Susun kandungan mengikut blok.': 'Arrange content in blocks.',
    '+ Perenggan': '+ Paragraph', '+ Tajuk kecil': '+ Subheading', '+ Petikan': '+ Quote', '+ Senarai': '+ List', 'Sumber rujukan': 'References', 'Gunakan pautan kepada sumber asal yang sah.': 'Use links to valid original sources.',
    '+ Tambah sumber': '+ Add source', 'Simpan artikel': 'Save article', 'Lihat artikel': 'View article', 'Tutup editor': 'Close editor', 'Tunjukkan kata laluan': 'Show password', 'Muat semula statistik': 'Refresh analytics',
    'Contoh: Bantuan baik pulih bumbung surau': 'Example: Surau roof repair assistance', 'Terangkan keperluan dana dengan ringkas dan jelas.': 'Explain the funding need briefly and clearly.',
    'Cari masjid, surau, kawasan atau negeri': 'Search mosque, surau, area or state', 'Contoh: Nama penerima disahkan oleh pihak surau pada 13 Ogos 2026': 'Example: Recipient name verified by the surau on 13 August 2026', 'Cari tajuk atau kategori': 'Search title or category'
  };

  const getLanguage = () => {
    try { return localStorage.getItem(storageKey) === 'en' ? 'en' : 'ms'; } catch { return 'ms'; }
  };

  const translate = (text, language = getLanguage()) => language === 'en' ? (translations[text] || text) : text;

  const applyLanguage = (language) => {
    document.documentElement.lang = language;
    document.title = translate('Pengurusan - SedekahQR', language);
    document.querySelectorAll('body *').forEach((element) => {
      if (element.children.length || !element.textContent.trim()) return;
      const original = element.dataset.adminLanguageOriginal || element.textContent.trim();
      element.dataset.adminLanguageOriginal = original;
      element.textContent = translate(original, language);
    });
    document.querySelectorAll('[placeholder], [aria-label], [title]').forEach((element) => {
      ['placeholder', 'aria-label', 'title'].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (!value) return;
        const key = `adminLanguage${attribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}`;
        const original = element.dataset[key] || value;
        element.dataset[key] = original;
        element.setAttribute(attribute, translate(original, language));
      });
    });
    document.querySelectorAll('[data-admin-language]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.adminLanguage === language)));
    window.dispatchEvent(new CustomEvent('sedekahqr-admin-language-change', { detail: { language } }));
  };

  const setLanguage = (language) => {
    const selected = language === 'en' ? 'en' : 'ms';
    try { localStorage.setItem(storageKey, selected); } catch {}
    applyLanguage(selected);
  };

  globalThis.SedekahQRAdminLanguage = { getLanguage, setLanguage, t: translate };
  document.querySelectorAll('[data-admin-language]').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.adminLanguage)));
  applyLanguage(getLanguage());
})();
