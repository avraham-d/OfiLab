/**
 * IPIP-VIA-R 60-Item Weighted Character Strengths Codec & Scoring Engine
 * Models:
 *   1. Bluemke, Partsch, Saucier, & Lechner (2021) — IPIP-VIA-R (balanced 4-item scales)
 *   2. McGrath, Hall-Simmonds, & Goldberg (2020) — True-score & regression overlap with IPIP-NEO facets
 *   3. Partsch, Olaru, & Lechner (2024) — 3 Global Core Strength Metatraits (Positivity, Dependability, Mastery)
 *
 * URL hash format: &v=<24 Base64URL characters> (60 answers of 1..5 -> 5^60 -> 140 bits -> 24 Base64URL chars)
 */
(function(root) {
  'use strict';

  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const MAP = new Map();
  for (let i = 0; i < 64; i++) MAP.set(CHARS[i], i);

  // Max value: 5^60 - 1
  const MAX_VAL = (5n ** 60n) - 1n;

  function getDeepModels() {
    if (root && root.OfiEmpiricalDeep && root.OfiEmpiricalDeep.data) return root.OfiEmpiricalDeep;
    if (typeof require === 'function') {
      try { return require('./empirical-deep-models.js'); } catch (_e) {}
    }
    return null;
  }

  function normalCdf(z) {
    const signZ = z < 0 ? -1 : 1;
    const xZ = Math.abs(z) / Math.SQRT2;
    const tZ = 1 / (1 + 0.3275911 * xZ);
    const erfZ = 1 - (((((1.061405429 * tZ - 1.453152027) * tZ) + 1.421413741) * tZ - 0.284496736) * tZ + 0.254829592) * tZ * Math.exp(-xZ * xZ);
    return 0.5 * (1 + signZ * erfZ);
  }

  // Inverse Cornish-Fisher skew-adjusted normal percentile (monotone on bounded VIA scales)
  function skewNormPercentile(score100, mu, sd, skew) {
    const x = (score100 - mu) / Math.max(4, sd);
    const c = (Number(skew) || 0) / 6;
    let z = x;
    if (Math.abs(c) > 1e-4) {
      const disc = Math.max(0.09, 1 + 4 * c * (x + c));
      z = (-1 + Math.sqrt(disc)) / (2 * c);
    }
    return Math.round(normalCdf(z) * 1000) / 10;
  }

  function encode(answers) {
    if (!Array.isArray(answers) || answers.length !== 60) {
      throw new Error('קידוד שאלון חוזקות (IPIP-VIA-R) מחייב מערך של 60 תשובות.');
    }
    let num = 0n;
    for (let i = 0; i < 60; i++) {
      const raw = Number(answers[i]);
      if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
        throw new Error('תשובה לא תקינה בשאלון IPIP-VIA-R במיקום ' + (i + 1) + ' (נדרש מספר שלם 1–5).');
      }
      num = num * 5n + BigInt(raw - 1);
    }
    let out = '';
    for (let i = 0; i < 24; i++) {
      const chunk = Number(num & 63n);
      out = CHARS[chunk] + out;
      num >>= 6n;
    }
    return out;
  }

  function decode(token) {
    if (typeof token !== 'string' || token.length !== 24) {
      throw new Error('קידוד IPIP-VIA-R אינו תקין (נדרשים בדיוק 24 תווים).');
    }
    let num = 0n;
    for (let i = 0; i < 24; i++) {
      const val = MAP.get(token[i]);
      if (val === undefined) throw new Error('תו לא חוקי בקידוד IPIP-VIA-R: ' + token[i]);
      num = (num << 6n) | BigInt(val);
    }
    if (num > MAX_VAL) {
      throw new Error('ערך קידוד IPIP-VIA-R חורג מהטווח החוקי.');
    }
    const answers = new Array(60);
    for (let i = 59; i >= 0; i--) {
      const digit = Number(num % 5n);
      answers[i] = digit + 1;
      num /= 5n;
    }
    return answers;
  }

  // Rational inverse normal Phi^-1(p) (Acklam approximation, max error < 1.2e-9)
  function pctToZ(pct) {
    const p = Math.max(0.003, Math.min(0.997, Number(pct) / 100));
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pLow = 0.02425, pHigh = 1 - pLow;
    if (p < pLow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= pHigh) {
      const q = p - 0.5, r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  function extractNeoFacetMap(profile) {
    const map = {};
    const zMap = {};
    if (!profile || !profile.domains) return { hasFacets: false, hasDomains: false, invMode: 120, map, zMap };
    const domainKeys = ['N', 'E', 'O', 'A', 'C'];
    let hasFacets = false;
    let hasDomains = false;
    // Fallback only (no z and no percentile): IPIP-NEO-120 domain range-score mean/SD, original N=410,376 for active percentiles; legacy fallback coefficients unchanged
    // (computed from data/empirical-norms.json). Replaces the retired IPIP-50 constants.
    const POP_MEAN_RANGE = { N: 45.8, E: 59.9, O: 62.6, A: 66.9, C: 65.2 };
    const POP_SD_RANGE = { N: 16.7, E: 15.2, O: 13.0, A: 13.2, C: 15.3 };
    for (const d of domainKeys) {
      const dom = profile.domains[d];
      if (!dom) continue;
      const hasDomPct = typeof dom.percentileExact === 'number' && Number.isFinite(dom.percentileExact);
      const domVal = hasDomPct ? dom.percentileExact : dom.score;
      if (typeof domVal === 'number' && Number.isFinite(domVal)) {
        map[d] = Number(domVal);
        if (typeof dom.z === 'number' && Number.isFinite(dom.z)) {
          zMap[d] = Math.max(-2.8, Math.min(2.8, dom.z));
        } else if (hasDomPct) {
          zMap[d] = pctToZ(domVal);
        } else {
          zMap[d] = Math.max(-2.8, Math.min(2.8, (domVal - (POP_MEAN_RANGE[d] || 60)) / (POP_SD_RANGE[d] || 15)));
        }
        hasDomains = true;
      }
      if (Array.isArray(dom.facets) && dom.facets.length === 6) {
        hasFacets = true;
        for (let i = 0; i < 6; i++) {
          const f = dom.facets[i];
          const fCode = d + (i + 1);
          const hasFPct = f && typeof f.percentileExact === 'number' && Number.isFinite(f.percentileExact);
          const fVal = f && (hasFPct ? f.percentileExact : f.score);
          if (typeof fVal === 'number' && Number.isFinite(fVal)) {
            map[fCode] = Number(fVal);
            if (typeof f.z === 'number' && Number.isFinite(f.z)) {
              zMap[fCode] = Math.max(-2.8, Math.min(2.8, f.z));
            } else if (hasFPct) {
              zMap[fCode] = pctToZ(fVal);
            } else {
              zMap[fCode] = Math.max(-2.8, Math.min(2.8, (fVal - 58) / 18));
            }
          }
        }
      }
    }
    const pctItems = profile?.empiricalReference?.percentileItems || profile?.version;
    const invMode = (pctItems === 300 && !profile?.empiricalReference?.longVersionUsesSharedSubset)
      ? 300
      : (hasFacets ? 120 : 50);
    return { hasFacets, hasDomains, invMode, map, zMap };
  }

  // Equate standardized NEO composite Z onto the balanced IPIP-VIA-R 4-item 0..100 scale
  // (Bluemke et al., 2021: mu = 62.5, sigma = 16.5), using exact cohort composite SD (N=145,388)
  // per strength when available to preserve true unit-variance composite scaling.
  function computeNeoWeightedScore(neoWeights, neoInfo, sCalib) {
    if (!Array.isArray(neoWeights) || !neoWeights.length) return null;
    if (neoInfo.hasFacets) {
      const terms = [];
      for (const w of neoWeights) {
        const z = neoInfo.zMap[w.facet];
        if (typeof z !== 'number') continue;
        terms.push({ z: w.invert ? -z : z, w: Math.abs(Number(w.weight) || 0) });
      }
      if (!terms.length) return null;
      let zNum = 0, varDenom = 0;
      for (let i = 0; i < terms.length; i++) {
        zNum += terms[i].w * terms[i].z;
        varDenom += terms[i].w * terms[i].w;
        for (let j = i + 1; j < terms.length; j++) {
          varDenom += 2 * terms[i].w * terms[j].w * 0.28;
        }
      }
      const empDenom = (sCalib && terms.length === neoWeights.length)
        ? (neoInfo.invMode === 300 ? sCalib.neoSd300 : sCalib.neoSd120)
        : null;
      const denomSd = (typeof empDenom === 'number' && empDenom > 0.05) ? empDenom : Math.sqrt(Math.max(1e-6, varDenom));
      const zComp = zNum / denomSd;
      return Math.max(0, Math.min(100, 62.5 + 16.5 * zComp));
    }
    if (neoInfo.hasDomains) {
      const domSigned = {};
      for (const w of neoWeights) {
        // IPIP-50 Factor V is Intellect/Imagination, NOT O6 Political Liberalism;
        // never invert Intellect when an O6 conservatism proxy weight is present.
        if (w.facet === 'O6' && w.invert) continue;
        const domKey = String(w.facet).charAt(0);
        if (typeof neoInfo.zMap[domKey] !== 'number') continue;
        const signedW = (w.invert ? -1 : 1) * (Number(w.weight) || 0);
        domSigned[domKey] = (domSigned[domKey] || 0) + signedW;
      }
      const domEntries = Object.entries(domSigned).filter(([, sw]) => Math.abs(sw) > 1e-6);
      if (!domEntries.length) return null;
      let zNum = 0, varDenom = 0;
      for (let i = 0; i < domEntries.length; i++) {
        const [dk1, sw1] = domEntries[i];
        zNum += sw1 * neoInfo.zMap[dk1];
        varDenom += sw1 * sw1;
        for (let j = i + 1; j < domEntries.length; j++) {
          const [, sw2] = domEntries[j];
          varDenom += 2 * Math.abs(sw1 * sw2) * 0.18;
        }
      }
      const zComp = varDenom > 0 ? (zNum / Math.sqrt(varDenom)) : 0;
      return Math.max(0, Math.min(100, 62.5 + 16.5 * zComp));
    }
    return null;
  }

  function calculate(bank, answers, bigFiveProfile) {
    if (!bank || !Array.isArray(bank.items) || bank.items.length !== 60 || !bank.strengths) {
      throw new Error('בנק שאלות IPIP-VIA-R אינו תקין.');
    }
    const hasAnswers = Array.isArray(answers) && answers.length === 60;
    if (answers != null && !hasAnswers) {
      throw new Error('נדרשות 60 תשובות לחישוב שאלון IPIP-VIA-R.');
    }

    // 1. Direct scale averages for the 15 directly measured strengths (4 items each)
    const directSums = {};
    const directCounts = {};
    if (hasAnswers) {
      const dense = Array.from(answers);
      for (let i = 0; i < 60; i++) {
        const item = bank.items[i];
        const ans = dense[i];
        if (!Number.isInteger(ans) || ans < 1 || ans > 5) {
          throw new RangeError('תשובה לא תקינה בשאלון IPIP-VIA-R במיקום ' + (i + 1) + ' (נדרש מספר שלם 1–5).');
        }
        const itemScore = item.key === '-'
          ? ((5 - ans) / 4) * 100
          : ((ans - 1) / 4) * 100;
        const sKey = item.strength;
        directSums[sKey] = (directSums[sKey] || 0) + itemScore;
        directCounts[sKey] = (directCounts[sKey] || 0) + 1;
      }
    }

    const directScores = {};
    for (const sKey of Object.keys(directSums)) {
      directScores[sKey] = directSums[sKey] / (directCounts[sKey] || 1);
    }

    // 2. Extract Big Five facets/domains and optional HEXACO / ECR-RS signals
    const neoInfo = extractNeoFacetMap(bigFiveProfile);
    const hexacoDirect = (bigFiveProfile?.hexacoHonesty?.type === 'direct') ? bigFiveProfile.hexacoHonesty.facets : null;
    const ecrrsDirect = bigFiveProfile?.ecrrsScores || null;
    const viaSupp = getDeepModels()?.data?.supplementary?.via || null;

    // 3. Compute all 24 strengths using precision-weighted composite formulas
    const strengthList = [];
    for (const [key, def] of Object.entries(bank.strengths)) {
      const sCalib = viaSupp?.strengths?.[key] || null;
      const neoScore = computeNeoWeightedScore(def.neoWeights, neoInfo, sCalib);
      const hasDirect = typeof directScores[key] === 'number';
      const directVal = hasDirect ? directScores[key] : null;

      let finalScore = 50;
      let sourceType = 'direct';
      let sourceLabel = 'מדידה ישירה (IPIP-VIA-R)';

      if (!hasAnswers) {
        finalScore = neoScore !== null ? neoScore : 50;
        sourceType = 'proxy';
        sourceLabel = 'אומדן מ-30 תחומי המשנה של ה-Big Five (r*=' + Math.round((def.mcgrathTrueR || 0.74) * 100) + '%)';
      } else if (def.mode === 'direct_composite' && directVal !== null) {
        if (neoInfo.hasFacets && neoScore !== null) {
          const w = typeof def.directWeight === 'number' ? def.directWeight : 0.80;
          finalScore = w * directVal + (1 - w) * neoScore;
          sourceType = 'composite';
          sourceLabel = 'שקלול מהימנות: IPIP-VIA-R (' + Math.round(w * 100) + '%) + פאסטים (' + Math.round((1 - w) * 100) + '%)';
        } else {
          finalScore = directVal;
          sourceType = 'direct';
          sourceLabel = 'מדידה ישירה · IPIP-VIA-R (4 היגדים מאוזנים)';
        }

        // Cross-model precision boost if HEXACO-H or ECR-RS direct exists
        if (key === 'fairness' && hexacoDirect && typeof hexacoDirect.fairness === 'number') {
          finalScore = 0.80 * finalScore + 0.20 * hexacoDirect.fairness;
        } else if (key === 'honesty' && hexacoDirect && typeof hexacoDirect.sincerity === 'number') {
          finalScore = 0.80 * finalScore + 0.20 * hexacoDirect.sincerity;
        } else if (key === 'love' && ecrrsDirect && typeof ecrrsDirect.avoidance === 'number') {
          const intimacyScore = Math.max(0, Math.min(100, ((7 - ecrrsDirect.avoidance) / 6) * 100));
          finalScore = 0.82 * finalScore + 0.18 * intimacyScore;
        }
      } else {
        // 9 high-overlap NEO facet strengths (McGrath r* = 0.83 - 0.92)
        const fallbacks = (def.fallbackVia || []).map(k => directScores[k]).filter(v => typeof v === 'number');
        const fallbackMean = fallbacks.length ? (fallbacks.reduce((a, b) => a + b, 0) / fallbacks.length) : 50;

        if (neoInfo.hasFacets && neoScore !== null) {
          finalScore = 0.85 * neoScore + 0.15 * fallbackMean;
          if (key === 'humility' && hexacoDirect && typeof hexacoDirect.modesty === 'number') {
            finalScore = 0.55 * finalScore + 0.45 * hexacoDirect.modesty;
            sourceType = 'composite_hexaco';
            sourceLabel = 'מדידה משולבת: פאסט A5 (NEO) + צניעות (HEXACO-H)';
          } else {
            sourceType = 'neo_facet';
            sourceLabel = 'פאסטים ישירים מ-IPIP-NEO (חפיפה מחקרית r*=' + Math.round(def.mcgrathTrueR * 100) + '%)';
          }
        } else if (neoInfo.hasDomains && neoScore !== null) {
          finalScore = 0.65 * neoScore + 0.35 * fallbackMean;
          sourceType = 'neo_domain';
          sourceLabel = 'שקלול ממדי Big Five + סולמות IPIP-VIA-R קרובים';
        } else {
          finalScore = fallbackMean;
          if (key === 'humility' && hexacoDirect && typeof hexacoDirect.modesty === 'number') {
            finalScore = 0.70 * hexacoDirect.modesty + 0.30 * fallbackMean;
            sourceType = 'hexaco_direct';
            sourceLabel = 'מדידה ישירה מתוך HEXACO-H + IPIP-VIA-R';
          } else {
            sourceType = 'via_proxy';
            sourceLabel = 'אומדן מסולמות IPIP-VIA-R קרובים (השלמת שאלון ה־Big Five מחזקת את האומדן)';
          }
        }
      }

      const roundedScore = Math.round(Math.max(0, Math.min(100, finalScore)));
      const omega = def.omega || 0.78;
      const refSd = sCalib ? sCalib.sd100 : 17.0;
      const sem = Math.round(refSd * Math.sqrt(Math.max(0.04, 1 - (neoInfo.hasFacets ? Math.min(0.95, omega + 0.12) : omega))) * 10) / 10;

      // Universal normative percentile (McGrath, 2015 N=1,039,811 + Bluemke et al., 2021 balanced IPIP-VIA-R calibration)
      const muRef = !hasAnswers
        ? 62.5
        : (sCalib ? (0.55 * sCalib.mean100 + 0.45 * 55.0) : 62.5);
      const sdRef = !hasAnswers
        ? 16.5
        : (sCalib ? (neoInfo.hasFacets ? 0.88 * sCalib.sd100 : sCalib.sd100) : 16.5);
      const skewRef = !hasAnswers ? 0 : (sCalib ? 0.65 * sCalib.skew : -0.20);
      const percentileExact = skewNormPercentile(finalScore, muRef, sdRef, skewRef);
      const percentileEst = Math.max(1, Math.min(99, Math.round(percentileExact)));

      strengthList.push({
        key,
        name: def.name,
        he: def.name,
        en: key,
        virtue: def.virtue,
        virtueHe: def.virtue,
        coreDimension: def.coreDimension,
        score: roundedScore,
        exactScore: finalScore,
        directScore: directVal !== null ? Math.round(directVal) : null,
        neoScore: neoScore !== null ? Math.round(neoScore) : null,
        percentileEst,
        percentileExact,
        omega,
        mcgrathR: def.mcgrathR,
        mcgrathTrueR: def.mcgrathTrueR,
        sem,
        sourceType,
        sourceLabel,
        desc: def.desc
      });
    }

    // Sort descending by score (break integer ties by exact unrounded score, then direct measurement, then mcgrathTrueR)
    const sorted = [...strengthList].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (Math.abs(b.exactScore - a.exactScore) > 1e-6) return b.exactScore - a.exactScore;
      const aDirect = a.directScore !== null ? 1 : 0;
      const bDirect = b.directScore !== null ? 1 : 0;
      if (bDirect !== aDirect) return bDirect - aDirect;
      return (b.mcgrathTrueR || 0) - (a.mcgrathTrueR || 0);
    });

    sorted.forEach((item, idx) => {
      item.rank = idx + 1;
      item.isSignature = idx < 5;
    });

    // 4. Compute 3 Global Core Strength Metatraits (Partsch, Olaru, & Lechner, 2024)
    const coreGroups = { positivity: [], dependability: [], mastery: [] };
    for (const s of sorted) {
      if (coreGroups[s.coreDimension]) {
        coreGroups[s.coreDimension].push(s.exactScore);
      }
    }
    const coreDimensions = {};
    for (const [cKey, arr] of Object.entries(coreGroups)) {
      const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 50;
      const cMeta = bank.coreDimensions?.[cKey] || { name: cKey, desc: '' };
      coreDimensions[cKey] = {
        key: cKey,
        name: cMeta.name,
        he: cMeta.name,
        en: cKey,
        desc: cMeta.desc,
        score: avg
      };
    }

    const overallAccuracy = !hasAnswers ? 0.74 : (neoInfo.hasFacets ? 0.95 : (neoInfo.hasDomains ? 0.89 : 0.85));
    const resultType = !hasAnswers ? 'proxy' : (neoInfo.hasFacets ? 'composite' : 'direct');

    return {
      type: resultType,
      accuracy: overallAccuracy,
      accuracyPct: Math.round(overallAccuracy * 100),
      cohortN: viaSupp?.cohortN || 1039811,
      hasNeoFacets: neoInfo.hasFacets,
      signatureStrengths: sorted.slice(0, 5),
      bottomStrengths: sorted.slice(-4),
      strengths: sorted,
      ranked: sorted,
      coreDimensions,
      answers: hasAnswers ? [...answers] : null
    };
  }

  const api = { encode, decode, calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OfiViaCodec = api;

})(typeof window !== 'undefined' ? window : globalThis);
