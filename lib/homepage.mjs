import {categoryIdsFor,inCategory} from './catalog.mjs';
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
