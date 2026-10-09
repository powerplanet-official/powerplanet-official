import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {get,put} from './db.mjs';
export function serveLogo(req,res){
  res.set('Cache-Control','no-cache');
  const saved=get('branding','logo');
  if(saved)return res.type(saved.mime).send(Buffer.from(saved.data,'base64'));
  // Serve the client's actual artwork byte-for-byte; never fall back to a redraw.
  const supplied=resolve('public/images/powerplanet-logo.png');
  return res.sendFile(existsSync(supplied)?supplied:resolve('public/images/powerplanet-logo-original.jpeg'));
}
export function uploadLogo(req,res){
  const bytes=req.body;
  if(!Buffer.isBuffer(bytes)||bytes.length<12)return res.status(400).json({error:'Choose a PNG, JPEG or WebP image'});
  const mime=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
  if(!mime)return res.status(400).json({error:'Choose a PNG, JPEG or WebP image'});
  put('branding',{id:'logo',mime,data:bytes.toString('base64'),updatedAt:new Date().toISOString()});res.json({ok:true});
}
