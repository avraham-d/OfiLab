/**
 * ofiLab Markdown Export
 */
(function(root) {
  'use strict';
  
  function getTimestamp() {
    const d = new Date();
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }

  function number(val) {
    if(val==null || isNaN(val)) return '-';
    return Number(val).toString();
  }

  function formatPct(entry) {
    const val = entry?.percentileExact ?? entry?.percentile;
    if(val==null || isNaN(val)) return '-';
    return (Math.round(Number(val) * 10) / 10).toString();
  }

  function formatT(entry) {
    const val = entry?.t ?? entry?.tScore;
    if(val==null || isNaN(val)) return '-';
    return (Math.round(Number(val) * 10) / 10).toString();
  }

  function escMdTable(s) {
    return String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  }

  function resolveInventoryLabel(profile) {
    const answered = Number(profile?.empiricalReference?.answeredItems || profile?.totalItems || 0);
    if (answered === 300) return 'IPIP-NEO-300';
    if (answered === 120) return 'IPIP-NEO-120';
    const refInst = String(profile?.empiricalReference?.referenceInstrument || '').toUpperCase();
    if (refInst.includes('300')) return 'IPIP-NEO-300';
    if (refInst.includes('120')) return 'IPIP-NEO-120';
    const docInv = typeof document !== 'undefined' ? document.documentElement?.dataset?.inventory : '';
    if (docInv === 'ipip-neo-300') return 'IPIP-NEO-300';
    return 'IPIP-NEO-120';
  }

  function generateMarkdown(profile) {
    if(!profile) return '';

    const isRel = Boolean(profile.empiricalReference);
    const inventoryLabel = resolveInventoryLabel(profile);
    
    let md = '---\n';
    md += 'title: ofiLab Personality Profile\n';
    md += 'date: ' + getTimestamp() + '\n';
    md += 'inventory: ' + inventoryLabel + '\n';
    md += 'tags: [personality, ofilab, psychometrics]\n';
    md += '---\n\n';
    
    md += '# פרופיל אישיות - ofiLab\n\n';
    md += '*תאריך הפקה:* ' + getTimestamp() + '\n';
    md += '*שאלון:* ' + inventoryLabel + '\n';
    if(isRel) {
      md += '*תקנון:* מבוסס השוואה למדגם נורמטיבי (אחוזונים וציוני תקן T)\n\n';
    } else {
      md += '*תקנון:* מבוסס ציוני שאלון (0-100)\n\n';
    }
    
    // Response-quality block: the exported file must carry the same warning the results page shows.
    const vf = profile.validityFeatures;
    const vLevel = vf ? (vf.validityLevel || (vf.isSevereStraightline || vf.isSuspectedRandomResponding ? 'low'
      : (vf.isModerateStraightline || vf.isAcquiescenceBias || vf.isHighDiscrepancy || vf.isInconsistentSynonyms || vf.isErraticPersonFit ? 'fair' : 'high'))) : null;
    const lowQuality = vLevel === 'low';
    if (vf && vLevel !== 'high') {
      const reasons = [];
      if (vf.isSevereStraightline) reasons.push('מענה אחיד (Straight-lining)');
      if (vf.isSuspectedRandomResponding) reasons.push('חשד למענה אקראי (התאמה חריגה מאוד למודל וחוסר עקביות בין היגדים מקבילים)');
      if (vf.isModerateStraightline) reasons.push('שונות תשובות מצומצמת');
      if (vf.isAcquiescenceBias) reasons.push(vf.mean <= 1.90 ? 'נטייה לשלילה גורפת' : 'נטייה להסכמה גורפת');
      if (vf.isHighDiscrepancy) reasons.push('פער בין היגדים ישירים והפוכים');
      if (vf.isInconsistentSynonyms) reasons.push('חוסר עקביות בין היגדים מקבילים');
      if (vf.isErraticPersonFit && !vf.isSuspectedRandomResponding) reasons.push('התאמה חריגה של דפוס התשובות למודל (person-fit)');
      if (lowQuality) {
        md += '> ⛔ **בקרת איכות המענה: נמוכה. אין להסתמך על הפרשנות בדוח זה.**\n';
        md += '> סיבה: ' + reasons.join('; ') + '.\n';
        md += '> הציונים מוצגים לשקיפות בלבד. טיפוס ה־MBTI, הפונקציות הקוגניטיביות, הסגנון הקיברנטי והקירובים של HEXACO ו־VIA הושמטו. מומלץ למלא את השאלון מחדש.\n\n';
      } else {
        md += '> ⚠️ **בקרת איכות המענה: בינונית.** סיבה: ' + reasons.join('; ') + '. מומלץ לקרוא את הפרשנות בזהירות.\n\n';
      }
    }

    md += '## חמש התכונות המרכזיות (Big Five)\n\n';

    const domainKeys = ['N', 'E', 'O', 'A', 'C'];
    const domainNames = {
      'N': 'רגישות רגשית',
      'E': 'מוחצנות',
      'O': 'פתיחות',
      'A': 'נועם הליכות',
      'C': 'מצפוניות'
    };
    
    // Two intervals: the classical symmetric SEM, and the conditional interval the results page shows
    // (IRT GRM for facets, stratified classical SEM for domains).
    md += '*טעות תקן קלאסית (SEM) וטווח סמך סימטרי; לצידם הטווח המותנה שמוצג באתר (IRT GRM בתחומי המשנה).*\n\n';
    md += '| תכונה | ציון שאלון (0-100) | אחוזון | ציון T | טעות תקן קלאסית | טווח סמך 95% קלאסי | טווח סמך 95% מותנה |\n';
    md += '| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n';
    const condCi = x => Array.isArray(x.conditionalCi95) ? x.conditionalCi95.join('-') + (x.conditionalSem != null ? ' (±' + number(x.conditionalSem) + ')' : '') : '-';
    
    for(const k of domainKeys) {
      const d = profile.domains[k];
      if(!d) continue;
      const score100 = number(Math.round(d.score));
      const pct = isRel ? formatPct(d) : '-';
      const t = isRel ? formatT(d) : '-';
      const semVal = d.sem != null ? d.sem : (d.ciMargin != null ? Math.round((d.ciMargin / 1.96) * 10) / 10 : null);
      const sem = semVal != null ? ('±' + number(semVal)) : '-';
      const ci = d.ci95 ? d.ci95.join('-') : '-';
      
      md += '| **' + escMdTable(domainNames[k]) + '** | ' + score100 + ' | ' + pct + ' | ' + t + ' | ' + sem + ' | ' + ci + ' | ' + condCi(d) + ' |\n';
    }
    
    const hasFacets = Boolean(profile.domains.N?.facets?.length === 6);
    if(hasFacets) {
      md += '\n## 30 תחומי המשנה (Facets)\n\n';
      md += '| התחום | תכונת אב | ציון שאלון (0-100) | אחוזון | ציון T | טעות תקן קלאסית | טווח סמך 95% קלאסי | טווח סמך 95% מותנה |\n';
      md += '| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n';
      
      for(const k of domainKeys) {
        const facets = profile.domains[k].facets || [];
        for(const f of facets) {
          const score100 = number(Math.round(f.score));
          const pct = isRel ? formatPct(f) : '-';
          const t = isRel ? formatT(f) : '-';
          const semVal = f.sem != null ? f.sem : (f.ciMargin != null ? Math.round((f.ciMargin / 1.96) * 10) / 10 : null);
          const sem = semVal != null ? ('±' + number(semVal)) : '-';
          const ci = f.ci95 ? f.ci95.join('-') : '-';
          
          md += '| ' + escMdTable(f.label) + ' | ' + escMdTable(domainNames[k]) + ' | ' + score100 + ' | ' + pct + ' | ' + t + ' | ' + sem + ' | ' + ci + ' | ' + condCi(f) + ' |\n';
        }
      }
    }
    
    // Add Extensions
    md += '\n## מודלים ומעבדות מחקר\n\n';
    md += '*כל המודלים בפרק זה נגזרו מאותן תשובות לאותו שאלון. הסכמה ביניהם היא עקביות תיאורית של אותו מידע, ולא מדידות עצמאיות שמאמתות זו את זו.*\n\n';
    
    if (lowQuality) {
      md += '*המודלים הנגזרים (סגנון קיברנטי, טיפוס MBTI ופונקציות קוגניטיביות) לא חושבו, כי איכות המענה נמוכה מדי לפרשנות.*\n\n';
    }

    if (root.calculateCybernetics && !lowQuality) {
      const cyber = root.calculateCybernetics(profile, isRel);
      md += '### מנועי־העל הקיברנטיים (DeYoung)\n';
      md += '- **מנוע חקרנות ויוזמה (Plasticity):** ' + cyber.plasticity + (isRel ? ' (אחוזון)' : '') + '\n';
      md += '- **עוגן יציבות וויסות (Stability):** ' + cyber.stability + (isRel ? ' (אחוזון)' : '') + '\n';
      md += '- **סגנון מוביל:** ' + cyber.archTitle + '\n\n';
    }

    if (root.OfiFourLetters && profile.domains?.N?.facets?.length === 6 && !lowQuality) {
      try {
        const fl = root.OfiFourLetters.estimate(profile);
        if (fl && fl.displayType) {
          md += '### טיפוס חמש האותיות (MBTI + Identity · אומדן מבני מ־Big Five)\n';
          const consText = typeof fl.compositeConsistency === 'number' ? ' (הסתברות מודל ממוצעת (משוקללת R²) ב־4 צירי MBTI: ~' + Math.round(fl.compositeConsistency) + '%' : '';
          const closeParen = consText ? ')' : '';
          const prevText = typeof fl.cohortPrevalence5 === 'number' ? ' · שכיחות נצפית במדגם (אומדן מודל): ' + (Math.round(fl.cohortPrevalence5 * 10) / 10) + '%' : '';
          md += '- **טיפוס מוערך:** `' + fl.displayType + '`' + consText + closeParen + prevText + '\n';
          if (fl.borderlineCount) {
            const marked = fl.axes.filter(a => a.borderline).map(a => a.letter + '/' + a.alternativeLetter).join(', ');
            md += '- **אותיות גבוליות:** ' + marked + ' (`' + fl.borderlineDisplay + '`). האות קרובה לאמצע, ובהשוואה בין גרסאות השאלון (120 מול 300) אות באזור זה מתהפכת בכ־30% מהמקרים ומעלה, ולכן כדאי לקרוא את שני הכיוונים.\n';
          }
          if (Array.isArray(fl.axes)) {
            const axisParts = fl.axes.map(a => {
              const isPos = a.letter === a.positive;
              // Axis position is a 0-100 location (/100); the model probability is a separate number.
              const pos = a.letter !== '?' ? 'מיקום בציר ' + Math.round(isPos ? a.score : (100 - a.score)) + '/100' : 'קרוב לאמצע';
              let ciStr = '';
              if (a.letter !== '?' && Array.isArray(a.ci95) && a.ci95.length === 2) {
                const lo = Math.round(isPos ? a.ci95[0] : (100 - a.ci95[1]));
                const hi = Math.round(isPos ? a.ci95[1] : (100 - a.ci95[0]));
                ciStr = ', טווח 95%: ' + lo + '–' + hi;
              }
              const noCriterion = a.key === 'AT' || a.hasPublishedCriterion === false;
              const probStr = (!noCriterion && a.letter !== '?' && typeof a.classificationConsistency === 'number')
                ? ', ~' + a.classificationConsistency + '% הסתברות סיווג במודל' : '';
              const critNote = noCriterion ? ' · ציר רציף ללא קריטריון MBTI' : '';
              return a.label + ': **' + a.letter + '** (' + pos + ciStr + probStr + critNote + ')';
            });
            md += '- **פירוט הצירים:** ' + axisParts.join(' · ') + '\n';
            md += '- *מיקום בציר הוא נקודה על סולם 0–100 ולא הסתברות. "הסתברות סיווג" היא הסיכוי לפי המודל שמבחן MBTI היה נותן אותה אות.*\n';
          }
          if (Array.isArray(fl.topTypes) && fl.topTypes.length >= 2) {
            const topStr = fl.topTypes.slice(0, 4).map(t => '`' + t.type + '` (' + (Math.round(t.pct * 10) / 10) + '%)').join(' · ');
            md += '- **הטיפוס המוביל ו־' + (Math.min(4, fl.topTypes.length) - 1) + ' החלופות הקרובות (מדד התאמה יחסי, לא הסתברות משותפת):** ' + topStr + '\n';
          }
          if (fl.cognitiveFunctions && Array.isArray(fl.cognitiveFunctions.ranked)) {
            const topCog = fl.cognitiveFunctions.ranked.slice(0, 4).map((c, i) => (i + 1) + '. ' + c.code + ' ' + c.label + ' (' + Math.round(c.score) + '/100)').join(' · ');
            md += '- **פונקציות קוגניטיביות לפי דירוג מהתכונות (אומדן יונגיאני לימודי ללא תיקוף מחקרי; זה דירוג, לא הסדר המבני של הטיפוס):** ' + topCog + '\n';
            if (fl.cognitiveFunctions.stackCoherenceNote) {
              md += '- **אינטגרציה מתודולוגית:** ' + fl.cognitiveFunctions.stackCoherenceNote + '\n';
            }
          }
          md += '\n';
        }
      } catch (_e) {}
    }
    
    // At 'low' quality the Big Five proxies are noise too; directly answered supplements stay (separate answers).
    if (profile.hexacoHonesty && !(lowQuality && profile.hexacoHonesty.type === 'proxy')) {
      const h = profile.hexacoHonesty;
      const isDirectH = h.type === 'direct';
      const hPctVal = isDirectH ? h.percentileEst : h.percentileProxy;
      const hPctPart = hPctVal != null ? ' · אחוזון משוער ~' + Math.round(hPctVal) : '';
      // h.accuracy is the proxy's correlation r with the direct scale (shared variance is r^2), not a coverage percentage.
      // APA style r = .79 (no leading zero) keeps the Markdown free of 2-decimal numbers.
      const hR = typeof h.accuracy === 'number' ? h.accuracy.toFixed(2).replace(/^0/, '') : '.78';
      md += '### כנות וענווה (HEXACO-H · ' + (isDirectH ? 'מדידה ישירה (16 שאלות)' : 'קירוב מתוך Big Five, מתאם משוער r≈' + hR + ' עם המדידה הישירה; ללא מדידה ישירה של הגינות והימנעות מחמדנות') + ')\n';
      md += '- **ציון כללי:** ' + h.score + '/100 (' + h.levelLabel + hPctPart + ')\n';
      if(h.facets) {
        const hf = h.facets;
        if (isDirectH) {
          md += '- **פירוט 4 תתי-הסולמות:** כנות ואותנטיות: ' + number(Math.round(hf.sincerity)) + ', הגינות ויושר: ' + number(Math.round(hf.fairness)) + ', הימנעות מחמדנות: ' + number(Math.round(hf.greedAvoidance)) + ', צניעות וענווה: ' + number(Math.round(hf.modesty)) + '\n';
        } else {
          const hp = h.facetPercentiles || {};
          const fmtProxy = (val, pct) => number(Math.round(val)) + '/100' + (typeof pct === 'number' ? ' (אחוזון ~' + Math.round(pct) + ')' : '');
          // Facet names as in the rest of the report; all seven weights, not only the three main ones.
          const facetName = code => profile.domains[code[0]]?.facets?.[Number(code[1]) - 1]?.label || code;
          md += '- **רכיבי הקירוב העיקריים מתוך ה-Big Five:** ' + facetName('A2') + ' (A2): ' + fmtProxy(hf.morality, hp.morality) + ', ' + facetName('A5') + ' (A5): ' + fmtProxy(hf.modesty, hp.modesty) + ', ' + facetName('C3') + ' (C3): ' + fmtProxy(hf.dutifulness, hp.dutifulness) + '\n';
          const pw = h.proxyWeights || {};
          if (Object.keys(pw).length) md += '- **מקדמי הנוסחה המלאה (' + Object.keys(pw).length + ' תחומי משנה):** ' + Object.entries(pw).map(([k, v]) => facetName(k) + ' (' + k + ') ' + (v >= 0 ? '+' : '−') + Math.abs(Number(v)).toFixed(2).replace(/^0/, '')).join(' · ') + '\n';
        }
      }
      if (isDirectH) md += '- *האחוזון משוער מהתפלגות מדומה לפי ממוצעים שפורסמו ל־HEXACO-100; ההיגדים מסולמות IPIP-HEXACO, בנחלת הכלל. אינו השוואה למדגם אמיתי.*\n';
      md += '\n';
    }

    if (profile.viaStrengths && !(lowQuality && profile.viaStrengths.type === 'proxy')) {
      const v = profile.viaStrengths;
      // Label the source, not a "~74%" figure: via-codec's accuracy is a fixed heuristic per input type, not a measured r.
      const viaSource = v.type === 'composite' ? 'מענה ישיר ל־60 היגדים בשילוב חמש התכונות'
        : v.type === 'direct' ? 'מענה ישיר ל־60 היגדים'
        : 'קירוב מתוך חמש התכונות, ללא מדידה ישירה';
      md += '### חוזקות האופי ו-3 כוחות העל (IPIP-VIA-R · ' + viaSource + ')\n';
      if (v.coreDimensions) {
        const cd = v.coreDimensions;
        // "Mastery" is VIA wisdom/leadership strengths, not C1 self-efficacy (תחושת מסוגלות).
        md += '- **3 כוחות העל:** חיוביות (Positivity): ' + number(cd.positivity?.score) + '/100, אמינות (Dependability): ' + number(cd.dependability?.score) + '/100, מומחיות, חוכמה והובלה (Mastery): ' + number(cd.mastery?.score) + '/100\n';
        md += '- *הערה כללית: Mastery כאן הוא אשכול חוזקות של חוכמה, סקרנות והובלה. זהו מדד נפרד מתחושת המסוגלות (C1) ומהמצפוניות.*\n';
      }
      if (Array.isArray(v.signatureStrengths) && v.signatureStrengths.length) {
        md += '- **5 חוזקות החתימה המובילות:** ' + v.signatureStrengths.map(s => '#' + s.rank + ' ' + (s.he || s.name) + ' (' + s.score + '/100' + (typeof s.percentileEst === 'number' ? ', אחוזון ~' + Math.round(s.percentileEst) : '') + ')').join(' · ') + '\n';
      }
      md += '- *האחוזונים משוערים מהתפלגות מדומה לפי ממוצעים שפורסמו ל־VIA-IS המלא, שאלון אחר מההיגדים כאן. אינם השוואה למדגם אמיתי.*\n';
      md += '\n';
    }

    if (profile.ecrrsScores) {
      const e = profile.ecrrsScores;
      const anx1 = (Math.round(Number(e.anxiety) * 10) / 10).toFixed(1);
      const avd1 = (Math.round(Number(e.avoidance) * 10) / 10).toFixed(1);
      const secPctPart = typeof e.securityPct === 'number' ? ', אחוזון משוער ~' + Math.round(e.securityPct) : '';
      const anxPctPart = typeof e.anxietyPct === 'number' ? ', אחוזון משוער ~' + Math.round(e.anxietyPct) : '';
      const avdPctPart = typeof e.avoidancePct === 'number' ? ', אחוזון משוער ~' + Math.round(e.avoidancePct) : '';
      md += '### סגנון היקשרות במערכות יחסים (ECR-RS)\n';
      md += '- **סגנון היקשרות:** ' + e.title + ' (מדד ביטחון: ' + e.security100 + '/100' + secPctPart + ')\n';
      md += '- **חרדת היקשרות (Anxiety):** ' + anx1 + '/7.0 (' + e.anxiety100 + '/100' + anxPctPart + ')\n';
      md += '- **הימנעות מאינטימיות (Avoidance):** ' + avd1 + '/7.0 (' + e.avoidance100 + '/100' + avdPctPart + ')\n';
      md += '- *האחוזונים משוערים מהתפלגות מדומה לפי ממוצעים שפורסמו (Fraley et al., 2011), לא מנתוני משיבים. מדד הביטחון הוגדר באתר הזה.*\n\n';
    }
    
    md += '---\n*דוח זה הופק מקומית במערכת ofiLab על גבי הדפדפן (לא נשמר בשום שרת).*\n';
    return md;
  }

  // ---------------------------------------------------------------------
  // Displayed report: the results screen as the person sees it, converted to
  // Markdown in reading order. Built from the rendered DOM, so every model,
  // number and sentence on screen (in the selected percentile/score mode)
  // is in the file, including the contents of collapsed sections.
  // ---------------------------------------------------------------------
  const SKIP = 'script,style,template,button,select,option,input,textarea,label,nav,dialog,canvas,noscript,meter,progress,'
    + '[hidden],[aria-hidden="true"],.sr-only,.visually-hidden,.hidden,'
    + '#resultsFileStatus,#additionalQuizzesSection,#resultsReportFooter,#resultsMobileMenu,#resultsMobileTrigger,'
    + '.results-mobile-picker-trigger,.report-rail-action,#resultsBackToTop,#askAiResults,'
    + '.results-metric-switch,.metric-pills,.facet-explorer-controls,.profile-ai-summary-actions,'
    // On-screen only: navigation, the AI-chat invitation, file notices, axis tick labels and the
    // short paradox preview (the full list of insights appears further down the report).
    + '.profile-summary-nav,.profile-ai-summary-bar,#resultsFileNote,#resultsParadoxPreview,#continue300,'
    + '.cyber-meter-scale,.emotional-stability-endpoints,.norm-bell-subtext';
  // Instructions for the interactive page, removed from the text of the report.
  const UI_PHRASES = [
    / ?ניתן לעדכן תשובה בלחיצה:?/g,
    / ?פתח(?:ו)? תכונה כדי (?:לראות|לחקור) [^.]*\./g,
    / ?פתח(?:ו)? תכונה לפירוט(?: ההיבטים שלה)?\.?/g,
    / · $/,
  ];
  const stripUi = t => UI_PHRASES.reduce((s, re) => s.replace(re, ''), t).trim();
  // A paragraph made only of links (site navigation) carries no report content.
  function linksOnly(el) {
    if (!el.querySelector('a')) return false;
    const copy = el.cloneNode(true);
    copy.querySelectorAll('a').forEach(a => a.remove());
    return !/[\p{L}\p{N}]/u.test(copy.textContent);
  }
  const INLINE = new Set(['SPAN','B','STRONG','EM','I','SMALL','A','SUP','SUB','ABBR','DATA','TIME','CODE','MARK','BR','BDI','BDO','Q','CITE','DFN','KBD','S','U','WBR','OUTPUT']);
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  function skipped(el) { return el.nodeType === 1 && el.matches(SKIP); }
  function chartText(svg) {
    const label = svg.getAttribute('aria-label') || svg.querySelector(':scope > title')?.textContent;
    return label ? 'תרשים: ' + clean(label) : '';
  }
  function inlineText(node) {
    if (node.nodeType === 3) return node.nodeValue;
    if (node.nodeType !== 1 || skipped(node)) return '';
    if (node.tagName === 'BR') return ' ';
    if (node.tagName.toLowerCase() === 'svg') return '';
    let out = '', prevElement = false;
    for (const child of node.childNodes) {
      const t = inlineText(child);
      // Two adjacent elements with nothing between them (e.g. <span>name</span><b>53</b>)
      // are separate tokens; text running into an element (כ־<code>6</code>) is not.
      if (child.nodeType === 1 && prevElement && out && t && !/\s$/.test(out) && !/^\s/.test(t)) out += ' ';
      out += t;
      if (child.nodeType === 1) { if (t) prevElement = true; }
      else if (child.nodeType === 3 && child.nodeValue.length) prevElement = false;
    }
    return out;
  }
  function isInlineOnly(el) {
    for (const child of el.childNodes) {
      if (child.nodeType === 1 && !skipped(child) && !INLINE.has(child.tagName)) return false;
    }
    return true;
  }
  function tableMarkdown(table) {
    const rows = [...table.querySelectorAll('tr')].filter(r => !r.closest(SKIP))
      .map(r => [...r.children].filter(c => !skipped(c)).map(c => clean(inlineText(c)).replace(/\|/g, '\\|')));
    if (!rows.length) return [];
    const width = Math.max(...rows.map(r => r.length));
    const pad = r => r.concat(Array(width - r.length).fill(''));
    const lines = ['| ' + pad(rows[0]).join(' | ') + ' |', '|' + ' --- |'.repeat(width)];
    for (const r of rows.slice(1)) lines.push('| ' + pad(r).join(' | ') + ' |');
    return ['', ...lines, ''];
  }
  function walk(el, lines) {
    if (el.nodeType !== 1 || skipped(el)) return;
    const tag = el.tagName;
    if (tag.toLowerCase() === 'svg') { const t = chartText(el); if (t) lines.push('*' + t + '*'); return; }
    if (/^H[1-6]$/.test(tag)) {
      const t = clean(inlineText(el));
      if (t) lines.push('', '#'.repeat(Math.min(5, Math.max(2, Number(tag[1]) + 1))) + ' ' + t, '');
      return;
    }
    if (tag === 'TABLE') { lines.push(...tableMarkdown(el)); return; }
    if (tag === 'SUMMARY') {
      // "<summary>Title<span>hint</span></summary>": the title, then the hint as its subtitle.
      const own = clean([...el.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && n.tagName !== 'SPAN')).map(inlineText).join(' '));
      const hint = clean([...el.children].filter(n => n.tagName === 'SPAN' && !skipped(n)).map(inlineText).join(' '));
      const title = own || hint;
      if (title) lines.push('', '**' + title + '**');
      if (own && hint && !/^(?:בחר|בחרו|לחץ|לחצו)/.test(hint)) lines.push('*' + hint + '*');
      return;
    }
    if (tag === 'P' && linksOnly(el)) return;
    if (tag === 'LI') {
      if (isInlineOnly(el)) { const t = clean(inlineText(el)); if (t) lines.push('- ' + t); return; }
    }
    if (tag === 'FIGCAPTION' || tag === 'P' || tag === 'DT' || tag === 'DD' || tag === 'BLOCKQUOTE' || isInlineOnly(el)) {
      if (isInlineOnly(el)) {
        const t = clean(inlineText(el));
        if (t) lines.push(tag === 'DT' ? '**' + t + '**' : tag === 'BLOCKQUOTE' ? '> ' + t : t);
        return;
      }
    }
    // Mixed block: emit loose text runs, recurse into block children.
    let run = '';
    const flush = () => { const t = clean(run); if (t) lines.push(t); run = ''; };
    for (const child of el.childNodes) {
      if (child.nodeType === 3) { run += child.nodeValue; continue; }
      if (child.nodeType !== 1 || skipped(child)) continue;
      if (INLINE.has(child.tagName)) { run += ' ' + inlineText(child); continue; }
      flush(); walk(child, lines);
    }
    flush();
  }
  function generateDisplayedMarkdown(root) {
    if (!root) return '';
    const lines = [];
    walk(root, lines);
    // Drop exact consecutive repeats and collapse blank runs.
    const out = [];
    for (let line of lines) {
      // "#12 ..." item numbers are text, not Markdown headings.
      if (/^#[^#\s]/.test(line)) line = '\\' + line;
      line = stripUi(line);
      if (line === '-' || line === '>') continue;
      if (line && out.length && out[out.length - 1] === line) continue;
      if (!line && (!out.length || !out[out.length - 1])) continue;
      out.push(line);
    }
    return out.join('\n').trim() + '\n';
  }
  function displayedMode() {
    if (typeof document === 'undefined') return null;
    const v = document.getElementById('resultsMetric')?.value;
    return v === 'percentile' ? 'percentile' : 'score';
  }
  // Full text report: header + everything on the results screen + an appendix
  // of the unrounded data (exact percentiles, T, SEM, 95% CI) for reference.
  function generateFullMarkdown(profile, root) {
    const base = generateMarkdown(profile);
    if (!root) return base;
    const cut = base.indexOf('## חמש התכונות המרכזיות');
    const head = cut > 0 ? base.slice(0, cut) : '';
    const appendix = cut > 0 ? base.slice(cut) : base;
    const mode = displayedMode();
    let md = head;
    md += '*מצב התצוגה בעת ההורדה:* ' + (mode === 'percentile' ? 'אחוזונים ביחס למדגם' : 'ציוני שאלון 0–100') + '\n\n';
    md += '## הדוח כפי שהוא מוצג באתר\n\n';
    md += generateDisplayedMarkdown(root) + '\n';
    md += '---\n\n# נספח: הנתונים המלאים בדיוק מרבי\n\n';
    md += '*הטבלאות כאן מציגות את אותם ציונים ללא עיגול (אחוזון מדויק, ציון T, טעות תקן וטווח סמך), לצורך עיון ובדיקה.*\n\n';
    md += appendix.replace(/^## /gm, '### ');
    return md;
  }

  // ---------------------------------------------------------------------
  // Short summary (a page or two). Every value uses the exact formatting of
  // the results page in the selected mode: "אחוזון 63" or "57.5 / 100",
  // the same level badge, and the same interpretation sentence.
  // ---------------------------------------------------------------------
  const siteNumber = v => (Math.round(Number(v) * 10) / 10).toLocaleString('he-IL', { maximumFractionDigits: 1 });
  function generateSummaryMarkdown(profile, mode) {
    if (!profile) return '';
    const rel = mode === 'percentile' && Boolean(profile.empiricalReference);
    const base = generateMarkdown(profile);
    const cut = base.indexOf('## חמש התכונות המרכזיות');
    let md = (cut > 0 ? base.slice(0, cut) : '')
      .replace('title: ofiLab Personality Profile', 'title: ofiLab Personality Summary')
      .replace('# פרופיל אישיות - ofiLab', '# תקציר פרופיל אישיות - ofiLab');
    md += '*מצב התצוגה:* ' + (rel ? 'אחוזונים ביחס למדגם' : 'ציוני שאלון 0–100') + '\n\n';
    const vf = profile.validityFeatures;
    const lowQuality = Boolean(vf && (vf.validityLevel === 'low' || vf.isSevereStraightline || vf.isSuspectedRandomResponding));
    const keys = ['N', 'E', 'O', 'A', 'C'];
    const names = { N: 'רגישות רגשית', E: 'מוחצנות', O: 'פתיחות לחוויה', A: 'נועם הליכות', C: 'מצפוניות' };
    const nameOf = k => profile.domains[k]?.label || names[k];
    const value = x => rel ? 'אחוזון ' + x.percentile : siteNumber(x.score) + ' / 100';
    const facetValue = x => rel ? 'אחוזון ' + x.percentile : siteNumber(x.score) + '/100';
    // Same badge as the results page (נועם הליכות is masculine, the other traits feminine).
    const level = (x, k) => {
      const p = rel ? x.percentile : (typeof x.rangeScore === 'number' ? x.rangeScore : x.score);
      const w = rel ? (p >= 90 ? ['גבוהה מאוד', 'גבוה מאוד'] : p >= 70 ? ['גבוהה', 'גבוה'] : p >= 31 ? ['מתונה', 'מתון'] : p >= 11 ? ['נמוכה', 'נמוך'] : ['נמוכה במיוחד', 'נמוך במיוחד'])
        : (p > 62.5 ? ['גבוהה', 'גבוה'] : p >= 37.5 ? ['בינונית', 'בינוני'] : ['נמוכה', 'נמוך']);
      return w[k === 'A' ? 1 : 0];
    };
    md += '## חמש התכונות\n\n';
    md += '| תכונה | ציון | רמה |\n| :--- | :---: | :---: |\n';
    for (const k of keys) { const d = profile.domains[k]; if (d) md += '| **' + escMdTable(nameOf(k)) + '** | ' + value(d) + ' | ' + level(d, k) + ' |\n'; }
    md += '\n';
    for (const k of keys) {
      const d = profile.domains[k]; if (!d) continue;
      const text = rel ? d.text : (d.rangeText || d.text);
      md += '### ' + nameOf(k) + ' · ' + value(d) + '\n' + (text ? text + '\n' : '') + '\n';
    }
    if (profile.domains.N?.facets?.length === 6) {
      md += '## 30 תחומי המשנה\n\n| תחום משנה | תכונה | ציון |\n| :--- | :--- | :---: |\n';
      for (const k of keys) for (const f of profile.domains[k].facets || [])
        md += '| ' + escMdTable(f.label) + ' | ' + escMdTable(nameOf(k)) + ' | ' + facetValue(f) + ' |\n';
      md += '\n';
    }
    if (!lowQuality) {
      const extra = [];
      try {
        const fl = root.OfiFourLetters && profile.domains?.N?.facets?.length === 6 ? root.OfiFourLetters.estimate(profile) : null;
        if (fl && fl.displayType) extra.push('- **סגנון ארבע האותיות המשוער:** `' + fl.displayType + '` (אומדן מבני מתוך חמש התכונות, לא מבחן MBTI)');
      } catch (_e) {}
      try {
        if (root.calculateCybernetics) { const cy = root.calculateCybernetics(profile, rel); if (cy && cy.archTitle) extra.push('- **סגנון קיברנטי מוביל:** ' + cy.archTitle); }
      } catch (_e) {}
      if (extra.length) md += '## מבט נוסף\n\n' + extra.join('\n') + '\n\n';
    }
    md += '---\n*תקציר זה הופק מקומית בדפדפן ולא נשמר בשום שרת. הדוח המלא, עם כל המודלים והפרשנויות, זמין בכפתור "דוח טקסט מלא".*\n';
    return md;
  }

  function downloadMarkdown(profile, options = {}) {
    if(!profile) return;
    const root = typeof document !== 'undefined' ? document.getElementById('resultScreen') : null;
    const md = options.summary ? generateSummaryMarkdown(profile, displayedMode())
      : root ? generateFullMarkdown(profile, root) : generateMarkdown(profile);
    const blob = new Blob([md], {type: 'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ofilab-' + (options.summary ? 'summary' : 'profile') + '-' + new Date().toISOString().slice(0,10) + '.md';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  const api = { generateMarkdown, generateDisplayedMarkdown, generateFullMarkdown, generateSummaryMarkdown, downloadMarkdown, screenOnlySelector: SKIP, stripUi, linksOnly };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  root.OfiLabExportMarkdown = api;

})(typeof window !== 'undefined' ? window : globalThis);