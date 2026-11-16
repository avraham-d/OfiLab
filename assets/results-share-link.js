/* ofiLab QR and Web Share: strictly local link encoding, no API calls.
 * The QR generator (qrcode-generator, MIT) is bundled on this same origin.
 * These are recovery links. A #p= token contains readable questionnaire
 * answers; a #e= token is ciphertext and requires a separate password. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const shareBtn = $('nativeShareResultsLink');
  const qrBtn = $('openResultsQr');
  const qrDialog = $('resultsQrDialog');
  if (!shareBtn || !qrBtn || !qrDialog) return;

  const status = $('resultsQrStatus');
  const input = $('resultsQrLink');
  const canvas = $('resultsQrCanvas');
  const safety = $('resultsQrSecurity');
  const mainToast = $('toast');
  let currentLink = '';
  let outsideDown = false;

  function feedback(message, error = false) {
    if (status) {
      status.textContent = message;
      status.dataset.error = String(error);
    }
    if (mainToast) {
      mainToast.textContent = message;
      mainToast.classList.remove('hidden');
      clearTimeout(mainToast._timeout);
      mainToast._timeout = setTimeout(() => mainToast.classList.add('hidden'), 5000);
    }
  }

  function linkForCurrentResults() {
    if (document.documentElement.dataset.stage !== 'results') {
      throw Error('קישור שחזור זמין לאחר סיום המבחן.');
    }
    const saveState = $('saveStatus')?.dataset.state;
    // A failed localStorage write does not invalidate an already minted URL.
    // Only wait while link regeneration is actively pending.
    if (saveState === 'pending') {
      throw Error('שמירת התוצאות עדיין לא הושלמה. נסה שוב אחרי שהשמירה תסתיים.');
    }
    // Read the actual locally generated URL fragment. Never upload it to a
    // QR service, embed the password, or read the plaintext answers here.
    const url = new URL(window.location.href);
    const token = /^#([pe])=([A-Za-z0-9_-]{8,800})((?:&(?:h=[A-Za-z0-9_-]{7}|v=[A-Za-z0-9_-]{24}|a=[A-Za-z0-9_-]{5}))*)$/.exec(url.hash);
    if (!token) throw Error('לא נמצא קישור שחזור תקין. שמור את התוצאות ונסה שוב.');
    const inv = document.documentElement.dataset.inventory;
    const count = inv === 'ipip-neo-300' ? 300 : 120;
    url.search = '';
    url.searchParams.set('len', String(count));
    return { url: url.toString(), protected: token[1] === 'e' };
  }

  function makeQr(url) {
    if (typeof window.qrcode !== 'function') {
      throw Error('לא ניתן לטעון את מנגנון ה־QR. רענן את הדף ונסה שוב.');
    }
    const qr = window.qrcode(0, 'L');
    qr.addData(url, 'Byte');
    qr.make();
    const modules = qr.getModuleCount();
    const quiet = 4, cell = 5;
    const size = (modules + quiet * 2) * cell;
    if (size > 900) throw Error('קישור ארוך מדי ליצירת QR.');
    const ctx = canvas.getContext('2d', {alpha: false});
    if (!ctx) throw Error('הדפדפן אינו תומך בציור קוד QR.');
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#111a16';
    for (let row = 0; row < modules; row++) {
      for (let col = 0; col < modules; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + quiet) * cell, (row + quiet) * cell, cell, cell);
        }
      }
    }
  }

  function openQr() {
    try {
      const data = linkForCurrentResults();
      makeQr(data.url);
      currentLink = data.url;
      input.value = data.url;
      status.textContent = '';
      status.dataset.error = 'false';
      safety.textContent = data.protected
        ? 'קישור מוצפן: הסריקה פותחת את המבחן, אך נדרשת סיסמת השמירה בנפרד. הסיסמה אינה בתוך ה־QR.'
        : 'שים לב: זהו קישור לא מוצפן. כל מי שמחזיק בקוד ה־QR יוכל לשחזר ולקרוא את התשובות. ניתן להפעיל שמירה בסיסמה לפני השיתוף.';
      safety.dataset.protected = String(data.protected);
      qrDialog.showModal();
    } catch (error) {
      feedback(error?.message || 'לא ניתן ליצור QR כרגע.', true);
    }
  }

  async function copyLink() {
    if (!currentLink) return;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(currentLink);
      feedback('קישור השחזור הועתק. שמור אותו במקום בטוח.');
      window.dispatchEvent(new CustomEvent('ofilab:backup-link-copied', {
        detail: {protected: currentLink.includes('#e=')}
      }));
    } catch (_) {
      input.focus();
      input.select();
      feedback('סמן והעתק את הקישור מתוך שדה הטקסט.', true);
    }
  }

  function saveQr() {
    if (!currentLink || !canvas.width) return;
    try {
      const a = document.createElement('a');
      a.download = 'ofilab-recovery-qr.png';
      a.href = canvas.toDataURL('image/png');
      document.body.append(a);
      a.click();
      a.remove();
      feedback('קוד ה־QR נשמר כתמונה. שמור אותו במקום פרטי.');
    } catch (_) {
      feedback('הורדת התמונה נכשלה. אפשר לסרוק את הקוד מהמסך.', true);
    }
  }

  async function shareLink() {
    let data;
    try { data = linkForCurrentResults(); }
    catch (error) { feedback(error?.message || 'קישור השמירה אינו זמין.', true); return; }
    // Call share() in the original click activation; async encryption before
    // this point could cause Android/iOS to reject the share sheet.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({title: 'תוצאות ofiLab', url: data.url});
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return; // user dismissed the sheet
      }
    }
    // Desktop browsers lacking Web Share get the same complete recovery link.
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw Error('Unavailable');
      await navigator.clipboard.writeText(data.url);
      feedback(data.protected
        ? 'השיתוף אינו נתמך בדפדפן; הקישור המוצפן הועתק. את הסיסמה יש למסור בנפרד.'
        : 'השיתוף אינו נתמך בדפדפן; הקישור הועתק. מי שמחזיק בו יכול לקרוא את התשובות.');
      window.dispatchEvent(new CustomEvent('ofilab:backup-link-copied', {
        detail: {protected: data.protected}
      }));
    } catch (_) {
      openQr();
      if (qrDialog.open) {
        input.focus();
        input.select();
        status.textContent = 'אפשר להעתיק ידנית את הקישור שמופיע מתחת לקוד.';
      }
    }
  }

  qrBtn.addEventListener('click', openQr);
  shareBtn.addEventListener('click', shareLink);
  $('closeResultsQr')?.addEventListener('click', () => qrDialog.close());
  $('copyResultsQrLink')?.addEventListener('click', copyLink);
  $('downloadResultsQr')?.addEventListener('click', saveQr);
  qrDialog.addEventListener('close', () => {
    currentLink = '';
    input.value = '';
    canvas.width = canvas.height = 0;
    ($('resultsShareTop') || qrBtn).focus({preventScroll: true});
  });
  qrDialog.addEventListener('pointerdown', event => {
    const r = qrDialog.getBoundingClientRect();
    outsideDown = event.target === qrDialog &&
      (event.clientX < r.left || event.clientX > r.right ||
       event.clientY < r.top || event.clientY > r.bottom);
  });
  qrDialog.addEventListener('click', event => {
    if (outsideDown && event.target === qrDialog) qrDialog.close();
    outsideDown = false;
  });
})();
