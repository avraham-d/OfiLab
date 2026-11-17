/* ofiLab footer: the two questionnaire buttons say what they will open.
   Each button opens that questionnaire's welcome screen; saved progress is never erased there.
   When this device holds progress or finished results, the button says so. Only the regular
   (unencrypted) save is read; nothing is written. */
(function(root){
'use strict';
const doc=root.document;
if(!doc)return;
async function saved(n){
  const store=root['AVDPersonalityStorage'+n],codec=root['OfiLabCodec'+n];
  if(!store||!codec)return 0;
  try{
    const token=await store.read(t=>{codec.decode(t);return true;});
    return token?codec.decode(token).answers.filter(v=>v>0).length:0;
  }catch(e){return 0;}
}
async function update(){
  for(const n of [120,300]){
    const btn=doc.querySelector('.ofi-footer-btn[data-inventory="'+n+'"]');
    const note=btn?.querySelector('small');
    if(!note)continue;
    const done=await saved(n);
    if(!done)continue;
    note.textContent=done>=n?'התוצאות שלך שמורות':'המשך · '+done+'/'+n;
    btn.classList.add('has-progress');
  }
}
const start=()=>setTimeout(update,400);
if(doc.readyState==='complete')start();else root.addEventListener('load',start);
root.addEventListener('ofilab:results',start);
})(typeof window!=='undefined'?window:globalThis);
