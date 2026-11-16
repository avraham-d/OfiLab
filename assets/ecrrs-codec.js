/**
 * ofiLab ECR-RS (Experiences in Close Relationships — Relationship Structures) Codec
 * Reference: Fraley, Heffernan, Vicary, & Brumbaugh (2011), Psychological Assessment.
 * Encodes and decodes 9 responses (1-7 scale) into 5 Base64URL characters (&a=<5 chars>).
 */
(function(root) {
  'use strict';

  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const MAP = new Map();
  for (let i = 0; i < 64; i++) {
    MAP.set(CHARS[i], i);
  }

  function getDeepModels() {
    if (root && root.OfiEmpiricalDeep && root.OfiEmpiricalDeep.data) return root.OfiEmpiricalDeep;
    if (typeof require === 'function') {
      try { return require('./empirical-deep-models.js'); } catch (_e) {}
    }
    return null;
  }

  function normPct(z) {
    const signZ = z < 0 ? -1 : 1;
    const xZ = Math.abs(z) / Math.SQRT2;
    const tZ = 1 / (1 + 0.3275911 * xZ);
    const erfZ = 1 - (((((1.061405429 * tZ - 1.453152027) * tZ) + 1.421413741) * tZ - 0.284496736) * tZ + 0.254829592) * tZ * Math.exp(-xZ * xZ);
    return 0.5 * (1 + signZ * erfZ) * 100;
  }

  function encode(answers) {
    if (!Array.isArray(answers) || answers.length !== 9) throw new Error('ECR-RS requires exactly 9 answers');

    let num = 0n;
    
    for (let i = 0; i < 9; i++) {
      const raw = Number(answers[i]);
      if (!Number.isInteger(raw) || raw < 1 || raw > 7) {
        throw new Error('Invalid ECR-RS answer at index ' + i + ' (expected integer 1..7)');
      }
      const v = raw - 1; // 0..6
      num = num * 7n + BigInt(v);
    }

    let out = '';
    for (let i = 0; i < 5; i++) {
      const chunk = Number(num & 63n);
      out = CHARS[chunk] + out;
      num = num >> 6n;
    }
    return out;
  }

  function decode(str) {
    if (typeof str !== 'string') throw new TypeError('Invalid ECR-RS token type');
    if (str.length > 5) throw Error('מחרוזת ארוכה מדי');
    if (str.length !== 5) throw new Error('Invalid ECR-RS token length');

    let num = 0n;
    
    for (let i = 0; i < 5; i++) {
      const ch = str[i];
      const val = MAP.get(ch);
      if (val === undefined) throw new Error('Invalid character');
      num = (num << 6n) | BigInt(val);
    }
    if (num >= 40353607n) throw Error('ערך קידוד חורג מהטווח החוקי.');

    const answers = new Array(9);
    for (let i = 8; i >= 0; i--) {
      const v = Number(num % 7n);
      answers[i] = v + 1; // 1..7
      num = num / 7n;
    }
    return answers;
  }

  // ECR-RS Scoring (Global Close Relationships Domain):
  // Items 1-6 measure Avoidance (Items 1, 2, 3, 4 are reverse scored: 8 - v).
  // Items 7-9 measure Anxiety (direct scored).
  function calculate(answers) {
    if (!Array.isArray(answers) || answers.length !== 9) return null;
    const dense = Array.from(answers);
    for (let i = 0; i < 9; i++) {
      const n = dense[i];
      if (!Number.isInteger(n) || n < 1 || n > 7) {
        throw new RangeError('Invalid ECR-RS answer at index ' + i + ' (expected integer 1..7)');
      }
    }

    const reverse = v => 8 - v;
    const getVal = (idx, rev) => {
      const v = dense[idx - 1];
      return rev ? reverse(v) : v;
    };

    let avoidSum = 0;
    for (let i = 1; i <= 6; i++) avoidSum += getVal(i, i >= 1 && i <= 4);
    const avoidanceRaw = avoidSum / 6;
    const avoidance = Math.round(avoidanceRaw * 100) / 100; // 1.00 to 7.00

    let anxSum = 0;
    for (let i = 7; i <= 9; i++) anxSum += getVal(i, false);
    const anxietyRaw = anxSum / 3;
    const anxiety = Math.round(anxietyRaw * 100) / 100; // 1.00 to 7.00

    const avoidance100Exact = ((avoidanceRaw - 1) / 6) * 100;
    const anxiety100Exact = ((anxietyRaw - 1) / 6) * 100;
    const avoidance100 = Math.round(avoidance100Exact);
    const anxiety100 = Math.round(anxiety100Exact);
    // Chebyshev-mean insecurity blend: prevents single-axis insecure profiles (e.g. high Anxiety + low Avoidance)
    // from falsely displaying a high security100 score, while preserving 50/100 at neutral (4.0, 4.0).
    const insecurity100 = 0.75 * Math.max(avoidance100Exact, anxiety100Exact) + 0.25 * ((avoidance100Exact + anxiety100Exact) / 2);
    const security100 = Math.max(0, Math.min(100, Math.round(100 - insecurity100)));

    // Universal normative calibration (Fraley, Heffernan, Vicary, & Brumbaugh, 2011, N=21,838 everyone-all-ages)
    const ecSupp = getDeepModels()?.data?.supplementary?.ecrrs || null;
    const avoidIdx = Math.max(0, Math.min(36, Math.round(avoidSum) - 6));
    const anxIdx = Math.max(0, Math.min(18, Math.round(anxSum) - 3));
    const avoidCdfVal = ecSupp && Array.isArray(ecSupp.avoidance?.cdf37) && avoidIdx < ecSupp.avoidance.cdf37.length ? ecSupp.avoidance.cdf37[avoidIdx] : null;
    const avoidancePctExact = Number.isFinite(avoidCdfVal)
      ? avoidCdfVal
      : Math.round(normPct((avoidanceRaw - 3.18) / 1.37) * 100) / 100;
    const anxCdfVal = ecSupp && Array.isArray(ecSupp.anxiety?.cdf19) && anxIdx < ecSupp.anxiety.cdf19.length ? ecSupp.anxiety.cdf19[anxIdx] : null;
    const anxietyPctExact = Number.isFinite(anxCdfVal)
      ? anxCdfVal
      : Math.round(normPct((anxietyRaw - 3.25) / 1.78) * 100) / 100;
    const secCdfVal = ecSupp && Array.isArray(ecSupp.security100Cdf) && security100 < ecSupp.security100Cdf.length ? ecSupp.security100Cdf[security100] : null;
    const securityPctExact = Number.isFinite(secCdfVal)
      ? secCdfVal
      : Math.round(normPct((security100 - 54.0) / 23.0) * 100) / 100;

    // Classification based on Fraley et al. (2011) & Bartholomew & Horowitz (1991) 4-quadrant model
    // Midpoint on 1-7 Likert scale is 4.0 (strict > 4.0 prevents classifying neutral 4.0 as Fearful-Avoidant)
    const hAvoid = avoidanceRaw > 4.0;
    const hAnx = anxietyRaw > 4.0;

    let style = '';
    let title = '';
    let narrative = '';

    if (!hAvoid && !hAnx) {
      style = 'secure';
      title = 'התקשרות בטוחה (Secure)';
      narrative = 'דפוס התקשרות בטוח מתאפיין בנוחות גבוהה עם קרבה ואינטימיות רגשית, אמון ביציבות הקשר, ויכולת להישען על אנשים קרובים בשעת קושי מבלי לחשוש מנטישה או מאובדן עצמאות.';
    } else if (!hAvoid && hAnx) {
      style = 'anxious';
      title = 'התקשרות חרדה-מוטרדת (Anxious-Preoccupied)';
      narrative = 'דפוס זה משלב כמיהה עזה לקרבה, חום ואינטימיות יחד עם ערנות גבוהה וחשש מדחייה או מהתקררות הקשר. קיימת רגישות מוגברת לאותות רגשיים של הצד השני וצורך באישור הדדיות.';
    } else if (hAvoid && !hAnx) {
      style = 'dismissing';
      title = 'התקשרות נמנעת-עצמאית (Dismissing-Avoidant)';
      narrative = 'דפוס זה מתאפיין בהסתמכות עצמית גבוהה, שמירה על אוטונומיה וגבולות רגשיים, ונטייה להתמודד עם קשיים לבד במקום להיפתח או לפתח תלות באנשים קרובים.';
    } else {
      style = 'fearful';
      title = 'התקשרות חרדה-נמנעת (Fearful-Avoidant)';
      narrative = 'דפוס מורכב המשלב רצון בקשר לצד חשש מפגיעות: קיימת דאגה מפני דחייה או נטישה, אך בד בבד גם זהירות וקושי להיפתח לחלוטין ולסמוך על הצד השני.';
    }

    return {
      type: 'direct',
      accuracy: 1.0,
      avoidance,
      anxiety,
      avoidance100,
      anxiety100,
      security100,
      avoidancePct: Math.max(1, Math.min(99, Math.round(avoidancePctExact))),
      avoidancePctExact,
      anxietyPct: Math.max(1, Math.min(99, Math.round(anxietyPctExact))),
      anxietyPctExact,
      securityPct: Math.max(1, Math.min(99, Math.round(securityPctExact))),
      securityPctExact,
      avoidanceSem: ecSupp?.avoidance?.sem || 0.47,
      anxietySem: ecSupp?.anxiety?.sem || 0.69,
      avoidanceOmega: ecSupp?.avoidance?.omega || 0.88,
      anxietyOmega: ecSupp?.anxiety?.omega || 0.85,
      cohortN: ecSupp?.cohortN || 21838,
      style,
      title,
      narrative,
      answers: [...answers]
    };
  }

  const api = { encode, decode, calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OfiEcrrsCodec = api;

})(typeof window !== 'undefined' ? window : globalThis);
