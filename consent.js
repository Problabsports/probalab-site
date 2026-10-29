/* ProbaLab lightweight consent banner + Google Consent Mode v2.
   Loads before adsbygoogle.js / gtag. EEA, UK and CH default to denied;
   elsewhere defaults to granted. Choice stored in localStorage. */
(function(){
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  var R = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','GB','CH'];
  var D = {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'};
  var G = {ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'};
  gtag('consent','default',Object.assign({region:R,wait_for_update:500},D));
  gtag('consent','default',G);
  gtag('set','ads_data_redaction',true);
  var K='pl_consent', saved=null;
  try{ saved=localStorage.getItem(K); }catch(e){}
  if(saved==='granted') gtag('consent','update',G);
  if(saved==='denied') gtag('consent','update',D);
  if(saved) return;
  var tz=''; try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''; }catch(e){}
  if(tz.indexOf('Europe/')!==0 && tz!=='Atlantic/Reykjavik' && tz!=='Atlantic/Canary' && tz!=='Atlantic/Madeira') return;
  function show(){
    var b=document.createElement('div');
    b.setAttribute('role','dialog'); b.setAttribute('aria-label','Cookie consent');
    b.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:560px;margin:0 auto;background:#11131f;color:#e8e9f0;border:1px solid #2a2d40;border-radius:10px;padding:14px 16px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)';
    b.innerHTML='We use cookies for ads and analytics. You can accept or reject non-essential cookies. <a href="/privacy" style="color:#8ab4ff">Privacy policy</a><div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end"><button data-c="denied" style="padding:6px 14px;border-radius:6px;border:1px solid #555;background:transparent;color:inherit;cursor:pointer">Reject</button><button data-c="granted" style="padding:6px 14px;border-radius:6px;border:0;background:#3b6cff;color:#fff;cursor:pointer">Accept</button></div>';
    b.addEventListener('click',function(e){
      var c=e.target.getAttribute&&e.target.getAttribute('data-c'); if(!c) return;
      try{ localStorage.setItem(K,c); }catch(_){}
      gtag('consent','update',c==='granted'?G:D); b.remove();
    });
    document.body.appendChild(b);
  }
  if(document.body) show(); else document.addEventListener('DOMContentLoaded',show);
})();
