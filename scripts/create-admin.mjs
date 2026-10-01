import { existsSync } from 'node:fs';
import { randomBytes,scryptSync } from 'node:crypto';
if(existsSync('.env'))process.loadEnvFile('.env');
const {db}=await import('../server/db.mjs');
const email=process.env.ADMIN_EMAIL?.toLowerCase();const password=process.env.ADMIN_PASSWORD;
if(!email||!email.includes('@')||!password||password.length<12){console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in .env.');process.exit(1);}
const salt=randomBytes(16).toString('hex');const hash=scryptSync(password,salt,64).toString('hex');
db.prepare('INSERT INTO admins VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET hash=excluded.hash,salt=excluded.salt').run(email,hash,salt);db.prepare('DELETE FROM sessions WHERE email=?').run(email);console.log('Administrator created / password updated.');
