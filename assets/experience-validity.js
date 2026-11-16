/* ofiLab results: response validity (straight-lining, acquiescence, random responding,
   person-fit, split-half) and the validity card. Never sends answers anywhere.
   Part of the results page; shares helpers through window.OfiExperience (see experience.js). */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  /* global computeResponseValidityFeatures -- assigned to window below */
  const ns=window.OfiExperience=window.OfiExperience||{};
  const el=(...args)=>ns.el(...args);

  window.computeResponseValidityFeatures = function computeResponseValidityFeatures(answers, bank, scoresOpt){
    if(!answers||!answers.length||!bank) return null;
    const total=answers.length;
    let count1=0,count2=0,count3=0,count4=0,count5=0;
    let sum=0,sumSq=0,validCount=0;
    const itemKeyByPos = [];
    (bank.items || []).forEach((it, idx) => {
      const pos = Number.isInteger(it && it.number) ? (it.number - 1) : idx;
      if(pos >= 0 && pos < total) itemKeyByPos[pos] = (it && it.keyed === 'minus') ? -1 : 1;
    });
    let maxRun=0,maxRunVal=null,currentRun=0,lastAns=null;
    let maxPolaritySpanRun=0,runStartKey=0,runCrossedPolarity=false;
    const maxRunByCat={1:0,2:0,3:0,4:0,5:0};
    const maxPolaritySpanRunByCat={1:0,2:0,3:0,4:0,5:0};
    for(let i=0; i<total; i++){
      const a = answers[i];
      if(typeof a!=='number'||!Number.isFinite(a)||a<1||a>5) continue;
      validCount++;
      if(a===1)count1++;else if(a===2)count2++;else if(a===3)count3++;else if(a===4)count4++;else if(a===5)count5++;
      sum+=a;
      sumSq+=a*a;
      const kSign = itemKeyByPos[i] || 1;
      if(a===lastAns){
        currentRun++;
        if(kSign !== runStartKey) runCrossedPolarity = true;
      }else{
        currentRun=1;
        lastAns=a;
        runStartKey=kSign;
        runCrossedPolarity=false;
      }
      if(currentRun>maxRun){maxRun=currentRun;maxRunVal=a;}
      if(currentRun>maxRunByCat[a]){maxRunByCat[a]=currentRun;}
      if(a===3 || runCrossedPolarity){
        if(currentRun>maxPolaritySpanRun) maxPolaritySpanRun=currentRun;
        if(currentRun>maxPolaritySpanRunByCat[a]) maxPolaritySpanRunByCat[a]=currentRun;
      }
    }
    const divisor = validCount>0 ? validCount : 1;
    const mean = sum / divisor;
    const variance = Math.max(0, (sumSq / divisor) - (mean * mean));
    const stdDev = Math.sqrt(variance);

    const extremePct=Math.round(((count1+count5)/divisor)*100);
    const neutralPct=Math.round((count3/divisor)*100);
    const moderatePct=Math.round(((count2+count4)/divisor)*100);
    const maxIdenticalCount=Math.max(count1,count2,count3,count4,count5);
    const maxIdenticalPct=Math.round((maxIdenticalCount/divisor)*100);

    let pairedDiffSum=0,pairsCount=0,arsWeightedNum=0,arsWeightDen=0;
    const byFacet={};
    (bank.items||[]).forEach((item,idx)=>{
      if(!item.domain)return;
      const k=item.facet?(item.domain+item.facet):item.domain;
      if(!byFacet[k])byFacet[k]=[];
      byFacet[k].push({item,ansIdx:Number.isInteger(item.number)?(item.number-1):idx});
    });
    for(const k of Object.keys(byFacet)){
      const items=byFacet[k];
      const plusItems=items.filter(x=>x.item.keyed==='plus');
      const minusItems=items.filter(x=>x.item.keyed==='minus');
      if(plusItems.length&&minusItems.length){
        const avgPlus=plusItems.reduce((acc,x)=>acc+(Number.isInteger(answers[x.ansIdx])?answers[x.ansIdx]:3),0)/plusItems.length;
        const avgMinus=minusItems.reduce((acc,x)=>acc+(6-(Number.isInteger(answers[x.ansIdx])?answers[x.ansIdx]:3)),0)/minusItems.length;
        pairedDiffSum+=Math.abs(avgPlus-avgMinus);
        pairsCount++;
        // Gauss-Markov harmonic weight w_f = (k+ * k-) / (k+ + k-) eliminates latent trait theta_f
        const wf = (plusItems.length * minusItems.length) / (plusItems.length + minusItems.length);
        arsWeightedNum += wf * (avgPlus - avgMinus);
        arsWeightDen += wf;
      }
    }
    const avgDiscrepancy=pairsCount?(pairedDiffSum/pairsCount):0.4;
    const arsEstimate = arsWeightDen > 0 ? Math.round((arsWeightedNum / (2 * arsWeightDen)) * 1000) / 1000 : 0;

    let synonymDiffSum=0, synonymPairsCount=0;
    const hasFacetBank=Boolean((bank.items||[]).some(it=>Boolean(it&&it.facet)));
    if(hasFacetBank){
      for(const k of Object.keys(byFacet)){
        const items=byFacet[k];
        const countDiffs = (group) => {
          if(group.length < 2) return;
          for(let i=0; i<group.length; i++) {
            for(let j=i+1; j<group.length; j++) {
              const ans1 = Number.isInteger(answers[group[i].ansIdx])?answers[group[i].ansIdx]:3;
              const ans2 = Number.isInteger(answers[group[j].ansIdx])?answers[group[j].ansIdx]:3;
              synonymDiffSum += Math.abs(ans1 - ans2);
              synonymPairsCount++;
            }
          }
        };
        countDiffs(items.filter(x=>x.item.keyed==='plus'));
        countDiffs(items.filter(x=>x.item.keyed==='minus'));
      }
    }
    const avgSynonymDiff = synonymPairsCount ? (synonymDiffSum / synonymPairsCount) : 0;

    // Psychometric straightlining, acquiescence & within-facet consistency detection
    // Disambiguate contiguous single-polarity blocks (e.g. #1-68 all-plus & #238-300 all-minus in 300; #96-111 all-minus in 120):
    // A respondent who actively reverses opposite-keyed items (avgDiscrepancy < 0.85, stdDev >= 0.80, maxIdenticalPct < 75)
    // is evaluated on polarity-spanning runs rather than unidirectional block runs.
    const reversesOppositePoles = pairsCount > 0 && avgDiscrepancy < 0.85 && stdDev >= 0.80 && maxIdenticalPct < 75;
    const effRunByCat = reversesOppositePoles ? maxPolaritySpanRunByCat : maxRunByCat;
    const effMaxRun = reversesOppositePoles ? maxPolaritySpanRun : maxRun;
    // Johnson (2005) pre-filtering longstring cutoffs: 10 for categories 1/2/3/5 and 13 for 4 in 120/300.
    const hasJohnsonLongstring = (effRunByCat[1] >= 10 || effRunByCat[2] >= 10 || effRunByCat[3] >= 10 || effRunByCat[4] >= 13 || effRunByCat[5] >= 10);
    const severeRun = divisor >= 250 ? 20 : 16;
    const isSevereStraightline = (maxIdenticalPct >= 75) || (neutralPct >= 70) || (stdDev < 0.42) || (effMaxRun >= severeRun);
    const isModerateStraightline = !isSevereStraightline && ((maxIdenticalPct >= 55) || (neutralPct >= 50) || (stdDev < 0.65) || hasJohnsonLongstring);
    const isHighDiscrepancy = !isSevereStraightline && pairsCount > 0 && avgDiscrepancy >= 1.75;
    const synonymThreshold = total >= 250 ? 1.50 : 1.48;
    const isInconsistentSynonyms = !isSevereStraightline && hasFacetBank && synonymPairsCount > 0 && avgSynonymDiff >= synonymThreshold;
    const isAcquiescenceBias = !isSevereStraightline && !isModerateStraightline && (mean >= 4.10 || mean <= 1.90) && pairsCount > 0 && avgDiscrepancy >= 1.45;

    // Multivariate empirical psychometric validity (Mahalanobis D^2, Samejima GRM Person-Fit l_z, Odd-Even Split-Half r_sb, Facet SNR)
    let mahalanobisD2 = null, mahalanobisPct = null, personFitLz = null, personFitLzPct = null, personFitLzMaxKnot = null;
    let splitHalfReliability = null, rawSplitHalfReliability = null, facetSnrF = null, ersResidual = null;
    let isErraticPersonFit = false, isRareMultivariateProfile = false, isSuspectedRandomResponding = false;
    const deepObj = (typeof window !== 'undefined' && window && window.OfiEmpiricalDeep)
      || (typeof globalThis !== 'undefined' && globalThis && globalThis.OfiEmpiricalDeep)
      || null;
    const invMode = total === 300 ? '300' : (total === 120 ? '120' : null);
    const valModel = (deepObj && deepObj.data && deepObj.data.validity && invMode) ? deepObj.data.validity[invMode] : null;
    if(valModel && validCount === total){
      const domOrder = ['N','E','O','A','C'];
      const erfApprox = (x) => {
        const sgn = x < 0 ? -1 : 1, ax = Math.abs(x);
        const t = 1 / (1 + 0.3275911 * ax);
        const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
        return sgn * y;
      };
      const normCdf = (z) => 0.5 * (1 + erfApprox(z / Math.SQRT2));
      const mahaLowerTailPct = (d2Val, qFirst, pFirst, df) => {
        if(d2Val <= 0 || qFirst <= 1e-9) return 0;
        if(df === 5){
          // Exact closed-form chi^2_5 CDF scaled so q_50 maps to 50.0% and 0 maps to 0.0%
          const x = d2Val * (4.3514602 / qFirst);
          const cdf = Math.max(0, erfApprox(Math.sqrt(x / 2)) - Math.sqrt((2 * x) / Math.PI) * (1 + x / 3) * Math.exp(-x / 2));
          return Math.round(Math.min(pFirst, cdf * (pFirst / 0.5)) * 10) / 10;
        }
        // Wilson-Hilferty cube-root chi^2_df CDF anchored smoothly at (0, 0%) and (qFirst, pFirst%)
        const zFirst = -1.2815515655; // Phi^-1(0.10) for pFirst = 10
        const muWh = 1 - 2 / (9 * df), sdWh = Math.sqrt(2 / (9 * df));
        const xScaled = d2Val * ((df * Math.pow(muWh + zFirst * sdWh, 3)) / qFirst);
        const zWh = (Math.pow(xScaled / df, 1 / 3) - muWh) / sdWh;
        return Math.round(Math.min(pFirst, Math.max(0, normCdf(zWh) * 100)) * 10) / 10;
      };
      const interpQuantiles = (val, qObj, probs, mahaDf) => {
        if(!qObj || !probs || !probs.length) return null;
        const firstP = probs[0], firstV = qObj[String(firstP)];
        if(val <= firstV){
          return mahaDf ? mahaLowerTailPct(val, firstV, firstP, mahaDf) : firstP;
        }
        const lastP = probs[probs.length - 1];
        if(val >= qObj[String(lastP)]) return lastP;
        for(let qi = 0; qi < probs.length - 1; qi++){
          const pA = probs[qi], pB = probs[qi + 1];
          const vA = qObj[String(pA)], vB = qObj[String(pB)];
          if(val >= vA && val <= vB){
            const span = vB - vA;
            return span > 1e-9 ? Math.round((pA + ((val - vA) / span) * (pB - pA)) * 10) / 10 : pB;
          }
        }
        return 50;
      };
      if(hasFacetBank && (invMode === '300' || invMode === '120')){
        const r100Vec = [];
        const fzVec = [];
        const haZ = [];
        const hbZ = [];
        const haRaw = [];
        const hbRaw = [];
        const facetAdjMeans = [];
        let ssWithinAdj = 0, dfWithinAdj = 0;
        const mPerFacet = invMode === '300' ? 10 : 4;
        const shNorms = valModel.splitHalfNorms;
        const irtScales = deepObj.data.irtOmega ? deepObj.data.irtOmega[invMode] : null;
        const defaultOmega = invMode === '300' ? 0.84 : 0.78;
        let colIdx = 0;
        for(let di = 0; di < 5; di++){
          const dKey = domOrder[di];
          for(let fi = 1; fi <= 6; fi++){
            const fk = dKey + fi;
            const entries = (byFacet[fk] || []).slice().sort((a, b) => a.ansIdx - b.ansIdx);
            const nIt = entries.length || mPerFacet;
            let fSum = 0, haSum = 0, haCnt = 0, hbSum = 0, hbCnt = 0, fAdjSum = 0;
            const fAdjVals = [];
            for(let ei = 0; ei < entries.length; ei++){
              const rawA = Number.isInteger(answers[entries[ei].ansIdx]) ? answers[entries[ei].ansIdx] : 3;
              const isMinus = entries[ei].item.keyed === 'minus';
              const keyedV = isMinus ? (6 - rawA) : rawA;
              const adjV = keyedV - (isMinus ? -arsEstimate : arsEstimate);
              fSum += keyedV;
              fAdjSum += adjV;
              fAdjVals.push(adjV);
              if(ei % 2 === 0){ haSum += keyedV; haCnt++; } else { hbSum += keyedV; hbCnt++; }
            }
            if(fAdjVals.length >= 2){
              const fAdjMean = fAdjSum / fAdjVals.length;
              facetAdjMeans.push(fAdjMean);
              for(let vi = 0; vi < fAdjVals.length; vi++){
                const dv = fAdjVals[vi] - fAdjMean;
                ssWithinAdj += dv * dv;
              }
              dfWithinAdj += (fAdjVals.length - 1);
            }
            const r100 = 100 * (fSum - nIt) / (4 * nIt);
            r100Vec.push(r100);
            const profFacet = scoresOpt && scoresOpt.domains && scoresOpt.domains[dKey] && scoresOpt.domains[dKey].facets
              ? scoresOpt.domains[dKey].facets[fi - 1] : null;
            if(profFacet && typeof profFacet.z === 'number' && Number.isFinite(profFacet.z)){
              fzVec.push(profFacet.z);
            } else if(shNorms && valModel.mahalanobis){
              const sA = shNorms.haSd[colIdx] || 0.85, sB = shNorms.hbSd[colIdx] || 0.85;
              const om = (irtScales && irtScales[fk] && irtScales[fk].omegaTotal) ? irtScales[fk].omegaTotal : defaultOmega;
              const rAb = om / Math.max(0.2, 2 - om);
              const sd100 = Math.max(4, 12.5 * Math.sqrt(sA * sA + sB * sB + 2 * rAb * sA * sB));
              fzVec.push((r100 - valModel.mahalanobis.mean[colIdx]) / sd100);
            } else {
              fzVec.push((r100 - 50) / 18);
            }
            if(haCnt > 0 && hbCnt > 0){
              const mHa = haSum / haCnt, mHb = hbSum / hbCnt;
              haRaw.push(mHa);
              hbRaw.push(mHb);
              if(shNorms){
                haZ.push((mHa - shNorms.haMean[colIdx]) / Math.max(1e-6, shNorms.haSd[colIdx]));
                hbZ.push((mHb - shNorms.hbMean[colIdx]) / Math.max(1e-6, shNorms.hbSd[colIdx]));
              }
            }
            colIdx++;
          }
        }
        // ARS-deconfounded Between-vs-Within Facet ANOVA F-ratio (scale-invariant to ERS/MRS)
        if(facetAdjMeans.length === 30 && dfWithinAdj > 0){
          let grandAdj = 0;
          for(let i = 0; i < 30; i++) grandAdj += facetAdjMeans[i];
          grandAdj /= 30;
          let ssBetweenAdj = 0;
          for(let i = 0; i < 30; i++){
            const db = facetAdjMeans[i] - grandAdj;
            ssBetweenAdj += mPerFacet * db * db;
          }
          const msBetween = ssBetweenAdj / 29;
          const msWithin = ssWithinAdj / dfWithinAdj;
          facetSnrF = msWithin > 1e-6 ? Math.round((msBetween / msWithin) * 100) / 100 : 99.99;
        }
        // 1. 30x30 Mahalanobis D^2
        if(valModel.mahalanobis && valModel.mahalanobis.precUpper){
          const mu = valModel.mahalanobis.mean, prec = valModel.mahalanobis.precUpper;
          let d2 = 0, pIdx = 0;
          for(let i = 0; i < 30; i++){
            const di = r100Vec[i] - mu[i];
            d2 += di * di * prec[pIdx++];
            for(let j = i + 1; j < 30; j++){
              d2 += 2 * di * (r100Vec[j] - mu[j]) * prec[pIdx++];
            }
          }
          mahalanobisD2 = Math.round(Math.max(0, d2) * 100) / 100;
          mahalanobisPct = interpQuantiles(mahalanobisD2, valModel.mahalanobis.quantiles, [10,25,50,75,90,95,98,99,99.5,99.9], 30);
          isRareMultivariateProfile = !isSevereStraightline && mahalanobisD2 > valModel.mahalanobis.quantiles['99.5'];
        }
        // 2. Odd-Even Split-Half Reliabilities (Norm-Standardized & Raw Keyed Spearman-Brown)
        const computeSbCorr = (vecA, vecB) => {
          let mA = 0, mB = 0;
          for(let i = 0; i < 30; i++){ mA += vecA[i]; mB += vecB[i]; }
          mA /= 30; mB /= 30;
          let num = 0, denA = 0, denB = 0;
          for(let i = 0; i < 30; i++){
            const cA = vecA[i] - mA, cB = vecB[i] - mB;
            num += cA * cB; denA += cA * cA; denB += cB * cB;
          }
          const den = Math.sqrt(denA * denB);
          const rHalf = den > 1e-6 ? (num / den) : 0;
          const rSb = rHalf > 0 ? ((2 * rHalf) / (1 + rHalf)) : rHalf;
          return Math.round(rSb * 100) / 100;
        };
        if(haZ.length === 30 && hbZ.length === 30) splitHalfReliability = computeSbCorr(haZ, hbZ);
        if(haRaw.length === 30 && hbRaw.length === 30) rawSplitHalfReliability = computeSbCorr(haRaw, hbRaw);
        // 3. Facet-Conditioned Samejima GRM Person-Fit l_z (Drasgow, Levine, & Williams, 1985) + Trait-Deconfounded ERS
        if(valModel.grmItems && valModel.grmItems.length === total){
          let l0 = 0, el0 = 0, vl0 = 0, expExtSum = 0, grmCount = 0;
          const bankItems = bank.items || [];
          for(let ii = 0; ii < bankItems.length; ii++){
            const it = bankItems[ii];
            const gIdx = Number.isInteger(it.number) ? (it.number - 1) : ii;
            const grm = valModel.grmItems[gIdx];
            const dPos = domOrder.indexOf(it.domain);
            if(!grm || dPos < 0 || !it.facet) continue;
            const th = fzVec[dPos * 6 + (it.facet - 1)] || 0;
            const rawA = Number.isInteger(answers[gIdx]) ? answers[gIdx] : 3;
            const respCat = (it.keyed === 'minus' ? (6 - rawA) : rawA) - 1;
            const ai = grm[0];
            const ps0 = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, ai * th + grm[1]))));
            const ps1 = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, ai * th + grm[2]))));
            const ps2 = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, ai * th + grm[3]))));
            const ps3 = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, ai * th + grm[4]))));
            const pc0 = Math.max(1e-7, 1 - ps0);
            const pc1 = Math.max(1e-7, ps0 - ps1);
            const pc2 = Math.max(1e-7, ps1 - ps2);
            const pc3 = Math.max(1e-7, ps2 - ps3);
            const pc4 = Math.max(1e-7, ps3);
            expExtSum += (pc0 + pc4);
            grmCount++;
            const ln0 = Math.log(pc0), ln1 = Math.log(pc1), ln2 = Math.log(pc2), ln3 = Math.log(pc3), ln4 = Math.log(pc4);
            const obsLn = respCat === 0 ? ln0 : (respCat === 1 ? ln1 : (respCat === 2 ? ln2 : (respCat === 3 ? ln3 : ln4)));
            const expI = pc0 * ln0 + pc1 * ln1 + pc2 * ln2 + pc3 * ln3 + pc4 * ln4;
            const sqI = pc0 * ln0 * ln0 + pc1 * ln1 * ln1 + pc2 * ln2 * ln2 + pc3 * ln3 * ln3 + pc4 * ln4 * ln4;
            l0 += obsLn;
            el0 += expI;
            vl0 += Math.max(0, sqI - expI * expI);
          }
          personFitLz = Math.round(((l0 - el0) / Math.sqrt(Math.max(vl0, 1e-6))) * 100) / 100;
          if(grmCount > 0){
            ersResidual = Math.round((((count1 + count5) / divisor) - (expExtSum / grmCount)) * 1000) / 1000;
          }
          if(valModel.lzQuantiles){
            const lzProbs = [0.1, 0.5, 1, 2, 5, 10, 25, 50, 75, 90, 95, 99].filter(p => valModel.lzQuantiles[String(p)] !== undefined);
            personFitLzPct = interpQuantiles(personFitLz, valModel.lzQuantiles, lzProbs, 0);
            if(lzProbs.length) personFitLzMaxKnot = lzProbs[lzProbs.length - 1];
            // Severe random-responding suspicion: person-fit below the cohort's 1st percentile AND either
            // parallel-item inconsistency above the cohort's ~99th percentile or near-zero raw split-half.
            // Calibrated on 18,000 IPIP-NEO cohort respondents vs 1,000 uniform-random runs per form:
            // flags 98.3% (120) / 100% (300) of random runs and 0.33% / 0.59% of the cohort (mostly careless).
            // A lucky high split-half alone no longer clears a person-fit this extreme.
            if(!isSevereStraightline && personFitLz !== null && valModel.lzQuantiles['1'] !== undefined){
              isSuspectedRandomResponding = personFitLz < valModel.lzQuantiles['1']
                && ((synonymPairsCount > 0 && avgSynonymDiff >= 1.35)
                  || (rawSplitHalfReliability !== null && rawSplitHalfReliability < 0.35));
            }
          }
          if(!isSevereStraightline && !isModerateStraightline && valModel.lzQuantiles && valModel.splitHalfQuantiles){
            const lowSplitHalf = (splitHalfReliability !== null && splitHalfReliability < valModel.splitHalfQuantiles['2'])
              || (rawSplitHalfReliability !== null && rawSplitHalfReliability < 0.45);
            const snrFloor = invMode === '300' ? 1.38 : 1.28;
            const contentBlindNoise = facetSnrF !== null && facetSnrF < snrFloor && stdDev >= 0.65
              && rawSplitHalfReliability !== null && rawSplitHalfReliability < 0.35;
            isErraticPersonFit = ((personFitLz < valModel.lzQuantiles['0.5']) && lowSplitHalf) || contentBlindNoise;
          }
        }
      }
    }

    return {
      total, validCount, divisor, mean, variance, stdDev,
      count1, count2, count3, count4, count5,
      extremePct, neutralPct, moderatePct,
      maxIdenticalCount, maxIdenticalPct, maxRun, maxRunVal, maxRunByCat,
      maxPolaritySpanRun, maxPolaritySpanRunByCat, reversesOppositePoles, hasJohnsonLongstring,
      pairedDiffSum, pairsCount, avgDiscrepancy, arsEstimate, ersResidual,
      hasFacetBank, synonymDiffSum, synonymPairsCount, avgSynonymDiff,
      mahalanobisD2, mahalanobisPct, personFitLz, personFitLzPct, personFitLzMaxKnot,
      splitHalfReliability, rawSplitHalfReliability, facetSnrF,
      isErraticPersonFit, isRareMultivariateProfile, isSuspectedRandomResponding,
      isSevereStraightline, isModerateStraightline, isHighDiscrepancy, isInconsistentSynonyms, isAcquiescenceBias,
      // One shared quality level for the card, summary chip, MBTI and the Markdown export:
      // 'low' = do not interpret (severe straight-lining or suspected random responding).
      validityLevel: (isSevereStraightline || isSuspectedRandomResponding) ? 'low'
        : ((isModerateStraightline || isAcquiescenceBias || isHighDiscrepancy || isInconsistentSynonyms || isErraticPersonFit) ? 'fair' : 'high')
    };
  }

  function renderValidityCard(scores,answers,bank){
    const card=$('responseValidityCard');
    if(!card)return;
    const f=(scores&&scores.validityFeatures)||computeResponseValidityFeatures(answers,bank,scores);
    if(!f){card.hidden=true;return;}

    card.hidden=false;card.replaceChildren();
    const head=el('div','validity-head');
    const modLabel = f.neutralPct >= 50
      ? 'בקרת מענה: שונות נמוכה (נטייה לניטרליות)'
      : 'בקרת מענה: שונות תגובות מצומצמת';
    const badgeLabel = f.isSevereStraightline ? 'בקרת מענה: התרעת מענה אחיד (Straight-lining)'
      : f.isSuspectedRandomResponding ? 'בקרת מענה: חשד למענה אקראי — אין לפרש את התוצאות'
      : (f.isModerateStraightline ? modLabel
      : (f.isAcquiescenceBias ? 'בקרת מענה: נטייה להסכמה או שלילה גורפת'
      : (f.isHighDiscrepancy ? 'בקרת מענה: פער בין היגדים ישירים והפוכים'
      : (f.isInconsistentSynonyms || f.isErraticPersonFit ? 'בקרת מענה: חוסר עקביות תוך-ממדית'
      : 'בקרת מענה: תקינה ומגוונת'))));
    const badge=el('span','validity-badge', badgeLabel);
    badge.dataset.status=f.validityLevel || (f.isSevereStraightline ? 'low' : (f.isModerateStraightline || f.isAcquiescenceBias || f.isHighDiscrepancy || f.isInconsistentSynonyms || f.isErraticPersonFit ? 'fair' : 'high'));
    head.append(el('h2',null,'בקרת איכות ועקביות המענה שלך'),badge);

    const desc=el('p','validity-desc');
    if (f.isSevereStraightline) {
      desc.textContent = 'זוהה דפוס מענה אחיד (Straight-lining) עם שונות נמוכה במיוחד וחזרתיות על אותה תשובה לאורך השאלון. תוצאות אלו משקפות מענה שרירותי או אחיד, ואינן מאפשרות גזירת פרופיל אישיות מהימן.';
    } else if (f.isSuspectedRandomResponding) {
      desc.textContent = 'דפוס התשובות דומה מאוד למענה אקראי: התאמה חריגה מאוד למודל (מתחת לאחוזון 1 באוכלוסייה) לצד חוסר עקביות בין היגדים מקבילים. במצב כזה הציונים קרובים לאמצע מסיבות טכניות ולא משקפים את האישיות, ולכן אין לפרש את התוצאות, את טיפוס ה־MBTI או את התובנות. מומלץ למלא את השאלון מחדש בקצב נוח.';
    } else if (f.isModerateStraightline) {
      desc.textContent = f.neutralPct >= 50
        ? 'זוהתה נטייה מוגברת לניטרליות או מענה אחיד ברצף היגדים. מומלץ להתייחס לתוצאות בזהירות, שכן רמת ההבחנה האישית בין התכונות עשויה להיות מוגבלת.'
        : 'זוהתה שונות מצומצמת או חזרתיות מוגברת על דירוג בודד ברצף שאלות. מומלץ להתייחס לתוצאות בזהירות בשל הבחנה מתונה בין ההיגדים.';
    } else if (f.isAcquiescenceBias) {
      desc.textContent = f.mean >= 4.10
        ? 'זוהתה נטייה להסכמה גורפת (Acquiescence) גם מול היגדים מנוגדים. ייתכן שחלק מהציונים מושפעים מסגנון דירוג מאשרר מעבר לתוכן ההיגדים עצמם.'
        : 'זוהתה נטייה לשלילה גורפת (Disacquiescence) גם מול היגדים הפוכים. מומלץ לבחון את פירוט השאלות בתחומי המשנה.';
    } else if (f.isHighDiscrepancy) {
      desc.textContent = 'זוהה פער גבוה בין היגדים ישירים והפוכים באותו ממד. ייתכן שחלק מהתשובות משקפות סגנון מענה או פרשנות שונה של היגדי שלילה; מומלץ לעיין בהן לפני הסקת מסקנות.';
    } else if (f.isInconsistentSynonyms || f.isErraticPersonFit) {
      desc.textContent = 'זוהה פער גבוה במיוחד במענה על היגדים מקבילים באותו כיוון בתוך תתי-הממדים. מומלץ לפתוח את פירוט השאלות בתחומי המשנה לבדיקת תשובות סותרות.';
    } else {
      desc.textContent = 'המענה מאופיין בהבחנה טובה ובעקביות סבירה בין היגדים מקבילים והפוכים. התוצאות משקפות תמונת אישיות יציבה וקוהרנטית.';
    }

    const grid=el('div','validity-grid');
    const chip1=el('div','validity-chip');
    chip1.append(
      el('strong',null,'התפלגות תשובות ושונות'),
      el('span',null,f.moderatePct+'% מתונות (2/4) · '+f.extremePct+'% נחרצות (1/5) · '+f.neutralPct+'% ניטרליות (3)')
    );
    if (f.isSevereStraightline || f.isModerateStraightline) {
      const runCuts = f.divisor >= 100 ? {1:10,2:10,3:10,4:13,5:10} : {1:8,2:8,3:8,4:8,5:8};
      const overRuns = f.hasJohnsonLongstring && f.maxRunByCat
        ? [1,2,3,4,5].filter(c => f.maxRunByCat[c] >= runCuts[c]).map(c => f.maxRunByCat[c]+' פעמים ברצף התשובה '+c+' (סף '+runCuts[c]+')')
        : [];
      chip1.append(el('small','validity-subtext','זוהתה חזרתיות גבוהה על תשובה בודדת ('+f.maxIdenticalPct+'% מכלל השאלון, רצף מקסימלי של '+f.maxRun+' שאלות'+(f.maxRunVal?' על התשובה '+f.maxRunVal:'')+')'+(overRuns.length?'. רצפים מעל סף הסינון של מדגם הייחוס: '+overRuns.join('; ')+'.':'.')));
    } else if (f.isInconsistentSynonyms) {
      chip1.append(el('small','validity-subtext','סטיית תקן של התשובות: '+f.stdDev.toFixed(2)+' (נמצא פער גבוה בין היגדים מקבילים באותו תת-ממד).'));
    } else {
      chip1.append(el('small','validity-subtext','סטיית תקן של התשובות: '+f.stdDev.toFixed(2)+' (רמה תקינה מעידה על הבחנה בין היגדים).'));
    }

    const chip3=el('div','validity-chip');
    if (f.synonymPairsCount > 0) {
      const synNote = f.isInconsistentSynonyms
        ? (f.avgSynonymDiff >= 1.60
          ? 'עקביות נמוכה ממענה אקראי (1.60 נק׳) בין היגדים מקבילים באותו תת-ממד.'
          : 'פער גבוה מהרגיל באוכלוסייה בין היגדים מקבילים באותו תת-ממד.')
        : 'המענה עקבי על שאלות מקבילות באותו תת-ממד.';
      chip3.append(
        el('strong',null,'עקביות תוך-ממדית בין היגדים מקבילים'),
        el('span',null,'פער ממוצע: '+f.avgSynonymDiff.toFixed(2)+' נק׳ (מתוך '+f.synonymPairsCount+' צמדים)'),
        el('small','validity-subtext', synNote)
      );
    } else {
      chip3.append(
        el('strong',null,'עקביות תוך-ממדית בין היגדים מקבילים'),
        el('span',null,'לא נמדד בסקירה מהירה (50 שאלות ללא תחומי משנה)'),
        el('small','validity-subtext','בגרסת 50 הפריטים מכסים היבטים שונים של כל תכונה; העקביות נבדקת מול היגדים הפוכים.')
      );
    }
    grid.append(chip3);

    const chip2=el('div','validity-chip');
    if (f.isSevereStraightline) {
      chip2.append(
        el('strong',null,'עקביות בין היגדים הפוכים'),
        el('span',null,'לא ניתן להערכה עקב היעדר שונות בתשובות'),
        el('small','validity-subtext','מדד השונות הנמדד: סטיית תקן '+f.stdDev.toFixed(2)+' (רצף מקסימלי: '+f.maxRun+' שאלות).')
      );
    } else if (f.isHighDiscrepancy || f.isAcquiescenceBias) {
      chip2.append(
        el('strong',null,'עקביות בין היגדים הפוכים'),
        el('span',null,'זוהתה נטייה לסתירות בין היגדים ישירים להפוכים'),
        el('small','validity-subtext','פער כיווניות ממוצע: '+f.avgDiscrepancy.toFixed(2)+' נק׳ ב־'+f.pairsCount+' צמדי בקרה (מומלץ לשים לב להיגדי שלילה).')
      );
    } else {
      chip2.append(
        el('strong',null,'עקביות בין היגדים הפוכים'),
        el('span',null,f.pairsCount>0?'זוהתה עקביות תקינה בין היגדים מנוגדים':'לא רלוונטי בסולם זה'),
        el('small','validity-subtext',f.pairsCount>0?'פער כיווניות ממוצע בין היגדים ישירים להפוכים: '+f.avgDiscrepancy.toFixed(2)+' נק׳ ('+f.pairsCount+' צמדי בקרה).':'השוואת כיווניות של קבוצות היגדים מנוגדות באותו ממד.')
      );
    }

    const chip4=el('div','validity-chip');
    chip4.append(
      el('strong',null,'רזולוציית השאלון ורמת הפירוט'),
      el('span',null,f.total===300?'רזולוציה מקסימלית (300 שאלות, פירוט 30 תת-תכונות)':(f.total===120?'רזולוציה מומלצת (120 שאלות, 30 תחומי משנה)':'סקירה מהירה (50 שאלות, ללא פירוט תחומי משנה)')),
      el('small','validity-subtext','השאלון מתבסס על סולמות ה-IPIP המקוריים ומיועד להתבוננות והעשרה עצמית (לא לאבחון קליני).')
    );
    grid.append(chip1,chip2,chip4);

    if(!f.isSevereStraightline && f.mahalanobisD2 !== null){
      if(f.splitHalfReliability !== null){
        const chipSh = el('div','validity-chip');
        const shGood = f.splitHalfReliability >= (f.total === 300 ? 0.61 : 0.48);
        chipSh.append(
          el('strong',null,'עקביות חצוי־חצאים (Odd-Even Split-Half)'),
          el('span',null,'מתאם ספירמן־בראון: r = '+f.splitHalfReliability.toFixed(2)),
          el('small','validity-subtext',shGood
            ? 'התאמה גבוהה בין חצאי הפריטים הזוגיים והאי־זוגיים בכל 30 תחומי המשנה (מכויל מול 145,388 משיבים).'
            : 'התאמה נמוכה מהצפוי בין חצאי השאלון; ייתכן שינוי קשב לאורך המענה.')
        );
        grid.append(chipSh);
      }
      if(f.personFitLz !== null){
        const chipLz = el('div','validity-chip');
        const lzDeep = (typeof window !== 'undefined' && window && window.OfiEmpiricalDeep) || (typeof globalThis !== 'undefined' && globalThis && globalThis.OfiEmpiricalDeep) || null;
        const lzQ5 = lzDeep && lzDeep.data && lzDeep.data.validity && lzDeep.data.validity[String(f.total)] && lzDeep.data.validity[String(f.total)].lzQuantiles
          ? lzDeep.data.validity[String(f.total)].lzQuantiles['5'] : null;
        const lzThresh = typeof lzQ5 === 'number' ? lzQ5 : (f.total === 300 ? -5.56 : -2.97);
        const lzOk = f.personFitLz >= lzThresh;
        const maxKnot = f.personFitLzMaxKnot || 90;
        const lzPctLabel = f.personFitLzPct !== null
          ? (f.personFitLzPct >= maxKnot ? 'מעל אחוזון '+maxKnot+'%' : (f.personFitLzPct <= 0.1 ? 'מתחת לאחוזון 0.1%' : 'אחוזון עקביות ~'+Math.round(f.personFitLzPct)+'%'))
          : ('מדד סבירות: '+(f.personFitLz >= 0 ? '+' : '')+f.personFitLz.toFixed(2));
        const chipSpan = el('span',null,lzPctLabel);
        chipSpan.title = 'ערך l_z גולמי: '+(f.personFitLz >= 0 ? '+' : '')+f.personFitLz.toFixed(2)+' (במדגם הייחוס סטיית התקן של l_z היא '+(f.total===300?'3.16':'1.98')+')';
        chipLz.append(
          el('strong',null,'התאמת מודל תגובה לפריט (IRT GRM)'),
          chipSpan,
          el('small','validity-subtext',lzOk
            ? 'דפוס הדירוג ברמת הפריט עקבי עם מודל התגובה המדורגת של כל תת־ממד (ביחס למדגם הייחוס המסונן).'
            : 'זוהו בחירות חריגות ביחס לציון תת־הממד האישי (מתחת לאחוזון 5 במדגם הייחוס).')
        );
        grid.append(chipLz);
      }
      const chipMaha = el('div','validity-chip');
      chipMaha.append(
        el('strong',null,'סבירות פרופיל רב־ממדי (Mahalanobis D²)'),
        el('span',null,'מרחק D² = '+f.mahalanobisD2.toFixed(1)+(f.mahalanobisPct !== null ? ' (אחוזון חריגות ~'+Math.round(f.mahalanobisPct)+'%)' : '')),
        el('small','validity-subtext',f.isRareMultivariateProfile
          ? 'שילוב תכונות נדיר במיוחד באוכלוסייה הכללית (מעל אחוזון 99.5 במדגם הייחוס).'
          : 'צירוף התכונות נמצא בטווח המתאמים הרב־ממדי המוכר (הערה: מדגם הייחוס עבר סינון מוקדם של רצפי תשובות אחידים לפי Johnson, 2005).')
      );
      grid.append(chipMaha);
    }

    card.append(head,desc,grid);
  }

  ns.renderValidityCard=renderValidityCard;
})();
