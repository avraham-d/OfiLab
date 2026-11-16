/* AVD Personality Lab — Structural 5-Letter Estimate from Big Five 30 Facets (MBTI + Identity v5).
 * Psychometric Facet-Composite Structural Engine (five-letter-estimate-v5):
 *   - Levine True-Score Common-Item Equated Norms: N = 555,764 (IPIP-NEO-120) & N = 145,388 (IPIP-NEO-300)
 *   - EI/SN/TF/JP weights: content-mapped ridge regression (lambda = 2.0) on the published facet x MBTI correlations
 *     of Furnham, Moutafi & Crump (2003), Social Behavior and Personality 31(6), Table 1 (NEO PI-R x MBTI Form G,
 *     N = 900), using cohort facet intercorrelations; see tools/derive-mbti-content-weights.py.
 *     Note: no respondent in the reference cohorts took both IPIP and MBTI together.
 *   - McCrae & Costa (1989), Journal of Personality, 57(1), 17-40 (single-domain correlations rLatent: EI .74, SN .74, TF .47, JP .49)
 *   - The A/T axis and the cognitive functions have no published MBTI criterion; their weights are theoretical
 *   - DeYoung, Quilty, & Peterson (2007), 10 Aspects of the Big Five
 *   - Mosier (1943) Composite Reliability & Individualized Measurement SEM / 95% CI
 *   - Optional Multi-Instrument Precision Fusion (HEXACO-H, ECR-RS, IPIP-VIA-R, Response Validity)
 * This file contains NO network calls, identifiers or user data storage.
 */
