'use client';
import {useState} from 'react';
export default function BrandingSettings(){
  const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[version,setVersion]=useState(0);
  async function upload(e){
    const file=e.target.files?.[0];if(!file)return;setBusy(true);setNotice('');
    try{if(file.size>2*1024*1024)throw Error('Choose a logo smaller than 2 MB.');const response=await fetch('/api/admin/branding/logo',{method:'PUT',headers:{'Content-Type':file.type},body:file});const result=await response.json();if(!response.ok)throw Error(result.error||'Logo upload failed');setVersion(Date.now());setNotice('Logo updated in the website header and footer.');}
    catch(error){setNotice(error.message);}finally{setBusy(false);e.target.value='';}
  }
  return <section className="admin-form branding-settings"><h3>Website logo</h3><img src={`/api/branding/logo?v=${version}`} alt="Current Power Planet logo"/><label>Upload the original logo (PNG, JPEG or WebP)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} disabled={busy}/></label><p>Use your white-background Power Planet logo. Maximum size: 2 MB.</p>{notice&&<p role="status">{notice}</p>}</section>;
}
