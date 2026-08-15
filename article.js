document.addEventListener('DOMContentLoaded', async () => {
  const page = document.getElementById('article-page');
  const loading = document.getElementById('article-loading');
  const notFound = document.getElementById('article-not-found');
  if (!page || !loading || !notFound || !globalThis.SedekahQRBlogApi) return;

  const slug = new URLSearchParams(window.location.search).get('slug') || '';
  const t = (text) => globalThis.SedekahQRLanguage?.t(text) || text;

  const setMeta = (selector, attribute, value) => {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      const match = selector.match(/\[(name|property)="([^"]+)"\]/);
      if (match) element.setAttribute(match[1], match[2]);
      document.head.appendChild(element);
    }
    element.setAttribute(attribute, value);
  };

  const setArticleSeo = (article) => {
    const canonicalUrl = new URL(window.location.href);
    canonicalUrl.search = `?slug=${encodeURIComponent(article.slug)}`;
    canonicalUrl.hash = '';
    const canonical = canonicalUrl.href;
    const image = new URL(article.cover_image, window.location.origin).href;
    const title = `${article.title} - SedekahQR`;

    document.title = title;
    setMeta('meta[name="description"]', 'content', article.excerpt);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', article.excerpt);
    setMeta('meta[property="og:url"]', 'content', canonical);
    setMeta('meta[property="og:image"]', 'content', image);
    setMeta('meta[property="article:published_time"]', 'content', article.published_at);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', article.excerpt);
    setMeta('meta[name="twitter:image"]', 'content', image);

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;

    let schema = document.getElementById('article-schema');
    if (!schema) {
      schema = document.createElement('script');
      schema.type = 'application/ld+json';
      schema.id = 'article-schema';
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      headline: article.title,
      description: article.excerpt,
      image: [image],
      datePublished: article.published_at,
      dateModified: article.published_at,
      inLanguage: 'ms-MY',
      author: { '@type': 'Organization', name: article.author || 'Editorial SedekahQR' },
      publisher: {
        '@type': 'Organization',
        name: 'SedekahQR',
        logo: { '@type': 'ImageObject', url: `${window.location.origin}/assets/sedekahqr-icon-512.png` }
      },
      articleSection: article.category,
      articleBody: article.content.map((block) => block.text || (block.items || []).join(' ')).join('\n')
    });
  };

  const renderBlock = (block) => {
    if (block.type === 'heading') {
      const heading = document.createElement('h2');
      heading.textContent = block.text || '';
      return heading;
    }
    if (block.type === 'quote') {
      const quote = document.createElement('blockquote');
      const text = document.createElement('p');
      text.textContent = block.text || '';
      const source = document.createElement('cite');
      source.textContent = block.source || '';
      quote.append(text, source);
      return quote;
    }
    if (block.type === 'list') {
      const list = document.createElement('ul');
      (Array.isArray(block.items) ? block.items : []).forEach((item) => {
        const listItem = document.createElement('li');
        listItem.textContent = item;
        list.appendChild(listItem);
      });
      return list;
    }
    const paragraph = document.createElement('p');
    paragraph.textContent = block.text || '';
    return paragraph;
  };

  const createRelatedCard = (article) => {
    const card = document.createElement('article');
    card.className = 'related-card';
    const image = document.createElement('img');
    image.src = article.cover_image;
    image.alt = '';
    image.loading = 'lazy';
    const content = document.createElement('div');
    const category = document.createElement('span');
    category.textContent = article.category;
    const title = document.createElement('h3');
    const link = document.createElement('a');
    link.href = `article.html?slug=${encodeURIComponent(article.slug)}`;
    link.textContent = article.title;
    title.appendChild(link);
    content.append(category, title);
    card.append(image, content);
    return card;
  };

  try {
    const articles = await globalThis.SedekahQRBlogApi.getArticles();
    const article = articles.find((item) => item.slug === slug);
    loading.hidden = true;
    if (!article) {
      notFound.hidden = false;
      return;
    }

    setArticleSeo(article);
    document.getElementById('article-category').textContent = article.category;
    document.getElementById('article-title').textContent = article.title;
    document.getElementById('article-excerpt').textContent = article.excerpt;
    document.getElementById('article-author').textContent = article.author;
    document.getElementById('article-date').textContent = globalThis.SedekahQRBlogApi.formatDate(article.published_at);
    document.getElementById('article-date').dateTime = article.published_at;
    document.getElementById('article-reading').textContent = `${article.reading_minutes} ${t('minit bacaan')}`;

    const cover = document.getElementById('article-cover');
    cover.src = article.cover_image;
    cover.alt = `Imej muka hadapan untuk ${article.title}`;

    const content = document.getElementById('article-content');
    content.replaceChildren(...article.content.map(renderBlock));

    const sourceList = document.getElementById('article-sources');
    sourceList.replaceChildren(...article.sources.map((source) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.label;
      item.appendChild(link);
      return item;
    }));

    const related = articles
      .filter((item) => item.slug !== article.slug)
      .sort((first, second) => Number(second.category === article.category) - Number(first.category === article.category))
      .slice(0, 3);
    document.getElementById('related-grid').replaceChildren(...related.map(createRelatedCard));
    page.hidden = false;

    const shareButton = document.getElementById('share-article');
    const shareStatus = document.getElementById('share-status');
    shareButton.addEventListener('click', async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: article.title, text: article.excerpt, url: window.location.href });
          shareStatus.textContent = t('Artikel dikongsi.');
        } else {
          await navigator.clipboard.writeText(window.location.href);
          shareStatus.textContent = t('Pautan disalin.');
        }
      } catch (error) {
        if (error.name !== 'AbortError') shareStatus.textContent = t('Pautan tidak dapat dikongsi.');
      }
    });
  } catch {
    loading.hidden = true;
    notFound.hidden = false;
  }
});
