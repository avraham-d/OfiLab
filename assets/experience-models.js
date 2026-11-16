/* ofiLab results: readings derived from the Big Five scores: cybernetic stability and
   plasticity, UPPS impulsivity, interpersonal circumplex and NEO style graphs.
   Part of the results page; shares helpers through window.OfiExperience (see experience.js). */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  /* global calculateCybernetics -- assigned to window below */
  const ns=window.OfiExperience=window.OfiExperience||{};
  const el=(...args)=>ns.el(...args);
  const relative=()=>ns.relative();
  const validityBlocksInterpretation=scores=>ns.validityBlocksInterpretation(scores);

  function zToPct(z){
    const t=1/(1+0.2316419*Math.abs(z));
    const d=0.3989423*Math.exp(-z*z/2);
    let p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
    if(z>0)p=1-p;
    return Math.max(1,Math.min(99,Math.round(p*100)));
  }

  function compositePct(score,mean,sd){
    return zToPct((score-mean)/sd);
  }

  const EMPIRICAL_DOMAIN_NORMS={
    120:{N:[45.77,16.74],E:[59.92,15.23],O:[62.55,12.95],A:[66.87,13.18],C:[65.16,15.31]},
    300:{N:[46.86,15.91],E:[58.92,13.79],O:[67.28,11.01],A:[62.40,11.73],C:[63.10,13.41]}
  };

  function inferInventoryKey(scores){
    const nItems=scores?.empiricalReference?.answeredItems||scores?.empiricalReference?.percentileItems||scores?.totalItems;
    if(nItems===300||scores?.instrument==='IPIP-NEO-300')return 300;
    if(nItems===120||scores?.instrument==='IPIP-NEO-120')return 120;
    return ns.currentBank()?.items?.length===300?300:120;
  }

  function getDeepLab(scores){
    const deep = (typeof window!=='undefined'&&window&&window.OfiEmpiricalDeep)||(typeof globalThis!=='undefined'&&globalThis&&globalThis.OfiEmpiricalDeep)||null;
    if(!deep||!deep.data||!deep.data.lab)return null;
    const invKey=inferInventoryKey(scores);
    const mode=invKey===300?'300':'120';
    return {deep,mode,lab:deep.data.lab[mode],nCohort:deep.data.source?.n300||145388};
  }

  function domainNormZ(scores,k){
    const z=scores?.domains?.[k]?.z;
    if(typeof z==='number'&&Number.isFinite(z))return z;
    const invKey=inferInventoryKey(scores);
    const [mu,sd]=EMPIRICAL_DOMAIN_NORMS[invKey][k];
    const s=Number(scores?.domains?.[k]?.rangeScore??scores?.domains?.[k]?.score??mu);
    return (s-mu)/sd;
  }

  window.calculateCybernetics = function calculateCybernetics(scores, isRel){
    const domScore=k=>Number(scores.domains[k]?.rangeScore??scores.domains[k]?.score??50);
    const nScore=domScore('N'),eScore=domScore('E'),oScore=domScore('O'),aScore=domScore('A'),cScore=domScore('C');
    const linearStability=Math.round(((100-nScore)+cScore+aScore)/3);
    const linearPlasticity=Math.round((eScore+oScore)/2);

    const invKey=inferInventoryKey(scores);
    const dl=getDeepLab(scores);
    const zN=domainNormZ(scores,'N'),zE=domainNormZ(scores,'E'),zO=domainNormZ(scores,'O'),zA=domainNormZ(scores,'A'),zC=domainNormZ(scores,'C');
    // SD of the summed domain z-scores, from each cohort's domain correlations.
    const stabSd=invKey===300?2.2039:2.1922;
    const plasSd=invKey===300?1.5750:1.5269;
    const zStab=(-zN+zA+zC)/stabSd;
    const zPlas=(zE+zO)/plasSd;
    const empStab=dl?.lab?.cdfs?.cyber?.stability?dl.deep.cdfLookup(zStab,dl.lab.cdfs.cyber.stability):null;
    const empPlas=dl?.lab?.cdfs?.cyber?.plasticity?dl.deep.cdfLookup(zPlas,dl.lab.cdfs.cyber.plasticity):null;
    const pctStability=empStab!=null?Math.max(1,Math.min(99,Math.round(empStab))):zToPct(zStab);
    const pctPlasticity=empPlas!=null?Math.max(1,Math.min(99,Math.round(empPlas))):zToPct(zPlas);

    const stability=isRel?pctStability:linearStability;
    const plasticity=isRel?pctPlasticity:linearPlasticity;

    let archKey='balanced';
    let archTitle='נווט מאוזן וסתגלני (Balanced Navigator)';
    let archTag='איזון גמיש בין יציבות לחקרנות';
    let archDesc='שני מנועי־העל פועלים בטווח המאוזן: יכולת לשלב בגמישות בין שמירה על סדר, יציבות רגשית ומשמעת לבין פתיחות לחוויות, למידה ושינוי לפי דרישות המצב — ללא הטיה קיצונית לכיוון אחד.';

    const isMidStab=pctStability>=40&&pctStability<=60;
    const isMidPlas=pctPlasticity>=40&&pctPlasticity<=60;
    if(!(isMidStab&&isMidPlas)){
      if(pctStability>=56&&pctPlasticity>=56){
        archKey='explorer';
        archTitle='חוקר אינטגרטיבי (Integrated Explorer)';
        archTag='שילוב גבוה של יציבות וגמישות';
        archDesc='שילוב עוצמתי של פתיחות מחשבתית, סקרנות ויוזמה לצד משמעת עצמית, ויסות פנימי ויכולת התמדה לאורך זמן.';
      }else if(pctStability<=44&&pctPlasticity<=44){
        archKey='observer';
        archTitle='מתבונן סלקטיבי ורגיש (Selective Observer)';
        archTag='קשב פנימי וחיסכון באנרגיה';
        archDesc='פרופיל מופנם וזהיר, בעל קשב פנימי עמוק. צורך בסביבה שקטה, מוגנת ונטולת לחצים חיצוניים לשמירה על אנרגיה נפשית, עם סינון קפדני של גירויים.';
      }else if(zStab>=zPlas){
        archKey='anchor';
        archTitle='עוגן שקול ומייצב (Steadfast Anchor)';
        archTag='עוגן יציבות וויסות מטרות';
        archDesc='פרופיל אמין, יסודי ומתון. דפוס מחשבתי הפועל לבניית מבנים ארוכי טווח, שמירה על יציבות ושקט פנימי, עם העדפה לבהירות וביטחון על פני אי-ודאות.';
      }else{
        archKey='pioneer';
        archTitle='חלוץ אינטואיטיבי ודינמי (Intuitive Pioneer)';
        archTag='גמישות מחשבתית וחקרנות';
        archDesc='דחף עז לגילוי, רעיונות חדשים ויצירתיות, הפועל תחת עוררות רגשית גבוהה. דפוס מחשבתי המחפש חידוש ומשמעות, לצד רגישות עמוקה לשינויים בסביבה.';
      }
    }

    const archPrevalence=dl?.lab?.prevalences?.cyberArchetypes?.[archKey]??null;
    const rStabPlas=dl?.lab?.prevalences?.cyberArchetypes?.rStabPlas??null;
    return {stability,plasticity,pctStability,pctPlasticity,linearStability,linearPlasticity,archKey,archTitle,archTag,archDesc,archPrevalence,rStabPlas};
  }

  function renderCyberneticLab(scores){
    const container=$('cyberneticLabCard');
    if(!container||!scores||!scores.domains)return;
    // No archetype or lab reading is built from answers that carry no usable signal.
    if(validityBlocksInterpretation(scores)){container.hidden=true;container.replaceChildren();return;}
    const isRel=relative();
    const hasFacets=Boolean(scores.domains.N?.facets?.length===6);
    const cyber=calculateCybernetics(scores,isRel);
    const {stability,plasticity,archTitle,archTag,archDesc}=cyber;

    container.hidden=false;container.replaceChildren();

    const returnBtn=el('button','cyber-return-top','↑ חזרה לתמצית');
    returnBtn.type='button';
    returnBtn.setAttribute('title','חזרה לתמצית הפרופיל');
    returnBtn.addEventListener('click',()=>{
      $('resultsProfileSummary')?.scrollIntoView({behavior:'smooth',block:'start'});
    });

    const head=el('div','cyber-lab-header');
    const badgeRow=el('div','cyber-lab-badge-row');
    badgeRow.append(
      el('span','cyber-lab-badge','🧭 מנועי עומק והתנהגות'),
      el('span','cyber-lab-citation','מודל 10 האספקטים (DeYoung et al., 2007)'),
      returnBtn
    );
    const notice=el('div','cyber-science-notice');
    notice.append(
      el('span','cyber-notice-icon','ℹ️'),
      el('p',null,'רקע מקצועי: מודל זה מבוסס על מחקר 10 האספקטים של פרופ\' קולין די-יאנג (DeYoung et al., 2007). הוא מאפשר לראות כיצד חמש התכונות מתלכדות לשני מנועים התנהגותיים מרכזיים: עוגן הוויסות והיציבות הפנימית, ומנוע הגילוי והחקרנות בעולם. הנתונים מבוססים על דפוסי המענה שלך בשאלון בלבד.')
    );
    head.append(
      badgeRow,
      el('h2','cyber-lab-title','מבנה העומק: ויסות, משמעת וחקרנות'),
      el('p','cyber-lab-subtitle','פירוק מתקדם של חמש התכונות לשני כוחות מניעים מרכזיים, ומיפוי מערכות הוויסות העצמי מול הדחף לגילוי ולחקרנות.'),
      notice
    );

    const coreSection=el('div','cyber-core-section');
    const archCard=el('div','cyber-archetype-card');
    const archLead=el('div','cyber-archetype-lead');
    archLead.append(el('span','cyber-archetype-tag',archTag));
    if(cyber.archPrevalence!=null){
      archLead.append(el('span','cyber-prevalence-pill','שכיחות נצפית במדגם: '+cyber.archPrevalence+'%'));
    }
    archLead.append(el('h3','cyber-archetype-title',archTitle));
    archCard.append(archLead,el('p','cyber-archetype-desc',archDesc));

    const dualMeters=el('div','cyber-dual-meters');
    const unitLabel=isRel?'אחוזון':'ציון 0–100';

    const mStab=el('div','cyber-meter is-stability');
    const mStabHead=el('div','cyber-meter-head');
    const mStabLabel=el('div','cyber-meter-label');
    mStabLabel.append(
      el('span','cyber-meter-icon','🛡️'),
      el('strong',null,'עוגן הוויסות והיציבות (Stability)'),
      el('small',null,'ויסות רגשי, משמעת ועקביות · עוגן החוסן וההתמדה')
    );
    const mStabVal=el('span','cyber-meter-value',String(stability));
    mStabVal.append(el('small',null,' '+unitLabel));
    mStabHead.append(mStabLabel,mStabVal);
    const mStabTrack=el('div','cyber-meter-track');
    const mStabFill=el('div','cyber-meter-fill');
    mStabFill.style.width=stability+'%';
    mStabTrack.append(mStabFill);
    mStab.append(mStabHead,mStabTrack,el('p','cyber-meter-hint','שקלול ויסות רגשי, משמעת עצמית ושיתופיות — מודד יכולת התמדה, עמידה בלחצים ושמירה על יציבות המטרות.'));

    const mPlas=el('div','cyber-meter is-plasticity');
    const mPlasHead=el('div','cyber-meter-head');
    const mPlasLabel=el('div','cyber-meter-label');
    mPlasLabel.append(
      el('span','cyber-meter-icon','🚀'),
      el('strong',null,'מנוע הגילוי והחקרנות (Plasticity)'),
      el('small',null,'סקרנות אינטלקטואלית ואנרגיה יוזמת · מנוע החדשנות והיוזמה')
    );
    const mPlasVal=el('span','cyber-meter-value',String(plasticity));
    mPlasVal.append(el('small',null,' '+unitLabel));
    mPlasHead.append(mPlasLabel,mPlasVal);
    const mPlasTrack=el('div','cyber-meter-track');
    const mPlasFill=el('div','cyber-meter-fill');
    mPlasFill.style.width=plasticity+'%';
    mPlasTrack.append(mPlasFill);
    mPlas.append(mPlasHead,mPlasTrack,el('p','cyber-meter-hint','שקלול סקרנות אינטלקטואלית ואנרגיה יוזמת — מודד דחף לחקר סביבות חדשות, יצירתיות ופתיחות להזדמנויות.'));

    dualMeters.append(mStab,mPlas);
    coreSection.append(archCard,dualMeters);

    const aspectsSection=el('div','cyber-aspects-section');
    const aspectsHead=el('div','cyber-aspects-heading');
    aspectsHead.append(
      el('h3',null,'לוח 10 האספקטים וזיהוי פערים מובחנים'),
      el('p',null,hasFacets
        ?'לכל אחת מחמש התכונות יש שני אספקטים מובחנים. פער משמעותי ביניהם חושף את המורכבות הייחודית של אישיותך:'
        :'בשאלון 50 חושבו מנועי היציבות והגמישות הכלליים. לחישוב מדויק ומלא של כל 10 האספקטים וזיהוי פיצולים מומלץ לבצע את שאלון 120 או 300.')
    );
    aspectsSection.append(aspectsHead);

    if(hasFacets){
      const invKey=inferInventoryKey(scores);
      const is300=invKey===300;
      const dl=getDeepLab(scores);
      const facetScore=(k,idx)=>{
        const f=scores.domains[k]?.facets?.[idx];
        return f ? Number(f.rangeScore??f.score) : 50;
      };
      const meanScore=arr=>Math.round(arr.reduce((a,b)=>a+b,0)/arr.length);

      const makeAspect=(aspectId, label, desc, indices, traitKey, compositeSd, sdSum300, sdSum120)=>{
        const rawScores=indices.map(idx=>facetScore(traitKey,idx));
        const aspectScore=meanScore(rawScores);
        let pct;
        const facetObjs=indices.map(idx=>scores.domains[traitKey]?.facets?.[idx]).filter(Boolean);
        if(facetObjs.length===indices.length&&facetObjs.every(f=>typeof f.z==='number'&&Number.isFinite(f.z))){
          const zSum=facetObjs.reduce((acc,f)=>acc+f.z,0);
          const denom=is300?sdSum300:sdSum120;
          const zComp=zSum/denom;
          const empKnots=dl?.lab?.cdfs?.aspects?.[aspectId];
          const empPct=empKnots?dl.deep.cdfLookup(zComp,empKnots):null;
          pct=empPct!=null?Math.max(1,Math.min(99,Math.round(empPct))):zToPct(zComp);
        }else{
          pct=compositePct(aspectScore,50,compositeSd);
        }
        const displayVal=isRel?pct:aspectScore;
        return {label, desc, score:aspectScore, pct, val:displayVal};
      };

      const splitPctThresh = 24;
      const aspectDefs=[
        {
          key:'N',
          name:scores.domains.N?.label||'רגישות רגשית',
          a1:makeAspect('N_withdrawal','נסיגה פנימית (Withdrawal)','דאגה, ספק עצמי וצורך בביטחון',[0,2,3,5],'N',14.5,3.4464,3.2503),
          a2:makeAspect('N_volatility','תנודתיות חיצונית (Volatility)','תגובתיות עוררות, קוצר רוח ורגיזות',[1,4],'N',16.2,1.6718,1.6074),
          note:(w,v,th)=>w-v>=th?'רגישות מופנמת: הסטרס מופנם לדאגה שקטה וספק עצמי, ללא התפרצויות כעס חיצוניות.':(v-w>=th?'תגובתיות עוררות: סטרס מתבטא בקוצר רוח ותגובה מהירה לשיבושים, לצד התאוששות מהירה ללא שקיעה.':null)
        },
        {
          key:'A',
          name:scores.domains.A?.label||'נועם הליכות',
          a1:makeAspect('A_compassion','חמלה וחיבור (Compassion)','אמפתיה חמה, אלטרואיזם ודאגה רגשית לאחרים',[2,5],'A',15.5,1.8058,1.8163),
          a2:makeAspect('A_politeness','נימוס וגבולות (Politeness)','אמון, יושרה, צניעות וכיבוד כללי התנהגות',[0,1,3,4],'A',14.2,2.8137,2.6582),
          note:(c,p,th)=>p-c>=th?'ענווה ויושרה לצד איפוק רגשי: הקפדה גבוהה על הוגנות ואי-פגיעה, לצד גבולות שמורים ביחסים.':(c-p>=th?'חמלה ללא גינונים: אכפת לך עמוקות מאנשים, אך אינך חושש מישירות ומאמירת האמת בפנים.':null)
        },
        {
          key:'C',
          name:scores.domains.C?.label||'מצפוניות',
          a1:makeAspect('C_industriousness','חריצות ומשימתיות (Industriousness)','התמדה, השגת יעדים ומניעת דחיינות',[0,3,4],'C',15.1,2.6333,2.6129),
          a2:makeAspect('C_orderliness','סדר ושיקול דעת (Orderliness)','מבניות, חובתיות, תכנון וזהירות',[1,2,5],'C',15.1,2.4218,2.2641),
          note:(i,o,th)=>o-i>=th?'חובתיות מוסרית מול קושי בהתנעה: חשיבות גבוהה להבטחות ולכללים, לצד אתגר בביצוע משימתי שוטף תחת עומס.':(i-o>=th?'ביצועיסט פרגמטי: יכולת להניע משימות להישגים בסגנון חופשי, ללא תלות בסדר מוקפד.':null)
        },
        {
          key:'O',
          name:scores.domains.O?.label||'פתיחות',
          a1:makeAspect('O_intellect','אינטלקט וסקרנות מחשבתית (Intellect)','סקרנות רעיונית, פתרון בעיות וחשיבה מופשטת',[4],'O',19.0,1.0,1.0),
          a2:makeAspect('O_openness','פתיחות חושית, דמיון ואמנות (Openness)','רגישות לאמנות, מוזיקה, עומק רגשי ודמיון עשיר',[0,1,2],'O',15.0,2.2804,2.1769),
          note:(it,op,th)=>op-it>=th?'עולם פנימי וחושי עשיר: נטייה עמוקה לדמיון, רגשות ואסתטיקה, לצד העדפה לחשיבה מוחשית על פני פילוסופיה מופשטת.':(it-op>=th?'חשיבה אנליטית-רעיונית: משיכה לחקר מנגנונים ולוגיקה מופשטת, לצד פחות משיכה לאסתטיקה מופשטת.':null)
        },
        {
          key:'E',
          name:scores.domains.E?.label||'מוחצנות',
          a1:makeAspect('E_enthusiasm','התלהבות וחמימות (Enthusiasm)','חברותיות, שמחת חיים ופתיחות לבבית',[0,1,5],'E',15.1,2.6248,2.5949),
          a2:makeAspect('E_assertiveness','אסרטיביות והובלה (Assertiveness)','נוכחות, השמעת קול, מנהיגות ויוזמה',[2,3,4],'E',15.1,2.2285,2.0916),
          note:(e,a,th)=>a-e>=th?'הובלה עניינית: יכולת להוביל משימות ולהשמיע קול ברור, בלי צורך להיות במרכז תשומת הלב החברתית.':(e-a>=th?'חמימות חברתית נעימה: חיבור חם וצחוק בחברה קרובה, ללא רצון להתחרות על שליטה או דומיננטיות.':null)
        }
      ];

      const grid=el('div','cyber-aspects-grid');
      for(const def of aspectDefs){
        const card=el('article','cyber-aspect-card');
        card.dataset.trait=def.key;
        const cardHead=el('div','cyber-aspect-card-header');
        cardHead.append(el('strong',null,def.name));
        const pctDiff = Math.abs(def.a1.pct - def.a2.pct);
        const shownDiff = Math.abs(def.a1.val - def.a2.val);
        if(pctDiff >= splitPctThresh){
          const splitBadge=el('span','cyber-split-badge','פער מובחן בסולם ('+shownDiff+' נק\')');
          cardHead.append(splitBadge);
        }
        card.append(cardHead);

        const rowsEl=el('div','cyber-aspect-rows');
        for(const item of [def.a1,def.a2]){
          const row=el('div','cyber-aspect-row');
          const rHead=el('div','cyber-aspect-row-head');
          rHead.append(el('span','cyber-aspect-row-name',item.label),el('strong','cyber-aspect-row-val',item.val+' '+unitLabel));
          const rTrack=el('div','cyber-aspect-row-track');
          const rFill=el('div','cyber-aspect-row-fill');
          rFill.style.width=Math.max(0,Math.min(100,item.val))+'%';
          rTrack.append(rFill);
          row.append(rHead,rTrack,el('p','cyber-aspect-row-desc',item.desc));
          rowsEl.append(row);
        }
        card.append(rowsEl);

        const divergenceText=def.note(def.a1.pct,def.a2.pct,splitPctThresh);
        if(divergenceText){
          const callout=el('div','cyber-divergence-callout');
          callout.append(el('span','cyber-callout-icon','⚡'),el('p',null,divergenceText));
          card.append(callout);
        }
        grid.append(card);
      }
      aspectsSection.append(grid);
    }else{
      const notice=el('div','cyber-aspects-50-notice');
      const textWrap=el('div');
      textWrap.append(
        el('strong',null,'פירוק ל-10 אספקטים זמין עבור פרופילים עם 30 תחומי משנה (120 ו-300 פריטים)'),
        el('p',null,'מיפוי מלא של 10 האספקטים וזיהוי פערים מובחנים מבוסס על 30 תחומי המשנה (פאסטים) שבשאלון 120 או 300.')
      );
      notice.append(el('span','notice-icon','🔬'),textWrap);
      aspectsSection.append(notice);
    }

    const actSection=el('div','cyber-actionable-section');
    const actHead=el('div','cyber-actionable-heading');
    actHead.append(el('h3',null,'כיוונים ומבטים נוספים על עצמך'));
    actSection.append(actHead);

    const domPct=k=>{
      const d=scores.domains[k];
      if(d&&typeof (d.percentileExact??d.percentile)==='number')return Number(d.percentileExact??d.percentile);
      return zToPct(domainNormZ(scores,k));
    };
    // Same basis as domPct: Openness facets that are not low (40+) although the domain is: fantasy (O1), ideas (O5).
    const facetPctO=i=>{const f=scores.domains.O?.facets?.[i];if(!f)return null;const v=Number(f.percentileExact??f.percentile??f.score);return Number.isFinite(v)?v:null;};
    const openMinds=[[0,'בדמיון ובעולם פנימי עשיר'],[4,'ברעיונות מופשטים ובדיונים עיוניים']].filter(([i])=>(facetPctO(i)??0)>=40).map(([,t])=>t);
    const actGrid=el('div','cyber-actionable-grid');
    const actionableItems=[
      {
        icon:'🎨',
        title:'עולם הדמיון והסקרנות שלך',
        topic:'mind',
        text:(domPct('O')>=68)
          ?'משיכה חזקה לרעיונות מקוריים, אסתטיקה עשירה, מטאפורות ותחומי עניין מגוונים. אתה נהנה מחיבורים לא צפויים בין עולמות שונים, ומחפש חוויות שמגרות את החשיבה ומעוררות השראה.'
          :(domPct('O')<=32)
            ?(openMinds.length
              // Low Openness overall, but imagination or ideas are not low: say both.
              ?'בחיי היומיום אתה נוטה לשיטות, למסגרות ולפתרונות מוכרים ובדוקים, ובו בזמן יש לך עניין של ממש '+openMinds.join(' וגם ')+'. הפתיחות הנמוכה נובעת בעיקר מתחומי המשנה האחרים.'
              :'חיבור מובהק למציאות המוחשית, לפרקטיקה ולדברים שניתן לראות ולמדוד. אתה מעדיף פתרונות בדוקים וקונקרטיים על פני השערות מופשטות או תיאוריות מעורפלות.')
            :'איזון בריא בין סקרנות לבין קרקוע מעשי — אתה פתוח לרעיונות חדשים ומעניינים, אך בוחן אותם בעין ביקורתית ומחפש תמיד את היישום והמשמעות בפועל.'
      },
      {
        icon:'🧭',
        title:'המצפן והקצב הפנימי',
        topic:'tempo',
        text:(domPct('C')>=68&&domPct('N')<=38)
          ?'קצב יציב, מתוכנן ושקט. המצפן הפנימי שלך מונחה על ידי משמעת עצמית וידיעה ברורה של הצעדים הבאים, מה שמעניק לך ביטחון פנימי ורוגע מול עומסים.'
          :(domPct('C')<=35&&domPct('N')>=62)
            ?'קצב אינטואיטיבי ותגובתי. המצפן שלך קשוב בעוצמה לתחושות בטן ולתנודות רגשיות, ומעדיף זרימה וגמישות ברגע האמת על פני מסגרות קשיחות מראש.'
            :(domPct('C')>=62)
              ?'קצב מובנה ומסודר — אתה מרגיש במיטבך כאשר המטרות בהירות, הדברים נמצאים במקומם ויש לך תוכנית פעולה ברורה.'
              :'קצב ספונטני וסתגלני — אתה נע בין תקופות של מיקוד לבין רגעים של שיטוט והתנסות, ופועל לפי האנרגיה והעניין שנוצרים בכל רגע.'
      },
      {
        icon:'⚡',
        title:'הניגודים המרתקים שבאישיותך',
        topic:'contrasts',
        text:(domPct('A')>=65&&domPct('E')<=35)
          ?'שילוב מרתק בין אמפתיה עמוקה ורגישות לזולת לבין צורך חזק בשקט ובמרחב אישי מוגן. אכפת לך מאוד מאנשים, אך החיבור האמיתי שלך מתרחש בשיחות עמוקות של אחד-על-אחד ולא בהמונים.'
          :(domPct('O')>=65&&domPct('C')>=65)
            ?'פרדוקס פורה בין כנפי הדמיון לחובת הדיוק: ראש מלא ברעיונות יצירתיים לצד יכולת ביצוע קפדנית, סבלנות לפרטים ושאיפה למצוינות.'
            :(domPct('N')>=62&&domPct('E')>=65)
              ?'מפגש מעניין בין אהבת חברה וסוחפות בינאישית לבין רדאר פנימי רגיש, שמנתח ומעבד כל ניואנס ומחווה חברתית לעומק.'
              :'איזון הרמוני בין חלקים שונים — שילוב של שיקול דעת לצד פתיחות, ללא מתחים קיצוניים שמושכים לכיוונים מנוגדים.'
      },
      {
        icon:'🌿',
        title:'עוגני השקט וההתחדשות שלך',
        topic:'energy',
        text:(domPct('E')<=35)
          ?'המקום שבו האנרגיה שלך חוזרת הוא השקט: קריאה, התבוננות, יצירה או שהות בטבע ללא צורך להגיב או להרשים. שקט אישי הוא עבורך חמצן חיוני להטענת המצברים.'
          :(domPct('E')>=68)
            ?'האנרגיה שלך נדלקת מתוך תנועה ומפגש: שיחה טובה, יוזמה משותפת, מוזיקה או שינוי סביבה מרוממים את רוחך ומחזירים לך כוחות במהירות.'
            :(domPct('N')>=65)
              ?'העוגן החשוב ביותר עבורך הוא ודאות ושקט מגירויים: מרחב נטול הפרעות, מוזיקה מרגיעה וזמן נטול שעונים ומטלות שמאפשרים לנפש להתאפס ולהירגע.'
              :'התחדשות גמישה: אתה יודע להפיק כוח מחיבור עם חברים לצד רגעי שקט אישיים, לפי הצורך של אותו יום.'
      }
    ];

    for(const act of actionableItems){
      const aCard=el('article','cyber-actionable-card is-'+act.topic);
      const aHead=el('div','cyber-actionable-card-head');
      aHead.append(el('span','cyber-actionable-icon',act.icon),el('h4',null,act.title));
      aCard.append(aHead,el('p','cyber-actionable-text',act.text));
      actGrid.append(aCard);
    }
    actSection.append(actGrid);

    container.append(head,coreSection,aspectsSection,actSection);
  }

  window.renderUppsImpulsivity = function(scores) {
    const container = $('uppsImpulsivityCard');
    if (!container || !scores || !scores.domains) return;
    const hasFacets = Boolean(scores.domains.N?.facets?.length === 6);
    if (!hasFacets) { container.hidden = true; return; }

    const isRel = relative();
    const is300 = inferInventoryKey(scores) === 300;
    const fZ = (k, idx) => {
      const f = scores.domains[k]?.facets?.[idx];
      if (!f) return 0;
      if (typeof f.z === 'number' && Number.isFinite(f.z)) return f.z;
      return (Number(f.rangeScore ?? f.score ?? 50) - 50) / 18;
    };

    // Cohort-calibrated unit-variance UPPS composites (Whiteside & Lynam, 2001):
    const zUrgency = is300
      ? (0.7919 * fZ('N', 4) + 0.2200 * fZ('N', 1) - 0.1650 * fZ('C', 5))
      : (0.8173 * fZ('N', 4) + 0.2270 * fZ('N', 1) - 0.1703 * fZ('C', 5));
    const zPremedLack = is300
      ? (-0.8555 * fZ('C', 5) - 0.2673 * fZ('C', 1))
      : (-0.8771 * fZ('C', 5) - 0.2741 * fZ('C', 1));
    const zPersevLack = is300
      ? (-0.7581 * fZ('C', 4) - 0.1895 * fZ('C', 2) - 0.1895 * fZ('C', 0))
      : (-0.7628 * fZ('C', 4) - 0.1907 * fZ('C', 2) - 0.1907 * fZ('C', 0));
    const zSensation = is300
      ? (0.8351 * fZ('E', 4) + 0.2998 * fZ('O', 3))
      : (0.8502 * fZ('E', 4) + 0.3052 * fZ('O', 3));

    const dl = getDeepLab(scores);
    const toShown = (uppsKey, z) => {
      if (!isRel) return Math.round(Math.max(0, Math.min(100, 50 + 16.5 * z)));
      const knots = dl?.lab?.cdfs?.upps?.[uppsKey];
      const empP = knots ? dl.deep.cdfLookup(z, knots) : null;
      return empP != null ? Math.max(1, Math.min(99, Math.round(empP))) : zToPct(z);
    };

    container.hidden = false;
    container.replaceChildren();

    const returnBtn = el('button', 'cyber-return-top', '↑ חזרה לתמצית');
    returnBtn.type = 'button';
    returnBtn.addEventListener('click', () => $('resultsProfileSummary')?.scrollIntoView({behavior:'smooth', block:'start'}));

    const head = el('div', 'cyber-lab-header');
    const badgeRow = el('div', 'cyber-lab-badge-row');
    badgeRow.append(
      el('span', 'cyber-lab-badge', '⚡ פרופיל אימפולסיביות'),
      el('span', 'cyber-lab-citation', 'UPPS Model (Whiteside & Lynam, 2001)'),
      returnBtn
    );
    
    const notice = el('div', 'cyber-science-notice');
    notice.append(
      el('span', 'cyber-notice-icon', 'ℹ️'),
      el('p', null, 'מודל ה-UPPS מפריד את המושג המעורפל "אימפולסיביות" לארבעה מנגנונים בלתי-תלויים: דחיפות רגשית (N5, N2, −C6), היעדר תכנון (−C6, −C2), היעדר התמדה (−C5, −C3, −C1), וחיפוש ריגושים (E5, O4). כל מדד מכויל לאחוזונים אמפיריים מדויקים מול כלל המדגם.')
    );

    head.append(
      badgeRow,
      el('h2', 'cyber-lab-title', 'מנגנוני ויסות, קבלת החלטות ואימפולסיביות'),
      el('p', 'cyber-lab-subtitle', 'ארבעה ממדים עצמאיים הקובעים כיצד אתה מקבל החלטות תחת לחץ, מתמודד עם סיכונים ושולט בדחפים.'),
      notice
    );

    const coreSection = el('div', 'cyber-core-section');
    const dualMeters = el('div', 'cyber-dual-meters');
    
    const createMeter = (uppsKey, title, desc, zVal, icon) => {
      const val = toShown(uppsKey, zVal);
      const rounded = Math.round(val);
      const lvlClass = zVal >= 0.48 ? 'high' : zVal <= -0.48 ? 'low' : 'mid';
      const lvlText = zVal >= 0.48 ? 'גבוה' : zVal <= -0.48 ? 'נמוך' : 'מתון';
      const m = el('div', 'cyber-meter is-upps-' + lvlClass);
      const mHead = el('div', 'cyber-meter-head');
      const mLabel = el('div', 'cyber-meter-label');
      mLabel.append(el('span', 'cyber-meter-icon', icon), el('strong', null, title));
      const mValWrap = el('div', 'cyber-meter-value-wrap');
      const mBadge = el('span', 'cyber-meter-badge level-' + lvlClass, lvlText);
      const mVal = el('span', 'cyber-meter-value', String(rounded));
      mVal.append(el('small', null, isRel ? ' אחוזון' : ' ציון'));
      mValWrap.append(mBadge, mVal);
      mHead.append(mLabel, mValWrap);
      const mTrack = el('div', 'cyber-meter-track');
      const mFill = el('div', 'cyber-meter-fill');
      mFill.style.width = Math.min(100, Math.max(4, val)) + '%';
      mTrack.append(mFill);
      const mScale = el('div', 'cyber-meter-scale');
      mScale.append(el('span', null, '0 · נמוך'), el('span', null, '50 · אמצע'), el('span', null, '100 · גבוה'));
      m.append(mHead, mTrack, mScale, el('p', 'cyber-meter-hint', desc));
      return m;
    };

    dualMeters.append(
      createMeter('urgency', 'דחיפות שלילית (Negative Urgency)', 'הנטייה לפעול בפזיזות מתוך מצוקה רגשית, תסכול או לחץ כדי להקל על מתח רגשי מיידי.', zUrgency, '🔥'),
      createMeter('premedLack', 'היעדר תכנון (Lack of Premeditation)', 'הנטייה לפעול לפני שקילת ההשלכות, הפרטים והסיכונים העתידיים.', zPremedLack, '🎲'),
      createMeter('persevLack', 'היעדר התמדה (Lack of Perseverance)', 'קושי להישאר ממוקד במשימה משעממת, מורכבת או ארוכת טווח עד להשלמתה.', zPersevLack, '⏱️'),
      createMeter('sensation', 'חיפוש ריגושים (Sensation Seeking)', 'משיכה טבעית לחוויות חדשות ומסעירות, הרפתקנות וסיכונים מחושבים.', zSensation, '🎢')
    );

    coreSection.append(dualMeters);
    container.append(head, coreSection);
  };

  const IPC_ORTHO_WEIGHTS = {
    300: {
      agency: [['E',2,0.4171],['E',3,0.2711],['A',4,-0.2920],['A',3,-0.2711],['N',3,-0.1669],['E',0,-0.0306],['A',2,-0.0260],['A',5,-0.0245],['E',1,-0.0199],['A',0,-0.0199]],
      communion: [['E',0,0.3403],['A',2,0.2892],['A',5,0.2722],['E',1,0.2212],['A',0,0.2212],['E',2,-0.0375],['A',4,0.0262],['A',3,0.0244],['E',3,-0.0244],['N',3,0.0150]]
    },
    120: {
      agency: [['E',2,0.4762],['E',3,0.3095],['A',4,-0.3333],['A',3,-0.3095],['N',3,-0.1905],['E',0,-0.0391],['A',2,-0.0332],['A',5,-0.0313],['E',1,-0.0254],['A',0,-0.0254]],
      communion: [['E',0,0.3646],['A',2,0.3099],['A',5,0.2917],['E',1,0.2370],['A',0,0.2370],['E',2,-0.0510],['A',4,0.0357],['A',3,0.0332],['E',3,-0.0332],['N',3,0.0204]]
    }
  };

  window.renderInterpersonalCircumplex = function(scores) {
    const container = $('interpersonalCircumplexCard');
    if (!container || !scores || !scores.domains) return;
    const hasFacets = Boolean(scores.domains.N?.facets?.length === 6);
    if (!hasFacets) { container.hidden = true; return; }

    const isRel = relative();
    const is300 = inferInventoryKey(scores) === 300;
    const wSet = IPC_ORTHO_WEIGHTS[is300 ? 300 : 120];
    const fZ = (k, idx) => {
      const f = scores.domains[k]?.facets?.[idx];
      if (!f) return 0;
      if (typeof f.z === 'number' && Number.isFinite(f.z)) return f.z;
      return (Number(f.rangeScore ?? f.score ?? 50) - 50) / 18;
    };

    const dl = getDeepLab(scores);
    const zAgency = wSet.agency.reduce((s, [k, idx, w]) => s + w * fZ(k, idx), 0);
    const zCommunion = wSet.communion.reduce((s, [k, idx, w]) => s + w * fZ(k, idx), 0);

    const empAg = dl?.lab?.cdfs?.ipc?.agency ? dl.deep.cdfLookup(zAgency, dl.lab.cdfs.ipc.agency) : null;
    const empCm = dl?.lab?.cdfs?.ipc?.communion ? dl.deep.cdfLookup(zCommunion, dl.lab.cdfs.ipc.communion) : null;
    const pctAgency = empAg != null ? Math.max(1, Math.min(99, Math.round(empAg))) : zToPct(zAgency);
    const pctCommunion = empCm != null ? Math.max(1, Math.min(99, Math.round(empCm))) : zToPct(zCommunion);

    const dominance = isRel ? pctAgency : Math.round(Math.max(0, Math.min(100, 50 + 16.5 * zAgency)));
    const warmth = isRel ? pctCommunion : Math.round(Math.max(0, Math.min(100, 50 + 16.5 * zCommunion)));

    const radiusZ = Math.hypot(zCommunion, zAgency);
    const angle = Math.atan2(zAgency, zCommunion) * (180 / Math.PI);
    const deg = angle < 0 ? angle + 360 : angle;

    let octKey = 'balanced', octantTitle, octantDesc, intensityTag;
    if (radiusZ < 0.42) {
      octKey = 'balanced';
      intensityTag = 'גמישות מצבית במרכז המעגל';
      octantTitle = 'מאוזן וגמיש בינאישית (Adaptive-Balanced)';
      octantDesc = 'ממוקם באזור האיזון המרכזי של המעגל הבינאישי: יכולת להתאים את מידת ההובלה והקרבה החברתית בגמישות לדרישות הסיטואציה, ללא היצמדות נוקשה לקוטב בודד.';
    } else {
      intensityTag = radiusZ >= 0.85 ? 'סגנון בינאישי מובהק' : 'נטייה בינאישית מתונה';
      if (deg >= 337.5 || deg < 22.5) {
        octKey = 'warm';
        octantTitle = 'חמים ותומך (Warm-Agreeable)';
        octantDesc = 'נוכחות ידידותית, אמפתית וקשובה לצורכי הזולת, היוצרת אווירה של שיתוף פעולה ואמון בקשרים.';
      } else if (deg >= 22.5 && deg < 67.5) {
        octKey = 'gregarious';
        octantTitle = 'חברותי ומחבר (Gregarious-Extraverted)';
        octantDesc = 'שילוב של אנרגיה יוזמת עם חום אנושי — נהנה ליזום קשרים, לחבר בין אנשים ולהוביל ברוח חיובית.';
      } else if (deg >= 67.5 && deg < 112.5) {
        octKey = 'assured';
        octantTitle = 'בטוח ומוביל (Assured-Dominant)';
        octantDesc = 'נוכחות אסרטיבית וברורה, נכונות לקחת אחריות, להביע עמדה עצמאית ולהתוות כיוון בקבוצה.';
      } else if (deg >= 112.5 && deg < 157.5) {
        octKey = 'competitive';
        octantTitle = 'תחרותי וממוקד־יעד (Competitive-Direct)';
        octantDesc = 'תקשורת ישירה, משימתית והישגית; נכונות לעמוד על אינטרסים ולהתמודד עם מחלוקות ללא ריכוך יתר.';
      } else if (deg >= 157.5 && deg < 202.5) {
        octKey = 'reserved';
        octantTitle = 'עצמאי ושמור־גבולות (Reserved-Objective)';
        octantDesc = 'התנהלות עניינית, שקולה ושומרת פרטיות; העדפה לבחינה אובייקטיבית על פני מעורבות רגשית מהירה.';
      } else if (deg >= 202.5 && deg < 247.5) {
        octKey = 'introverted';
        octantTitle = 'מופנם ועצמאי (Introverted-Self-Reliant)';
        octantDesc = 'העדפה לעבודה עצמאית ולשקט אישי, שמירה על אוטונומיה והימנעות ממרכז הבמה החברתית.';
      } else if (deg >= 247.5 && deg < 292.5) {
        octKey = 'accommodating';
        octantTitle = 'מתחשב ומעדיף הרמוניה (Accommodating-Modest)';
        octantDesc = 'עדינות ביחסים, הימנעות ממאבקי כוח והעדפה להקשבה ולהסכמה על פני עימות או כפיית עמדה.';
      } else {
        octKey = 'unassuming';
        octantTitle = 'צנוע ומשתף־פעולה (Unassuming-Cooperative)';
        octantDesc = 'גישה נטולת יומרנות, כבוד להסכמות משותפות ונכונות לתמוך באחרים בגובה העיניים.';
      }
    }
    const octPrev = dl?.lab?.prevalences?.ipcOctants?.[octKey] ?? null;

    container.hidden = false;
    container.replaceChildren();

    const returnBtn = el('button', 'cyber-return-top', '↑ חזרה לתמצית');
    returnBtn.type = 'button';
    returnBtn.addEventListener('click', () => $('resultsProfileSummary')?.scrollIntoView({behavior:'smooth', block:'start'}));

    const head = el('div', 'cyber-lab-header');
    const badgeRow = el('div', 'cyber-lab-badge-row');
    badgeRow.append(
      el('span', 'cyber-lab-badge', '👥 מודל בינאישי'),
      el('span', 'cyber-lab-citation', 'IPC Circumplex (Wiggins, 1979; Traupman et al., 2009)'),
      returnBtn
    );

    const notice = el('div', 'cyber-science-notice');
    notice.append(
      el('span', 'cyber-notice-icon', 'ℹ️'),
      el('p', null, 'המעגל הבינאישי ממפה את סגנון התקשורת והיחסים שלך על פני שני צירים אורתוגונליים (בלתי-תלויים במתאם 0.00): ציר ההשפעה והיוזמה (Agency) וציר החום והחיבור (Communion).')
    );

    head.append(
      badgeRow,
      el('h2', 'cyber-lab-title', 'המעגל הבינאישי: ניתוח יחסים ותקשורת'),
      el('p', 'cyber-lab-subtitle', 'כיצד אתה מתנהל מול אנשים, משפיע עליהם, ויוצר קשרים חברתיים.'),
      notice
    );

    const coreSection = el('div', 'cyber-core-section');
    const topGrid = el('div', 'ipc-hero-grid');
    const archCard = el('div', 'cyber-archetype-card');
    const archLead = el('div', 'cyber-archetype-lead');
    archLead.append(el('span', 'cyber-archetype-tag', intensityTag));
    if (octPrev != null) {
      archLead.append(el('span', 'cyber-prevalence-pill', 'שכיחות נצפית במדגם: ' + octPrev + '%'));
    }
    archLead.append(el('h3', 'cyber-archetype-title', octantTitle));
    archCard.append(archLead, el('p', 'cyber-archetype-desc', octantDesc));

    // 2D Circumplex Wheel SVG
    const wheelWrap = el('div', 'ipc-wheel-wrap');
    wheelWrap.setAttribute('role', 'img');
    wheelWrap.setAttribute('aria-label', 'מפת המעגל הבינאישי: ' + octantTitle + ', השפעה ' + Math.round(dominance) + ', חום ' + Math.round(warmth));
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 240 240');
    svg.setAttribute('class', 'ipc-wheel-svg');
    svg.setAttribute('aria-hidden', 'true');
    const mkSvg = (tag, attrs) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
      return n;
    };
    svg.append(
      mkSvg('circle', { cx: 120, cy: 120, r: 82, class: 'ipc-ring-outer' }),
      mkSvg('circle', { cx: 120, cy: 120, r: 52, class: 'ipc-ring-mid' }),
      mkSvg('circle', { cx: 120, cy: 120, r: 16, class: 'ipc-ring-balance' })
    );
    for (const aDeg of [0, 90, 22.5, 67.5, 112.5, 157.5]) {
      const rad = aDeg * (Math.PI / 180);
      const x1 = (120 - 82 * Math.cos(rad)).toFixed(1), y1 = (120 - 82 * Math.sin(rad)).toFixed(1);
      const x2 = (120 + 82 * Math.cos(rad)).toFixed(1), y2 = (120 + 82 * Math.sin(rad)).toFixed(1);
      svg.append(mkSvg('line', { x1, y1, x2, y2, class: aDeg % 90 === 0 ? 'ipc-axis-main' : 'ipc-axis-octant' }));
    }
    const rZ = Math.hypot(zCommunion, zAgency);
    const scaleR = rZ > 2.15 ? (2.15 / rZ) : 1;
    const mx = 120 + zCommunion * scaleR * (82 / 2.15);
    const my = 120 - zAgency * scaleR * (82 / 2.15);
    svg.append(
      mkSvg('line', { x1: 120, y1: 120, x2: mx.toFixed(1), y2: my.toFixed(1), class: 'ipc-vector-line' }),
      mkSvg('circle', { cx: mx.toFixed(1), cy: my.toFixed(1), r: 6.5, class: 'ipc-marker-dot' })
    );
    const mkLabel = (tx, ty, txt, anchor = 'middle') => {
      const t = mkSvg('text', { x: tx, y: ty, 'text-anchor': anchor, class: 'ipc-axis-label' });
      t.textContent = txt;
      return t;
    };
    svg.append(
      mkLabel(120, 22, 'הובלה (+)', 'middle'),
      mkLabel(120, 226, 'התחשבות (−)', 'middle'),
      mkLabel(210, 124, 'חום (+)', 'start'),
      mkLabel(30, 124, 'ריחוק (−)', 'end')
    );
    wheelWrap.append(svg);
    topGrid.append(archCard, wheelWrap);

    const dualMeters = el('div', 'cyber-dual-meters');
    const createMeter = (title, desc, zVal, val, icon, toneClass) => {
      const rounded = Math.round(val);
      const lvlClass = zVal >= 0.45 ? 'high' : zVal <= -0.45 ? 'low' : 'mid';
      const lvlText = zVal >= 0.45 ? 'גבוה' : zVal <= -0.45 ? 'נמוך' : 'מאוזן';
      const m = el('div', 'cyber-meter ' + toneClass);
      const mHead = el('div', 'cyber-meter-head');
      const mLabel = el('div', 'cyber-meter-label');
      mLabel.append(el('span', 'cyber-meter-icon', icon), el('strong', null, title));
      const mValWrap = el('div', 'cyber-meter-value-wrap');
      const mBadge = el('span', 'cyber-meter-badge level-' + lvlClass, lvlText);
      const mVal = el('span', 'cyber-meter-value', String(rounded));
      mVal.append(el('small', null, isRel ? ' אחוזון' : ' ציון'));
      mValWrap.append(mBadge, mVal);
      mHead.append(mLabel, mValWrap);
      const mTrack = el('div', 'cyber-meter-track');
      const mFill = el('div', 'cyber-meter-fill');
      mFill.style.width = Math.min(100, Math.max(4, val)) + '%';
      mTrack.append(mFill);
      const mScale = el('div', 'cyber-meter-scale');
      mScale.append(el('span', null, '0 · נמוך'), el('span', null, '50 · אמצע'), el('span', null, '100 · גבוה'));
      m.append(mHead, mTrack, mScale, el('p', 'cyber-meter-hint', desc));
      return m;
    };

    dualMeters.append(
      createMeter('דומיננטיות והשפעה (Agency)', 'מידת האסרטיביות, המנהיגות והנכונות להוביל ולהשפיע.', zAgency, dominance, '👑', 'is-agency'),
      createMeter('חום וחיבור בינאישי (Communion)', 'חום חברתי גלוי: ידידותיות, חברותיות ויוזמה לקשרים קרובים. הציר מושפע גם ממוחצנות, ולכן אינו מודד אמפתיה בלבד.', zCommunion, warmth, '🤝', 'is-communion')
    );

    coreSection.append(topGrid, dualMeters);
    // Low Communion with high Agreeableness usually comes from introversion, not from a lack of care.
    const aPct = Number(scores.domains.A?.percentileExact ?? scores.domains.A?.percentile);
    if (Number.isFinite(aPct) && aPct - pctCommunion >= 40) {
      coreSection.append(el('p', 'cyber-meter-hint ipc-gap-note',
        'שימו לב: נועם ההליכות שלך גבוה (אחוזון ' + Math.round(aPct) + ') בעוד החום הבינאישי נמוך (אחוזון ' + pctCommunion + '). '
        + 'הפער נובע בעיקר מהרכיב החברתי של הציר (חום גלוי וחברותיות), ולא מחוסר באכפתיות, בחמלה או בשיתוף פעולה.'));
    }
    container.append(head, coreSection);
  };

  window.renderNeoStyleGraphs = function(scores) {
    const container = $('neoStyleGraphsCard');
    if (!container || !scores || !scores.domains) return;

    const isRel = relative();
    const dPct = k => {
      const d = scores.domains[k];
      if (d && typeof (d.percentileExact ?? d.percentile) === 'number') {
        return Number(d.percentileExact ?? d.percentile);
      }
      return zToPct(domainNormZ(scores, k));
    };
    const dVal = k => {
      const d = scores.domains[k];
      if (!d) return 50;
      if (isRel && typeof (d.percentileExact ?? d.percentile) === 'number') {
        return Number(d.percentileExact ?? d.percentile);
      }
      return Number(d.score ?? 50);
    };

    const TRAIT_NAMES = {
      N: 'רגישות רגשית',
      E: 'מוחצנות',
      O: 'פתיחות מחשבתית',
      A: 'נעימות ואמפתיה',
      C: 'מצפוניות וסדר'
    };

    const levelWordPct = p => p >= 66 ? 'גבוהה' : p <= 34 ? 'נמוכה' : 'מאוזנת';

    const styleConfigs = [
      {
        icon: '🌿',
        title: 'סגנון רווחה נפשית',
        t1: 'N', t2: 'E',
        quads: [
          { headline: 'רגשנות חיה וסוערת', desc: 'אתה חווה רגשות בעוצמה גבוהה, גם חיוביים וגם מאתגרים, ומבטא אותם בפתיחות מול הסביבה.' },
          { headline: 'עולם פנימי רגיש ומופנם', desc: 'נטייה לעבד מתחים ורגשות לעומק בינך לבין עצמך, עם העדפה לשקט ולמרחב מוגן כדי להיטען.' },
          { headline: 'אופטימיות יציבה ואנרגטית', desc: 'שילוב של חוסן רגשי עם שמחת חיים טבעית — אתה מתאושש מהר מלחצים ושואב אנרגיה מחברה ומעשייה.' },
          { headline: 'רוגע יציב ונטול דרמות', desc: 'שלווה פנימית עמוקה ואיזון רגשי שקט. אינך נסחף בקלות לסערות רגשיות ומעדיף קצב חיים נינוח ורגוע.' }
        ]
      },
      {
        icon: '🛡️',
        title: 'סגנון התמודדות והסתגלות',
        t1: 'N', t2: 'O',
        quads: [
          { headline: 'מודעות עצמית חדה ורגישה', desc: 'ערנות גבוהה לדקויות רגשיות ולרעיונות חדשים, לצד נטייה לנתח לעומק מצבי אי-ודאות.' },
          { headline: 'העדפת עוגנים מוכרים בעת לחץ', desc: 'כשעולה מתח, היצמדות לשגרה ברורה ולדרכי פעולה מוכחות מעניקה לך תחושת ביטחון ויציבות.' },
          { headline: 'פתיחות שלווה וגמישות מחשבתית', desc: 'יכולת להתבונן בשינויים ובמורכבות בסקרנות רגועה, בלי לחוש מאוים מחוסר ודאות.' },
          { headline: 'יציבות מעשית עם רגליים על הקרקע', desc: 'גישה ישירה, פרקטית ולא מסובכת למציאות — אתה מתמקד במה שעובד בפועל ונשאר רגוע.' }
        ]
      },
      {
        icon: '⚖️',
        title: 'סגנון ניהול כעס וקונפליקט',
        t1: 'N', t2: 'A',
        quads: [
          { headline: 'רגישות מצפונית ומתחשבת', desc: 'גם כשאתה נפגע או מתוסכל, חשוב לך לשמור על כבוד האחר ולבטא את הכאב בדרך מרוסנת.' },
          { headline: 'תגובתיות ישירה וביקורתית', desc: 'כשמשהו מכעיס אותך או נתפס כלא הוגן, אתה נוטה להגיב באופן מיידי, גלוי וחד ללא ייפוי.' },
          { headline: 'פייסנות רגועה ומכילה', desc: 'קשה מאוד להוציא אותך משלוותך; אתה ניגש לחילוקי דעות מתוך רצון טבעי להבנה ולהרגעת הרוחות.' },
          { headline: 'ענייניות קרה ולוגיקה חדה', desc: 'אתה מתייחס לעימותים כאל בעיה שצריך לפתור בהיגיון קר, בלי להיסחף לרגשנות אך גם בלי לוותר מתוך נימוס.' }
        ]
      },
      {
        icon: '🎯',
        title: 'סגנון ויסות עצמי ודחפים',
        t1: 'N', t2: 'C',
        quads: [
          { headline: 'סטנדרטים גבוהים ומאמץ פנימי', desc: 'רצון חזק להצליח ולשמור על שליטה מלאה, שלעיתים מלווה בביקורת עצמית גבוהה ודריכות.' },
          { headline: 'תגובתיות ספונטנית לפי הרגש', desc: 'מצב הרוח הרגעי משפיע מאוד על הקצב שלך, וקל לך יותר לפעול מהבטן מאשר לפי תוכנית נוקשה.' },
          { headline: 'משמעת עצמית שלווה ושיטתית', desc: 'יכולת להתמיד במטרות ארוכות טווח בשקט פנימי, בעקביות וללא לחץ מיותר.' },
          { headline: 'זרימה נינוחה וגמישה', desc: 'גישה משוחררת ורגועה לחיים — אינך נלחץ מלוחות זמנים ומעדיף גמישות על פני תכנון קפדני.' }
        ]
      },
      {
        icon: '🧭',
        title: 'סגנון תחומי עניין וסקרנות',
        t1: 'E', t2: 'O',
        quads: [
          { headline: 'חיפוש חוויות, יצירה ואנשים', desc: 'סקרנות שפונה החוצה: אהבה לשיחות מעוררות השראה, היכרויות חדשות, תרבות והתנסויות מגוונות.' },
          { headline: 'מעורבות חברתית מעשית ומוכרת', desc: 'הנאה מפעילות משותפת, קהילה ושיח בגובה העיניים על ענייני היום-יום המעשיים.' },
          { headline: 'חקר אינטלקטואלי ועומק אישי', desc: 'סקרנות עמוקה לעולם הרעיונות, הלמידה והדמיון, שמתפתחת הכי טוב בשקט ובקצב האישי שלך.' },
          { headline: 'התמקדות שקטה במוכר ובמוחשי', desc: 'העדפה לסביבה שקטה, ברורה ומוכרת, תוך התמקדות בעיסוקים מעשיים ומוגדרים היטב.' }
        ]
      },
      {
        icon: '🤝',
        title: 'סגנון יחסי אנוש ותקשורת',
        t1: 'E', t2: 'A',
        quads: [
          { headline: 'חום חברתי וחיבור אנושי פעיל', desc: 'נוכחות חמה, נגישה ומעודדת — קל לך ליצור קשרים, לפרגן ולהשרות אווירה חיובית בקבוצה.' },
          { headline: 'הובלה אסרטיבית ותחרותית', desc: 'נוכחות דומיננטית וישירה: אתה לא חושש להוביל מהלכים, לשכנע ולעמוד על דעתך גם מול התנגדות.' },
          { headline: 'תמיכה שקטה, צנועה ונאמנה', desc: 'אתה מעדיף קשרים קרובים ואישיים על פני המולה, ומביא אליהם הקשבה עמוקה, עדינות והתחשבות.' },
          { headline: 'עצמאות שמורה ובלתי-תלויה', desc: 'שמירה על פרטיות וגבולות ברורים — אתה בוחר בקפידה את מעגל הקרובים שלך ואינך תלוי באישור חברתי.' }
        ]
      },
      {
        icon: '⚡',
        title: 'סגנון פעילות וביצוע',
        t1: 'E', t2: 'C',
        quads: [
          { headline: 'יזמות דינמית ודחף להישגים', desc: 'שילוב של מרץ גבוה עם תכנון ומחויבות — אתה נהנה להניע פרויקטים קדימה ולראות תוצאות בשטח.' },
          { headline: 'התלהבות ספונטנית ורב-כיוונית', desc: 'אנרגיה גבוהה שנדלקת מהר מרעיונות ומאנשים, עם העדפה לגיוון ולאילתור על פני שגרה מסודרת.' },
          { headline: 'ביצוע יסודי, שקט ועקבי', desc: 'עבודה שיטתית ומדויקת מאחורי הקלעים — אתה משלים משימות באחריות מלאה בלי לחפש אור זרקורים.' },
          { headline: 'קצב אישי מתון ולא תחרותי', desc: 'העדפה לעבוד בקצב נינוח ונטול לחץ, תוך שמירה על אנרגיה והימנעות מעומס משימות מיותר.' }
        ]
      },
      {
        icon: '🌍',
        title: 'סגנון השקפת עולם וערכים',
        t1: 'O', t2: 'A',
        quads: [
          { headline: 'פתיחות הומניסטית וסובלנות רחבה', desc: 'שילוב של סקרנות מחשבתית עם חמלה ואמפתיה — נטייה להבין נקודות מבט מגוונות ולחפש הוגנות חברתית.' },
          { headline: 'חשיבה עצמאית, חוקרת וביקורתית', desc: 'אתה בוחן כל רעיון ומוסכמה בעיניים ביקורתיות וחפות מסנטימנטים, ומחפש אמת לוגית גם כשהיא לא פופולרית.' },
          { headline: 'מסורתיות חמה וערכי קהילה', desc: 'חיבור לערכים מוכרים, יציבות ומשפחתיות, יחד עם אכפתיות מעשית ונכונות לעזור לסובבים אותך.' },
          { headline: 'ריאליזם מפוכח ושמרני', desc: 'גישה מעשית וזהירה שמעדיפה כללים ברורים, ניסיון מוכח ובחינה מפוכחת של המציאות.' }
        ]
      },
      {
        icon: '📚',
        title: 'סגנון למידה וחשיבה',
        t1: 'O', t2: 'C',
        quads: [
          { headline: 'למידה מעמיקה, יצירתית ושיטתית', desc: 'יכולת לחבר בין סקרנות אינטלקטואלית רחבה לבין משמעת מחקרית שמאפשרת להפוך רעיונות לתוצרים שלמים.' },
          { headline: 'סקרנות אסוציאטיבית ויצירתית', desc: 'חשיבה מקורית שקופצת בין תחומים והשראות חדשות, ופורחת כשיש חופש לחקור בלי מסגרת נוקשה.' },
          { headline: 'למידה מעשית, ממוקדת ומסודרת', desc: 'העדפה לידע יישומי, שיטתי וברור שניתן לתרגם ישירות לכלים מעשיים ולתוצאות מוגדרות.' },
          { headline: 'למידה מתוך התנסות פשוטה וישירה', desc: 'העדפה לפתרונות פשוטים ומוחשיים כאן ועכשיו, בלי להעמיס תיאוריות מופשטות או נהלים מורכבים.' }
        ]
      },
      {
        icon: '🏛️',
        title: 'סגנון אחריות ואופי בעבודה',
        t1: 'A', t2: 'C',
        quads: [
          { headline: 'אמינות גבוהה, הוגנות ומוסר עבודה', desc: 'שילוב של אחריות אישית עם התחשבות בזולת — אנשים יודעים שאפשר לסמוך על המילה שלך ועל שיתוף הפעולה שלך.' },
          { headline: 'כוונות טובות ונדיבות גמישה', desc: 'לב רחב ונכונות כנה לעזור לאחרים, גם אם לעיתים סדר העדיפויות והזמנים מתנהלים באופן ספונטני.' },
          { headline: 'מוכוונות משימה תובענית וישירה', desc: 'מיקוד חד ביעדים, ביעילות ובמצוינות מקצועית, תוך ציפייה לסטנדרטים גבוהים מעצמך ומאחרים.' },
          { headline: 'חופש פעולה עצמאי וגמיש', desc: 'העדפה לפעול לפי שיקול דעתך האישי, ללא כפיפות לנוהלים פורמליים או לצורך לרצות את הסביבה.' }
        ]
      }
    ];

    container.hidden = false;
    container.replaceChildren();

    const returnBtn = el('button', 'cyber-return-top', '↑ חזרה לתמצית');
    returnBtn.type = 'button';
    returnBtn.addEventListener('click', () => $('resultsProfileSummary')?.scrollIntoView({behavior:'smooth', block:'start'}));

    const head = el('div', 'cyber-lab-header');
    const badgeRow = el('div', 'cyber-lab-badge-row');
    badgeRow.append(
      el('span', 'cyber-lab-badge', '🎨 סגנונות חיים'),
      el('span', 'cyber-lab-citation', 'בהשראת גרפי הסגנון של Costa & McCrae (1992)'),
      returnBtn
    );

    const notice = el('div', 'cyber-science-notice');
    notice.append(
      el('span', 'cyber-notice-icon', 'ℹ️'),
      el('p', null, 'כל תכונה פועלת יחד עם האחרות: 10 סגנונות החיים מראים בצורה פשוטה ובהירה כיצד השילוב בין כל זוג תכונות שלך מתבטא בחיי היום-יום.')
    );

    head.append(
      badgeRow,
      el('h2', 'cyber-lab-title', 'מטריצת 10 סגנונות החיים'),
      el('p', 'cyber-lab-subtitle', 'איך השילובים בין חמש התכונות שלך יוצרים את סגנון החיים, הלמידה והקשרים הייחודי שלך.'),
      notice
    );

    const coreSection = el('div', 'cyber-core-section');
    const grid = el('div', 'neo-style-grid');

    const unitLabel = isRel ? 'אחוזון' : 'ציון';
    const dlNeo = getDeepLab(scores);

    for (const cfg of styleConfigs) {
      const p1 = dPct(cfg.t1);
      const p2 = dPct(cfg.t2);
      const v1 = dVal(cfg.t1);
      const v2 = dVal(cfg.t2);
      const h1 = p1 >= 50, h2 = p2 >= 50;
      const quadIdx = (h1 && h2) ? 0 : ((h1 && !h2) ? 1 : ((!h1 && h2) ? 2 : 3));
      const quad = cfg.quads[quadIdx];
      const isCentralBalanced = p1 >= 38 && p1 <= 62 && p2 >= 38 && p2 <= 62;
      const pairStats = dlNeo?.lab?.prevalences?.neoStylePairs?.[cfg.t1 + cfg.t2] || null;

      const card = el('article', 'neo-style-card');

      const top = el('div', 'neo-style-top');
      const domainTag = el('span', 'neo-style-domain');
      domainTag.append(el('span', 'neo-style-icon', cfg.icon), el('span', null, cfg.title));
      top.append(domainTag);
      if (pairStats) {
        const shownPrev = isCentralBalanced ? pairStats.centerBalanced : pairStats.quads[quadIdx];
        const rStr = (pairStats.r >= 0 ? '+' : '') + pairStats.r.toFixed(2);
        const prevPill = el('span', 'neo-style-prevalence', (isCentralBalanced ? 'אזור איזון: ' : 'שכיחות: ') + shownPrev + '% · r=' + rStr);
        prevPill.title = 'שכיחות נצפית של הרבעון במדגם האמפירי (N=145,388) והמתאם בפועל בין שתי התכונות';
        top.append(prevPill);
      }

      const shownHeadline = isCentralBalanced ? ('איזון גמיש · ' + quad.headline) : quad.headline;
      const headline = el('h3', 'neo-style-headline', shownHeadline);

      const traitsBox = el('div', 'neo-style-traits');
      for (const [tKey, tVal, tPct] of [[cfg.t1, v1, p1], [cfg.t2, v2, p2]]) {
        const row = el('div', 'neo-style-trait-row');
        row.append(
          el('span', 'neo-style-trait-name', TRAIT_NAMES[tKey]),
          el('span', 'neo-style-trait-meta', levelWordPct(tPct) + ' · ' + Math.round(tVal) + ' ' + unitLabel)
        );
        const bar = el('div', 'neo-style-trait-bar');
        const fill = el('div', 'neo-style-trait-fill');
        fill.dataset.trait = tKey;
        fill.style.width = Math.min(100, Math.max(5, tVal)) + '%';
        bar.append(fill);
        row.append(bar);
        traitsBox.append(row);
      }

      const shownDesc = isCentralBalanced
        ? ('שתי התכונות ממוקמות בטווח המרכזי המאוזן, מה שמאפשר לך לנוע בגמישות לפי הקשר הסיטואציה. בנטייה קלה: ' + quad.desc)
        : quad.desc;
      const desc = el('p', 'neo-style-desc', shownDesc);
      card.append(top, headline, traitsBox, desc);
      grid.append(card);
    }

    coreSection.append(grid);
    container.append(head, coreSection);
  };

  ns.renderCyberneticLab=renderCyberneticLab;
})();
