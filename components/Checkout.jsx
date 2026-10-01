'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {CreditCard,Truck,ShieldCheck,CheckCircle2} from 'lucide-react';
const money = amount => new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR'}).format(amount/100);
async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) { const error=new Error(data.error || 'Please try again.');error.status=response.status;throw error; }
  return data;
}
export default function Checkout({cart,products,done,params}) {
  const [config,setConfig]=useState(null),[method,setMethod]=useState('cod'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[order,setOrder]=useState(null),[submitted,setSubmitted]=useState(false);
  const key=useRef(null),cleared=useRef(false),lockedPayload=useRef(null);
  const orderId=params.get('order');
  useEffect(()=>{api('/api/payments/config').then(setConfig).catch(e=>setError(e.message));},[]);
  useEffect(()=>{
    if(!orderId)return;
    let active=true;
    async function refresh(){
      try {
        const saved=JSON.parse(sessionStorage.getItem('pp-checkout')||'null');
        if(!saved || saved.orderId!==orderId)throw new Error('Open this order in the browser used for checkout, or contact our team with your order reference.');
        const result=await api(`/api/orders/${encodeURIComponent(orderId)}`,{headers:{Authorization:`Bearer ${saved.key}`}});
        if(active){setOrder(result);setError('');}
      } catch(e){if(active)setError(e.message);}
    }
    refresh();const timer=setInterval(refresh,4000);
    return ()=>{active=false;clearInterval(timer);};
  },[orderId]);
  useEffect(()=>{
    if(order && (order.paymentStatus==='paid'||order.paymentMethod==='cod')&&!cleared.current){
      cleared.current=true;
      if(!sessionStorage.getItem(`pp-checkout-cleared:${order.id}`)){done(order.items);sessionStorage.setItem(`pp-checkout-cleared:${order.id}`,'1');}
      sessionStorage.removeItem('pp-checkout-draft');
    }
  },[order,done]);
  const lines=cart.map(item=>({...item,product:products.find(p=>p.id===item.id)}));
  const invalid=lines.some(({product:p,quantity})=>!p||p.status!=='published'||!Number.isFinite(p.price)||p.price<=0||p.stock<quantity||['out-of-stock','on-request'].includes(p.availability)||quantity<(p.minQuantity||1));
  const total=lines.reduce((sum,i)=>sum+Math.round((i.product?.price||0)*100)*i.quantity,0);
  async function submit(e){
    e.preventDefault();if(busy)return;setBusy(true);setError('');
    try {
      const values=Object.fromEntries(new FormData(e.currentTarget));
      const {paymentChoice,whatsappConsent,...details}=values;
      const payload=lockedPayload.current||{...details,paymentMethod:method,items:cart,expectedTotal:total,whatsappConsent:whatsappConsent==='on'};
      const fingerprint=JSON.stringify(payload);
      const draft=JSON.parse(sessionStorage.getItem('pp-checkout-draft')||'null');
      if(draft && draft.fingerprint!==fingerprint)throw new Error('A previous checkout needs to be resumed with its original details. Reload to restore those details.');
      key.current=draft?.key||key.current||crypto.randomUUID();
      sessionStorage.setItem('pp-checkout-draft',JSON.stringify({key:key.current,fingerprint,payload}));
      lockedPayload.current=payload;setSubmitted(true);
      const result=await api('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,checkoutKey:key.current})});
      sessionStorage.setItem('pp-checkout',JSON.stringify({key:key.current,orderId:result.order.id,checkoutUrl:result.checkoutUrl}));
      if(result.checkoutUrl){window.location.assign(result.checkoutUrl);return;}
      window.history.replaceState(null,'',`/checkout?order=${result.order.id}`);
    } catch(e){setError(e.message);if((e.status&&e.status<500&&e.status!==409)||e.status===503){sessionStorage.removeItem('pp-checkout-draft');lockedPayload.current=null;key.current=null;setSubmitted(false);}}finally{setBusy(false);}
  }
  useEffect(()=>{
    if(orderId)return;
    try{
      const draft=JSON.parse(sessionStorage.getItem('pp-checkout-draft')||'null');
      if(draft){key.current=draft.key;lockedPayload.current=draft.payload;setMethod(draft.payload.paymentMethod);setSubmitted(true);
        const form=document.getElementById('checkout-form');
        if(form?.elements.namedItem('whatsappConsent'))form.elements.namedItem('whatsappConsent').checked=Boolean(draft.payload.whatsappConsent);
        for(const [name,value] of Object.entries(draft.payload)){if(form?.elements.namedItem(name)&&typeof value==='string')form.elements.namedItem(name).value=value;}
      }
    }catch{}
  },[orderId]);
  async function cancelPayment(){
    setBusy(true);setError('');
    try{const saved=JSON.parse(sessionStorage.getItem('pp-checkout')||'null');const result=await api(`/api/orders/${order.id}/cancel`,{method:'POST',headers:{Authorization:`Bearer ${saved?.key}`}});setOrder(result);sessionStorage.removeItem('pp-checkout-draft');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if(orderId||order){
    const confirmed=order&&order.status!=='cancelled'&&(order.paymentMethod==='cod'||order.paymentStatus==='paid');
    return <section className="checkout-result quote-form" aria-live="polite"><CheckCircle2 size={44}/><h1>{confirmed?'Your order is confirmed':order?.status==='cancelled'?'Payment was not completed':'Waiting for payment confirmation'}</h1><p>{confirmed?(order.paymentMethod==='cod'?'Pay cash when your order is delivered. Our team will contact you to arrange delivery.':'Your card payment has been verified. Our team will arrange your delivery.'):'Your order is only confirmed after the payment provider verifies payment.'}</p>{params.get('cancelled')&&order?.paymentStatus==='pending'&&<p>You returned from card checkout. You can resume your payment below.</p>}<p className="order-reference">Reference: {order?.id||orderId}</p>{order&&<><p>Payment: <b>{order.paymentStatus.replaceAll('_',' ')}</b></p><p>Total: <b>{money(order.total)}</b></p></>}{error&&<p className="error" role="alert">{error}</p>}{order?.paymentStatus==='pending'&&<button className="primary" onClick={()=>{const saved=JSON.parse(sessionStorage.getItem('pp-checkout')||'null');if(saved?.checkoutUrl)window.location.assign(saved.checkoutUrl);else setError('Return to checkout and retry using your original details.');}}>Resume card payment</button>}<>{order?.paymentStatus==='pending'&&<button disabled={busy} className="secondary" onClick={cancelPayment}>{busy?'Cancelling…':'Cancel card payment'}</button>}{order?.status==='cancelled'&&<Link className="primary" href="/checkout" onClick={()=>{sessionStorage.removeItem('pp-checkout-draft');setOrder(null);setSubmitted(false);lockedPayload.current=null;key.current=null;}}>Return to checkout</Link>}</><Link className="secondary" href="/shop">Continue shopping</Link></section>;
  }
  if(!cart.length)return <section className="checkout-result"><h1>Your basket is empty</h1><Link href="/shop" className="primary">Browse solar products</Link></section>;
  return <><h1>Checkout</h1><p className="muted">Delivery within Pakistan. Choose how you would like to pay.</p><div className="checkout-layout"><form id="checkout-form" className="quote-form" onSubmit={submit}><h2>Delivery details</h2><fieldset disabled={busy||submitted} className="checkout-fields"><div className="form-row"><label>Full name *<input name="name" required maxLength={200} autoComplete="name"/></label><label>Phone number *<input name="phone" type="tel" required minLength={7} maxLength={25} autoComplete="tel"/></label></div><div className="form-row"><label>Email address<input name="email" type="email" autoComplete="email"/></label><label>City *<input name="city" required maxLength={200} autoComplete="address-level2"/></label></div><label>Delivery address *<textarea name="address" required minLength={10} maxLength={500} rows={3} autoComplete="street-address" placeholder="House / building, street and area"/></label><label>Order notes<textarea name="message" maxLength={3000} rows={2} placeholder="Delivery instructions (optional)"/></label><label className="checkout-opt-in"><input type="checkbox" name="whatsappConsent"/><span>Send my order confirmation to this phone number on WhatsApp.</span></label><p className="muted">Add your email above to receive an order confirmation by email.</p><fieldset className="payment-methods"><legend>Payment method</legend><label className={`payment-choice ${method==='cod'?'selected':''}`}><input type="radio" name="paymentChoice" value="cod" checked={method==='cod'} onChange={()=>setMethod('cod')}/><Truck size={25}/><span><b>Cash on Delivery (COD)</b><small>Pay cash when you receive your order.</small></span></label><label className={`payment-choice ${method==='card'?'selected':''} ${!config?.card?'unavailable':''}`}><input type="radio" name="paymentChoice" value="card" disabled={!config?.card} checked={method==='card'} onChange={()=>setMethod('card')}/><CreditCard size={25}/><span><b>Credit / Debit Card</b><small>{config?.card?(config.testMode?'Test mode — no real money is charged.':'Pay securely on Stripe Checkout.'):'Currently unavailable. Please choose COD.'}</small></span></label></fieldset></fieldset>{error&&<p className="error" role="alert">{error}</p>}{invalid&&!submitted&&<p className="error">Some items need a confirmed price or stock quantity. <Link href="/quote">Request a quotation</Link> or update your basket.</p>}<button className="primary" disabled={busy||!config||(invalid&&!submitted)}>{busy?'Processing…':submitted?'Retry checkout':method==='cod'?'Place order — Cash on Delivery':'Continue to secure card payment'}</button><p className="checkout-security"><ShieldCheck size={17}/> Card details are entered only on the payment provider’s secure page.</p></form><aside className="checkout-summary"><h2>Order summary</h2>{lines.map(i=><div className="checkout-line" key={i.id}><img src={i.product?.image||'/images/panel.svg'} alt=""/><span>{i.product?.name||'Unavailable product'}<small>Quantity: {i.quantity}</small></span><b>{i.product?.price>0?money(Math.round(i.product.price*100)*i.quantity):'Quote required'}</b></div>)}<div className="checkout-total"><span>Product total</span><b>{money(total)}</b></div><p>Delivery or installation charges, if applicable, will be agreed with you separately before dispatch. Card payment covers the products shown above.</p><Link href="/cart">Edit basket</Link><Link href="/quote">Request a quotation instead</Link></aside></div></>;
}
