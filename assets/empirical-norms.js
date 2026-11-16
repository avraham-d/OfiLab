/* Independent original-cohort empirical percentiles: 120 (N=410376) and 300 (N=145388). */
(function(root){
  'use strict';
  const ORDER=['N','E','O','A','C'];
  const LEVELS=['נמוך','ממוצע','גבוה'];
  const ALPHAS={
    120:{
      N:0.9015,N1:0.7863,N2:0.8710,N3:0.8561,N4:0.7188,N5:0.7059,N6:0.7711,
      E:0.8932,E1:0.8180,E2:0.7991,E3:0.8553,E4:0.7056,E5:0.7443,E6:0.8068,
      O:0.8251,O1:0.7578,O2:0.7528,O3:0.6639,O4:0.7124,O5:0.7510,O6:0.6486,
      A:0.8597,A1:0.8609,A2:0.7498,A3:0.7488,A4:0.7145,A5:0.7439,A6:0.7259,
      C:0.9062,C1:0.7813,C2:0.8381,C3:0.6830,C4:0.8042,C5:0.7264,C6:0.8808
    },
    300:{
      N:0.9555,N1:0.8649,N2:0.9139,N3:0.9160,N4:0.8317,N5:0.7841,N6:0.8602,
      E:0.9434,E1:0.8901,E2:0.8911,E3:0.8617,E4:0.7245,E5:0.8488,E6:0.8436,
      O:0.9069,O1:0.8548,O2:0.8114,O3:0.7881,O4:0.8166,O5:0.8516,O6:0.7840,
      A:0.9200,A1:0.8846,A2:0.7891,A3:0.8386,A4:0.7737,A5:0.7783,A6:0.7850,
      C:0.9466,C1:0.8287,C2:0.8581,C3:0.8008,C4:0.8397,C5:0.8939,C6:0.8463
    }
  };
  // Stratified alpha across the 6 facet strata per broad domain (avoids unidimensional Cronbach alpha SEM inflation).
  // alpha_strat = 1 - sum_f var_f*(1-alpha_f) / var_X, with every term from the same sample:
  // The 120 stratified domain SEM uses original N=410376 respondent variances; 300 uses N=145388.
  const STRATIFIED_DOMAIN_ALPHAS={
    120:{N:0.9301,E:0.9255,O:0.8700,A:0.9019,C:0.9356},
    300:{N:0.9639,E:0.9546,O:0.9253,A:0.9333,C:0.9560}
  };
  const caches=new WeakMap();
  const statsCaches=new WeakMap();
  function getDeepModels(){
    if(root&&root.OfiEmpiricalDeep)return root.OfiEmpiricalDeep;
    if(typeof module!=='undefined'&&module.exports&&typeof require==='function'){
      try{return require('./empirical-deep-models.js');}catch(_){}
    }
    return null;
  }
  function getFacetCi(){
    if(root&&root.OfiIrtFacetScoreCi)return root.OfiIrtFacetScoreCi;
    if(typeof module!=='undefined'&&module.exports&&typeof require==='function'){
      try{return require('./irt-facet-score-ci.js');}catch(_){}
    }
    return null;
  }
  function getProfileLinks(){
    if(root&&root.OfiProfileLinks)return root.OfiProfileLinks;
    if(typeof module!=='undefined'&&module.exports&&typeof require==='function'){
      try{return require('./profile-links.js');}catch(_){}
    }
    return null;
  }
  function validate(data){
    const v=data?.version;
    if(!data||Object.keys(data.scales||{}).length!==35)
      throw Error('נתוני ההשוואה אינם תקינים.');
    if(v==='johnson-120-empirical-pooled-v1'||v==='johnson-120-empirical-combined-v2'){
      const expectedN=v==='johnson-120-empirical-combined-v2'?555764:410376;
      if(data.n!==expectedN)throw Error('נתוני ההשוואה אינם תקינים.');
      if(v==='johnson-120-empirical-combined-v2'&&
        (data.cohorts?.ipipNeo120Complete!==410376||data.cohorts?.ipipNeo300Mapped120Complete!==145388))
        throw Error('הרכב מדגם ההשוואה אינו תקין.');
      for(const d of ORDER)for(const code of [d,...[1,2,3,4,5,6].map(f=>d+f)]){
        const scale=data.scales[code],min=code.length===1?24:4;
        if(!scale||scale.min!==min||!Array.isArray(scale.counts)||scale.counts.length!==min*4+1||
          scale.counts.some(n=>!Number.isSafeInteger(n)||n<0)||scale.counts.reduce((a,b)=>a+b,0)!==data.n)
          throw Error('טבלת השוואה שגויה: '+code);
      }
      if(!Array.isArray(data.sharedItems)||data.sharedItems.length!==120||
        new Set(data.sharedItems.map(x=>x.number300)).size!==120)throw Error('מיפוי גרסת 300 אינו תקין.');
      return true;
    }
    if(v==='johnson-300-empirical-pooled-v1'){
      if(data.n!==145388)throw Error('נתוני ההשוואה אינם תקינים.');
      for(const d of ORDER)for(const code of [d,...[1,2,3,4,5,6].map(f=>d+f)]){
        const scale=data.scales[code],min=code.length===1?60:10;
        if(!scale||scale.min!==min||!Array.isArray(scale.counts)||scale.counts.length!==min*4+1||
          scale.counts.some(n=>!Number.isSafeInteger(n)||n<0)||scale.counts.reduce((a,b)=>a+b,0)!==data.n)
          throw Error('טבלת השוואה שגויה: '+code);
      }
      return true;
    }
    throw Error('גרסת השוואה לא נתמכת: '+v);
  }
  function prepared(data){
    if(caches.has(data))return caches.get(data);
    validate(data);const lookup={},stats={};
    for(const [code,scale] of Object.entries(data.scales)){
      let less=0;lookup[code]=scale.counts.map(equal=>{
        const p=100*(less+equal/2)/data.n;less+=equal;return p;
      });
      const min=scale.min;
      let sum=0;
      for(let i=0;i<scale.counts.length;i++){
        sum+=(min+i)*scale.counts[i];
      }
      const mean=sum/data.n;
      let varSum=0;
      for(let i=0;i<scale.counts.length;i++){
        const diff=(min+i)-mean;
        varSum+=diff*diff*scale.counts[i];
      }
      const denom=data.n>1?(data.n-1):1;
      const sd=Math.sqrt(Math.max(0.0001,varSum/denom));
      stats[code]={mean,sd};
    }
    caches.set(data,lookup);
    statsCaches.set(data,stats);
    return lookup;
  }
  function percentile(data,code,raw){
    const lookup=prepared(data),scale=data.scales[code];
    if(!scale||!Number.isInteger(raw)||raw<scale.min||raw>=scale.min+scale.counts.length)
      throw Error('ציון מחוץ לטווח המדד.');
    return lookup[code][raw-scale.min];
  }
  function percentileContinuous(data,code,rawFloat){
    const scale=data.scales[code],min=scale.min,max=min+scale.counts.length-1;
    const clamped=Math.max(min,Math.min(max,rawFloat));
    const lo=Math.floor(clamped),hi=Math.ceil(clamped);
    const pLo=percentile(data,code,lo);
    if(lo===hi)return pLo;
    const pHi=percentile(data,code,hi);
    return pLo+(clamped-lo)*(pHi-pLo);
  }
  const tier=mean=>mean<2.5?0:mean>3.5?2:1;
  const normTier=pct=>pct<30.5?0:pct>=69.5?2:1;
  function enrich(profile,bank,answers,core,data){
    const total=bank?.items?.length;
    if(![120,300].includes(total)||!profile?.domains||answers?.length!==total)throw Error('פרופיל לא מתאים להשוואה.');
    if(!data){
      data=(total===300&&root.OfiEmpiricalData300)?root.OfiEmpiricalData300:root.OfiEmpiricalData;
    }
    prepared(data);
    const stats=statsCaches.get(data)||{};
    const deep=getDeepModels();
    const facetCi=getFacetCi();
    const isFull300=(total===300&&data.version==='johnson-300-empirical-pooled-v1');
    const full300Data=(!isFull300&&total===300&&root?.OfiEmpiricalData300)?root.OfiEmpiricalData300:null;
    if(full300Data)prepared(full300Data);
    const fullStats=full300Data?(statsCaches.get(full300Data)||stats):stats;
    const sums=Object.fromEntries(ORDER.flatMap(d=>[d,...[1,2,3,4,5,6].map(f=>d+f)]).map(k=>[k,0]));
    if(isFull300){
      for(const d of ORDER){
        sums[d]=profile.domains[d].raw;
        for(let i=0;i<6;i++){
          sums[d+(i+1)]=profile.domains[d].facets[i].raw;
        }
      }
    }else{
      for(const item of data.sharedItems){
        const position=(total===120?item.number120:item.number300)-1,b=bank.items[position],answer=answers[position];
        if(!b||b.domain!==item.domain||b.facet!==item.facet||b.keyed!==item.keyed||
          !Number.isInteger(answer)||answer<1||answer>5)throw Error('מיפוי ההיגדים אינו תואם למאגר.');
        const keyed=item.keyed==='minus'?6-answer:answer;
        sums[item.domain]+=keyed;sums[item.domain+item.facet]+=keyed;
      }
    }
    const rows=[];
    for(const key of ORDER){
      const d=profile.domains[key],count=total/5;
      for(const [index,entry] of [[null,d],...d.facets.map((f,i)=>[i,f])]){
        const code=key+(index===null?'':index+1),items=index===null?count:count/6;
        const mean=entry.raw/items,rLevel=tier(mean);
        // Use integer sums first so exact .5 boundaries do not become .499999999.
        entry.rangeScore=100*(entry.raw-items)/(4*items);
        entry.score=Math.round(entry.rangeScore);
        entry.mean=Math.round(mean*1000)/1000;
        entry.percentileExact=percentile(data,code,sums[code]);entry.percentile=Math.round(entry.percentileExact);
        entry.referenceRaw=sums[code];
        const nLevel=normTier(entry.percentileExact);
        entry.rangeLevel=['low','average','high'][rLevel];entry.rangeLevelLabel=LEVELS[rLevel];
        entry.normLevel=['low','average','high'][nLevel];entry.normLevelLabel=LEVELS[nLevel];
        entry.level=entry.normLevel;entry.levelLabel=entry.normLevelLabel;

        const st=stats[code]||{mean:0,sd:1};
        const alpha=(ALPHAS[isFull300?300:120]||{})[code]||0.80;
        const semAlpha=index===null?((STRATIFIED_DOMAIN_ALPHAS[isFull300?300:120]||{})[code]||alpha):alpha;
        const rawSem=st.sd>0?st.sd*Math.sqrt(Math.max(0.001,1-semAlpha)):(index===null?3.0:2.5);
        const refItems=isFull300?items:(index===null?24:4);
        const sem100=rawSem*(100/(4*refItems));
        const semVal=Math.round(sem100*10)/10;
        const ciVal=Math.round(1.96*semVal);
        const mean100=100*(st.mean-refItems)/(4*refItems);
        const fullAlpha=(ALPHAS[total]||{})[code]||alpha;
        const fullSemAlpha=index===null?((STRATIFIED_DOMAIN_ALPHAS[total]||{})[code]||fullAlpha):fullAlpha;
        const fullSt=fullStats[code]||st;
        const fullMean100=isFull300?mean100:(full300Data?100*(fullSt.mean-items)/(4*items):mean100);
        const fullSem100=isFull300?sem100:(full300Data&&fullSt.sd>0?(fullSt.sd*Math.sqrt(Math.max(0.001,1-fullSemAlpha))*(100/(4*items))):sem100*Math.sqrt(Math.max(0.001,1-fullSemAlpha)/Math.max(0.001,1-semAlpha)));
        const fullIrt=deep?.data?.irtOmega?.[String(total)]?.[code]||null;
        const refIrt=deep?.data?.irtOmega?.[isFull300?'300':'120']?.[code]||null;
        const omegaTotal=fullIrt?fullIrt.omegaTotal:fullAlpha;
        const omegaH=fullIrt?fullIrt.omegaH:null;
        const csem100=(deep&&fullIrt)?deep.csemAtScore(entry.rangeScore,fullIrt.csemKnots):fullSem100;
        const domainCiSem100=index===null?fullSem100:csem100;
        const csemVal=Math.round(csem100*10)/10;
        const refRangeScore=100*(sums[code]-refItems)/(4*refItems);
        const refCsem100=(deep&&refIrt)?deep.csemAtScore(refRangeScore,refIrt.csemKnots):sem100;
        const condRefRawSem=index===null?rawSem:(refCsem100*(4*refItems/100));
        const pExRound=Math.round(entry.percentileExact*10)/10;
        let pLow=Math.min(pExRound,Math.round(percentileContinuous(data,code,sums[code]-1.96*condRefRawSem)*10)/10);
        let pHigh=Math.max(pExRound,Math.round(percentileContinuous(data,code,sums[code]+1.96*condRefRawSem)*10)/10);
        const trueEst=fullMean100+omegaTotal*(entry.rangeScore-fullMean100);
        const trueCiHalf=(deep&&fullIrt&&index!==null)?1.96*csem100:1.96*fullSem100*Math.sqrt(omegaTotal);
        // Facet CIs target the GRM expected true score, using exact tail
        // inversion on the discrete summed response distribution.
        // A broad domain mixes six facets and uses classical observed-score SEM.
        const exactFacetCi=index===null?null:facetCi?.lookup(total,code,entry.raw);
        const exactReferenceCi=index===null?null:facetCi?.lookup(isFull300?300:120,code,sums[code]);
        if(exactReferenceCi){
          const refFactor=4*refItems/100;
          pLow=Math.min(pExRound,Math.floor(percentileContinuous(data,code,refItems+refFactor*exactReferenceCi[0])*10)/10);
          pHigh=Math.max(pExRound,Math.ceil(percentileContinuous(data,code,refItems+refFactor*exactReferenceCi[1])*10)/10);
        }
        entry.alpha=alpha;
        entry.omegaTotal=omegaTotal;
        entry.omegaH=omegaH;
        entry.rawSem=Math.round(rawSem*100)/100;
        entry.sem=semVal;
        entry.conditionalSem=csemVal;
        entry.ciMargin=ciVal;
        entry.ci95=[Math.max(0,entry.score-ciVal),Math.min(100,entry.score+ciVal)];
        entry.conditionalCi95=exactFacetCi
          ? [Math.floor(exactFacetCi[0]),Math.ceil(exactFacetCi[1])]
          : [Math.max(0,Math.round(entry.rangeScore-1.96*domainCiSem100)),Math.min(100,Math.round(entry.rangeScore+1.96*domainCiSem100))];
        // Broad domains use the classical stratified-alpha SEM (one-factor cSEM is not valid across six facets).
        entry.conditionalCiMethod=exactFacetCi?'exact-grm-sum-score-tails':(index===null?'stratified-classical-sem':'csem-approximation');
        // The SEM shown beside a domain CI must be the one that built it.
        if(index===null)entry.conditionalSem=Math.round(domainCiSem100*10)/10;
        entry.percentileCi95=[Math.max(0,pLow),Math.min(100,pHigh)];
        entry.trueScoreCi95=exactFacetCi
          ? [...entry.conditionalCi95]
          : [Math.max(0,Math.round(trueEst-trueCiHalf)),Math.min(100,Math.round(trueEst+trueCiHalf))];

        const z=st.sd>0?(sums[code]-st.mean)/st.sd:0;
        const t=50+10*z;
        entry.meanReference=Math.round(st.mean*100)/100;
        entry.sd=Math.round(st.sd*100)/100;
        entry.z=Math.round(z*100)/100;
        entry.t=Math.round(t*10)/10;
        entry.isOutlier=Math.abs(z)>=2.0;
        entry.outlierDirection=z>=2.0?'high':(z<=-2.0?'low':null);

        if(index===null){
          entry.rangeText=core.DOMAINS[key][['low','mid','high'][rLevel]];
          entry.normText=core.DOMAINS[key][['low','mid','high'][nLevel]];
          if(nLevel===0&&entry.rangeScore>=52){
            entry.normText='ציון השאלון חיובי־מתון ('+entry.score+'/100), אך נמוך יחסית לממוצע מדגם ההשוואה הגבוה במדד זה: '+core.DOMAINS[key].mid;
          }
        }else{
          entry.rangeText=core.FACETS[key][index][rLevel+1];
          entry.normText=core.FACETS[key][index][nLevel+1];
          if(nLevel===0&&entry.rangeScore>=52){
            entry.normText='ציון השאלון חיובי־מתון ('+entry.score+'/100), אך נמוך יחסית לממוצע מדגם ההשוואה הגבוה במדד זה: '+core.FACETS[key][index][2];
          }
        }
        if(code==='O6'){
          entry.label='ליברליות בעמדות חברתיות וערכיות';
          const o6Texts=['התשובות נוטות לצד השמרני של פריטי המקור (העדפת מסורת, יציבות וסדר קיים).',
            'התשובות משלבות עמדות שונות בפריטי המקור (איזון בין שימור מסורת לבין פתיחות לשינוי).',
            'התשובות נוטות לצד הליברלי של פריטי המקור (פתיחות לרפורמות חברתיות, פלורליזם ונונ-קונפורמיזם).'];
          entry.rangeText=o6Texts[rLevel];
          entry.normText=o6Texts[nLevel];
          entry.adaptationNote='הערה מתודולוגית: פריטי המקור נשענים על הקשר חברתי-תרבותי אמריקאי. בישראל מדד זה משקף בעיקר פלורליזם מחשבתי, סובלנות לגיוון ופתיחות לשינוי, ולא עמדה פוליטית מפלגתית.';
        }
        entry.text=entry.normText;
        rows.push({key:code,domain:key,label:entry.label,score:entry.score,raw:entry.raw,
          referenceRaw:sums[code],percentile:entry.percentile,percentileExact:entry.percentileExact,percentileCi95:entry.percentileCi95,level:entry.level,rangeLevel:entry.rangeLevel,
          sem:entry.sem,conditionalSem:entry.conditionalSem,conditionalCi95:entry.conditionalCi95,conditionalCiMethod:entry.conditionalCiMethod,ciMargin:entry.ciMargin,ci95:entry.ci95,trueScoreCi95:entry.trueScoreCi95,
          alpha:entry.alpha,omegaTotal:entry.omegaTotal,omegaH:entry.omegaH,rawSem:entry.rawSem,
          adaptationNote:entry.adaptationNote||null,
          mean:entry.meanReference,sd:entry.sd,z:entry.z,t:entry.t,isOutlier:entry.isOutlier,outlierDirection:entry.outlierDirection});
      }
    }
    // The domain sentence describes the trait as a whole. When a facet sits at the other pole,
    // say so, so the description does not contradict the facet shown right below it.
    const facetCaveat=(list,value,domainHigh)=>{
      const parts=list.map(f=>f.label+' ('+value(f)+')');
      const names=parts.length>1?parts.slice(0,-1).join(', ')+' ו־'+parts[parts.length-1]:parts[0];
      return parts.length>1
        ?'עם זאת, בתחומי המשנה '+names+' התוצאות '+(domainHigh?'נמוכות':'גבוהות')+', ולכן התיאור הכללי אינו חל על היבטים אלה.'
        :'עם זאת, בתחום המשנה '+names+' התוצאה '+(domainHigh?'נמוכה':'גבוהה')+', ולכן התיאור הכללי אינו חל על היבט זה.';
    };
    for(const key of ORDER){
      const d=profile.domains[key];
      if(!d?.facets?.length)continue;
      const byNorm=d.facets.filter(f=>d.normLevel==='high'&&f.percentileExact<20||d.normLevel==='low'&&f.percentileExact>80);
      if(byNorm.length){d.normText+=' '+facetCaveat(byNorm,f=>'אחוזון '+f.percentile,d.normLevel==='high');d.text=d.normText;}
      const byRange=d.facets.filter(f=>d.rangeLevel==='high'&&f.rangeLevel==='low'||d.rangeLevel==='low'&&f.rangeLevel==='high');
      if(byRange.length)d.rangeText+=' '+facetCaveat(byRange,f=>f.score+'/100',d.rangeLevel==='high');
    }
    profile.empiricalReference={version:data.version,n:data.n,group:'כולם · כל הגילים',
      referenceInstrument:data.referenceInstrument||(isFull300?'IPIP-NEO-300':'IPIP-NEO-120'),
      answeredItems:total,percentileItems:isFull300?300:120,method:data.method,source:data.source.original,
      longVersionUsesSharedSubset:(!isFull300&&total===300)};
    profile.normRows=rows;
    profile.empiricalInsights=generateEmpiricalInsights(profile);
    // Data-driven links between facets (where this person splits from the usual pattern), each tied to their answers.
    const links=getProfileLinks();
    if(links){
      try{
        const found=links.find(rows,bank,answers,isFull300?300:120);
        if(found.length)profile.empiricalInsights=found.concat(profile.empiricalInsights);
      }catch(_e){}
    }

    // Empirical 7-Facet Standardized Regression Proxy for HEXACO Honesty-Humility (H)
    // Calibrated via Thielmann et al. (2022) meta-analytic correlations against cohort R (N=145,388 / N=555,764)
    if(profile.domains?.A?.facets?.length>=5 && profile.domains?.C?.facets?.length>=3){
      const a2Score = profile.domains.A.facets[1]?.rangeScore ?? profile.domains.A.facets[1]?.score ?? 50;
      const a5Score = profile.domains.A.facets[4]?.rangeScore ?? profile.domains.A.facets[4]?.score ?? 50;
      const c3Score = profile.domains.C.facets[2]?.rangeScore ?? profile.domains.C.facets[2]?.score ?? 50;
      const n2Score = profile.domains.N?.facets?.[1]?.rangeScore ?? profile.domains.N?.facets?.[1]?.score ?? 50;
      const e5Score = profile.domains.E?.facets?.[4]?.rangeScore ?? profile.domains.E?.facets?.[4]?.score ?? 50;
      const a2Pct = profile.domains.A.facets[1]?.percentileExact ?? a2Score;
      const a5Pct = profile.domains.A.facets[4]?.percentileExact ?? a5Score;
      const c3Pct = profile.domains.C.facets[2]?.percentileExact ?? c3Score;
      const n2Pct = profile.domains.N?.facets?.[1]?.percentileExact ?? n2Score;
      const e5Pct = profile.domains.E?.facets?.[4]?.percentileExact ?? e5Score;
      const getFacetZ = (domKey, idx) => {
        const f = profile.domains[domKey]?.facets?.[idx];
        if (f && typeof f.z === 'number' && Number.isFinite(f.z)) return Math.max(-2.8, Math.min(2.8, f.z));
        const pct = f?.percentileExact ?? f?.score ?? 50;
        return Math.max(-2.5, Math.min(2.5, (pct - 50) / 29));
      };
      const wH = isFull300
        ? { A2: 0.5114, A5: 0.5168, A4: 0.0389, C3: 0.0389, E5: -0.0836, N2: -0.2039, E3: -0.0389 }
        : { A2: 0.5342, A5: 0.5350, A4: 0.0388, C3: 0.0388, E5: -0.1206, N2: -0.1868, E3: -0.0910 };
      const zH = wH.A2 * getFacetZ('A', 1) + wH.A5 * getFacetZ('A', 4) + wH.A4 * getFacetZ('A', 3)
        + wH.C3 * getFacetZ('C', 2) + wH.E5 * getFacetZ('E', 4) + wH.N2 * getFacetZ('N', 1) + wH.E3 * getFacetZ('E', 2);
      const signH = zH < 0 ? -1 : 1, xH = Math.abs(zH) / Math.SQRT2, tH = 1 / (1 + 0.3275911 * xH);
      const erfH = 1 - (((((1.061405429 * tH - 1.453152027) * tH) + 1.421413741) * tH - 0.284496736) * tH + 0.254829592) * tH * Math.exp(-xH * xH);
      const hexProxyCdf = deep?.data?.lab?.[isFull300 ? '300' : '120']?.cdfs?.hexacoProxy;
      const empPctH = (deep && hexProxyCdf) ? deep.cdfLookup(zH, hexProxyCdf) : null;
      const percentileProxy = empPctH != null
        ? Math.max(1, Math.min(99, Math.round(empPctH)))
        : Math.max(1, Math.min(99, Math.round(0.5 * (1 + signH * erfH) * 100)));
      // Equate onto the direct 0..100 HEXACO-H Likert scale metric (Lee & Ashton, 2018 N=100,318: mu=57.25, sd=15.5)
      const hexSupp = deep?.data?.supplementary?.hexaco;
      const hMean = hexSupp ? hexSupp.mean100 : 57.25;
      const hSd = hexSupp ? hexSupp.sd100 : 15.5;
      const rProxy = isFull300 ? 0.79 : 0.77;
      const hRaw = hMean + hSd * zH;
      const hScore = Math.round(Math.max(0, Math.min(100, hRaw)));
      const hOls = hMean + rProxy * hSd * zH;
      const hCi90Half = 1.64485 * hSd * Math.sqrt(1 - rProxy * rProxy);
      const level = hRaw < 45 ? 0 : (hRaw >= 68 ? 2 : 1);
      const levelLabels = ['נמוך', 'ממוצע', 'גבוה'];
      const narrative = [
        'האומדן נוטה לצד המעשי, התחרותי והפרגמטי, עם דגש על השגת יעדים אישיים ותמרון גמיש על פני היצמדות פורמלית לכללים.',
        'האומדן מציג איזון יומיומי בין עקרונות מוסריים וצניעות לבין גמישות מעשית ביחסים.',
        'האומדן מעיד על רמה גבוהה במיוחד של כנות, צניעות והגינות פנימית, עם שלילה מובהקת של מניפולציות ורדיפת סמלי מעמד.'
      ][level];
      profile.hexacoHonesty = {
        type: 'proxy',
        accuracy: rProxy,
        score: hScore,
        percentileProxy,
        ci90: [Math.max(0, Math.min(hScore, Math.round(hOls - hCi90Half))), Math.min(100, Math.max(hScore, Math.round(hOls + hCi90Half)))],
        proxyWeights: { ...wH },
        proxyZ: zH,
        level: ['low', 'average', 'high'][level],
        levelLabel: levelLabels[level],
        facets: {
          morality: Math.round(a2Score),
          modesty: Math.round(a5Score),
          dutifulness: Math.round(c3Score),
          angerRestraint: Math.round(100 - n2Score),
          riskRestraint: Math.round(100 - e5Score)
        },
        facetPercentiles: {
          morality: Math.round(a2Pct),
          modesty: Math.round(a5Pct),
          dutifulness: Math.round(c3Pct),
          angerRestraint: Math.round(100 - n2Pct),
          riskRestraint: Math.round(100 - e5Pct)
        },
        narrative
      };
    }

    // Purified Openness sub-constructs (removing self-efficacy/reading-effort & social-venue/habit halos for MBTI S/N & Ne/Ni)
    if((total===300||total===120)&&Array.isArray(bank?.items)&&Array.isArray(answers)){
      const subOpenZ=(nums,mu,sd)=>{
        let s=0;
        for(let i=0;i<nums.length;i++){
          const pos=nums[i]-1,bItem=bank.items[pos],ans=answers[pos];
          if(!bItem||bItem.domain!=='O'||!Number.isInteger(ans)||ans<1||ans>5)return null;
          s+=(bItem.keyed==='minus'?6-ans:ans);
        }
        const rs=100*(s-nums.length)/(4*nums.length);
        return Math.round(Math.max(-3.5,Math.min(3.5,(rs-mu)/sd))*10000)/10000;
      };
      const specs=total===300
        ?{mode:300,ideas:[[143,173,203,233,263],75.666,19.316],fantasy:[[3,33,63,93,123,213,243,273],73.874,18.103],aesth:[[8,38,68,158],80.752,17.595],variety:[[18,78],73.522,19.506]}
        :{mode:120,ideas:[[53,83,113],73.960,22.945],fantasy:[[3,33,63,93],73.894,20.833],aesth:[[8,38],74.852,21.923],variety:[[18],64.242,28.080]};
      const ideasZ=subOpenZ(specs.ideas[0],specs.ideas[1],specs.ideas[2]);
      const fantasyZ=subOpenZ(specs.fantasy[0],specs.fantasy[1],specs.fantasy[2]);
      const aesthZ=subOpenZ(specs.aesth[0],specs.aesth[1],specs.aesth[2]);
      const varietyZ=subOpenZ(specs.variety[0],specs.variety[1],specs.variety[2]);
      if(ideasZ!==null&&fantasyZ!==null&&aesthZ!==null&&varietyZ!==null){
        profile.opennessConstructs={mode:specs.mode,ideasZ,fantasyZ,aesthZ,varietyZ};
      }
    }

    return profile;
  }
  function formatHeList(items) {
    if (items.length <= 1) return items[0] || '';
    return `${items.slice(0, -1).join(', ')} ו־${items[items.length - 1]}`;
  }

  function generateEmpiricalInsights(profile) {
    const insights = [];
    const rows = profile.normRows;
    if (!rows || !rows.length) return insights;

    const byKey = Object.fromEntries(rows.map(r => [r.key, r]));
    const facets = rows.filter(r => r.key.length > 1);
    const domains = rows.filter(r => r.key.length === 1);

    // 1. Ceiling Resolution (>= 98%)
    const ceiling = facets
      .filter(r => r.percentileExact >= 98)
      .sort((a, b) => (b.percentileExact - a.percentileExact) || (b.t - a.t));

    if (ceiling.length >= 2) {
      const top = ceiling[0];
      const second = ceiling[1];
      const sample = ceiling.slice(0, 3);
      const names = formatHeList(sample.map(r => `${r.label} (${r.key})`));
      const isClearLead = (top.percentileExact - second.percentileExact) >= 0.25;

      insights.push({
        type: 'ceiling',
        badge: 'הבחנה בקצה הסקאלה העליון',
        tone: 'high',
        title: 'הבחנה עדינה בקצה העליון של המדגם (98%–100%)',
        text: isClearLead
          ? `המדדים ${names} נמצאים כולם בקצה העליון של המדגם. בתוכם, ${top.label} (${top.key}: אחוזון ${top.percentileExact.toFixed(1)}%) ממוקם בנקודה הקיצונית ביותר. מומלץ להתבונן במדדים אלה יחד כמכלול משותף.`
          : `המדדים ${names} נמצאים כולם בטווח העליון של המדגם (${sample[sample.length - 1].percentileExact.toFixed(1)}%–${top.percentileExact.toFixed(1)}%) ומבטאים יחד דפוס תגובה בולט בפרופיל.`
      });
    }

    // 2. Floor Resolution (<= 2.5%)
    const floor = facets
      .filter(r => r.percentileExact <= 2.5)
      .sort((a, b) => (a.percentileExact - b.percentileExact) || (a.t - b.t));

    if (floor.length >= 2) {
      const lowest = floor[0];
      const second = floor[1];
      const sample = floor.slice(0, 3);
      const names = formatHeList(sample.map(r => `${r.label} (${r.key})`));
      const isClearLead = (second.percentileExact - lowest.percentileExact) >= 0.25;

      insights.push({
        type: 'floor',
        badge: 'הבחנה ברצפת הסקאלה',
        tone: 'low',
        title: 'הבחנה עדינה בקרב המדדים הנמוכים (0%–2.5%)',
        text: isClearLead
          ? `המדדים ${names} ממוקמים כולם ברצפת האחוזונים. בתוכם, ${lowest.label} (${lowest.key}: אחוזון ${lowest.percentileExact.toFixed(1)}%) נמצא במיקום הנמוך ביותר ביחס למדגם.`
          : `המדדים ${names} נמצאים כולם בטווח הנמוך ביותר במדגם (${lowest.percentileExact.toFixed(1)}%–${sample[sample.length - 1].percentileExact.toFixed(1)}%) ומשקפים יחד מאפיין מובהק של מיעוט הסכמה עם היגדים אלה.`
      });
    }

    // 3. Intra-Domain Variance (שונות בתשובות בין תתי-תכונות בתוך אותו ממד)
    for (const domain of domains) {
      const dFacets = facets
        .filter(r => r.key[0] === domain.key)
        .sort((a, b) => b.percentileExact - a.percentileExact);

      if (dFacets.length < 2) continue;
      const maxF = dFacets[0];
      const minF = dFacets[dFacets.length - 1];
      const spread = maxF.percentileExact - minF.percentileExact;

      if (spread >= 85 && maxF.percentileExact >= 90 && minF.percentileExact <= 10) {
        insights.push({
          type: 'domain_split',
          domainKey: domain.key,
          badge: `שונות פנימית בממד ${domain.label}`,
          tone: 'neutral',
          title: `ציון הממד הכולל (${domain.label}) משקלל היבטים בעלי כיוונים שונים`,
          text: `בממד ${domain.label} (${domain.key}: אחוזון ${Math.round(domain.percentileExact)}%) קיימת שונות ניכרת בין תתי-התכונות: ${maxF.label} (${maxF.key}) מדורגת באחוזון ${Math.round(maxF.percentileExact)}%, בעוד ${minF.label} (${minF.key}) מדורגת באחוזון ${Math.round(minF.percentileExact)}% (פער של כ־${Math.round(spread)} נקודות אחוזון). פער זה ממחיש שהתכונה אינה אחידה אלא מורכבת מגוונים שונים שכדאי לבחון בנפרד.`
        });
      }
    }

    // 4. Context Note on Negative Self-Appraisal (הערת הקשר עדינה להתבוננות עצמית)
    const n3 = byKey['N3']?.percentileExact ?? 0;
    const a5 = byKey['A5']?.percentileExact ?? 0;
    const c1 = byKey['C1']?.percentileExact ?? 100;

    // Fixed Bug: C1 must strictly be low (<= 15) for this context note to be logically valid!
    if (n3 >= 95 && a5 >= 95 && c1 <= 15) {
      insights.push({
        type: 'response_bias',
        badge: 'הערת הקשר להתבוננות',
        tone: 'neutral',
        title: 'נקודה להתבוננות: השפעת ביקורת עצמית על הערכת היכולות',
        text: `השילוב של ${byKey['N3']?.label || 'מצב רוח ירוד'} (N3: אחוזון ${Math.round(n3)}%) יחד עם ${byKey['A5']?.label || 'צניעות'} (A5: אחוזון ${Math.round(a5)}%) מעיד לעיתים על שיפוט עצמי מחמיר וזהיר. כדאי לקחת בחשבון שציון נמוך ב${byKey['C1']?.label || 'מסוגלות עצמית'} (C1: אחוזון ${Math.round(c1)}%) עשוי לשקף ביקורתיות זמנית בעת המענה, ולא בהכרח פער ביכולת המעשית בשטח.`
      });
    }

    // 5. Cross-Trait Paradoxes & Dynamics (מתחים בין-תכונתיים פסיכומטריים)
    const domN = byKey['N']?.percentileExact ?? 50;
    const domE = byKey['E']?.percentileExact ?? 50;
    const domO = byKey['O']?.percentileExact ?? 50;
    const domA = byKey['A']?.percentileExact ?? 50;
    const domC = byKey['C']?.percentileExact ?? 50;

    const a1Trust = byKey['A1']?.percentileExact ?? 50;
    const a5Modesty = byKey['A5']?.percentileExact ?? 50;

    // 5.1 Paradox of Guarded Humility (A5 vs A1)
    if (a5Modesty >= 80 && a1Trust <= 30) {
      insights.push({
        type: 'paradox',
        badge: 'מתח פנימי · פרדוקס הענווה הזהירה',
        tone: 'neutral',
        title: 'ענווה עמוקה לצד זהירות וספקנות לגבי כוונות הזולת',
        text: `קיים פער ייחודי בין צניעות גבוהה במיוחד (${byKey['A5']?.label || 'צניעות'}: אחוזון ${Math.round(a5Modesty)}%) לבין רמת אמון זהירה (${byKey['A1']?.label || 'אמון'}: אחוזון ${Math.round(a1Trust)}%). דפוס זה מאפיין אדם שאינו מחזיק מעצמו יותר מאחרים, אך בד בבד אינו ממהר להעניק אמון עיוור ושומר על ערנות והגנה עצמית.`
      });
    }

    // 5.2 Introspective Sensitivity (High N + Low E)
    if (domN >= 75 && domE <= 25) {
      insights.push({
        type: 'paradox',
        badge: 'דינמיקה בין-תכונתית · רגישות מופנמת',
        tone: 'neutral',
        title: 'עולם רגשי פנימי עמוק ועשיר לצד צורך מובהק במרחב שקט',
        text: `השילוב בין רגישות רגשית גבוהה (אחוזון ${Math.round(domN)}%) לבין מוחצנות נמוכה (אחוזון ${Math.round(domE)}%) יוצר עולם רגשי ערני וקשוב מאוד לפרטים, שעיבודו מתבצע בצורה המיטבית בסביבה רגועה ומוגנת, עם צורך בזמן אישי לטעינת מצברים הרחק מהמולת חוץ.`
      });
    }

    // 5.3 Vigilant Perfectionism (High N + High C)
    if (domN >= 75 && domC >= 75) {
      insights.push({
        type: 'paradox',
        badge: 'דינמיקה בין-תכונתית · פרפקציוניזם דרוך',
        tone: 'neutral',
        title: 'שאיפה בלתי מתפשרת לסדר ואחריות המלווה בעומס רגשי',
        text: `הצמצום של מצפוניות גבוהה (אחוזון ${Math.round(domC)}%) יחד עם רגישות רגשית גבוהה (אחוזון ${Math.round(domN)}%) מניע משמעת עצמית קפדנית ושאיפה לדיוק, כאשר לעיתים קרובות המנוע לכך מלווה בחרדת ביצוע או חשש מפני שגיאות ואי-עמידה בציפיות.`
      });
    }

    // 5.4 Disciplined Creativity (High O + High C)
    if (domO >= 75 && domC >= 75) {
      insights.push({
        type: 'paradox',
        badge: 'דינמיקה בין-תכונתית · יצירתיות ממושמעת',
        tone: 'high',
        title: 'שילוב מפרה בין דמיון ומקוריות לבין כושר ביצוע קפדני',
        text: `שילוב של פתיחות גבוהה לחוויה ולרעיונות (אחוזון ${Math.round(domO)}%) יחד עם מצפוניות גבוהה (אחוזון ${Math.round(domC)}%) מאפשר לא רק לחשוב באופן מקורי ויצירתי, אלא גם להחזיק במשמעת העצמית ובשיטתיות הדרושות כדי להוציא רעיונות חדשניים מן הכוח אל הפועל.`
      });
    }

    // 5.5 Quiet Intellectual Explorer (High O + Low E)
    if (domO >= 75 && domE <= 25 && !(domN >= 75 && domE <= 25)) {
      insights.push({
        type: 'paradox',
        badge: 'דינמיקה בין-תכונתית · חוקר עצמאי ושקט',
        tone: 'high',
        title: 'סקרנות אינטלקטואלית עמוקה המתפתחת בעבודה עצמאית',
        text: `פתיחות רחבה לרעיונות ולחקר (אחוזון ${Math.round(domO)}%) לצד העדפה למופנמות (אחוזון ${Math.round(domE)}%) מבטאת אדם המוצא עניין עצום בעולם הידע, הפילוסופיה והאמנות, ומפיק את מרב ההשראה בהתבוננות שקטה ובלימוד אישי עצמאי.`
      });
    }

    // 5.6 Emotional Overload Vulnerability (High N + Low C)
    if (domN >= 75 && domC <= 25) {
      insights.push({
        type: 'paradox',
        badge: 'נקודה להתבוננות · השפעת סטרס על שגרה ומשמעת',
        tone: 'warning',
        title: 'פגיעות של ניהול זמן והתמדה בעת הצפה רגשית',
        text: `רגישות רגשית גבוהה (אחוזון ${Math.round(domN)}%) לצד מצפוניות נמוכה (אחוזון ${Math.round(domC)}%) מצביעה על כך שבמצבי לחץ או אי-ודאות, עומס רגשי עלול לפגוע ביכולת ההתארגנות ובהתמדה במשימות יומיומיות. מומלץ להיעזר בעוגנים סביבתיים מובנים להפחתת עומס ההחלטות.`
      });
    }

    const is300Ref = profile.empiricalReference?.percentileItems === 300 && !profile.empiricalReference?.longVersionUsesSharedSubset;
    // Both 300-item and 120-shared-item joint facet prevalences/correlations below come from the N=145,388 item-level cohort.
    const nSampleText = (145388).toLocaleString('he-IL');

    // 5.7 Quiet Leadership (High E3 Assertiveness >= 75 + Low E2 Gregariousness <= 25)
    const e3Assert = byKey['E3']?.percentileExact ?? 50;
    const e2Greg = byKey['E2']?.percentileExact ?? 50;
    if (byKey['E3'] && byKey['E2'] && e3Assert >= 75 && e2Greg <= 25) {
      insights.push({
        type: 'paradox',
        badge: 'מתח פנימי · מנהיגות שקטה',
        tone: 'high',
        prevalencePct: is300Ref ? 2.463 : 3.83,
        correlationR: is300Ref ? 0.502 : 0.331,
        title: 'נוכחות אסרטיבית וכושר הובלה ללא צורך בהמולה חברתית',
        text: `קיים שילוב מעניין בין אסרטיביות גבוהה (${byKey['E3']?.label || 'אסרטיביות'}: אחוזון ${Math.round(e3Assert)}%) לבין העדפה נמוכה להתקהלות (${byKey['E2']?.label || 'העדפת חברה מרובה'}: אחוזון ${Math.round(e2Greg)}%). דפוס זה מאפיין הובלה עניינית, החלטית ושקטה — יכולת להביע עמדה ברורה ולהניע תהליכים מבלי לחפש מרכזיות רועשת (שכיחות אמפירית במדגם: ${is300Ref ? '2.46%' : '3.83%'} מתוך ${nSampleText} משיבים, מתאם r = ${is300Ref ? '0.50' : '0.33'}).`
      });
    }

    // 5.8 Creative Spark vs. Follow-Through (High O5 Intellect >= 75 + Low C5 Self-Discipline <= 25)
    const o5Intellect = byKey['O5']?.percentileExact ?? 50;
    const c5Discipline = byKey['C5']?.percentileExact ?? 50;
    if (byKey['O5'] && byKey['C5'] && o5Intellect >= 75 && c5Discipline <= 25) {
      insights.push({
        type: 'paradox',
        badge: 'דינמיקה בין-תכונתית · ניצוץ רעיוני מול משמעת ביצוע',
        tone: 'neutral',
        prevalencePct: is300Ref ? 6.606 : 5.68,
        correlationR: is300Ref ? 0.067 : 0.039,
        title: 'שפע של סקרנות ורעיונות לצד אתגר בהתמדה בשגרה שוחקת',
        text: `הפער בין סקרנות אינטלקטואלית גבוהה (${byKey['O5']?.label || 'סקרנות אינטלקטואלית'}: אחוזון ${Math.round(o5Intellect)}%) לבין משמעת עצמית נמוכה יותר (${byKey['C5']?.label || 'התמדה'}: אחוזון ${Math.round(c5Discipline)}%) מעיד על מוח שנדלק מהר מרעיונות חדשים, אך עלול לאבד עניין בשלבי הביצוע הטכניים (שכיחות אמפירית במדגם: ${is300Ref ? '6.61%' : '5.68%'} מתוך ${nSampleText} משיבים, מתאם r = ${is300Ref ? '0.07' : '0.04'}). פירוק פרויקטים לאבני דרך קצרות מסייע לגשר על הפער.`
      });
    }

    // 5.9 Empathetic Independence (High A + Low E)
    if (domA >= 75 && domE <= 25) {
      insights.push({
        type: 'paradox',
        badge: 'דינמיקה בין-תכונתית · אמפתיה שקטה ומופנמת',
        tone: 'neutral',
        title: 'חום אנושי, אכפתיות והקשבה עמוקה במפגשים אינטימיים',
        text: `השילוב של נועם הליכות גבוה (אחוזון ${Math.round(domA)}%) יחד עם מוחצנות נמוכה (אחוזון ${Math.round(domE)}%) מבטא אדם נעים, מתחשב ורגיש לזולת, שמעדיף לבטא את החום והאכפתיות שלו בקשרים קרובים ובשיחות אחד-על-אחד ולא באירועים רבי-משתתפים.`
      });
    }

    return insights;
  }
  function createBellCurve(t, pct, label) {
    const wrap = el('div', 'norm-bell-wrap');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', 'התפלגות נורמלית: מיקום הציון T=' + t + ' על גבי עקומת הפעמון (אחוזון ' + Math.round(pct) + ')');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 160 38');
    svg.setAttribute('class', 'norm-bell-svg');
    svg.setAttribute('aria-hidden', 'true');
    const pts = [];
    for (let x = 4; x <= 156; x += 2) {
      const zx = (x - 80) / 24;
      const yx = 34 - 30 * Math.exp(-0.5 * zx * zx);
      pts.push(x + ',' + yx.toFixed(2));
    }
    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    areaPath.setAttribute('d', 'M 4,34 L ' + pts.join(' L ') + ' L 156,34 Z');
    areaPath.setAttribute('class', 'norm-bell-curve-area');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M ' + pts.join(' L '));
    path.setAttribute('class', 'norm-bell-curve-line');
    const mkTick = (tx, yTop, cls) => {
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', String(tx)); ln.setAttribute('y1', '34');
      ln.setAttribute('x2', String(tx)); ln.setAttribute('y2', String(yTop));
      ln.setAttribute('class', cls);
      return ln;
    };
    const meanLine = mkTick(80, 28, 'norm-bell-tick mean');
    const sdLeftLine = mkTick(56, 30.5, 'norm-bell-tick');
    const sdRightLine = mkTick(104, 30.5, 'norm-bell-tick');
    const xPos = Math.max(8, Math.min(152, 80 - (t - 50) * 2.4));
    const z = (xPos - 80) / 24;
    const yPos = 34 - 30 * Math.exp(-0.5 * z * z);
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('cx', xPos.toFixed(1));
    marker.setAttribute('cy', yPos.toFixed(1));
    marker.setAttribute('r', '4');
    marker.setAttribute('class', 'norm-bell-dot');
    svg.append(areaPath, path, sdLeftLine, meanLine, sdRightLine, marker);
    const labels = el('div', 'norm-bell-subtext');
    labels.append(el('span', null, 'נמוך (-2σ)'), el('span', 'norm-bell-center', 'ממוצע מדגם (T=50)'), el('span', null, 'גבוה (+2σ)'));
    wrap.append(svg, labels);
    return wrap;
  }
  const api={validate,percentile,tier,enrich,generateEmpiricalInsights};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.OfiEmpirical=api;
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id),panel=$('normPanel');
  if(!panel)return;
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  let current=null;
  function render(profile){
    if(!profile.empiricalReference)return;
    current=profile;const ref=profile.empiricalReference;
    $('normReference').textContent=ref.group;
    $('normStudySize').textContent=ref.n.toLocaleString('he-IL')+' משיבים';
    const countText=ref.n.toLocaleString('he-IL');
    $('normIntro').textContent='ציון 0–100 מתאר את התשובות שלך; האחוזון משווה למדגם של '+countText+' משיבי '+ref.referenceInstrument+'.';
    $('normFormula').textContent='100 × (מספר הציונים הנמוכים + חצי ממספר הציונים השווים) / '+countText;
    $('normMethodSource').textContent=ref.longVersionUsesSharedSubset?'מצב תאימות לגרסת 300: ציוני הטווח מבוססים על כל 300 ההיגדים, אך האחוזונים חושבו מ־120 ההיגדים המשותפים מול מדגם 120 של '+countText+' משיבים.':ref.percentileItems===300?'בשאלון 300 הציונים והאחוזונים מבוססים על כל 300 ההיגדים, מול '+countText+' משיבים שמילאו את גרסת 300.':'בשאלון 120 הציונים והאחוזונים מבוססים על 120 ההיגדים, מול '+countText+' משיבים שמילאו את גרסת 120.';
    $('normDatasetLink').href=ref.percentileItems===300?'./data/empirical-norms-300.json':'./data/empirical-norms.json';
    $('resultMetricDescription').textContent='חמש התכונות ותחומי המשנה מוצגים'+' כברירת מחדל כאחוזונים ביחס ל־'+countText+' משיבי '+ref.referenceInstrument+'. ציון השאלון 0–100 נשמר בפירוט; המדגם אינו מייצג את אוכלוסיית ישראל והנוסח העברי טרם תוקף.';
    $('normStatus').textContent='אחוזונים ל־5 תכונות ול־30 תחומי משנה · '+(ref.percentileItems===300?'לפי כל 300 ההיגדים במאגר IPIP-NEO-300':(ref.longVersionUsesSharedSubset?'לפי 120 ההיגדים המשותפים לגרסאות 120 ו־300':'לפי כל 120 ההיגדים'));
    const cards=[],sections=[];
    for(const key of ORDER){
      const d=profile.domains[key],card=el('article','norm-domain-card');card.dataset.trait=key;
      const header=el('div','norm-domain-header');
      const omegaTag=typeof d.omegaTotal==='number'?' · ω='+d.omegaTotal.toFixed(2):(typeof d.alpha==='number'?' · α='+d.alpha.toFixed(2):'');
      const smallMeta=el('small',null,d.score+'/100 · '+d.levelLabel+' · T='+d.t+omegaTag);
      smallMeta.title='ציון תקן T (ממוצע 50, σ=10) ומהימנות פנימית אומגה של מקדונלד (McDonald’s ω).';
      header.append(el('strong',null,d.label),smallMeta);
      const value=el('div','norm-percentile-value');
      const pctCiLabel=Array.isArray(d.percentileCi95)?' · רווח 95%: '+Math.round(d.percentileCi95[0])+'–'+Math.round(d.percentileCi95[1]):'';
      const smallT=el('small',null,'אחוזון (T='+d.t+pctCiLabel+')');
      smallT.title='ציון תקן T וטווח מודל 95% באחוזונים. בתתי־התכונות של IPIP-NEO-120/300: היפוך מדויק של הסתברויות סכום תשובות במודל IRT GRM; בחמש התכונות הראשיות: קירוב המבוסס על שגיאת תקן נצפית (SEM). אלה טווחי מודל ולא אימות של השאלון בעברית.';
      value.append(el('span',null,String(d.percentile)),smallT);
      const track=el('div','norm-track'),fill=el('span');fill.style.width=d.percentileExact+'%';track.append(fill);
      track.setAttribute('role','img');track.setAttribute('aria-label','אחוזון '+d.percentile);
      card.append(header,value,track,createBellCurve(d.t,d.percentileExact,d.label));cards.push(card);
      const section=el('section','norm-scale-section');section.dataset.trait=key;section.append(el('h3',null,d.label));
      const scroll=el('div','norm-scale-scroll'),table=el('table','norm-scale-table'),head=el('thead'),tr=el('tr');
      for(const title of ['מדד','ציון גולמי','ציון 0–100','מהימנות ω','שגיאת תקן (תחומי משנה: IRT cSEM · תכונות: SEM מרובד)','ציון T (תקן)','רמה',...(ref.longVersionUsesSharedSubset?['סכום 120 להשוואה']:[]),'אחוזון (רווח 95%)','סטטוס קצה'])tr.append(el('th',null,title));
      head.append(tr);table.append(head);const body=el('tbody');
      for(const row of profile.normRows.filter(r=>r.domain===key)){
        const line=el('tr'),label=el('th',null,row.label);label.scope='row';line.append(label);
        const outlierText=row.isOutlier?(row.outlierDirection==='high'?'▲ קיצון עליון ('+(row.z>0?'+':'')+row.z+'σ)':'▼ קיצון תחתון ('+row.z+'σ)'):'—';
        const omegaText=typeof row.omegaTotal==='number'?row.omegaTotal.toFixed(2)+(typeof row.omegaH==='number'&&row.key.length===1?' (ωh='+row.omegaH.toFixed(2)+')':''):(typeof row.alpha==='number'?row.alpha.toFixed(2):'—');
        const semInterval=(row.conditionalSem!=null?'±'+row.conditionalSem+' נק׳':(row.sem?'±'+row.sem+' נק׳':'—'))+(row.sem!=null&&row.conditionalSem!=null?' (קלאסי: ±'+row.sem+')':(row.rawSem?' (גלם: ±'+row.rawSem+')':''));
        const pctText=Array.isArray(row.percentileCi95)?row.percentile+' ('+Math.round(row.percentileCi95[0])+'–'+Math.round(row.percentileCi95[1])+')':String(row.percentile);
        for(const text of [row.raw,row.score,omegaText,semInterval,row.t,LEVELS[['low','average','high'].indexOf(row.level)],...(ref.longVersionUsesSharedSubset?[row.referenceRaw]:[]),pctText,outlierText])line.append(el('td',null,String(text)));
        body.append(line);
      }
      table.append(body);scroll.append(table);section.append(scroll);sections.push(section);
    }
    let outliersEl=$('normOutliers');
    if(!outliersEl){
      outliersEl=el('div','norm-outliers-container');
      outliersEl.id='normOutliers';
      const summaryEl=$('normSummary');
      if(summaryEl)summaryEl.after(outliersEl);
    }
    const insightsList=profile.empiricalInsights||generateEmpiricalInsights(profile);
    if(insightsList&&insightsList.length>0&&outliersEl){
      const box=el('div','norm-outliers-box');
      const head=el('div','norm-outliers-head');
      head.append(el('span','norm-outliers-icon','✦'),el('strong',null,'תובנות עומק מהציונים'),el('span','norm-outliers-subtitle','קצוות, פערים פנימיים ודפוסי מענה'));
      const list=el('div','norm-insights-cards');
      for(const ins of insightsList){
        const item=el('article','norm-insight-card is-'+ins.type);
        const badge=el('span','norm-insight-badge',ins.badge);
        const title=el('strong','norm-insight-title');
        // Mixed Hebrew/Latin percent ranges need their own direction context.
        const range=ins.title.match(/\d+(?:\.\d+)?%[–-]\d+(?:\.\d+)?%/);
        if(range){
          const start=ins.title.indexOf(range[0]);
          const isolate=el('bdi',null,range[0]);isolate.dir='ltr';
          title.append(ins.title.slice(0,start),isolate,ins.title.slice(start+range[0].length));
        }else title.textContent=ins.title;
        const text=el('p','norm-insight-text',ins.text);
        item.append(badge,title,text);
        const evidence=root.OfiProfileLinks?.evidenceNode?.(document,ins);
        if(evidence)item.append(evidence);
        list.append(item);
      }
      box.append(head,list);
      outliersEl.replaceChildren(box);
      outliersEl.hidden=false;
    }else if(outliersEl){
      outliersEl.replaceChildren();
      outliersEl.hidden=true;
    }
    $('normSummary').replaceChildren(...cards);$('normDetails').replaceChildren(...sections);panel.hidden=false;
  }
  $('normExport').addEventListener('click',()=>{
    if(!current)return;
    const ref=current.empiricalReference;
    const lines=[['inventory_items','reference_items','reference_N','group','scale','label','raw_all_items','range_score_0_100','alpha','omega_total','omega_h','raw_sem','sem_0_100','conditional_sem_0_100','ci95_low','ci95_high','ref_mean','ref_sd','t_score','z_score','is_outlier','level',...(ref.longVersionUsesSharedSubset?['raw_reference_120']:[]),'percentile','percentile_unrounded','pct_ci95_low','pct_ci95_high','conditional_ci95_low','conditional_ci95_high','conditional_ci_method','true_score_ci95_low','true_score_ci95_high']];
    for(const r of current.normRows)lines.push([ref.answeredItems,ref.percentileItems,ref.n,'everyone-all-ages',r.key,r.label,r.raw,r.score,r.alpha??'',r.omegaTotal??'',r.omegaH??'',r.rawSem??'',r.sem??'',r.conditionalSem??'',r.ci95?r.ci95[0]:'',r.ci95?r.ci95[1]:'',r.mean??'',r.sd??'',r.t,r.z,r.isOutlier?1:0,r.level,...(ref.longVersionUsesSharedSubset?[r.referenceRaw]:[]),r.percentile,r.percentileExact,r.percentileCi95?r.percentileCi95[0]:'',r.percentileCi95?r.percentileCi95[1]:'',r.conditionalCi95?r.conditionalCi95[0]:'',r.conditionalCi95?r.conditionalCi95[1]:'',r.conditionalCiMethod??'',r.trueScoreCi95?r.trueScoreCi95[0]:'',r.trueScoreCi95?r.trueScoreCi95[1]:'']);
    const csv='\uFEFF'+lines.map(row=>row.map(x=>'"'+String(x).replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=el('a');
    a.href=url;a.download='ofilab-empirical-'+ref.answeredItems+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  });
  root.addEventListener('ofilab:results',e=>render(e.detail.profile));
})(typeof window!=='undefined'?window:globalThis);
