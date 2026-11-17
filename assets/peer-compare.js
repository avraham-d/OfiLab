/* ofiLab: compare your profile with another person's.
   The other person sends their save link (#p= or #e=) or their results file. Everything is
   decoded and scored here, in the browser: nothing is stored and nothing is sent.
   The comparison is descriptive (two self-reports side by side), not a compatibility test. */
(function(root){
'use strict';
const doc=root.document;
if(!doc)return;
const $=id=>doc.getElementById(id);
const KEYS=['N','E','O','A','C'];
let mine=null;
root.addEventListener('ofilab:results',event=>{mine=event?.detail?.profile||null;});

function el(tag,cls,text){const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
const pct=x=>{
  const v=Number.isFinite(x?.percentileExact)?x.percentileExact:Number(x?.percentile);
  return Number.isFinite(v)?v:Number(x?.score);
};
const round=v=>Math.round(Number(v));

function scoreAnswers(answers){
  const n=answers.length;
  if(n!==120&&n!==300)throw Error('הקישור או הקובץ אינם של שאלון 120 או 300.');
  if(answers.some(v=>!Number.isInteger(v)||v<1||v>5))throw Error('השאלון של האדם השני לא הושלם, אז אין עדיין מה להשוות.');
  const bank=JSON.parse($('data-bank-'+n).textContent);
  const core=root['AVDPersonalityCore'+n];
  const raw=core.calculate(bank,answers);
  return root.OfiEmpirical?.enrich?root.OfiEmpirical.enrich(raw,bank,answers,core):raw;
}
function tokenFrom(text){
  const s=String(text||'').trim();
  const m=s.match(/#(p|e)=([A-Za-z0-9_-]+)/);
  if(m)return {kind:m[1],token:m[2]};
  if(/^[A-Za-z0-9_-]{20,}$/.test(s)){
    const enc=root.OfiLabProtectedLinkRouting?.inventoryForToken?.(s);
    return {kind:enc?'e':'p',token:s};
  }
  return null;
}
async function decrypt(token,password){
  const inv=root.OfiLabProtectedLinkRouting?.inventoryForToken?.(token);
  if(!inv)throw Error('הקישור המוצפן אינו תקין.');
  if(!password)throw Object.assign(Error('הקישור מוצפן. כתבו את הסיסמה שקיבלתם מהאדם השני.'),{needsPassword:true});
  let bundle;
  try{bundle=await root.OfiLabSecureSave.decryptOnly(token,password,inv);}
  catch(e){throw Object.assign(Error('הסיסמה שגויה, או שהקישור נפגע בהעתקה.'),{needsPassword:true});}
  return root.OfiLabCompactV2.decode(bundle.plain).answers;
}
async function profileFromLink(text,password){
  const t=tokenFrom(text);
  if(!t)throw Error('לא נמצא בקישור קוד שמירה. העתיקו את הקישור המלא, עם ‎#p=‎ או ‎#e=‎.');
  if(t.kind==='e')return scoreAnswers(await decrypt(t.token,password));
  let state;
  try{state=root.OfiLabCompactV2.decode(t.token);}catch(e){throw Error('קוד השמירה בקישור אינו תקין.');}
  return scoreAnswers(Array.from(state.answers));
}
async function profileFromFile(text,password){
  let parsed=null;
  try{parsed=root.OfiLabResultsFiles.parse(text);}
  catch(e){
    if(e?.code==='LEGACY_50_DEPRECATED')throw e;
    let json=null;try{json=JSON.parse(text);}catch(_){/* not JSON */}
    const prof=json?.profile||json;
    if(prof?.domains&&KEYS.every(k=>prof.domains[k]?.facets?.length===6))return prof;
    throw e;
  }
  if(parsed.encryptedToken)return scoreAnswers(await decrypt(parsed.encryptedToken,password));
  return scoreAnswers(Array.from(parsed.answers));
}

function pearson(a,b){
  const n=a.length,ma=a.reduce((s,v)=>s+v,0)/n,mb=b.reduce((s,v)=>s+v,0)/n;
  let sab=0,saa=0,sbb=0;
  for(let i=0;i<n;i++){const x=a[i]-ma,y=b[i]-mb;sab+=x*y;saa+=x*x;sbb+=y*y;}
  return saa&&sbb?sab/Math.sqrt(saa*sbb):0;
}
function similarityWords(r){
  if(r>=0.6)return ['דומים מאוד','לפרופילים שלכם צורה כמעט זהה: אותם תחומים בולטים ואותם תחומים שקטים.'];
  if(r>=0.3)return ['דומים במידה ניכרת','יש לכם הרבה במשותף, עם כמה הבדלים ברורים.'];
  if(r>=0)return ['קצת דומים','יש תחומים משותפים, אבל ההבדלים בולטים לא פחות.'];
  if(r>=-0.3)return ['שונים למדי','במקומות רבים מה שבולט אצל אחד מכם שקט יותר אצל השני.'];
  return ['הפוכים בהרבה תחומים','הפרופילים כמעט משלימים זה את זה: מה שגבוה אצל אחד נמוך אצל השני.'];
}

function bar(value,cls){
  const track=el('span','peer-bar-track');
  const fill=el('span','peer-bar-fill '+cls);
  fill.style.inlineSize=Math.max(2,Math.min(100,value))+'%';
  track.append(fill);
  return track;
}
function render(other,name){
  const out=$('peerResult');out.replaceChildren();
  const them=name||'האדם השני';
  const facets=[];
  for(const k of KEYS){
    const md=mine.domains[k],od=other.domains[k];
    md.facets.forEach((f,i)=>facets.push({domain:md.label,label:f.label,me:pct(f),them:pct(od.facets[i])}));
  }
  const r=pearson(facets.map(f=>f.me),facets.map(f=>f.them));
  const [title,lead]=similarityWords(r);

  const head=el('div','peer-head');
  const legend=el('div','peer-legend');
  legend.append(el('span','peer-key is-me','אני'),el('span','peer-key is-them',them));
  const sim=el('div','peer-sim');
  sim.append(el('span','peer-sim-eyebrow','דמיון בצורת הפרופיל'),el('strong','peer-sim-title',title),el('p','peer-sim-lead',lead),
    el('span','peer-sim-meta','מתאם בין 30 תחומי המשנה: r = '+r.toFixed(2)));
  head.append(sim,legend);

  const domains=el('div','peer-domains');
  domains.append(el('h3','peer-h','חמש התכונות'));
  for(const k of KEYS){
    const md=mine.domains[k],od=other.domains[k],a=pct(md),b=pct(od),d=a-b;
    const row=el('div','peer-row');
    const top=el('div','peer-row-top');
    const verdict=Math.abs(d)<10?'קרובים':(d>0?'גבוה יותר אצלי':'גבוה יותר אצל '+them);
    top.append(el('strong',null,md.label),el('span','peer-tag'+(Math.abs(d)<10?' is-close':''),verdict));
    const bars=el('div','peer-bars');
    const l1=el('div','peer-bar-line');l1.append(el('span','peer-bar-who','אני'),bar(a,'is-me'),el('span','peer-bar-val',String(round(a))));
    const l2=el('div','peer-bar-line');l2.append(el('span','peer-bar-who',them),bar(b,'is-them'),el('span','peer-bar-val',String(round(b))));
    bars.append(l1,l2);
    row.append(top,bars);
    domains.append(row);
  }

  const sorted=[...facets].sort((x,y)=>Math.abs(y.me-y.them)-Math.abs(x.me-x.them));
  const lists=el('div','peer-lists');
  const diff=el('section','peer-list');
  diff.append(el('h3','peer-h','איפה אתם הכי שונים'));
  const ul1=el('ul');
  for(const f of sorted.slice(0,4)){
    const li=el('li');
    li.append(el('strong',null,f.label),el('span','peer-list-domain',f.domain),
      el('span','peer-list-vals','אני '+round(f.me)+' · '+them+' '+round(f.them)));
    ul1.append(li);
  }
  diff.append(ul1);
  const same=el('section','peer-list');
  same.append(el('h3','peer-h','איפה אתם הכי דומים'));
  const ul2=el('ul');
  for(const f of sorted.slice(-3).reverse()){
    const li=el('li');
    li.append(el('strong',null,f.label),el('span','peer-list-domain',f.domain),
      el('span','peer-list-vals','אני '+round(f.me)+' · '+them+' '+round(f.them)));
    ul2.append(li);
  }
  same.append(ul2);
  lists.append(diff,same);

  const note=el('p','peer-note','המספרים הם אחוזונים מול המדגם (0–100). זו השוואה בין שני דיווחים עצמיים: היא מראה במה אתם שונים, לא מי צודק או מי "טוב יותר". הבדל של פחות מ־10 נקודות יכול לנבוע מטעות מדידה. שום דבר מההשוואה לא נשמר.');
  const again=el('button','secondary peer-again','השוואה לאדם אחר');again.type='button';
  again.addEventListener('click',()=>{out.hidden=true;out.replaceChildren();$('peerCompareForm').hidden=false;$('peerLink').focus();});
  out.append(head,domains,lists,note,again);
  out.hidden=false;
  $('peerCompareForm').hidden=true;
  out.scrollIntoView?.({block:'start'});
}

function init(){
  const dialog=$('peerCompareDialog'),form=$('peerCompareForm');
  if(!dialog||!form)return;
  let fileText=null;
  const err=$('peerError'),pwRow=$('peerPasswordRow');
  const showError=msg=>{err.textContent=msg;err.hidden=!msg;};
  $('openPeerCompare')?.addEventListener('click',()=>{
    if(!mine){root.alert('יש לסיים את השאלון לפני השוואה.');return;}
    showError('');
    if(!dialog.open)dialog.showModal();
    if(form.hidden===false)setTimeout(()=>$('peerLink').focus(),30);
  });
  $('closePeerCompare')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{$('peerPassword').value='';});
  $('peerLink').addEventListener('input',()=>{
    fileText=null;$('peerFileName').textContent='';
    const t=tokenFrom($('peerLink').value);
    pwRow.hidden=!(t&&t.kind==='e');
    showError('');
  });
  $('peerFile').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';
    if(!file)return;
    if(file.size>2*1024*1024){showError('הקובץ גדול מדי.');return;}
    fileText=await file.text();
    $('peerLink').value='';
    $('peerFileName').textContent=file.name;
    let enc=false;try{enc=Boolean(JSON.parse(fileText)?.encryptedToken);}catch(_){/* reported on submit */}
    pwRow.hidden=!enc;
    showError('');
  });
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    showError('');
    const link=$('peerLink').value.trim();
    if(!link&&!fileText){showError('הדביקו את הקישור של האדם השני, או בחרו את קובץ התוצאות שלו.');return;}
    const btn=$('peerSubmit');btn.disabled=true;const label=btn.textContent;btn.textContent='מחשב…';
    try{
      const pw=$('peerPassword').value;
      const other=fileText?await profileFromFile(fileText,pw):await profileFromLink(link,pw);
      const name=$('peerName').value.trim().slice(0,24);
      render(other,name);
    }catch(error){
      if(error?.needsPassword){pwRow.hidden=false;$('peerPassword').focus();}
      showError(error?.message||'לא הצלחנו לקרוא את הנתונים.');
    }finally{btn.disabled=false;btn.textContent=label;}
  });
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
root.OfiPeerCompare={tokenFrom,pearson,similarityWords};
})(typeof window!=='undefined'?window:globalThis);
