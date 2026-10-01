'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,ChevronLeft,ChevronRight,Pause,Play,Sun,Zap} from 'lucide-react';
import brandAssets from '../lib/featured-brands.json';
import {homepageSlides} from '../lib/homepage.mjs';
import {priceLabel,categoryIdsFor,inCategory} from '../lib/catalog.mjs';

function useReducedMotion(){
  const [reduced,setReduced]=useState(true);
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  return reduced;
}
export function DealHero({products,categories,settings}){
  const slides=useMemo(()=>homepageSlides(products,categories),[products,categories]);
  const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  const reduced=useReducedMotion(),touchStart=useRef(null);const slide=index===0&&settings?.heroTitle?{...slides[index],title:settings.heroTitle}:slides[index];
  const move=direction=>setIndex(current=>(current+direction+slides.length)%slides.length);
  useEffect(()=>{if(paused||hovered||focused||reduced)return;const timer=setInterval(()=>{if(!document.hidden)setIndex(i=>(i+1)%slides.length);},6000);return()=>clearInterval(timer);},[paused,hovered,focused,reduced,slides.length]);
  return <section className={`deal-hero tone-${slide.tone}`} role="region" aria-roledescription="carousel" aria-label="Solar deals" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocusCapture={()=>setFocused(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocused(false);}} onTouchStart={e=>{touchStart.current=e.touches[0].clientX;}} onTouchEnd={e=>{if(touchStart.current!==null){const delta=e.changedTouches[0].clientX-touchStart.current;if(Math.abs(delta)>50)move(delta<0?1:-1);touchStart.current=null;}}}>
    <div className="deal-sun" aria-hidden="true"><Sun/></div>
    <div className="deal-content" key={slide.category} role="group" aria-roledescription="slide" aria-label={`${index+1} of ${slides.length}`}>
      <div className="deal-copy"><span className="deal-eyebrow"><Zap size={15}/>{slide.eyebrow}</span><h1>{slide.title.split('\n').map((text,i)=><span key={i}>{text}<br/></span>)}</h1><p className="deal-product-name">{slide.product?.name||'Explore solar products for your home and business.'}</p>{slide.product&&<div className="deal-price">{slide.saving>0&&<del>{priceLabel(slide.product.originalPrice)}</del>}<strong>{priceLabel(slide.product.price)}</strong></div>}<Link href={slide.href} className="primary">{slide.saving>0?'Explore this deal':'Explore collection'}<ArrowRight size={18}/></Link><p className="deal-note">{slide.product?.minQuantity>1?`Minimum order: ${slide.product.minQuantity} units. `:''}Confirm current price & availability with our team.</p></div>
      <Link className="deal-art" href={slide.href} aria-label={slide.product?`View ${slide.product.name}`:'Explore solar collection'}><span className="deal-orbit"/><img src={slide.image} alt={slide.product?.name||'Solar product collection'} fetchPriority={index===0?'high':'auto'}/>{slide.saving>0?<span className="deal-saving">Save<strong>{priceLabel(slide.saving)}</strong></span>:<span className="deal-saving">POWER PLANET<strong>The Power you Own</strong></span>}</Link>
    </div>
    <div className="deal-controls"><div className="carousel-dots">{slides.map((s,i)=><button key={s.category} aria-label={`Show slide ${i+1}`} aria-pressed={i===index} className={i===index?'selected':''} onClick={()=>setIndex(i)}/>)}</div><span className="deal-counter">0{index+1} / 0{slides.length}</span><div className="deal-arrows"><button aria-label={paused?'Play slideshow':'Pause slideshow'} onClick={()=>setPaused(!paused)}>{paused?<Play size={16}/>:<Pause size={16}/>}</button><button aria-label="Previous slide" onClick={()=>move(-1)}><ChevronLeft size={20}/></button><button aria-label="Next slide" onClick={()=>move(1)}><ChevronRight size={20}/></button></div></div>
  </section>;
}
export function FeaturedBrands({products}){
  const preferred=['Knox','DONGJIN POWER','Solis','Itel Energy','PylonTech','GOODWE','Ecoflow','Astronergy Solar','Ziewnic','Crown Solar Energy','Volnex'];
  const available=new Set(products.filter(p=>p.status!=='draft').map(p=>p.brand?.toLowerCase()));
  const brands=brandAssets.filter(b=>available.has(b.name.toLowerCase())).sort((a,b)=>(preferred.includes(a.name)?preferred.indexOf(a.name):999)-(preferred.includes(b.name)?preferred.indexOf(b.name):999));
  const rail=useRef(null),[page,setPage]=useState(0),[pages,setPages]=useState(1),[hovered,setHovered]=useState(false);const reduced=useReducedMotion();
  const go=next=>{if(rail.current)rail.current.scrollTo({left:next*rail.current.clientWidth,behavior:reduced?'instant':'smooth'});};
  useEffect(()=>{const node=rail.current;if(!node)return;const measure=()=>{if(node.clientWidth<=0)return;setPages(Math.max(1,Math.ceil((node.scrollWidth-1)/node.clientWidth)));setPage(node.scrollLeft>=node.scrollWidth-node.clientWidth-2?Math.max(0,Math.ceil((node.scrollWidth-1)/node.clientWidth)-1):Math.round(node.scrollLeft/node.clientWidth));};const observer=new ResizeObserver(measure);observer.observe(node);measure();return()=>observer.disconnect();},[brands.length]);
  useEffect(()=>{if(reduced||hovered||pages<2)return;const timer=setInterval(()=>{if(!document.hidden&&!rail.current?.contains(document.activeElement))go((page+1)%pages);},7000);return()=>clearInterval(timer);},[reduced,hovered,pages,page]);
  if(!brands.length)return null;
  return <section className="container showcase-section featured-brands" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} aria-label="Featured brands"><div className="showcase-heading"><h2>Featured Brand</h2><span/></div><div className="brand-carousel"><button className="brand-arrow before" aria-label="Previous brands" onClick={()=>go((page-1+pages)%pages)} disabled={pages<2}><ChevronLeft/></button><div className="brand-rail" ref={rail} onScroll={()=>{const node=rail.current;if(node&&node.clientWidth>0)setPage(node.scrollLeft>=node.scrollWidth-node.clientWidth-2?pages-1:Math.min(pages-1,Math.round(node.scrollLeft/node.clientWidth)));}}>{brands.map(b=><Link className="brand-tile" key={b.name} href={`/shop?brand=${encodeURIComponent(b.name)}`} aria-label={`Shop ${b.name}`}><img src={b.image} alt={b.name} loading="lazy"/></Link>)}</div><button className="brand-arrow after" aria-label="Next brands" onClick={()=>go((page+1)%pages)} disabled={pages<2}><ChevronRight/></button></div><div className="carousel-dots brand-dots">{Array.from({length:pages},(_,i)=><button key={i} aria-label={`Show brands page ${i+1}`} aria-pressed={page===i} className={page===i?'selected':''} onClick={()=>go(i)}/>)}</div></section>;
}
export function HomeCatalog({categories,products}){
  const roots=categories.filter(c=>!c.parentId);
  return <section className="container showcase-section home-catalog" aria-label="Our catalog"><div className="showcase-heading"><h2>Our Catalog</h2><span/></div><div className="home-catalog-grid">{roots.map(root=>{const children=categories.filter(c=>c.parentId===root.id);const count=products.filter(p=>inCategory(p,categoryIdsFor(categories,root.id))).length;return <section key={root.id}><h3><Link href={`/category/${root.id}`}>{root.name}</Link><small>{count}</small></h3>{children.map(c=><Link key={c.id} href={`/category/${c.id}`}><ChevronRight size={15}/>{c.name}</Link>)}<Link className="catalog-all" href={`/category/${root.id}`}><ChevronRight size={15}/>All {root.name.toLowerCase()}</Link></section>;})}</div></section>;
}
