(function(){
  'use strict';
  // Level badge beside a trait name. נועם הליכות is masculine; the other four traits are feminine.
  function levelLabel(p,rel,key){
    const w=rel?(p>=90?['גבוהה מאוד','גבוה מאוד']:p>=70?['גבוהה','גבוה']:p>=31?['מתונה','מתון']:p>=11?['נמוכה','נמוך']:['נמוכה במיוחד','נמוך במיוחד'])
      :(p>62.5?['גבוהה','גבוה']:p>=37.5?['בינונית','בינוני']:['נמוכה','נמוך']);
    return w[key==='A'?1:0];
  }
  let core=window.AVDPersonalityCore;
  if(!core)throw Error('Scoring engine missing');
  let safeStore=window.AVDPersonalityStorage;
  const codec=window.OfiLabCompactV2,secure=window.OfiLabSecureSave;
  if(!codec||!secure)throw Error('Secure save modules missing');
  const SVG_NS='http://www.w3.org/2000/svg';
  const $=id=>document.getElementById(id);
  const intro=$('introScreen'),quiz=$('quizScreen'),result=$('resultScreen');
  // A saved #p= or #e= results link must not inherit a stale scroll position
  // from a prior visit when the browser restores its session.
  if(/^#(?:p|e)=/.test(window.location.hash)&&window.history&&
     'scrollRestoration' in window.history)window.history.scrollRestoration='manual';
  let extendedForm=document.documentElement.dataset.inventory==='ipip-neo-300';
  let TOTAL=extendedForm?300:120;
  let BANK_URL=extendedForm?'./data/ipip-neo-300-he.json':'./data/ipip-neo-120-he.json';
  let GUIDANCE_URL=extendedForm?'./data/question-guidance-300-he.json':'./data/question-guidance-he.json';
  let answers=new Array(TOTAL).fill(0);
  let bank=null,cursor=0,autoadvance=null,loaded=false;
  let latestResults=null;
  // Default: fast, automatic and reversible. Honor previous manual preference.
  let automatic=true,advanceDelay=480,keyboardShortcuts=true;
  const PACE_KEY='avd-personality:pace:v1';
  const PACE_DELAY_KEY='avd-personality:pace-delay:v2';
  const KEYBOARD_KEY='avd-personality:keyboard-shortcuts:v1';
  const DELAYS=[280,480,750,1200];
  let guidance=null,reviewOrigin='quiz',reviewOpener=null,reviewChanged=false;
  let reviewSearchTerm='',reviewFilterValue='all',reviewLimit=40;
  let stateFromUrl=false,protectedMode=false,encryptedToken=null,pendingProtectedToken=null,saveDialogMode='create',needsUnlock=false,securing=false;
  let sessionEpoch=0;
  let helpPosition=null,helpOpener=null;
  const funnelStarted={},funnelCompleted={};
  let answeredInSession=false;
  function sendFunnelBeacon(eventType,len){
    try{
      if(typeof window==='undefined'||typeof window.fetch!=='function')return;
      const qLen=len===300?300:120;
      window.fetch('./?ofilab_event='+encodeURIComponent(eventType)+'&len='+qLen,{
        method:'GET',keepalive:true,credentials:'omit',cache:'no-store'
      }).catch(()=>{});
    }catch(_e){}
  }
  function updateHeaderBadge(){
    const b=$('resultsHeaderBadge'),t=$('resultsHeaderBadgeText');
    if(!b)return;
    const isResults=document.documentElement.dataset.stage==='results';
    b.hidden=!isResults;
    if(t&&isResults){
      t.textContent=extendedForm?'שאלון 300 · העמקה מלאה':'שאלון 120 · תקני';
    }
  }
  function visible(screen,skipScroll=false){if(screen!==quiz)closeHelp();document.documentElement.dataset.stage=screen.id==='quizScreen'?'quiz':screen.id==='resultScreen'?'results':'intro';for(const s of [intro,quiz,result])s.classList.toggle('hidden',s!==screen);if(!skipScroll)window.scrollTo({top:0,behavior:'instant'});updateHeaderBadge();}
  function resetResultsToTop(){
    // The results overview sits above section 01; no numbered section should
    // appear selected until the user explicitly chooses it.
    document.querySelectorAll('.results-journey [data-scroll]').forEach(button=>
      button.setAttribute('aria-pressed','false'));
    const top=()=>window.scrollTo({top:0,left:0,behavior:'instant'});
    top();
    // Norm cards and the lab are inserted on the results event. Align to the
    // actual rendered top after those synchronous layout changes.
    if(typeof window.requestAnimationFrame==='function')window.requestAnimationFrame(()=>{
      if(document.documentElement.dataset.stage==='results')top();
    });
  }
  function count(){return answers.filter(a=>a>0).length;}
  function showError(message){$('errorBox').textContent=message;$('errorBox').classList.remove('hidden');}
  function hideError(){$('errorBox').classList.add('hidden');$('errorBox').textContent='';}
  function toast(message){const el=$('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(el._timeout);el._timeout=setTimeout(()=>el.classList.add('hidden'),4200);}
  function stateToken(){
    const safeCursor=Math.max(0,Math.min(TOTAL-1,(Number.isInteger(cursor)&&cursor>=0&&cursor<TOTAL)?cursor:0));
    return codec.encode(answers,safeCursor);
  }
  function currentSuppTokens(){
    if(typeof window.getOfiLabSupplementaryTokens==='function')return window.getOfiLabSupplementaryTokens();
    const hMatch=window.location.hash.match(/[#&]h=([A-Za-z0-9_-]{7})/);
    const vMatch=window.location.hash.match(/[#&]v=([A-Za-z0-9_-]{24})/);
    const aMatch=window.location.hash.match(/[#&]a=([A-Za-z0-9_-]{5})/);
    return {h:hMatch?hMatch[1]:null,v:vMatch?vMatch[1]:null,a:aMatch?aMatch[1]:null};
  }
  function extraHashParams(){
    if(protectedMode||needsUnlock)return '';
    const supp=currentSuppTokens();
    return (supp.h?'&h='+supp.h:'')+(supp.v?'&v='+supp.v:'')+(supp.a?'&a='+supp.a:'');
  }
  function link(){
    const u=new URL(window.location.href);
    u.search='';
    u.searchParams.set('len',String(TOTAL));
    u.hash=(protectedMode?'e='+encryptedToken:'p='+stateToken())+extraHashParams();
    return u.toString();
  }
  // Async persistence may resolve out of order. Only the most recent answer
  // is permitted to change the visible status.
  let saveRevision=0,saveWarningShown=false;
  function saveIndicator(state,message){
    const status=$('saveStatus');
    if(!status)return;
    status.setAttribute('aria-live',state==='error'?'polite':'off');
    status.dataset.state=state;
    status.textContent=message;
    const wrapper=status.closest&&status.closest('.save-note');
    if(wrapper)wrapper.dataset.saveState=state;
    const recovery=$('saveRecovery');
    if(recovery)recovery.hidden=state!=='error';
  }
  function replaceSavedHash(kind,token){
    const url=new URL(window.location.href);
    url.search='';
    url.searchParams.set('len',String(TOTAL));
    url.hash=kind+'='+token+extraHashParams();
    history.replaceState(null,'',url.pathname+url.search+url.hash);
    $('shareTop').hidden=false;
    $('protectSaveTop').hidden=false;
  }
  function refreshSecureButtons(){
    for(const id of ['protectSaveQuiz','protectSaveResults','protectSaveTop']){
      const button=$(id);
      if(button){
        const optionTitle=button.querySelector('.results-share-option-copy strong');
        if(optionTitle){
          optionTitle.textContent=protectedMode?'שינוי סיסמת השמירה':'שמירה מוצפנת בסיסמה';
        }else{
          const caption=button.querySelector('span:not(.results-share-option-icon):not(.results-share-option-arrow)');
          if(caption)caption.textContent=protectedMode?'שינוי סיסמה':'שמירה בסיסמה';
          else button.textContent=protectedMode?'שינוי סיסמת השמירה':'שמירה מוצפנת בסיסמה';
        }
      }
    }
    const note=$('protectedSaveState');
    if(note)note.textContent=protectedMode?'מצב מוגן: התשובות מוצפנות בקישור ובגיבוי המקומי.':'שמירה רגילה: כל מי שמחזיק בקישור יכול לקרוא את התשובות.';
    const fileNote=$('resultsFileNote');
    if(fileNote)fileNote.textContent=protectedMode?'הקובץ יישמר מוצפן. לפתיחתו דרך טעינת תוצאות במסך הראשי תידרש הסיסמה.':'הקובץ כולל תשובות ומאפשר טעינה מחדש במסך הראשי. קובץ רגיל אינו מוצפן.';
  }
  function persist(){
    if(securing){saveIndicator('pending','מעביר לשמירה מוגנת…');return Promise.resolve(false);}
    const revision=++saveRevision;
    saveIndicator('pending',protectedMode?'מצפין ושומר…':'שומר…');
    if(protectedMode){
      const snapshot=stateToken();
      return secure.encrypt(snapshot,currentSuppTokens()).then(token=>{
        if(revision!==saveRevision)return false;
        encryptedToken=token;
        replaceSavedHash('e',token);
        const ok=secure.saveLocal(token);
        if(revision!==saveRevision)return ok;
        if(ok){saveIndicator('saved','שמירה מוצפנת במכשיר');saveWarningShown=false;}
        else saveIndicator('error','לא נשמר במכשיר — העתק קישור מוגן');
        return ok;
      }).catch(()=>{
        if(revision===saveRevision)saveIndicator('error','ההצפנה נכשלה — נסה לשמור שוב');
        return false;
      });
    }
    const token=stateToken();
    let saved;
    try{saved=safeStore?Promise.resolve(safeStore.save(token)):Promise.resolve(false);}
    catch(e){saved=Promise.resolve(false);}
    saved.then(ok=>{
      if(revision!==saveRevision)return;
      if(ok){saveIndicator('saved','נשמר במכשיר');saveWarningShown=false;}
      else{
        saveIndicator('error','לא נשמר במכשיר — שמור קישור');
        if(!saveWarningShown){toast('השמירה במכשיר חסומה. אפשר להעתיק את קישור השמירה.');saveWarningShown=true;}
      }
    },()=>{
      if(revision===saveRevision)saveIndicator('error','לא נשמר במכשיר — שמור קישור');
    });
    replaceSavedHash('p',token);
    return saved;
  }
  function restore(token){
    const s=codec.decode(token);
    if(Array.isArray(s.answers)){
      if(s.answers.length!==TOTAL){
        if(s.answers.length===300||s.answers.length===120){
          syncInventoryState(s.answers.length);
          loadInventoryDataSync();
          configureInventoryPresentation();
          updateVersionSelectionUI(TOTAL);
          const u=new URL(window.location.href);
          u.searchParams.set('len',String(s.answers.length));
          if(window.history?.replaceState)window.history.replaceState(null,'',u.pathname+u.search+u.hash);
        }else{
          throw Error('אורך השאלון בקישור אינו תואם.');
        }
      }
      for(let i=0;i<TOTAL;i++)answers[i]=s.answers[i]||0;
    }
    cursor=Math.max(0,Math.min(TOTAL-1,(Number.isInteger(s.cursor)&&s.cursor>=0&&s.cursor<TOTAL)?s.cursor:0));
    return true;
  }
  function h(tag,cls,text){
    const el=document.createElement(tag);if(cls)el.className=cls;
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  function percent(value){return (Math.round(value*10)/10).toLocaleString('he-IL',{maximumFractionDigits:1});}
  function icon(name){
    const svg=document.createElementNS(SVG_NS,'svg'),use=document.createElementNS(SVG_NS,'use');
    svg.classList.add('icon');svg.setAttribute('aria-hidden','true');
    use.setAttribute('href','#i-'+name);svg.append(use);return svg;
  }
  function svgEl(tag,attrs={},text){
    const el=document.createElementNS(SVG_NS,tag);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    if(text!==undefined)el.textContent=String(text);
    return el;
  }
  function renderRadar(profile){
    const host=$('radarChart');
    if(!host)return;
    const names={N:'רגישות',E:'מוחצנות',O:'פתיחות',A:'נעימות',C:'מצפוניות'};
    const plotValue=key=>profile.empiricalReference?profile.domains[key].percentileExact:profile.domains[key].score;
    const cx=210,cy=177,radius=111;
    const keys=core.ORDER;
    const xy=(index,scale)=>{const angle=-Math.PI/2+index*2*Math.PI/5;return [cx+Math.cos(angle)*radius*scale,cy+Math.sin(angle)*radius*scale];};
    const pathFor=values=>values.map((v,i)=>xy(i,v).map(n=>n.toFixed(1)).join(',')).join(' ');
    const svg=svgEl('svg',{viewBox:'0 0 420 365',class:'radar-svg',role:'img','aria-labelledby':'radar-visual-title radar-visual-desc'});
    const title=svgEl('title',{id:'radar-visual-title'},'מפת חמש תכונות האישיות');
    const description=keys.map(k=>names[k]+': '+(profile.empiricalReference?'אחוזון '+percent(profile.domains[k].percentile):percent(profile.domains[k].score)+' מתוך 100')).join('; ');
    svg.append(title,svgEl('desc',{id:'radar-visual-desc'},description));
    for(const scale of [.25,.5,.75,1])svg.append(svgEl('polygon',{points:pathFor(keys.map(()=>scale)),class:'grid-polygon'}));
    for(let i=0;i<5;i++){
      const end=xy(i,1);svg.append(svgEl('line',{x1:cx,y1:cy,x2:end[0].toFixed(1),y2:end[1].toFixed(1),class:'grid-spoke'}));
    }
    svg.append(svgEl('polygon',{points:pathFor(keys.map(k=>plotValue(k)/100)),class:'data-polygon'}));
    keys.forEach((k,i)=>{
      const at=xy(i,plotValue(k)/100);
      svg.append(svgEl('circle',{cx:at[0].toFixed(1),cy:at[1].toFixed(1),r:5,class:'data-point'}));
      const label=xy(i,1.28);
      const anchor=Math.abs(label[0]-cx)<24?'middle':label[0]<cx?'end':'start';
      svg.append(svgEl('text',{x:label[0].toFixed(1),y:(label[1]+4).toFixed(1),'text-anchor':anchor,class:'axis-label'},names[k]));
    });
    host.replaceChildren(svg);
  }
  function getHelp(index){
    const value=guidance&&guidance.items&&guidance.items[index];
    return value&&value.number===index+1&&typeof value.help==='string'?value.help:
      'שים לב למשמעות המילולית של המשפט, ודרג עד כמה הוא מאפיין אותך בדרך כלל ולא רק במקרה חריג.';
  }
  function finishHelp(){
    if($('questionHelpPanel').open)return;
    document.documentElement.dataset.helpOpen='false';
    $('questionHelpBtn').setAttribute('aria-expanded','false');
    if(helpOpener){
      const opener=helpOpener,position=helpPosition;
      helpOpener=null;helpPosition=null;
      opener.focus({preventScroll:true});
      if(position)window.scrollTo({top:position.y,left:position.x,behavior:'instant'});
    }
  }
  function closeHelp(restoreFocus=false){
    const panel=$('questionHelpPanel');
    if(!restoreFocus){helpOpener=null;helpPosition=null;}
    if(panel.open)panel.close();
    finishHelp();
  }
  function toggleHelp(){
    const panel=$('questionHelpPanel');
    if(panel.open){closeHelp(true);return;}
    // Reading help pauses a pending advance; it never changes an answer.
    clearTimeout(autoadvance);autoadvance=null;
    helpPosition={x:window.scrollX,y:window.scrollY};
    helpOpener=$('questionHelpBtn');
    $('questionHelpTitle').textContent='הסבר לשאלה';
    const stmtEl=$('questionHelpStatement');
    stmtEl.hidden=false;
    stmtEl.textContent=bank.items[cursor].he;
    $('questionHelpText').textContent=getHelp(cursor);
    const noteEl=panel.querySelector('.mindful-help-note');
    if(noteEl)noteEl.textContent='חשוב על עצמך בדרך כלל, לא רק על מקרה אחד.';
    document.documentElement.dataset.helpOpen='true';
    panel.showModal();
    $('questionHelpBtn').setAttribute('aria-expanded','true');
    $('questionHelpTitle').focus({preventScroll:true});
    window.scrollTo({top:helpPosition.y,left:helpPosition.x,behavior:'instant'});
  }
  function progress(){
    const answered=count();
    $('answeredCounter').textContent=answered+' מתוך '+TOTAL+' נענו';
    $('chapterCounter').textContent='חלק '+(Math.floor(cursor/(TOTAL/5))+1)+' מתוך 5';
    $('progressMeter').setAttribute('aria-valuenow',String(answered));
    $('progressMeter').setAttribute('aria-valuetext',answered+' מתוך '+TOTAL+' שאלות נענו');
    $('meterFill').style.width=answered/TOTAL*100+'%';
  }
  function animateQuestion(){
    const card=document.querySelector('.question-card');
    if(!card)return;
    card.classList.remove('question-reveal');
    void card.offsetWidth;
    card.classList.add('question-reveal');
  }
  function question(){
    if(!bank)return;
    clearTimeout(autoadvance);autoadvance=null;
    hideError();
    const item=bank.items[cursor],answered=count();
    if($('questionAssistance'))$('questionAssistance').open=false;
    $('questionCounter').textContent='שאלה '+(cursor+1)+' מתוך '+TOTAL;
    $('questionCounter').setAttribute('aria-label','שאלה '+(cursor+1)+' מתוך '+TOTAL);
    progress();
    $('questionText').textContent=item.he;
    let original=$('originalEnglishItem');
    if(!original){original=h('p','original-english-item');original.id='originalEnglishItem';original.dir='ltr';original.lang='en';($('questionAssistance')||$('questionText').parentNode).append(original);}
    original.textContent=item.source_en;
    original.hidden=false;
    let adaptNote=$('itemAdaptationNote');
    if(item.adaptation){
      if(!adaptNote){adaptNote=h('div','item-cultural-adaptation');adaptNote.id='itemAdaptationNote';$('questionText').after(adaptNote);}
      adaptNote.textContent='💡 '+item.adaptation;
      adaptNote.hidden=false;
    }else if(adaptNote){
      adaptNote.hidden=true;
    }
    $('questionHelpText').textContent=getHelp(cursor);
    $('reviewCount').textContent=answered+'/'+TOTAL;
    closeHelp();
    animateQuestion();
    const options=bank.scale;
    const field=$('answerSet');field.replaceChildren();
    options.forEach((label,i)=>{
      const value=i+1;
      const btn=h('button','answer-btn'+(answers[cursor]===value?' selected':''));btn.type='button';
      btn.setAttribute('aria-pressed',String(answers[cursor]===value));
      const num=h('span','answer-bullet',value);
      const txt=h('span','answer-label',label);
      btn.append(num,txt);
      btn.addEventListener('click',()=>{
        const seen=cursor;
        clearTimeout(autoadvance);
        answers[seen]=value;
        answeredInSession=true;
        if(!funnelStarted[TOTAL]){funnelStarted[TOTAL]=true;sendFunnelBeacon('start',TOTAL);}
        persist();
        for(const option of field.children){
          const selected=option===btn;
          option.classList.toggle('selected',selected);
          option.setAttribute('aria-pressed',String(selected));
        }
        const answered=count();
        progress();
        $('reviewCount').textContent=answered+'/'+TOTAL;
        $('resultsBtn').hidden=answered!==TOTAL;
        updatePaceFeedback();
        window.dispatchEvent(new CustomEvent('ofilab:question',{detail:{
          cursor,total:TOTAL,answered,nextUnanswered:answers.indexOf(0),
          chapterCounts:extendedForm?Array.from({length:10},(_,index)=>answers.slice(index*30,index*30+30).filter(v=>v>0).length):null
        }}));
        if(automatic)autoadvance=setTimeout(()=>{
          autoadvance=null;
          // Any open dialog (settings, chapters, supplementary quizzes, help, AI) holds the questionnaire in place.
          const dialogOpen=typeof document.querySelector==='function'?!!document.querySelector('dialog[open]'):($('questionHelpPanel').open||$('aiDialog').open||$('reviewDialog').open||$('protectedSaveDialog').open);
          if(cursor===seen&&!document.hidden&&!dialogOpen)next();
        },advanceDelay);
      });
      field.appendChild(btn);
    });
    $('prevBtn').disabled=cursor===0;
    updatePaceFeedback();
    $('resultsBtn').hidden=answered!==TOTAL;
    $('shareTop').hidden=false;
    const nextUnanswered=answers.findIndex((v,i)=>!v&&i>cursor);
    const fallback=answers.indexOf(0);
    const destination=nextUnanswered>=0?nextUnanswered:fallback;
    const jump=$('jumpUnanswered');
    if(jump){jump.hidden=destination<0||destination===cursor;jump.dataset.target=String(destination);}
    if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function'){
      window.dispatchEvent(new CustomEvent('ofilab:question',{detail:{
        cursor,total:TOTAL,answered,nextUnanswered:destination,
        chapterCounts:extendedForm?Array.from({length:10},(_,index)=>answers.slice(index*30,index*30+30).filter(value=>value>0).length):null
      }}));
    }
  }
  function updatePaceFeedback(){
    $('nextBtn').disabled=false;
    $('nextLabel').textContent=cursor===TOTAL-1?(count()===TOTAL?'לראות את התוצאות':'לשאלות שנותרו'):(answers[cursor]?'ממשיכים':'דלג לעכשיו');
    // Skipping is allowed but secondary: the answer itself is the main action.
    const skipping=!answers[cursor]&&cursor!==TOTAL-1;
    $('nextBtn').classList.toggle('primary',!skipping);
    $('nextBtn').classList.toggle('secondary',skipping);
    $('choiceFeedback').textContent=answers[cursor]?'התשובה נשמרה. אפשר לשנות אותה לפני שממשיכים.':'אין תשובה נכונה. בחר את מה שמתאים לך בדרך כלל.';
  }
  function revealQuestion(){
    $('questionText').focus({preventScroll:true});
    const rect=$('questionText').getBoundingClientRect();
    if(rect.top<100){
      const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({top:Math.max(0,window.scrollY+rect.top-150),behavior:reduce?'instant':'smooth'});
    }
  }
  function updateReviewMeta(){
    const answered=count(),total=TOTAL;
    $('reviewStatus').textContent=answered+' תשובות מתוך '+total+' · '+(total-answered)+' שאלות שנותרו';
    $('reviewProgressFill').style.width=(answered/total*100)+'%';
    $('reviewCount').textContent=answered+'/'+TOTAL;
  }
  function reviewMatches(item,i){
    const value=answers[i];
    if(reviewFilterValue==='answered'&&!value)return false;
    if(reviewFilterValue==='unanswered'&&value)return false;
    const term=reviewSearchTerm.trim().toLocaleLowerCase('he-IL');
    return !term||item.he.toLocaleLowerCase('he-IL').includes(term)||
      getHelp(i).toLocaleLowerCase('he-IL').includes(term)||String(i+1)===term;
  }
  function renderReview(){
    if(!bank)return;
    const host=$('reviewList');
    const nodes=[];
    const pageSize=extendedForm?reviewLimit:Infinity;
    let matchingCount=0;
    bank.items.forEach((item,i)=>{
      if(!reviewMatches(item,i))return;
      matchingCount++;
      if(nodes.length>=pageSize)return;
      const card=h('article','review-item');
      card.setAttribute('data-question',String(i+1));
      const top=h('div','review-item-head'),num=h('span','review-item-number','שאלה '+(i+1));
      const chip=h('span','review-item-state'+(answers[i]?' is-answered':''),answers[i]?'נענתה':'ללא תשובה');
      top.append(num,chip);
      const prompt=h('h3','review-item-question',item.he);
      const helpButton=h('button','review-explain','?');
      helpButton.type='button';
      helpButton.setAttribute('aria-label','הסבר לשאלה '+(i+1));
      helpButton.setAttribute('aria-expanded','false');
      const explanation=h('p','review-item-help',getHelp(i));
      explanation.hidden=true;
      helpButton.addEventListener('click',()=>{
        explanation.hidden=!explanation.hidden;
        helpButton.setAttribute('aria-expanded',String(!explanation.hidden));
      });
      const heading=h('div','review-question-heading');heading.append(prompt,helpButton);
      const choices=h('div','review-choices');
      choices.setAttribute('role','group');
      choices.setAttribute('aria-label','בחירת רמת התאמה לשאלה '+(i+1));
      bank.scale.forEach((label,j)=>{
        const v=j+1,btn=h('button','review-choice'+(answers[i]===v?' is-selected':''),String(v));
        btn.type='button';btn.title=label;
        btn.setAttribute('aria-label','שאלה '+(i+1)+': '+label);
        btn.setAttribute('aria-pressed',String(answers[i]===v));
        btn.addEventListener('click',()=>{
          clearTimeout(autoadvance);
          answers[i]=v;reviewChanged=true;persist();
          for(const other of choices.children){
            const active=other===btn;
            other.classList.toggle('is-selected',active);
            other.setAttribute('aria-pressed',String(active));
          }
          chip.textContent='נענתה';chip.classList.add('is-answered');
          updateReviewMeta();
          // Keep the currently edited card in place, even under a filtered view.
        });
        choices.append(btn);
      });
      const jump=h('button','review-jump','מעבר לשאלה');
      jump.type='button';
      jump.setAttribute('aria-label','מעבר לשאלה '+(i+1)+' במבחן');
      jump.addEventListener('click',()=>{
        cursor=i;
        persist();
        reviewChanged=false;reviewOrigin='quiz';reviewOpener=null;
        if(typeof $('reviewDialog').close==='function')$('reviewDialog').close();
        else $('reviewDialog').hidden=true;
        visible(quiz);question();$('questionText').focus({preventScroll:true});
      });
      const bottom=h('div','review-item-bottom');
      bottom.append(choices,jump);
      card.append(top,heading,explanation,bottom);
      nodes.push(card);
    });
    host.replaceChildren(...nodes);
    if(!nodes.length)host.append(h('p','review-empty','לא מצאנו שאלות שמתאימות לחיפוש.'));
    if(matchingCount>nodes.length){
      const more=h('button','secondary review-loadmore','הצגת עוד '+Math.min(40,matchingCount-nodes.length)+' שאלות');
      more.type='button';
      more.addEventListener('click',()=>{
        const before=nodes.length;
        reviewLimit+=40;
        renderReview();
        const next=$('reviewList').children[before];
        if(next&&typeof next.scrollIntoView==='function')next.scrollIntoView({block:'nearest'});
      });
      host.append(more);
    }
    updateReviewMeta();
  }
  function openReview(origin='quiz'){
    clearTimeout(autoadvance);
    reviewOrigin=origin;
    reviewOpener=document.activeElement;
    reviewChanged=false;reviewSearchTerm='';reviewFilterValue='all';reviewLimit=40;
    $('reviewSearch').value='';
    $('reviewFilter').value='all';
    renderReview();
    const dialog=$('reviewDialog');
    if(typeof dialog.showModal==='function')dialog.showModal();
    else dialog.hidden=false;
  }
  function afterReview(){
    if(reviewChanged){
      if(reviewOrigin==='results'){
        if(count()===TOTAL)showResults();
        else{cursor=answers.indexOf(0);goToQuiz();}
      }else question();
    }
    if(reviewOpener&&typeof reviewOpener.focus==='function'&&
       !(reviewOrigin==='results'&&count()<TOTAL))reviewOpener.focus({preventScroll:true});
    reviewOpener=null;
  }
  function closeReviewDialog(){
    const dialog=$('reviewDialog');
    if(typeof dialog.close==='function')dialog.close();
    else{dialog.hidden=true;afterReview();}
  }
  function startFresh(){
    const hadMainSession=count()>0||needsUnlock||protectedMode;
    if((count()>0||needsUnlock)&&!window.confirm('להתחיל מחדש? ההתקדמות במכשיר תוחלף. רק קישור שמירה קודם וסיסמתו יאפשרו שחזור.'))return;
    answers.fill(0);cursor=0;
    funnelCompleted[TOTAL]=false;
    funnelStarted[TOTAL]=true;
    sendFunnelBeacon('start',TOTAL);
    if(needsUnlock){needsUnlock=false;pendingProtectedToken=null;$('unlockProtectedAgain').hidden=true;secure.lock();secure.clearLocal();if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(false);}
    if(hadMainSession){
      if(typeof window.clearOfiLabSupplementaryLocal==='function')window.clearOfiLabSupplementaryLocal();
      try{
        if(/[&?#](?:h|v|a)=/.test(window.location.hash)){
          history.replaceState(null,'',window.location.pathname+window.location.search);
        }
      }catch(_e){}
    }
    const footerRawBtn=$('footerDownloadRaw');if(footerRawBtn)footerRawBtn.hidden=true;
    persist();visible(quiz);question();
  }
  function goToQuiz(){persist();visible(quiz);question();}
  function next(){
    clearTimeout(autoadvance);
    if(cursor<TOTAL-1)cursor++;
    else if(count()<TOTAL)cursor=answers.indexOf(0);
    else return showResults();
    persist();question();revealQuestion();
  }
  function previous(){clearTimeout(autoadvance);if(cursor>0){cursor--;persist();question();revealQuestion();}}
  function track(score){const t=h('div','track'),f=h('div');f.style.width=Math.max(0,Math.min(100,score))+'%';t.append(f);return t;}
  function renderEstimatedType(profile){
    const mount=$('mbtiAxes'),type=$('mbtiType'),status=$('mbtiStatus'),advMount=$('mbtiAdvancedInsights');
    if(!mount||!type||!status)return;
    if(!window.OfiFourLetters){
      type.textContent='----';
      status.textContent='לא ניתן להציג את ההערכה כרגע. שאר התוצאות לא הושפעו.';
      mount.replaceChildren();
      if(advMount)advMount.replaceChildren();
      return;
    }
    const outcome=window.OfiFourLetters.estimate(profile);
    // Borderline letters are shown with their alternative, e.g. INFP with "/J" beside the P.
    type.replaceChildren();
    const fourAxes=outcome.axes.slice(0,4);
    fourAxes.forEach(axis=>{
      if(!axis.borderline){type.append(axis.letter);return;}
      const mark=h('span','mbti-letter-borderline',axis.letter);
      mark.title='אות גבולית: '+axis.letter+' או '+axis.alternativeLetter;
      mark.append(h('sup','mbti-letter-alt','/'+axis.alternativeLetter));
      type.append(mark);
    });
    const borderlineFour=fourAxes.filter(a=>a.borderline);
    const uncertainFour=fourAxes.filter(a=>a.unclear||a.ciCrossesMidline);
    type.setAttribute('aria-label',outcome.fourType
      ?'סגנון ארבע אותיות משוער '+outcome.fourType+(borderlineFour.length?', אותיות גבוליות: '+borderlineFour.map(a=>a.letter+' או '+a.alternativeLetter).join(', '):'')
      :'חלק מהאותיות אינן חד־משמעיות');

    // Implied composite correlations with MBTI (Furnham et al., 2003; McCrae & Costa, 1989).
    // A/T has no published MBTI criterion; it is a continuous Neuroticism-based composite.
    const is300Mode=outcome.inventoryMode===300;
    const researchMeta={
      EI:{r:is300Mode?0.71:0.70,maxConf:91,pct:is300Mode?'R ≈ 0.71 (Furnham, 2003)':'R ≈ 0.70 (Furnham, 2003)'},
      SN:{r:is300Mode?0.69:0.67,maxConf:90,pct:is300Mode?'R ≈ 0.69 (Furnham, 2003)':'R ≈ 0.67 (Furnham, 2003)'},
      TF:{r:0.39,maxConf:84,pct:'R ≈ 0.39 (Furnham, 2003 · ממד יחיד 0.44–0.46)'},
      JP:{r:is300Mode?0.55:0.54,maxConf:86,pct:is300Mode?'R ≈ 0.55 (משולב · ממד יחיד 0.49)':'R ≈ 0.54 (משולב · ממד יחיד 0.49)'},
      AT:{r:null,maxConf:null,pct:'ללא מבחן ייחוס חיצוני · ציר רציף מרגישות רגשית (N)'}
    };
    // Exact Gaussian CDF Phi(z) (Abramowitz & Stegun 7.1.26, error < 1.5e-7)
    function normalCdf(z){
      const sign=z<0?-1:1;
      const x=Math.abs(z)/Math.SQRT2;
      const t=1/(1+0.3275911*x);
      const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
      return 0.5*(1+sign*erf);
    }
    // Attenuated Bivariate Normal Conditional Classification Consistency:
    // Uses individualized v5 classificationConsistency (incorporating Mosier reliability & SEM) when present.
    function computeAxisConfidence(axisScore,metaObj,axisObj){
      if(axisObj&&typeof axisObj.classificationConsistency==='number'){
        return axisObj.classificationConsistency;
      }
      const r=metaObj&&metaObj.r?metaObj.r:0.55;
      const maxConf=metaObj&&metaObj.maxConf?metaObj.maxConf:88;
      const u=Math.min(0.999,Math.abs(axisScore-50)/50);
      const zX=0.5*Math.log((1+u)/(1-u))/0.68;
      const zCond=(r*zX)/Math.sqrt(Math.max(0.05,1-r*r));
      const rawPct=Math.round(normalCdf(zCond)*100);
      return Math.min(maxConf,Math.max(50,rawPct));
    }

    const children=[];
    for(const axis of fourAxes){
      const card=h('article','mbti-axis');
      const heading=h('div','mbti-axis-heading');
      const label=h('h3',null,axis.label);
      const isPositive=axis.letter===axis.positive;
      const activePct=axis.letter!=='?'?Math.round(isPositive?axis.score:(100-axis.score)):null;
      const meta=researchMeta[axis.key];
      const resPct=meta?meta.pct:'r ≈ 0.60';
      const weightedPct=activePct!==null?computeAxisConfidence(axis.score,meta,axis):null;

      // Axis position is a 0-100 scale location, written as /100 so it is never read as a probability.
      const letter=h('span','mbti-axis-letter',axis.letter+(activePct!==null?' · '+activePct+'/100':''));
      heading.append(label,letter);
      const poles=h('div','mbti-axis-poles');
      const negPct=Math.round(100-axis.score);
      const posPct=Math.round(axis.score);
      const negSpan=h('span',axis.letter===axis.negative?'mbti-pole-active':null,axis.negative+' ('+negPct+'/100) · '+axis.negativeText);
      const posSpan=h('span',axis.letter===axis.positive?'mbti-pole-active':null,axis.positive+' ('+posPct+'/100) · '+axis.positiveText);
      poles.append(negSpan,posSpan);
      const line=h('div','mbti-axis-line');
      line.setAttribute('role','img');
      line.setAttribute('aria-label',axis.alternatives+': '+axis.message);
      // .mbti-axis-poles is RTL (negSpan on right = 100% left, posSpan on left = 0% left),
      // while .mbti-axis-line is LTR, so left% = 100 - score aligns marker & 95% CI with the active pole.
      if(Array.isArray(axis.ci95)&&axis.ci95.length===2){
        const ciLow=Math.max(0,Math.min(100,axis.ci95[0]));
        const ciHigh=Math.max(ciLow,Math.min(100,axis.ci95[1]));
        const ciBand=h('span','mbti-axis-ci');
        ciBand.style.left=(100-ciHigh)+'%';
        ciBand.style.width=Math.max(2,ciHigh-ciLow)+'%';
        if(axis.letter!=='?'){
          const activeLo=Math.round(isPositive?ciLow:(100-ciHigh));
          const activeHi=Math.round(isPositive?ciHigh:(100-ciLow));
          ciBand.title='טווח סמך פסיכומטרי 95% למיקום בציר עבור '+axis.letter+': '+activeLo+'–'+activeHi+' מתוך 100';
        }
        line.append(ciBand);
      }
      const center=h('span','mbti-axis-center');
      const marker=h('span','mbti-axis-marker');
      marker.style.left=(100-axis.score)+'%';
      line.append(center,marker);
      const explanation=h('p','mbti-axis-note'+((axis.unclear||axis.ciCrossesMidline)?' mbti-uncertain':''),axis.message);
      card.append(heading,poles,line,explanation);

      const statPersonal=$('mbtiPersonal'+axis.key);
      if(statPersonal){
        if(axis.letter!=='?'&&activePct!==null){
          const empAxisNote=(typeof axis.empiricalPolePercentile==='number')?' · אחוזון בציר: '+Math.round(axis.empiricalPolePercentile)+'%':'';
          const stabilityNote=axis.borderline?' · יציבות אות בין גרסאות 120/300: גבולית (<70%)':' · יציבות אות בין גרסאות 120/300: גבוהה (≥70%)';
          // Built from DOM nodes (no innerHTML): numbers and letters go in as text only.
          const formula=h('span','mbti-stat-personal-formula');
          const isContinuous=axis.hasPublishedCriterion===false;
          formula.append((isContinuous?'מיקום רציף בציר: ':'מיקום בציר: ')+activePct+'/100 ('+axis.letter+')'+empAxisNote);
          if(!isContinuous)formula.append(' · מתאם: ',h('bdi',null,resPct));
          if(typeof axis.mosierReliability==='number')formula.append(' · מהימנות משוקללת ',h('bdi',null,'rₘ = '+axis.mosierReliability.toFixed(2)));
          formula.append(stabilityNote);
          if(isContinuous){
            statPersonal.replaceChildren(formula,h('span','mbti-stat-personal-badge','ציר רציף (ללא הסתברות MBTI)'));
          }else if(weightedPct!==null){
            statPersonal.replaceChildren(formula,h('span','mbti-stat-personal-badge','~'+weightedPct+'% הסתברות סיווג במודל'));
          }
        }else{
          statPersonal.textContent='';
        }
      }

      children.push(card);
    }
    mount.replaceChildren(...children);

    if(advMount){
      const advNodes=[];
      if(Array.isArray(outcome.topTypes)&&outcome.topTypes.length>=2){
        const altCard=h('div','mbti-alternatives-card');
        const altHead=h('div','mbti-alternatives-head');
        const altTitle=h('strong','mbti-alternatives-title','מדד התאמה יחסי בין הטיפוסים הקרובים ביותר');
        altHead.append(altTitle);
        if(typeof outcome.cohortPrevalence4==='number'&&outcome.fourType){
          const prevBadge=h('span','mbti-fusion-badge','שכיחות אומדן ארבע האותיות במדגם: '+outcome.cohortPrevalence4+'% ('+outcome.fourType+')');
          prevBadge.title='שכיחות הטיפוס המוערך ע״י המודל במדגם הייחוס הכללי (N='+(outcome.cohortN||145388).toLocaleString('he-IL')+')';
          altHead.append(prevBadge);
        }
        if(Array.isArray(outcome.multiInstrumentSources)&&outcome.multiInstrumentSources.length){
          const fuseBadge=h('span','mbti-fusion-badge','אינדיקציה משלימה: +'+outcome.multiInstrumentSources.join(' · '));
          altHead.append(fuseBadge);
        }
        const pillsRow=h('div','mbti-alternatives-row');
        outcome.topTypes.forEach((tItem,idx)=>{
          const pill=h('div','mbti-alt-pill'+(idx===0?' is-primary':''));
          const codeEl=h('bdi','mbti-alt-code',tItem.fourType);
          const pctEl=h('span','mbti-alt-pct',tItem.pct.toFixed(1)+'%');
          const tagEl=h('small','mbti-alt-rank',idx===0?'התאמה מובילה':'חלופה #'+(idx+1));
          pill.append(codeEl,pctEl,tagEl);
          pillsRow.append(pill);
        });
        const altHint=h('p','mbti-alternatives-hint','אומדן התאמה יחסי של המודל על פני 16 הטיפוסים (מבוסס מתאמים מבניים): כשציר קרוב ל־50%, הטיפוסים השכנים מציגים זוויות משלימות בפרופיל שלך.');
        altCard.append(altHead,pillsRow,altHint);
        advNodes.push(altCard);
      }

      advMount.replaceChildren(...advNodes);
    }

    const totalEl=$('mbtiPersonalTotal');
    if(totalEl){
      const knownFour=outcome.axes.slice(0,4).filter(a=>a.letter!=='?');
      if(knownFour.length===4){
        const compositeConfidence=typeof outcome.compositeConsistency==='number'?outcome.compositeConsistency:50;
        const fourLabel=outcome.fourType||knownFour.map(a=>a.letter).join('');
        const cohortTag=' · מדגם השאלון N='+(outcome.cohortN||145388).toLocaleString('he-IL');
        const totalFormula=h('span','mbti-stat-personal-formula');
        totalFormula.append('מדד עקביות צירי ממוצע לאומדן ',h('bdi',null,fourLabel),' על פני 4 הצירים'+cohortTag+' (ממוצע פשוט של הצירים, בלי חישוב תלות בין הצירים. אינו מהווה ודאות אישית):');
        totalEl.replaceChildren(totalFormula,h('span','mbti-stat-personal-badge is-total','~'+compositeConfidence+'% ממוצע צירי (משוקלל R²)'));
      }else{
        totalEl.textContent='';
      }
    }

    const eqNote300=outcome.inventoryMode===300
      ?' (הערת ייחוס: האחוזונים משווים ל־145,388 משיבי שאלון 300; מיקום הצירים מחושב בנפרד באותם מקדמי מודל).'
      :'';
    const borderlineList=borderlineFour.map(a=>a.letter+'/'+a.alternativeLetter).join(', ');
    status.textContent=outcome.fourType
      ?(borderlineFour.length
        ?'האומדן ' + outcome.fourType + ' כולל ' + (borderlineFour.length===1?'ציר גבולי: ':'צירים גבוליים: ')+borderlineList+'. חשוב לבחון גם את הצד השני של הרצף.'+eqNote300
        :uncertainFour.length
          ?'אומדן ארבע האותיות מבוסס על תכונות רציפות; '+uncertainFour.length+' מהצירים קרובים לקו האמצע או שרווח הסמך חוצה אותו.'+eqNote300
          :'אומדן ארבע אותיות מתוך Big Five, עם מיקום רציף וטווחי סמך לכל ציר.'+eqNote300)
      :(outcome.validitySuspended
        ?'איכות המענה אינה מספקת להערכת סגנון האותיות. ציוני Big Five מוצגים בנפרד.'
        :'הנתונים אינם מאפשרים לבחור את כל ארבע האותיות בביטחון; התכונות הרציפות הן התוצאה המרכזית.');
    const shareBtn=$('mbtiShareCardBtn');
    if(shareBtn&&!shareBtn.dataset.bound){
      shareBtn.dataset.bound='true';
      shareBtn.addEventListener('click',()=>{
        const trigger=$('openShareCard')||$('resultsShareTop');
        if(trigger)trigger.click();
      });
    }
  }
  // Pure Big Five projection. Emotional stability is the reverse of N,
  // not the independent resilience construct and not the commercial A/T axis.
  function renderEmotionalStability(profile){
    const card=$('emotionalStabilityCard'),domain=profile?.domains?.N;
    if(!card)return;
    if(!domain||!Number.isFinite(Number(domain.score))){card.hidden=true;return;}
    const clamp100=n=>Math.max(0,Math.min(100,Number(n)));
    const stability=100-clamp100(domain.score);
    const norm=profile.normRows?.find(row=>row.key==='N');
    const nCi=Array.isArray(norm?.ci95)&&norm.ci95.length===2&&norm.ci95.every(v=>Number.isFinite(Number(v)))?norm.ci95:null;
    const ci=nCi?[100-clamp100(nCi[1]),100-clamp100(nCi[0])]:null;
    const value=$('emotionalStabilityValue');
    if(value)value.textContent=String(Math.round(stability));
    const marker=$('emotionalStabilityMarker');
    if(marker)marker.style.left=stability+'%';
    // The 95% range is stated in the context line and the track's label, not drawn on the bar.
    const context=$('emotionalStabilityContext');
    if(context){
      const pct=Number(domain.percentileExact);
      const percentile=profile.empiricalReference&&Number.isFinite(pct)
        ?' · אחוזון יציבות משלים בקירוב: '+Math.round(100-pct)
        :'';
      const ciText=ci?' · טווח מדידה 95%: '+Math.round(ci[0])+'–'+Math.round(ci[1]):'';
      context.textContent='ציון יציבות '+Math.round(stability)+'/100'+percentile+ciText+
        '. זהו ציון N בהיפוך סולם, ואינו מדד נפרד לחוסן.';
    }
    const track=$('emotionalStabilityTrack');
    if(track)track.setAttribute('aria-label','יציבות רגשית '+Math.round(stability)+' מתוך 100'+
      (ci?', טווח מדידה 95% '+Math.round(ci[0])+' עד '+Math.round(ci[1]):''));
    const detail=$('emotionalStabilityDetails');
    if(detail&&!detail.dataset.bound){
      detail.dataset.bound='true';
      detail.addEventListener('click',()=>{
        const nCard=$('trait-N');
        if(nCard){nCard.open=true;nCard.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
      });
    }
    card.hidden=false;
  }
  window.renderEstimatedType=renderEstimatedType;
  function calculateResults(){
    const raw=core.calculate(bank,answers);
    if(!window.OfiEmpirical)throw Error('מנוע האחוזונים לא נטען. רענן את העמוד.');
    const enriched=window.OfiEmpirical.enrich(raw,bank,answers,core);
    // One source for supplementary answers: in a protected session it returns the
    // tokens unlocked from the encrypted bundle and never plaintext browser storage.
    const supp=currentSuppTokens();
    if(window.OfiHexacoCodec){
      const hToken=supp.h;
      if(hToken){
        try{
          const hexAnswers=window.OfiHexacoCodec.decode(hToken);
          const bankEl=$('data-hexaco-items');
          const hexBank=bankEl?JSON.parse(bankEl.textContent):window.OfiHexacoBank;
          if(hexBank&&Array.isArray(hexAnswers)&&hexAnswers.length===16){
            enriched.hexacoHonesty=window.OfiHexacoCodec.calculate(hexBank,hexAnswers);
          }
        }catch(e){}
      }
    }

    if(window.OfiEcrrsCodec){
      const aToken=supp.a;
      if(aToken){
        try{
          const ecrrsAnswers=window.OfiEcrrsCodec.decode(aToken);
          if(Array.isArray(ecrrsAnswers)&&ecrrsAnswers.length===9){
            enriched.ecrrsScores=window.OfiEcrrsCodec.calculate(ecrrsAnswers);
          }
        }catch(e){}
      }
    }

    if(window.OfiViaCodec){
      const vToken=supp.v;
      if(vToken){
        try{
          const viaAnswers=window.OfiViaCodec.decode(vToken);
          const viaEl=$('data-via-items');
          const viaBank=viaEl?JSON.parse(viaEl.textContent):window.OfiViaBank;
          if(viaBank&&Array.isArray(viaAnswers)&&viaAnswers.length===60){
            enriched.viaStrengths=window.OfiViaCodec.calculate(viaBank,viaAnswers,enriched);
          }
        }catch(e){}
      }else if(typeof window.OfiViaCodec.calculate==='function'){
        try{
          const viaEl=$('data-via-items');
          const viaBank=viaEl?JSON.parse(viaEl.textContent):window.OfiViaBank;
          if(viaBank)enriched.viaStrengths=window.OfiViaCodec.calculate(viaBank,null,enriched);
        }catch(e){}
      }
    }
    
    if(window.computeResponseValidityFeatures) {
       enriched.validityFeatures = window.computeResponseValidityFeatures(answers, bank, enriched);
    }
    return enriched;
  }
  function showResults(options={}){
    if(count()!==TOTAL){showError('כדי להציג תוצאות נדרש לענות על כל ההיגדים.');return;}
    clearTimeout(autoadvance);
    const keepScroll=Boolean(options.preserveScroll);
    const prevScrollY=keepScroll?window.scrollY:0;
    const openDomainIds=keepScroll?new Set(Array.from(document.querySelectorAll('.domain-card[open]')).map(n=>n.id).filter(Boolean)):null;
    const openGroupTraits=keepScroll?new Set(Array.from(document.querySelectorAll('#facetExplorerList .facet-domain-group[open]')).map(n=>n.dataset.trait).filter(Boolean)):null;
    const openFacetNames=keepScroll?new Set(Array.from(document.querySelectorAll('#facetExplorerList .facet-explorer-card[open] h3')).map(n=>n.textContent).filter(Boolean)):null;
    const openAuditNames=keepScroll?new Set(Array.from(document.querySelectorAll('#facetExplorerList .facet-explorer-card')).filter(n=>n.querySelector('.facet-audit-details[open]')).map(n=>n.querySelector('h3')?.textContent).filter(Boolean)):null;
    if(!options.preserveSavedLink)persist();
    if(answeredInSession&&!funnelCompleted[TOTAL]){funnelCompleted[TOTAL]=true;sendFunnelBeacon('complete',TOTAL);}
    const scores=calculateResults();
    latestResults=scores;
    const offer300=$('continue300');if(offer300)offer300.hidden=TOTAL!==120;
    refreshSecureButtons();
    const percentileMode=Boolean(scores.empiricalReference);
    const resultLede=result.querySelector('.results-heading .lede');
    if(resultLede)resultLede.textContent=percentileMode
      ?'האחוזונים מציגים את מיקומך ביחס למשיבי מדגם ההשוואה. פתח תכונה כדי לראות גם את ציון השאלון.'
      :'ציוני 0–100 מתארים את התשובות לשאלון, ואינם אחוזונים או השוואה לאחרים.';
    renderRadar(scores);
    renderEmotionalStability(scores);
    const target=$('domainResults');target.replaceChildren();
    for(const d of core.ORDER){
      const x=scores.domains[d],card=h('details','domain-card');
      card.dataset.trait=d;card.id='trait-'+d;card.style.setProperty('--reveal-order',core.ORDER.indexOf(d));
      const summary=h('summary','domain-summary');
      const header=h('div','domain-card-header');
      const score=h('span','score',percent(percentileMode?x.percentile:x.score));
      score.append(h('small',null,percentileMode?' אחוזון':' / 100'));
      score.setAttribute('aria-label',percentileMode?'אחוזון '+x.percentile:'ציון שאלון '+percent(x.score)+' מתוך 100');
      const pVal=percentileMode?x.percentile:(typeof x.rangeScore==='number'?x.rangeScore:x.score);
      const lvlText=levelLabel(pVal,percentileMode,d);
      const lvlClass=percentileMode?(pVal>=90?'very-high':pVal>=70?'high':pVal>=31?'mid':pVal>=11?'low':'very-low'):(pVal>62.5?'high':pVal>=37.5?'mid':'low');
      const badge=h('span','domain-level-badge level-'+lvlClass,lvlText);
      header.append(h('h3',null,x.label),badge,score,icon('chevron'));
      summary.append(header,track(percentileMode?x.percentileExact:x.score));
      if(x.facets&&x.facets.length===6){
        const strip=h('div','domain-sparkline-strip');
        strip.setAttribute('role','region');
        strip.setAttribute('aria-label','פיזור ששת תחומי המשנה');
        const trackLine=h('div','domain-sparkline-track');
        x.facets.forEach((f,i)=>{
          const v=percentileMode?f.percentileExact:f.score;
          const dot=h('span','domain-sparkline-dot');
          const clampedV=Math.max(2,Math.min(98,v));
          dot.style.insetInlineStart=clampedV+'%';
          dot.tabIndex=0;
          dot.setAttribute('role','button');
          const scoreText=percentileMode?'אחוזון '+f.percentile:percent(f.score)+'/100';
          dot.setAttribute('aria-label',f.label+': '+scoreText);

          if(clampedV<18)dot.classList.add('tooltip-align-start');
          else if(clampedV>82)dot.classList.add('tooltip-align-end');

          const tip=h('span','sparkline-tooltip');
          tip.setAttribute('role','tooltip');
          const tipName=h('strong','sparkline-tooltip-name',f.label);
          const tipScore=h('span','sparkline-tooltip-score',scoreText);
          tip.append(tipName,tipScore);
          dot.append(tip);

          const toggleTooltip=e=>{
            e.preventDefault();
            e.stopPropagation();
            const wasActive=dot.classList.contains('is-active');
            document.querySelectorAll('.domain-sparkline-dot.is-active').forEach(d=>d.classList.remove('is-active'));
            if(!wasActive)dot.classList.add('is-active');
          };
          dot.addEventListener('click',toggleTooltip);
          dot.addEventListener('touchstart',e=>{
            e.stopPropagation();
          },{passive:true});
          dot.addEventListener('keydown',e=>{
            if(e.key==='Enter'||e.key===' '){
              toggleTooltip(e);
            }
          });
          trackLine.append(dot);
        });
        const hint=h('span','domain-sparkline-hint','פיזור 6 תחומי המשנה בסולם');
        strip.append(trackLine,hint);
        summary.append(strip);
      }
      card.append(summary);
      const content=h('div','domain-detail');
      if(percentileMode)content.append(h('p','empirical-inline','ציון השאלון: '+percent(x.score)+'/100 ('+(x.rangeLevelLabel||x.levelLabel)+') · דירוג יחסי: אחוזון '+x.percentile+' ('+x.levelLabel+')'));
      content.append(h('p','domain-interpretation',x.text));
      const rows=h('div','facet-items');
      rows.append(h('h4',null,'ששת תחומי המשנה'));
      for(const f of x.facets){
        const row=h('div','facet-item'),hdr=h('div','facet-head');
        hdr.append(h('b',null,f.label),h('span',null,percentileMode?'אחוזון '+f.percentile:percent(f.score)+'/100'));
        row.append(hdr,track(percentileMode?f.percentileExact:f.score));
        if(percentileMode)row.append(h('p','empirical-inline','ציון השאלון: '+percent(f.score)+'/100 ('+(f.rangeLevelLabel||f.levelLabel)+') · דירוג יחסי: אחוזון '+f.percentile+' ('+f.levelLabel+')'));
        row.append(h('p','facet-interpretation',f.text));rows.append(row);
      }
      content.append(rows);
      card.append(content);target.append(card);
    }
    renderEstimatedType(scores);
    visible(result,keepScroll);
    const footerRawBtn=$('footerDownloadRaw');if(footerRawBtn)footerRawBtn.hidden=false;
    if(!keepScroll){
      const resultHeading=result.querySelector('h1');if(resultHeading){resultHeading.tabIndex=-1;resultHeading.focus({preventScroll:true});}
    }
    if(window.OfiVisuals)window.OfiVisuals.render(scores,{total:TOTAL,instrument:bank.instrument});
    // Local UI modules receive in-memory profile, item bank, and answer-edit callback (never sent to any server).
    if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')
      window.dispatchEvent(new CustomEvent('ofilab:results',{detail:{profile:scores,total:TOTAL,bank:bank,answers:[...answers],setAnswer:(idx,val)=>{if(idx>=0&&idx<answers.length&&val>=1&&val<=5){answers[idx]=val;persist();showResults({preserveSavedLink:false,preserveScroll:true});toast('התשובה עודכנה והציונים חושבו מחדש.');}}}}));
    if(keepScroll){
      if(openDomainIds)openDomainIds.forEach(id=>{const d=$(id);if(d)d.open=true;});
      if(openGroupTraits)document.querySelectorAll('#facetExplorerList .facet-domain-group').forEach(g=>{if(openGroupTraits.has(g.dataset.trait))g.open=true;});
      if(openFacetNames||openAuditNames){
        document.querySelectorAll('#facetExplorerList .facet-explorer-card').forEach(c=>{
          const nm=c.querySelector('h3')?.textContent;
          if(nm&&openFacetNames?.has(nm))c.open=true;
          if(nm&&openAuditNames?.has(nm)){
            c.open=true;
            const aud=c.querySelector('.facet-audit-details');
            if(aud)aud.open=true;
          }
        });
      }
      window.scrollTo({top:prevScrollY,behavior:'instant'});
      return;
    }
    resetResultsToTop();
  }
  function updateResultMetric(mode){
    if(!latestResults)return;
    const relative=mode==='percentile'&&Boolean(latestResults.empiricalReference);
    const value=x=>relative?x.percentile:x.score;
    const fill=x=>relative?x.percentileExact:x.score;
    for(const d of core.ORDER){
      const x=latestResults.domains[d],card=$('trait-'+d);if(!card)continue;
      const score=card.querySelector('.score');score.replaceChildren(document.createTextNode(percent(value(x))),h('small',null,relative?' אחוזון':' / 100'));
      score.setAttribute('aria-label',relative?'אחוזון '+x.percentile:'ציון שאלון '+percent(x.score)+' מתוך 100');
      const pVal=relative?x.percentile:(typeof x.rangeScore==='number'?x.rangeScore:x.score);
      const lvlText=levelLabel(pVal,relative,d);
      const lvlClass=relative?(pVal>=90?'very-high':pVal>=70?'high':pVal>=31?'mid':pVal>=11?'low':'very-low'):(pVal>62.5?'high':pVal>=37.5?'mid':'low');
      const badge=card.querySelector('.domain-level-badge');
      if(badge){badge.className='domain-level-badge level-'+lvlClass;badge.textContent=lvlText;}
      const domInterp=card.querySelector('.domain-interpretation');
      if(domInterp)domInterp.textContent=relative?x.text:(x.rangeText||x.text);
      card.querySelector('.domain-summary .track > div').style.width=fill(x)+'%';
      card.querySelectorAll('.domain-sparkline-dot').forEach((dot,index)=>{
        const f=x.facets&&x.facets[index];
        if(!f)return;
        const v=relative?f.percentileExact:f.score;
        dot.style.insetInlineStart=Math.max(2,Math.min(98,v))+'%';
        dot.title=f.label+': '+(relative?f.percentile+' אחוזון':percent(f.score)+'/100');
      });
      card.querySelectorAll('.facet-item').forEach((row,index)=>{
        const f=x.facets[index];row.querySelector('.facet-head > span').textContent=relative?'אחוזון '+f.percentile:percent(f.score)+'/100';
        row.querySelector('.track > div').style.width=fill(f)+'%';
        const fInterp=row.querySelector('.facet-interpretation');
        if(fInterp)fInterp.textContent=relative?f.text:(f.rangeText||f.text);
      });
    }
    const lede=result.querySelector('.results-heading .lede');
    if(lede)lede.textContent=relative?'האחוזונים מציגים את מיקומך ביחס למשיבי מדגם ההשוואה. פתח תכונה כדי לראות את הפירוט.':'ציוני 0–100 מתארים את התשובות לשאלון. הם אינם אחוזונים; ההשוואה למדגם נמצאת בהמשך הדוח.';
  }
  function resultsDisplaySnapshot(profile){
    const md=window.OfiLabExportMarkdown,root=$('resultScreen');
    const mode=$('resultsMetric')?.value==='percentile'&&profile.empiricalReference?'percentile':'score';
    const vf=profile.validityFeatures;
    const lowQuality=Boolean(vf&&(vf.validityLevel==='low'||vf.isSevereStraightline||vf.isSuspectedRandomResponding));
    let cybernetics=null;
    try{if(!lowQuality&&typeof window.calculateCybernetics==='function')cybernetics=window.calculateCybernetics(profile,mode==='percentile');}catch(_e){}
    return {
      mode,
      reportMarkdown:md&&root&&md.generateDisplayedMarkdown?md.generateDisplayedMarkdown(root):null,
      // Validity is already in profile.validityFeatures; not repeated here.
      models:{cybernetics,lowQuality,validity:vf?'profile.validityFeatures':null}
    };
  }
  async function safelyDownload(){
    if(count()!==TOTAL)return;
    const status=$('resultsFileStatus'),buttons=[$('downloadResults'),$('downloadResultsMain'),$('resultsFooterDownloadResults')].filter(Boolean);
    buttons.forEach(b=>b.disabled=true);
    if(status)status.textContent='מכין קובץ תוצאות…';
    try{
    let report;
    const supp=currentSuppTokens();
    if(protectedMode){
      report=window.OfiLabResultsFiles.protectedReport(await secure.encrypt(stateToken(),supp),TOTAL);
    }else{
    const profile=calculateResults();
    // viaStrengths.ranked is the same list as viaStrengths.strengths: write it once.
    if(profile.viaStrengths&&profile.viaStrengths.ranked===profile.viaStrengths.strengths){
      profile.viaStrengths={...profile.viaStrengths};delete profile.viaStrengths.ranked;
    }
    report=window.OfiLabResultsFiles.plainReport({
      title:'ofiLab - '+bank.instrument+' - Hebrew',
      warning:profile.empiricalReference?'Range scores and empirical percentiles are separate metrics. Percentiles use '+profile.empiricalReference.referenceInstrument+', N='+profile.empiricalReference.n+', pooled midrank across '+profile.empiricalReference.percentileItems+' answered items. Hebrew translation is unvalidated.':'Translated questionnaire; possible-range scores, not percentiles.',
      generatedAt:new Date().toISOString(),profile,estimatedFourLetters:window.OfiFourLetters?window.OfiFourLetters.estimate(profile):null,
      // Everything the results screen shows, in the mode selected when downloading:
      // the full displayed report as Markdown (every model, number and sentence),
      // plus the derived models that the screen computes from the profile.
      display:resultsDisplaySnapshot(profile),
      answers:[...answers],questions:bank.items.map(i=>({id:i.id,text:i.he,domain:i.domain,facet:i.facet,keyed:i.keyed,adaptation:i.adaptation||null})),
      ...(supp.h?{hexacoToken:supp.h}:{}),
      ...(supp.v?{viaToken:supp.v}:{}),
      ...(supp.a?{ecrrsToken:supp.a}:{})
    },TOTAL);
    }
    const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'});
    const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=extendedForm?'personality-ipip-neo-300-he.json':'personality-ipip-neo-120-he.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
    if(status)status.textContent=protectedMode?'הקובץ המוצפן הוכן להורדה. שמור את הסיסמה בנפרד.':'הקובץ הוכן להורדה. ניתן לטעון אותו במסך הראשי.';
    }catch(e){if(status)status.textContent='לא ניתן להוריד את הקובץ. '+e.message;}
    finally{buttons.forEach(b=>b.disabled=false);}
  }
  async function downloadRawQuestions(){
    if(count()!==TOTAL)return;
    // The raw-questions file is always plaintext. In a protected session that must be an explicit choice.
    if(protectedMode&&!window.confirm('קובץ השאלות הגולמי אינו מוצפן: הוא כולל את כל התשובות בגלוי, גם במצב שמירה בסיסמה. להוריד בכל זאת?'))return;
    const status=$('resultsFileStatus'),buttons=[$('downloadRawQuestions'),$('downloadRawQuestionsMain'),$('footerDownloadRaw'),$('resultsFooterDownloadRaw')].filter(Boolean);
    buttons.forEach(b=>b.disabled=true);
    if(status)status.textContent='מכין קובץ שאלות גולמי (JSON RAW)…';
    try{
      const scale=bank.scale||['בכלל לא מתאר אותי','מתאר אותי מעט','מתאר אותי במידה בינונית','מתאר אותי במידה רבה','מתאר אותי מאוד'];
      const domainDefs=core.DOMAINS||{};
      const facetDefs=core.FACETS||{};
      const rawQuestions=bank.items.map((item,idx)=>{
        const userChoice=answers[idx];
        const isMinus=item.keyed==='minus'||item.keyed===-1;
        const scoredValue=isMinus?6-userChoice:userChoice;
        const dDef=domainDefs[item.domain];
        const fDef=item.facet&&facetDefs[item.domain]?facetDefs[item.domain][item.facet-1]:null;
        return {
          number:idx+1,
          id:item.id||String(idx+1),
          text:item.he,
          source_en:item.source_en||null,
          domain:item.domain,
          domainName:dDef?.name||item.domain,
          facet:item.facet||null,
          // The name shown on the results page (it can differ from the engine's, e.g. O6).
          facetName:latestResults?.domains?.[item.domain]?.facets?.[item.facet-1]?.label||(fDef?fDef[0]:null),
          keyed:item.keyed,
          userChoice,
          choiceLabel:scale[userChoice-1]||null,
          scoredValue
        };
      });
      const inventoryName=extendedForm?'ipip-neo-300':'ipip-neo-120';
      const supp=currentSuppTokens();
      const hexacoToken=supp.h||undefined;
      const viaToken=supp.v||undefined;
      const ecrrsToken=supp.a||undefined;
      const rawReport={
        title:'ofiLab - '+(bank.instrument||inventoryName)+' - Hebrew Raw Questions',
        format:'ofilab-results',
        type:'raw-questions',
        fileVersion:1,
        inventory:inventoryName,
        instrument:bank.instrument||inventoryName,
        version:bank.version||null,
        generatedAt:new Date().toISOString(),
        totalQuestions:TOTAL,
        scale,
        answers:[...answers],
        questions:rawQuestions,
        ...(hexacoToken?{hexacoToken}:{}),
        ...(viaToken?{viaToken}:{}),
        ...(ecrrsToken?{ecrrsToken}:{})
      };
      const blob=new Blob([JSON.stringify(rawReport,null,2)],{type:'application/json;charset=utf-8'});
      const u=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=u;
      a.download=extendedForm?'personality-ipip-neo-300-raw-questions.json':'personality-ipip-neo-120-raw-questions.json';
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(u),1500);
      if(status)status.textContent='קובץ השאלות (JSON RAW) הוכן להורדה. ניתן לטעון אותו במסך הראשי.';
      toast('קובץ השאלות (JSON RAW) הורד בהצלחה! ניתן לטעון אותו במסך הראשי.');
    }catch(e){
      if(status)status.textContent='לא ניתן להוריד את קובץ השאלות. '+e.message;
    }finally{
      buttons.forEach(b=>b.disabled=false);
    }
  }
  async function copyLink(){
    try{
      if(protectedMode){
        const revision=++saveRevision;
        saveIndicator('pending','מצפין קישור עדכני…');
        let token;
        try{token=await secure.encrypt(stateToken(),currentSuppTokens());}
        catch(err){showError('יצירת הקישור המוצפן נכשלה. נסה שוב.');return;}
        if(revision!==saveRevision){showError('התשובות השתנו במהלך יצירת הקישור. נסה שוב.');return;}
        encryptedToken=token;
        replaceSavedHash('e',token);
        const ok=secure.saveLocal(token);
        saveIndicator(ok?'saved':'error',ok?'שמירה מוצפנת במכשיר':'קישור מוצפן מוכן; השמירה במכשיר נכשלה');
      }
      const text=link();
      if(!navigator.clipboard||!window.isSecureContext)throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast(protectedMode?'הקישור המוצפן הועתק. יש לשמור בנפרד גם את הסיסמה.':'הקישור הועתק בהצלחה! התוצאות שמורות בקישור בלבד (ללא שרת).');
    }catch(e){
      if(protectedMode&&!encryptedToken){showError('לא ניתן ליצור קישור מוצפן: '+e.message);return;}
      window.prompt('העתק את הקישור ושמור אותו במקום בטוח:',link());
    }
  }
  function updatePasswordMeter(){
    const panel=$('passwordStrengthPanel'),input=$('protectedPassword');if(!panel||!input)return;
    const len=[...input.value.normalize('NFC')].length;
    const lengthLabel=$('passwordLength');
    if(lengthLabel){
      lengthLabel.hidden=saveDialogMode==='unlock';
      lengthLabel.dataset.ready=String(len>=8);
      lengthLabel.textContent=len>=8?'✓ '+len+' תווים':len+' / 8 תווים';
    }
    panel.hidden=saveDialogMode==='unlock';if(panel.hidden)return;
    const data=window.OfiLabPasswordStrength?.evaluate(input.value);if(!data)return;
    panel.dataset.level=String(data.level);
    panel.dataset.hasValue=String(len>0);

    const segs=data.segments||[0,0,0,0];
    panel.style.setProperty('--seg-1-fill',(segs[0]*100).toFixed(1)+'%');
    panel.style.setProperty('--seg-2-fill',(segs[1]*100).toFixed(1)+'%');
    panel.style.setProperty('--seg-3-fill',(segs[2]*100).toFixed(1)+'%');
    panel.style.setProperty('--seg-4-fill',(segs[3]*100).toFixed(1)+'%');

    $('passwordStrengthLevel').textContent=data.label;
    $('passwordStrengthFill').style.width=data.score+'%';
    $('passwordStrengthTrack').setAttribute('aria-valuenow',String(data.score));
    $('passwordStrengthHint').textContent=data.tip;
  }
  function openSaveDialog(mode,token){
    if(mode==='unlock'){pendingProtectedToken=token;needsUnlock=true;$('unlockProtectedAgain').hidden=false;}
    saveDialogMode=mode;
    const title=$('protectedDialogTitle'),hint=$('protectedDialogHint'),confirm=$('protectedPasswordConfirmWrap'),normal=$('disableProtection');
    title.textContent=mode==='unlock'?'פתיחת שמירה מוצפנת':mode==='change'?'שינוי הסיסמה':'יצירת שמירה מוצפנת';
    hint.textContent=mode==='unlock'?'יש להזין את הסיסמה שהגדרת כדי לפתוח את התשובות. היא אינה נשלחת לשרת.':
      'התשובות וההתקדמות יוצפנו במכשיר שלך. בחר סיסמה ייחודית של 8 תווים לפחות; רצוי 12–16 ומעלה.';
    confirm.hidden=mode==='unlock';
    normal.hidden=!protectedMode||mode==='unlock';
    $('protectedSubmit').textContent=mode==='unlock'?'פתיחת השמירה':mode==='change'?'עדכון הסיסמה':'יצירת שמירה מוגנת';
    $('protectedPassword').value='';$('protectedPasswordConfirm').value='';
    $('protectedError').textContent='';
    const dialog=$('protectedSaveDialog');
    dialog.dataset.mode=mode;
    $('protectedPassword').type='password';
    $('protectedPasswordConfirm').type='password';
    const reveal=$('toggleProtectedPassword');
    if(reveal){reveal.setAttribute('aria-pressed','false');reveal.textContent='הצג סיסמה';}
    const meter=$('passwordHint');
    if(meter)meter.textContent=mode==='unlock'?'הסיסמה משמשת לפענוח בדפדפן בלבד.':'לפחות 8 תווים. מומלץ משפט סיסמה ייחודי.';
    $('protectedPassword').minLength=mode==='unlock'?1:8;
    updatePasswordMeter();
    if(!dialog.open)dialog.showModal();
    $('protectedPassword').focus();
  }
  function finishUnlock(){
    needsUnlock=false;$('unlockProtectedAgain').hidden=true;
    if(count()===TOTAL)showResults();
    else{visible(quiz);question();}
  }
  function setupProtection(){
    refreshSecureButtons();
    for(const id of ['protectSaveQuiz','protectSaveResults','protectSaveTop']){
      const button=$(id);if(button)button.addEventListener('click',()=>openSaveDialog(protectedMode?'change':'create'));
    }
    $('protectedCancel').addEventListener('click',()=>$('protectedSaveDialog').close());
    const reveal=$('toggleProtectedPassword');
    if(reveal)reveal.addEventListener('click',()=>{
      const showing=$('protectedPassword').type==='text';
      $('protectedPassword').type=showing?'password':'text';
      $('protectedPasswordConfirm').type=showing?'password':'text';
      reveal.textContent=showing?'הצג סיסמה':'הסתר סיסמה';
      reveal.setAttribute('aria-pressed',String(!showing));
    });
    const passwordInput=$('protectedPassword');
    if(passwordInput)passwordInput.addEventListener('input',()=>{
      updatePasswordMeter();
      const hint=$('passwordHint');
      if(!hint)return;
      if(saveDialogMode==='unlock'){hint.textContent='הסיסמה תישאר בדפדפן ולא תישלח לשרת.';return;}
      const len=[...passwordInput.value.normalize('NFC')].length;
      hint.textContent=len===0?'לפחות 8 תווים, מומלץ 12–16.':len<8?'נדרשים עוד '+(8-len)+' תווים לפחות.':'אורך הסיסמה תקין. מומלץ לבחור ניסוח ייחודי שקשה לנחש.';
    });
    $('unlockProtectedAgain').addEventListener('click',()=>{if(pendingProtectedToken)openSaveDialog('unlock',pendingProtectedToken);});
    $('protectedSaveDialog').addEventListener('cancel',event=>{
      if(needsUnlock){event.preventDefault();$('protectedSaveDialog').close();visible(intro);}
    });
    $('disableProtection').addEventListener('click',()=>{
      if(!window.confirm('לכבות הצפנה? התשובות יישמרו שוב בגלוי במכשיר ובקישור.'))return;
      saveRevision++;
      protectedMode=false;encryptedToken=null;secure.lock();secure.clearLocal();
      if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(false);
      refreshSecureButtons();$('protectedSaveDialog').close();persist();
      toast('ההצפנה כובתה. הקישור החדש אינו מוגן.');
    });
    window.addEventListener('ofilab:supp-updated',()=>{
      if(protectedMode&&!securing)persist();
    });
    $('protectedSaveForm').addEventListener('submit',async event=>{
      event.preventDefault();
      const password=$('protectedPassword').value;
      const confirm=$('protectedPasswordConfirm').value;
      const submit=$('protectedSubmit'),error=$('protectedError');
      error.textContent='';
      if(saveDialogMode!=='unlock'&&password!==confirm){error.textContent='אימות הסיסמה אינו תואם.';return;}
      submit.disabled=true;
      let opEpoch=sessionEpoch;
      try{
        if(saveDialogMode!=='unlock'){securing=true;saveRevision++;}
        if(saveDialogMode==='unlock'){
          const bundle=typeof secure.unlockBundle==='function'?await secure.unlockBundle(pendingProtectedToken,password):{plain:await secure.unlock(pendingProtectedToken,password),supp:null};
          if(opEpoch!==sessionEpoch)return;
          const plain=bundle.plain;
          let openedToken=pendingProtectedToken,upgradeMessage='';
          if(secure.needsUpgrade()){
            if([...password.normalize('NFC')].length>=8){
              try{openedToken=await secure.upgrade(password,plain,bundle.supp);upgradeMessage='השמירה שודרגה ל־Argon2id. שמור את הקישור החדש; קישורים ישנים אינם מתבטלים.';}
              catch(e){upgradeMessage='השמירה נפתחה, אך השדרוג נכשל. הקישור עדיין משתמש ב־PBKDF2 עד לשינוי סיסמה.';}
              if(opEpoch!==sessionEpoch)return;
            }else upgradeMessage='הקישור הישן נפתח. לשדרוג ל־Argon2id בחר שינוי סיסמה עם 8 תווים לפחות.';
          }
          const decoded=codec.decode(plain);
          if(!decoded||!Array.isArray(decoded.answers)||!decoded.answers.every(v=>Number.isInteger(v)&&v>=0&&v<=5)){
            throw Error('תוכן הקישור המוצפן אינו תקין.');
          }
          if(decoded.answers.length!==TOTAL){
            switchInventory(decoded.answers.length,false,{preserveHash:true});
            opEpoch=sessionEpoch;
          }
          if(decoded.answers.length!==TOTAL)throw Error('אורך השאלון בקישור אינו תואם.');
          for(let i=0;i<TOTAL;i++)answers[i]=decoded.answers[i];
          const curRaw=Number.isInteger(decoded.cursor)?decoded.cursor:0;
          cursor=Math.max(0,Math.min(TOTAL-1,curRaw));
          protectedMode=true;encryptedToken=openedToken;saveRevision++;
          if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(true);
          if(typeof window.clearOfiLabSupplementaryLocal==='function')window.clearOfiLabSupplementaryLocal();
          if(typeof window.applyOfiLabSupplementaryTokens==='function')window.applyOfiLabSupplementaryTokens(bundle.supp);
          if(safeStore)await safeStore.clear();
          if(opEpoch!==sessionEpoch)return;
          secure.saveLocal(encryptedToken);
          replaceSavedHash('e',encryptedToken);
          refreshSecureButtons();
          $('protectedSaveDialog').close();
          finishUnlock();
          if(upgradeMessage)toast(upgradeMessage);
        }else{
          const supp=currentSuppTokens();
          const token=await secure.create(password,stateToken(),supp);
          if(opEpoch!==sessionEpoch)return;
          saveRevision++;protectedMode=true;encryptedToken=token;
          if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(true);
          if(safeStore)await safeStore.clear();
          const backedUp=secure.saveLocal(token);
          replaceSavedHash('e',token);
          refreshSecureButtons();
          saveIndicator(backedUp?'saved':'error',backedUp?'הקישור מוצפן; מומלץ להעתיק ולגבות אותו':'הקישור מוצפן אך לא נשמר במכשיר — העתק אותו מיד');
          $('protectedSaveDialog').close();
          toast('נוצר קישור מוצפן. שמור את הקישור והסיסמה בנפרד.');
        }
      }catch(err){error.textContent=err.message||'אירעה שגיאה. נסה שוב.';}
      finally{
        const wasSecuring=securing;securing=false;
        if(wasSecuring&&protectedMode)persist(); // capture answers changed during Argon2id key derivation
        else if(wasSecuring&&!protectedMode)persist(); // preserve changes if creation failed
        submit.disabled=false;$('protectedPassword').value='';$('protectedPasswordConfirm').value='';
      }
    });
  }
  function showLegacy50Banner(){
    const banner=$('legacy50Banner');
    if(banner)banner.hidden=false;
  }
  function configureInventoryPresentation(){
    const footerCount=$('footerQuestionCount');
    if(footerCount)footerCount.textContent=String(TOTAL);
    const progressMeter=$('progressMeter');
    if(progressMeter&&typeof progressMeter.setAttribute==='function')progressMeter.setAttribute('aria-valuemax',String(TOTAL));
    const estimate=$('mbtiDisclosure');
    if(estimate)estimate.hidden=false;
    document.querySelectorAll('[data-scroll="mbtiDisclosure"]').forEach(button=>{button.hidden=false;});
    const metric=$('resultMetricDescription');
    if(metric&&(!metric.textContent||metric.textContent.includes('874,434'))){
      metric.textContent='הציון 0–100 מתאר את טווח התשובות; אחוזון משווה למדגם המתאים לגרסת השאלון.';
    }
  }
  function setup(){
    configureInventoryPresentation();
    setupProtection();
    $('legacyBannerStart120')?.addEventListener('click',()=>{
      const banner=$('legacy50Banner');if(banner)banner.hidden=true;
      switchInventory(120,true);
    });
    $('legacyBannerStart300')?.addEventListener('click',()=>{
      const banner=$('legacy50Banner');if(banner)banner.hidden=true;
      switchInventory(300,true);
    });
    $('legacyBannerDismiss')?.addEventListener('click',()=>{
      const banner=$('legacy50Banner');if(banner)banner.hidden=true;
    });
    try{
      const savedMode=window.localStorage.getItem(PACE_KEY);
      // No saved preference means auto advance is ON.
      automatic=savedMode!=='manual';
      const savedDelay=Number(window.localStorage.getItem(PACE_DELAY_KEY));
      if(DELAYS.includes(savedDelay))advanceDelay=savedDelay;
      keyboardShortcuts=window.localStorage.getItem(KEYBOARD_KEY)!=='off';
    }catch(e){}
    const cancelPendingAdvance=()=>{clearTimeout(autoadvance);autoadvance=null;};
    const elAA=$('autoAdvance');
    if(elAA){
      elAA.checked=automatic;
      elAA.addEventListener('change',()=>{
        cancelPendingAdvance();
        automatic=elAA.checked;
        const elSpeed=$('autoAdvanceSpeed');
        if(elSpeed)elSpeed.disabled=!automatic;
        try{window.localStorage.setItem(PACE_KEY,automatic?'auto':'manual');}catch(e){}
        updatePaceFeedback();
      });
    }
    const elSpeed=$('autoAdvanceSpeed');
    if(elSpeed){
      elSpeed.value=String(advanceDelay);
      elSpeed.disabled=!automatic;
      elSpeed.addEventListener('change',()=>{
        cancelPendingAdvance();
        const chosen=Number(elSpeed.value);
        if(!DELAYS.includes(chosen)){elSpeed.value=String(advanceDelay);return;}
        advanceDelay=chosen;
        try{window.localStorage.setItem(PACE_DELAY_KEY,String(advanceDelay));}catch(e){}
      });
    }
    const elKS=$('keyboardShortcuts');
    if(elKS){
      elKS.checked=keyboardShortcuts;
      elKS.addEventListener('change',()=>{
        keyboardShortcuts=elKS.checked;
        try{window.localStorage.setItem(KEYBOARD_KEY,keyboardShortcuts?'on':'off');}catch(e){}
      });
    }
    $('askAiQuestion').addEventListener('click',()=>{clearTimeout(autoadvance);autoadvance=null;});
    const connection=$('connectionState');
    if(connection){
      const onConnection=()=>{
        const offline=typeof navigator.onLine==='boolean'&&!navigator.onLine;
        connection.hidden=!offline;
        if(offline){
          connection.textContent='אין חיבור לרשת. אפשר להמשיך בשאלון שכבר נטען; בדוק שהשמירה במכשיר הצליחה.';
          clearTimeout(autoadvance);autoadvance=null;
        }
      };
      if(typeof window.addEventListener==='function'){
        window.addEventListener('online',onConnection);
        window.addEventListener('offline',onConnection);
      }
      onConnection();
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(autoadvance);autoadvance=null;}});

    // A saved link opened in the same browser tab can be a fragment-only
    // navigation. Browsers do not reload the page for that, so restore it here.
    if(typeof window.addEventListener==='function'){
      window.addEventListener('hashchange',()=>{
        if(!loaded)return;
        const hash=window.location.hash;
        if(window.OfiLabProtectedLinkRouting?.deprecatedInventoryForHash?.(hash)){
          clearTimeout(autoadvance);
          protectedMode=false;encryptedToken=null;secure.lock();
          visible(intro);showLegacy50Banner();
          return;
        }
        if(hash.startsWith('#e=')){
          if(window.OfiLabProtectedLinkRouting?.navigateIfNeeded())return;
          clearTimeout(autoadvance);
          try{
            const token=hash.slice(3).split('&')[0];secure.parse(token);
            protectedMode=false;encryptedToken=null;secure.lock();answers.fill(0);cursor=0;
            visible(intro);openSaveDialog('unlock',token);
          }catch(err){
            if(err?.code==='LEGACY_50_DEPRECATED')showLegacy50Banner();
            else showError('קישור השמירה המוצפנת אינו תקין: '+err.message);
          }
          return;
        }
        if(!hash.startsWith('#p='))return;
        try{
          clearTimeout(autoadvance);
          if(protectedMode){
            protectedMode=false;encryptedToken=null;secure.lock();secure.clearLocal();refreshSecureButtons();
            // Drop the encrypted session's supplementary answers before leaving protected
            // mode, so they are neither appended to this plaintext link nor written to storage.
            if(typeof window.applyOfiLabSupplementaryTokens==='function')window.applyOfiLabSupplementaryTokens(null);
            if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(false);
          }
          restore(hash.slice(3).split('&')[0]);
          hideError();
          if(count()===TOTAL)showResults({preserveSavedLink:true});
          else goToQuiz();
        }catch(err){
          if(err?.code==='LEGACY_50_DEPRECATED')showLegacy50Banner();
          else showError('קישור השמירה אינו תקין: '+err.message);
        }
      });
    }
    $('questionAssistance')?.addEventListener('toggle',()=>{
      if($('questionAssistance').open){clearTimeout(autoadvance);autoadvance=null;}
    });
    $('questionHelpBtn').addEventListener('click',toggleHelp);
    $('closeQuestionHelp').addEventListener('click',()=>closeHelp(true));
    $('questionHelpDone').addEventListener('click',()=>closeHelp(true));
    $('questionHelpPanel').addEventListener('cancel',event=>{event.preventDefault();closeHelp(true);});
    $('questionHelpPanel').addEventListener('close',finishHelp);
    $('questionHelpPanel').addEventListener('keydown',event=>{
      if(event.key!=='Tab'||event.altKey||event.ctrlKey||event.metaKey)return;
      const first=$('closeQuestionHelp'),last=$('questionHelpDone'),active=document.activeElement;
      if(event.shiftKey&&(active===first||active===$('questionHelpTitle')||active===$('questionHelpPanel'))){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&active===last){
        event.preventDefault();first.focus();
      }
    });
    let helpBackdropDown=false;
    $('questionHelpPanel').addEventListener('pointerdown',event=>{
      const r=$('questionHelpPanel').getBoundingClientRect();
      helpBackdropDown=event.target===$('questionHelpPanel')&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);
    });
    $('questionHelpPanel').addEventListener('click',event=>{
      const r=$('questionHelpPanel').getBoundingClientRect();
      if(helpBackdropDown&&event.target===$('questionHelpPanel')&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))closeHelp(true);
      helpBackdropDown=false;
    });
    $('reviewBtn').addEventListener('click',()=>openReview('quiz'));
    $('reviewResults').addEventListener('click',()=>openReview('results'));
    $('closeReview').addEventListener('click',closeReviewDialog);
    $('reviewDone').addEventListener('click',closeReviewDialog);
    $('reviewDialog').addEventListener('close',afterReview);
    $('reviewSearch').addEventListener('input',event=>{
      reviewSearchTerm=event.target.value;reviewLimit=40;renderReview();
    });
    $('reviewFilter').addEventListener('change',event=>{
      reviewFilterValue=event.target.value;reviewLimit=40;renderReview();
    });
    $('startBtn').addEventListener('click',startFresh);
    $('continueBtn').addEventListener('click',()=>{if(count()===TOTAL)showResults();else goToQuiz();});
    const jump=$('jumpUnanswered');
    if(jump)jump.addEventListener('click',()=>{
      const target=Number(jump.dataset.target);
      if(!Number.isInteger(target)||target<0||target>=TOTAL||answers[target]>0)return;
      clearTimeout(autoadvance);cursor=target;persist();question();revealQuestion();
    });
    window.addEventListener('ofilab:jump-chapter',event=>{
      if(!extendedForm)return;
      const index=event.detail&&event.detail.index;
      if(!loaded||!Number.isInteger(index)||index<0||index>=TOTAL||needsUnlock)return;
      clearTimeout(autoadvance);cursor=index;persist();question();revealQuestion();
    });
    const saveRecovery=$('saveRecovery');
    if(saveRecovery)saveRecovery.addEventListener('click',copyLink);
    $('saveBtn').addEventListener('click',copyLink);
    $('shareTop').addEventListener('click',copyLink);
    $('copyResults').addEventListener('click',copyLink);
    $('downloadResults').addEventListener('click',safelyDownload);
    $('downloadResultsMain')?.addEventListener('click',safelyDownload);
    $('continueTo300')?.addEventListener('click',continueTo300);
    $('downloadRawQuestions')?.addEventListener('click',downloadRawQuestions);
    $('downloadRawQuestionsMain')?.addEventListener('click',downloadRawQuestions);
    $('downloadMarkdownMain')?.addEventListener('click', () => { if(window.OfiLabExportMarkdown && latestResults) window.OfiLabExportMarkdown.downloadMarkdown(latestResults); });
    $('resultsFooterDownloadMarkdown')?.addEventListener('click', () => { if(window.OfiLabExportMarkdown && latestResults) window.OfiLabExportMarkdown.downloadMarkdown(latestResults); });
    $('downloadMarkdownSummaryMain')?.addEventListener('click', () => { if(window.OfiLabExportMarkdown && latestResults) window.OfiLabExportMarkdown.downloadMarkdown(latestResults,{summary:true}); });
    $('resultsFooterDownloadMarkdownSummary')?.addEventListener('click', () => { if(window.OfiLabExportMarkdown && latestResults) window.OfiLabExportMarkdown.downloadMarkdown(latestResults,{summary:true}); });
    $('resultsFooterBackToTop')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    $('resultsFooterDownloadRaw')?.addEventListener('click',downloadRawQuestions);
    $('resultsFooterDownloadResults')?.addEventListener('click',safelyDownload);
    $('resultsFooterShare')?.addEventListener('click',()=>$('resultsShareTop')?.click());
    $('resultsFooterAi')?.addEventListener('click',()=>$('askAiResults')?.click());
    $('resultsFooterReview')?.addEventListener('click',()=>$('reviewResults')?.click());
    $('resultsFooterExportCsv')?.addEventListener('click',()=>$('normExport')?.click());
    $('resultsFooterPrint')?.addEventListener('click',()=>$('printReport')?.click());
    $('resultsPrintTop')?.addEventListener('click',()=>{const pb=$('printReport');if(pb)pb.click();else window.print();});
    $('resultsFooterRestart')?.addEventListener('click',startFresh);
    document.querySelectorAll('.results-footer-nav-link[data-scroll]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const target=$(btn.dataset.scroll);
        if(target){
          if(target.tagName==='DETAILS'&&!target.open)target.open=true;
          target.scrollIntoView({behavior:'smooth',block:'start'});
        }
      });
    });
    $('footerDownloadRaw')?.addEventListener('click',downloadRawQuestions);
    $('footerBackToTop')?.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
    $('footerResetQuiz')?.addEventListener('click',startFresh);
    $('footerOpenSettings')?.addEventListener('click',()=>$('openSettingsTop')?.click());
    $('openResultsShareMain')?.addEventListener('click',()=>$('resultsShareTop').click());
    $('openResultsAiMain')?.addEventListener('click',()=>$('askAiResults').click());
    window.addEventListener('ofilab:metric',event=>updateResultMetric(event.detail?.mode));
    $('restartResults').addEventListener('click',startFresh);
    $('prevBtn').addEventListener('click',previous);
    $('nextBtn').addEventListener('click',next);
    $('resultsBtn').addEventListener('click',showResults);
    document.addEventListener('click',e=>{
      if(!e.target.closest('.domain-sparkline-dot')){
        document.querySelectorAll('.domain-sparkline-dot.is-active').forEach(d=>d.classList.remove('is-active'));
      }
    });
    updateVersionSelectionUI(TOTAL);
    document.addEventListener('keydown',event=>{
      if(event.defaultPrevented||(typeof document.querySelector==='function'&&document.querySelector('dialog[open]')))return;
      if($('reviewDialog').open||$('aiDialog').open||$('questionHelpPanel').open||$('protectedSaveDialog').open)return;
      if(!keyboardShortcuts||quiz.classList.contains('hidden')||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      if(event.target&&event.target.closest&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(['1','2','3','4','5'].includes(event.key)){
        // Numeric keyboard shortcut; does not intercept fields (the quiz has none).
        const btn=$('answerSet').children[Number(event.key)-1];if(btn)btn.click();
      }else if(event.key==='ArrowLeft')next();else if(event.key==='ArrowRight')previous();
    });
  }
  function syncInventoryState(targetLen){
    const inv=targetLen===300?'ipip-neo-300':'ipip-neo-120';
    document.documentElement.dataset.inventory=inv;
    extendedForm=inv==='ipip-neo-300';
    TOTAL=extendedForm?300:120;
    BANK_URL=extendedForm?'./data/ipip-neo-300-he.json':'./data/ipip-neo-120-he.json';
    GUIDANCE_URL=extendedForm?'./data/question-guidance-300-he.json':'./data/question-guidance-he.json';
    if(typeof window!=='undefined'){
      if(window.AVDPersonalityCore)core=window.AVDPersonalityCore;
      if(window.AVDPersonalityStorage)safeStore=window.AVDPersonalityStorage;
    }
    answers=new Array(TOTAL).fill(0);
    cursor=0;
    latestResults=null;
  }
  function loadInventoryDataSync(){
    const elBank=typeof $==='function'?$(extendedForm?'data-bank-300':'data-bank-120'):null;
    if(!elBank||!elBank.textContent)return false;
    bank=JSON.parse(elBank.textContent);
    if(core&&typeof core.validateBank==='function')core.validateBank(bank);
    guidance=null;
    try{
      const elGuidance=$(extendedForm?'data-guidance-300':'data-guidance-120');
      if(elGuidance&&elGuidance.textContent){
        const helpData=JSON.parse(elGuidance.textContent);
        if(helpData&&helpData.questionBank===bank.version&&Array.isArray(helpData.items)&&
           helpData.items.length===TOTAL&&helpData.items.every((it,i)=>it.number===i+1&&
           typeof it.help==='string'&&it.help.trim().length>=35)) guidance=helpData;
      }
    }catch(e){}
    if(bank.version!==(extendedForm?'he-avd-ipip300-1.0.0':'he-avd-1.1.0')||bank.scale.length!==5)throw Error('גרסת השאלון אינה תואמת.');
    loaded=true;
    return true;
  }
  function updateVersionSelectionUI(len){
    if(typeof document.querySelectorAll==='function'){
      document.querySelectorAll('#versions .version-option').forEach(c=>{
        c.classList.toggle('current',Number(c.dataset.version)===len);
      });
      document.querySelectorAll('#settingsVersionTabs .version-tab').forEach(tab=>{
        tab.classList.toggle('active',Number(tab.dataset.ver)===len);
      });
    }
    if(typeof $==='function'){
      $('footerVer120')?.classList.toggle('active',len===120);
      $('footerVer300')?.classList.toggle('active',len===300);
      const rc=$('reviewCount');
      if(rc)rc.textContent=count()+'/'+TOTAL;
    }
  }
  function refreshResumeCardUI(){
    if(typeof $!=='function')return;
    const answered=count();
    const cont=$('continueBtn'),card=$('resumeCard'),prog=$('resumeProgress'),meter=$('resumeMeter'),start=$('startBtn');
    if(cont){
      cont.hidden=answered===0;
      if(answered>0)cont.textContent=answered===TOTAL?'הצגת התוצאות השמורות':'המשך מהמקום שעצרת';
    }
    if(card)card.hidden=answered===0;
    if(prog)prog.textContent=answered>0?(answered===TOTAL?'כל '+TOTAL+' התשובות שמורות':'ענית על '+answered+' מתוך '+TOTAL+' שאלות'):'';
    if(meter){
      meter.setAttribute('aria-valuemax',String(TOTAL));
      meter.setAttribute('aria-valuenow',String(answered));
      meter.setAttribute('aria-valuetext',answered+' מתוך '+TOTAL+' שאלות');
      const bar=meter.firstElementChild;
      if(bar)bar.style.width=(answered/TOTAL*100)+'%';
    }
    const setStartLabel=(txt)=>{
      if(!start)return;
      const first=start.firstChild;
      if(first&&first.nodeType===3)first.nodeValue=txt;
      else if(start.querySelector&&start.querySelector('svg'))start.insertBefore(document.createTextNode(txt),start.firstChild);
      else start.textContent=txt;
    };
    if(answered>0){
      setStartLabel('התחלה מחדש');
      document.documentElement.dataset.hasProgress='true';
    }else{
      setStartLabel(extendedForm?'מתחילים ב־300':'מתחילים ב־120');
      delete document.documentElement.dataset.hasProgress;
    }
  }
  function readSyncBackup(){
    if(!safeStore||!safeStore.KEY||typeof window==='undefined')return null;
    for(const areaName of ['localStorage','sessionStorage']){
      try{
        const raw=window[areaName]&&window[areaName].getItem(safeStore.KEY);
        if(!raw)continue;
        const m=/^b2\.\d+\.([A-Za-z0-9_-]+)$/.exec(raw);
        const token=m?m[1]:raw;
        const dec=codec.decode(token);
        if(Array.isArray(dec?.answers)&&dec.answers.length===TOTAL)return token;
      }catch(e){}
    }
    return null;
  }
  let inventorySwitchRevision=0;
  function initFormSwitcher(){
    const choiceSection=$('versions');
    if(choiceSection){
      choiceSection.addEventListener('click',event=>{
        const btn=event.target.closest('.start-form-btn');
        const card=event.target.closest('.version-option');
        if(btn){
          const len=Number(btn.dataset.len||120);
          switchInventory(len,true);
        }else if(card){
          const len=Number(card.dataset.version||120);
          switchInventory(len,false);
        }
      });
    }
    const previewCta=typeof document.querySelector==='function'?document.querySelector('.home-preview-cta'):null;
    if(previewCta){
      previewCta.addEventListener('click',event=>{
        if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
        event.preventDefault();
        switchInventory(120,true);
      });
    }
  }
  function switchInventory(targetLen,startQuizNow,options={}){
    if(Number(targetLen)===50&&typeof showLegacy50Banner==='function')showLegacy50Banner();
    const normLen=targetLen===300?300:120;
    const inv=normLen===300?'ipip-neo-300':'ipip-neo-120';
    if(document.documentElement.dataset.inventory===inv&&loaded&&!options.restoreFromHash){
      if(typeof updateVersionSelectionUI==='function')updateVersionSelectionUI(normLen);
      if(startQuizNow){
        if(count()===TOTAL)startFresh();
        else goToQuiz();
      }
      return;
    }
    const switchId=++inventorySwitchRevision;
    if(typeof sessionEpoch!=='undefined')sessionEpoch++;
    if(typeof autoadvance!=='undefined'){clearTimeout(autoadvance);autoadvance=null;}
    const prevHash=(window.location&&typeof window.location.href==='string')?(new URL(window.location.href).hash||''):'';
    const wasProtected=protectedMode||needsUnlock||prevHash.startsWith('#e=');
    stateFromUrl=false;
    protectedMode=false;
    encryptedToken=null;
    pendingProtectedToken=null;
    needsUnlock=false;
    securing=false;
    if(typeof secure!=='undefined'&&secure){
      if(typeof secure.beginSession==='function')secure.beginSession(inv);
      else if(typeof secure.lock==='function')secure.lock();
    }
    if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(false);
    if(typeof $==='function'){
      const unlockBtn=$('unlockProtectedAgain');
      if(unlockBtn)unlockBtn.hidden=true;
      if(typeof hideError==='function')hideError();
    }
    if(typeof syncInventoryState==='function')syncInventoryState(normLen);
    else{
      document.documentElement.dataset.inventory=inv;
      TOTAL=normLen;
    }
    if(typeof loadInventoryDataSync==='function')loadInventoryDataSync();
    if(typeof configureInventoryPresentation==='function')configureInventoryPresentation();
    if(typeof updateVersionSelectionUI==='function')updateVersionSelectionUI(normLen);
    if(typeof refreshSecureButtons==='function')refreshSecureButtons();
    if(typeof updateHeaderBadge==='function')updateHeaderBadge();
    if(typeof CustomEvent==='function'&&typeof window.dispatchEvent==='function'){
      window.dispatchEvent(new CustomEvent('ofilab:inventory-switched',{detail:{total:normLen,inventory:inv}}));
    }

    const target=new URL(window.location.href);
    target.search='';
    target.searchParams.set('len',String(normLen));
    if(startQuizNow)target.searchParams.set('start','1');
    if(!options.preserveHash){
      if(!wasProtected){
        const suppParts=[];
        const hm=prevHash.match(/[#&]h=([A-Za-z0-9_-]{7})/);if(hm)suppParts.push('h='+hm[1]);
        const vm=prevHash.match(/[#&]v=([A-Za-z0-9_-]{24})/);if(vm)suppParts.push('v='+vm[1]);
        const am=prevHash.match(/[#&]a=([A-Za-z0-9_-]{5})/);if(am)suppParts.push('a='+am[1]);
        target.hash=suppParts.length?'#'+suppParts.join('&'):'';
      }else{
        target.hash='';
      }
    }
    if(window.history&&typeof window.history.replaceState==='function'){
      window.history.replaceState(null,'',target.pathname+target.search+target.hash);
    }

    const currentHash=target.hash||'';
    if(options.preserveHash&&currentHash.startsWith('#e=')){
      stateFromUrl=true;
      needsUnlock=true;
      if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(true);
      try{
        pendingProtectedToken=currentHash.slice(3).split('&')[0];
        if(typeof secure!=='undefined'&&secure&&typeof secure.parse==='function')secure.parse(pendingProtectedToken);
        if(options.restoreFromHash&&typeof visible==='function'&&typeof openSaveDialog==='function'){
          visible(intro);
          openSaveDialog('unlock',pendingProtectedToken);
        }
      }catch(err){
        if(typeof showError==='function')showError('קישור מוצפן לא תקין: '+err.message);
        pendingProtectedToken=null;
      }
      return;
    }
    if(options.preserveHash&&currentHash.startsWith('#p=')){
      try{
        if(typeof restore==='function')restore(currentHash.slice(3).split('&')[0]);
        stateFromUrl=true;
        if(typeof refreshResumeCardUI==='function')refreshResumeCardUI();
        if(typeof updateVersionSelectionUI==='function')updateVersionSelectionUI(TOTAL);
        if(options.restoreFromHash||startQuizNow){
          if(count()===TOTAL)showResults({preserveSavedLink:true});
          else goToQuiz();
        }
      }catch(err){
        if(typeof showError==='function')showError('לא הצלחנו לקרוא את קישור השמירה: '+err.message);
      }
      return;
    }

    const sealed=(typeof secure!=='undefined'&&secure&&typeof secure.readLocal==='function')?secure.readLocal():null;
    if(sealed){
      pendingProtectedToken=sealed;
      needsUnlock=true;
      stateFromUrl=true;
      if(typeof $==='function'&&$('unlockProtectedAgain'))$('unlockProtectedAgain').hidden=false;
      if(typeof refreshResumeCardUI==='function')refreshResumeCardUI();
      if(startQuizNow&&typeof visible==='function'&&typeof openSaveDialog==='function'){
        visible(intro);
        openSaveDialog('unlock',pendingProtectedToken);
      }else if(typeof visible==='function'&&(document.documentElement.dataset.stage==='quiz'||document.documentElement.dataset.stage==='results')){
        visible(intro);
      }
      return;
    }

    const syncSaved=typeof readSyncBackup==='function'?readSyncBackup():null;
    if(syncSaved&&typeof restore==='function'){
      try{restore(syncSaved);}catch(e){}
    }
    if(typeof refreshResumeCardUI==='function')refreshResumeCardUI();
    if(typeof updateVersionSelectionUI==='function')updateVersionSelectionUI(TOTAL);

    if(startQuizNow){
      if(count()===TOTAL){
        if(typeof startFresh==='function')startFresh();
      }else{
        goToQuiz();
      }
    }else if(document.documentElement.dataset.stage==='quiz'&&typeof question==='function'){
      question();
    }else if(document.documentElement.dataset.stage==='results'){
      if(count()===TOTAL&&typeof showResults==='function')showResults({preserveSavedLink:true});
      else if(typeof visible==='function')visible(intro);
    }

    if(!syncSaved&&typeof safeStore!=='undefined'&&safeStore&&typeof safeStore.read==='function'){
      Promise.resolve(safeStore.read(token=>{
        try{
          const dec=codec.decode(token);
          return Array.isArray(dec?.answers)&&dec.answers.length===TOTAL;
        }catch(e){return false;}
      })).then(saved=>{
        if(switchId!==inventorySwitchRevision||!saved||count()>0)return;
        try{restore(saved);}catch(e){return;}
        if(typeof refreshResumeCardUI==='function')refreshResumeCardUI();
        if(typeof updateVersionSelectionUI==='function')updateVersionSelectionUI(TOTAL);
        if(document.documentElement.dataset.stage==='quiz'&&typeof question==='function')question();
      },()=>{});
    }
  }
  // 120 → 300. Every 120 item is also in the 300 form, with the same wording, facet and key
  // (window.OfiEmpiricalData.sharedItems). The answers move to their 300 positions and the
  // questionnaire continues with the 180 that are missing. The 120 save is left untouched.
  function continueTo300(){
    if(TOTAL!==120||count()!==120)return;
    const map=window.OfiEmpiricalData?.sharedItems;
    if(!Array.isArray(map)||map.length!==120){showError('לא ניתן להעביר את התשובות כרגע. רענן את העמוד ונסה שוב.');return;}
    const wasProtected=protectedMode;
    if(wasProtected&&!window.confirm('התשובות שלך שמורות בהצפנה. ההמשך לשאלון 300 נשמר בנפרד, ומיד אחרי ההעברה תתבקש לבחור לו סיסמה. להמשיך?'))return;
    const carried=answers.slice();
    switchInventory(300,false);
    if(TOTAL!==300||!bank)return;
    for(const m of map){
      const item=bank.items[m.number300-1];
      if(!item||item.domain!==m.domain||item.facet!==m.facet||item.keyed!==m.keyed){showError('מיפוי השאלונים אינו תואם. התשובות לא הועברו.');return;}
    }
    if((count()>0||needsUnlock)&&!window.confirm('כבר יש התקדמות שמורה בשאלון 300. להחליף אותה בתשובות משאלון 120 ולהמשיך משם?')){
      if(needsUnlock&&pendingProtectedToken){visible(intro);openSaveDialog('unlock',pendingProtectedToken);}else goToQuiz();
      return;
    }
    if(needsUnlock){needsUnlock=false;pendingProtectedToken=null;$('unlockProtectedAgain').hidden=true;secure.lock();secure.clearLocal();}
    answers.fill(0);
    for(const m of map)answers[m.number300-1]=carried[m.number120-1];
    cursor=answers.indexOf(0);
    if(!funnelStarted[TOTAL]){funnelStarted[TOTAL]=true;sendFunnelBeacon('start',TOTAL);}
    if(wasProtected){
      // Nothing is written in plain text: the new 300 save starts once a password is chosen.
      visible(quiz);question();openSaveDialog('create');
    }else goToQuiz();
    toast('120 התשובות שלך הועברו לשאלון 300. נשארו '+(TOTAL-count())+' שאלות.');
  }
  window.switchOfiLabInventory = switchInventory;
  async function init(){
    const initEpoch=++sessionEpoch;
    if(typeof secure!=='undefined'&&secure&&typeof secure.beginSession==='function')secure.beginSession(document.documentElement.dataset.inventory);
    setup();
    initFormSwitcher();
    $('startBtn').disabled=true;$('continueBtn').disabled=true;
    try{
      if(!loadInventoryDataSync()){
        const response=await fetch(BANK_URL,{cache:'no-store',credentials:'omit'});
        if(initEpoch!==sessionEpoch)return;
        if(!response.ok)throw Error('שגיאה בטעינת השאלון ('+response.status+').');
        bank=await response.json();
        if(initEpoch!==sessionEpoch)return;
        core.validateBank(bank);
        try{
          const helpResponse=await fetch(GUIDANCE_URL,{cache:'no-store',credentials:'omit'});
          if(helpResponse.ok){
            const helpData=await helpResponse.json();
            if(helpData.questionBank===bank.version&&Array.isArray(helpData.items)&&
               helpData.items.length===TOTAL&&helpData.items.every((it,i)=>it.number===i+1&&
               typeof it.help==='string'&&it.help.trim().length>=35)) guidance=helpData;
          }
        }catch(e){/* Guidance is optional; never block the questionnaire. */}
        if(bank.version!==(extendedForm?'he-avd-ipip300-1.0.0':'he-avd-1.1.0')||bank.scale.length!==5)throw Error('גרסת השאלון אינה תואמת.');
        loaded=true;
      }
      if(document.documentElement.dataset.deprecatedInventory==='ipip-50')showLegacy50Banner();
      const hash=window.location.hash;
      if(window.OfiLabProtectedLinkRouting?.deprecatedInventoryForHash?.(hash)){
        showLegacy50Banner();
        stateFromUrl=false;needsUnlock=false;
      }else if(hash.startsWith('#e=')){
        stateFromUrl=true;needsUnlock=true;
        if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(true);
        try{pendingProtectedToken=hash.slice(3).split('&')[0];secure.parse(pendingProtectedToken);}
        catch(err){
          if(err?.code==='LEGACY_50_DEPRECATED'){showLegacy50Banner();stateFromUrl=false;needsUnlock=false;if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(false);}
          else showError('קישור מוצפן לא תקין: '+err.message);
          pendingProtectedToken=null;
        }
      }else if(hash.startsWith('#p=')){
        try{restore(hash.slice(3).split('&')[0]);stateFromUrl=true;}
        catch(e){
          if(e?.code==='LEGACY_50_DEPRECATED')showLegacy50Banner();
          else showError('לא הצלחנו לקרוא את קישור השמירה: '+e.message);
        }
      }
      if(!stateFromUrl){
        const sealed=secure.readLocal();
        if(sealed){
          pendingProtectedToken=sealed;needsUnlock=true;stateFromUrl=true;
          if(typeof window.setOfiLabProtectedMode==='function')window.setOfiLabProtectedMode(true);
        }
      }
      if(!stateFromUrl&&safeStore){
        const saved=await safeStore.read(token=>{
          try{
            const dec=codec.decode(token);
            return Array.isArray(dec?.answers)&&dec.answers.length===TOTAL;
          }catch(e){return false;}
        });
        if(initEpoch!==sessionEpoch)return;
        if(saved){
          restore(saved);
          refreshResumeCardUI();
        }
      }
      if(needsUnlock){
        visible(intro);
        if(pendingProtectedToken)openSaveDialog('unlock',pendingProtectedToken);
      }else if(stateFromUrl){
        // Opening a legacy link is read-only until an actual edit. Never change
        // the original fragment just because the page loaded or norms rendered.
        if(safeStore&&hash.startsWith('#p='))safeStore.save(hash.slice(3).split('&')[0]);
        $('shareTop').hidden=false;$('protectSaveTop').hidden=false;
        if(count()===TOTAL)showResults({preserveSavedLink:true});else{visible(quiz);question();}
      }else if(window.location.search.includes('start=1')||window.location.hash==='#start'||window.location.hash==='#quiz'){
        if(count()===TOTAL){
          answers.fill(0);cursor=0;persist();visible(quiz);question();
        } else {
          goToQuiz();
        }
      }else{visible(intro);}
      $('startBtn').disabled=false;$('continueBtn').disabled=false;
    }catch(e){
      showError('לא ניתן לטעון את המבחן. '+e.message);
      $('startBtn').disabled=true;$('continueBtn').disabled=true;
    }
  }

  const rciCompareInput=$('rciCompareInput');
  if(rciCompareInput){
    rciCompareInput.addEventListener('change',async e=>{
      const file=e.target.files[0];
      if(!file)return;
      e.target.value='';
      if(!latestResults){alert('יש לסיים את המבחן הנוכחי לפני השוואה.');return;}
      try{
        const text=await file.text();
        let pastProfile=null;
        let parsedAns=null;
        if(window.OfiLabResultsFiles&&typeof window.OfiLabResultsFiles.parse==='function'){
          try{parsedAns=window.OfiLabResultsFiles.parse(text);}
          catch(parseErr){if(parseErr?.code==='LEGACY_50_DEPRECATED')throw parseErr;parsedAns=null;}
        }
        if(parsedAns&&parsedAns.encryptedToken){
          if(parsedAns.length!==TOTAL){
            throw Error('קובץ העבר המוצפן הוא של שאלון '+parsedAns.length+' שאלות, בעוד השאלון הנוכחי הוא של '+TOTAL+' שאלות. להשוואת RCI תקפה יש להשוות מול אותה גרסת שאלון.');
          }
          const pwd=window.prompt('קובץ העבר מוצפן בסיסמה. הזן/י את סיסמת הקובץ לפענוח מקומי בדפדפן:');
          if(!pwd)return;
          if(typeof secure.decryptOnly!=='function'){
            throw Error('מנגנון הפענוח המבודד אינו זמין.');
          }
          const decBundle=await secure.decryptOnly(parsedAns.encryptedToken,pwd,document.documentElement.dataset.inventory);
          const dec=codec.decode(decBundle.plain);
          parsedAns={...parsedAns,answers:dec.answers};
        }
        if(parsedAns&&Array.isArray(parsedAns.answers)){
          if(parsedAns.length!==TOTAL){
            throw Error('קובץ העבר הוא של שאלון '+parsedAns.length+' שאלות, בעוד השאלון הנוכחי הוא של '+TOTAL+' שאלות. להשוואת RCI תקפה יש להשוות מול אותה גרסת שאלון.');
          }
          const densePast=Array.from(parsedAns.answers);
          if(densePast.length!==TOTAL||densePast.some(v=>!Number.isInteger(v)||v<1||v>5)){
            throw Error('קובץ העבר אינו מושלם (חסרות בו תשובות). יש להשוות מול מבחן מלא.');
          }
          const pastRaw=core.calculate(bank,densePast);
          pastProfile=window.OfiEmpirical.enrich(pastRaw,bank,densePast,core);
        }else{
          const past=JSON.parse(text);
          pastProfile=past.profile||past;
          if(!pastProfile||!pastProfile.domains)throw Error('מבנה נתונים חסר: לא נמצאו ציוני תכונות בקובץ.');
          const pastTotal=Number(past.total||past.length||pastProfile.empiricalReference?.answeredItems||0);
          if(pastTotal&&pastTotal!==TOTAL){
            throw Error('קובץ העבר הוא של שאלון '+pastTotal+' שאלות, בעוד השאלון הנוכחי הוא של '+TOTAL+' שאלות. להשוואת RCI תקפה יש להשוות מול אותה גרסת שאלון.');
          }
          const pastHasFacets=Boolean(pastProfile.domains.N?.facets?.length===6);
          if(!pastHasFacets){
            throw Error('מבנה תחומי המשנה בקובץ העבר אינו תואם לגרסת השאלון הנוכחית.');
          }
        }

        // Classical observed-score SEM on the 0-100 scale (never Bayesian-shrunken latent cSEM).
        const resolveObservedSem=(entry,defaultSem)=>{
          if(typeof entry?.sem==='number'&&Number.isFinite(entry.sem)&&entry.sem>0)return entry.sem;
          if(typeof entry?.ciMargin==='number'&&Number.isFinite(entry.ciMargin)&&entry.ciMargin>0)return entry.ciMargin/1.96;
          return defaultSem;
        };
        const currUsesSubset=Boolean(latestResults?.empiricalReference?.longVersionUsesSharedSubset);
        const pastUsesSubset=Boolean(pastProfile?.empiricalReference?.longVersionUsesSharedSubset);
        // Exact two-sided Holm-Bonferroni critical |Z| values for m = 5 broad domains (FWER = 0.05):
        // alpha_k = 0.05 / (5 - k) => z_crit = [2.575829, 2.497705, 2.393980, 2.241403, 1.959964]
        const HOLM5_Z=[2.575829,2.497705,2.393980,2.241403,1.959964];
        // Fallbacks only (entry.sem is used when present): mean stratified-alpha domain SEM per form.
        const domDefaultSem=TOTAL===300?2.96:4.22;
        const facDefaultSem=TOTAL===300?7.2:10.6;
        const domainCandidates=[];
        const facetChanges=[];

        for(const k of ['N','E','O','A','C']){
          const currDom=latestResults.domains[k];
          const pastDom=pastProfile.domains[k];
          if(!currDom||!pastDom)continue;
          const c=Number(currDom.rangeScore??currDom.score);
          const p=Number(pastDom.rangeScore??pastDom.score);
          if(!Number.isFinite(c)||!Number.isFinite(p))continue;
          const semDomCurr=currUsesSubset?domDefaultSem:resolveObservedSem(currDom,domDefaultSem);
          const semDomPast=pastUsesSubset?semDomCurr:resolveObservedSem(pastDom,semDomCurr);
          const seDiffDom=Math.hypot(semDomCurr,semDomPast);
          const diff=c-p;
          const rciZ=diff/seDiffDom;
          domainCandidates.push({key:k,name:currDom.label,diff,c,p,rciZ,absZ:Math.abs(rciZ),seDiff:seDiffDom,type:'domain'});

          if(currDom.facets&&pastDom.facets){
            currDom.facets.forEach((f,i)=>{
              const pf=pastDom.facets[i];
              if(!pf)return;
              const fc=Number(f.rangeScore??f.score),fp=Number(pf.rangeScore??pf.score);
              if(!Number.isFinite(fc)||!Number.isFinite(fp))return;
              const semFacCurr=currUsesSubset?facDefaultSem:resolveObservedSem(f,facDefaultSem);
              const semFacPast=pastUsesSubset?semFacCurr:resolveObservedSem(pf,semFacCurr);
              const seDiffFac=Math.hypot(semFacCurr,semFacPast);
              const fd=fc-fp;
              const fZ=fd/seDiffFac;
              if(Math.abs(fZ)>=1.96){
                facetChanges.push({domainKey:k,name:f.label,diff:fd,c:fc,p:fp,rciZ:fZ,seDiff:seDiffFac,type:'facet'});
              }
            });
          }
        }

        // Step-down Holm-Bonferroni selection over the tested broad domains
        const sortedDoms=[...domainCandidates].sort((a,b)=>b.absZ-a.absZ);
        const mDoms=sortedDoms.length;
        const sigDomainKeys=new Set();
        for(let idx=0;idx<mDoms;idx++){
          const critIdx=5-mDoms+idx; // aligns to HOLM5_Z even if <5 domains present
          const zCrit=HOLM5_Z[Math.max(0,Math.min(4,critIdx))];
          if(sortedDoms[idx].absZ>=zCrit){
            sigDomainKeys.add(sortedDoms[idx].key);
          }else{
            break; // Holm step-down stopping rule
          }
        }
        const domainChanges=domainCandidates.filter(d=>sigDomainKeys.has(d.key));

        const container=$('rciCompareResults');
        if(!container)return;
        container.replaceChildren();

        const renderRciRow=(ch,isPrimary)=>{
          const row=h('div');
          row.style.display='flex';row.style.justifyContent='space-between';row.style.padding='10px 12px';row.style.borderBottom='1px solid #dbe8ed';row.style.alignItems='center';row.style.borderRadius='8px';
          row.style.background=isPrimary?'rgba(37, 84, 102, 0.08)':'transparent';
          const titleEl=h('strong',null,(isPrimary?'תכונה ראשית · ':'תת־ממד · ')+ch.name);
          const rightWrap=h('span');
          rightWrap.style.fontSize='14px';
          const transitionEl=h('bdi',null,ch.p.toFixed(1)+' → '+ch.c.toFixed(1));
          transitionEl.dir='ltr';
          transitionEl.style.color='#556270';
          const dir=ch.diff>0?(isPrimary?'עלייה מובהקת':'עלייה נצפית'):(isPrimary?'ירידה מובהקת':'ירידה נצפית');
          const deltaEl=h('b',null,' '+dir+' ('+(ch.diff>0?'+':'')+ch.diff.toFixed(1)+' · Z='+ch.rciZ.toFixed(2)+')');
          deltaEl.style.color=ch.diff>0?'#1d6f8a':'#5b4b8a';
          deltaEl.style.paddingInlineStart='8px';
          rightWrap.append(transitionEl,deltaEl);
          row.append(titleEl,rightWrap);
          return row;
        };

        if(domainChanges.length===0){
          const pEl=h('p',null,'בחמש התכונות הראשיות לא נמצא שינוי מובהק סטטיסטית מעבר לשגיאת המדידה הקלאסית (SEM נצפה עם תיקון Holm–Bonferroni ל־5 תכונות, FWER = 5%). פרופיל הליבה שלך יציב.');
          pEl.style.fontWeight='bold';
          pEl.style.color='#255466';
          container.append(pEl);
        }else{
          const domHead=h('p',null,'שינויים מובהקים בחמש התכונות הראשיות (SEM קלאסי עם תיקון Holm–Bonferroni, FWER = 5%):');
          domHead.style.fontWeight='bold';domHead.style.margin='0 0 4px';
          container.append(domHead);
          domainChanges.forEach(ch=>container.append(renderRciRow(ch,true)));
        }

        const facNote=h('p',null,facetChanges.length>0
          ?'פירוט תומך ב־30 תחומי המשנה (|Z| ≥ 1.96 ללא תיקון השוואות מרובות — בבדיקת 30 היבטים צפויים בממוצע כ־1.5 סימונים אקראיים מרעש מדידה בלבד גם ללא שינוי אמיתי):'
          :'גם ב־30 תחומי המשנה לא נצפתה חריגה מעבר לסף הבדיקה הבודדת (|Z| < 1.96).');
        facNote.style.fontSize='0.9rem';facNote.style.color='#4b5c6b';facNote.style.margin='10px 0 4px';
        container.append(facNote);
        facetChanges.forEach(ch=>container.append(renderRciRow(ch,false)));
        const dlg=$('rciCompareDialog');
        if(typeof dlg.showModal==='function')dlg.showModal();
        else dlg.hidden=false;
      }catch(err){
        alert('שגיאה בטעינת הקובץ: '+err.message);
      }
    });
    $('closeRciCompare')?.addEventListener('click',()=>$('rciCompareDialog').close());
  }

  init();
})();

