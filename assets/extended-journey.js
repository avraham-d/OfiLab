/* ofiLab 300: ten gentle 30-item chapters. V2 receives aggregate
 * counts only, never raw answers or encrypted/unprotected save tokens. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const total = 300, step = 30;
  const names = [
    'יוצאים לדרך', 'מוצאים את הקצב', 'ממשיכים להכיר',
    'מתקדמים בנחת', 'כבר רואים את הדרך', 'חצי הדרך מאחורינו',
    'נשארים בקצב שלך', 'מעמיקים עוד קצת', 'ממש לקראת הסוף', 'מחברים את התמונה'
  ];
  const colors = [
    '#4c8a81','#628cbd','#9a7fc1','#bd8b5a','#5d9789',
    '#ae7895','#639bb7','#c18a64','#718bba','#4b987f'
  ];
  const rail = $('quizMilestones'), steps = $('chapterSteps');
  const card = $('chapterPanel'), notice = $('completeReviewBanner');
  if (!rail || !steps || !card || !notice) return;

  // Keep navigation out of the question area, in an accessible modal.
  const picker = document.createElement('dialog');
  picker.className = 'chapter-picker-dialog';
  picker.id = 'chapterPickerDialog';
  picker.setAttribute('aria-labelledby','chapterPickerTitle');
  const heading = document.createElement('h2');
  heading.id = 'chapterPickerTitle';
  heading.textContent = 'בחירת מקטע';
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'chapter-picker-close';
  close.textContent = '×'; close.setAttribute('aria-label','סגירת בחירת המקטעים');
  const header = document.createElement('div');
  header.className = 'chapter-picker-header'; header.append(heading,close);
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'chapter-picker-trigger';
  trigger.textContent = 'מקטעים';
  trigger.setAttribute('aria-haspopup','dialog');
  trigger.setAttribute('aria-controls',picker.id);
  const contents = Array.from(card.children);
  picker.append(header,...contents);
  card.replaceChildren(trigger); document.body.append(picker);
  trigger.addEventListener('click',()=>{picker.showModal();close.focus();});
  close.addEventListener('click',()=>picker.close());
  picker.addEventListener('click',event=>{
    if(event.target!==picker)return;
    const rect=picker.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)picker.close();
  });
  picker.addEventListener('close',()=>trigger.focus({preventScroll:true}));

  let current = null;
  const part = index => Math.max(0, Math.min(9, Math.floor(index / step)));
  const segment = (i, data) => data.chapters[i] || 0;
  // Delegate navigation back to the survey, which alone owns the encrypted
  // or regular URL. Never decode or rewrite #e= from this presentation code.
  function jumpTo(index) {
    if (!current || index < 0 || index >= total || current.cursor === index) return;
    window.dispatchEvent(new CustomEvent('ofilab:jump-chapter',{detail:{index}}));
  }

  const render = event => {
    const detail = event && event.detail;
    if(!detail || detail.total!==total || !Array.isArray(detail.chapterCounts) || detail.chapterCounts.length!==10){
      current = null;
      card.hidden = true;
      notice.hidden = true;
      if(picker.open)picker.close();
      if(rail.children.length!==5){
        rail.replaceChildren(...Array.from({length:5},()=>document.createElement('span')));
      }
      return;
    }
    const data = current = {cursor:detail.cursor,answered:detail.answered,chapters:detail.chapterCounts};
    const active = part(data.cursor), answered = data.answered;
    const answeredHere = segment(active, data);
    const start = active * step + 1, end = start + step - 1;
    document.documentElement.style.setProperty('--current-chapter-accent', colors[active]);

    card.hidden = false;
    $('chapterTitle').textContent = 'מקטע ' + (active + 1) + ' · ' + names[active];
    $('chapterRange').textContent = 'שאלות ' + start + '–' + end + ' · שאלה ' + (data.cursor - start + 2) + ' מתוך 30 במקטע';
    $('chapterLocalCount').textContent = answeredHere + ' מתוך 30 נענו במקטע';
    const localFill = $('chapterLocalFill');
    localFill.style.width = (answeredHere / step * 100) + '%';
    $('chapterLocalMeter').setAttribute('aria-valuenow', String(answeredHere));

    // Answer count is never the same thing as the current question number.
    const counter = $('answeredCounter');
    counter.textContent = 'תשובות שמורות: ' + answered + '/' + total;
    counter.setAttribute('aria-label',
      'תשובות שמורות: ' + answered + ' מתוך 300; מיקום נוכחי: שאלה ' + (data.cursor + 1));
    $('chapterCounter').textContent = 'מקטע ' + (active + 1) + '/10';
    $('quizMilestones').setAttribute('aria-label',
      'המיקום: מקטע ' + (active + 1) + ' מתוך 10. ' + answered + ' תשובות שמורות מתוך 300.');

    // Ten true 30-item chapters, no changes to questionnaire ordering.
    const chips = [];
    const bars = [];
    for (let i = 0; i < 10; i++) {
      const complete = segment(i, data);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'journey-step';
      button.dataset.chapter = String(i);
      button.dataset.state = i === active ? 'active' : complete === step ? 'complete' : 'upcoming';
      button.style.setProperty('--chapter-accent', colors[i]);
      button.setAttribute('aria-label',
        'מקטע ' + (i + 1) + ', שאלות ' + (i * step + 1) + ' עד ' + ((i + 1) * step) +
        ', ' + complete + ' מתוך 30 נענו');
      if (i === active) button.setAttribute('aria-current', 'step');
      const number = document.createElement('span');
      number.className = 'journey-step-number';
      number.textContent = complete === step ? '✓' : String(i + 1);
      const value = document.createElement('small');
      value.textContent = complete + '/30';
      button.append(number, value);
      chips.push(button);
      const bar = document.createElement('span');
      bar.style.setProperty('--chapter-accent', colors[i]);
      bar.dataset.chapter = String(i);
      bar.style.cursor = 'pointer';
      bar.title = 'מקטע ' + (i + 1) + ' · ' + names[i] + ' (' + complete + '/30 נענו)';
      bar.dataset.state = i === active ? 'current' : complete === step ? 'complete' : 'upcoming';
      bar.style.setProperty('--part-fill', complete / step * 100 + '%');
      bars.push(bar);
    }
    steps.replaceChildren(...chips);
    rail.replaceChildren(...bars);

    const full = answered === total;
    notice.hidden = !full;
    if (full) {
      $('completeReviewText').textContent =
        'בקישור השמור קיימת תשובה לכל 300 השאלות. אתה נמצא עכשיו בשאלה ' +
        (data.cursor + 1) + ' לצפייה או לעריכה — אין צורך לדפדף עד שאלה 300 כדי לראות תוצאות.';
    }
  };
    rail.addEventListener('click', event => {
    const target = event.target.closest('[data-chapter]');
    if (!target) return;
    jumpTo(Number(target.dataset.chapter) * step);
  });

  steps.addEventListener('click', event => {
    const target = event.target.closest('button[data-chapter]');
    if (!target || !steps.contains(target)) return;
    picker.close();
    jumpTo(Number(target.dataset.chapter) * step);
    trigger.focus({preventScroll:true});
  });
  $('finishNowBtn').addEventListener('click', () => {
    if (current && current.answered === total) $('resultsBtn').click();
  });
  $('inspectSavedBtn').addEventListener('click', () => {
    if (current && current.answered === total) $('reviewBtn').click();
  });
  // Render only aggregate per-chapter completion counts from the survey.
  window.addEventListener('ofilab:question', render);
})();
