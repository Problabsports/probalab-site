// /tools: odds converter, fair price, value check and unit-size calculators. All maths runs in the browser; no prices are fetched.
import { shell, html } from "./_shared/site.js";

const BODY = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <span>Tools</span></nav>
<p class="eyebrow">// betting maths · calculators</p>
<h1>Odds tools</h1>
<p>Quick calculators for reading a price. Everything runs on your device. Your preferred odds format is remembered on this device.</p>

<section class="panel tool" id="convert"><h2>Odds converter</h2>
  <div class="tgrid">
    <label>Decimal<input id="cDec" inputmode="decimal" placeholder="1.80"></label>
    <label>American<input id="cUs" inputmode="text" placeholder="-125"></label>
    <label>Implied chance %<input id="cPct" inputmode="decimal" placeholder="55.6"></label>
  </div>
  <p class="small">Type in any box and the others update. Prices on ProbaLab show in your chosen format: <button type="button" class="oddsfmt">DEC ⇄</button> <span class="small">Example: <span class="odds" data-dec="1.8">1.80</span></span></p>
</section>

<section class="panel tool" id="fair"><h2>Fair price</h2>
  <div class="tgrid"><label>Win chance %<input id="fP" inputmode="decimal" placeholder="60"></label></div>
  <p class="out" id="fOut">Enter a win chance to see the minimum odds worth taking.</p>
</section>

<section class="panel tool" id="value"><h2>Value check</h2>
  <div class="tgrid">
    <label>Price (decimal)<input id="vD" inputmode="decimal" placeholder="1.95"></label>
    <label>Your / model win chance %<input id="vP" inputmode="decimal" placeholder="55"></label>
  </div>
  <p class="out" id="vOut">Enter a price and a win chance.</p>
</section>

<section class="panel tool" id="units"><h2>Unit size (quarter Kelly)</h2>
  <div class="tgrid">
    <label>Bank<input id="uB" inputmode="decimal" placeholder="1000"></label>
    <label>Price (decimal)<input id="uD" inputmode="decimal" placeholder="1.95"></label>
    <label>Win chance %<input id="uP" inputmode="decimal" placeholder="55"></label>
  </div>
  <p class="out" id="uOut">Enter your bank, the price and a win chance.</p>
  <p class="small">Quarter Kelly stakes a quarter of the full Kelly fraction to keep swings smaller. 1 unit = 1% of bank.</p>
</section>
<p class="small"><b>For entertainment, not advice.</b> These are maths helpers; they don't know anything about a game.</p>
<style>.tool .tgrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}.tool label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--muted,#9aa)}.tool input{font:inherit;font-size:16px;padding:8px 10px;border-radius:8px;border:1px solid var(--line,#334);background:transparent;color:inherit}.tool .out{font-size:16px;margin-top:10px}.tool .good{color:#2ecc71;font-weight:700}.tool .bad{color:#ff4d4d;font-weight:700}.tool .meh{color:#ff9f1a;font-weight:700}</style>
<script src="/odds.js"></script>
<script>
(function(){
  var $=function(i){return document.getElementById(i)}, num=function(v){v=String(v||"").replace(/[%,\\s]/g,"");return v===""?NaN:Number(v)};
  var F=function(d){return window.PLOdds?PLOdds.fmt(d,"dec")+" ("+PLOdds.fmt(d,"us")+")":d.toFixed(2)};
  function fromUs(a){return a>=100?1+a/100:a<=-100?1+100/-a:NaN}
  function setC(src){
    var d=src==="d"?num($("cDec").value):src==="u"?fromUs(num($("cUs").value)):100/num($("cPct").value);
    if(!(d>1)){return}
    if(src!=="d")$("cDec").value=d.toFixed(2);
    if(src!=="u")$("cUs").value=PLOdds.fmt(d,"us");
    if(src!=="p")$("cPct").value=(100/d).toFixed(1);
  }
  $("cDec").oninput=function(){setC("d")};$("cUs").oninput=function(){setC("u")};$("cPct").oninput=function(){setC("p")};
  $("fP").oninput=function(){var p=num(this.value)/100;$("fOut").innerHTML=p>0&&p<1?"Fair price <b>"+F(1/p)+"</b>. Take only odds above this.":"Enter a win chance between 1 and 99%."};
  function val(){var d=num($("vD").value),p=num($("vP").value)/100;if(!(d>1&&p>0&&p<1)){$("vOut").textContent="Enter a price and a win chance.";return}
    var imp=1/d,edge=p*d-1,c=edge>0.02?"good":edge>0?"meh":"bad",w=edge>0.02?"Value":edge>0?"Thin edge":"No value";
    $("vOut").innerHTML='<span class="'+c+'">● '+w+"</span> · Edge "+(edge*100).toFixed(1)+"% · Implied "+(imp*100).toFixed(1)+"% vs your "+(p*100).toFixed(1)+"% · Fair price "+F(1/p)}
  $("vD").oninput=val;$("vP").oninput=val;
  function units(){var b=num($("uB").value),d=num($("uD").value),p=num($("uP").value)/100;if(!(b>0&&d>1&&p>0&&p<1)){$("uOut").textContent="Enter your bank, the price and a win chance.";return}
    var k=(p*d-1)/(d-1);if(k<=0){$("uOut").innerHTML='<span class="bad">● No bet</span>: no edge at this price.';return}
    var f=k/4,stake=b*f;$("uOut").innerHTML='<span class="good">● Stake '+stake.toFixed(2)+"</span> · "+(f*100).toFixed(2)+"% of bank = "+(f*100).toFixed(1)+" units (full Kelly "+(k*100).toFixed(1)+"%)"}
  ["uB","uD","uP"].forEach(function(i){$(i).oninput=units});
})();
</script>`;

export async function onRequestGet() {
  return html(shell({ title: "Odds tools: converter, fair price, value and stake calculators | ProbaLab", description: "Convert decimal, American and implied-chance odds, work out a fair price, check value and size a quarter-Kelly stake.", path: "/tools", body: BODY }));
}
export const onRequestHead = async (ctx) => { const r = await onRequestGet(ctx); return new Response(null, { status: r.status, headers: r.headers }); };
