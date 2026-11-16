/* ofiLab Assistant v13.
 * UI-only: no user content is persisted or logged. Server owns scope, model and budgets.
 * Separate in-memory threads for each questionnaire item and the results view.
 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const dialog=$('aiDialog'),core=window.AVDPersonalityCore,markdown=window.OfiLabMarkdown;
 const resultsFab=$('resultsAiFab');
 if(!dialog||!core||!markdown)return;
 // The assistant needs a server: index.php sets data-ai-endpoint from ai-config.php.
 // Without one, every AI control is hidden (html[data-ai="off"]) and nothing is sent anywhere.
 const endpoint=document.documentElement.dataset.aiEndpoint||'';
 if(!/^\/[A-Za-z0-9._\/-]+$/.test(endpoint)){document.documentElement.dataset.ai='off';return;}
 let extendedForm=document.documentElement.dataset.inventory==='ipip-neo-300',total=extendedForm?300:120;
 let instrument=extendedForm?'ipip-neo-300':'ipip-neo-120';
 function syncInventory(){
   const inv=document.documentElement.dataset.inventory;
   extendedForm=inv==='ipip-neo-300';
   total=extendedForm?300:120;
   const next=extendedForm?'ipip-neo-300':'ipip-neo-120';
   if(next!==instrument){instrument=next;unlockedResultProfile=null;}
 }
 const store=new Map();
 const LIMIT=700,MAX_HISTORY=20,MAX_REQUEST_BYTES=11200;
 let active=null,working=false,controller=null,generation=0;
 let typing=null;
 let floatingLauncher=null;
 function syncFabState(opened){
   if(resultsFab)resultsFab.setAttribute('aria-expanded',String(opened));
 }


 function setStatus(text,error){
   const target=$('aiChatStatus');
   target.textContent=text;
   target.dataset.error=error?'true':'false';
 }
 function truncateUtf8(text,limit,maxChars=limit){
   const encoder=new TextEncoder();
   let out='',length=0,chars=0;
   for(const ch of String(text)){
     const size=encoder.encode(ch).length;
     if(chars+1>maxChars||length+size>limit)break;
     out+=ch;length+=size;chars++;
   }
   return out;
 }
 function scrollEnd(){
   const host=$('aiChatMessages');
   host.scrollTop=host.scrollHeight;
 }
 function stamp(){
   return new Date().toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});
 }
 function message(text,role,time){
   const host=$('aiChatMessages');
   const item=document.createElement('div');
   item.className='ai-message '+role;
   item._ofiText=text;
   if(role==='system'){
     const bubble=document.createElement('div');
     bubble.className='ai-chat-bubble system';bubble.textContent=text;
     item.append(bubble);host.append(item);scrollEnd();return item;
   }
   const avatar=document.createElement('div');
   avatar.className='ai-message-avatar';
   avatar.textContent=role==='assistant'?'AI':'';
   avatar.setAttribute('aria-hidden','true');
   const part=document.createElement('div');
   part.className='ai-message-content';
   const name=document.createElement('div');
   name.className='ai-message-name';
   name.textContent=role==='assistant'?'ofiLab AI':'אתה';
   const bubble=document.createElement('div');
   bubble.className='ai-chat-bubble '+role;
   if(role==='assistant'){
     bubble.classList.add('ai-richtext');
     bubble.append(markdown.render(text));
   }else bubble.textContent=text;
   const clock=document.createElement('time');
   clock.className='ai-message-time';
   clock.textContent=time||stamp();
   if(role!=='assistant')name.classList.add('sr-only');
   part.append(name,bubble,clock);
   if(role==='assistant'){
     const actions=document.createElement('div');
     actions.className='ai-message-actions';
     const copy=document.createElement('button');copy.type='button';copy.className='ai-copy-answer';
     copy.setAttribute('aria-label','העתקת תשובת העוזר');copy.textContent='העתקת תשובה';
     copy.addEventListener('click',async()=>{
       try{
         if(!navigator.clipboard||!window.isSecureContext)throw Error('Clipboard unavailable');
         await navigator.clipboard.writeText(item._ofiText);
         copy.textContent='הועתק ✓';copy.setAttribute('aria-label','התשובה הועתקה');
       }catch(e){setStatus('הדפדפן אינו מאפשר העתקה אוטומטית. אפשר לסמן ולהעתיק את הטקסט.',true);}
     });
     actions.append(copy);part.append(actions);
   }
   item.append(avatar,part);host.append(item);scrollEnd();return item;
 }
 function renderEmpty(){
   const host=$('aiChatMessages');
   host.replaceChildren();
   const empty=document.createElement('div');
   empty.className='ai-empty';
   const art=document.createElement('div');
   art.className='ai-empty-icon';
   art.setAttribute('aria-hidden','true');
   // Reuse our conversation symbol instead of the former oversized sparkle.
   const icon=resultsFab?.querySelector('.results-ai-icon')?.cloneNode(true);
   if(icon)art.append(icon);
   else art.textContent='o';
   const title=document.createElement('h3');
   title.textContent=active.mode==='question'?'על מה תרצה לשאול?':'איך אוכל לעזור לך להבין את התוצאות?';
    const paragraph=document.createElement('p');
    paragraph.textContent=active.mode==='question'
     ?'אפשר לשאול חופשי, לבקש דוגמה או לכתוב בדיוק מה מבלבל.'
     :'שאל שאלה חופשית על התכונות והציונים שלך, או בחר נושא להתחלה:';
    const quick=document.createElement('div');
    quick.className='ai-quick-prompts';
    const starters=active.mode==='question'
      ?['תסביר לי את זה בפשטות','אפשר דוגמה מהיומיום?','מה ההבדל בין 3 ל־4?']
      :[
        {
          label:'✨ הפק סיכום פרופיל מפורט בנקודות',
          prompt:'תן לי סיכום מפורט ומסודר בנקודות של הפרופיל שלי: תמונת על, חוזקות מרכזיות עם ציונים, ניגודים ופערים מעניינים בתוך תתי-התכונות, ונקודה מעשית ליומיום ולעבודה.'
        },
        {
          label:'⚡ ניגודים ופערים בתתי־התכונות שלי',
          prompt:'נתח לעומק בנקודות את הניגודים והפערים הבולטים בתוך תתי-התכונות שלי לעומת הציונים הכלליים, והסבר איך השילובים האלה מתבטאים בפועל.'
        },
        {
          label:'🎯 דגשים מעשיים לעבודה וליומיום',
          prompt:'לפי שילוב התכונות ותתי-התכונות שלי, סכם בנקודות מהם סגנון העבודה, קבלת ההחלטות והנקודות שכדאי לי לשים אליהן לב ביומיום.'
        }
      ];
    for(const suggestion of starters){
      const labelText=typeof suggestion==='string'?suggestion:suggestion.label;
      const promptText=typeof suggestion==='string'?suggestion.replace(/^[^\w\u0590-\u05FF]+\s*/,''):suggestion.prompt;
      const button=document.createElement('button');
      button.type='button';button.className='ai-quick-prompt';button.textContent=labelText;
      button.addEventListener('click',()=>{
        if(working)return;
        $('aiChatInput').value=promptText;
        updateCounter();adjustHeight();
        $('aiChatForm').requestSubmit();
      });
      quick.append(button);
    }
    empty.append(art,title,paragraph,quick);
    host.append(empty);
 }
 function renderThread(){
   $('aiChatMessages').replaceChildren();
   if(active.entries.length===0){renderEmpty();return;}
   for(const entry of active.entries)message(entry.text,entry.role,entry.time);
 }
 function suggestions(afterResponse=false){
   const variants=active.mode==='question'
     ? afterResponse?['אפשר דוגמה אחרת?','ומה אם זה תלוי במצב?','למה הכוונה בדרך כלל?']:
       ['מה הכוונה במשפט?','אפשר דוגמה פשוטה?','איך להבין את ההבדל בין 3 ל־4?']
     : afterResponse?['למה זה ככה?','תן דוגמה מהיום־יום','ומה לגבי התכונה השנייה?']:
       ['מה החוזקות שלי לפי התוצאות?','אילו ציונים שונים זה מזה?','מה המשמעות של המצפוניות שלי?'];
   const list=variants.map(t=>{
     const button=document.createElement('button');
     button.type='button';button.textContent=t;
     button.addEventListener('click',()=>{
       if(working)return;
       $('aiChatInput').value=t;
       updateCounter();adjustHeight();
       $('aiChatInput').focus();
     });
     return button;
   });
   $('aiSuggestions').replaceChildren(...list);
 }
 function updateCounter(){
   const len=[...$('aiChatInput').value].length;
   $('aiCharCount').textContent=len+'/'+LIMIT;
 }
 function adjustHeight(){
   const field=$('aiChatInput');
   field.style.height='auto';
   field.style.height=Math.min(Math.max(field.scrollHeight,39),112)+'px';
 }
 function setWorking(busy){
   working=busy;
   $('aiSendBtn').disabled=busy;
   $('aiChatInput').disabled=busy;
   $('aiRestartChat').disabled=busy;
   if(busy)setStatus('כותב לך תשובה…',false);
 }
 let thinkingTimer=null;
 function showTyping(){
   removeTyping();
   const isQ=active&&active.mode==='question';
   const stages=isQ?[
     {t:'מעיין בשאלה',d:'קורא את ניסוח הפריט וההקשר…'},
     {t:'מנתח משמעות',d:'מגבש הסבר בהיר ודוגמה מהחיים…'},
     {t:'מנסח תשובה',d:'מוודא בהירות וניטרליות מלאה…'}
   ]:[
     {t:'מתחבר למעבדת ofiLab',d:'מעיין במפת הציונים והפרופיל שלך…'},
     {t:'מעמיק בהקשר',d:'מצליב בין ממדי האישיות והתשובות…'},
     {t:'מנסח תובנה',d:'מגבש תובנה אישית, חמה ומעצימה…'}
   ];
   typing=message('','assistant');
   typing.classList.add('typing','ai-thinking-message');
   const bubble=typing.querySelector('.ai-chat-bubble');
   bubble.classList.remove('assistant');
   bubble.classList.add('pending','ai-thinking-bubble');
   bubble.setAttribute('role','status');
   bubble.setAttribute('aria-label','ה־AI מעבד את השאלה ומנסח תשובה');
   bubble.textContent='';
   const emblem=document.createElement('span');
   emblem.className='ai-thinking-emblem';
   emblem.setAttribute('aria-hidden','true');
   const inner=document.createElement('span');
   inner.className='ai-thinking-emblem-core';
   emblem.append(inner);
   const copy=document.createElement('span');
   copy.className='ai-thinking-copy';
   const title=document.createElement('span');
   title.className='ai-thinking-title';
   title.textContent=stages[0].t;
   const explanation=document.createElement('span');
   explanation.className='ai-thinking-description';
   explanation.textContent=stages[0].d;
   copy.append(title,explanation);
   const dots=document.createElement('span');
   dots.className='ai-thinking-dots';
   dots.setAttribute('aria-hidden','true');
   for(let i=0;i<3;i++){
     const dot=document.createElement('span');
     dot.className='ai-typing-dot';
     dots.append(dot);
   }
   bubble.append(emblem,copy,dots);
   const timeEl=typing.querySelector('.ai-message-time');
   if(timeEl)timeEl.textContent='';
   let stageIdx=0;
   thinkingTimer=setInterval(()=>{
     stageIdx++;
     if(stageIdx<stages.length&&typing){
       explanation.style.opacity='0';
       setTimeout(()=>{
         if(!typing)return;
         title.textContent=stages[stageIdx].t;
         explanation.textContent=stages[stageIdx].d;
         explanation.style.opacity='1';
       },180);
     }
   },1500);
 }
 function removeTyping(){
   if(thinkingTimer){clearInterval(thinkingTimer);thinkingTimer=null;}
   if(typing){typing.remove();typing=null;}
 }
 function renderStreamContent(msgEl,text,isDone){
   const bubble=msgEl.querySelector('.ai-chat-bubble.assistant');
   if(!bubble)return;
   const fragment=markdown.render(text);
   if(!isDone){
     const cursor=document.createElement('span');
     cursor.className='ai-stream-cursor';
     cursor.setAttribute('aria-hidden','true');
     fragment.append(cursor);
   }
   bubble.replaceChildren(fragment);
 }
 function getQuestionNumber(){
   const match=($('questionCounter')?.textContent||'').match(/(?:שאלה\s*)(\d+)/);
   return match?Number(match[1]):0;
 }
 function getCurrentContext(mode){
   syncInventory();
   if(mode==='question'){
     if($('hexacoDialog')?.open){
       const m=($('hexacoCardCounter')?.textContent||'').match(/(\d+)/);
       const no=m?Number(m[1]):1;
       return {key:'hexaco-h-16:question:'+no,mode,instrument:'hexaco-h-16',number:no,title:'שאלה '+no,description:($('hexacoQuestionText')?.textContent||'').trim()};
     }
     if($('viaDialog')?.open){
       const m=($('viaCardCounter')?.textContent||'').match(/(\d+)/);
       const no=m?Number(m[1]):1;
       return {key:'ipip-via-r-60:question:'+no,mode,instrument:'ipip-via-r-60',number:no,title:'שאלה '+no,description:($('viaQuestionText')?.textContent||'').trim()};
     }
     if($('ecrrsDialog')?.open){
       const m=($('ecrrsCardCounter')?.textContent||'').match(/(\d+)/);
       const no=m?Number(m[1]):1;
       return {key:'ecrrs-9:question:'+no,mode,instrument:'ecrrs-9',number:no,title:'שאלה '+no,description:($('ecrrsQuestionText')?.textContent||'').trim()};
     }
     const no=getQuestionNumber();
     if(no<1||no>total)throw Error('לא מצאתי את מספר השאלה.');
     return {key:instrument+':question:'+no,mode,instrument,number:no,title:'שאלה '+no,description:($('questionText')?.textContent||'').trim()};
   }
   return {key:instrument+':results',mode,instrument,title:'התוצאות שלך',description:'5 תכונות · 30 תחומים קטנים'};
 }
 function contextUi(){
   $('aiDialogTitle').textContent=active.mode==='question'?'בוא נדבר על השאלה':'בוא נדבר על התוצאות';
   $('aiDialogSubtitle').textContent=active.mode==='question'?'אפשר לשאול חופשי, בלי תשובה נכונה מראש':'מקשיב לשאלה שלך ומסביר לפי התוצאות';
   $('aiContextEyebrow').textContent=active.mode==='question'?'השאלה שלך · '+active.number:'מפת האישיות שלך';
   $('aiContextText').textContent=active.description;
   $('aiChatInput').placeholder=active.mode==='question'?'תשאל חופשי על השאלה…':'שאל כל שאלה על התוצאות... (למשל: מה החוזקות שלי?)';
 }
 function open(which,launcher=null){
   if(working||dialog.open)return;
   let ctx;
   try{ctx=getCurrentContext(which)}catch(err){return}
   if(!store.has(ctx.key))store.set(ctx.key,{...ctx,entries:[],history:[]});
   active=store.get(ctx.key);
   active.description=ctx.description;
   contextUi();dialog.dataset.chatMode=which;renderThread();
   $('aiSuggestionDetails').open=false;
   $('aiChatInput').value='';updateCounter();adjustHeight();
   setStatus('Enter לשליחה · Shift+Enter לשורה חדשה',false);
   suggestions(active.entries.length>0);
   floatingLauncher=launcher;
   dialog.dataset.presentation='modal';
    dialog.showModal();
   syncFabState(Boolean(launcher));
   if(window.matchMedia&&window.matchMedia('(pointer:fine)').matches)
     $('aiChatInput').focus({preventScroll:true});
 }
 function erase(){
   if(!active||working)return;
   active.entries=[];active.history=[];
   renderThread();suggestions(false);
   $('aiChatInput').value='';updateCounter();
   setStatus('שיחה חדשה — נשארים באותו הנושא',false);
 }
 let unlockedResultProfile=null;
 function invalidateChatContext(){
   generation++;
   if(controller){try{controller.abort();}catch(_e){}}
   controller=null;
   unlockedResultProfile=null;
   active=null;
   store.clear();
   removeTyping();
   setWorking(false);
 }
 window.addEventListener('ofilab:inventory-switched',()=>{invalidateChatContext();syncInventory();});
 window.addEventListener('ofilab:results',event=>{
   syncInventory();
   if(event.detail&&event.detail.total===total){
     if(unlockedResultProfile!==event.detail.profile){
       generation++;
       if(controller){try{controller.abort();}catch(_e){}}
       controller=null;
       // Results threads are stored as '<instrument>:results' (see getCurrentContext); drop every one,
       // so a changed profile never inherits the previous profile's conversation.
       for(const key of [...store.keys()])if(key.endsWith(':results'))store.delete(key);
       if(active&&active.mode==='results')active=null;
     }
     unlockedResultProfile=event.detail.profile;
   }
 });
 async function contextPayload(){
   if(active.mode==='question')return {mode:'question',instrument:active.instrument||instrument,question:active.number};
   if(!unlockedResultProfile)throw Error('יש לסיים את המבחן כדי לשוחח על התוצאות.');
   // 'low' response quality (severe straight-lining or suspected random responding): never send
   // these scores for interpretation; the model would build a confident reading from noise.
   const vq=unlockedResultProfile.validityFeatures;
   if(vq&&(vq.validityLevel==='low'||vq.isSevereStraightline||vq.isSuspectedRandomResponding)){
     throw Error('איכות המענה בשאלון נמוכה מדי (מענה אחיד או חשד למענה אקראי), ולכן העוזר לא ינתח את התוצאות. מומלץ למלא את השאלון מחדש. אפשר עדיין לשאול על שאלה מסוימת בשאלון.');
   }
   // Both 120 and 300 inventories use calculated scores from a completed, unlocked
   // survey. Never read or decrypt a saved link in the AI chat module.
   const domains={};
   for(const key of ['N','E','O','A','C']){
     domains[key]={score:unlockedResultProfile.domains[key].score,facets:unlockedResultProfile.domains[key].facets.map(x=>x.score)};
   }
   const supp={};
   if(unlockedResultProfile.hexacoHonesty?.type==='direct'&&Number.isFinite(Number(unlockedResultProfile.hexacoHonesty.score))){
     supp.hexacoH=Math.round(Number(unlockedResultProfile.hexacoHonesty.score)*10)/10;
   }
   const finOr=(v,fb)=>{const n=Number(v);return v!=null&&v!==''&&Number.isFinite(n)?n:fb;};
   const isFin=v=>v!=null&&v!==''&&Number.isFinite(Number(v));
   // The server contract requires anxiety, avoidance and security100 together, so the block is
   // sent only when all three are real numbers. A missing security100 is never replaced by 50;
   // 0 is a valid value and is kept.
   const ec=unlockedResultProfile.ecrrsScores;
   if(ec?.type==='direct'&&isFin(ec.anxiety)&&isFin(ec.avoidance)&&isFin(ec.security100)){
     supp.ecrrs={
       anxiety:Math.round(Number(ec.anxiety)*100)/100,
       avoidance:Math.round(Number(ec.avoidance)*100)/100,
       security100:Math.round(Number(ec.security100))
     };
   }
   if((unlockedResultProfile.viaStrengths?.type==='composite'||unlockedResultProfile.viaStrengths?.type==='direct')&&Array.isArray(unlockedResultProfile.viaStrengths.signatureStrengths)){
     supp.viaTop=unlockedResultProfile.viaStrengths.signatureStrengths.slice(0,5).map(s=>({
       name:Array.from(String(s.he||s.name||'')).slice(0,60).join(''),
       score:Math.round(finOr(s.score,0))
     })).filter(s=>s.name&&Number.isFinite(s.score));
   }
   const hasSupp=Object.keys(supp).length>0;
   if(unlockedResultProfile.empiricalReference){
     const percentiles={};
     for(const key of ['N','E','O','A','C']){
       percentiles[key]={score:unlockedResultProfile.domains[key].percentile,facets:unlockedResultProfile.domains[key].facets.map(x=>x.percentile)};
     }
     const reference=unlockedResultProfile.empiricalReference;
     const combined=reference.version==='johnson-120-empirical-combined-v2';
     const metric=reference.longVersionUsesSharedSubset
       ?(combined?'range-and-empirical-johnson-120-subset-combined':'range-and-empirical-johnson-120-subset')
       :reference.referenceInstrument==='IPIP-NEO-300'?'range-and-empirical-johnson-300'
       :(combined?'range-and-empirical-johnson-120-combined':'range-and-empirical-johnson-120');
     const prof=hasSupp?{domains,metric,percentiles,supplementary:supp}:{domains,metric,percentiles};
     return {mode:'results',instrument,profile:prof};
   }
   const baseProf={domains};
   if(hasSupp)baseProf.supplementary=supp;
   return {mode:'results',instrument,profile:baseProf};
 }
 async function readSseResponse(response,onDelta){
   if(!response.body||typeof response.body.getReader!=='function')
     throw Error('הדפדפן או שרת התיווך אינם תומכים כרגע בהזרמת תשובות.');
   const MAX_WIRE_BYTES=1048576,MAX_FRAME_CHARS=65536,MAX_ANSWER_CHARS=131072,SSE_TIMEOUT_MS=60000;
   const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});
   let pending='',done=null,wireBytes=0,answerChars=0;
   const parseFrame=raw=>{
     if(done)return;
     let name='message',value=null;
     const lines=raw.split(/\r?\n/);
     const payload=[];
     for(const line of lines){
       if(line.startsWith('event:'))name=line.slice(6).trim();
       if(line.startsWith('data:'))payload.push(line.slice(5).trimStart());
     }
     if(!payload.length)return;
     try{value=JSON.parse(payload.join('\n'));}
     catch{throw Error('שגיאה בפענוח זרם התשובה.');}
     if(name==='delta'&&typeof value.text==='string'){
       answerChars+=value.text.length;
       if(answerChars>MAX_ANSWER_CHARS)throw Error('תשובת השרת חרגה מהאורך המותר.');
       onDelta(value.text);
     }
     else if(name==='error')throw Error(value.message||'התשובה נחסמה בבדיקת האיכות.');
     else if(name==='done')done=value;
   };
   let timeoutId=null;
   try{
     while(true){
       let part;
       try{
         part=typeof setTimeout==='function'
           ? await Promise.race([
               reader.read(),
               new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(Error('פג הזמן להזרמת התשובה.')),SSE_TIMEOUT_MS);})
             ])
           : await reader.read();
       }finally{if(timeoutId&&typeof clearTimeout==='function'){clearTimeout(timeoutId);timeoutId=null;}}
       if(part.done)break;
       wireBytes+=part.value?part.value.byteLength:0;
       if(wireBytes>MAX_WIRE_BYTES)throw Error('זרם התשובה חרג ממגבלת הגודל המותרת.');
       pending+=decoder.decode(part.value,{stream:true});
       while(true){
         const sep=pending.search(/\r?\n\r?\n/);
         if(sep<0)break;
         const match=pending.slice(sep).match(/^\r?\n\r?\n/)[0];
         const frame=pending.slice(0,sep);
         if(frame.length>MAX_FRAME_CHARS)throw Error('זרם התשובה ארוך מדי.');
         pending=pending.slice(sep+match.length);
         parseFrame(frame);
       }
       if(pending.length>MAX_FRAME_CHARS)throw Error('זרם התשובה ארוך מדי.');
     }
     pending+=decoder.decode();
     if(pending.length>MAX_FRAME_CHARS)throw Error('זרם התשובה ארוך מדי.');
     if(pending.trim())parseFrame(pending);
   }finally{
     if(timeoutId&&typeof clearTimeout==='function'){clearTimeout(timeoutId);timeoutId=null;}
     try{await reader.cancel();}catch(_e){}
     try{reader.releaseLock();}catch(_e){}
   }
   if(!done||done.ok!==true||typeof done.answer!=='string')
     throw Error('זרם התשובה הסתיים לפני השלמתו.');
   return done;
 }
 async function send(e){
   e.preventDefault();
   if(working||!active)return;
   const field=$('aiChatInput'),q=field.value.trim();
   if([...q].length<2||[...q].length>LIMIT){setStatus('כתוב שאלה קצרה, עד 700 תווים.',true);return;}
   const ctx=active,myGeneration=++generation;
   setWorking(true);
   let sent=false,pendingUser=null,streamMessage=null;
   const clock=stamp();
   try{
     // Show the user's message and the pending state immediately, even if
     // building the scoring context takes time; no empty chat while waiting.
     if(ctx.entries.length===0)$('aiChatMessages').replaceChildren();
     pendingUser=message(q,'user',clock);
     field.value='';updateCounter();adjustHeight();
     showTyping();
     const extra=await contextPayload();
     if(generation!==myGeneration)return;
     controller=new AbortController();
     // Keep up to ten recent exchanges. Large histories are
     // trimmed oldest-pair-first so a long chat never breaks the 12KB gateway.
     // The full chat stays visible in memory; no server history is stored.
     const payload={...extra,message:q,history:ctx.history.slice(-MAX_HISTORY)};
     const encoder=new TextEncoder();
     while(payload.history.length>=2 &&
       encoder.encode(JSON.stringify({task:'personality.chat',...payload})).length>MAX_REQUEST_BYTES){
       payload.history.splice(0,2);
     }
     let response=await fetch(endpoint,{
       method:'POST',mode:'same-origin',credentials:'omit',cache:'no-store',
       headers:{'Content-Type':'application/json','Accept':'text/event-stream','X-AI-Gateway-Request':'1'},
       body:JSON.stringify({task:'personality.chat',...payload}),
       signal:controller.signal,
     });
     if(generation!==myGeneration)return;
     let data=null;
     let answer='';
     const streamed=response.ok&&/text\/event-stream/i.test(response.headers.get('Content-Type')||'');
     let rafPending=false,streamFinished=false;
     const scheduleRender=(isDone)=>{
       if(isDone){
         streamFinished=true;
         if(streamMessage)renderStreamContent(streamMessage,answer,true);
         scrollEnd();
         return;
       }
       if(!rafPending&&!streamFinished){
         rafPending=true;
         requestAnimationFrame(()=>{
           rafPending=false;
           if(!streamFinished&&streamMessage&&generation===myGeneration){
             renderStreamContent(streamMessage,answer,false);
             scrollEnd();
           }
         });
       }
     };
     if(streamed){
       data=await readSseResponse(response,delta=>{
         if(generation!==myGeneration)return;
         if(!streamMessage){
           removeTyping();
           streamMessage=message('','assistant',stamp());
           streamMessage.classList.add('ai-streaming');
         }
         answer+=delta;
         streamMessage._ofiText=answer;
         scheduleRender(false);
       });
       if(streamMessage){
         streamMessage.classList.remove('ai-streaming');
         scheduleRender(true);
       }
     }else{
       data=await response.json().catch(()=>null);
       // Provider separation is strict: no fallback to a less-controlled model.
     }
     if(generation!==myGeneration)return;
     if(!response.ok||!data||data.ok!==true||typeof data.answer!=='string'){
       let reason=(data&&typeof data.message==='string'&&data.message.trim()!=='')?data.message:'לא ניתן לקבל תשובה כרגע.';
       if(response.status===429&&(!data||!data.message)){
         reason='מכסת הודעות ה־AI הושגה. אפשר לחזור מאוחר יותר; השאלון עצמו ממשיך לעבוד.';
       }else if(response.status===402){
         reason='תקציב שירות ה־AI הוגבל. השאלון והתוצאות ממשיכים לעבוד כרגיל.';
       }else if(response.status===403){
         reason='השיחה אינה זמינה עבור בקשה זו כרגע. בדוק הרשאת גישה או נסה שוב.';
       }else if((response.status===502||response.status===503||response.status===504)&&(!data||!data.message)){
         reason='שירות ה־AI אינו זמין כרגע. ההודעה נשארת בשדה כדי שתוכל לנסות שוב.';
       }
       const failure=Error(reason);failure.status=response.status;throw failure;
     }
     removeTyping();
     ctx.entries.push({role:'user',text:q,time:clock});
     answer=data.answer.trim();
     if(!streamMessage)streamMessage=message(answer,'assistant',stamp());
     else{
       streamMessage.classList.remove('ai-streaming');
       streamMessage._ofiText=answer;
       renderStreamContent(streamMessage,answer,true);
     }
     ctx.entries.push({role:'assistant',text:answer,time:stamp()});
     ctx.history.push(
       {role:'user',content:truncateUtf8(q,2100,700)},
       {role:'assistant',content:truncateUtf8(answer,3800,980)}
     );
     ctx.history=ctx.history.slice(-MAX_HISTORY);
     field.value='';updateCounter();adjustHeight();
     suggestions(true);
     setStatus('אפשר להמשיך לשאול — ההקשר נשמר בשיחה הנוכחית בדפדפן.',false);
     sent=true;
   }catch(error){
     if(generation!==myGeneration)return;
     if(pendingUser)pendingUser.remove();
     if(streamMessage)streamMessage.remove();
     if(ctx.entries.length===0)renderEmpty();
     field.value=q;updateCounter();adjustHeight();
     if(error.name!=='AbortError'){
       const offline=typeof navigator.onLine==='boolean'&&!navigator.onLine;
       const network=error instanceof TypeError;
       const errText=offline?'אין כרגע חיבור לרשת. הטקסט נשאר בשדה להמשך.':
         network?'לא הצלחנו להתחבר לשירות ה־AI. בדוק חיבור ונסה שוב.':
         (error.message||'לא ניתן לקבל תשובה כרגע. נסה שוב.');
       setStatus(errText,true);
       if(error.status===429 && typeof message==='function'){
         message(errText,'system');
       }
     }
   }finally{
     if(generation===myGeneration){
       controller=null;removeTyping();setWorking(false);
       if(sent)scrollEnd();
     }
   }
 }
 $('askAiQuestion').addEventListener('click',()=>open('question'));
 window.addEventListener('ofilab:open-ai-question',()=>open('question'));
 $('askAiResults').addEventListener('click',()=>open('results'));
 window.addEventListener('ofilab:request-ai-summary',event=>{
   const customPrompt=event?.detail?.prompt||'תן לי סיכום מפורט ומסודר בנקודות של הפרופיל שלי: תמונת על, חוזקות מרכזיות עם ציונים, ניגודים ופערים מעניינים בתוך תתי-התכונות, ונקודה מעשית ליומיום ולעבודה.';
   open('results',event?.detail?.launcher||null);
   if(working||!active)return;
   $('aiChatInput').value=customPrompt;
   updateCounter();adjustHeight();
   $('aiChatForm').requestSubmit();
 });
 resultsFab?.addEventListener('click',()=>{
   if(dialog.open){
     if(floatingLauncher===resultsFab)dialog.close();
     return;
   }
   open('results',resultsFab);
 });
 document.addEventListener('pointerdown',event=>{
   if(dialog.dataset.presentation!=='floating'||!dialog.open)return;
   if(dialog.contains(event.target)||floatingLauncher?.contains(event.target))return;
   dialog.close();
 });
 document.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&dialog.open&&dialog.dataset.presentation==='floating'){
     event.preventDefault();dialog.close();
   }
 });
 window.addEventListener('resize',()=>{
   if(!dialog.open||!floatingLauncher)return;
   if((dialog.dataset.presentation==='floating'&&(window.innerWidth<900||window.innerHeight<560))
     ||(dialog.dataset.presentation==='sheet'&&window.innerWidth>=900&&window.innerHeight>=560))dialog.close();
 });
 $('aiRestartChat').addEventListener('click',erase);
 $('aiClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 $('aiChatForm').addEventListener('submit',send);
 $('aiChatInput').addEventListener('input',()=>{updateCounter();adjustHeight();});
 $('aiChatInput').addEventListener('keydown',event=>{
   if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
     event.preventDefault();
     if(!working)$('aiChatForm').requestSubmit();
   }
 });
 // The launcher is scoped to results; never leave its conversation open
 // when the user navigates back to the questionnaire or home.
 new MutationObserver(()=>{
   if(floatingLauncher&&document.documentElement.dataset.stage!=='results'&&dialog.open)dialog.close();
 }).observe(document.documentElement,{attributes:true,attributeFilter:['data-stage']});
 dialog.addEventListener('close',()=>{
   if(controller){controller.abort();controller=null;}
   ++generation;removeTyping();
   working=false;
   $('aiChatInput').disabled=false;
   $('aiSendBtn').disabled=false;
   $('aiRestartChat').disabled=false;
   const returnFocus=floatingLauncher;
   floatingLauncher=null;
   syncFabState(false);
   dialog.dataset.presentation='modal';
   if(returnFocus&&returnFocus.isConnected&&returnFocus.offsetParent!==null)
     returnFocus.focus({preventScroll:true});
 });
})();

