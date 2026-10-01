import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { categories, samples } from './catalog.mjs';
const path = process.env.DB_PATH || resolve('data/store.sqlite');
mkdirSync(dirname(path),{recursive:true});
export const db = new DatabaseSync(path);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(collection,id));
CREATE TABLE IF NOT EXISTS admins (email TEXT PRIMARY KEY,hash TEXT NOT NULL,salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,email TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
export const all = c => db.prepare('SELECT data FROM records WHERE collection=? ORDER BY rowid DESC').all(c).map(r=>JSON.parse(r.data));
export const get = (c,id) => { const r=db.prepare('SELECT data FROM records WHERE collection=? AND id=?').get(c,id); return r?JSON.parse(r.data):null; };
export const put = (c,item) => { db.prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET data=excluded.data').run(c,item.id,JSON.stringify(item)); return item; };
export const remove = (c,id) => db.prepare('DELETE FROM records WHERE collection=? AND id=?').run(c,id);
if (!db.prepare('SELECT value FROM meta WHERE key=?').get('seeded')) {
 db.exec('BEGIN');
 try {
 categories.forEach(c=>put('categories',c)); samples.reverse().forEach(p=>put('products',p));
 put('settings',{id:'store',name:'Powerplanet',tagline:'Your solar energy partner',phone:'+92 301 4101700',email:'',address:'',facebook:'https://www.facebook.com/Powerplanet.1/',whatsapp:'923014101700',heroTitle:'Power your world.\nWith the sun.',heroSubtitle:'Explore solar panels, inverters, batteries and complete solar solutions — all in one place.',catalogNotice:'Catalog preview: product availability, specifications and prices are awaiting confirmation from Powerplanet.'});
 put('faqs',{id:'contact',question:'How can I contact Power Planet?',keywords:'contact,phone,whatsapp,number,rabta,call',answer:'Power Planet se rabta karein: +92 301 4101700. WhatsApp: https://wa.me/923014101700. Aap quotation form ke zariye bhi apni requirements bhej sakte hain.'});
 put('faqs',{id:'solar',question:'How do I choose a solar system?',keywords:'solar,system,package,ghar,home,kw',answer:'Share your monthly electricity usage, city and backup needs using our quotation form. Our team can help you choose panels, an inverter and battery storage.'});
 put('faqs',{id:'price',question:'What are your prices?',keywords:'price,rate,cost,kitna,qeemat',answer:'Please request a quotation for current prices. We confirm the specification, availability and total cost before accepting an order.'});
 put('faqs',{id:'delivery',question:'Do you offer delivery?',keywords:'delivery,shipping,deliver,courier',answer:'Please share your city in a quotation request. The team will confirm delivery options, charges and timing.'});
 put('faqs',{id:'warranty',question:'What warranty is included?',keywords:'warranty,guarantee',answer:'Warranty depends on the product and manufacturer. Ask the team to confirm the exact warranty terms with your quotation.'});
 db.prepare('INSERT INTO meta VALUES(?,?)').run('seeded','1'); db.exec('COMMIT');
 } catch(e) {db.exec('ROLLBACK');throw e;}
}
