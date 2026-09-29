// Builds hadis-data.json: the Malay hadith list from HadeethEnc.com (Encyclopedia of Translated
// Prophetic Hadiths). HadeethEnc's terms allow reuse without modification and with clear credit,
// so the text is stored exactly as published. Explanations and lessons are fetched live on the page.
// Usage: node scripts/build-hadis-index.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const api = 'https://hadeethenc.com/api/v1';
const language = 'ms';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getJson = async (path) => {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(`${api}${path}`);
    if (response.ok) return response.json();
    if (attempt === 4) throw new Error(`HadeethEnc ${path}: HTTP ${response.status}`);
    await sleep(1000 * attempt);
  }
};

const categories = await getJson(`/categories/roots/?language=${language}`);
const hadithCategories = new Map();
for (const category of categories) {
  for (let page = 1; ; page += 1) {
    const list = await getJson(`/hadeeths/list/?language=${language}&category_id=${category.id}&page=${page}&per_page=100`);
    list.data.forEach(({ id }) => {
      if (!hadithCategories.has(id)) hadithCategories.set(id, new Set());
      hadithCategories.get(id).add(Number(category.id));
    });
    if (page >= Number(list.meta.last_page)) break;
  }
}

const hadiths = [];
for (const [id, categoryIds] of hadithCategories) {
  const item = await getJson(`/hadeeths/one/?language=${language}&id=${id}`);
  hadiths.push({
    id: Number(item.id),
    title: item.title,
    hadeeth: item.hadeeth,
    arabic: item.hadeeth_ar,
    grade: item.grade,
    attribution: item.attribution,
    categories: [...categoryIds].sort((a, b) => a - b),
  });
  await sleep(120);
}
hadiths.sort((a, b) => a.id - b.id);

const output = {
  source: 'HadeethEnc.com — Encyclopedia of Translated Prophetic Hadiths (Bahasa Melayu)',
  generated: new Date().toISOString().slice(0, 10),
  categories: categories.map((category) => ({ id: Number(category.id), count: Number(category.hadeeths_count) })),
  hadiths,
};
writeFileSync(join(root, 'hadis-data.json'), `${JSON.stringify(output)}\n`);
console.log(`hadis-data.json: ${hadiths.length} hadith, ${categories.length} categories`);
