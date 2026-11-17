/* ofiLab Experience v2 — progressively enhanced, browser-local result exploration & supplementary modules.
   Receives verified domain/facet scores, response-validity inputs, and browser-local supplementary quiz state.
   Never sends answers to any server; honours #e= protected-mode isolation by keeping supplementary tokens in memory.
   Split by topic: experience-validity.js (response validity), experience-models.js (model readings),
   this file (results page, facets, summary, navigation, settings) and experience-quizzes.js
   (HEXACO-H, VIA and ECR-RS questionnaires). They share window.OfiExperience. */
(()=>{
  'use strict';
  /* global computeResponseValidityFeatures, calculateCybernetics -- from experience-validity.js and experience-models.js */
  const $=id=>document.getElementById(id);
  const root=document.documentElement;
  if(!$('resultScreen')||!$('facetExplorer'))return;
  // Shared with the other experience-*.js files, which are called only after results exist.
  const ns=window.OfiExperience=window.OfiExperience||{};
  const keys=['N','E','O','A','C'];
  const labels={N:'רגישות רגשית',E:'מוחצנות',O:'פתיחות',A:'נעימות',C:'מצפוניות'};
  const number=n=>Number(n).toLocaleString('he-IL',{maximumFractionDigits:1});
  const el=(tag,cls,value)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(value!==undefined)node.textContent=String(value);
    return node;
  };
  let profile=null;
  // 'low' response quality (severe straight-lining or suspected random responding) means: do not interpret.
  const validityBlocksInterpretation=s=>{
    const v=s&&s.validityFeatures;
    return Boolean(v&&(v.validityLevel==='low'||v.isSevereStraightline||v.isSuspectedRandomResponding));
  };
  let metricMode='percentile';
  const relative=()=>metricMode==='percentile'&&Boolean(profile?.empiricalReference);
  const metricValue=row=>relative()?Number(row.percentileExact??row.percentile):row.score;
  const options=$('facetDomain'),input=$('facetSearch'),sort=$('facetOrder');
  const firstMissing=$('jumpUnanswered');
  const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  let currentAnswers=null,currentBank=null,currentSetAnswer=null;
  Object.assign(ns,{$,el,relative,validityBlocksInterpretation,renderProfileSummary,currentBank:()=>currentBank});
  Object.defineProperty(ns,'profile',{get:()=>profile,set:v=>{profile=v;},configurable:true});

  function resultsSnapshot(scores){
    const host=$('resultsSnapshot');
    if(!host)return;
    const isRel=typeof relative==='function'&&relative();
    const tiles=el('div','snapshot-tiles');
    for(const key of keys){
      const info=scores.domains[key],score=Number(info.score);
      const hasPct=typeof (info.percentileExact??info.percentile)==='number';
      const useRel=isRel&&hasPct;
      const pct=useRel?Number(info.percentileExact??info.percentile):score;
      const shownVal=useRel?Math.round(pct):score;
      const tile=el('button','snapshot-tile snapshot-trait-button');
      tile.type='button';
      tile.dataset.trait=key;
      tile.dataset.openTrait=key;
      tile.setAttribute('aria-label',(info.label||labels[key])+': '+(useRel?('אחוזון '+number(shownVal)+' (ציון '+number(score)+' מתוך 100)'):(number(score)+' מתוך 100'))+'. פתיחת פירוט.');
      const value=el('strong','snapshot-value');
      const isolated=el('bdi',null,useRel?('אחוזון '+number(shownVal)):(number(score)+' / 100'));
      isolated.dir='ltr';value.append(isolated);
      const track=el('span','snapshot-mini-track');
      const fill=el('span','snapshot-mini-fill');
      fill.style.width=Math.max(0,Math.min(100,useRel?pct:score))+'%';
      track.append(fill);
      tile.append(el('span','snapshot-label',info.label||labels[key]),value,track,
        el('span','snapshot-action',useRel?('ציון שאלון '+number(score)+'/100 · לפירוט'):'לפירוט התכונה'));
      tiles.append(tile);
    }
    host.replaceChildren(tiles);
  }

  function flatFacets(scores){
    const rows=[];
    for(const key of keys){
      const domain=scores.domains[key];
      const facetList=domain.facets||[];
      for(let i=0;i<facetList.length;i++){
        const facet=facetList[i];
        rows.push({
          key,
          domain:domain.label||labels[key],
          facet:facet.label,
          facetIndex:i+1,
          score:Number(facet.score),
          rangeScore:facet.rangeScore!=null?Number(facet.rangeScore):Number(facet.score),
          sem:facet.sem,
          conditionalSem:facet.conditionalSem,
          ci95:facet.ci95,
          conditionalCi95:facet.conditionalCi95,
          trueScoreCi95:facet.trueScoreCi95,
          conditionalCiMethod:facet.conditionalCiMethod,
          percentileCi95:facet.percentileCi95,
          ciMargin:facet.ciMargin,
          percentile:facet.percentile,
          percentileExact:facet.percentileExact,
          levelLabel:facet.levelLabel,
          text:facet.text||'',
          adaptationNote:facet.adaptationNote||null
        });
      }
    }
    return rows;
  }

  function facetBar(score){
    const bar=el('div','facet-explorer-track');
    bar.setAttribute('role','img');bar.setAttribute('aria-label',relative()?'אחוזון '+number(score):'ציון '+number(score)+' מתוך 100');
    const fill=el('span','facet-explorer-fill');fill.style.width=Math.max(0,Math.min(100,score))+'%';bar.append(fill);
    return bar;
  }

  function renderFacets(){
    const explorer=$('facetExplorer'),list=$('facetExplorerList'),count=$('facetExplorerCount');
    if(!profile)return;
    const expandedGroups=new Set(Array.from(list.querySelectorAll('.facet-domain-group[open]'),group=>group.dataset.trait));
    const rows=flatFacets(profile);
    if(!rows.length){
      explorer.hidden=true;
      document.querySelectorAll('[data-scroll="facetExplorer"]').forEach(b=>b.hidden=true);
      return;
    }
    explorer.hidden=false;
    const filter=options.value;
    const term=input.value.trim().toLocaleLowerCase('he-IL');
    let selected=rows.filter(row=>(filter==='all'||row.key===filter) &&
      (!term||[row.domain,row.facet,row.text].some(t=>t.toLocaleLowerCase('he-IL').includes(term))));
    if(sort.value==='desc')selected.sort((a,b)=>metricValue(b)-metricValue(a));
    if(sort.value==='asc')selected.sort((a,b)=>metricValue(a)-metricValue(b));
    const grouped=filter==='all'&&sort.value==='default'&&!term;
    count.textContent='מוצגים '+selected.length+' מתוך '+rows.length+' תחומי משנה · '+(relative()?'אחוזונים במדגם':'ציוני שאלון 0–100')+(grouped?' · פתח תכונה לפירוט':'');
    const cards=[];
    const groups=new Map();
    if(grouped)for(const key of keys){
      const group=el('details','facet-domain-group');group.dataset.trait=key;
      group.open=expandedGroups.has(key);
      const summary=el('summary','facet-domain-summary');
      const dScore=profile.domains[key]?.score!=null?Math.round(profile.domains[key].score):null;
      const dPct=profile.domains[key]?.percentileExact??profile.domains[key]?.percentile??dScore;
      const dMeta=relative()?('אחוזון '+Math.round(dPct)):(dScore!=null?'ציון '+dScore+'/100':'');
      summary.append(
        el('strong',null,profile.domains[key].label||labels[key]),
        el('span',null,(dMeta?dMeta+' · ':'')+(profile.domains[key].facets||[]).length+' תחומי משנה')
      );
      const body=el('div','facet-domain-cards');group.append(summary,body);groups.set(key,body);cards.push(group);
    }
    for(const row of selected){
      const card=el('details','facet-explorer-card');
      card.dataset.trait=row.key;
      const summary=el('summary','facet-explorer-summary');
      const title=el('div','facet-explorer-heading');
      title.append(el('span','facet-explorer-domain',row.domain),el('h3',null,row.facet));
      const score=el('span','facet-explorer-score',number(relative()?row.percentile:row.score));
      score.append(el('small',null,relative()?' אחוזון':' / 100'));
      summary.append(title,score);
      const content=el('div','facet-explorer-content');
      content.append(facetBar(metricValue(row)));
      if(profile.empiricalReference)content.append(el('p','empirical-inline','ציון שאלון: '+number(row.score)+'/100 · אחוזון במדגם: '+row.percentile));
      const activeScoreCi=Array.isArray(row.conditionalCi95)?row.conditionalCi95:row.ci95;
      if(activeScoreCi){
        const pctCiPart=(relative()&&Array.isArray(row.percentileCi95))?(' · באחוזונים: '+Math.round(row.percentileCi95[0])+'–'+Math.round(row.percentileCi95[1])):'';
        const semDetail=row.conditionalSem!=null
          ?('IRT cSEM: ±'+number(row.conditionalSem)+(row.sem!=null?' · קלאסי: ±'+number(row.sem):''))
          :((row.sem!=null||row.ciMargin!=null)?('SEM קלאסי: ±'+number(row.sem!=null?row.sem:Math.round((row.ciMargin/1.96)*10)/10)):'ללא אומדן SEM זמין');
        content.append(el('p','sem-inline','טווח סמך 95% (אי־ודאות מדידתית): ציון '+activeScoreCi[0]+'–'+activeScoreCi[1]+pctCiPart+' ('+semDetail+')'));
      }
      content.append(el('p',null,row.text));
      if(row.adaptationNote)content.append(el('p','cultural-adaptation-note','💡 '+row.adaptationNote));

      // Item Drill-Down ("מאיפה הגיע הציון?")
      if(currentBank&&currentAnswers){
        const facetItems=(currentBank.items||[]).filter(it=>it.domain===row.key&&it.facet===row.facetIndex);
        if(facetItems.length){
          const audit=el('details','facet-audit-details');
          const auditSum=el('summary','facet-audit-summary');
          auditSum.append(el('span',null,'🔍 מאיפה הגיע הציון? ('+facetItems.length+' שאלות המקור)'));
          const auditBody=el('div','facet-audit-body');
          const auditIntro=el('p','facet-audit-intro','להלן השאלות שקבעו את הציון בתחום זה. היגדים הפוכים (−) חושבו לפי 6 פחות התשובה שנבחרה. ניתן לעדכן תשובה בלחיצה:');
          auditBody.append(auditIntro);
          const LABELS_HE=['','מאוד לא מסכים','לא מסכים','ניטרלי','מסכים','מאוד מסכים'];
          for(const it of facetItems){
            const ans=currentAnswers[it.number-1]||0;
            const keyed=it.keyed==='minus'?'minus':'plus';
            const contributed=keyed==='minus'?(6-ans):ans;
            const itemRow=el('div','audit-item-row');
            const itemHead=el('div','audit-item-head');
            itemHead.append(
              el('span','audit-item-num','#'+it.number),
              el('strong','audit-item-text',it.he),
              el('span','audit-item-key '+keyed,keyed==='plus'?'ישיר (+)':'הפוך (−)')
            );
            const itemMeta=el('div','audit-item-meta');
            itemMeta.append(
              el('span',null,'תשובתך: '+(LABELS_HE[ans]||'לא נענה')+' ('+ans+')'),
              el('span','audit-contrib','תרומה לציון: '+contributed+' מתוך 5'+(keyed==='minus'?' (חישוב הפוך: 6 − '+ans+')':''))
            );
            if(it.adaptation){
              itemMeta.append(el('div','audit-adaptation','💡 '+it.adaptation));
            }
            if(typeof currentSetAnswer==='function'){
              const ratingBar=el('div','audit-rating-bar');
              ratingBar.setAttribute('role','group');
              ratingBar.setAttribute('aria-label','שינוי תשובה לשאלה '+it.number);
              for(let v=1;v<=5;v++){
                const btn=el('button','audit-choice-btn'+(ans===v?' active':''),String(v));
                btn.type='button';
                btn.title=LABELS_HE[v]+' ('+v+')';
                btn.setAttribute('aria-pressed',String(ans===v));
                btn.addEventListener('click',e=>{
                  e.stopPropagation();
                  currentSetAnswer(it.number-1,v);
                });
                ratingBar.append(btn);
              }
              itemRow.append(itemHead,itemMeta,ratingBar);
            }else{
              itemRow.append(itemHead,itemMeta);
            }
            auditBody.append(itemRow);
          }
          audit.append(auditSum,auditBody);
          content.append(audit);
        }
      }

      card.append(summary,content);
      if(grouped)groups.get(row.key).append(card);else cards.push(card);
    }
    if(!cards.length){
      const empty=el('div','facet-explorer-empty');
      empty.append(el('p',null,'לא נמצאו תחומי משנה מתאימים. אפשר לשנות את הסינון או את החיפוש.'));
      const clear=el('button','secondary','איפוס סינון');
      clear.type='button';clear.addEventListener('click',()=>{
        options.value='all';sort.value='default';input.value='';renderFacets();input.focus();
      });
      empty.append(clear);cards.push(empty);
    }
    list.replaceChildren(...cards);
  }


  // A single small reading layer, built entirely from the existing scores.
  // Nothing is persisted, uploaded or fed back into any scoring routine.
  function renderExecutiveLayer(scores){
    const model=window.OfiExecutive?.create(scores);
    if(!model?.available)return null;
    const section=el('section','ofi-exec');
    section.setAttribute('aria-label','המפה שלך בקצרה');
    section.append(
      el('span','ofi-exec__eyebrow','במבט אחד · מתוך התוצאות שלך'),
      el('h3','ofi-exec__title','המפה שלך בקצרה'),
      el('p','ofi-exec__intro','כמה נטיות בולטות, נקודות למחשבה ורעיון אחד להתנסות. כל אלה הם פירוש אפשרי של התשובות, לא קביעה עליך.')
    );
    const grid=el('div','ofi-exec__grid');
    const strengths=el('div','ofi-exec__pane');
    strengths.append(el('h4','ofi-exec__pane-title','כיוונים בולטים'));
    const strengthList=el('ul','ofi-exec__list');
    if(model.strengths.length){
      for(const item of model.strengths){
        const row=el('li','ofi-exec__item');
        const head=el('div','ofi-exec__item-head');
        head.append(el('strong',null,item.title),el('span','ofi-exec__metric',item.evidence));
        row.append(head,el('p',null,item.description));
        strengthList.append(row);
      }
    }else strengthList.append(el('li','ofi-exec__empty','אין די ציונים בולטים לפרשנות מצומצמת; מפת התכונות המלאה זמינה בהמשך.'));
    strengths.append(strengthList);
    const cautions=el('div','ofi-exec__pane ofi-exec__pane--soft');
    cautions.append(el('h4','ofi-exec__pane-title','דברים שאפשר לשים לב אליהם'));
    const cautionList=el('ul','ofi-exec__list');
    if(model.challenges.length){
      for(const item of model.challenges){
        const li=el('li','ofi-exec__item');
        li.append(el('strong',null,item.title),el('p',null,item.description));
        cautionList.append(li);
      }
    }else cautionList.append(el('li','ofi-exec__empty','לא זוהו כאן נקודות קיצון בולטות. לכל נטייה יכולים להיות יתרונות ואתגרים בהתאם להקשר.'));
    cautions.append(cautionList);
    grid.append(strengths,cautions);
    const tip=el('div','ofi-exec__tip');
    tip.append(el('strong',null,'ניסוי קטן לשבוע הקרוב'),el('p',null,model.tip));
    section.append(grid,tip);
    return section;
  }

  function renderProfileSummary(scores){
    const container=$('resultsProfileSummary');
    if(!container||!scores||!scores.domains)return;
    const isRel=relative();
    const sorted=keys.map(k=>({
      key:k,
      label:scores.domains[k].label||labels[k],
      pct:scores.domains[k].percentileExact??scores.domains[k].percentile??scores.domains[k].score,
      score:scores.domains[k].score
    })).sort((a,b)=>b.pct-a.pct);

    const top1=sorted[0];
    const top2=sorted[1];
    const lowest=sorted[sorted.length-1];
    const hasPair=(a,b)=>(top1.key===a&&top2.key===b)||(top1.key===b&&top2.key===a);
    const isBalancedProfile=(top1.pct-lowest.pct)<=18&&top1.pct<=62&&lowest.pct>=38;

    let headline='פרופיל מאוזן ורב-גוני';
    if(isBalancedProfile)headline='פרופיל מאוזן, הרמוני וסתגלני בין כלל התכונות';
    else if(hasPair('N','A'))headline='רגישות אמפתית וצנועה · קשב פנימי עמוק וענווה ביחסים';
    else if(hasPair('N','O'))headline='רגישות אינטלקטואלית · סקרנות מעמיקה ועולם רגשי עשיר';
    else if(hasPair('E','A'))headline='נוכחות חברתית חמה, אמפתית ומחברת';
    else if(hasPair('C','O'))headline='יצירתיות שיטתית · שילוב בין מעוף מחשבתי לביצוע ממוקד';
    else if(hasPair('C','A'))headline='אחריות, מהימנות גבוהה ושיתוף פעולה בגובה העיניים';
    else if(hasPair('E','O'))headline='סקרנות חיה, יוזמה ופתיחות לחוויות ולאנשים';
    else if(hasPair('E','C'))headline='הנעה דינמית, מנהיגות מעשית ודחף להישגים';
    else if(hasPair('O','A'))headline='פתיחות הומניסטית, הקשבה עמוקה וסקרנות אנושית';
    else if(hasPair('N','C'))headline='סטנדרטים גבוהים, יסודיות וקשב פנימי חד';
    else if(hasPair('N','E'))headline='נוכחות רגשית חיה, מעורבות גבוהה וביטוי כן';
    else if(top1.key==='C')headline='מצפוניות, סדר ומחויבות גבוהה למשימות';
    else if(top1.key==='A')headline='נועם הליכות, אמפתיה ושיתוף פעולה';
    else if(top1.key==='O')headline='סקרנות אינטלקטואלית ופתיחות לרעיונות';
    else if(top1.key==='N')headline='רגישות רגשית גבוהה וערנות פנימית עמוקה';
    else if(top1.key==='E')headline='אנרגיה חברתית, מוחצנות ויוזמה';

    container.hidden=false;container.replaceChildren();
    const shell=el('div','profile-summary-shell');
    const headerRow=el('div','profile-summary-header');
    headerRow.append(
      el('span','profile-summary-kicker','תמצית הפרופיל שלך'),
      el('h2','profile-summary-title',headline)
    );

    const definiteForm=l=>{
      if(!l)return '';
      if(l==='רגישות רגשית')return 'הרגישות הרגשית';
      if(l==='סקרנות ודמיון')return 'הסקרנות והדמיון';
      if(l==='פתיחות לרעיונות')return 'הפתיחות לרעיונות';
      return l.startsWith('ה')?l:'ה'+l;
    };
    const fmtChipMetric=item=>scores.empiricalReference
      ?(isRel?('אחוזון '+Math.round(item.pct)):('ציון '+number(item.score)+'/100 · אחוזון '+Math.round(item.pct)))
      :('ציון '+number(item.score)+'/100');
    const lowestClause=lowest.pct>=55
      ?'בד בבד, ממד '+definiteForm(lowest.label)+' ('+fmtChipMetric(lowest)+') מופיע במינון מתון יותר יחסית לשאר התכונות הבולטות בפרופיל שלך.'
      :'בד בבד, ממד '+definiteForm(lowest.label)+' ('+fmtChipMetric(lowest)+') מציג את המינון המתון ביותר בפרופיל ומגדיר את הקצב וההעדפות האישיות שלך.';
    const desc=el('p','profile-summary-narrative',
      'הפרופיל שלך משלב באופן בולט את ממד '+definiteForm(top1.label)+' ('+fmtChipMetric(top1)+') יחד עם '+top2.label+' ('+fmtChipMetric(top2)+'). '
      +lowestClause
    );

    const chips=el('div','profile-summary-chips');
    const c1=el('div','profile-chip chip-lead');
    c1.append(el('strong',null,'תכונה דומיננטית'),el('span',null,top1.label+' ('+(isRel?'אחוזון '+Math.round(top1.pct):number(top1.score)+'/100')+')'));
    const c2=el('div','profile-chip chip-secondary');
    c2.append(el('strong',null,'עוגן משני'),el('span',null,top2.label+' ('+(isRel?'אחוזון '+Math.round(top2.pct):number(top2.score)+'/100')+')'));
    const c3=el('div','profile-chip chip-low');
    c3.append(el('strong',null,'הבחנה ייחודית'),el('span',null,lowest.label+' ('+(isRel?'אחוזון '+Math.round(lowest.pct):number(lowest.score)+'/100')+')'));

    const f=(scores&&scores.validityFeatures)||computeResponseValidityFeatures(currentAnswers,currentBank,scores);
    const hasSevereBias=Boolean(f&&f.isSevereStraightline);
    const hasRandomResponding=Boolean(f&&f.isSuspectedRandomResponding);
    const hasModerateBias=Boolean(f&&f.isModerateStraightline);

    let alertBox=null;
    if(hasSevereBias||hasRandomResponding){
      alertBox=el('div','profile-validity-alert');
      const alertCopy=el('div','validity-alert-copy');
      alertCopy.append(
        el('strong',null,hasSevereBias?'לתשומת לבך: זוהה דפוס מענה אחיד (Straight-lining)':'לתשומת לבך: חשד למענה אקראי'),
        el('p',null,hasSevereBias
          ?'נמצאה שונות תשובות נמוכה במיוחד. הממצאים המוצגים להלן הם להתרשמות ראשונית בלבד ומומלץ לבצע מענה חוזר ומגוון לקבלת פרופיל מהימן.'
          :'דפוס התשובות דומה מאוד למענה אקראי. אין לפרש את הציונים, את טיפוס ה־MBTI או את התובנות; מומלץ למלא את השאלון מחדש.')
      );
      alertBox.append(el('span','validity-alert-icon','⚠️'),alertCopy);
    }

    const cVal=el('button','profile-chip chip-validity'+((hasSevereBias||hasRandomResponding)?' chip-validity-alert':''));
    cVal.type='button';
    cVal.setAttribute('aria-label','קפיצה למדד בקרת איכות ועקביות מענה');
    const cValText=hasSevereBias?'התרעת מענה אחיד ↓'
      :hasRandomResponding?'חשד למענה אקראי ↓'
      :(hasModerateBias?(f.neutralPct>=50?'נטייה לניטרליות ↓':'שונות מצומצמת ↓')
      :(f?.isAcquiescenceBias?(f.mean<=1.90?'נטייה לשלילה גורפת ↓':'נטייה להסכמה גורפת ↓')
      :(f?.isHighDiscrepancy?'פער ישירים/הפוכים ↓'
      :((f?.isInconsistentSynonyms||f?.isErraticPersonFit)?'חוסר עקביות תוך־ממדית ↓':'מהימנות מענה איתנה ↓'))));
    cVal.append(el('strong',null,'בקרת איכות ועקביות'),el('span',null,cValText));
    cVal.addEventListener('click',()=>{
      const vCard=$('responseValidityCard');
      if(vCard){
        vCard.scrollIntoView({behavior:'smooth',block:'start'});
        vCard.classList.add('highlight-pulse');
        setTimeout(()=>vCard.classList.remove('highlight-pulse'),2000);
      }
    });

    let estimatedType=null;
    if(window.OfiFourLetters){
      try{
        const est=window.OfiFourLetters.estimate(scores);
        if(est&&!est.validitySuspended&&est.fourType&&Array.isArray(est.axes)&&est.axes.length>=4){
          // Public presentation is four axes; the legacy fifth axis is retained internally.
          const axes=est.axes.slice(0,4);
          if(axes.every(a=>a.letter!=='?'))
            estimatedType=axes.map(a=>a.borderline?a.letter+'('+a.alternativeLetter+')':a.letter).join('');
        }
      }catch(_e){}
    }

    if(estimatedType){
      const cType=el('button','profile-chip chip-archetype');
      cType.type='button';
      cType.setAttribute('aria-label','קפיצה לניתוח טיפוס '+estimatedType);
      // The type is Latin text; isolate it so RTL layout keeps "(E/I)STP" in order.
      const typeLine=el('span');
      const typeCode=el('bdi',null,estimatedType);
      typeCode.dir='ltr';
      typeLine.append(typeCode,' ↓');
      cType.append(
        el('strong',null,'סגנון אישיות משוער (4 אותיות)'),
        typeLine
      );
      cType.addEventListener('click',()=>{
        const mbti=$('mbtiDisclosure');
        if(mbti){
          mbti.open=true;
          mbti.scrollIntoView({behavior:'smooth',block:'start'});
          mbti.classList.add('highlight-pulse');
          setTimeout(()=>mbti.classList.remove('highlight-pulse'),2000);
        }
      });
      chips.append(c1,c2,c3,cVal,cType);
    }else{
      chips.append(c1,c2,c3,cVal);
    }

    // Friendly micro-guide distinguishing 0-100 score from percentile
    const guideBlock=el('div','profile-summary-guide');
    const guideHead=el('div','guide-head');
    guideHead.append(
      el('span','guide-icon','💡'),
      el('strong','guide-title','מדריך קצר לקריאת הציונים')
    );
    const guideGrid=el('div','guide-grid');

    const gItem1=el('div','guide-item');
    gItem1.append(
      el('strong','guide-item-title','ציון שאלון (0–100): '),
      el('span',null,'משקף את עוצמת הדיווח שלך בהיגדים. ערך גבוה אינו בהכרח "טוב" וערך נמוך אינו "רע" — לכל קצה יתרונות וסגנון פעולה ייחודי.')
    );

    const gItem2=el('div','guide-item');
    gItem2.append(
      el('strong','guide-item-title','אחוזון במדגם: '),
      el('span',null,'מציג את מיקומך היחסי בהשוואה לקבוצת הנורמה (למשל: אחוזון 70 פירושו ש־70% ממשתתפי המדגם קיבלו ציון נמוך משלך).')
    );

    guideGrid.append(gItem1,gItem2);
    guideBlock.append(guideHead,guideGrid);

    // Progressive disclosure: bridge executive summary directly to cybernetic lab
    const cyber=calculateCybernetics(scores,isRel);

    const cyberTeaser=el('div','profile-cyber-teaser');
    const cyberLead=el('div','cyber-teaser-lead');
    const teaserScoresText=isRel
      ?'(יציבות וויסות: אחוזון '+cyber.stability+' · חקרנות ויוזמה: אחוזון '+cyber.plasticity+')'
      :'(יציבות וויסות: '+cyber.stability+'/100 · חקרנות ויוזמה: '+cyber.plasticity+'/100)';
    cyberLead.append(
      el('span','cyber-teaser-icon','🧭'),
      el('strong',null,'דפוס מוביל: '+cyber.archTitle),
      el('span','cyber-teaser-scores',teaserScoresText)
    );
    const cyberJump=el('button','cyber-teaser-jump','כיוונים ומבטים נוספים ↓');
    cyberJump.type='button';
    cyberJump.addEventListener('click',()=>{
      const lab=$('cyberneticLabCard');
      if(lab){
        lab.scrollIntoView({behavior:'smooth',block:'start'});
        lab.classList.add('highlight-pulse');
        setTimeout(()=>lab.classList.remove('highlight-pulse'),2000);
      }
    });
    cyberTeaser.append(cyberLead,cyberJump);

    // In-page sub-navigation pills to eliminate cognitive overload & endless scrolling
    const navBar=el('div','profile-summary-nav');
    const navLabel=el('span','profile-nav-label','קפיצה מהירה:');
    navBar.append(navLabel);

    ns.checkHexacoDirect?.(scores);
    const hasFacets=Boolean(scores.domains?.N?.facets?.length===6);
    const jumps=[
      {label:'5 התכונות',target:'domainResults',icon:'📊'},
      {label:'מתחים פנימיים',target:'resultsParadoxPreview',icon:'⚡'},
      {label:'איכות ועקביות',target:'responseValidityCard',icon:'🛡️'},
      {label:'כיוונים נוספים',target:'cyberneticLabCard',icon:'🧭',isLab:true},
      ...(hasFacets?[{label:'30 תחומי המשנה',target:'facetExplorer',icon:'📑'}]:[]),
      {label:'השוואה למדגם',target:'normPanel',icon:'📈'},
      {label:estimatedType?'סגנון 4 אותיות ('+estimatedType+')':'סגנון 4 אותיות',target:'mbtiDisclosure',icon:'🧩',isDisclosure:true},
      {label:'שאלונים נוספים',target:'additionalQuizzesSection',icon:'🌟',isLab:true}
    ];

    for(const j of jumps){
      const btn=el('button','profile-nav-pill'+(j.isLab?' is-lab':''));
      btn.type='button';
      btn.append(el('span','nav-pill-icon',j.icon),el('span',null,j.label));
      btn.addEventListener('click',()=>{
        const elTarget=$(j.target);
        if(elTarget){
          if(j.isDisclosure||elTarget.tagName==='DETAILS')elTarget.open=true;
          elTarget.scrollIntoView({behavior:'smooth',block:'start'});
          if(j.isLab||j.isDisclosure){
            elTarget.classList.add('highlight-pulse');
            setTimeout(()=>elTarget.classList.remove('highlight-pulse'),2000);
          }
        }
      });
      navBar.append(btn);
    }

    const aiSummaryBar=el('div','profile-ai-summary-bar');
    const aiLead=el('div','profile-ai-summary-lead');
    aiLead.append(
      el('strong','profile-ai-summary-title','✨ סיכום עומק מפורט בנקודות (ofiLab AI)'),
      el('p','profile-ai-summary-desc','ניתוח אישי המצליב בין 5 התכונות, תחומי המשנה והפערים הייחודיים בפרופיל שלך — חוזקות, ניגודים פנימיים ודגשים מעשיים ליומיום.')
    );
    const aiActions=el('div','profile-ai-summary-actions');
    const aiMainBtn=el('button','profile-ai-summary-cta','✨ הפק סיכום מפורט בנקודות');
    aiMainBtn.type='button';
    aiMainBtn.addEventListener('click',()=>{
      window.dispatchEvent(new CustomEvent('ofilab:request-ai-summary',{detail:{
        launcher:aiMainBtn,
        prompt:'תן לי סיכום מפורט ומסודר בנקודות של הפרופיל שלי: תמונת על, חוזקות מרכזיות עם ציונים, ניגודים ופערים מעניינים בתוך תתי-התכונות, ונקודה מעשית ליומיום ולעבודה.'
      }}));
    });
    const aiGapBtn=el('button','profile-ai-summary-sub','⚡ ניתוח ניגודים בתתי־התכונות');
    aiGapBtn.type='button';
    aiGapBtn.addEventListener('click',()=>{
      window.dispatchEvent(new CustomEvent('ofilab:request-ai-summary',{detail:{
        launcher:aiGapBtn,
        prompt:'נתח לעומק בנקודות את הניגודים והפערים הבולטים בתוך תתי-התכונות שלי לעומת הציונים הכלליים, והסבר איך השילובים האלה מתבטאים בפועל.'
      }}));
    });
    // Free conversation: opens the chat empty, without sending a ready-made prompt.
    const aiChatBtn=el('button','profile-ai-summary-sub profile-ai-summary-chat','💬 שיחה חופשית על הדוח');
    aiChatBtn.type='button';
    aiChatBtn.addEventListener('click',()=>{
      $('askAiResults')?.click();
      setTimeout(()=>$('aiChatInput')?.focus(),60);
    });
    aiActions.append(aiMainBtn,aiGapBtn,aiChatBtn);
    aiSummaryBar.append(aiLead,aiActions);

    shell.append(headerRow,desc);
    if(alertBox)shell.append(alertBox);
    // Keep the measured highlights first; the experimental interpretation follows.
    shell.append(chips);
    // Short opening: headline, map, description and highlights stay visible, so
    // the five trait cards follow right after. The deeper summary layers (the
    // executive overview, AI summary, reading guide and deep-structure teaser)
    // open on request, in place, with their existing styling.
    const executive=renderExecutiveLayer(scores);
    const more=el('details','profile-summary-more');
    const moreSummary=el('summary','profile-summary-more-toggle');
    moreSummary.append(el('span','profile-summary-more-title','עוד מהתמצית'),
      el('span','profile-summary-more-hint','מה בולט אצלך, מה כדאי לשים לב אליו, וסיכום AI'));
    more.append(moreSummary);
    if(executive)more.append(executive);
    more.append(aiSummaryBar,guideBlock,cyberTeaser);
    shell.append(more,navBar);
    container.append(shell);
  }

  function renderParadoxPreview(scores){
    const container=$('resultsParadoxPreview');
    if(!container)return;
    // Insights stitched from noise would read as real findings; suspend them when quality is 'low'.
    if(validityBlocksInterpretation(scores)){container.hidden=true;container.replaceChildren();return;}
    const insights=scores.empiricalInsights||[];
    // Two data-driven links first (they are tied to the person's own answers), then the interpretive
    // tensions, then any further links; the generic "internal variation" note comes last.
    const links=insights.filter(i=>i.type==='link');
    const interpretive=insights.filter(i=>i.type==='paradox'||i.type==='response_bias');
    const splits=insights.filter(i=>i.type==='domain_split');
    const paradoxes=[...links.slice(0,2),...interpretive,...links.slice(2),...splits];
    if(!paradoxes.length){container.hidden=true;return;}

    container.hidden=false;container.replaceChildren();
    const head=el('div','paradox-preview-head');
    head.append(
      el('h2',null,'מתחים פנימיים ופרדוקסים בפרופיל שלך'),
      el('p',null,'פערים ייחודיים בין היבטים שונים שיוצרים את המורכבות והעומק של אישיותך:')
    );
    const list=el('div','paradox-preview-cards');
    for(const p of paradoxes.slice(0,3)){
      const card=el('article','paradox-preview-card is-'+p.type);
      card.append(
        el('span','paradox-badge',p.badge),
        el('h3',null,p.title),
        el('p',null,p.text)
      );
      const evidence=window.OfiProfileLinks?.evidenceNode?.(document,p);
      if(evidence)card.append(evidence);
      list.append(card);
    }
    const footer=el('div','paradox-preview-footer');
    const linkBtn=el('button','secondary','לצפייה בהשוואה המלאה לאוכלוסייה ↓');
    linkBtn.type='button';
    linkBtn.addEventListener('click',()=>{
      const nav=journeyButtons.find(b=>b.dataset.scroll==='normPanel');
      if(nav)nav.click();
    });
    footer.append(linkBtn);
    container.append(head,list,footer);
  }

  function syncMetricPills(val){
    document.querySelectorAll('.metric-pill').forEach(btn=>{
      const isActive=btn.dataset.metric===val;
      btn.classList.toggle('active',isActive);
      btn.setAttribute('aria-pressed',String(isActive));
    });
    const helper=$('resultsMetricHelp');
    if(helper){
      helper.textContent=val==='percentile'
        ?'מציג את מיקומך ביחס לאוכלוסייה (לדוגמה: אחוזון 78 = גבוה מ־78% מהנבדקים במחקר).'
        :'מציג את עוצמת ההסכמה שלך לשאלות המבחן (ממוצע התשובות שלך מתוך 100).';
    }
  }

  // A quiet pointer to support when the answers describe very heavy feelings (N3 depression or
  // N6 vulnerability at the 95th percentile or above). Not a diagnosis; shown only to this person.
  function renderSupportNote(scores){
    const anchor=$('emotionalStabilityCard');
    let note=$('supportNote');
    const f=scores?.domains?.N?.facets||[];
    const pct=i=>Number(f[i]?.percentileExact??NaN);
    const show=Boolean(scores?.empiricalReference)&&(pct(2)>=95||pct(5)>=95);
    if(!show){if(note)note.remove();return;}
    if(!anchor)return;
    if(!note){note=el('aside','support-note');note.id='supportNote';note.setAttribute('role','note');}
    const link=(href,text)=>{const a=el('a',null,text);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;};
    const list=el('ul','support-note-list');
    const eran=el('li');eran.append(link('https://www.eran.org.il/online-emotional-help/','ער״ן — עזרה ראשונה נפשית'),' · טלפון 1201 או צ׳אט, בכל שעה');
    const sahar=el('li');sahar.append(link('https://sahar.org.il/','סה״ר — סיוע והקשבה ברשת'));
    const emergency=el('li',null,'במצב חירום: מד״א 101');
    list.append(eran,sahar,emergency);
    note.replaceChildren(
      el('strong','support-note-title','אם קשה לך בתקופה הזאת'),
      el('p',null,'בחלק מהתשובות תיארת תחושות כבדות של דכדוך או חוסר אונים. השאלון אינו אבחנה, אבל אם התחושות האלה מלוות אותך, שיחה עם מישהו יכולה לעזור.'),
      list);
    if(note.previousElementSibling!==anchor)anchor.after(note);
  }

  function onResults(event){
    const scores=event.detail&&event.detail.profile;
    if(!scores||!scores.domains)return;
    profile=scores;
    currentAnswers=event.detail.answers||null;
    currentBank=event.detail.bank||null;
    currentSetAnswer=event.detail.setAnswer||null;
    metricMode=profile.empiricalReference?'percentile':'score';
    const metric=$('resultsMetric');
    if(metric){metric.value=metricMode;metric.querySelector('option[value="percentile"]').disabled=!profile.empiricalReference;}
    syncMetricPills(metricMode);
    const guide=$('resultsQuickGuideText');
    if(guide){
      const total=event.detail.total||profile.empiricalReference?.answeredItems;
      guide.textContent=(total?total+' תשובות · ':'')+'חמש תכונות'+(flatFacets(profile).length?' ו־30 תחומי משנה. ':'. ')+(profile.empiricalReference?'מדגם ההשוואה: '+Number(profile.empiricalReference.n).toLocaleString('he-IL')+' משיבים. ':'')+'פתח תכונה לפירוט ההיבטים שלה.';
    }
    ns.renderValidityCard(scores,currentAnswers,currentBank);
    renderSupportNote(scores);
    resultsSnapshot(scores);
    renderProfileSummary(scores);
    renderParadoxPreview(scores);
    renderFacets();
    ns.renderCyberneticLab(scores);
    if(typeof window.renderUppsImpulsivity==='function')window.renderUppsImpulsivity(scores);
    if(typeof window.renderInterpersonalCircumplex==='function')window.renderInterpersonalCircumplex(scores);
    if(typeof window.renderNeoStyleGraphs==='function')window.renderNeoStyleGraphs(scores);
    if(typeof window.renderAdditionalQuizzesHub==='function')window.renderAdditionalQuizzesHub(scores);
    syncMobileSection(null);
    // The complete results always remain accessible in DOM, even if no enhancement runs.
    const main=$('traitOverview');
    if(main)main.setAttribute('aria-label','חמש התכונות — פירוט ציונים');
  }

  for(const control of [options,input,sort])if(control)
    control.addEventListener(control===input?'input':'change',renderFacets);
  $('resultsMetric')?.addEventListener('change',event=>{
    metricMode=event.target.value==='percentile'&&profile?.empiricalReference?'percentile':'score';
    syncMetricPills(metricMode);
    renderFacets();
    if(profile){
      resultsSnapshot(profile);
      renderProfileSummary(profile);
      ns.renderCyberneticLab(profile);
      if(typeof window.renderUppsImpulsivity==='function')window.renderUppsImpulsivity(profile);
      if(typeof window.renderInterpersonalCircumplex==='function')window.renderInterpersonalCircumplex(profile);
      if(typeof window.renderNeoStyleGraphs==='function')window.renderNeoStyleGraphs(profile);
      if(typeof window.renderAdditionalQuizzesHub==='function')window.renderAdditionalQuizzesHub(profile);
    }
    window.dispatchEvent(new CustomEvent('ofilab:metric',{detail:{mode:metricMode}}));
  });

  document.querySelectorAll('.metric-pill').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const mode=btn.dataset.metric;
      if(mode==='percentile'&&!profile?.empiricalReference)return;
      const select=$('resultsMetric');
      if(select&&select.value!==mode){
        select.value=mode;
        select.dispatchEvent(new Event('change'));
      }
    });
  });

  $('facetToggleAll')?.addEventListener('click',()=>{
    const list=$('facetExplorerList');
    if(!list)return;
    const groups=Array.from(list.querySelectorAll('.facet-domain-group'));
    const cards=Array.from(list.querySelectorAll('.facet-explorer-card'));
    const anyClosed=groups.some(g=>!g.open)||cards.some(c=>!c.open);
    groups.forEach(g=>{g.open=anyClosed;});
    cards.forEach(c=>{c.open=anyClosed;});
    const btn=$('facetToggleAll');
    if(btn){
      btn.textContent=anyClosed?'כווץ הכל':'הרחב הכל';
      btn.setAttribute('aria-expanded',String(anyClosed));
    }
  });

  $('resultsSnapshot')?.addEventListener('click',event=>{
    const button=event.target.closest('[data-open-trait]');
    if(!button)return;
    const card=$('trait-'+button.dataset.openTrait);
    if(!card)return;
    card.open=true;
    card.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});
    const summary=card.querySelector('summary');
    if(summary){summary.tabIndex=-1;summary.focus({preventScroll:true});}
  });

  // The native select menu is OS-rendered and cannot take the CALM glass theme.
  // Use an accessible custom menu-button on phones and delegate all navigation
  // to the existing buttons, without modifying #p= / #e= saved-answer hashes.
  const mobileTrigger=$('resultsMobileTrigger');
  const mobileMenu=$('resultsMobileMenu');
  const mobileCurrent=$('resultsMobileCurrent');
  const mobilePicker=mobileTrigger?.closest('.results-mobile-picker');
  const mobileOptions=Array.from(mobileMenu?.querySelectorAll('[data-mobile-section]')||[]);
  const journeyButtons=Array.from(document.querySelectorAll('.results-journey [data-scroll]'));
  function availableMobileOptions(){
    return mobileOptions.filter(option=>!option.hidden&&!option.disabled);
  }
  function syncMobileSection(activeButton){
    if(!mobileTrigger||!mobileMenu)return;
    for(const option of mobileOptions){
      const id=option.dataset.mobileSection;
      if(id==='__top')continue;
      const nav=journeyButtons.find(item=>item.dataset.scroll===id);
      const unavailable=!nav||nav.hidden;
      option.hidden=unavailable;
      option.disabled=unavailable;
    }
    const preferred=activeButton?.dataset.scroll||'traitOverview';
    const selected=availableMobileOptions().find(option=>option.dataset.mobileSection===preferred)||
      availableMobileOptions().find(option=>option.dataset.mobileSection!=='__top');
    if(!selected)return;
    const code=selected.querySelector('.results-mobile-menu-index')?.textContent||'01';
    const name=selected.querySelector('.results-mobile-menu-name')?.textContent||'חמש התכונות';
    if(mobileCurrent)mobileCurrent.textContent=code+' · '+name;
    for(const option of mobileOptions){
      if(option.dataset.mobileSection==='__top')continue;
      option.setAttribute('aria-checked',String(option===selected));
    }
  }
  function closeMobileMenu(restoreFocus=false){
    if(!mobileMenu||!mobileTrigger)return;
    mobileMenu.hidden=true;
    mobileMenu.classList.remove('opens-up');
    mobileTrigger.setAttribute('aria-expanded','false');
    if(restoreFocus)mobileTrigger.focus();
  }
  function openMobileMenu(){
    if(!mobileMenu||!mobileTrigger)return;
    // Pick the side with more usable space and cap the menu height. This
    // avoids a bottom-clipped list or an upwards menu hidden above the screen.
    const rect=mobileTrigger.getBoundingClientRect();
    const below=Math.max(0,window.innerHeight-rect.bottom-16);
    const above=Math.max(0,rect.top-16);
    const upwards=below<270&&above>below;
    mobileMenu.classList.toggle('opens-up',upwards);
    mobileMenu.style.maxHeight=Math.max(90,Math.min(460,upwards?above:below))+'px';
    mobileMenu.hidden=false;
    mobileTrigger.setAttribute('aria-expanded','true');
    const selected=availableMobileOptions().find(option=>option.getAttribute('aria-checked')==='true')||
      availableMobileOptions()[0];
    selected?.focus();
  }
  mobileTrigger?.addEventListener('click',()=>{
    if(mobileMenu?.hidden)openMobileMenu();
    else closeMobileMenu(true);
  });
  mobileMenu?.addEventListener('click',event=>{
    const item=event.target.closest('[data-mobile-section]');
    if(!item||item.hidden||item.disabled)return;
    const target=item.dataset.mobileSection;
    closeMobileMenu();
    if(target==='__top'){
      $('resultsBackToTop')?.click();
      syncMobileSection(null);
      return;
    }
    const nav=journeyButtons.find(button=>button.dataset.scroll===target&&!button.hidden);
    if(nav)nav.click();
    else{syncMobileSection(null);mobileTrigger?.focus();}
  });
  mobileMenu?.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();closeMobileMenu(true);return;
    }
    if(event.key==='Tab'){closeMobileMenu();return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    const available=availableMobileOptions();
    if(!available.length)return;
    event.preventDefault();
    const current=available.indexOf(document.activeElement);
    const index=event.key==='Home'?0:event.key==='End'?available.length-1:
      (current+(event.key==='ArrowDown'?1:-1)+available.length)%available.length;
    available[index].focus();
  });
  document.addEventListener('pointerdown',event=>{
    if(mobileMenu&&!mobileMenu.hidden&&mobilePicker&&!mobilePicker.contains(event.target))
      closeMobileMenu();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&mobileMenu&&!mobileMenu.hidden){
      event.preventDefault();closeMobileMenu(true);
    }
  });
  window.addEventListener('resize',()=>{
    if(window.innerWidth>900&&mobileMenu&&!mobileMenu.hidden)closeMobileMenu();
  });

  // On-page navigation is deliberately button-based; changing location.hash
  // would destroy the answer-bearing #p= progress token.
  let pauseJourneyHighlightUntil=0;
  document.querySelectorAll('[data-scroll]').forEach(button=>{
    button.addEventListener('click',()=>{
      // Do not flash earlier sections as a smooth jump passes them.
      pauseJourneyHighlightUntil=Date.now()+(reduced()?0:950);
      const target=$(button.dataset.scroll);
      if(!target||target.hidden)return;
      if(target.matches('details'))target.open=true;
      target.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});
      document.querySelectorAll('.results-journey [data-scroll]').forEach(other=>
        other.setAttribute('aria-pressed',String(other===button)));
      syncMobileSection(button);
      const heading=target.querySelector('h2,summary');
      if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
    });
  });

  // Follow the section currently in view without changing the #p=/#e= save token.
  // The overview at the top is intentionally unselected (before section 01).
  let journeyFrame=0;
  function updateJourneyLocation(){
    journeyFrame=0;
    if(document.documentElement.dataset.stage!=='results')return;
    if(Date.now()<pauseJourneyHighlightUntil)return;
    const cutoff=Math.min(170,Math.max(112,window.innerHeight*0.2));
    let current=null;
    document.querySelectorAll('.results-journey [data-scroll]').forEach(button=>{
      const target=$(button.dataset.scroll);
      if(!target||button.hidden||target.hidden||target.closest('[hidden]'))return;
      if(target.getBoundingClientRect().top<=cutoff)current=button;
    });
    document.querySelectorAll('.results-journey [data-scroll]').forEach(button=>{
      button.setAttribute('aria-pressed',String(button===current));
      if(button===current)button.setAttribute('aria-current','location');
      else button.removeAttribute('aria-current');
    });
    syncMobileSection(current);
  }
  function scheduleJourneyLocation(){
    if(journeyFrame||document.documentElement.dataset.stage!=='results')return;
    journeyFrame=window.requestAnimationFrame(updateJourneyLocation);
  }
  window.addEventListener('scroll',scheduleJourneyLocation,{passive:true});
  window.addEventListener('resize',scheduleJourneyLocation,{passive:true});
  $('resultsBackToTop')?.addEventListener('click',()=>{
    pauseJourneyHighlightUntil=Date.now()+(reduced()?0:950);
    document.querySelectorAll('.results-journey [data-scroll]').forEach(button=>{
      button.setAttribute('aria-pressed','false');
      button.removeAttribute('aria-current');
    });
    const heading=$('resultScreen')?.querySelector('h1');
    if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
    window.scrollTo({top:0,behavior:reduced()?'instant':'smooth'});
    syncMobileSection(null);
  });

  // The questionnaire owns answer persistence and cursor changes.
  // This module only provides the design layer for explicit user actions.
  window.addEventListener('ofilab:results',onResults);
  let quizStartTime=0, answeredPaceSamples=[];
  // A different inventory means a different set of answers. Until it reports new
  // results, supplementary scoring must not reuse the previous inventory's profile.
  window.addEventListener('ofilab:inventory-switched',()=>{
    ns.clearAllQuizTimers?.();
    profile=null;quizStartTime=0;answeredPaceSamples=[];
  });
  window.addEventListener('ofilab:question',event=>{
    const detail=event.detail||{};
    const percent=(detail.cursor+1)/detail.total;
    const rail=$('quizMilestones');
    if(rail){
      const active=Math.min(4,Math.floor(detail.cursor/(detail.total/5)));
      Array.from(rail.children).forEach((node,i)=>{
        node.dataset.state=i<active?'complete':i===active?'current':'upcoming';
        node.title='חלק '+(i+1)+' מתוך 5';
      });
      rail.setAttribute('aria-label','חלק '+(active+1)+' מתוך 5. '+detail.answered+' שאלות נענו מתוך '+detail.total);
    }
    root.style.setProperty('--quiz-position',Math.max(0,Math.min(100,percent*100))+'%');
    if(firstMissing){
      const where=detail.nextUnanswered;
      firstMissing.hidden=!Number.isInteger(where)||where<0||where===detail.cursor;
    }

    const etaBadge=$('quizEtaBadge');
    if(etaBadge&&detail.total&&detail.answered){
      const now=Date.now();
      if(!quizStartTime)quizStartTime=now;
      answeredPaceSamples.push(now);
      if(answeredPaceSamples.length>25)answeredPaceSamples.shift();
      if(detail.answered>=3&&detail.answered<detail.total){
        const activeDeltas=[];
        for(let i=1;i<answeredPaceSamples.length;i++){
          const dt=(answeredPaceSamples[i]-answeredPaceSamples[i-1])/1000;
          if(dt>=0.4&&dt<=60)activeDeltas.push(dt);
        }
        let secPerQuestion;
        if(activeDeltas.length>=2){
          activeDeltas.sort((a,b)=>a-b);
          const mid=Math.floor(activeDeltas.length/2);
          const med=activeDeltas.length%2?activeDeltas[mid]:(activeDeltas[mid-1]+activeDeltas[mid])/2;
          secPerQuestion=Math.max(2,Math.min(20,med));
        }else{
          const totalElapsedSec=Math.max(1,(now-quizStartTime)/1000);
          secPerQuestion=Math.max(2,Math.min(20,totalElapsedSec/detail.answered));
        }
        const remainSec=(detail.total-detail.answered)*secPerQuestion;
        const remainMin=Math.max(1,Math.round(remainSec/60));
        etaBadge.hidden=false;
        etaBadge.textContent='עוד כ־'+remainMin+' דק׳ לסיום';
      }else if(detail.answered>=detail.total){
        etaBadge.hidden=false;
        etaBadge.textContent='המבחן הושלם ✓';
      }else{
        etaBadge.hidden=true;
      }
    }
  });


  // Settings Dialog management
  const settingsModal = $('settingsDialog');
  function updateSettingsTabs() {
    const inv = root.dataset.inventory;
    const currentLen = inv === 'ipip-neo-300' ? 300 : 120;
    document.querySelectorAll('#settingsVersionTabs .version-tab').forEach(tab => {
      tab.classList.toggle('active', Number(tab.dataset.ver) === currentLen);
    });
  }

  function openSettings() {
    if (!settingsModal) return;
    updateSettingsTabs();
    if (typeof settingsModal.showModal === 'function') {
      try { settingsModal.showModal(); } catch (e) { settingsModal.setAttribute('open', ''); }
    } else {
      settingsModal.setAttribute('open', '');
    }
  }

  function closeSettings() {
    if (!settingsModal) return;
    if (typeof settingsModal.close === 'function') {
      try { settingsModal.close(); } catch (e) { settingsModal.removeAttribute('open'); }
    } else {
      settingsModal.removeAttribute('open');
    }
  }

  for (const triggerId of ['openSettingsTop', 'openSettingsQuiz', 'openSettingsBottom']) {
    const btn = $(triggerId);
    if (btn) btn.addEventListener('click', openSettings);
  }

  for (const closeId of ['closeSettingsBtn', 'saveCloseSettingsBtn']) {
    const btn = $(closeId);
    if (btn) btn.addEventListener('click', closeSettings);
  }

  if (settingsModal) {
    settingsModal.addEventListener('click', event => {
      if (event.target === settingsModal) closeSettings();
    });

    const versionTabs = $('settingsVersionTabs');
    if (versionTabs) {
      versionTabs.addEventListener('click', event => {
        const tab = event.target.closest('.version-tab');
        if (!tab) return;
        const targetLen = Number(tab.dataset.ver);
        if (typeof window.switchOfiLabInventory === 'function') {
          window.switchOfiLabInventory(targetLen, false);
          updateSettingsTabs();
        }
      });
    }

    const protectBtn = $('protectSaveQuiz');
    if (protectBtn) {
      protectBtn.addEventListener('click', () => closeSettings());
    }
    const reviewBtn = $('reviewBtn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => closeSettings());
    }
  }

  // Reflect current page context, but never store question data or answers.
  const title=$('aiDialogTitle');
  if(title){
    const dialog=$('aiDialog');
    const obs=new MutationObserver(()=>{
      dialog.dataset.dialogMode=title.textContent.includes('השאלה')?'question':'results';
    });
    obs.observe(title,{childList:true,characterData:true,subtree:true});
  }
  // Animate sample bars once, when they actually enter view.
  const reportPreview = $('homeReportPreview');
  if (reportPreview) {
    if ('IntersectionObserver' in window && !reduced()) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          reportPreview.classList.add('is-visible');
          observer.disconnect();
        }
      }, { threshold: 0.12 });
      observer.observe(reportPreview);
    } else {
      reportPreview.classList.add('is-visible');
    }
  }


})();
