/**
 * HEXACO-H 16-Item Micro-Questionnaire Codec & Scoring Engine
 * Model: Honesty-Humility factor from HEXACO-PI-R (Lee & Ashton, 2004)
 * URL hash format: &h=<7 Base64URL characters>
 */
(function(root){
  'use strict';

  const B64CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const B64REV = {};
  for(let i = 0; i < 64; i++) B64REV[B64CHARS[i]] = i;

  function getDeepModels(){
    if(root && root.OfiEmpiricalDeep && root.OfiEmpiricalDeep.data) return root.OfiEmpiricalDeep;
    if(typeof require === 'function'){
      try { return require('./empirical-deep-models.js'); } catch(_e){}
    }
    return null;
  }

  function normPct(z){
    const signZ = z < 0 ? -1 : 1;
    const xZ = Math.abs(z) / Math.SQRT2;
    const tZ = 1 / (1 + 0.3275911 * xZ);
    const erfZ = 1 - (((((1.061405429 * tZ - 1.453152027) * tZ) + 1.421413741) * tZ - 0.284496736) * tZ + 0.254829592) * tZ * Math.exp(-xZ * xZ);
    return 0.5 * (1 + signZ * erfZ) * 100;
  }

  function bytesToBase64Url(bytes){
    let bitBuffer = 0n;
    for(let i = 0; i < 5; i++) bitBuffer = (bitBuffer << 8n) | BigInt(bytes[i]);
    bitBuffer <<= 2n; // 40 bits to 42 bits
    let res = '';
    for(let i = 6; i >= 0; i--){
      const idx = Number((bitBuffer >> BigInt(i * 6)) & 0x3Fn);
      res += B64CHARS[idx];
    }
    return res;
  }

  function base64UrlToBytes(str){
    if(typeof str !== 'string' || str.length !== 7){
      throw Error('קידוד HEXACO אינו תקין (נדרשים בדיוק 7 תווים).');
    }
    let bitBuffer = 0n;
    for(let i = 0; i < 7; i++){
      const val = B64REV[str[i]];
      if(val === undefined) throw Error('תו לא חוקי בקידוד HEXACO: ' + str[i]);
      bitBuffer = (bitBuffer << 6n) | BigInt(val);
    }
    if ((bitBuffer & 3n) !== 0n) throw Error('Padding bits are not zero.');
      bitBuffer >>= 2n;
    const bytes = new Uint8Array(5);
    for(let i = 4; i >= 0; i--){
      bytes[i] = Number(bitBuffer & 0xFFn);
      bitBuffer >>= 8n;
    }
    return bytes;
  }

  function encode(answers){
    if(!Array.isArray(answers) || answers.length !== 16){
      throw Error('קידוד שאלון HEXACO מחייב מערך של 16 תשובות.');
    }
    let val = 0n;
    for(let i = 0; i < 16; i++){
      const raw = Number(answers[i]);
      if(!Number.isInteger(raw) || raw < 1 || raw > 5){
        throw Error('תשובה לא תקינה בשאלון HEXACO במיקום ' + (i + 1) + ' (נדרש מספר שלם 1–5).');
      }
      val = val * 5n + BigInt(raw - 1);
    }
    const bytes = new Uint8Array(5);
    for(let i = 4; i >= 0; i--){
      bytes[i] = Number(val & 0xFFn);
      val >>= 8n;
    }
    return bytesToBase64Url(bytes);
  }

  function decode(token){
    const bytes = base64UrlToBytes(token);
    let val = 0n;
    for(let i = 0; i < 5; i++){
      val = (val << 8n) | BigInt(bytes[i]);
    }
    if (val >= 152587890625n) throw Error('ערך קידוד HEXACO חורג מהטווח החוקי.');
    const answers = new Array(16);
    for(let i = 15; i >= 0; i--){
      const digit = Number(val % 5n);
      answers[i] = digit + 1;
      val /= 5n;
    }
    return answers;
  }

  function calculate(bank, answers){
    if(!bank || !Array.isArray(bank.items) || bank.items.length !== 16){
      throw Error('בנק שאלות HEXACO אינו תקין.');
    }
    if(!Array.isArray(answers) || answers.length !== 16){
      throw Error('נמסרו פחות מ-16 תשובות לשאלון HEXACO.');
    }
    const dense = Array.from(answers);
    for(let i = 0; i < 16; i++){
      const ans = dense[i];
      if(!Number.isInteger(ans) || ans < 1 || ans > 5){
        throw new RangeError('תשובה לא תקינה בשאלון HEXACO במיקום ' + (i + 1) + ' (נדרש מספר שלם 1–5).');
      }
    }

    const itemScores = [];
    const facetSums = {
      sincerity: 0,
      fairness: 0,
      greedAvoidance: 0,
      modesty: 0
    };
    const facetCounts = {
      sincerity: 0,
      fairness: 0,
      greedAvoidance: 0,
      modesty: 0
    };

    for(let i = 0; i < 16; i++){
      const item = bank.items[i];
      const ans = dense[i];
      // Likert 1..5 transformed to 0..100
      const score = item.key === '-'
        ? ((5 - ans) / 4) * 100
        : ((ans - 1) / 4) * 100;

      itemScores.push(score);
      const facet = item.facet;
      if(facetSums[facet] !== undefined){
        facetSums[facet] += score;
        facetCounts[facet]++;
      }
    }

    const facetMeans = {
      sincerity: facetSums.sincerity / (facetCounts.sincerity || 1),
      fairness: facetSums.fairness / (facetCounts.fairness || 1),
      greedAvoidance: facetSums.greedAvoidance / (facetCounts.greedAvoidance || 1),
      modesty: facetSums.modesty / (facetCounts.modesty || 1)
    };
    const facets = {
      sincerity: Math.round(facetMeans.sincerity),
      fairness: Math.round(facetMeans.fairness),
      greedAvoidance: Math.round(facetMeans.greedAvoidance),
      modesty: Math.round(facetMeans.modesty)
    };

    const overallRaw = (facetMeans.sincerity + facetMeans.fairness + facetMeans.greedAvoidance + facetMeans.modesty) / 4;
    const overallScore = Math.round(Math.max(0, Math.min(100, overallRaw)));

    // Universal HEXACO-H 0..100 distribution (Lee & Ashton, 2018, Assessment, N=100,318 everyone-all-ages: mu=57.25, sd=15.5)
    const hexSupp = getDeepModels()?.data?.supplementary?.hexaco || null;
    const idx64 = Math.max(0, Math.min(64, Math.round((overallRaw * 64) / 100)));
    const percentileExact = (hexSupp && Array.isArray(hexSupp.cdf65) && hexSupp.cdf65.length === 65)
      ? hexSupp.cdf65[idx64]
      : Math.round(normPct((overallRaw - 57.25) / 15.5) * 100) / 100;
    const percentileEst = Math.max(1, Math.min(99, Math.round(percentileExact)));
    const omega = hexSupp?.omegaTotal || 0.86;
    const sem = hexSupp?.sem100 || 5.8;
    const ci90Half = Math.round(1.645 * sem);

    const facetPercentiles = {};
    for(const fKey of ['sincerity', 'fairness', 'greedAvoidance', 'modesty']){
      const fm = hexSupp?.facets?.[fKey];
      const fMu = fm ? fm.mean100 : 57.25;
      const fSd = fm ? fm.sd100 : 20.0;
      facetPercentiles[fKey] = Math.max(1, Math.min(99, Math.round(normPct((facetMeans[fKey] - fMu) / fSd))));
    }

    const level = overallRaw < 45 ? 0 : (overallRaw >= 68 ? 2 : 1);
    const levelKey = ['low', 'average', 'high'][level];
    const levelLabels = ['נמוך', 'ממוצע', 'גבוה'];

    const narrative = [
      'רמת כנות וענווה נמוכה (Low H): מעידה על אוריינטציה פרגמטית, תחרותית וממוקדת הישגים. קיימת נכונות להשתמש בחנופה, גמישות בעקיפת מוסכמות או חוקים פורמליים, ומשיכה לסמלי הצלחה, עושר ומעמד אישי.',
      'רמת כנות וענווה ממוצעת (Average H): מעידה על איזון בריא ומציאותי. שמירה על יושרה והגינות ביחסים אישיים ועסקיים, לצד שאיפה טבעית להכרה, התקדמות ושיפור ברמת החיים ללא ניצול מכוון של אחרים.',
      'רמת כנות וענווה גבוהה (High H): מעידה על יושרה עמוקה, צניעות אותנטית והגינות פנימית בלתי מתפשרת. סלידה מובהקת ממניפולציות ומחנופה, הימנעות מוחלטת מניצול נקודות תורפה של הזולת, וחוסר עניין ברדיפת סטטוס או מוצרי ראווה.'
    ][level];

    return {
      type: 'direct',
      accuracy: 1.0,
      score: overallScore,
      percentileEst,
      percentileExact,
      omega,
      sem,
      cohortN: hexSupp?.cohortN || 100318,
      ci90: [Math.max(0, overallScore - ci90Half), Math.min(100, overallScore + ci90Half)],
      level: levelKey,
      levelLabel: levelLabels[level],
      facets,
      facetPercentiles,
      answers: [...answers],
      narrative
    };
  }

  const api = {
    encode,
    decode,
    calculate
  };

  if(typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
  root.OfiHexacoCodec = api;

})(typeof window !== 'undefined' ? window : globalThis);