(function(root){
  'use strict';

  // Exact empirical [meanRangeScore, sdRangeScore, cronbachAlpha] calibrated from:
  //   - norms120: legacy cross-form axis score calibration (unchanged for marker and letter stability);
  //     MBTI-120 empirical percentile/prevalence reference: original Johnson N = 410,376
  //   - norms300: Johnson IPIP-NEO-300 cohort (N = 145,388) Levine true-score equated via shared 120 items
  const EMPIRICAL_NORMS={
    120:{
      N1:[51.673,23.806,0.7863],N2:[48.387,26.388,0.871],N3:[36.152,25.061,0.8561],N4:[49.27,22.895,0.7188],N5:[49.769,21.361,0.7059],N6:[39.35,22.754,0.7711],
      E1:[64.24,22.896,0.818],E2:[52.176,25.484,0.7991],E3:[63.759,22.119,0.8553],E4:[52.952,20.013,0.7056],E5:[56.49,21.494,0.7443],E6:[69.926,20.876,0.8068],
      O1:[70.028,21.182,0.7578],O2:[67.069,22.905,0.7528],O3:[69.811,19.19,0.6639],O4:[53.288,20.403,0.7124],O5:[67.281,22.375,0.751],O6:[47.827,21.822,0.6486],
      A1:[58.771,22.492,0.8609],A2:[76.75,19.061,0.7498],A3:[77.641,17.052,0.7488],A4:[66.624,22.956,0.7145],A5:[53.202,22.038,0.7439],A6:[68.26,19.674,0.7259],
      C1:[74.459,16.047,0.7813],C2:[53.253,27.171,0.8381],C3:[74.934,16.81,0.683],C4:[71.172,21.073,0.8042],C5:[59.494,20.33,0.7264],C6:[57.657,25.873,0.8808]
    },
    300:{
      N1:[49.419,19.611,0.8649],N2:[45.121,22.403,0.9139],N3:[38.642,22.878,0.916],N4:[46.58,18.574,0.8317],N5:[54.989,17.1,0.7841],N6:[40.048,18.804,0.8602],
      E1:[65.319,19.586,0.8901],E2:[54.448,21.668,0.8911],E3:[61.135,18.334,0.8617],E4:[52.259,13.802,0.7245],E5:[56.551,19.171,0.8488],E6:[72.359,16.558,0.8436],
      O1:[70.701,17.764,0.8548],O2:[72.035,17.404,0.8114],O3:[68.292,15.891,0.7881],O4:[62.157,15.966,0.8166],O5:[68.955,18.261,0.8516],O6:[46.976,18.056,0.784],
      A1:[59.669,18.481,0.8846],A2:[67.679,15.915,0.7891],A3:[75.223,14.568,0.8386],A4:[60.062,17.333,0.7737],A5:[51.074,16.476,0.7783],A6:[62.662,16.294,0.785],
      C1:[72.778,14.016,0.8287],C2:[58.866,20.144,0.8581],C3:[74.699,14.509,0.8008],C4:[69.843,16.563,0.8397],C5:[55.043,20.037,0.8939],C6:[55.115,19.013,0.8463]
    }
  };

  // Cohort 120-vs-300 reproducibility conditioned on distance from 50.
  // Half-point distance bins, weighted isotonic calibration, first bin >=70%.
  // This is an empirical estimate, not an exact individual retest probability.
  const BORDERLINE_DISTANCE={"300":{"EI":4.0,"SN":4.5,"TF":5.5,"JP":6.0,"AT":3.5},"120":{"EI":4.5,"SN":4.5,"TF":5.5,"JP":6.5,"AT":4.0}};

  // EI/SN/TF/JP: each axis uses only facets whose content defines that preference (population correlates
  // such as introversion or anxiety for S/N are excluded); weights keep the published signs and give the
  // axis unit variance in the cohort.
  //   - rLatent: published single-domain correlation in McCrae & Costa (1989), Table 3 (historical reference).
  //   - r300/r120: implied multi-facet composite correlation with MBTI from Furnham et al. (2003) Table 1
  //     (in J/P, multi-facet C2+C6+C5-O4 exceeds single-domain C, so r300=.5522 > rLatent=.49).
  //   - rel/sem: Mosier composite reliability and SEM on the Z scale (data/mbti-content-weights.json).
  //   - tau: small fixed intercept offset (|tau| <= 0.08 Z) set manually during v5 calibration; documented as heuristic.
  const definitions=[
    {
      key:'EI',hasPublishedCriterion:true,negative:'I',positive:'E',
      negativeText:'יותר שקט ומרחב אישי',positiveText:'יותר חברה ואינטראקציות',
      label:'חברה ואנרגיה',
      basis:'חברותיות, חמימות, חיוניות, אסרטיביות ונינוחות חברתית מול צורך בשקט ובמרחב אישי',
      weak:false,
      keys:["E2","E1","E6","E3","E4","E5","N4"],
      // Content-mapped ridge weights: Furnham et al. (2003) facet correlations; tools/derive-mbti-content-weights.py
      b300:[0.3062,0.2142,0.207,0.1617,0.1987,0.091,-0.1329],
      b120:[0.3036,0.2164,0.2062,0.2287,0.1967,0.112,-0.0993],
      domainFallback:[['E',0.89],['N',-0.22]],
      rLatent:0.74,r300:0.7068,r120:0.6992,rel300:0.9567,rel120:0.9363,sem300:0.2081,sem120:0.2523,
      tau:-0.05,maxConf:91
    },
    {
      key:'SN',hasPublishedCriterion:true,negative:'S',positive:'N',
      negativeText:'מעדיף את המעשי והמוכר',positiveText:'נמשך לרעיונות ולדמיון',
      label:'חשיבה וסקרנות',
      basis:'דמיון חי, פתיחות לרעיונות מופשטים ותאורטיים, אסתטיקה ועומק רגשי (בניכוי הטיית מסוגלות/חרדה חברתית וללא O6)',
      weak:false,
      keys:["O1","O5","O2","O3","O4"],
      // Content-mapped ridge weights: Furnham et al. (2003) facet correlations; tools/derive-mbti-content-weights.py
      b300:[0.363,0.3885,0.2663,0.1622,0.2796],
      b120:[0.3848,0.3936,0.2687,0.1866,0.2977],
      domainFallback:[['O',1.0]],
      // McCrae & Costa (1989) report SN with Openness r=.72 (men) / .69 (women); the UI shows the published .72.
      // rLatent keeps the engine's adjusted .74. It only feeds the 50-item fallback and the composite weights,
      // never the 120/300 probabilities (those use r300 / r120).
      rLatent:0.74,r300:0.6935,r120:0.6729,rel300:0.9266,rel120:0.8724,sem300:0.271,sem120:0.3572,
      tau:0.06,maxConf:90
    },
    {
      key:'TF',hasPublishedCriterion:true,negative:'T',positive:'F',
      negativeText:'נוטה לניתוח ענייני ולוגי',positiveText:'נוטה לאמפתיה, ערכים והרמוניה',
      label:'קבלת החלטות',
      basis:'חמלה, אמון, קשב רגשי, חום, ויתור וצניעות (F) מול גישה עניינית, ספקנית ועומדת על שלה (T)',
      weak:false,
      keys:["A6","O3","A3","A2","A4","E1","A1","A5"],
      // Content-mapped ridge weights: Furnham et al. (2003) facet correlations; tools/derive-mbti-content-weights.py
      b300:[0.4485,0.2299,0.0778,0.1238,0.1671,0.1394,0.196,0.1173],
      b120:[0.468,0.1868,0.0819,0.1393,0.1983,0.1494,0.2247,0.1113],
      domainFallback:[['A',0.95],['O',0.15],['E',0.10]],
      // McCrae & Costa (1989), Table 3: TF with A r=.44 (men) / .46 (women), scaled by ~1.04 like EI and SN.
      rLatent:0.47,r300:0.3963,r120:0.3898,rel300:0.922,rel120:0.892,sem300:0.2792,sem120:0.3286,
      tau:-0.06,maxConf:84
    },
    {
      key:'JP',hasPublishedCriterion:true,negative:'P',positive:'J',
      negativeText:'מעדיף גמישות ואילתור',positiveText:'מעדיף תכנון וסדר',
      label:'סגנון התנהלות',
      basis:'סדר וארגון, שיקול דעת מתוכנן, משמעת עצמית ומחויבות מול העדפת גיוון, גמישות וספונטניות',
      weak:false,
      keys:["C2","C6","C5","C3","C4","O4","N5"],
      // Hand-set content weights retained after testing lambda 1.5 and 2.0; metadata is recomputed.
      b300:[0.46,0.28,0.28,0.085,0.05,-0.26,-0.0266],
      b120:[0.5,0.31,0.22,0.105,0.055,-0.26,-0.0265],
      domainFallback:[['C',0.95],['O',-0.26]],
      // McCrae & Costa (1989), Table 3: JP with C r=-.49 (men) / -.46 (women), same scaling.
      rLatent:0.49,r300:0.5528,r120:0.5438,rel300:0.9337,rel120:0.9035,sem300:0.2565,sem120:0.3006,
      tau:-0.08,maxConf:86
    },
    {
      key:'AT',hasPublishedCriterion:false,negative:'A',positive:'T',
      negativeText:'יציב, רגוע ועמיד ללחץ (Assertive)',positiveText:'סוער, רגיש ודרוך (Turbulent)',
      label:'זהות ועמידות בלחץ',
      basis:'רגישות למצבי לחץ, ספק עצמי, דאגנות ומודעות חברתית מול חוסן רגשי, מסוגלות עצמית ואסרטיביות',
      weak:false,
      keys:["N6","N3","N1","N4","N2","N5","C1","E3"],
      b300:[0.3034,0.3111,0.145,0.1473,0.1503,0.0436,-0.0451,-0.0728],
      b120:[0.2667,0.2904,0.1377,0.195,0.2105,0.0714,-0.1345,-0.0694],
      domainFallback:[['N',0.87],['C',-0.15],['E',-0.11]],
      rLatent:0.86,r300:0.757,r120:0.747,rel300:0.9673,rel120:0.9419,sem300:0.1808,sem120:0.2411,
      tau:0.04,maxConf:93
    }
  ];

  // 8 Jungian Cognitive Function Facet Composites — rescaled to exact SD = 1.000 on the N = 145,388
  // cohort (after openness deconfounding for Ni/Ne/Si/Se) in both 300-item and 120-item modes.
  const COG_MODELS=[
    {code:'Ni',label:'אינטואיציה מופנמת',roleHe:'חזון ותובנה מתכנסת',desc:'זיהוי תבניות עומק, משמעות ארוכת טווח וסינתזה פנימית שקטה',
      keys:['O1','O5','C6','C2','O3','E2'],b300:[0.5749,0.4758,0.3767,0.2379,0.0793,-0.2181],b120:[0.603,0.4942,0.3954,0.257,0.0791,-0.2274]},
    {code:'Ne',label:'אינטואיציה מוחצנת',roleHe:'הסתעפות ויצירת אפשרויות',desc:'חיבור מהיר בין רעיונות, סקרנות רב-תחומית ופתיחות לשינוי',
      keys:['O1','O5','O2','O4','E6','E2','C2'],b300:[0.3915,0.3749,0.1666,0.1999,0.1333,0.1916,-0.2582],b120:[0.4275,0.4018,0.1795,0.2137,0.1453,0.2052,-0.2821]},
    {code:'Si',label:'חישה מופנמת',roleHe:'יציבות, דיוק וזיכרון ניסיון',desc:'הישענות על ניסיון מוכח, עקביות, סדר ואמינות בפרטים',
      keys:['C2','C3','C6','O1','O5','O4','E2'],b300:[0.3128,0.2737,0.2151,-0.3324,-0.2542,-0.2151,-0.1466],b120:[0.3319,0.2929,0.2343,-0.3515,-0.2734,-0.2343,-0.1562]},
    {code:'Se',label:'חישה מוחצנת',roleHe:'נוכחות חושית ותגובה מיידית',desc:'קליטה חדה של ההווה, אנרגיית פעולה והתנסות ישירה במציאות',
      keys:['O2','E5','E4','O4','E2','O5','O1','C6','C2'],b300:[0.2533,0.3995,0.2533,0.1754,0.0974,-0.4872,-0.3897,-0.2923,-0.2338],b120:[0.2652,0.4223,0.2652,0.1866,0.108,-0.5107,-0.4125,-0.3143,-0.2554]},
    {code:'Ti',label:'חשיבה מופנמת',roleHe:'ניתוח מבני ועקביות לוגית',desc:'פירוק מושגי ליסודות, דיוק אנליטי ועצמאות מחשבתית',
      keys:['O5','C1','A6','O3','A4','C2','C6','N6','N1','E2'],b300:[0.3037,0.2304,-0.3247,-0.2513,-0.2199,-0.3351,-0.1885,-0.1885,-0.1047,-0.3561],b120:[0.3288,0.2546,-0.3501,-0.2758,-0.2334,-0.3607,-0.2016,-0.2016,-0.1167,-0.3713]},
    {code:'Te',label:'חשיבה מוחצנת',roleHe:'ארגון מערכתי ויעילות ביצועית',desc:'תרגום מטרות לתוכנית סדורה, מדדי ביצוע והובלה עניינית',
      keys:['C4','C1','E3','C2','C5','E2','A6','O3'],b300:[0.2852,0.2472,0.2472,0.2092,0.1901,0.1426,-0.2092,-0.1426],b120:[0.2913,0.2537,0.2537,0.2161,0.1973,0.1504,-0.2161,-0.1504]},
    {code:'Fi',label:'רגש מופנם',roleHe:'מצפן ערכי ואותנטיות פנימית',desc:'נאמנות עמוקה לערכים אישיים, קשב רגשי עדין ויושרה פנימית',
      keys:['O3','A6','O2','A2','E2','C2','C6','E3'],b300:[0.4601,0.3701,0.2501,0.2101,-0.2001,-0.2601,-0.14,-0.15],b120:[0.4615,0.3731,0.2553,0.216,-0.2062,-0.2749,-0.1473,-0.1571]},
    {code:'Fe',label:'רגש מוחצן',roleHe:'הרמוניה, אמפתיה וחיבור אנושי',desc:'רגישות לאקלים הבינאישי, טיפוח שיתוף פעולה ותמיכה בזולת',
      keys:['A4','A3','A6','E1','E2','E6','O3','C3','C2'],b300:[0.2412,0.2498,0.2326,0.2154,0.1551,0.1034,0.1465,0.112,0.1034],b120:[0.2567,0.2652,0.2396,0.2225,0.1626,0.1112,0.154,0.1198,0.1112]}
  ];

  // Canonical Grant-Brownsword 4-function stacks for the 16 types
  const CANONICAL_STACKS={
    INTJ:['Ni','Te','Fi','Se'],INFJ:['Ni','Fe','Ti','Se'],
    ENTP:['Ne','Ti','Fe','Si'],ENFP:['Ne','Fi','Te','Si'],
    ISTJ:['Si','Te','Fi','Ne'],ISFJ:['Si','Fe','Ti','Ne'],
    ESTP:['Se','Ti','Fe','Ni'],ESFP:['Se','Fi','Te','Ni'],
    INTP:['Ti','Ne','Si','Fe'],ISTP:['Ti','Se','Ni','Fe'],
    ENTJ:['Te','Ni','Se','Fi'],ESTJ:['Te','Si','Ne','Fi'],
    INFP:['Fi','Ne','Si','Te'],ISFP:['Fi','Se','Ni','Te'],
    ENFJ:['Fe','Ni','Se','Ti'],ESFJ:['Fe','Si','Ne','Ti']
  };

  // Exact Gaussian CDF Phi(z) (Abramowitz & Stegun 7.1.26, max error < 1.5e-7)
  function normalCdf(z){
    if(Number.isNaN(z))return 0.5;
    if(z===Infinity)return 1;
    if(z===-Infinity)return 0;
    const sign=z<0?-1:1;
    const x=Math.abs(z)/Math.SQRT2;
    const t=1/(1+0.3275911*x);
    const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);
    return 0.5*(1+sign*erf);
  }

  function sigmoid(x){
    if(x>=18)return 1;
    if(x<=-18)return 0;
    return 1/(1+Math.exp(-x));
  }

  function clamp(v,lo,hi){
    return Math.max(lo,Math.min(hi,v));
  }

  // Smooth C^infinity map from standardized latent Z to [0, 100] with exact 50 at Z = 0
  // Slope at origin = 34 pts/SD; +/-1 SD -> 79.5 / 20.5; +/-2 SD -> 93.8 / 6.2
  function zToScore100(z){
    return 50+50*Math.tanh(0.68*z);
  }

  function rawScoreOf(profile,domain,facet){
    const d=profile.domains&&profile.domains[domain];
    if(!d)return null;
    const entry=(facet===null||!Array.isArray(d.facets))?d:d.facets[facet];
    if(!entry)return null;
    const s=(typeof entry.rangeScore==='number'&&Number.isFinite(entry.rangeScore))?entry.rangeScore:entry.score;
    return (typeof s==='number'&&Number.isFinite(s)&&s>=0&&s<=100)?s:null;
  }

  function facetScoreByCode(profile,code){
    const dom=code.charAt(0);
    const idx=Number(code.slice(1))-1;
    return rawScoreOf(profile,dom,idx);
  }

  function detectInventoryMode(profile){
    const hasFacets=Boolean(profile.domains&&profile.domains.N&&Array.isArray(profile.domains.N.facets)&&profile.domains.N.facets.length===6);
    if(!hasFacets){
      const err=new Error('Unsupported Big Five profile without 6 facets per domain; supported modes are 120 and 300');
      err.code='LEGACY_50_DEPRECATED';
      throw err;
    }
    const v=Number(profile.version||(profile.empiricalReference&&profile.empiricalReference.answeredItems)||0);
    if(v===300)return 300;
    if(v===120)return 120;
    const refInst=String((profile.empiricalReference&&profile.empiricalReference.referenceInstrument)||'').toUpperCase();
    if(refInst.includes('300'))return 300;
    if(refInst.includes('120'))return 120;
    // Check raw sum range on N domain or N1 facet if available (300-item facet raw max is 50; 120-item max is 20)
    const n1Raw=profile.domains.N.facets[0]&&profile.domains.N.facets[0].raw;
    if(typeof n1Raw==='number'&&n1Raw>20)return 300;
    const nDomRaw=profile.domains.N.raw;
    if(typeof nDomRaw==='number'&&nDomRaw>120)return 300;
    return 120;
  }

  function standardFacetZ(rawVal,normTuple){
    return (rawVal-normTuple[0])/normTuple[1];
  }

  function findViaDirectStrengthScore(via,key){
    if(!via||!Array.isArray(via.strengths))return null;
    for(let i=0;i<via.strengths.length;i++){
      const s=via.strengths[i];
      if(!s||s.key!==key)continue;
      if(typeof s.directScore==='number'&&Number.isFinite(s.directScore))return s.directScore;
      if(via.type==='direct'&&typeof s.score==='number'&&Number.isFinite(s.score))return s.score;
      return null;
    }
    return null;
  }

  function evaluateAxisQualitativeNote(profile,key,value,zMap){
    if(key==='EI'){
      const e2=rawScoreOf(profile,'E',1),e3=rawScoreOf(profile,'E',2),e4=rawScoreOf(profile,'E',3);
      if(value<50&&e2!==null&&e3!==null&&e2<=35&&e3>=66&&(e4===null||e4>=58)){
        return 'נטייה ל־I לצד אסרטיביות גבוהה (E3): התשובות מראות העדפה לשקט ולעבודה עצמאית (E2 נמוך) יחד עם הבעת עמדה נחושה (E3 גבוה).';
      }
      if(value>50&&zMap.E1>0.6&&zMap.E2<-0.4){
        return 'נטייה ל־E דרך קשרים קרובים: התשובות משלבות חמימות בקשר אישי (E1) עם העדפה למפגשים מצומצמים (E2 מתון).';
      }
      return null;
    }
    if(key==='SN'){
      const o1=rawScoreOf(profile,'O',0),o2=rawScoreOf(profile,'O',1),o3=rawScoreOf(profile,'O',2),o4=rawScoreOf(profile,'O',3),o5=rawScoreOf(profile,'O',4),c2=rawScoreOf(profile,'C',1),c1=rawScoreOf(profile,'C',0);
      if(value>50&&o1!==null&&o4!==null&&o1>=78&&(o3===null||o3>=68)&&o4<=45&&(c2===null||c2>=45)){
        return 'נטייה ל־N דרך דמיון ורגש (O1, O3) לצד העדפה ליציבות בשגרה (O4 מתון).';
      }
      if(value>50&&o5!==null&&o2!==null&&o5>=78&&o2<=48){
        return 'נטייה ל־N דרך סקרנות רעיונית (O5 גבוה) גם בלי עניין מיוחד באסתטיקה ואמנות (O2 מתון).';
      }
      if(value>50&&o1!==null&&o4!==null&&o1>=68&&o4<=42&&(c1===null||c1<=50)){
        return 'נטייה ל־N דרך דמיון, רגש ורעיונות (O1, O3, O5) לצד העדפה לסביבה מוכרת וזהירות (O4, C1).';
      }
      return null;
    }
    if(key==='TF'){
      const a6=rawScoreOf(profile,'A',5),o3=rawScoreOf(profile,'O',2),a3=rawScoreOf(profile,'A',2);
      const c6=rawScoreOf(profile,'C',5),o5=rawScoreOf(profile,'O',4),c1=rawScoreOf(profile,'C',0);
      if([a6,o3,a3,c6,o5,c1].every(v=>v!==null)){
        const empathyMean=(a6+o3+a3)/3;
        const logicMean=(c6+o5+c1)/3;
        if(empathyMean>=72&&logicMean>=75){
          return value>50
            ?'התשובות משלבות ציונים גבוהים באמפתיה ורגישות (A6, O3) יחד עם שיקול דעת ואנליזה (C6, C1); החישוב נוטה לכיוון F.'
            :'התשובות משלבות ציונים גבוהים באנליזה ושקול־דעת (C6, O5) יחד עם אמפתיה ואכפתיות (A6, A3); החישוב נוטה לכיוון T.';
        }
      }
      return null;
    }
    if(key==='JP'){
      const c2=rawScoreOf(profile,'C',1),c3=rawScoreOf(profile,'C',2),c4=rawScoreOf(profile,'C',3),c6=rawScoreOf(profile,'C',5);
      if(value>50&&c2!==null&&c6!==null&&c2>=80&&c6>=80&&(c3===null||c3>=80)){
        return 'נטייה ל־J: התשובות מראות הקפדה גבוהה על סדר, מחויבות ובדיקה מראש (C2, C3, C6).';
      }
      if(value<50&&c4!==null&&c2!==null&&c4>=78&&c2<=45){
        return 'שאיפה להישגים ויעדים (C4) לצד העדפת גמישות על פני סדר נוקשה (C2 נמוך); החישוב נוטה לכיוון P.';
      }
      return null;
    }
    if(key==='AT'){
      const n1=rawScoreOf(profile,'N',0),n2=rawScoreOf(profile,'N',1),n3=rawScoreOf(profile,'N',2),
            n4=rawScoreOf(profile,'N',3),n5=rawScoreOf(profile,'N',4),n6=rawScoreOf(profile,'N',5);
      const c1=rawScoreOf(profile,'C',0),c6=rawScoreOf(profile,'C',5);
      if([n1,n2,n3,n4,n6,c1].some(v=>v===null))return null;
      if((n1>=60||n4>=65)&&n6<=45&&n3<=35&&n2<=35&&c1>=75&&(c6===null||c6>=70)){
        return 'התשובות מראות ביטחון ומסוגלות (C1, N3/N6 נמוכים) לצד דאגנות מתונה או מודעות חברתית (N1/N4).';
      }
      if(n6>=58&&n1>=62&&(n3>=52||c1<=45)&&n2<=40&&(n5===null||n5<=45)){
        return 'לצד איפוק בכעס (N2 נמוך), קיימת רגישות מוגברת לדאגה ועומס (N1, N6).';
      }
    }
    return null;
  }

  // Severe straight-lining or suspected random responding: the answers carry no usable trait signal,
  // so no letter, type, alternatives or cognitive-function ranking is issued.
  function isValiditySuspended(validity){
    return Boolean(validity&&typeof validity==='object'&&(validity.validityLevel==='low'||validity.isSevereStraightline||validity.isSuspectedRandomResponding));
  }

  function computeValiditySemMultiplier(validity){
    if(!validity||typeof validity!=='object')return 1.0;
    let mult=1.0;
    if(validity.isSevereStraightline)mult*=1.65;
    else if(validity.isModerateStraightline)mult*=1.30;
    if(validity.isHighDiscrepancy||(typeof validity.avgDiscrepancy==='number'&&validity.avgDiscrepancy>=1.65)){
      mult*=1.18;
    }
    // Acquiescence (and disacquiescence, which the same flag covers) is a separate response-style
    // problem, so it is not absorbed by a high-discrepancy flag.
    if(validity.isAcquiescenceBias){
      mult*=1.15;
    }
    if(validity.isInconsistentSynonyms){
      mult*=1.12;
    }
    if(validity.isErraticPersonFit){
      mult*=1.15;
    }
    return clamp(mult,1.0,2.1);
  }

  function getDeepModels(){
    if(root&&root.OfiEmpiricalDeep&&root.OfiEmpiricalDeep.data)return root.OfiEmpiricalDeep;
    if(typeof require==='function'){
      try{return require('./empirical-deep-models.js');}catch(_e){}
    }
    return null;
  }

  function estimate(profile){
    if(!profile||!profile.domains)throw new Error('Missing complete Big Five profile');
    const mode=detectInventoryMode(profile);
    const isFacetMode=true;
    const norms=EMPIRICAL_NORMS[mode];
    const validityMult=computeValiditySemMultiplier(profile.validityFeatures);
    const validitySuspended=isValiditySuspended(profile.validityFeatures);

    // Detect directly completed supplementary instruments (never double-count Big Five proxies)
    const hexDirect=(profile.hexacoHonesty&&profile.hexacoHonesty.type==='direct'&&typeof profile.hexacoHonesty.score==='number')
      ?profile.hexacoHonesty:null;
    const ecrrsDirect=(profile.ecrrsScores&&typeof profile.ecrrsScores.anxiety100==='number'&&typeof profile.ecrrsScores.avoidance100==='number')
      ?profile.ecrrsScores:null;
    const viaDirect=(profile.viaStrengths&&(profile.viaStrengths.type==='composite'||profile.viaStrengths.type==='direct'))
      ?profile.viaStrengths:null;

    const viaKindness=viaDirect?findViaDirectStrengthScore(viaDirect,'kindness'):null;
    const viaLove=viaDirect?findViaDirectStrengthScore(viaDirect,'love'):null;
    const viaJudgment=viaDirect?findViaDirectStrengthScore(viaDirect,'judgment'):null;
    const hasViaDirectTF=(viaKindness!==null&&viaLove!==null&&viaJudgment!==null);

    const multiInstrumentSources=[];
    if(hexDirect)multiInstrumentSources.push('HEXACO-H');
    if(ecrrsDirect)multiInstrumentSources.push('ECR-RS');
    if(hasViaDirectTF)multiInstrumentSources.push('IPIP-VIA-R');

    // Pre-validate all required inputs; cohort standardization is unconditional.
    const rawFacetCache={};
    const allKeys=Object.keys(norms);
    for(let i=0;i<allKeys.length;i++){
      const k=allKeys[i];
      const v=facetScoreByCode(profile,k);
      if(v===null)throw new Error('Incomplete Big Five scores');
      rawFacetCache[k]=v;
    }
    const openSub=(profile.opennessConstructs&&profile.opennessConstructs.mode===mode
      &&typeof profile.opennessConstructs.ideasZ==='number'&&Number.isFinite(profile.opennessConstructs.ideasZ)
      &&typeof profile.opennessConstructs.fantasyZ==='number'&&Number.isFinite(profile.opennessConstructs.fantasyZ)
      &&typeof profile.opennessConstructs.aesthZ==='number'&&Number.isFinite(profile.opennessConstructs.aesthZ)
      &&typeof profile.opennessConstructs.varietyZ==='number'&&Number.isFinite(profile.opennessConstructs.varietyZ))
      ?profile.opennessConstructs:null;

    function deconfoundOpenness(baseO){
      const zC1=standardFacetZ(rawFacetCache.C1,norms.C1);
      const zA5=standardFacetZ(rawFacetCache.A5,norms.A5);
      const zC5=standardFacetZ(rawFacetCache.C5,norms.C5);
      let o1=baseO.O1,o2=baseO.O2,o3=baseO.O3,o4=baseO.O4,o5=baseO.O5;
      if(mode===300){
        o5=clamp(o5-Math.min(0,0.20*zC1-0.08*zA5+0.05*zC5),-3.5,3.5);
        o2=clamp(o2-Math.min(0,0.05*zC1),-3.5,3.5);
      }else{
        o5=clamp(o5-Math.min(0,0.10*zC1-0.04*zA5+0.03*zC5),-3.5,3.5);
        o2=clamp(o2-Math.min(0,0.04*zC1),-3.5,3.5);
      }
      if(openSub){
        if(mode===300){
          o5=0.65*openSub.ideasZ+0.35*o5;
          o1=0.50*openSub.fantasyZ+0.50*o1;
          o2=0.50*openSub.aesthZ+0.50*o2;
          o4=0.55*openSub.varietyZ+0.45*o4;
        }else{
          o5=0.55*openSub.ideasZ+0.45*o5;
          o2=0.40*openSub.aesthZ+0.60*o2;
          o4=0.40*openSub.varietyZ+0.60*o4;
        }
      }
      return {O1:o1,O2:o2,O3:o3,O4:o4,O5:o5};
    }

    const globalZMap={};
    const cogZMap={};
    const neZMap={};
    for(let i=0;i<allKeys.length;i++){
      const k=allKeys[i];
      globalZMap[k]=standardFacetZ(rawFacetCache[k],norms[k]);
      cogZMap[k]=globalZMap[k];
    }
    {
      const decCog=deconfoundOpenness(globalZMap);
      cogZMap.O1=decCog.O1;cogZMap.O2=decCog.O2;cogZMap.O3=decCog.O3;cogZMap.O4=decCog.O4;cogZMap.O5=decCog.O5;
      Object.assign(neZMap,cogZMap);
      const zC6Cog=globalZMap.C6;
      const niGateCog=sigmoid((cogZMap.O1-0.55)*3.2)*sigmoid((zC6Cog-0.35)*2.8);
      const ntGateCog=sigmoid((cogZMap.O5-0.60)*3.2)*sigmoid((cogZMap.O1+0.05)*2.5);
      const o2ProtCog=clamp(Math.max(0.65*niGateCog*sigmoid((cogZMap.O3-0.10)*2.5),0.72*ntGateCog),0,0.75);
      if(neZMap.O2<0)neZMap.O2*=(1-o2ProtCog);
    }

    const axes=definitions.map(def=>{
      let zAxis=0;
      let oneItemEquivalentEvidence=false;
      let conflictVariance=0;
      let axisDispersion=0;
      // Direct supplementary instruments (HEXACO-H, ECR-RS, VIA) enter the axis with 4-6% weights below.
      // That is far less than one keyed facet answer, so they never unlock a letter on their own: with
      // midpoint facet answers the letter would come from the norm offset and tau, not from evidence.
      let semZ=mode===300?def.sem300:def.sem120;
      let mosierRel=mode===300?def.rel300:def.rel120;

      if(isFacetMode){
        const betas=mode===300?def.b300:def.b120;
        let wVarNum=0,wVarDen=0;
        for(let i=0;i<def.keys.length;i++){
          const k=def.keys[i];
          const wAbs=Math.abs(betas[i]);
          const diff=rawFacetCache[k]-50;
          wVarNum+=wAbs*diff*diff;
          wVarDen+=wAbs;
        }
        const axisVar=wVarDen>0?(wVarNum/wVarDen):0;
        // The largest variance generated by ONE keyed answer tick from an
        // otherwise neutral facet vector. A stronger apparent result with
        // no more than one-item-equivalent evidence is insufficient to
        // justify a deterministic letter or a non-neutral probability.
        // This is a measurement-resolution limit, not an MBTI criterion fit.
        const itemStep=mode===300?2.5:6.25;
        const largestDirectWeight=Math.max(...betas.map(x=>Math.abs(x)));
        const oneItemVariance=(largestDirectWeight/(wVarDen||1))*itemStep*itemStep;
        oneItemEquivalentEvidence=axisVar<=oneItemVariance+1e-8;

        const localZ={};
        for(let i=0;i<def.keys.length;i++){
          const k=def.keys[i];
          localZ[k]=standardFacetZ(rawFacetCache[k],norms[k]);
        }

        const evidenceMean=def.keys.reduce((sum,k,i)=>sum+betas[i]*localZ[k],0)/(wVarDen||1);
        const dispersion=def.keys.reduce((sum,k,i)=>sum+Math.abs(betas[i])*Math.pow(Math.sign(betas[i])*localZ[k]-evidenceMean,2),0)/(wVarDen||1);
        axisDispersion=dispersion;
        // Small bounded uncertainty allowance, not a change to the scoring direction.
        conflictVariance=0.04*Math.min(4,dispersion);

        // Smooth C^1 configural moderators & measurement-halo deconfounding (monotone in the signed content facets before the explicit neutral guard):
        if(def.key==='EI'){
          // Assertive Introvert moderator: when E2 (gregariousness) is low, high E3 (leadership/decisiveness) does not flip I to E
          const introGate=sigmoid((-localZ.E2-0.45)*3.0);
          if(localZ.E3>0){
            localZ.E3*=(1-0.65*introGate);
          }
        }else if(def.key==='SN'){
          const decSN=deconfoundOpenness(localZ);
          localZ.O1=decSN.O1;localZ.O2=decSN.O2;localZ.O3=decSN.O3;localZ.O4=decSN.O4;localZ.O5=decSN.O5;
          const zO1=localZ.O1,zO5=localZ.O5,zO3=localZ.O3;
          const zC6=standardFacetZ(rawFacetCache.C6,norms.C6);
          // 1) Convergent Visionary Intuition (Ni): High O1 + High C6 protects INFJ/INTJ with routine preference (low O4)
          const niGate=sigmoid((zO1-0.55)*3.2)*sigmoid((zC6-0.35)*2.8);
          if(localZ.O4<0){
            localZ.O4*=(1-clamp(0.85*niGate,0,0.85));
          }
          // 2) Theoretical/STEM Intuition (NT) & Visionary Ni protection on low Aesthetics (O2)
          const ntGate=sigmoid((zO5-0.60)*3.2)*sigmoid((zO1+0.05)*2.5);
          const o2Protect=clamp(Math.max(0.65*niGate*sigmoid((zO3-0.10)*2.5),0.72*ntGate),0,0.75);
          if(localZ.O2<0){
            localZ.O2*=(1-o2Protect);
          }
        }else if(def.key==='JP'){
          // 5) Deliberate/Homebody Perceiver moderator: for unstructured (low C2, low C5) introverted/analytical profiles,
          //    cognitive deliberation (C6) and low sensation-seeking (-O4) do not artificially flip INTP/ISTP into J
          const zE2=standardFacetZ(rawFacetCache.E2,norms.E2);
          const zO5=standardFacetZ(rawFacetCache.O5,norms.O5);
          const pGate=sigmoid((-localZ.C2-0.25)*2.8)*sigmoid((-localZ.C5-0.15)*2.5)*sigmoid((zO5-zE2-0.20)*2.0);
          if(localZ.C6>0){
            localZ.C6*=(1-0.60*pGate);
          }
          if(localZ.O4<0){
            localZ.O4*=(1-0.65*pGate);
          }
        }

        for(let i=0;i<def.keys.length;i++){
          zAxis+=betas[i]*localZ[def.keys[i]];
        }
        zAxis+=def.tau;
      }

      // Supplementary instrument indications (direct instruments only; never double-count Big Five proxies or shrink SEM unempirically)
      if(def.key==='TF'&&hexDirect){
        const zHex=(hexDirect.score-57.25)/15.50;
        zAxis=0.95*zAxis+0.05*zHex;
      }
      if(ecrrsDirect){
        const zAvoid=(ecrrsDirect.avoidance100-36.33)/22.83;
        const zAnx=(ecrrsDirect.anxiety100-37.50)/29.67;
        if(def.key==='AT'){
          zAxis=0.95*zAxis+0.06*zAnx;
        }else if(def.key==='EI'){
          zAxis=0.97*zAxis-0.04*zAvoid;
        }else if(def.key==='TF'){
          zAxis=0.97*zAxis-0.04*zAvoid;
        }
      }
      if(def.key==='TF'&&hasViaDirectTF){
        const zViaTF=(0.5*(viaKindness+viaLove)-viaJudgment)/18;
        zAxis=0.96*zAxis+0.04*zViaTF;
      }

      const baseRel=mosierRel;
      semZ=Math.round(semZ*validityMult*1000)/1000;
      // Validity problems inflate the error SD by validityMult, so error variance scales by validityMult^2.
      const effRel=clamp(1-(1-baseRel)*validityMult*validityMult,0.10,0.98);
      mosierRel=Math.round(Math.min(baseRel,effRel)*100)/100;

      const rawContinuous=zToScore100(zAxis);
      const value=Math.round(rawContinuous*10)/10;
      const ciLow=Math.round(clamp(zToScore100(zAxis-1.96*semZ),0,value)*10)/10;
      const ciHigh=Math.round(clamp(zToScore100(zAxis+1.96*semZ),value,100)*10)/10;

      const distance=Math.round(Math.abs(value-50)*10)/10;
      const tied=distance<0.05;
      // No letter when the facet evidence is below one item, or when response validity is too low to interpret.
      const noEvidence=oneItemEquivalentEvidence||validitySuspended;
      const letter=noEvidence?'?':(tied?'?':value>50?def.positive:def.negative);

      // Mode-specific implied validity already includes measurement attenuation.
      // Mosier: validity attenuates with sqrt(reliability), so rescale by sqrt(effRel/baseRel).
      const baseR=mode===300?def.r300:def.r120;
      const rEff=clamp(baseR*Math.sqrt(effRel/Math.max(0.01,baseRel)),0.30,0.86);
      const zCond=(rEff*zAxis)/Math.sqrt(1-rEff*rEff+conflictVariance);
      const cap=def.maxConf/100;
      const pPositive=(noEvidence||tied)?0.5:clamp(normalCdf(zCond),1-cap,cap);
      const pActive=(noEvidence||tied)?0.5:(value>50?pPositive:1-pPositive);
      const classificationConsistency=Math.round(pActive*100);

      // Borderline: the letter is close to the midpoint. Comparing the two inventory forms (120 vs 300),
      // a letter in this zone flips in roughly 30% or more of cases (reproduced < 70%; tools/math-review.py),
      // so both directions are worth reading. This is cross-form agreement, not test-retest over time.
      const borderline=!noEvidence&&!tied&&distance<BORDERLINE_DISTANCE[mode][def.key];
      const qualitativeNote=isFacetMode?evaluateAxisQualitativeNote(profile,def.key,value,globalZMap):null;
      const ciCrossesMid=(ciLow<=50&&ciHigh>=50);
      const unclear=noEvidence||distance<9||(ciCrossesMid&&(validityMult>1.15||classificationConsistency<57));
      // Unified 3-level uncertainty summary ('borderline' < 'moderate' < 'clear') alongside legacy flags
      const uncertaintyTier=(tied||noEvidence||borderline)?'borderline':((unclear||ciCrossesMid)?'moderate':'clear');
      const ciMidSuffix=ciCrossesMid?' גם הכיוון השני נשאר רלוונטי.':'';
      const dispersionNote=(!noEvidence&&!tied&&axisDispersion>=1.0)?' קיים פער בולט בין תתי־התכונות המרכיבות ציר זה — חלקן מושכות לכיוון אחד וחלקן לכיוון הנגדי, ולכן מומלץ להתבונן בתתי־התכונות עצמן ולא רק באות המסכמת.':'';

      const deep=getDeepModels();
      const axisKnots=isFacetMode?deep?.data?.lab?.[String(mode)]?.cdfs?.mbtiAxes?.[def.key]:null;
      // A midpoint decision boundary is not necessarily the cohort median.
      // Never label a Gaussian approximation as an observed empirical percentile.
      const empPctRaw=(deep&&axisKnots)?deep.cdfLookup(zAxis,axisKnots):null;
      const empiricalPercentile=Number.isFinite(empPctRaw)
        ?Math.round(clamp(empPctRaw,0.1,99.9)*10)/10:null;
      const empiricalPolePercentile=(empiricalPercentile===null||tied)?null:
        Math.round((value>50?empiricalPercentile:(100-empiricalPercentile))*10)/10;

      const baseMsg=validitySuspended?'איכות המענה נמוכה מדי (מענה אחיד או חשד למענה אקראי), ולכן לא נבחר כאן אות.':
        oneItemEquivalentEvidence?'התשובות קרובות למרכז, ולכן לא נבחר כאן אות.':
        tied?'כרגע אין כיוון בולט בין שתי האפשרויות.':
        unclear?'קרוב לאמצע — כדאי לקרוא את שני הכיוונים.':
        qualitativeNote?(qualitativeNote+ciMidSuffix):
        ciCrossesMid?'החישוב נוטה לכיוון '+letter+' (סבירות '+classificationConsistency+'%), אך טווח הסמך עדיין חוצה את האמצע, ולכן הכיוון אינו ודאי.':
        def.weak?'זו דרך נוספת לקרוא את התשובות, לא מדידה נפרדת.':
        'החישוב מצביע על נטייה לכיוון '+letter+'.';

      return {
        key:def.key,
        label:def.label,
        letter,
        alternatives:def.negative+' / '+def.positive,
        negative:def.negative,
        positive:def.positive,
        negativeText:def.negativeText,
        positiveText:def.positiveText,
        basis:def.basis,
        hasPublishedCriterion:def.hasPublishedCriterion,
        score:value,
        z:Math.round(zAxis*1000)/1000,
        semZ,
        dispersion:Math.round(axisDispersion*1000)/1000,
        conflictVariance:Math.round(conflictVariance*1000000)/1000000,
        ci95:[ciLow,ciHigh],
        empiricalPercentile,
        empiricalPolePercentile,
        mosierReliability:mosierRel,
        constructR:def.hasPublishedCriterion?Math.round(baseR*10000)/10000:null,
        poleProbability:pPositive,
        classificationConsistency,
        criterionAgreementPct:def.hasPublishedCriterion?classificationConsistency:null,
        uncertaintyTier,
        oneItemEquivalentEvidence,
        validitySuspended,
        unclear,
        borderline,
        alternativeLetter:(borderline&&letter!=='?')?(letter===def.positive?def.negative:def.positive):null,
        ciCrossesMidline:ciCrossesMid,
        message:baseMsg+dispersionNote,
        basisLimit:def.weak
      };
    });

    const fourAxes=axes.slice(0,4);
    const hasUnknownFour=fourAxes.some(a=>a.letter==='?');
    const fourType=fourAxes.map(a=>a.letter).join('');
    const fifthLetter=axes[4]?axes[4].letter:null;
    const type=fourType+(fifthLetter?'-'+fifthLetter:'');
    const hasUnknown=axes.some(a=>a.letter==='?');
    const unclearCount=axes.filter(a=>a.unclear).length;
    const ciCrossCount=axes.filter(a=>a.ciCrossesMidline).length;
    const borderlineAxes=axes.filter(a=>a.borderline);
    // e.g. "INF(P/J)-T": each borderline letter is shown with its alternative.
    const markLetter=a=>a.borderline?'('+a.letter+'/'+a.alternativeLetter+')':a.letter;
    const borderlineDisplay=fourAxes.map(markLetter).join('')+(axes[4]?'-'+markLetter(axes[4]):'');

    // R^2-weighted average model criterion-match probability across determined 4 MBTI axes
    // (excludes A/T, which has no external MBTI criterion).
    const knownFourAxes=fourAxes.filter(a=>a.letter!=='?'&&a.hasPublishedCriterion&&typeof a.constructR==='number');
    let compositeConsistency=50;
    if(knownFourAxes.length>0){
      let wSum=0,wTot=0;
      for(let i=0;i<knownFourAxes.length;i++){
        const a=knownFourAxes[i];
        const w=a.constructR*a.constructR;
        wSum+=a.classificationConsistency*w;
        wTot+=w;
      }
      compositeConsistency=Math.round(wSum/(wTot||1));
    }

    // 16-Type Relative Model Probability Distribution given the 30-facet profile vector.
    // Note: multiplies the 4 axis probabilities under conditional axis independence (so the #1 MAP type
    // always equals the 4-letter axis outcome); observed joint cohort prevalences are reported separately.
    // This product is a relative ranking index only, never a joint 4-letter probability shown to the user.
    const deepRef=getDeepModels();
    const labPrevs=isFacetMode?deepRef?.data?.lab?.[String(mode)]?.prevalences:null;
    const pPos=fourAxes.map(a=>a.poleProbability);
    const negLetters=fourAxes.map(a=>a.negative);
    const posLetters=fourAxes.map(a=>a.positive);
    const typeList=[];
    for(let mask=0;mask<16;mask++){
      let code='';
      let prob=1;
      for(let bit=0;bit<4;bit++){
        const isPos=((mask>>(3-bit))&1)===1;
        code+=isPos?posLetters[bit]:negLetters[bit];
        prob*=isPos?pPos[bit]:(1-pPos[bit]);
      }
      const code5=fifthLetter&&fifthLetter!=='?'?(code+'-'+fifthLetter):code;
      typeList.push({
        fourType:code,
        type:code5,
        probability:prob,
        pct:Math.round(prob*1000)/10,
        cohortPrevalence4:labPrevs?.mbti16?.[code]??null,
        cohortPrevalence5:(fifthLetter&&fifthLetter!=='?'&&labPrevs?.mbti32?.[code5]!=null)?labPrevs.mbti32[code5]:null
      });
    }
    typeList.sort((a,b)=>{
      if(Math.abs(b.probability-a.probability)>1e-9)return b.probability-a.probability;
      if(!hasUnknownFour&&a.fourType===fourType)return -1;
      if(!hasUnknownFour&&b.fourType===fourType)return 1;
      return a.fourType.localeCompare(b.fourType);
    });
    const typeProbabilities={};
    for(let i=0;i<typeList.length;i++){
      typeProbabilities[typeList[i].fourType]=Math.round(typeList[i].probability*10000)/10000;
    }

    // 8 Jungian Cognitive Functions (computed on 120 / 300 facet profiles)
    let cognitiveFunctions=null;
    if(isFacetMode&&!validitySuspended){
      const cogItems=COG_MODELS.map(m=>{
        const betas=mode===300?m.b300:m.b120;
        const zSource=m.code==='Ne'?neZMap:((m.code==='Ni'||m.code==='Si'||m.code==='Se')?cogZMap:globalZMap);
        let zFn=0;
        for(let i=0;i<m.keys.length;i++){
          zFn+=betas[i]*zSource[m.keys[i]];
        }
        const score=Math.round(zToScore100(zFn)*10)/10;
        return {
          code:m.code,
          label:m.label,
          roleHe:m.roleHe,
          desc:m.desc,
          z:Math.round(zFn*1000)/1000,
          score
        };
      });
      const ranked=[...cogItems].sort((a,b)=>b.score!==a.score?(b.score-a.score):(b.z-a.z));
      ranked.forEach((fn,idx)=>{fn.rank=idx+1;});
      const byCode=Object.fromEntries(cogItems.map(fn=>[fn.code,fn]));
      const stackCodes=(!hasUnknownFour&&CANONICAL_STACKS[fourType])?CANONICAL_STACKS[fourType]:null;
      const canonicalStack=stackCodes?stackCodes.map((c,idx)=>({
        slot:idx+1,
        slotLabel:['ראשונה בסדר של המודל','שנייה בסדר של המודל','שלישית בסדר של המודל','רביעית בסדר של המודל'][idx],
        code:c,
        label:byCode[c].label,
        roleHe:byCode[c].roleHe,
        score:byCode[c].score
      })):null;
      let stackCoherenceNote=null;
      if(canonicalStack&&canonicalStack.length>=2){
        const domSlot=canonicalStack[0],auxSlot=canonicalStack[1];
        const eiAx=axes[0];
        const altEntry=typeList.length>=2?typeList[1]:null;
        const borderlineAxes=fourAxes.filter(a=>a.ciCrossesMidline||a.unclear);
        const shouldExplain=(fourType.charAt(0)==='I'&&auxSlot.score<45&&eiAx.score<32)
          ||(fourType.charAt(0)==='E'&&auxSlot.score<45&&eiAx.score>68)
          ||(ranked[0].code!==domSlot.code)
          ||(ranked.length>1&&ranked[1].code!==auxSlot.code)
          ||(borderlineAxes.length>0&&altEntry&&altEntry.pct>=18);
        if(shouldExplain){
          const borderPart=(borderlineAxes.length>0&&altEntry)
            ?(' ציר '+borderlineAxes.map(a=>a.label).join('/')+' קרוב לאמצע, ולכן כדאי לקרוא גם את החלופה הקרובה '+altEntry.type+'.')
            :'';
          stackCoherenceNote='סדר התיאורים לפי האותיות עשוי להיות שונה מהסדר שמתקבל מחמש התכונות. אלה שתי דרכי הצגה, לא מדידה של יכולות חשיבה.'+borderPart;
        }
      }
      cognitiveFunctions={
        functions:cogItems,
        ranked,
        // Free ranking from the facets. These are rank positions, not the structural Jungian
        // dominant/auxiliary of the type; those live in canonicalStack.
        dominant:ranked[0],
        secondRanked:ranked[1],
        canonicalStack,
        stackSummaryHe:stackCodes?stackCodes.join(' → '):null,
        stackCoherenceNote
      };
    }

    const cohortPrevalence4=(!hasUnknownFour&&labPrevs?.mbti16&&typeof labPrevs.mbti16[fourType]==='number')?labPrevs.mbti16[fourType]:null;
    const cohortPrevalence5=(!hasUnknown&&labPrevs?.mbti32&&typeof labPrevs.mbti32[type]==='number')?labPrevs.mbti32[type]:null;
    const cohortN=labPrevs?(mode===120?(deepRef?.data?.source?.mbti120CohortN||145388):(deepRef?.data?.source?.n300||145388)):null;


    return {
      type:hasUnknown?null:type,
      displayType:hasUnknown?fourType+(fifthLetter?'-'+fifthLetter:''):type,
      fourType:hasUnknownFour?null:fourType,
      fifthLetter,
      axes,
      unclearCount,
      ciCrossCount,
      borderlineCount:borderlineAxes.length,
      borderlineDisplay,
      inventoryMode:mode,
      compositeConsistency,
      cohortPrevalence4,
      cohortPrevalence5,
      cohortN,
      topTypes:validitySuspended?[]:typeList.slice(0,4),
      validitySuspended,
      typeProbabilities,
      cognitiveFunctions,
      multiInstrumentSources,
      version:'five-letter-estimate-v5',
      status:validitySuspended?'suspended':hasUnknown?'inconclusive':unclearCount>=2?'mixed':'estimate',
      notice:'האותיות הן דרך נוספת לקרוא את תשובותיך לחמש התכונות, ולא תוצאה של שאלון MBTI. התגובה ללחץ מוצגת בנפרד.'
    };
  }

  const api={estimate,definitions,normalCdf,EMPIRICAL_NORMS,CANONICAL_STACKS,BORDERLINE_DISTANCE};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.OfiFourLetters=api;
})(typeof window!=='undefined'?window:globalThis);

