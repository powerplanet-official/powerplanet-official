// Normalize catalog spelling and electrical units without changing product data.
export function normalizeSearch(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bbi[\s-]*(?:facial|ficial)\b/g, 'bifacial')
    .replace(/\bli[\s-]*ion\b/g, 'lithium')
    .replace(/\bbatteries\b/g, 'battery')
    .replace(/\bpanels\b/g, 'panel')
    .replace(/\binverters\b/g, 'inverter')
    .replace(/\bkilowatts?\b/g, 'kw')
    .replace(/\bwatts?\b/g, 'w')
    .replace(/(\d+(?:\.\d+)?)\s*(kw|kwh|w|v|ah)\b/g, '$1$2')
    .replace(/\b(n|p)[\s-]+type\b/g, '$1type')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Cache per product object; typing does not rebuild 1,000+ search documents.
const documents = new WeakMap();
function searchDocument(product) {
  if (!documents.has(product)) {
    const primary = normalizeSearch([product.name, product.brand, product.model].join(' '));
    const specs = normalizeSearch(product.specs || '');
    documents.set(product, { primary, words: (primary + ' ' + specs).split(' ') });
  }
  return documents.get(product);
}

function oneEditApart(left, right) {
  if (Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    const differences = [];
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) differences.push(i);
    return (
      differences.length <= 1 ||
      (differences.length === 2 &&
        differences[1] === differences[0] + 1 &&
        left[differences[0]] === right[differences[1]] &&
        left[differences[1]] === right[differences[0]])
    );
  }
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let index = 0;
  while (index < shorter.length && shorter[index] === longer[index]) index++;
  return shorter.slice(index) === longer.slice(index + 1);
}

function scoreProduct(product, query, fuzzy) {
  const { primary, words } = searchDocument(product);
  const compactModel = normalizeSearch(product.model).replaceAll(' ', '');
  if (compactModel && compactModel === query.replaceAll(' ', '')) return 200;
  let score = 0;
  for (const token of query.split(' ')) {
    if (words.includes(token)) score += 20;
    // A capacity must match exactly: 6 kW must never silently become 16 kW.
    else if (!/\d/.test(token) && words.some((word) => word.startsWith(token))) score += 10;
    else if (
      fuzzy &&
      /^[a-z]{5,}$/.test(token) &&
      words.some((word) => /^[a-z]+$/.test(word) && oneEditApart(token, word))
    )
      score += 2;
    else return 0;
  }
  if (primary.includes(query)) score += 50;
  return score;
}

export function searchProducts(products, value) {
  const query = normalizeSearch(value);
  const published = products.filter((product) => product.status !== 'draft');
  if (!query) return published;
  const rank = (fuzzy) =>
    published
      .map((product) => ({ product, score: scoreProduct(product, query, fuzzy) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
      .map((result) => result.product);
  const exact = rank(false);
  // Typo tolerance is a fallback, so approximate matches cannot bury exact ones.
  return exact.length ? exact : rank(true);
}
