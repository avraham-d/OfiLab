/* ofiLab results: the supplementary questionnaires (HEXACO-H, IPIP-VIA-R, ECR-RS), their
   cards and their save tokens. Answers stay in the browser; #e= sessions keep them in memory only.
   Part of the results page; shares helpers through window.OfiExperience (see experience.js). */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  if(!$('resultScreen')||!$('facetExplorer'))return;
  const ns=window.OfiExperience;
  const el=(...args)=>ns.el(...args);
  const renderProfileSummary=scores=>ns.renderProfileSummary(scores);

  // Auto-advance timers live at the top so clearAllQuizTimers() can never hit a
  // temporal-dead-zone reference, whatever order listeners fire in.
  let hexacoAdvanceTimer=null,viaAdvanceTimer=null,ecrrsAdvanceTimer=null;
  function clearAllQuizTimers(){
    clearTimeout(hexacoAdvanceTimer);
    clearTimeout(viaAdvanceTimer);
    clearTimeout(ecrrsAdvanceTimer);
    hexacoAdvanceTimer=null;viaAdvanceTimer=null;ecrrsAdvanceTimer=null;
  }
  // These percentiles are not drawn from respondents. build-empirical-deep-models.py simulates
  // 400,000 scores from published means/SDs, partly for different item sets than the ones here.
  const SIMULATED_NORM_NOTES={
    hexaco:'על האחוזון: אין לשאלון הזה נורמות משלו. האחוזון מחושב מהתפלגות מדומה לפי ממוצע וסטיית תקן שפורסמו לשאלון HEXACO-100 (Lee & Ashton, 2018), בעוד ש־16 ההיגדים כאן הם שאלון מקוצר שחלקו מבוסס על היגדי HEXACO-PI-R. זה אומדן גס, לא השוואה למדגם אמיתי.',
    via:'על האחוזונים: הם מחושבים מהתפלגות מדומה לפי ממוצעים שפורסמו לשאלון VIA-IS המלא (McGrath, 2015), שהוא שאלון אחר מההיגדים כאן. זה אומדן גס, לא השוואה למדגם אמיתי.',
    ecrrs:'על האחוזונים: הם מחושבים מהתפלגות מדומה לפי ממוצעים וסטיות תקן שפורסמו (Fraley et al., 2011), לא מנתוני משיבים. מדד הביטחון משלב את שני הצירים בנוסחה שהוגדרה באתר הזה ואינו חלק מהשאלון המקורי.'
  };

  let showHexacoProxyPreview=false;
  let showViaProxyPreview=false;
  let isProtectedSession=false;
  let protectedSuppTokens={h:null,v:null,a:null};
  const memSuppDrafts={hexaco:null,via:null,ecrrs:null};
  function isSuppProtected(){
    return Boolean(isProtectedSession||(typeof window!=='undefined'&&typeof window.location?.hash==='string'&&window.location.hash.startsWith('#e=')));
  }

  function checkHexacoDirect(scores){
    if(!scores)return;
    const prot=isSuppProtected();
    const hash=(!prot&&typeof window!=='undefined'&&window.location.hash)?window.location.hash:'';
    try{
      const hMatch=hash.match(/[#&]h=([A-Za-z0-9_-]{7})/);
      const hToken=prot?protectedSuppTokens.h:(hMatch?hMatch[1]:(typeof localStorage!=='undefined'?localStorage.getItem('avd-personality:supp:hexaco'):null));
      if(hToken&&/^[A-Za-z0-9_-]{7}$/.test(hToken)&&window.OfiHexacoCodec){
        const answers=window.OfiHexacoCodec.decode(hToken);
        const bankEl=$('data-hexaco-items');
        const bank=bankEl?JSON.parse(bankEl.textContent):window.OfiHexacoBank;
        if(bank&&Array.isArray(answers)&&answers.length===16){
          scores.hexacoHonesty=window.OfiHexacoCodec.calculate(bank,answers);
        }
      }
    }catch(err){
      console.warn('Failed to parse direct HEXACO token:',err);
    }
    try{
      const aMatch=hash.match(/[#&]a=([A-Za-z0-9_-]{5})/);
      const aToken=prot?protectedSuppTokens.a:(aMatch?aMatch[1]:(typeof localStorage!=='undefined'?localStorage.getItem('avd-personality:supp:ecrrs'):null));
      if(aToken&&/^[A-Za-z0-9_-]{5}$/.test(aToken)&&window.OfiEcrrsCodec){
        const answers=window.OfiEcrrsCodec.decode(aToken);
        if(Array.isArray(answers)&&answers.length===9){
          scores.ecrrsScores=window.OfiEcrrsCodec.calculate(answers);
        }
      }
    }catch(err){
      console.warn('Failed to parse ECR-RS token:',err);
    }
    try{
      const vMatch=hash.match(/[#&]v=([A-Za-z0-9_-]{24})/);
      const vToken=prot?protectedSuppTokens.v:(vMatch?vMatch[1]:(typeof localStorage!=='undefined'?localStorage.getItem('avd-personality:supp:via'):null));
      const bankEl=$('data-via-items');
      const bank=bankEl?JSON.parse(bankEl.textContent):window.OfiViaBank;
      if(bank&&window.OfiViaCodec){
        if(vToken&&/^[A-Za-z0-9_-]{24}$/.test(vToken)){
          const answers=window.OfiViaCodec.decode(vToken);
          if(Array.isArray(answers)&&answers.length===60){
            scores.viaStrengths=window.OfiViaCodec.calculate(bank,answers,scores);
          }
        }else if(!scores.viaStrengths&&scores.domains?.N?.facets?.length===6){
          scores.viaStrengths=window.OfiViaCodec.calculate(bank,null,scores);
        }
      }
    }catch(err){
      console.warn('Failed to parse IPIP-VIA-R token:',err);
    }
  }

  function renderHexacoHonesty(scores, targetEl){
    const container=targetEl||$('hexacoHonestyCard');
    if(!container)return;
    checkHexacoDirect(scores);
    const h=scores?.hexacoHonesty;
    if(!h||(h.type!=='direct'&&!showHexacoProxyPreview&&!targetEl)){
      container.hidden=true;
      return;
    }
    container.hidden=false;
    container.replaceChildren();

    const returnBtn=el('button','hexaco-return-top','↑ חזרה לשאלונים הנוספים');
    returnBtn.type='button';
    returnBtn.setAttribute('title','חזרה לרשימת השאלונים הנוספים');
    returnBtn.addEventListener('click',()=>{
      ($('additionalQuizzesSection')||$('homeAdditionalQuizzes'))?.scrollIntoView({behavior:'smooth',block:'start'});
    });

    const head=el('div','hexaco-card-header');
    const badgeRow=el('div','hexaco-badge-row');
    const statusLabel=h.type==='direct'?'מענה ישיר ל־16 היגדים':'אומדן עקיף מתוך ה-Big Five';
    const statusClass=h.type==='direct'?'is-direct':'is-proxy';
    badgeRow.append(
      el('span','hexaco-badge','⚖️ התכונה השישית: כנות וענווה (H)'),
      el('span','hexaco-citation','מודל HEXACO (Lee & Ashton, 2004)'),
      el('span','hexaco-accuracy-pill '+statusClass,statusLabel),
      returnBtn
    );

    const title=el('h2','hexaco-title','כנות וענווה (Honesty-Humility) – התכונה הנוספת של HEXACO');
    const subtitle=el('p','hexaco-subtitle',
      h.type==='direct'
        ?'יושר וצניעות — לפי השאלון הנוסף שמילאת (16 היגדים). שיטת הניקוד כאן מקצרת את השאלון הרשמי ואינה מהווה תחליף מלא.'
        :'מודל HEXACO מוסיף על חמש התכונות המסורתיות ממד של יושרה, ענווה והימנעות מנצלנות. כאן מוצג אומדן עקיף משוקלל מתחומי המשנה של ה-Big Five (הקשר אינו מושלם ונמדד ברמת הערכה בלבד).'
    );

    const notice=el('div','hexaco-science-notice');
    notice.append(
      el('span','hexaco-notice-icon','ℹ️'),
      el('p',null,'רקע מדעי: מודל חמש התכונות (Big Five) אינו מפריד את תכונת הכנות והנצלנות לממד עצמאי. פרופ\' קיבק לי ומייקל אשטון (Lee & Ashton) זיהו ממד שישי נפרד — Honesty-Humility. על פי מטא-אנליזת Thielmann et al. (2020), ניתן לשערך אותו חלקית דרך שילוב לינארי של תחומי משנה רלוונטיים מ־IPIP-NEO (ללא זהות מלאה לשאלון HEXACO רשמי).')
    );
    head.append(badgeRow,title,subtitle,notice);

    // Score display section
    const scoreCard=el('div','hexaco-score-card');
    const scoreHead=el('div','hexaco-score-head');
    const labelWrap=el('div','hexaco-score-label-wrap');
    const hPctDisp=h.type==='direct'?h.percentileEst:h.percentileProxy;
    const hRelDisp=(h.type==='direct'&&typeof h.omega==='number')?(' · מהימנות ω='+h.omega.toFixed(2)):'';
    labelWrap.append(
      el('strong','hexaco-score-main-label',h.type==='direct'?'ציון כנות וענווה מלא (HEXACO-H)':'ציון משוער לתכונת כנות וענווה (Estimated H)'),
      el('small','hexaco-score-sublabel','טווח מהימנות (90% CI): '+h.ci90[0]+' – '+h.ci90[1]+' נקודות'+(hPctDisp!=null?' · אחוזון משוער: ~'+Math.round(hPctDisp):'')+hRelDisp)
    );
    const scoreValWrap=el('div','hexaco-score-value-wrap');
    const valText=el('span','hexaco-score-val',String(h.score));
    valText.append(el('small',null,' מתוך 100'));
    const levelBadge=el('span','hexaco-level-badge is-'+h.level,h.levelLabel);
    scoreValWrap.append(valText,levelBadge);
    scoreHead.append(labelWrap,scoreValWrap);

    const track=el('div','hexaco-meter-track');
    const fill=el('div','hexaco-meter-fill is-'+h.level);
    fill.style.width=Math.max(4,Math.min(100,h.score))+'%';
    track.append(fill);

    const narrativeText=el('p','hexaco-narrative',h.narrative);
    scoreCard.append(scoreHead,track,narrativeText);
    if(h.type==='direct')scoreCard.append(el('p','hexaco-narrative supp-norm-note',SIMULATED_NORM_NOTES.hexaco));

    // Facets / Components Breakdown
    const breakdownSection=el('div','hexaco-facets-section');
    const bdTitle=el('h3','hexaco-facets-title',h.type==='direct'?'פירוט 4 תחומי המשנה הרשמיים של HEXACO:':'הרכב הנוסחה מתוך 30 תחומי המשנה שלך:');
    breakdownSection.append(bdTitle);

    const grid=el('div','hexaco-facets-grid');
    if(h.facets){
      if(h.type==='direct'){
        const facetsList=[
          {key:'sincerity',name:'כנות ואותנטיות (Sincerity)',desc:'שלילת חנופה והעמדת פנים',score:h.facets.sincerity},
          {key:'fairness',name:'הגינות ויושר (Fairness)',desc:'הימנעות מרמאות וניצול הזולת',score:h.facets.fairness},
          {key:'greedAvoidance',name:'הימנעות מחמדנות (Greed Avoidance)',desc:'חוסר עניין בעושר וסמלי סטטוס',score:h.facets.greedAvoidance},
          {key:'modesty',name:'צניעות וענווה (Modesty)',desc:'תחושת שוויון ללא התנשאות',score:h.facets.modesty}
        ];
        for(const f of facetsList){
          const chip=el('div','hexaco-facet-chip');
          const chipHead=el('div','hexaco-facet-chip-head');
          const fp=h.facetPercentiles?.[f.key];
          const valLabel=String(f.score)+' מתוך 100'+(typeof fp==='number'?' · אחוזון ~'+fp:'');
          chipHead.append(el('strong',null,f.name),el('span','hexaco-facet-chip-val',valLabel));
          const fTrack=el('div','hexaco-facet-track');
          const fFill=el('div','hexaco-facet-fill');
          fFill.style.width=Math.max(2,Math.min(100,f.score))+'%';
          fTrack.append(fFill);
          chip.append(chipHead,fTrack,el('p','hexaco-facet-chip-desc',f.desc));
          grid.append(chip);
        }
      }else{
        // Facet names exactly as in the Big Five section of the report.
        const fName=(code,fallback)=>(scores?.domains?.[code[0]]?.facets?.[Number(code[1])-1]?.label||fallback)+' ('+code+')';
        const facetsList=[
          {key:'morality',name:fName('A2','יושרה וגילוי לב'),weight:'רכיב בנוסחה; המקדמים המלאים מפורטים להלן',desc:'הימנעות מהעמדת פנים, כנות ישירה ביחסים',score:h.facets.morality},
          {key:'modesty',name:fName('A5','צניעות וענווה'),weight:'רכיב בנוסחה; המקדמים המלאים מפורטים להלן',desc:'חוסר התנשאות, תחושת שוויון ערך אנושי',score:h.facets.modesty},
          {key:'dutifulness',name:fName('C3','מוסר וחובתיות'),weight:'רכיב בנוסחה; המקדמים המלאים מפורטים להלן',desc:'היצמדות לעקרונות מוסריים ומחויבות אזרחית',score:h.facets.dutifulness}
        ];
        for(const f of facetsList){
          const chip=el('div','hexaco-facet-chip');
          const chipHead=el('div','hexaco-facet-chip-head');
          const titleCol=el('div');
          titleCol.append(el('strong',null,f.name),el('span','hexaco-facet-weight',f.weight));
          const fp=h.facetPercentiles?.[f.key];
          const valLabel=String(f.score)+' מתוך 100'+(typeof fp==='number'?' · אחוזון '+fp:'');
          chipHead.append(titleCol,el('span','hexaco-facet-chip-val',valLabel));
          const fTrack=el('div','hexaco-facet-track');
          const fFill=el('div','hexaco-facet-fill');
          fFill.style.width=Math.max(2,Math.min(100,f.score))+'%';
          fTrack.append(fFill);
          chip.append(chipHead,fTrack,el('p','hexaco-facet-chip-desc',f.desc));
          grid.append(chip);
        }
      }
    }
    breakdownSection.append(grid);

    if(h.type==='proxy'){
      const pw=h.proxyWeights||{};
      const fmtCoef=(k,v)=>`${scores?.domains?.[k[0]]?.facets?.[Number(k[1])-1]?.label||k} ${k} (${v>=0?'+':'−'}${Math.abs(Number(v)).toFixed(2)})`;
      const weightText=Object.keys(pw).length
        ?Object.entries(pw).map(([k,v])=>fmtCoef(k,v)).join(', ')
        :'A2, A5, A4, C3, E5, N2, E3';
      const rApprox=typeof h.accuracy==='number'?(' · מתאם מוערך בקבוצת המדגם r≈'+h.accuracy.toFixed(2)):'';
      const formulaFoot=el('div','hexaco-formula-footnote');
      formulaFoot.append(
        el('span','formula-code','רגרסיית Z מכוילת: '+weightText),
        el('span','formula-meta','· אומדן עקיף מתוך ה-Big Five (Thielmann et al., 2020/2022'+rApprox+')')
      );
      breakdownSection.append(formulaFoot);
    }

    // Call-To-Action Box
    const ctaBox=el('div','hexaco-cta-box'+(h.type==='direct'?' is-completed':''));
    if(h.type==='direct'){
      const ctaLead=el('div','hexaco-cta-lead');
      ctaLead.append(
        el('span','hexaco-cta-icon','✅'),
        el('strong','hexaco-cta-title','מענה ישיר ל־16 היגדים הושלם'),
        el('p','hexaco-cta-desc','הציון בדוח זה מבוסס על מענה ישיר לשאלון הקצר (16 היגדים) ואינו מחליף אבחון מלא. התוצאה מוטמעת בקישור התוצאות שלך.')
      );
      const retakeBtn=el('button','hexaco-retake-btn','עריכת מענה (16 שאלות) ↺');
      retakeBtn.type='button';
      retakeBtn.addEventListener('click',()=>{
        window.dispatchEvent(new CustomEvent('ofilab:open-hexaco-quiz'));
      });
      ctaBox.append(ctaLead,retakeBtn);
    }else{
      const ctaLead=el('div','hexaco-cta-lead');
      ctaLead.append(
        el('span','hexaco-cta-icon','🎯'),
        el('strong','hexaco-cta-title','להערכת HEXACO ישירה יותר: שאלון קצר של 16 היגדים'),
        el('p','hexaco-cta-desc','מענה קצר של כ-2 דקות על 16 היגדים ממוקדים יחליף את האומדן העקיף מתוך ה-Big Five בהערכה ישירה יותר (כ־16 היגדים במקום אבחון HEXACO-100 מלא) ויוסיף אותו לקישור השיתוף שלך.')
      );
      const ctaBtn=el('button','hexaco-cta-btn','התחל מיקרו-שאלון H (16 שאלות) ⏱️ 2 דק\'');
      ctaBtn.type='button';
      ctaBtn.id='openHexacoQuizBtn';
      ctaBtn.addEventListener('click',()=>{
        window.dispatchEvent(new CustomEvent('ofilab:open-hexaco-quiz'));
      });
      ctaBox.append(ctaLead,ctaBtn);
    }

    container.append(head,scoreCard,breakdownSection,ctaBox);
  }

  const HEXACO_FACET_NAMES = {
    sincerity: 'כנות ואותנטיות',
    fairness: 'הגינות ויושר',
    greedAvoidance: 'הימנעות מחמדנות',
    modesty: 'צניעות וענווה'
  };

  let hexacoBank = null;
  let hexacoAnswers = new Array(16).fill(0);
  let hexacoCursor = 0;

  function loadHexacoBank(){
    if(hexacoBank) return hexacoBank;
    const el = $('data-hexaco-items');
    if(el){
      try {
        hexacoBank = JSON.parse(el.textContent);
        return hexacoBank;
      } catch(e){}
    }
    return null;
  }

  let viaBank = null;
  let viaAnswers = new Array(60).fill(0);
  let viaCursor = 0;

  let ecrrsBank = null;
  let ecrrsAnswers = new Array(9).fill(0);
  let ecrrsCursor = 0;

  function loadViaBank(){
    if(viaBank) return viaBank;
    const elBank = $('data-via-items');
    if(elBank && elBank.textContent){
      try {
        viaBank = JSON.parse(elBank.textContent);
        return viaBank;
      } catch(e){}
    }
    return window.OfiViaBank || null;
  }

  function loadEcrrsBank(){
    if(ecrrsBank) return ecrrsBank;
    const elBank = $('data-ecrrs-items');
    if(elBank && elBank.textContent){
      try {
        ecrrsBank = JSON.parse(elBank.textContent);
        return ecrrsBank;
      } catch(e){}
    }
    return window.OfiEcrrsBank || null;
  }

  function setSuppHashParam(paramKey, regexPattern, token){
    protectedSuppTokens[paramKey] = token;
    if(isSuppProtected()){
      try {
        if(typeof localStorage !== 'undefined'){
          const storageKey = paramKey === 'h' ? 'avd-personality:supp:hexaco' : paramKey === 'v' ? 'avd-personality:supp:via' : 'avd-personality:supp:ecrrs';
          localStorage.removeItem(storageKey);
        }
      } catch(e){}
      if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
        window.dispatchEvent(new CustomEvent('ofilab:supp-updated', { detail: { key: paramKey, token } }));
      }
      return;
    }
    try {
      if(typeof localStorage !== 'undefined'){
        const storageKey = paramKey === 'h' ? 'avd-personality:supp:hexaco' : paramKey === 'v' ? 'avd-personality:supp:via' : 'avd-personality:supp:ecrrs';
        localStorage.setItem(storageKey, token);
      }
    } catch(e){}
    const currentHash = window.location.hash || '';
    let newHash = '';
    const re = new RegExp('([#&])' + paramKey + '=' + regexPattern);
    if(re.test(currentHash)){
      newHash = currentHash.replace(re, '$1' + paramKey + '=' + token);
    } else if(currentHash.length > 1){
      newHash = currentHash + '&' + paramKey + '=' + token;
    } else {
      newHash = '#' + paramKey + '=' + token;
    }
    history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
  }

  window.renderViaStrengths = function renderViaStrengths(scores, targetEl){
    const container = targetEl || $('viaStrengthsCard');
    if(!container) return;
    if(scores) checkHexacoDirect(scores);
    const v = scores?.viaStrengths;
    if(!v || (v.type === 'proxy' && !showViaProxyPreview && !targetEl)){
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.replaceChildren();

    const returnBtn = el('button', 'cyber-return-top', '↑ חזרה לשאלונים הנוספים');
    returnBtn.type = 'button';
    returnBtn.addEventListener('click', () => {
      ($('additionalQuizzesSection') || $('homeAdditionalQuizzes'))?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });

    const isDirectOrComposite = v.type === 'composite' || v.type === 'direct';
    const accLabel = v.type === 'composite'
      ? 'שילוב Big Five + מענה ישיר (60 היגדים בהשראת IPIP-VIA-R)'
      : v.type === 'direct'
        ? 'מענה ישיר (60 היגדים בהשראת IPIP-VIA-R)'
        : 'רעיונות לחוזקות מתוך חמש התכונות';

    const head = el('div', 'cyber-lab-header');
    const badgeRow = el('div', 'cyber-lab-badge-row');
    badgeRow.append(
      el('span', 'cyber-lab-badge', '🌟 24 חוזקות האופי ו-3 כוחות העל'),
      el('span', 'cyber-lab-citation', 'בהשראת IPIP-VIA-R (Bluemke et al., 2021; McGrath et al., 2020; Partsch et al., 2024)'),
      el('span', 'hexaco-accuracy-pill ' + (isDirectOrComposite ? 'is-direct' : 'is-proxy'), accLabel),
      returnBtn
    );

    const notice = el('div', 'cyber-science-notice');
    notice.append(
      el('span', 'cyber-notice-icon', 'ℹ️'),
      el('p', null, isDirectOrComposite
        ? 'המיפוי משלב את 15 הסולמות הישירים של IPIP-VIA-R (60 שאלות מאוזנות לחוזקות שאינן מכוסות במלואן ב-Big Five, כגון רוחניות, הכרת תודה, הומור, סלחנות והוגנות) יחד עם שקלול פסיכומטרי מ-30 תחומי המשנה של ה-IPIP-NEO.'
        : 'מחקרם של McGrath, Hall-Simmonds, & Goldberg (2020) מראה מתאם חלקי בין 30 תחומי המשנה של IPIP-NEO לבין חוזקות VIA, אך ללא כיסוי ישיר לחוזקות כמו רוחניות, הכרת תודה, סלחנות והומור. להשלמה ישירה מומלץ למלא את שאלון ה-60 שאלות.')
    );

    head.append(
      badgeRow,
      el('h2', 'cyber-lab-title', 'פרופיל חוזקות האופי שלך'),
      el('p', 'cyber-lab-subtitle', isDirectOrComposite
        ? 'חמש חוזקות החתימה המובילות שלך, שלושת כוחות העל (Positivity, Dependability, Mastery) ודירוג מלא של 24 החוזקות.'
        : 'רעיונות לחוזקות מתוך חמש התכונות — לא תוצאות של שאלון VIA. להשלמה ישירה מומלץ למלא את השאלון המלא (60 היגדים).'),
      notice
    );

    const coreSection = el('div', 'cyber-core-section');

    // 1. 3 Core Dimensions (Partsch, Olaru, & Lechner, 2024)
    if(v.coreDimensions){
      const coreBlock = el('div', 'via-core-block');
      coreBlock.append(
        el('h3', 'via-sub-heading', '3 כוחות העל של האופי (3 Core Strength Metatraits)'),
        el('p', 'via-sub-desc', 'חלוקת העל המחקרית העדכנית של IPIP-VIA-R (Partsch, Olaru, & Lechner, 2024):')
      );
      const coreGrid = el('div', 'via-core-grid');
      const coreIcons = {positivity: '☀️', dependability: '🤝', mastery: '🎯'};
      for(const k of ['positivity', 'dependability', 'mastery']){
        const cd = v.coreDimensions[k];
        if(!cd) continue;
        const m = el('div', 'cyber-meter via-core-meter');
        const mHead = el('div', 'cyber-meter-head');
        const mLabel = el('div', 'cyber-meter-label');
        mLabel.append(
          el('span', 'cyber-meter-icon', coreIcons[k] || '✨'),
          el('strong', null, cd.he + ' (' + cd.en + ')')
        );
        const mVal = el('span', 'cyber-meter-value', String(cd.score));
        mVal.append(el('small', null, ' / 100'));
        mHead.append(mLabel, mVal);
        const mTrack = el('div', 'cyber-meter-track');
        const mFill = el('div', 'cyber-meter-fill');
        mFill.style.width = Math.max(4, Math.min(100, cd.score)) + '%';
        mTrack.append(mFill);
        m.append(mHead, mTrack, el('p', 'cyber-meter-hint', cd.desc));
        coreGrid.append(m);
      }
      coreBlock.append(coreGrid);
      coreSection.append(coreBlock);
    }

    coreSection.append(el('p', 'via-sub-desc supp-norm-note', SIMULATED_NORM_NOTES.via));

    // 2. Top 5 Signature Strengths
    if(Array.isArray(v.signatureStrengths) && v.signatureStrengths.length){
      const sigBlock = el('div', 'via-signature-block');
      sigBlock.append(
        el('h3', 'via-sub-heading', '5 חוזקות החתימה המובילות שלך (Signature Strengths)'),
        el('p', 'via-sub-desc', 'חמש החוזקות הבולטות ביותר בפרופיל שלך — מנועי החוזק הטבעיים שמעניקים לך אנרגיה, אותנטיות ומשמעות:')
      );
      const sigGrid = el('div', 'via-signature-grid');
      for(const s of v.signatureStrengths){
        const card = el('article', 'via-sig-card');
        const topRow = el('div', 'via-sig-top');
        const rankBadge = el('span', 'via-rank-badge', '#' + s.rank);
        const virtueTag = el('span', 'via-virtue-tag', 'מעלת ה' + (s.virtueHe || ''));
        const pctTag = typeof s.percentileEst === 'number' ? ' · אחוזון ~' + s.percentileEst : '';
        const scorePill = el('span', 'via-score-pill', s.score + ' / 100' + pctTag);
        topRow.append(rankBadge, virtueTag, scorePill);

        const titleEl = el('h4', 'via-sig-title', s.he + ' (' + s.en + ')');
        const descEl = el('p', 'via-sig-desc', s.desc || '');
        const track = el('div', 'cyber-meter-track');
        const fill = el('div', 'cyber-meter-fill');
        fill.style.width = Math.max(4, Math.min(100, s.score)) + '%';
        track.append(fill);

        card.append(topRow, titleEl, track, descEl);
        sigGrid.append(card);
      }
      sigBlock.append(sigGrid);
      coreSection.append(sigBlock);
    }

    // 3. Full 24 Strengths Breakdown
    if(Array.isArray(v.ranked) && v.ranked.length){
      const allDetails = el('details', 'via-all-details');
      allDetails.open = isDirectOrComposite;
      const allSummary = el('summary', 'via-all-summary', 'פירוט מלא של כל 24 חוזקות האופי (מדורגות מהגבוהה לנמוכה)');
      const allGrid = el('div', 'via-all-grid');
      for(const s of v.ranked){
        const item = el('div', 'via-all-item');
        const itemHead = el('div', 'via-all-item-head');
        const left = el('div', 'via-all-item-title');
        left.append(
          el('span', 'via-all-rank', s.rank + '.'),
          el('strong', null, s.he),
          el('small', null, ' (' + s.en + ' · ' + (s.virtueHe || '') + ')')
        );
        const right = el('span', 'via-all-score', s.score + '/100' + (typeof s.percentileEst === 'number' ? ' · אחוזון ~' + s.percentileEst : ''));
        itemHead.append(left, right);
        const barTrack = el('div', 'hexaco-facet-track');
        const barFill = el('div', 'hexaco-facet-fill');
        barFill.style.width = Math.max(3, Math.min(100, s.score)) + '%';
        barTrack.append(barFill);
        item.append(itemHead, barTrack, el('p', 'hexaco-facet-chip-desc', s.desc || ''));
        allGrid.append(item);
      }
      allDetails.append(allSummary, allGrid);
      coreSection.append(allDetails);
    }

    // 4. CTA / Retake Box
    const ctaBox = el('div', 'hexaco-cta-box' + (isDirectOrComposite ? ' is-completed' : ''));
    const ctaLead = el('div', 'hexaco-cta-lead');
    if(isDirectOrComposite){
      ctaLead.append(
        el('span', 'hexaco-cta-icon', '✅'),
        el('strong', 'hexaco-cta-title', 'שאלון חוזקות האופי (60 שאלות) הושלם!'),
        el('p', 'hexaco-cta-desc', 'התוצאות משוקללות בדוח ושמורות בקישור התוצאות שלך ובמכשיר.')
      );
      const retakeBtn = el('button', 'hexaco-retake-btn', 'עריכת מענה (60 שאלות) ↺');
      retakeBtn.type = 'button';
      retakeBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ofilab:open-via-quiz')));
      ctaBox.append(ctaLead, retakeBtn);
    } else {
      ctaLead.append(
        el('span', 'hexaco-cta-icon', '🌟'),
        el('strong', 'hexaco-cta-title', 'להשלמת מענה ישיר ב-24 החוזקות: שאלון חוזקות אופי (60 היגדים)'),
        el('p', 'hexaco-cta-desc', 'השאלון דוגם את 15 החוזקות שחסרות ב-Big Five ומשלב אותן עם תחומי המשנה של IPIP-NEO (אינו מחליף אבחון VIA מלא רשמי).')
      );
      const ctaBtn = el('button', 'hexaco-cta-btn', 'התחל שאלון חוזקות (60 שאלות · כ-6 דק\')');
      ctaBtn.type = 'button';
      ctaBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ofilab:open-via-quiz')));
      ctaBox.append(ctaLead, ctaBtn);
    }

    container.append(head, coreSection, ctaBox);
  };

  window.renderEcrrsAttachment = function renderEcrrsAttachment(scores, targetEl){
    const container = targetEl || $('ecrrsAttachmentCard');
    if(!container) return;
    if(scores) checkHexacoDirect(scores);
    const ecrrs = scores?.ecrrsScores;
    if(!ecrrs){
      container.hidden = true;
      return;
    }
    container.hidden = false;
    container.replaceChildren();

    const returnBtn = el('button', 'cyber-return-top', '↑ חזרה לשאלונים הנוספים');
    returnBtn.type = 'button';
    returnBtn.addEventListener('click', () => {
      ($('additionalQuizzesSection') || $('homeAdditionalQuizzes'))?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });

    const head = el('div', 'cyber-lab-header');
    const badgeRow = el('div', 'cyber-lab-badge-row');
    badgeRow.append(
      el('span', 'cyber-lab-badge', '🤝 סגנון היקשרות במערכות יחסים'),
      el('span', 'cyber-lab-citation', 'ECR-RS (Fraley et al., 2011)'),
      el('span', 'hexaco-accuracy-pill is-direct', 'מדידה ישירה (9 שאלות)'),
      returnBtn
    );

    const notice = el('div', 'cyber-science-notice');
    notice.append(
      el('span', 'cyber-notice-icon', 'ℹ️'),
      el('p', null, 'שאלון ה-ECR-RS מודד את שני צירי היסוד של תיאוריית ההיקשרות בבגרות: חרדת היקשרות (Attachment Anxiety) והימנעות מאינטימיות (Attachment Avoidance). מחקרים מראים כי למעלה מ-60% מהשונות של צירי ההיקשרות אינה מוסברת על ידי תכונות ה-Big Five.')
    );

    head.append(
      badgeRow,
      el('h2', 'cyber-lab-title', 'פרופיל היקשרות בינאישית (ECR-RS)'),
      el('p', 'cyber-lab-subtitle', 'קרבה וביטחון בקשר — לפי התשובות שלך על הקשר שבחרת.'),
      notice
    );

    const coreSection = el('div', 'cyber-core-section');
    const archCard = el('div', 'cyber-archetype-card');
    const archLead = el('div', 'cyber-archetype-lead');
    const secPctNote = typeof ecrrs.securityPct === 'number'
      ? (' · אחוזון משוער ~' + ecrrs.securityPct + '%')
      : '';
    archLead.append(
      el('span', 'cyber-archetype-tag', 'מדד ביטחון בהיקשרות: ' + ecrrs.security100 + '/100' + secPctNote),
      el('h3', 'cyber-archetype-title', ecrrs.title)
    );
    archCard.append(archLead, el('p', 'cyber-archetype-desc', ecrrs.narrative), el('p', 'cyber-meter-hint supp-norm-note', SIMULATED_NORM_NOTES.ecrrs));

    const dualMeters = el('div', 'cyber-dual-meters');
    const makeEcrrsMeter = (title, rawMean, pct100, normPctVal, semVal, desc, icon) => {
      const m = el('div', 'cyber-meter');
      const mHead = el('div', 'cyber-meter-head');
      const mLabel = el('div', 'cyber-meter-label');
      mLabel.append(el('span', 'cyber-meter-icon', icon), el('strong', null, title));
      const mVal = el('span', 'cyber-meter-value', rawMean.toFixed(2));
      const normPart = typeof normPctVal === 'number' ? (' · אחוזון משוער ~' + normPctVal + '%') : '';
      const semPart = typeof semVal === 'number' ? (' · ±' + semVal.toFixed(2)) : '';
      mVal.append(el('small', null, ' / 7.00 (' + pct100 + '/100' + normPart + semPart + ')'));
      mHead.append(mLabel, mVal);
      const mTrack = el('div', 'cyber-meter-track');
      const mFill = el('div', 'cyber-meter-fill');
      mFill.style.width = Math.max(4, Math.min(100, pct100)) + '%';
      mTrack.append(mFill);
      m.append(mHead, mTrack, el('p', 'cyber-meter-hint', desc));
      return m;
    };

    dualMeters.append(
      makeEcrrsMeter(
        'חרדת היקשרות (Attachment Anxiety)',
        ecrrs.anxiety,
        ecrrs.anxiety100,
        ecrrs.anxietyPct,
        ecrrs.anxietySem,
        'רגישות לדחייה או התרחקות, חשש מנטישה וצורך באישור רגשי וביטחון בקשר (ציון עד 4.0 מעיד על ביטחון רגשי).',
        '💓'
      ),
      makeEcrrsMeter(
        'הימנעות מאינטימיות (Attachment Avoidance)',
        ecrrs.avoidance,
        ecrrs.avoidance100,
        ecrrs.avoidancePct,
        ecrrs.avoidanceSem,
        'מידת אי-הנוחות עם תלות הדדית וחשיפה רגשית, והעדפה להסתמכות עצמית ולשמירה על מרחב אוטונומי (ציון עד 4.0 מעיד על פתיחות לקרבה).',
        '🛡️'
      )
    );

    coreSection.append(archCard, dualMeters);

    const ctaBox = el('div', 'hexaco-cta-box is-completed');
    const ctaLead = el('div', 'hexaco-cta-lead');
    ctaLead.append(
      el('span', 'hexaco-cta-icon', '✅'),
      el('strong', 'hexaco-cta-title', 'שאלון סגנון ההיקשרות (9 שאלות ECR-RS) הושלם!'),
      el('p', 'hexaco-cta-desc', 'ציוני ההיקשרות שמורים בקישור התוצאות שלך ובמכשיר.')
    );
    const retakeBtn = el('button', 'hexaco-retake-btn', 'עריכת מענה (9 שאלות) ↺');
    retakeBtn.type = 'button';
    retakeBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ofilab:open-ecrrs-quiz')));
    ctaBox.append(ctaLead, retakeBtn);

    container.append(head, coreSection, ctaBox);
  };

  const SUPP_DRAFT_KEYS = {
    hexaco: 'avd-personality:draft:hexaco',
    via: 'avd-personality:draft:via',
    ecrrs: 'avd-personality:draft:ecrrs'
  };

  function saveSuppDraft(key, answers, cursor){
    const payload = {
      answers: Array.from(answers),
      cursor: Number(cursor) || 0,
      updatedAt: Date.now()
    };
    memSuppDrafts[key] = payload;
    if(isSuppProtected()) return;
    try {
      localStorage.setItem(SUPP_DRAFT_KEYS[key], JSON.stringify(payload));
    } catch(_){}
  }

  function loadSuppDraft(key, expectedLen, maxScale){
    try {
      let parsed = null;
      if(isSuppProtected()){
        parsed = memSuppDrafts[key];
      } else {
        const raw = localStorage.getItem(SUPP_DRAFT_KEYS[key]);
        if(raw) parsed = JSON.parse(raw);
      }
      if(!parsed || !Array.isArray(parsed.answers) || parsed.answers.length !== expectedLen) return null;
      const validAnswers = parsed.answers.map(v => {
        const n = Number(v);
        return (Number.isInteger(n) && n >= 1 && n <= maxScale) ? n : 0;
      });
      if(!validAnswers.some(v => v > 0)) return null;
      const cursor = Math.max(0, Math.min(expectedLen - 1, Number(parsed.cursor) || 0));
      return {answers: validAnswers, cursor};
    } catch(_){
      return null;
    }
  }

  function clearSuppDraft(key){
    memSuppDrafts[key] = null;
    try {
      localStorage.removeItem(SUPP_DRAFT_KEYS[key]);
    } catch(_){}
  }

  function restoreSuppDraftsIfNeeded(){
    if(hexacoAnswers.every(v => v === 0)){
      const d = loadSuppDraft('hexaco', 16, 5);
      if(d){ hexacoAnswers = d.answers; hexacoCursor = d.cursor; }
    }
    if(viaAnswers.every(v => v === 0)){
      const d = loadSuppDraft('via', 60, 5);
      if(d){ viaAnswers = d.answers; viaCursor = d.cursor; }
    }
    if(ecrrsAnswers.every(v => v === 0)){
      const d = loadSuppDraft('ecrrs', 9, 7);
      if(d){ ecrrsAnswers = d.answers; ecrrsCursor = d.cursor; }
    }
  }

  function updateSuppMilestonesAndEta(milestonesId, etaId, answeredCount, totalCount, secPerQuestion){
    const msWrap = $(milestonesId);
    if(msWrap){
      const pct = (answeredCount / totalCount) * 100;
      const dots = msWrap.querySelectorAll('.ms-dot');
      const thresholds = [0, 25, 50, 75, 100];
      dots.forEach((dot, idx) => {
        const thresh = thresholds[idx] ?? 0;
        const nextThresh = thresholds[idx + 1] ?? 101;
        const isDone = pct >= nextThresh || (idx === 4 && answeredCount === totalCount);
        const isActive = !isDone && pct >= thresh;
        dot.classList.toggle('is-done', isDone);
        dot.classList.toggle('is-active', isActive);
      });
    }
    const etaEl = $(etaId);
    if(etaEl){
      const remaining = Math.max(0, totalCount - answeredCount);
      if(remaining === 0){
        etaEl.textContent = 'כל השאלות נענו ✓';
      } else {
        const mins = Math.max(1, Math.ceil((remaining * secPerQuestion) / 60));
        etaEl.textContent = mins === 1 ? 'עוד כדקה לסיום' : `עוד כ־${mins} דק׳ לסיום`;
      }
    }
  }

  function openSuppHelp(title, meaning, tip, statement){
    const panel = $('questionHelpPanel');
    if(!panel) return;
    const titleEl = $('questionHelpTitle') || panel.querySelector('h2, h3');
    if(titleEl) titleEl.textContent = title;
    const stmtEl = $('questionHelpStatement');
    if(stmtEl){
      stmtEl.textContent = statement || '';
      stmtEl.hidden = !statement;
    }
    const textEl = $('questionHelpText') || $('questionHelpMeaning');
    if(textEl) textEl.textContent = meaning;
    const noteEl = panel.querySelector('.mindful-help-note') || $('questionHelpTip');
    if(noteEl) noteEl.textContent = tip;
    if(typeof panel.showModal === 'function'){
      if(!panel.open) panel.showModal();
    } else {
      panel.setAttribute('open', '');
    }
  }

  window.renderAdditionalQuizzesHub = function renderAdditionalQuizzesHub(scores){
    const activeScores = scores || ns.profile || {domains: {}};
    checkHexacoDirect(activeScores);
    restoreSuppDraftsIfNeeded();

    const hasFacets = Boolean(activeScores?.domains?.N?.facets?.length === 6);
    const viaData = activeScores?.viaStrengths;
    const viaDirect = viaData && (viaData.type === 'composite' || viaData.type === 'direct');
    const ecrrsData = activeScores?.ecrrsScores;
    const ecrrsDirect = Boolean(ecrrsData && ecrrsData.type === 'direct');
    const hexacoData = activeScores?.hexacoHonesty;
    const hexacoDirect = Boolean(hexacoData && hexacoData.type === 'direct');

    const viaDraftCount = !viaDirect ? viaAnswers.filter(v => v > 0).length : 0;
    const ecrrsDraftCount = !ecrrsDirect ? ecrrsAnswers.filter(v => v > 0).length : 0;
    const hexacoDraftCount = !hexacoDirect ? hexacoAnswers.filter(v => v > 0).length : 0;

    function buildHubCards(isHome){
      const frag = document.createDocumentFragment();

      // Card 1: IPIP-VIA-R (60 items)
      const viaCard = el('article', 'supp-quiz-card' + (viaDirect ? ' is-completed' : ' is-recommended'));
      const viaTop = el('div', 'supp-card-top');
      viaTop.append(
        el('span', 'supp-card-badge is-star', '🌟 מומלץ · שילוב Big Five + 60 היגדים'),
        el('span', 'supp-card-meta', '60 שאלות · כ־6 דק׳')
      );
      const viaTitle = el('h3', 'supp-card-title', 'חוזקות אופי ו-3 כוחות העל (IPIP-VIA-R)');
      const viaDesc = el('p', 'supp-card-desc', 'רעיונות ל־5 חוזקות החתימה, 24 חוזקות האופי ו-3 כוחות העל (Positivity, Dependability, Mastery), המשלבים מענה ישיר על 60 היגדים עם תחומי המשנה של ה-Big Five.');
      const viaStatus = el('div', 'supp-card-status');
      if(viaDirect){
        const top3 = (viaData.signatureStrengths || []).slice(0, 3).map(s => s.he).join(' · ');
        viaStatus.append(
          el('span', 'supp-status-pill is-done', '✓ הושלם'),
          el('span', 'supp-status-text', top3 ? 'חוזקות מובילות: ' + top3 : 'מיפוי חוזקות מלא חושב')
        );
      } else if(viaDraftCount > 0){
        viaStatus.append(
          el('span', 'supp-status-pill is-pending', `בתהליך (${viaDraftCount}/60 נענו)`),
          el('span', 'supp-status-text', 'ההתקדמות שלך נשמרה אוטומטית — אפשר להמשיך מאותה נקודה')
        );
      } else {
        viaStatus.append(
          el('span', 'supp-status-pill is-pending', hasFacets ? 'רעיונות מה-Big Five זמינים' : 'טרם מולא'),
          el('span', 'supp-status-text', 'מומלץ להשלמת תמונת החוזקות המלאה')
        );
      }
      const viaActions = el('div', 'supp-card-actions');
      const viaBtnLabel = viaDirect
        ? 'עריכת שאלון חוזקות (60 שאלות) ↺'
        : (viaDraftCount > 0 ? `המשך שאלון חוזקות (שאלה ${viaDraftCount + 1} מתוך 60) ←` : 'מילוי שאלון חוזקות (60 שאלות)');
      const viaStartBtn = el('button', viaDirect ? 'secondary supp-btn' : 'primary supp-btn', viaBtnLabel);
      viaStartBtn.type = 'button';
      viaStartBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ofilab:open-via-quiz')));
      viaActions.append(viaStartBtn);

      if(viaDirect && !isHome){
        const viewBtn = el('button', 'secondary supp-btn-ghost', 'צפייה במפת החוזקות ↓');
        viewBtn.type = 'button';
        viewBtn.addEventListener('click', () => $('viaStrengthsCard')?.scrollIntoView({behavior: 'smooth', block: 'start'}));
        viaActions.append(viewBtn);
      } else if(!viaDirect && hasFacets && !isHome){
        const previewBtn = el('button', 'secondary supp-btn-ghost', showViaProxyPreview ? 'הסתר אומדן עקיף מה-Big Five' : 'הצג אומדן עקיף מה-Big Five');
        previewBtn.type = 'button';
        previewBtn.addEventListener('click', () => {
          showViaProxyPreview = !showViaProxyPreview;
          renderAdditionalQuizzesHub(activeScores);
          if(showViaProxyPreview) $('viaStrengthsCard')?.scrollIntoView({behavior: 'smooth', block: 'start'});
        });
        viaActions.append(previewBtn);
      }
      viaCard.append(viaTop, viaTitle, viaDesc, viaStatus, viaActions);

      // Card 2: ECR-RS (9 items)
      const ecrrsCard = el('article', 'supp-quiz-card' + (ecrrsDirect ? ' is-completed' : ''));
      const ecrrsTop = el('div', 'supp-card-top');
      ecrrsTop.append(
        el('span', 'supp-card-badge', '🤝 יחסים וזוגיות · שאלון קצר'),
        el('span', 'supp-card-meta', '9 שאלות · כדקה אחת')
      );
      const ecrrsTitle = el('h3', 'supp-card-title', 'סגנון היקשרות במערכות יחסים (ECR-RS)');
      const ecrrsDesc = el('p', 'supp-card-desc', 'מודד את שני צירי ההיקשרות הבוגרים בקשרים קרובים (חרדת נטישה והימנעות מאינטימיות — Fraley et al., 2011), שמחקרים מראים כי רוב השונות שלהם אינה מוסברת על ידי ה-Big Five.');
      const ecrrsStatus = el('div', 'supp-card-status');
      if(ecrrsDirect){
        ecrrsStatus.append(
          el('span', 'supp-status-pill is-done', '✓ הושלם'),
          el('span', 'supp-status-text', ecrrsData.title + ' (ביטחון: ' + ecrrsData.security100 + '/100)')
        );
      } else if(ecrrsDraftCount > 0){
        ecrrsStatus.append(
          el('span', 'supp-status-pill is-pending', `בתהליך (${ecrrsDraftCount}/9 נענו)`),
          el('span', 'supp-status-text', 'ההתקדמות שלך נשמרה אוטומטית — אפשר להמשיך מאותה נקודה')
        );
      } else {
        ecrrsStatus.append(
          el('span', 'supp-status-pill is-pending', 'טרם מולא'),
          el('span', 'supp-status-text', 'מומלץ להבנת דפוסי זוגיות וקרבה')
        );
      }
      const ecrrsActions = el('div', 'supp-card-actions');
      const ecrrsBtnLabel = ecrrsDirect
        ? 'עריכת שאלון היקשרות (9 שאלות) ↺'
        : (ecrrsDraftCount > 0 ? `המשך שאלון היקשרות (שאלה ${ecrrsDraftCount + 1} מתוך 9) ←` : 'מילוי שאלון היקשרות (9 שאלות)');
      const ecrrsStartBtn = el('button', ecrrsDirect ? 'secondary supp-btn' : 'primary supp-btn', ecrrsBtnLabel);
      ecrrsStartBtn.type = 'button';
      ecrrsStartBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ofilab:open-ecrrs-quiz')));
      ecrrsActions.append(ecrrsStartBtn);
      if(ecrrsDirect && !isHome){
        const viewBtn = el('button', 'secondary supp-btn-ghost', 'צפייה בפרופיל ההיקשרות ↓');
        viewBtn.type = 'button';
        viewBtn.addEventListener('click', () => $('ecrrsAttachmentCard')?.scrollIntoView({behavior: 'smooth', block: 'start'}));
        ecrrsActions.append(viewBtn);
      } else if(!ecrrsDirect && hasFacets && !isHome){
        const ipcBtn = el('button', 'secondary supp-btn-ghost', 'צפייה במצפן הבינאישי מה-Big Five ↓');
        ipcBtn.type = 'button';
        ipcBtn.addEventListener('click', () => {
          const ipc = $('interpersonalCircumplexCard');
          if(ipc){
            ipc.scrollIntoView({behavior: 'smooth', block: 'start'});
            ipc.classList.add('highlight-pulse');
            setTimeout(() => ipc.classList.remove('highlight-pulse'), 2000);
          }
        });
        ecrrsActions.append(ipcBtn);
      }
      ecrrsCard.append(ecrrsTop, ecrrsTitle, ecrrsDesc, ecrrsStatus, ecrrsActions);

      // Card 3: HEXACO-H (16 items)
      const hexCard = el('article', 'supp-quiz-card' + (hexacoDirect ? ' is-completed' : ''));
      const hexTop = el('div', 'supp-card-top');
      hexTop.append(
        el('span', 'supp-card-badge', '⚖️ התכונה השישית · 16 היגדים ישירים'),
        el('span', 'supp-card-meta', '16 שאלות · כ־2 דק׳')
      );
      const hexTitle = el('h3', 'supp-card-title', 'כנות וענווה — התכונה השישית (HEXACO-H)');
      const hexDesc = el('p', 'supp-card-desc', 'מודל HEXACO (Lee & Ashton, 2004) מוסיף על חמש התכונות ממד שישי עצמאי של כנות, הגינות, צניעות והימנעות מחמדנות ומניפולציה.');
      const hexStatus = el('div', 'supp-card-status');
      if(hexacoDirect){
        hexStatus.append(
          el('span', 'supp-status-pill is-done', '✓ הושלם'),
          el('span', 'supp-status-text', 'ציון כנות וענווה: ' + hexacoData.score + '/100 (' + hexacoData.levelLabel + ')')
        );
      } else if(hexacoDraftCount > 0){
        hexStatus.append(
          el('span', 'supp-status-pill is-pending', `בתהליך (${hexacoDraftCount}/16 נענו)`),
          el('span', 'supp-status-text', 'ההתקדמות שלך נשמרה אוטומטית — אפשר להמשיך מאותה נקודה')
        );
      } else {
        hexStatus.append(
          el('span', 'supp-status-pill is-pending', hasFacets ? 'אומדן עקיף מה-Big Five זמין' : 'טרם מולא'),
          el('span', 'supp-status-text', 'מומלץ להשלמת הממד המוסרי והאותנטי')
        );
      }
      const hexActions = el('div', 'supp-card-actions');
      const hexBtnLabel = hexacoDirect
        ? 'עריכת שאלון HEXACO-H (16 שאלות) ↺'
        : (hexacoDraftCount > 0 ? `המשך שאלון כנות וענווה (שאלה ${hexacoDraftCount + 1} מתוך 16) ←` : 'מילוי שאלון כנות וענווה (16 שאלות)');
      const hexStartBtn = el('button', hexacoDirect ? 'secondary supp-btn' : 'primary supp-btn', hexBtnLabel);
      hexStartBtn.type = 'button';
      hexStartBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('ofilab:open-hexaco-quiz')));
      hexActions.append(hexStartBtn);
      if(hexacoDirect && !isHome){
        const viewBtn = el('button', 'secondary supp-btn-ghost', 'צפייה בפירוט HEXACO-H ↓');
        viewBtn.type = 'button';
        viewBtn.addEventListener('click', () => $('hexacoHonestyCard')?.scrollIntoView({behavior: 'smooth', block: 'start'}));
        hexActions.append(viewBtn);
      } else if(!hexacoDirect && hasFacets && !isHome){
        const previewBtn = el('button', 'secondary supp-btn-ghost', showHexacoProxyPreview ? 'הסתר אומדן עקיף מה-Big Five' : 'הצג אומדן עקיף מה-Big Five');
        previewBtn.type = 'button';
        previewBtn.addEventListener('click', () => {
          showHexacoProxyPreview = !showHexacoProxyPreview;
          renderAdditionalQuizzesHub(activeScores);
          if(showHexacoProxyPreview) $('hexacoHonestyCard')?.scrollIntoView({behavior: 'smooth', block: 'start'});
        });
        hexActions.append(previewBtn);
      }
      hexCard.append(hexTop, hexTitle, hexDesc, hexStatus, hexActions);

      frag.append(viaCard, ecrrsCard, hexCard);
      return frag;
    }

    // Render into Results Report bottom section
    const reportHub = $('additionalQuizzesHub');
    if(reportHub){
      reportHub.replaceChildren(buildHubCards(false));
    }
    window.renderViaStrengths(activeScores);
    window.renderEcrrsAttachment(activeScores);
    renderHexacoHonesty(activeScores);
    if(reportHub&&activeScores&&activeScores.domains?.N?.facets?.length===6&&typeof window.renderEstimatedType==='function'){
      window.renderEstimatedType(activeScores);
    }

    // Render into Home Page section
    const homeHub = $('homeAdditionalHubMount');
    if(homeHub){
      homeHub.replaceChildren(buildHubCards(true));
    }
    const homeResults = $('homeAdditionalResultsMount');
    if(homeResults){
      homeResults.replaceChildren();
      if(viaDirect){
        const viaHomeSec = el('section', 'via-strengths-card');
        window.renderViaStrengths(activeScores, viaHomeSec);
        homeResults.append(viaHomeSec);
      }
      if(ecrrsDirect){
        const ecrrsHomeSec = el('section', 'ecrrs-attachment-card');
        window.renderEcrrsAttachment(activeScores, ecrrsHomeSec);
        homeResults.append(ecrrsHomeSec);
      }
      if(hexacoDirect){
        const hexHomeSec = el('section', 'hexaco-honesty-card');
        renderHexacoHonesty(activeScores, hexHomeSec);
        homeResults.append(hexHomeSec);
      }
    }
  };

  const SCALE_5_LABELS = {
    1: 'בכלל לא מתאים לי',
    2: 'לא כל כך מתאים לי',
    3: 'באמצע / תלוי בהקשר',
    4: 'די מתאים לי',
    5: 'מתאים לי מאוד'
  };

  const SCALE_7_LABELS = {
    1: 'לא מסכים/ה בכלל',
    2: 'לא מסכים/ה במידה רבה',
    3: 'נוטה שלא להסכים',
    4: 'ניטרלי/ת · באמצע',
    5: 'נוטה להסכים',
    6: 'מסכים/ה במידה רבה',
    7: 'מסכים/ה לחלוטין'
  };

  function initHexacoDialog(){
    const dialog = $('hexacoDialog');
    if(!dialog) return;

    function renderQuestion(){
      const bank = loadHexacoBank();
      if(!bank || !bank.items) return;
      const item = bank.items[hexacoCursor];
      if(!item) return;

      const answeredCount = hexacoAnswers.filter(v => v > 0).length;
      const stepEl = $('hexacoStepCount');
      if(stepEl) stepEl.textContent = 'שאלה ' + (hexacoCursor + 1) + ' מתוך 16';
      const cardCounterEl = $('hexacoCardCounter');
      if(cardCounterEl) cardCounterEl.textContent = 'שאלה ' + (hexacoCursor + 1);
      const pillEl = $('hexacoFacetPill');
      if(pillEl) pillEl.textContent = HEXACO_FACET_NAMES[item.facet] || '';
      const fillEl = $('hexacoStepperFill');
      if(fillEl) fillEl.style.width = (((hexacoCursor + 1) / 16) * 100) + '%';
      const textEl = $('hexacoQuestionText');
      if(textEl) textEl.textContent = item.text;

      updateSuppMilestonesAndEta('hexacoMilestones', 'hexacoEtaBadge', answeredCount, 16, 6);

      const currentVal = hexacoAnswers[hexacoCursor];
      dialog.querySelectorAll('.hexaco-scale-btn').forEach(btn => {
        const val = Number(btn.dataset.value);
        const isSel = val === currentVal;
        btn.classList.toggle('is-selected', isSel);
        btn.setAttribute('aria-checked', String(isSel));
      });

      const fbEl = $('hexacoChoiceFeedback');
      if(fbEl){
        fbEl.textContent = currentVal
          ? `נבחרה תשובה: ${SCALE_5_LABELS[currentVal] || currentVal} · ההתקדמות נשמרה`
          : 'טיפ: אפשר לבחור עם מקשי 1–5 או לנווט עם חצי המקלדת.';
      }

      const prevBtn = $('hexacoPrevBtn');
      if(prevBtn) prevBtn.disabled = hexacoCursor === 0;
      const nextBtn = $('hexacoNextBtn');
      if(nextBtn) nextBtn.textContent = hexacoCursor === 15 ? 'סיום וחישוב ציון ✓' : 'ממשיכים ←';
    }

    function selectAnswer(val){
      clearTimeout(hexacoAdvanceTimer);
      hexacoAnswers[hexacoCursor] = val;
      const nextCursor = hexacoCursor < 15 ? hexacoCursor + 1 : hexacoCursor;
      saveSuppDraft('hexaco', hexacoAnswers, nextCursor);
      renderQuestion();

      if(hexacoCursor < 15){
        hexacoAdvanceTimer = setTimeout(() => {
          hexacoCursor++;
          renderQuestion();
        }, 220);
      } else {
        hexacoAdvanceTimer = setTimeout(() => {
          finishQuiz();
        }, 220);
      }
    }

    function finishQuiz(){
      clearTimeout(hexacoAdvanceTimer);
      const missingIdx = hexacoAnswers.findIndex(v => !v);
      if(missingIdx >= 0){
        hexacoCursor = missingIdx;
        renderQuestion();
        const fbEl = $('hexacoChoiceFeedback');
        if(fbEl) fbEl.textContent = `נותרה שאלה ${missingIdx + 1} ללא מענה — בחר/י תשובה (1–5) או לחץ/י על "דלג" להשלמה.`;
        return;
      }
      const bank = loadHexacoBank();
      if(!bank || !window.OfiHexacoCodec) return;

      clearSuppDraft('hexaco');
      const result = window.OfiHexacoCodec.calculate(bank, hexacoAnswers);
      const token = window.OfiHexacoCodec.encode(hexacoAnswers);
      setSuppHashParam('h', '[A-Za-z0-9_-]{7}', token);

      if(ns.profile){
        ns.profile.hexacoHonesty = result;
        renderProfileSummary(ns.profile);
      }
      window.renderAdditionalQuizzesHub(ns.profile);

      $('hexacoQuizBody').hidden = true;
      const comp = $('hexacoQuizComplete');
      if(comp) comp.hidden = false;

      const preview = $('hexacoCompletePreview');
      if(preview){
        preview.replaceChildren();
        const pScore = el('div', 'preview-score-bubble');
        pScore.append(
          el('span', 'bubble-val', String(result.score)),
          el('span', 'bubble-label', 'ציון כנות וענווה מלא (' + result.levelLabel + ')')
        );
        const pNotice = el('p', 'preview-note', result.narrative);
        preview.append(pScore, pNotice);
      }
    }

    function openDialog(){
      const bank = loadHexacoBank();
      if(!bank) return;

      if(ns.profile?.hexacoHonesty?.type === 'direct' && Array.isArray(ns.profile.hexacoHonesty.answers)){
        hexacoAnswers = [...ns.profile.hexacoHonesty.answers];
      } else {
        const draft = loadSuppDraft('hexaco', 16, 5);
        if(draft){
          hexacoAnswers = draft.answers;
          hexacoCursor = draft.cursor;
        } else if(hexacoAnswers.every(v => v === 0)){
          hexacoAnswers.fill(0);
        }
      }

      const firstUnanswered = hexacoAnswers.findIndex(v => v === 0);
      hexacoCursor = firstUnanswered >= 0 ? firstUnanswered : 0;

      $('hexacoQuizBody').hidden = false;
      const comp = $('hexacoQuizComplete');
      if(comp) comp.hidden = true;

      renderQuestion();
      if(typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeDialog(){
      clearAllQuizTimers();
      if(typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      window.renderAdditionalQuizzesHub(ns.profile);
    }

    window.addEventListener('ofilab:open-hexaco-quiz', openDialog);
    $('closeHexacoDialogBtn')?.addEventListener('click', closeDialog);
    $('hexacoHelpBtn')?.addEventListener('click', () => {
      clearAllQuizTimers(); // a pending auto-advance must not move the quiz behind an open help/AI panel
      const bank = loadHexacoBank();
      const item = bank?.items?.[hexacoCursor];
      const facetTitle = (item && HEXACO_FACET_NAMES[item.facet]) || 'כנות וענווה (HEXACO-H)';
      openSuppHelp(
        'איך לקרוא את ההיגד הזה?',
        `היגד זה בודק את תת־הממד "${facetTitle}" מתוך התכונה השישית במודל HEXACO. חשוב על האופן שבו היית נוהג/ת בפועל ביומיום — גם כשאף אחד לא בודק או מעניק תגמול חיצוני.`,
        'אין כאן תשובה "מוסרית נכונה": אם ההתנהגות מתארת אותך רק בחלק מהמקרים או תלויה בנסיבות, בחר/י ב־3 (באמצע).',
        item?.text || ''
      );
    });
    $('askAiHexaco')?.addEventListener('click', () => {
      clearAllQuizTimers(); // a pending auto-advance must not move the quiz behind an open help/AI panel
      window.dispatchEvent(new CustomEvent('ofilab:open-ai-question'));
    });
    $('hexacoFinishBtn')?.addEventListener('click', () => {
      closeDialog();
      const target = document.documentElement.dataset.stage === 'results' ? $('hexacoHonestyCard') : $('homeAdditionalResultsMount');
      target?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
    $('hexacoPrevBtn')?.addEventListener('click', () => {
      clearTimeout(hexacoAdvanceTimer);
      if(hexacoCursor > 0){
        hexacoCursor--;
        saveSuppDraft('hexaco', hexacoAnswers, hexacoCursor);
        renderQuestion();
      }
    });
    $('hexacoSkipBtn')?.addEventListener('click', () => selectAnswer(3));
    $('hexacoNextBtn')?.addEventListener('click', () => {
      clearTimeout(hexacoAdvanceTimer);
      if(!hexacoAnswers[hexacoCursor]){
        const fbEl = $('hexacoChoiceFeedback');
        if(fbEl) fbEl.textContent = 'בחר/י תשובה (1–5) או לחץ/י על "דלג (3 · ניטרלי)" כדי להמשיך.';
        return;
      }
      if(hexacoCursor < 15){
        hexacoCursor++;
        saveSuppDraft('hexaco', hexacoAnswers, hexacoCursor);
        renderQuestion();
      } else {
        finishQuiz();
      }
    });

    dialog.querySelectorAll('.hexaco-scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.dataset.value);
        if(val >= 1 && val <= 5) selectAnswer(val);
      });
    });

    dialog.addEventListener('keydown', event => {
      if($('hexacoQuizBody')?.hidden) return;
      if($('questionHelpPanel')?.open || $('aiDialog')?.open) return;
      if(event.key >= '1' && event.key <= '5'){
        event.preventDefault();
        selectAnswer(Number(event.key));
      } else if(event.key === 'ArrowRight' && hexacoCursor > 0){
        event.preventDefault();
        $('hexacoPrevBtn')?.click();
      } else if(event.key === 'ArrowLeft'){
        event.preventDefault();
        $('hexacoNextBtn')?.click();
      }
    });

    dialog.addEventListener('click', event => {
      if(event.target === dialog) closeDialog();
    });
    // Escape and other native closes skip closeDialog(); never let a pending auto-advance fire afterwards.
    dialog.addEventListener('close', clearAllQuizTimers);
  }

  function initViaDialog(){
    const dialog = $('viaDialog');
    if(!dialog) return;

    function renderQuestion(){
      const bank = loadViaBank();
      if(!bank || !bank.items) return;
      const item = bank.items[viaCursor];
      if(!item) return;

      const answeredCount = viaAnswers.filter(v => v > 0).length;
      const stepEl = $('viaStepCount');
      if(stepEl) stepEl.textContent = 'שאלה ' + (viaCursor + 1) + ' מתוך 60';
      const cardCounterEl = $('viaCardCounter');
      if(cardCounterEl) cardCounterEl.textContent = 'שאלה ' + (viaCursor + 1);
      const pillEl = $('viaFacetPill');
      const sMeta = bank.strengths && bank.strengths[item.strength];
      if(pillEl) pillEl.textContent = sMeta ? sMeta.he + ' (' + sMeta.en + ')' : 'חוזקת אופי';
      const fillEl = $('viaStepperFill');
      if(fillEl) fillEl.style.width = (((viaCursor + 1) / 60) * 100) + '%';
      const textEl = $('viaQuestionText');
      if(textEl) textEl.textContent = item.text;

      updateSuppMilestonesAndEta('viaMilestones', 'viaEtaBadge', answeredCount, 60, 6);

      const currentVal = viaAnswers[viaCursor];
      dialog.querySelectorAll('.via-scale-btn').forEach(btn => {
        const val = Number(btn.dataset.value);
        const isSel = val === currentVal;
        btn.classList.toggle('is-selected', isSel);
        btn.setAttribute('aria-checked', String(isSel));
      });

      const fbEl = $('viaChoiceFeedback');
      if(fbEl){
        fbEl.textContent = currentVal
          ? `נבחרה תשובה: ${SCALE_5_LABELS[currentVal] || currentVal} · ההתקדמות נשמרה`
          : 'טיפ: אפשר לבחור עם מקשי 1–5 או לנווט עם חצי המקלדת.';
      }

      const prevBtn = $('viaPrevBtn');
      if(prevBtn) prevBtn.disabled = viaCursor === 0;
      const nextBtn = $('viaNextBtn');
      if(nextBtn) nextBtn.textContent = viaCursor === 59 ? 'סיום וחישוב חוזקות ✓' : 'ממשיכים ←';
    }

    function selectAnswer(val){
      clearTimeout(viaAdvanceTimer);
      viaAnswers[viaCursor] = val;
      const nextCursor = viaCursor < 59 ? viaCursor + 1 : viaCursor;
      saveSuppDraft('via', viaAnswers, nextCursor);
      renderQuestion();

      if(viaCursor < 59){
        viaAdvanceTimer = setTimeout(() => {
          viaCursor++;
          renderQuestion();
        }, 200);
      } else {
        viaAdvanceTimer = setTimeout(() => {
          finishQuiz();
        }, 200);
      }
    }

    function finishQuiz(){
      clearTimeout(viaAdvanceTimer);
      const missingIdx = viaAnswers.findIndex(v => !v);
      if(missingIdx >= 0){
        viaCursor = missingIdx;
        renderQuestion();
        const fbEl = $('viaChoiceFeedback');
        if(fbEl) fbEl.textContent = `נותרה שאלה ${missingIdx + 1} ללא מענה — בחר/י תשובה (1–5) או לחץ/י על "דלג" להשלמה.`;
        return;
      }
      const bank = loadViaBank();
      if(!bank || !window.OfiViaCodec) return;

      clearSuppDraft('via');
      const result = window.OfiViaCodec.calculate(bank, viaAnswers, ns.profile);
      const token = window.OfiViaCodec.encode(viaAnswers);
      setSuppHashParam('v', '[A-Za-z0-9_-]{24}', token);

      if(ns.profile){
        ns.profile.viaStrengths = result;
        renderProfileSummary(ns.profile);
      }
      window.renderAdditionalQuizzesHub(ns.profile);

      $('viaQuizBody').hidden = true;
      const comp = $('viaQuizComplete');
      if(comp) comp.hidden = false;

      const preview = $('viaCompletePreview');
      if(preview && result){
        preview.replaceChildren();
        const topList = (result.signatureStrengths || []).slice(0, 3).map(s => s.he + ' (' + s.score + ')').join(' · ');
        const pScore = el('div', 'preview-score-bubble');
        pScore.append(
          el('span', 'bubble-val', result.signatureStrengths?.[0]?.he || '24 חוזקות'),
          el('span', 'bubble-label', '3 חוזקות החתימה המובילות: ' + topList)
        );
        preview.append(pScore);
      }
    }

    function openDialog(){
      const bank = loadViaBank();
      if(!bank) return;

      if(ns.profile?.viaStrengths?.answers && Array.isArray(ns.profile.viaStrengths.answers)){
        viaAnswers = [...ns.profile.viaStrengths.answers];
      } else {
        const draft = loadSuppDraft('via', 60, 5);
        if(draft){
          viaAnswers = draft.answers;
          viaCursor = draft.cursor;
        } else if(viaAnswers.every(v => v === 0)){
          viaAnswers.fill(0);
        }
      }

      const firstUnanswered = viaAnswers.findIndex(v => v === 0);
      viaCursor = firstUnanswered >= 0 ? firstUnanswered : 0;

      $('viaQuizBody').hidden = false;
      const comp = $('viaQuizComplete');
      if(comp) comp.hidden = true;

      renderQuestion();
      if(typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeDialog(){
      clearAllQuizTimers();
      if(typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      window.renderAdditionalQuizzesHub(ns.profile);
    }

    window.addEventListener('ofilab:open-via-quiz', openDialog);
    $('closeViaDialogBtn')?.addEventListener('click', closeDialog);
    $('viaHelpBtn')?.addEventListener('click', () => {
      clearAllQuizTimers(); // a pending auto-advance must not move the quiz behind an open help/AI panel
      const bank = loadViaBank();
      const item = bank?.items?.[viaCursor];
      const sMeta = item && bank?.strengths?.[item.strength];
      const sLabel = sMeta ? `${sMeta.he} (${sMeta.en})` : 'חוזקת אופי';
      openSuppHelp(
        'איך לקרוא את ההיגד הזה?',
        `היגד זה בודק את החוזקה "${sLabel}" מתוך סיווג 24 חוזקות האופי של IPIP-VIA-R. חוזקת חתימה היא תכונה שמרגישה טבעית, אותנטית ומעניקה לך אנרגיה כשאת/ה מפעיל/ה אותה.`,
        'ענה/י לפי מי שאת/ה בדרך כלל ביומיום, ולא לפי מי שהיית רוצה להיות. אם זה קורה רק לפעמים, בחר/י ב־3.',
        item?.text || ''
      );
    });
    $('askAiVia')?.addEventListener('click', () => {
      clearAllQuizTimers(); // a pending auto-advance must not move the quiz behind an open help/AI panel
      window.dispatchEvent(new CustomEvent('ofilab:open-ai-question'));
    });
    $('viaFinishBtn')?.addEventListener('click', () => {
      closeDialog();
      const target = document.documentElement.dataset.stage === 'results' ? $('viaStrengthsCard') : $('homeAdditionalResultsMount');
      target?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
    $('viaPrevBtn')?.addEventListener('click', () => {
      clearTimeout(viaAdvanceTimer);
      if(viaCursor > 0){
        viaCursor--;
        saveSuppDraft('via', viaAnswers, viaCursor);
        renderQuestion();
      }
    });
    $('viaSkipBtn')?.addEventListener('click', () => selectAnswer(3));
    $('viaNextBtn')?.addEventListener('click', () => {
      clearTimeout(viaAdvanceTimer);
      if(!viaAnswers[viaCursor]){
        const fbEl = $('viaChoiceFeedback');
        if(fbEl) fbEl.textContent = 'בחר/י תשובה (1–5) או לחץ/י על "דלג (3 · ניטרלי)" כדי להמשיך.';
        return;
      }
      if(viaCursor < 59){
        viaCursor++;
        saveSuppDraft('via', viaAnswers, viaCursor);
        renderQuestion();
      } else {
        finishQuiz();
      }
    });

    dialog.querySelectorAll('.via-scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.dataset.value);
        if(val >= 1 && val <= 5) selectAnswer(val);
      });
    });

    dialog.addEventListener('keydown', event => {
      if($('viaQuizBody')?.hidden) return;
      if($('questionHelpPanel')?.open || $('aiDialog')?.open) return;
      if(event.key >= '1' && event.key <= '5'){
        event.preventDefault();
        selectAnswer(Number(event.key));
      } else if(event.key === 'ArrowRight' && viaCursor > 0){
        event.preventDefault();
        $('viaPrevBtn')?.click();
      } else if(event.key === 'ArrowLeft'){
        event.preventDefault();
        $('viaNextBtn')?.click();
      }
    });

    dialog.addEventListener('click', event => {
      if(event.target === dialog) closeDialog();
    });
    // Escape and other native closes skip closeDialog(); never let a pending auto-advance fire afterwards.
    dialog.addEventListener('close', clearAllQuizTimers);
  }

  function initEcrrsDialog(){
    const dialog = $('ecrrsDialog');
    if(!dialog) return;

    function renderQuestion(){
      const bank = loadEcrrsBank();
      if(!bank || !bank.items) return;
      const item = bank.items[ecrrsCursor];
      if(!item) return;

      const answeredCount = ecrrsAnswers.filter(v => v > 0).length;
      const stepEl = $('ecrrsStepCount');
      if(stepEl) stepEl.textContent = 'שאלה ' + (ecrrsCursor + 1) + ' מתוך 9';
      const cardCounterEl = $('ecrrsCardCounter');
      if(cardCounterEl) cardCounterEl.textContent = 'שאלה ' + (ecrrsCursor + 1);
      const pillEl = $('ecrrsFacetPill');
      if(pillEl) pillEl.textContent = ecrrsCursor < 6 ? 'פתיחות ונוחות בקרבה' : 'ביטחון רגשי בקשר';
      const fillEl = $('ecrrsStepperFill');
      if(fillEl) fillEl.style.width = (((ecrrsCursor + 1) / 9) * 100) + '%';
      const textEl = $('ecrrsQuestionText');
      if(textEl) textEl.textContent = item.text;

      updateSuppMilestonesAndEta('ecrrsMilestones', 'ecrrsEtaBadge', answeredCount, 9, 7);

      const currentVal = ecrrsAnswers[ecrrsCursor];
      dialog.querySelectorAll('.ecrrs-scale-btn').forEach(btn => {
        const val = Number(btn.dataset.value);
        const isSel = val === currentVal;
        btn.classList.toggle('is-selected', isSel);
        btn.setAttribute('aria-checked', String(isSel));
      });

      const fbEl = $('ecrrsChoiceFeedback');
      if(fbEl){
        fbEl.textContent = currentVal
          ? `נבחרה תשובה: ${SCALE_7_LABELS[currentVal] || currentVal} (${currentVal}/7) · ההתקדמות נשמרה`
          : 'טיפ: אפשר לבחור עם מקשי 1–7 או לנווט עם חצי המקלדת.';
      }

      const prevBtn = $('ecrrsPrevBtn');
      if(prevBtn) prevBtn.disabled = ecrrsCursor === 0;
      const nextBtn = $('ecrrsNextBtn');
      if(nextBtn) nextBtn.textContent = ecrrsCursor === 8 ? 'סיום וחישוב היקשרות ✓' : 'ממשיכים ←';
    }

    function selectAnswer(val){
      clearTimeout(ecrrsAdvanceTimer);
      ecrrsAnswers[ecrrsCursor] = val;
      const nextCursor = ecrrsCursor < 8 ? ecrrsCursor + 1 : ecrrsCursor;
      saveSuppDraft('ecrrs', ecrrsAnswers, nextCursor);
      renderQuestion();

      if(ecrrsCursor < 8){
        ecrrsAdvanceTimer = setTimeout(() => {
          ecrrsCursor++;
          renderQuestion();
        }, 200);
      } else {
        ecrrsAdvanceTimer = setTimeout(() => {
          finishQuiz();
        }, 200);
      }
    }

    function finishQuiz(){
      clearTimeout(ecrrsAdvanceTimer);
      const missingIdx = ecrrsAnswers.findIndex(v => !v);
      if(missingIdx >= 0){
        ecrrsCursor = missingIdx;
        renderQuestion();
        const fbEl = $('ecrrsChoiceFeedback');
        if(fbEl) fbEl.textContent = `נותרה שאלה ${missingIdx + 1} ללא מענה — בחר/י תשובה (1–7) או לחץ/י על "דלג" להשלמה.`;
        return;
      }
      if(!window.OfiEcrrsCodec) return;

      clearSuppDraft('ecrrs');
      const result = window.OfiEcrrsCodec.calculate(ecrrsAnswers);
      const token = window.OfiEcrrsCodec.encode(ecrrsAnswers);
      setSuppHashParam('a', '[A-Za-z0-9_-]{5}', token);

      if(ns.profile){
        ns.profile.ecrrsScores = result;
        renderProfileSummary(ns.profile);
      }
      window.renderAdditionalQuizzesHub(ns.profile);

      $('ecrrsQuizBody').hidden = true;
      const comp = $('ecrrsQuizComplete');
      if(comp) comp.hidden = false;

      const preview = $('ecrrsCompletePreview');
      if(preview && result){
        preview.replaceChildren();
        const pScore = el('div', 'preview-score-bubble');
        pScore.append(
          el('span', 'bubble-val', result.title),
          el('span', 'bubble-label', 'חרדת היקשרות: ' + result.anxiety.toFixed(2) + '/7 · הימנעות: ' + result.avoidance.toFixed(2) + '/7')
        );
        const pNotice = el('p', 'preview-note', result.narrative);
        preview.append(pScore, pNotice);
      }
    }

    function openDialog(){
      const bank = loadEcrrsBank();
      if(!bank) return;

      if(ns.profile?.ecrrsScores?.answers && Array.isArray(ns.profile.ecrrsScores.answers)){
        ecrrsAnswers = [...ns.profile.ecrrsScores.answers];
      } else {
        const draft = loadSuppDraft('ecrrs', 9, 7);
        if(draft){
          ecrrsAnswers = draft.answers;
          ecrrsCursor = draft.cursor;
        } else if(ecrrsAnswers.every(v => v === 0)){
          ecrrsAnswers.fill(0);
        }
      }

      const firstUnanswered = ecrrsAnswers.findIndex(v => v === 0);
      ecrrsCursor = firstUnanswered >= 0 ? firstUnanswered : 0;

      $('ecrrsQuizBody').hidden = false;
      const comp = $('ecrrsQuizComplete');
      if(comp) comp.hidden = true;

      renderQuestion();
      if(typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }

    function closeDialog(){
      clearAllQuizTimers();
      if(typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
      window.renderAdditionalQuizzesHub(ns.profile);
    }

    window.addEventListener('ofilab:open-ecrrs-quiz', openDialog);
    $('closeEcrrsDialogBtn')?.addEventListener('click', closeDialog);
    $('ecrrsHelpBtn')?.addEventListener('click', () => {
      clearAllQuizTimers(); // a pending auto-advance must not move the quiz behind an open help/AI panel
      const bank = loadEcrrsBank();
      const item = bank?.items?.[ecrrsCursor];
      const axisName = ecrrsCursor < 6
        ? 'ציר פתיחות ונוחות בקרבה (לעומת הימנעות מאינטימיות)'
        : 'ציר ביטחון רגשי בקשר (לעומת חרדת נטישה ודחייה)';
      openSuppHelp(
        'איך לקרוא את ההיגד הזה?',
        `היגד זה הוא מתוך שאלון ההיקשרות המדעי ECR-RS (Fraley et al., 2011) בסולם של 1 עד 7, והוא מודד את ${axisName}.`,
        'חשוב/י על דפוס הקשר שלך במערכות יחסים זוגיות או קרובות מאוד (גם אם אינך בזוגיות כרגע — איך את/ה מרגיש/ה ופועל/ת בדרך כלל בקשר קרוב). הסולם רחב (1–7) כדי לאפשר דיוק בניואנסים.',
        item?.text || ''
      );
    });
    $('askAiEcrrs')?.addEventListener('click', () => {
      clearAllQuizTimers(); // a pending auto-advance must not move the quiz behind an open help/AI panel
      window.dispatchEvent(new CustomEvent('ofilab:open-ai-question'));
    });
    $('ecrrsFinishBtn')?.addEventListener('click', () => {
      closeDialog();
      const target = document.documentElement.dataset.stage === 'results' ? $('ecrrsAttachmentCard') : $('homeAdditionalResultsMount');
      target?.scrollIntoView({behavior: 'smooth', block: 'start'});
    });
    $('ecrrsPrevBtn')?.addEventListener('click', () => {
      clearTimeout(ecrrsAdvanceTimer);
      if(ecrrsCursor > 0){
        ecrrsCursor--;
        saveSuppDraft('ecrrs', ecrrsAnswers, ecrrsCursor);
        renderQuestion();
      }
    });
    $('ecrrsSkipBtn')?.addEventListener('click', () => selectAnswer(4));
    $('ecrrsNextBtn')?.addEventListener('click', () => {
      clearTimeout(ecrrsAdvanceTimer);
      if(!ecrrsAnswers[ecrrsCursor]){
        const fbEl = $('ecrrsChoiceFeedback');
        if(fbEl) fbEl.textContent = 'בחר/י תשובה (1–7) או לחץ/י על "דלג (4 · ניטרלי)" כדי להמשיך.';
        return;
      }
      if(ecrrsCursor < 8){
        ecrrsCursor++;
        saveSuppDraft('ecrrs', ecrrsAnswers, ecrrsCursor);
        renderQuestion();
      } else {
        finishQuiz();
      }
    });

    dialog.querySelectorAll('.ecrrs-scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = Number(btn.dataset.value);
        if(val >= 1 && val <= 7) selectAnswer(val);
      });
    });

    dialog.addEventListener('keydown', event => {
      if($('ecrrsQuizBody')?.hidden) return;
      if($('questionHelpPanel')?.open || $('aiDialog')?.open) return;
      if(event.key >= '1' && event.key <= '7'){
        event.preventDefault();
        selectAnswer(Number(event.key));
      } else if(event.key === 'ArrowRight' && ecrrsCursor > 0){
        event.preventDefault();
        $('ecrrsPrevBtn')?.click();
      } else if(event.key === 'ArrowLeft'){
        event.preventDefault();
        $('ecrrsNextBtn')?.click();
      }
    });

    dialog.addEventListener('click', event => {
      if(event.target === dialog) closeDialog();
    });
    // Escape and other native closes skip closeDialog(); never let a pending auto-advance fire afterwards.
    dialog.addEventListener('close', clearAllQuizTimers);
  }

  window.getOfiLabSupplementaryTokens = function getOfiLabSupplementaryTokens() {
    if (isSuppProtected()) {
      return {
        h: protectedSuppTokens.h || null,
        v: protectedSuppTokens.v || null,
        a: protectedSuppTokens.a || null
      };
    }
    const hash = (typeof window !== 'undefined' && window.location?.hash) ? window.location.hash : '';
    const hm = hash.match(/[#&]h=([A-Za-z0-9_-]{7})/);
    const vm = hash.match(/[#&]v=([A-Za-z0-9_-]{24})/);
    const am = hash.match(/[#&]a=([A-Za-z0-9_-]{5})/);
    let h = hm ? hm[1] : null, v = vm ? vm[1] : null, a = am ? am[1] : null;
    try {
      if (typeof localStorage !== 'undefined') {
        if (!h) { const lh = localStorage.getItem('avd-personality:supp:hexaco'); if (lh && /^[A-Za-z0-9_-]{7}$/.test(lh)) h = lh; }
        if (!v) { const lv = localStorage.getItem('avd-personality:supp:via'); if (lv && /^[A-Za-z0-9_-]{24}$/.test(lv)) v = lv; }
        if (!a) { const la = localStorage.getItem('avd-personality:supp:ecrrs'); if (la && /^[A-Za-z0-9_-]{5}$/.test(la)) a = la; }
      }
    } catch (_e) {}
    return { h, v, a };
  };

  window.setOfiLabProtectedMode = function setOfiLabProtectedMode(flag) {
    const next = Boolean(flag);
    if (next && !isProtectedSession) {
      const current = window.getOfiLabSupplementaryTokens();
      protectedSuppTokens = {
        h: current.h || protectedSuppTokens.h || null,
        v: current.v || protectedSuppTokens.v || null,
        a: current.a || protectedSuppTokens.a || null
      };
      isProtectedSession = true;
      try {
        if (typeof localStorage !== 'undefined') {
          for (const k of [
            'avd-personality:supp:hexaco',
            'avd-personality:supp:via',
            'avd-personality:supp:ecrrs',
            'avd-personality:draft:hexaco',
            'avd-personality:draft:via',
            'avd-personality:draft:ecrrs'
          ]) localStorage.removeItem(k);
        }
      } catch (_e) {}
    } else if (!next && isProtectedSession) {
      isProtectedSession = false;
      try {
        if (typeof localStorage !== 'undefined') {
          if (protectedSuppTokens.h) localStorage.setItem('avd-personality:supp:hexaco', protectedSuppTokens.h);
          if (protectedSuppTokens.v) localStorage.setItem('avd-personality:supp:via', protectedSuppTokens.v);
          if (protectedSuppTokens.a) localStorage.setItem('avd-personality:supp:ecrrs', protectedSuppTokens.a);
        }
      } catch (_e) {}
    } else {
      isProtectedSession = next;
    }
  };

  window.applyOfiLabSupplementaryTokens = function applyOfiLabSupplementaryTokens(supp) {
    const h = (supp && typeof supp.h === 'string' && /^[A-Za-z0-9_-]{7}$/.test(supp.h)) ? supp.h : null;
    const v = (supp && typeof supp.v === 'string' && /^[A-Za-z0-9_-]{24}$/.test(supp.v)) ? supp.v : null;
    const a = (supp && typeof supp.a === 'string' && /^[A-Za-z0-9_-]{5}$/.test(supp.a)) ? supp.a : null;
    protectedSuppTokens = { h, v, a };
    memSuppDrafts.hexaco = null;
    memSuppDrafts.via = null;
    memSuppDrafts.ecrrs = null;
    hexacoAnswers = new Array(16).fill(0); hexacoCursor = 0;
    viaAnswers = new Array(60).fill(0); viaCursor = 0;
    ecrrsAnswers = new Array(9).fill(0); ecrrsCursor = 0;
    try {
      if (h && window.OfiHexacoCodec) {
        const dec = window.OfiHexacoCodec.decode(h);
        if (Array.isArray(dec) && dec.length === 16) hexacoAnswers = [...dec];
      }
      if (v && window.OfiViaCodec) {
        const dec = window.OfiViaCodec.decode(v);
        if (Array.isArray(dec) && dec.length === 60) viaAnswers = [...dec];
      }
      if (a && window.OfiEcrrsCodec) {
        const dec = window.OfiEcrrsCodec.decode(a);
        if (Array.isArray(dec) && dec.length === 9) ecrrsAnswers = [...dec];
      }
    } catch (_e) {}
    if (ns.profile) {
      delete ns.profile.ecrrsScores;
      if (ns.profile.hexacoHonesty?.type === 'direct') delete ns.profile.hexacoHonesty;
      if (ns.profile.viaStrengths?.type === 'composite' || ns.profile.viaStrengths?.type === 'direct') delete ns.profile.viaStrengths;
      checkHexacoDirect(ns.profile);
    }
    if (typeof window.renderAdditionalQuizzesHub === 'function') {
      window.renderAdditionalQuizzesHub(ns.profile);
    }
  };

  window.clearOfiLabSupplementaryLocal = function clearOfiLabSupplementaryLocal() {
    try {
      if (typeof localStorage !== 'undefined') {
        for (const k of [
          'avd-personality:supp:hexaco',
          'avd-personality:supp:via',
          'avd-personality:supp:ecrrs',
          'avd-personality:draft:hexaco',
          'avd-personality:draft:via',
          'avd-personality:draft:ecrrs'
        ]) {
          localStorage.removeItem(k);
        }
      }
    } catch (_e) {}
    protectedSuppTokens = { h: null, v: null, a: null };
    memSuppDrafts.hexaco = null;
    memSuppDrafts.via = null;
    memSuppDrafts.ecrrs = null;
    hexacoAnswers = new Array(16).fill(0);
    hexacoCursor = 0;
    viaAnswers = new Array(60).fill(0);
    viaCursor = 0;
    ecrrsAnswers = new Array(9).fill(0);
    ecrrsCursor = 0;
    if (ns.profile) {
      delete ns.profile.ecrrsScores;
      if (ns.profile.hexacoHonesty?.type === 'direct') delete ns.profile.hexacoHonesty;
      if (ns.profile.viaStrengths?.type === 'composite' || ns.profile.viaStrengths?.type === 'direct') delete ns.profile.viaStrengths;
    }
    // Called only when a fresh session starts: the cached Big Five profile belongs to
    // the previous respondent and must not weight new VIA answers.
    ns.profile = null;
    if (typeof window.renderAdditionalQuizzesHub === 'function') {
      window.renderAdditionalQuizzesHub(ns.profile);
    }
  };

  initHexacoDialog();
  initViaDialog();
  initEcrrsDialog();
  window.renderAdditionalQuizzesHub(ns.profile);

  ns.checkHexacoDirect=checkHexacoDirect;
  ns.clearAllQuizTimers=clearAllQuizTimers;
})();
