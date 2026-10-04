import { categoryIdsFor, inCategory } from './catalog.mjs';

// Keep the homepage focused on the three requested solar collections.
export const solarCollections = [
  {
    category: 'solar-panels',
    title: 'Solar Panels',
    image: '/images/solar-home/solar-panels.png',
    banner: '/images/solar-home/solar-range.png',
    artwork: '/images/solar-home/solar-portrait.webp',
    artworkWidth: 1000,
    artworkHeight: 1616,
  },
  {
    category: 'hybrid-inverters',
    title: 'Hybrid Solar Inverters',
    image: '/images/solar-home/hybrid-inverters.png',
    banner: '/images/solar-home/solar-inverters.png',
    artwork: '/images/solar-home/hybrid-banner.png',
    artworkWidth: 1617,
    artworkHeight: 300,
  },
  {
    category: 'lithium-ion-batteries',
    title: 'Lithium Batteries & ESS Energy',
    image: '/images/solar-home/lithium-batteries.png',
    banner: '/images/solar-home/solar-storage.png',
    artwork: '/images/solar-home/solar-storage.png',
    artworkWidth: 1400,
    artworkHeight: 520,
  },
];

export function collectionProducts(products, categories, collection) {
  const ids = categoryIdsFor(categories, collection.category);
  // ESS and voltage-specific storage can be sibling categories in imported catalogs.
  if (collection.category === 'lithium-ion-batteries') {
    for (const category of ['low-voltage-lithium-batteries', 'high-voltage-lithium-batteries', 'bess-lithium-systems']) {
      for (const id of categoryIdsFor(categories, category)) ids.add(id);
    }
  }
  return products
    .filter((product) => product.status !== 'draft' && inCategory(product, ids))
    .sort((a, b) => Number(b.featured) - Number(a.featured));
}

export function mobileHomepageSlides() {
  return solarCollections.map((collection) => ({
    ...collection,
    image: collection.banner.replace('.png', '-portrait.webp'),
    href: `/category/${collection.category}`,
  }));
}

export function homepageSlides(products,categories){
  const specs=[
    {category:'solar-panels',eyebrow:'POWER YOUR TOMORROW',title:'More sunshine.\nMore possibilities.',fallback:'/images/panel.svg',tone:'green'},
    {category:'solar-inverters',eyebrow:'SMARTER SOLAR STARTS HERE',title:'The heart of your\nsolar system.',fallback:'/images/inverter.svg',tone:'gold'},
    {category:'solar-batteries',eyebrow:'ENERGY THAT STAYS WITH YOU',title:'Keep the power.\nAfter sunset, too.',fallback:'/images/battery.svg',tone:'sage'},
    {category:'portable-systems',eyebrow:'POWER, WHERE LIFE TAKES YOU',title:'Take your energy\na little further.',fallback:'/images/portable.svg',tone:'cream'},
  ];
  return specs.map(spec=>{
    const matches=products.filter(p=>p.status==='published'&&p.price>0&&inCategory(p,categoryIdsFor(categories,spec.category)));
    matches.sort((a,b)=>Number(b.availability==='in-stock')-Number(a.availability==='in-stock')||Number(b.originalPrice>b.price)-Number(a.originalPrice>a.price)||Number(b.featured)-Number(a.featured)||a.price-b.price);
    const product=matches[0];
    return {...spec,product,image:product?.image||spec.fallback,href:product?`/product/${product.id}`:`/category/${spec.category}`,saving:product?.originalPrice>product?.price?product.originalPrice-product.price:0};
  });
}
