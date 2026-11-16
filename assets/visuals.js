/* ofiLab visual reports v6: independent print/PDF stylesheet and Canvas share cards; no answer submissions or analytics. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
  const ORDER=['N','E','O','A','C'];
  let current=null,meta=null,shareFile=null,renderId=0,printURL=null,metricMode='percentile';
  const number=n=>Number(n).toLocaleString('he-IL',{maximumFractionDigits:1});
  const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const svgNode=(tag,attrs,text)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text)e.textContent=text;return e;};
  const names=()=>({N:'רגישות',E:'מוחצנות',O:'פתיחות',A:'נעימות',C:'מצפוניות'});
  const useRelative=()=>metricMode!=='score'&&metricMode!=='range'&&Boolean(current&&current.empiricalReference);
  const displayValue=entry=>useRelative()?entry.percentileExact:entry.score;
  const displayLabel=entry=>useRelative()?'אחוזון '+entry.percentile:number(entry.score)+' מתוך 100';
  const point=(i,value,cx,cy,r)=>{const a=-Math.PI/2+i*Math.PI*2/5;return[cx+Math.cos(a)*r*value,cy+Math.sin(a)*r*value];};
  function radar(){
    const host=$('radarChart'),labels=names(),svg=host&&host.querySelector('svg');
    if(!svg||!current)return;
    host.querySelectorAll('#radarReadout,.radar-readout,.trait-legend').forEach(n=>n.remove());
    svg.querySelectorAll('.radar-hit').forEach(n=>n.remove());
    const caption=node('p','radar-readout');caption.id='radarReadout';caption.setAttribute('aria-live','polite');caption.textContent='בחר תכונה כדי לראות את הציון והפירוט שלה.';
    const legend=node('div','trait-legend');legend.setAttribute('aria-label','בחירת תכונה במפת האישיות');
    function select(key,open=false){
      caption.textContent=current.domains[key].label+' · '+displayLabel(current.domains[key]);caption.dataset.trait=key;
      legend.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.trait===key)));
      svg.querySelectorAll('.data-point').forEach((p,i)=>p.classList.toggle('is-active',ORDER[i]===key));
      if(open){const card=$('trait-'+key);if(card)card.open=true;}
    }
    const dots=svg.querySelectorAll('.data-point'),axis=svg.querySelectorAll('.axis-label');
    ORDER.forEach((key,i)=>{
      const button=node('button','trait-key');button.type='button';button.dataset.trait=key;button.setAttribute('aria-pressed','false');button.setAttribute('aria-controls','trait-'+key);
      button.append(node('span','trait-dot'),node('span',null,labels[key]),node('b',null,number(useRelative()?current.domains[key].percentile:current.domains[key].score)));
      button.addEventListener('click',()=>select(key,true));legend.append(button);
      dots[i].dataset.trait=key;axis[i].dataset.trait=key;
      dots[i].querySelectorAll('title').forEach(t=>t.remove());
      const tip=current.domains[key].label+': '+displayLabel(current.domains[key]);
      dots[i].append(svgNode('title',{},tip));
      // Targets sit on distinct outer axes, even when all five actual scores are zero.
      const [x,y]=point(i,1,210,177,111),hit=svgNode('circle',{cx:x,cy:y,r:25,class:'radar-hit','aria-hidden':'true'});
      hit.append(svgNode('title',{},tip));
      if(!dots[i]._radarBound){
        dots[i].addEventListener('pointerenter',()=>select(key));dots[i].addEventListener('click',()=>select(key,true));
        dots[i]._radarBound=true;
      }
      if(!axis[i]._radarBound){
        axis[i].addEventListener('pointerenter',()=>select(key));axis[i].addEventListener('click',()=>select(key,true));
        axis[i]._radarBound=true;
      }
      hit.addEventListener('pointerenter',()=>select(key));hit.addEventListener('click',()=>select(key,true));
      svg.append(hit);
    });
    host.append(caption,legend);
  }
  function reportPage(index,title,eyebrow){
    const page=node('section','report-page'),head=node('header','report-header');
    const brand=node('div','report-brand'),mark=node('img','report-brand-mark');
    mark.src=new URL('./assets/logo-mark.png',location.href).href;
    mark.alt='';mark.width=38;mark.height=38;
    brand.append(mark,node('b',null,'ofiLab'));
    head.append(brand,node('span',null,'מעבדת האישיות · '+meta.total+' שאלות'));
    const foot=node('footer','report-footer');foot.append(node('span',null,current.empiricalReference?'אחוזונים · מדגם '+number(current.empiricalReference.n)+' · לא אבחון':'ציוני שאלון · לא אחוזונים ולא אבחון'),node('span',null,String(index).padStart(2,'0')));
    page.append(head,node('p','report-kicker',eyebrow),node('h1',null,title));page.append(foot);return page;
  }
  const scoreText=entry=>{ if(current.empiricalReference && entry.percentile != null && entry.t != null && entry.ci95){ return 'אחוזון '+entry.percentile+' (תקן T='+entry.t+') · ציון '+number(entry.score)+'/100 (SEM: \xB1'+entry.sem+', 95% CI: ['+Math.round(entry.ci95[0])+'-'+Math.round(entry.ci95[1])+'])'; } return (current.empiricalReference && entry.percentile != null)?'אחוזון '+entry.percentile+' · ציון שאלון '+number(entry.score)+'/100':number(entry.score)+' / 100'; };
  function reportScore(key,facets=false){
    const d=current.domains[key],box=node('section','report-domain');box.dataset.trait=key;
    const heading=node('div','report-score-head');heading.append(node('h2',null,d.label),node('b',null,scoreText(d)));box.append(heading);
    const bar=node('div','track'),fill=node('div');fill.style.width=displayValue(d)+'%';bar.append(fill);box.append(bar,node('p',null,d.text));
    if(facets)for(const f of d.facets||[]){
      const row=node('section','report-facet'),top=node('div','report-score-head');top.append(node('h3',null,f.label),node('b',null,scoreText(f)));
      const t=node('div','track'),v=node('div');v.style.width=displayValue(f)+'%';t.append(v);row.append(top,t,node('p',null,f.text));box.append(row);
    }
    return box;
  }
  function buildReport(){
    const host=$('printableReport');host.replaceChildren();
    const cover=reportPage(1,'מפת האישיות שלך','דוח אישי · '+new Date().toLocaleDateString('he-IL'));
    cover.append(node('p','report-lead','חמש תכונות. הרבה דרכים להיות אתה.'));
    const chart=$('radarChart').querySelector('svg').cloneNode(true);chart.removeAttribute('aria-labelledby');chart.removeAttribute('role');chart.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));chart.querySelectorAll('.radar-hit').forEach(e=>e.remove());chart.querySelectorAll('.is-active').forEach(e=>e.classList.remove('is-active'));if(window.OfiCalmV2&&document.documentElement.dataset.uiVersion==='v2'){
      // Same OfiOrbit map and metric mode as the results page (static in print).
      const glyph=window.OfiCalmV2.personalityMiniMap(current.domains,{mode:useRelative()?'percentile':'score'});
      glyph.querySelectorAll('[tabindex]').forEach(n=>{n.removeAttribute('tabindex');n.removeAttribute('role');});
      glyph.classList.add('report-signature');glyph.style.width='78mm';glyph.style.margin='0 auto 8mm';
      cover.append(glyph);
    }else{chart.classList.add('report-radar');cover.append(chart);}
    const scores=node('div','report-score-list');for(const k of ORDER){const row=node('div');row.dataset.trait=k;row.append(node('span',null,current.domains[k].label),node('b',null,scoreText(current.domains[k])));scores.append(row);}cover.append(scores);
    cover.append(node('p','report-note',current.empiricalReference?'הנתונים הראשיים מציגים אחוזונים ביחס ל־'+number(current.empiricalReference.n)+' משיבי '+current.empiricalReference.referenceInstrument+'. הציונים 0–100 מתארים את טווח התשובות. '+(current.empiricalReference.longVersionUsesSharedSubset?'בהשוואה נעשה שימוש ב־120 ההיגדים המשותפים. ':'')+'התרגום העברי טרם תוקף.':'הציונים מתארים את התשובות שלך בגרסה העברית של השאלון. אין נורמות מתוקפות לגרסה הזאת, ולכן הציונים אינם מיקום ביחס לאוכלוסייה. האישיות רחבה יותר מכל שאלון, והתוצאות הן הזמנה להתבוננות.'));
    // Same rule as the results page, Markdown export and AI chat: 'low' response quality means do not interpret.
    const vq=current.validityFeatures;
    const lowQuality=Boolean(vq&&(vq.validityLevel==='low'||vq.isSevereStraightline||vq.isSuspectedRandomResponding));
    if(lowQuality){
      const warn=node('p','report-note');
      warn.append(node('strong',null,'בקרת איכות המענה: נמוכה. אין להסתמך על הפרשנות בדוח זה. '),
        document.createTextNode('דפוס התשובות דומה למענה אחיד או אקראי. הציונים מוצגים לשקיפות בלבד; הסגנון הקיברנטי והקירובים מתוך Big Five הושמטו. מומלץ למלא את השאלון מחדש.'));
      cover.append(warn);
    }
    host.append(cover);
    ORDER.forEach((key,i)=>{const page=reportPage(i+2,current.domains[key].label,'מקרוב · ששת תחומי המשנה');page.dataset.trait=key;page.append(reportScore(key,true));host.append(page);});

    
    const cyber = (!lowQuality && window.calculateCybernetics) ? window.calculateCybernetics(current, current.empiricalReference!=null) : null;
    const v = current.validityFeatures;
    // A Big Five proxy is noise at 'low' quality; a directly answered HEXACO-H stays.
    const hexForReport = (current.hexacoHonesty && !(lowQuality && current.hexacoHonesty.type === 'proxy')) ? current.hexacoHonesty : null;
    if(hexForReport || cyber || v) {
       const adv = reportPage(7, 'ניתוח מחקרי מתקדם', 'מדדים נוספים ובקרת מענה');
       
       if(hexForReport) {
          const hex = hexForReport;
          const sec = node('section', 'report-domain');
          const hd = node('div', 'report-score-head');
          const hexPct = hex.percentileEst ?? hex.percentileProxy ?? null;
          const hexLabel = hexPct != null ? ('ציון ' + number(hex.score) + '/100 · אחוזון משוער ' + hexPct) : scoreText({score: hex.score, percentile: null});
          hd.append(node('h2', null, 'כנות וענווה (HEXACO-H)'), node('b', null, hexLabel));
          sec.append(hd);
          const bar = node('div', 'track'); const fill = node('div'); fill.style.width = hex.score + '%'; fill.style.background = '#486b5c'; bar.append(fill); sec.append(bar);
          sec.append(node('p', 'report-note', 'מדד אותנטיות וכנות המשמש כממד השישי במודל HEXACO.'));
          adv.append(sec);
       }
       
       if(cyber) {
          const sec = node('section', 'report-domain');
          const hd = node('div', 'report-score-head');
          hd.append(node('h2', null, 'המעבדה הקיברנטית (DeYoung, 2007)'));
          sec.append(hd);
          const grid = node('div');
          grid.style.display = 'grid'; grid.style.gridTemplateColumns = '1fr 1fr'; grid.style.gap = '10px'; grid.style.marginTop = '10px';
          const unitLabel = current.empiricalReference ? 'אחוזון ' : 'ציון ';
          const pStab = node('div');
          pStab.append(node('strong', null, 'יציבות (Stability): '), document.createTextNode(unitLabel + Math.round(cyber.stability)));
          const pPlast = node('div');
          pPlast.append(node('strong', null, 'גמישות (Plasticity): '), document.createTextNode(unitLabel + Math.round(cyber.plasticity)));
          grid.append(pStab, pPlast);
          if(cyber.archTitle) {
             const pArch = node('div');
             pArch.style.gridColumn = '1 / -1';
             pArch.append(node('strong', null, 'סגנון ויסות: '), document.createTextNode(cyber.archTitle + (cyber.archTag ? ' (' + cyber.archTag + ')' : '')));
             grid.append(pArch);
          }
          sec.append(grid);
          adv.append(sec);
       }
       
       if(v) {
          const sec = node('section', 'report-domain');
          const hd = node('div', 'report-score-head');
          hd.append(node('h2', null, 'בקרת איכות מענה (Validity)'));
          sec.append(hd);
          const grid = node('div');
          grid.style.display = 'grid'; grid.style.gridTemplateColumns = '1fr 1fr'; grid.style.gap = '10px'; grid.style.marginTop = '10px';
          const i1 = node('div');
          i1.append(node('strong', null, 'שונות תשובות: '), document.createTextNode((v.isSevereStraightline ? 'מענה אחיד חמור' : v.isModerateStraightline ? 'שונות נמוכה' : 'סבירה') + ' (' + v.stdDev.toFixed(2) + ')'));
          const i2 = node('div');
          i2.append(node('strong', null, 'עקביות כיוונית: '), document.createTextNode('פער ממוצע ' + v.avgDiscrepancy.toFixed(2)));
          const i3 = node('div');
          i3.append(node('strong', null, 'עקביות תוך-ממדית: '), document.createTextNode(v.synonymPairsCount > 0 ? ('פער ממוצע ' + v.avgSynonymDiff.toFixed(2)) : 'ללא תתי-ממדים (שאלון 50)'));
          grid.append(i1, i2, i3);
          sec.append(grid);
          adv.append(sec);
       }
       
       host.append(adv);
    }
  }

  function beginPrint(){
    if(!current||document.documentElement.dataset.stage!=='results')return;
    buildReport();document.documentElement.dataset.printReport='true';
    // Browser print headers must never contain the answers encoded in the fragment. Only the fragment
    // is dropped: the query (?len=300) holds no answers and keeps the right questionnaire if the page
    // is reloaded before 'afterprint' fires (e.g. iOS Safari).
    if(printURL===null){printURL=location.href;history.replaceState(null,'',location.pathname+location.search);}
  }
  function endPrint(){
    if(printURL!==null){history.replaceState(null,'',printURL);printURL=null;}
    delete document.documentElement.dataset.printReport;
  }
  // Share card: light "porcelain" sheet on a soft violet/amber wash, the
  // results-page OfiOrbit map, and one row + bar per domain. Every number is
  // displayLabel()/displayValue(), i.e. exactly what the results page shows
  // in the currently selected metric mode.
  const CARD_INK={N:'#912061',E:'#A85C00',O:'#7A59C3',A:'#0E8A73',C:'#0850AB'};
  const CARD_ARC={N:'#912061',E:'#BB6802',O:'#9878E5',A:'#11A68B',C:'#0850AB'};
  let cardLogo=null;
  function loadCardLogo(){
    if(cardLogo)return cardLogo;
    cardLogo=new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);
      img.src=new URL('./assets/logo-mark.png',location.href).href;});
    return cardLogo;
  }
  function drawCard(format,logo){
    const canvas=$('shareCardCanvas'),size={story:[1080,1920],square:[1080,1080],wide:[1200,630]}[format];
    canvas.width=size[0];canvas.height=size[1];const [w,h]=size,c=canvas.getContext('2d');if(!c)throw Error('Canvas unavailable');
    const label=k=>current.domains[k].label||names()[k];
    const L={
      story:{pad:48,radius:44,inner:76,headY:150,logo:52,brand:34,chip:24,titleY:300,title:76,sub:32,mapX:540,mapY:780,map:660,listX0:124,listX1:956,listY:1200,gap:116,lab:34,val:34,bar:10,footY:1790,foot:24},
      square:{pad:36,radius:36,inner:56,headY:108,logo:42,brand:28,chip:20,titleY:206,title:58,sub:25,mapX:540,mapY:476,map:410,listX0:92,listX1:988,listY:722,gap:50,lab:25,val:25,bar:7,footY:1012,foot:19},
      wide:{pad:28,radius:30,inner:44,headY:86,logo:36,brand:24,chip:17,titleY:168,title:46,sub:21,mapX:290,mapY:354,map:368,listX0:612,listX1:1128,listY:262,gap:54,lab:22,val:22,bar:6,footY:574,foot:16}
    }[format];
    // Canvas: porcelain with two soft colour blooms.
    const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#FBF8FC');bg.addColorStop(1,'#F3EDF7');c.fillStyle=bg;c.fillRect(0,0,w,h);
    const bloom=(x,y,r,color)=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);};
    bloom(w*.88,h*.08,w*.62,'rgba(152,120,229,.22)');bloom(w*.06,h*.94,w*.58,'rgba(232,170,110,.18)');
    const rr=(x,y,ww,hh,r)=>{c.beginPath();if(c.roundRect)c.roundRect(x,y,ww,hh,r);else{c.moveTo(x+r,y);c.arcTo(x+ww,y,x+ww,y+hh,r);c.arcTo(x+ww,y+hh,x,y+hh,r);c.arcTo(x,y+hh,x,y,r);c.arcTo(x,y,x+ww,y,r);c.closePath();}};
    // Sheet.
    c.save();c.shadowColor='rgba(76,52,98,.12)';c.shadowBlur=48;c.shadowOffsetY=16;
    rr(L.pad,L.pad,w-2*L.pad,h-2*L.pad,L.radius);c.fillStyle='rgba(255,255,255,.9)';c.fill();c.restore();
    c.strokeStyle='rgba(111,80,138,.12)';c.lineWidth=1.5;rr(L.pad,L.pad,w-2*L.pad,h-2*L.pad,L.radius);c.stroke();
    function text(s,x,y,sz,color,align='right',weight=420){c.font=weight+' '+sz+'px "ofiLab Heebo", Arial';c.fillStyle=color;c.textAlign=align;c.direction=align==='left'?'ltr':'rtl';c.fillText(s,x,y);}
    const left=L.pad+L.inner,right=w-L.pad-L.inner;
    // Header: brand on the left (LTR), inventory chip on the right.
    let bx=left;
    if(logo){c.drawImage(logo,bx,L.headY-L.logo*.78,L.logo,L.logo);bx+=L.logo+12;}
    text('ofiLab',bx,L.headY,L.brand,'#4A345F','left',760);
    const chipText=meta.total+' שאלות · בעברית';c.font='600 '+L.chip+'px "ofiLab Heebo", Arial';
    const cw=c.measureText(chipText).width+L.chip*1.6,ch=L.chip*1.9;
    rr(right-cw,L.headY-ch*.72,cw,ch,ch/2);c.fillStyle='#F1EAF7';c.fill();
    text(chipText,right-L.chip*.8,L.headY,L.chip,'#6F508A','right',600);
    // Title and one-line reading of the most pronounced domain.
    text('מפת האישיות שלי',right,L.titleY,L.title,'#2B2135','right',780);
    let leadKey='E',maxDist=-1;
    ORDER.forEach(k=>{const dist=Math.abs(displayValue(current.domains[k])-50);if(dist>maxDist){maxDist=dist;leadKey=k;}});
    const leadHigh=displayValue(current.domains[leadKey])>=50;
    const microLines={
      O:['חיבור לפשטות מעשית ובהירות יומיומית.','סקרנות עמוקה ודמיון שמחפשים אופקים חדשים.'],
      C:['גמישות ספונטנית וזרימה טבעית עם הרגע.','מיקוד, סדר פנימי והנעה עקבית למטרה.'],
      E:['עוגן של שקט פנימי, עומק וזמן אישי.','אנרגיה חיה של מפגש, יוזמה וקשר עם אחרים.'],
      A:['חשיבה עצמאית, ישירות ואמת פנימית ברורה.','חום אנושי, אמפתיה ושיתוף פעולה בגובה העיניים.'],
      N:['יציבות רגשית ושקט פנימי גם תחת עומס.','רגישות דקה שמבחינה בניואנסים רגשיים.']
    };
    const line=maxDist<12?'איזון הרמוני בין גמישות, חום ויציבות.':microLines[leadKey][leadHigh?1:0];
    text(line,right,L.titleY+L.sub*1.75,L.sub,'#6F6379');
    // The same OfiOrbit map as the results page, in the same metric mode.
    if(window.OfiCalmV2&&window.OfiCalmV2.drawMiniMapCanvas){
      window.OfiCalmV2.drawMiniMapCanvas(c,current.domains,L.mapX,L.mapY,L.map,{
        mode:useRelative()?'percentile':'score',colors:CARD_ARC,
        track:'#ECE4F2',ink:'#2B2135',muted:'#7A6E85',accent:'#BD834C',facetFloor:.3
      });
    }else{
      const r=L.map*.36;c.beginPath();
      ORDER.forEach((k,i)=>{const [x,y]=point(i,displayValue(current.domains[k])/100,L.mapX,L.mapY,r);if(i)c.lineTo(x,y);else c.moveTo(x,y);});
      c.closePath();c.fillStyle='rgba(111,80,138,.14)';c.fill();c.strokeStyle='#6F508A';c.lineWidth=3;c.stroke();
    }
    // One row per domain: dot, name, value, and a rounded bar filling from the right.
    ORDER.forEach((k,i)=>{
      const y=L.listY+i*L.gap,d=current.domains[k],v=Math.max(0,Math.min(100,displayValue(d)));
      c.fillStyle=CARD_ARC[k];c.beginPath();c.arc(L.listX1,y-L.lab*.32,L.lab*.24,0,Math.PI*2);c.fill();
      text(label(k),L.listX1-L.lab*.8,y,L.lab,'#2B2135','right',560);
      text(displayLabel(d),L.listX0,y,L.val,CARD_INK[k],'left',760);
      const by=y+L.lab*.5,bw=L.listX1-L.listX0;
      rr(L.listX0,by,bw,L.bar,L.bar/2);c.fillStyle='#EFE8F4';c.fill();
      if(v>0){const fw=Math.max(L.bar,bw*v/100);rr(L.listX1-fw,by,fw,L.bar,L.bar/2);c.fillStyle=CARD_ARC[k];c.fill();}
    });
    // Footnote: what the numbers are, and that this is not a diagnosis.
    c.strokeStyle='rgba(111,80,138,.14)';c.lineWidth=1.5;c.beginPath();c.moveTo(left,L.footY-L.foot*3);c.lineTo(right,L.footY-L.foot*3);c.stroke();
    const note=current.empiricalReference&&useRelative()?'אחוזונים ביחס למדגם Johnson · לא אבחון':'ציוני שאלון 0–100, לא דירוג באוכלוסייה · לא אבחון';
    // Where and when: the site address (LTR, left) and the date (right).
    const host=location.hostname||'ofiLab';
    const date=new Date().toLocaleDateString('he-IL',{day:'numeric',month:'long',year:'numeric'});
    c.font='420 '+L.foot+'px "ofiLab Heebo", Arial';
    const room=(right-left)-c.measureText(host).width-c.measureText(date).width-L.foot*3;
    if(c.measureText(note).width<=room){
      text(note,w/2,L.footY,L.foot,'#7A6E85','center');
      text(host,left,L.footY,L.foot,'#6F508A','left',600);text(date,right,L.footY,L.foot,'#7A6E85');
    }else{
      // Not enough width for one line: the note goes above, address and date below.
      text(note,w/2,L.footY-L.foot*1.45,L.foot,'#7A6E85','center');
      text(host,left,L.footY+L.foot*.2,L.foot,'#6F508A','left',600);text(date,right,L.footY+L.foot*.2,L.foot,'#7A6E85');
    }
    canvas.setAttribute('aria-label','כרטיס '+meta.total+' שאלות: '+ORDER.map(k=>label(k)+' '+displayLabel(current.domains[k])).join(', '));
  }
  async function prepareCard(){
    const id=++renderId;shareFile=null;$('downloadShareCard').disabled=true;$('nativeShareCard').hidden=true;$('shareCardStatus').textContent='מכין את התמונה…';
    try{
      await document.fonts.ready;
      if(document.fonts.load)await document.fonts.load('700 48px "ofiLab Heebo"');
      const logo=await loadCardLogo();
      if(id!==renderId)return;
      drawCard($('shareCardFormat').value,logo);
      const blob=await new Promise((resolve,reject)=>$('shareCardCanvas').toBlob(b=>b?resolve(b):reject(Error('PNG failed')),'image/png'));
      if(id!==renderId)return;
      shareFile=new File([blob],'ofilab-'+meta.total+'-'+$('shareCardFormat').value+'.png',{type:'image/png'});
      $('downloadShareCard').disabled=false;
      $('nativeShareCard').hidden=!(navigator.canShare&&navigator.canShare({files:[shareFile]}));
      $('shareCardStatus').textContent='התמונה מוכנה. היא נשארת אצלך עד שתבחר להוריד או לשתף.';
    }catch(e){if(id===renderId)$('shareCardStatus').textContent='לא הצלחנו ליצור תמונה. נסה שוב או שמור דוח PDF.';}
  }
  $('openShareCard').addEventListener('click',()=>{$('shareCardDialog').showModal();prepareCard();});
  $('closeShareCard').addEventListener('click',()=>$('shareCardDialog').close());
  $('shareCardFormat').addEventListener('change',prepareCard);
  $('downloadShareCard').addEventListener('click',()=>{if(!shareFile)return;const url=URL.createObjectURL(shareFile),a=node('a');a.href=url;a.download=shareFile.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);});
  $('nativeShareCard').addEventListener('click',async()=>{if(!shareFile)return;try{await navigator.share({files:[shareFile]});}catch(e){if(e.name!=='AbortError')$('shareCardStatus').textContent='השיתוף אינו זמין כרגע. אפשר להוריד את התמונה.';}});
  $('printReport').addEventListener('click',async()=>{
    // Isolate printing from the answer-bearing address. Browser headers can cache
    // the source URL before beforeprint, so changing history alone is insufficient.
    const preview=window.open('about:blank','_blank');
    if(!preview){$('toast').textContent='כדי לפתוח דוח PDF, אפשר חלון חדש לאתר ונסה שוב.';$('toast').classList.remove('hidden');return;}
    preview.opener=null;buildReport();
    const doc=preview.document;doc.open();doc.write('<!doctype html><html lang="he" dir="rtl" data-theme="light" data-print-report="true" data-ofilab-design="calm-v2"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ofiLab — דוח אישיות</title></head><body class="print-preview"></body></html>');doc.close();
    const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('./assets/report-print.css?v=radar-1',location.href).href;
    const ready=new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject;});doc.head.append(link);
    doc.body.append(doc.importNode($('printableReport'),true));
    try{await ready;await doc.fonts.ready;if(!preview.closed){preview.focus();preview.print();}}
    catch(e){if(!preview.closed){const message=doc.createElement('p');message.textContent='עיצוב הדוח לא נטען. חזור למבחן ונסה שוב.';doc.body.prepend(message);}}
  });
  window.addEventListener('beforeprint',beginPrint);window.addEventListener('afterprint',endPrint);
  window.addEventListener('ofilab:metric',ev=>{metricMode=ev.detail?.mode||'percentile';if(current){shareFile=null;renderId++;radar();}});
  window.OfiVisuals={render(profile,info){current=profile;meta=info;shareFile=null;renderId++;radar();buildReport();}};
})();
