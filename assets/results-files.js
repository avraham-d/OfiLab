/* Portable ofiLab backups. Parsing never trusts exported scores or HTML;
   results are recalculated from validated answers by the existing controller. */
(function(root){
'use strict';
const FORMAT='ofilab-results',VERSION=1,MAX_BYTES=2*1024*1024;
const inventories={120:'ipip-neo-120',300:'ipip-neo-300'};
function check(ok,message){if(!ok)throw Error(message);}
function validateAnswers(answers){
  check(Array.isArray(answers)&&Object.hasOwn(inventories,answers.length),'מספר התשובות בקובץ אינו נתמך.');
  check(Array.from(answers).every(n=>Number.isInteger(n)&&n>=1&&n<=5),'הקובץ חייב להכיל שאלון מלא עם תשובות 1–5.');
  return answers.length;
}
function validateSuppTokens(report){
  // Shape check, then a full decode when the codec is loaded (range and canonical form), as secure-save does.
  const decodes=(codec,token)=>{if(!codec||typeof codec.decode!=='function')return true;try{codec.decode(token);return true;}catch(_e){return false;}};
  if(report.hexacoToken!==undefined&&report.hexacoToken!==null)check(typeof report.hexacoToken==='string'&&/^[A-Za-z0-9_-]{7}$/.test(report.hexacoToken)&&decodes(root.OfiHexacoCodec,report.hexacoToken),'אסימון HEXACO בקובץ אינו תקין.');
  if(report.viaToken!==undefined&&report.viaToken!==null)check(typeof report.viaToken==='string'&&/^[A-Za-z0-9_-]{24}$/.test(report.viaToken)&&decodes(root.OfiViaCodec,report.viaToken),'אסימון VIA בקובץ אינו תקין.');
  if(report.ecrrsToken!==undefined&&report.ecrrsToken!==null)check(typeof report.ecrrsToken==='string'&&/^[A-Za-z0-9_-]{5}$/.test(report.ecrrsToken)&&decodes(root.OfiEcrrsCodec,report.ecrrsToken),'אסימון ECR-RS בקובץ אינו תקין.');
}
// Raw 1-5 answer of one exported question. scoredValue is already reverse-keyed (6-x for 'minus'
// items), so it is only a last-resort fallback and is turned back into the raw answer.
function rawAnswerOf(q){
  if(typeof q!=='object'||q===null)return Number(q);
  const direct=q.userChoice??q.choice??q.answer??q.value;
  if(direct!==undefined&&direct!==null)return Number(direct);
  if(q.scoredValue===undefined||q.scoredValue===null)return NaN;
  const scored=Number(q.scoredValue);
  return q.keyed==='minus'?6-scored:scored;
}
function parse(text){
  check(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX_BYTES,'הקובץ גדול מדי (עד 2MB).');
  let report;try{report=JSON.parse(text.replace(/^\uFEFF/,''));}catch(e){throw Error('זה אינו קובץ תוצאות JSON תקין.');}
  if(Array.isArray(report)){
    const rawAnswers=report.map(rawAnswerOf);
    report={format:FORMAT,fileVersion:VERSION,answers:rawAnswers,questions:report};
  }
  check(report&&typeof report==='object','מבנה הקובץ אינו תקין.');
  if(!Array.isArray(report.answers)&&Array.isArray(report.questions||report.items)){
    const list=report.questions||report.items;
    report.answers=list.map(rawAnswerOf);
  }
  if(report.format!==undefined)check((report.format===FORMAT||report.format==='ofilab-raw-questions'||report.format==='ofilab-questions-raw')&&report.fileVersion===VERSION,'פורמט או גרסת הקובץ אינם נתמכים.');
  else check(typeof report.title==='string'&&report.title.startsWith('ofiLab - ')&&Array.isArray(report.questions),'זה אינו קובץ תוצאות של ofiLab.');
  validateSuppTokens(report);
  if(report.encryptedToken!==undefined){
    check(report.format===FORMAT&&typeof report.encryptedToken==='string','קובץ מוצפן אינו תקין.');
    const token=report.encryptedToken;
    const depInv=root.OfiLabProtectedLinkRouting?.deprecatedInventoryForToken?.(token);
    if(depInv){const err=Error('גרסת 50 (IPIP-50) יצאה משימוש ואינה נטענת עוד. מומלץ לעבור לשאלון 120 או 300.');err.code='LEGACY_50_DEPRECATED';throw err;}
    const inventory=root.OfiLabProtectedLinkRouting?.inventoryForToken(token);
    check(inventory&&report.inventory===inventory,'גרסת השאלון בקובץ המוצפן אינה תואמת.');
    // Header routing is not authentication; authentication happens on password entry.
    const bytes=Uint8Array.from(root.atob(token.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    const canonical=root.btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    check(canonical===token&&bytes.length>=54&&bytes.length<=700,'קובץ מוצפן אינו תקין.');
    return {length:Number(Object.keys(inventories).find(n=>inventories[n]===inventory)),inventory,encryptedToken:token,hexacoToken:report.hexacoToken,...(report.viaToken?{viaToken:report.viaToken}:{}),...(report.ecrrsToken?{ecrrsToken:report.ecrrsToken}:{})};
  }
  if(report.inventory==='ipip-50'||(Array.isArray(report.answers)&&report.answers.length===50)){
    const err=Error('גרסת 50 (IPIP-50) יצאה משימוש ואינה נטענת עוד. מומלץ לעבור לשאלון 120 או 300.');
    err.code='LEGACY_50_DEPRECATED';
    throw err;
  }
  const length=validateAnswers(report.answers);
  if(report.inventory!==undefined)check(report.inventory===inventories[length],'גרסת השאלון אינה תואמת למספר התשובות.');
  if(report.questions!==undefined)check(Array.isArray(report.questions)&&report.questions.length===length,'רשימת השאלות אינה תואמת לתשובות.');
  return {length,inventory:inventories[length],answers:[...report.answers],hexacoToken:report.hexacoToken,...(report.viaToken?{viaToken:report.viaToken}:{}),...(report.ecrrsToken?{ecrrsToken:report.ecrrsToken}:{})};
}
function plainReport(report,length){
  check(validateAnswers(report.answers)===length,'גרסת השאלון אינה תואמת.');
  return {...report,format:FORMAT,fileVersion:VERSION,inventory:inventories[length]};
}
function rawQuestionsReport(report,length){
  check(validateAnswers(report.answers)===length,'גרסת השאלון אינה תואמת.');
  return {...report,format:FORMAT,type:'raw-questions',fileVersion:VERSION,inventory:inventories[length]};
}
function protectedReport(token,length){
  const report={format:FORMAT,fileVersion:VERSION,inventory:inventories[length],generatedAt:new Date().toISOString(),encryptedToken:token};
  parse(JSON.stringify(report));return report;
}
function targetUrl(saved,href,cores){
  const target=new URL(href);target.search='';target.searchParams.set('len',String(saved.length));
  target.hash=saved.encryptedToken?'e='+saved.encryptedToken:'p='+cores[saved.length].encode(saved.answers,saved.length-1);
  if(!saved.encryptedToken){
    if(saved.hexacoToken)target.hash+='&h='+saved.hexacoToken;
    if(saved.viaToken)target.hash+='&v='+saved.viaToken;
    if(saved.ecrrsToken)target.hash+='&a='+saved.ecrrsToken;
  }
  return target.toString();
}
const api={parse,plainReport,rawQuestionsReport,protectedReport,targetUrl,MAX_BYTES};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.OfiLabResultsFiles=api;
if(!root.document)return;
const input=root.document.getElementById('loadResultsFile'),button=root.document.getElementById('loadResultsButton'),status=root.document.getElementById('loadResultsStatus');
const homeButton=root.document.getElementById('loadResultsHome');
const footerButton=root.document.getElementById('footerLoadResults');
button?.addEventListener('click',()=>input.click());
homeButton?.addEventListener('click',()=>input.click());
footerButton?.addEventListener('click',()=>input.click());
input?.addEventListener('change',async()=>{
  const file=input.files?.[0];if(!file)return;
  if(button)button.disabled=true;if(homeButton)homeButton.disabled=true;if(footerButton)footerButton.disabled=true;
  if(status){status.textContent='קורא את הקובץ…';status.dataset.error='false';}
  try{
    check(file.size<=MAX_BYTES,'הקובץ גדול מדי (עד 2MB).');
    const saved=parse(await file.text());
    const target=targetUrl(saved,root.location.href,{120:root.AVDPersonalityCore120,300:root.AVDPersonalityCore300});
    if(!root.confirm('לטעון תוצאות של '+saved.length+' שאלות? השמירה במכשיר עבור גרסה זו עשויה להתחלף.'+(saved.encryptedToken?' לאחר הטעינה תתבקש הסיסמה.':''))){if(status)status.textContent='הטעינה בוטלה.';return;}
    if(typeof root.switchOfiLabInventory==='function'&&root.history?.replaceState){
      const nextUrl=new URL(target);
      root.history.replaceState(null,'',nextUrl.pathname+nextUrl.search+nextUrl.hash);
      root.switchOfiLabInventory(saved.length,false,{preserveHash:true,restoreFromHash:true});
      if(status)status.textContent='התוצאות נטענו בהצלחה.';
    }else{
      root.location.assign(target);
    }
  }catch(e){if(status){status.textContent=e.message||'לא ניתן לקרוא את הקובץ.';status.dataset.error='true';status.scrollIntoView({block:'center',behavior:'smooth'});}else{alert(e.message||'לא ניתן לקרוא את הקובץ.');}}
  finally{input.value='';if(button)button.disabled=false;if(homeButton)homeButton.disabled=false;if(footerButton)footerButton.disabled=false;}
});
})(typeof window!=='undefined'?window:globalThis);
