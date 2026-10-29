/* ProbaLab consent banner + Google Consent Mode v2 + GA4.
   Everything defaults to denied for every visitor. gtag.js (GA4) is only fetched after the
   visitor clicks Accept, so no Google Analytics request or cookie happens before consent.
   The choice is remembered in localStorage ("pl_consent"). */
(function(){
  var GA = 'G-SS0L9DMVG3', K = 'pl_consent';
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  var D = {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'};
  var G = {ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'};
  gtag('consent','default',D);
  gtag('set','ads_data_redaction',true);
  var loaded = false;
  function loadGA(){
    if (loaded) return; loaded = true;
    gtag('js', new Date()); gtag('config', GA);
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
    (document.head || document.documentElement).appendChild(s);
  }
  window.plConsent = function(c){
    try{ localStorage.setItem(K,c); }catch(_){}
    gtag('consent','update', c==='granted' ? G : D);
    if (c==='granted') loadGA();
  };
  var saved = null; try{ saved = localStorage.getItem(K); }catch(e){}
  if (saved==='granted'){ gtag('consent','update',G); loadGA(); return; }
  if (saved==='denied') return;
  function show(){
    var b=document.createElement('div');
    b.id='pl-consent'; b.setAttribute('role','dialog'); b.setAttribute('aria-label','Cookie consent');
    b.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:560px;margin:0 auto;background:#11131f;color:#e8e9f0;border:1px solid #2a2d40;border-radius:10px;padding:14px 16px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4)';
    b.innerHTML='We\'d like to use Google Analytics cookies to see how the site is used, and ad cookies. Nothing is set unless you accept. <a href="/privacy" style="color:#8ab4ff">Privacy policy</a><div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end"><button type="button" data-c="denied" style="padding:6px 14px;border-radius:6px;border:1px solid #555;background:transparent;color:inherit;cursor:pointer">Decline</button><button type="button" data-c="granted" style="padding:6px 14px;border-radius:6px;border:0;background:#3b6cff;color:#fff;cursor:pointer">Accept</button></div>';
    b.addEventListener('click',function(e){
      var c=e.target.getAttribute&&e.target.getAttribute('data-c'); if(!c) return;
      window.plConsent(c); b.remove();
    });
    document.body.appendChild(b);
  }
  if(document.body) show(); else document.addEventListener('DOMContentLoaded',show);
})();
