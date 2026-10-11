import express from 'express';
import helmet from 'helmet';
import { apiHeaders, apiRateLimit as rateLimit } from './http.mjs';
import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, all, get, put, remove } from './db.mjs';
import { productSchema } from './product-schema.mjs';
import { checkout, cancelCardOrder, paymentConfig, stripeWebhook, authorizedOrder, publicOrder, updateOrder, CheckoutError } from './payments.mjs';
import {notificationConfig,retryOrderNotifications} from './notifications.mjs';
import {serveLogo,uploadLogo} from './branding.mjs';
import { serveProductImage, uploadProductImage } from './product-images.mjs';
export const app=express();
app.disable('x-powered-by');app.use(helmet());
// Only trust proxy addresses explicitly confirmed by the hosting provider.
if (process.env.TRUSTED_PROXY_ADDRESSES) {
  app.set(
    'trust proxy',
    process.env.TRUSTED_PROXY_ADDRESSES.split(',').map(value => value.trim()),
  );
}
app.use('/api', apiHeaders);
app.post('/api/payments/stripe/webhook',express.raw({type:'application/json',limit:'1mb'}),stripeWebhook);
app.use(express.json({limit:'2mb'}));
// Public immutable photos should not consume the interactive API rate limit.
app.get('/api/product-images/:filename', serveProductImage);
app.use('/api',rateLimit({windowMs:60000,limit:180}));
app.use((req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'Cross-site requests are not allowed'});next();});
const tokenHash=t=>createHash('sha256').update(t).digest('hex');
const session=req=>{const t=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('pp_session='))?.slice(11);return t?db.prepare('SELECT email FROM sessions WHERE token=? AND expires>?').get(tokenHash(t),Date.now()):null;};
const auth=(req,res,next)=>session(req)?next():res.status(401).json({error:'Please sign in'});
const text=z.string().trim().min(1).max(200);
const product=productSchema;
const schemas={products:product,categories:z.object({name:text,parentId:z.string().nullable()}),faqs:z.object({question:text,keywords:text,answer:z.string().min(1).max(3000)}),settings:z.object({name:text,tagline:z.string().max(200),phone:z.string().max(50),email:z.union([z.email(),z.literal('')]),address:z.string().max(500),facebook:z.url().startsWith('https://'),whatsapp:z.string().regex(/^\d{7,15}$|^$/),heroTitle:text,heroSubtitle:z.string().max(500),catalogNotice:z.string().max(500)})};
app.get('/api/payments/config',(req,res)=>res.json(paymentConfig()));
app.post('/api/orders',rateLimit({windowMs:60000,limit:12}),async(req,res)=>res.status(201).json(await checkout(req.body)));
app.post('/api/orders/:id/cancel',async(req,res)=>res.json(await cancelCardOrder(req.params.id,req.get('authorization')?.replace(/^Bearer /,''))));
app.get('/api/orders/:id',(req,res)=>{res.set('Cache-Control','no-store');res.json(publicOrder(authorizedOrder(req.params.id,req.get('authorization')?.replace(/^Bearer /,''))));});
app.get('/api/branding/logo',serveLogo);
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.get('/api/store',(req,res)=>res.json({products:all('products').filter(p=>p.status!=='draft'),categories:all('categories').reverse(),settings:get('settings','store'),faqs:all('faqs')}));
app.post('/api/auth/login',rateLimit({windowMs:15*60000,limit:12}), (req,res)=>{
 const {email,password}=req.body||{};if(typeof email!=='string'||typeof password!=='string'||password.length>256)return res.status(400).json({error:'Invalid credentials'});
 const a=db.prepare('SELECT * FROM admins WHERE email=?').get(email.toLowerCase());
 const hash=scryptSync(password,a?.salt||'invalid-user-salt',64);if(!a||!timingSafeEqual(hash,Buffer.from(a.hash,'hex')))return res.status(401).json({error:'Incorrect email or password'});
 const t=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash(t),a.email,Date.now()+8*3600000);
 res.cookie('pp_session',t,{httpOnly:true,sameSite:'strict',secure:process.env.SECURE_COOKIES==='true',maxAge:8*3600000,path:'/'}).json({email:a.email});
});
app.get('/api/auth/me',(req,res)=>{const s=session(req);s?res.json(s):res.status(401).json({error:'Please sign in'});});
app.post('/api/auth/logout',(req,res)=>{const t=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('pp_session='))?.slice(11);if(t)db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash(t));res.clearCookie('pp_session',{path:'/'}).json({ok:true});});
const leadSchema=z.object({name:text,phone:z.string().trim().regex(/^[+\d\s()-]{7,25}$/),email:z.union([z.email(),z.literal('')]).default(''),city:text,message:z.string().max(3000).default(''),items:z.array(z.object({id:text,quantity:z.number().int().min(1).max(100)})).max(100).default([])});
app.post('/api/quotes',rateLimit({windowMs:60000,limit:8}),(req,res)=>{
 const b=leadSchema.parse(req.body);const items=b.items.map(i=>{const p=get('products',i.id);if(!p||p.status==='draft')throw new Error('Product is unavailable');if(i.quantity<(p.minQuantity||1))throw new CheckoutError(`Minimum quantity for ${p.name} is ${p.minQuantity}`);return {id:p.id,name:p.name,quantity:i.quantity,price:p.status==='published'?p.price:null};});
 const quote=put('quotes',{...b,items,id:randomUUID(),status:'new',createdAt:new Date().toISOString()});res.status(201).json({id:quote.id});
});
app.post('/api/chat',rateLimit({windowMs:60000,limit:30}),(req,res)=>{
 const {message}=z.object({message:z.string().trim().min(1).max(1000)}).parse(req.body);const lower=message.toLowerCase();const faqs=all('faqs');
 const matched=faqs.map(f=>({...f,score:f.keywords.split(',').map(k=>k.trim().toLowerCase()).filter(Boolean).filter(k=>lower.includes(k)).length})).sort((a,b)=>b.score-a.score)[0];
 const products=all('products').filter(p=>p.status==='published'&&lower.split(/\s+/).filter(w=>w.length>3).some(w=>p.name.toLowerCase().includes(w))).slice(0,3);
 let reply=matched?.score?matched.answer:'Assalam-o-Alaikum! I am Powerplanet’s automated assistant. I can help with solar systems, prices, delivery and warranties. For a personalized answer, send a quotation request and our team will follow up.';
 if(products.length)reply+='\n\n'+products.map(p=>`${p.name}: ${p.price===null?'Request current price':`PKR ${p.price.toLocaleString('en-PK')}`}`).join('\n');
 put('chats',{id:randomUUID(),message,reply,createdAt:new Date().toISOString()});res.json({reply,products:products.map(p=>p.id)});
});
app.use('/api/admin',auth);
app.post(
  '/api/admin/product-images',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '4mb' }),
  (error, req, res, next) => {
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Choose an image up to 4 MB.' });
    }
    next(error);
  },
  uploadProductImage,
);
app.put('/api/admin/branding/logo',express.raw({type:['image/png','image/jpeg','image/webp'],limit:'2mb'}),uploadLogo);
app.post('/api/admin/orders/:id/notifications/retry',(req,res)=>retryOrderNotifications(req.params.id)?res.json({ok:true}):res.status(404).json({error:'Order not found'}));
app.get('/api/admin/overview',(req,res)=>res.json({products:all('products'),categories:all('categories').reverse(),quotes:all('quotes'),orders:all('orders').map(({keyHash,fingerprint,checkoutUrl,...order})=>({...order,notifications:all('notifications').filter(n=>n.orderId===order.id).map(({to,...n})=>n)})),notificationConfig:notificationConfig(),chats:all('chats').slice(0,100),faqs:all('faqs'),settings:get('settings','store')}));
function validateRelations(c,value,id){
 if(c==='products'&&!get('categories',value.categoryId))throw new Error('Choose an existing category');
 if(c==='categories'&&value.parentId){let current=value.parentId;const seen=new Set([id]);while(current){if(seen.has(current))throw new Error('Category hierarchy cannot contain a cycle');seen.add(current);const parent=get('categories',current);if(!parent)throw new Error('Parent category does not exist');current=parent.parentId;}}
}
app.post('/api/admin/products/import',(req,res)=>{
 const rows=z.array(product).min(1).max(500).parse(req.body);rows.forEach(v=>validateRelations('products',v));db.exec('BEGIN');try{rows.forEach(v=>put('products',{...v,id:randomUUID()}));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}res.json({count:rows.length});
});
app.put('/api/admin/:collection/:id',(req,res)=>{
 const {collection:c,id}=req.params;
 if(c==='orders')return res.json(updateOrder(id,req.body));
 if(c==='quotes'){const q=get(c,id);if(!q)return res.status(404).json({error:'Quotation not found'});return res.json(put(c,{...q,status:z.enum(['new','contacted','quoted','completed','cancelled']).parse(req.body.status)}));}
 if(!schemas[c]||(c==='settings'&&id!=='store'))return res.status(404).json({error:'Not found'});
 const value=schemas[c].parse(req.body);validateRelations(c,value,id);res.json(put(c,{...value,id}));
});
app.delete('/api/admin/:collection/:id',(req,res)=>{const {collection:c,id}=req.params;if(!['products','categories','faqs'].includes(c))return res.status(400).json({error:'Cannot delete this record'});if(c==='categories'&&(all('products').some(p=>p.categoryId===id)||all('categories').some(p=>p.parentId===id)))return res.status(409).json({error:'Move products and subcategories before deleting this category'});remove(c,id);res.json({ok:true});});
app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found'}));
app.use((err,req,res,next)=>{if(err instanceof CheckoutError)return res.status(err.status).json({error:err.message});if(err instanceof z.ZodError)return res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});if(err.type==='entity.parse.failed')return res.status(400).json({error:'Invalid JSON'});console.error(err.message);res.status(400).json({error:['Choose an existing category','Product is unavailable','Category hierarchy cannot contain a cycle','Parent category does not exist'].includes(err.message)?err.message:'The request could not be processed'});});
