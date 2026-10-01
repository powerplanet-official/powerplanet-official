import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {db,all,get,put} from '../../server/db.mjs';
import {productSchema} from '../../server/product-schema.mjs';
const snapshot=JSON.parse(readFileSync('data/catalog-source/solar-catalog.json','utf8'));
if(snapshot.detailIssues?.length)throw Error('Product details or images are incomplete. Resolve enrichment errors before import.');
if(snapshot.errors?.length)throw Error('Category coverage is incomplete. Resolve collection errors before import.');
if(!snapshot.products?.length||!snapshot.coverage.every(c=>c.collected===c.expected))throw Error('Catalog coverage failed validation.');
for(const group of snapshot.menu){group.links.forEach((link,index)=>{const c=snapshot.categories.find(c=>c.sourceUrl===link.url&&c.parentId);if(c)c.sortOrder=index;});}
const ids=new Set(snapshot.categories.map(c=>c.id));
const selected=snapshot.products.map(p=>{
 if(!p.image.startsWith('/images/catalog/')||!existsSync('public'+p.image))throw Error(`Missing real photo: ${p.id}`);
 const parsed=productSchema.parse(p);
 for(const c of [parsed.categoryId,...parsed.categoryIds])if(!ids.has(c))throw Error(`Unknown category ${c}`);
 return {...parsed,id:p.id};
});
if(new Set(selected.map(p=>p.id)).size!==selected.length)throw Error('Duplicate product IDs');
// Keep a recoverable SQLite snapshot, including any existing inquiries and administrator records.
mkdirSync('data/backups',{recursive:true});const backup=resolve(`data/backups/before-catalog-${Date.now()}.sqlite`);db.exec(`VACUUM INTO '${backup.replaceAll("'","''")}'`);
db.exec('BEGIN');
try{
 for(const c of snapshot.categories){const old=get('categories',c.id);put('categories',{...old,...c});}
 for(const p of selected){const old=get('products',p.id);put('products',{...p,stock:old?.stock||0});}
 // Only the explicit starter examples are retired; user-created products are left intact.
 for(const p of all('products'))if(/^preview-\d+$/.test(p.id)&&p.source==='Illustrative catalog entry — not extracted from Facebook')put('products',{...p,status:'draft',featured:false});
 const settings=get('settings','store');if(settings.catalogNotice?.startsWith('Catalog preview:'))put('settings',{...settings,catalogNotice:''});
 put('catalog-imports',{id:'w11stop-solar',source:snapshot.source,importedAt:new Date().toISOString(),products:selected.length,brands:new Set(selected.map(p=>p.brand)).size,coverage:snapshot.coverage,detailIssues:snapshot.detailIssues||[]});
 db.exec('COMMIT');console.log(`Imported ${selected.length} real products and ${snapshot.categories.length} categories. Previous database backed up to ${backup}.`);
}catch(e){db.exec('ROLLBACK');throw e;}
