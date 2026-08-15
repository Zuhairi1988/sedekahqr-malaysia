document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('blog-grid');
  const searchInput = document.getElementById('blog-search-input');
  const categoryList = document.getElementById('blog-categories');
  const resultText = document.getElementById('blog-result-text');
  if (!grid || !searchInput || !categoryList || !globalThis.SedekahQRBlogApi) return;

  let articles = [];
  let selectedCategory = 'Semua';
  const t = (text) => globalThis.SedekahQRLanguage?.t(text) || text;

  const createArticleCard = (article) => {
    const card = document.createElement('article');
    card.className = 'blog-card';

    const imageLink = document.createElement('a');
    imageLink.className = 'blog-card-image';
    imageLink.href = `artikel/${encodeURIComponent(article.slug)}/`;
    imageLink.setAttribute('aria-label', `Baca ${article.title}`);

    const image = document.createElement('img');
    image.src = article.cover_image;
    image.alt = '';
    image.loading = 'lazy';
    image.width = 720;
    image.height = 480;
    imageLink.appendChild(image);

    const body = document.createElement('div');
    body.className = 'blog-card-body';

    const category = document.createElement('span');
    category.className = 'blog-category';
    category.textContent = article.category;

    const title = document.createElement('h2');
    const titleLink = document.createElement('a');
    titleLink.href = imageLink.href;
    titleLink.textContent = article.title;
    title.appendChild(titleLink);

    const excerpt = document.createElement('p');
    excerpt.textContent = article.excerpt;

    const meta = document.createElement('div');
    meta.className = 'blog-card-meta';
    const date = document.createElement('time');
    date.dateTime = article.published_at;
    date.textContent = globalThis.SedekahQRBlogApi.formatDate(article.published_at);
    const reading = document.createElement('span');
    reading.textContent = `${article.reading_minutes} ${t('minit bacaan')}`;
    meta.append(date, reading);

    body.append(category, title, excerpt, meta);
    card.append(imageLink, body);
    return card;
  };

  const renderArticles = () => {
    const query = searchInput.value.trim().toLocaleLowerCase('ms');
    const filtered = articles.filter((article) => {
      const inCategory = selectedCategory === 'Semua' || article.category === selectedCategory;
      const searchable = `${article.title} ${article.excerpt} ${article.category}`.toLocaleLowerCase('ms');
      return inCategory && searchable.includes(query);
    });

    grid.replaceChildren(...filtered.map(createArticleCard));
    resultText.textContent = filtered.length
      ? globalThis.SedekahQRLanguage?.getLanguage() === 'en'
        ? `${filtered.length} articles found`
        : `${filtered.length} artikel ditemui`
      : t('Tiada artikel sepadan dengan carian anda.');
    grid.classList.toggle('is-empty', filtered.length === 0);
  };

  const renderCategories = () => {
    const categories = ['Semua', ...new Set(articles.map((article) => article.category))];
    categoryList.replaceChildren(...categories.map((label) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'blog-category-button';
      button.textContent = label;
      button.setAttribute('aria-pressed', String(label === selectedCategory));
      button.addEventListener('click', () => {
        selectedCategory = label;
        [...categoryList.children].forEach((item) => {
          item.setAttribute('aria-pressed', String(item === button));
        });
        renderArticles();
      });
      return button;
    }));
  };

  try {
    articles = await globalThis.SedekahQRBlogApi.getArticles();
    renderCategories();
    renderArticles();
  } catch {
    grid.replaceChildren();
    grid.classList.add('is-empty');
    resultText.textContent = t('Artikel tidak dapat dimuatkan. Cuba muat semula halaman.');
  }

  searchInput.addEventListener('input', renderArticles);
  window.addEventListener('sedekahqr-language-change', renderArticles);
});
