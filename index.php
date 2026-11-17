<?php
/** Public, session-free entrypoint. Questionnaire answers remain browser-side. */
declare(strict_types=1);
header_remove('X-Powered-By');
/** Inline a JSON file from data/ inside <script type="application/json"> ("</" escaped). */
function ofilab_json(string $file): string {
    $raw = file_get_contents(__DIR__ . '/data/' . $file);
    if ($raw === false || json_decode($raw) === null) { error_log('ofiLab: unreadable data file ' . $file); return 'null'; }
    return str_replace('</', '<\\/', trim($raw));
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'");
header('X-Personality-Page: php-v1');
if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) {
    http_response_code(405);
    header('Allow: GET, HEAD');
    exit;
}

// Inventory requested via query param (?len=120 or ?len=300; legacy 50 redirects to 120 with deprecation notice)
$deprecated50 = (isset($_GET['len']) && (int)$_GET['len'] === 50)
    || (isset($_GET['inventory']) && $_GET['inventory'] === 'ipip-50')
    || (isset($_GET['deprecated']) && $_GET['deprecated'] === '50');
$reqLen = isset($_GET['len']) ? ((int)$_GET['len'] === 300 ? 300 : 120) : (isset($_GET['inventory']) && $_GET['inventory'] === 'ipip-neo-300' ? 300 : 120);
$initInventory = $reqLen === 300 ? 'ipip-neo-300' : 'ipip-neo-120';

// Optional AI assistant: ai-config.php (not part of the public repository, see ai-config.example.php)
// returns ['endpoint' => '/same-origin/path']. Without it the assistant is hidden.
$aiEndpoint = '';
if (is_file(__DIR__ . '/ai-config.php')) {
    $aiConfig = include __DIR__ . '/ai-config.php';
    $candidate = is_array($aiConfig) ? (string)($aiConfig['endpoint'] ?? '') : '';
    if (preg_match('#^/[A-Za-z0-9._/-]+$#', $candidate)) {
        $aiEndpoint = $candidate;
    }
}

// Optional: the host site's anonymous visit counter (../core/Analytics.php, not part of this
// project). When that file is absent, as in a standalone copy, nothing is recorded.
if (PHP_SAPI !== 'cli' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $ofiEvent = isset($_GET['ofilab_event']) && in_array($_GET['ofilab_event'], ['start', 'complete'], true)
        ? (string)$_GET['ofilab_event']
        : null;
    try {
        $analyticsPath = dirname(__DIR__) . '/core/Analytics.php';
        if (is_file($analyticsPath)) {
            require_once $analyticsPath;
            \AVD\Core\Analytics::init(dirname(__DIR__));
            // Host is client-supplied: keep only hostname characters before it reaches analytics storage.
            $ofiHost = strtolower(explode(':', (string)($_SERVER['HTTP_HOST'] ?? 'ofilab.avrahamd.ovh'))[0]);
            if (!preg_match('/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/', $ofiHost)) {
                $ofiHost = 'invalid-host';
            }
            if ($ofiEvent !== null) {
                $evLen = $reqLen === 300 ? 300 : 120;
                \AVD\Core\Analytics::recordVisit($ofiHost, '/ofilab/' . $ofiEvent . '?len=' . $evLen, 204);
            } else {
                $ofiPath = '/ofilab' . ($reqLen === 300 ? '?len=300' : '');
                \AVD\Core\Analytics::recordVisit($ofiHost, $ofiPath, 200);
            }
        }
    } catch (\Throwable $e) {
        // Never block questionnaire rendering if analytics storage is unavailable.
    }
    if ($ofiEvent !== null) {
        http_response_code(204);
        exit;
    }
}
?>
<!doctype html>
<html lang="he" dir="rtl" data-theme="light"<?= $aiEndpoint !== '' ? ' data-ai-endpoint="' . htmlspecialchars($aiEndpoint, ENT_QUOTES, 'UTF-8') . '"' : '' ?> data-ofilab-design="calm-v2" data-calm-style="quiet" data-calm-art="amber-crystal" data-ui-version="v2" data-inventory="<?= htmlspecialchars($initInventory, ENT_QUOTES, 'UTF-8') ?>"<?= $deprecated50 ? ' data-deprecated-inventory="ipip-50"' : '' ?>>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#F8F5FA">
  <link rel="icon" href="./favicon.ico?v=2" sizes="any">
  <link rel="icon" href="./assets/logo-mark.png" type="image/png" sizes="192x192">
  <link rel="icon" href="./assets/favicon.svg?v=3" type="image/svg+xml">
  <link rel="apple-touch-icon" href="./assets/logo-mark.png" sizes="192x192">
  <meta name="color-scheme" content="light dark">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="he_IL">
  <meta property="og:site_name" content="ofiLab">
  <meta property="og:title" content="ofiLab · פרופיל אישיותי מקיף">
  <meta property="og:description" content="שאלון עומק פסיכומטרי מבוסס מודל חמש התכונות (IPIP-NEO), בהשוואה לנורמות מחקר של 145,000+ משיבים. פרטי לחלוטין וללא שרת.">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'">
  <meta name="description" content="הכירו את מפת האישיות: שאלון אישיות מעמיק בעברית — 120 היגדים מומלצים או 300 להעמקה מלאה, עם שמירה בקישור. פרטי וללא חשבון.">
  <title>פרופיל אישיותי מקיף | ofiLab — שאלון חמש התכונות</title>
  <link rel="preload" href="./assets/fonts/heebo-variable.ttf" as="font" type="font/ttf" crossorigin>
  <link rel="stylesheet" href="./assets/ofilab-structural.css">
  <link rel="stylesheet" href="./assets/calm.css">
  <link rel="stylesheet" href="./assets/calm.identity.css">
</head>
<body>
  <a class="skip-link" href="#main">דלג לתוכן הראשי</a>
  <svg width="0" height="0" class="icon-sprite" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <symbol id="i-spark" viewBox="0 0 24 24"><path d="m12 2 1.9 7.1L21 11l-7.1 1.9L12 20l-1.9-7.1L3 11l7.1-1.9L12 2Z"/><path d="m19 18 .7 2.3L22 21l-2.3.7L19 24l-.7-2.3L16 21l2.3-.7L19 18Z"/></symbol>
    <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M19 12H5m7 7-7-7 7-7"/></symbol>
    <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14m-7-7 7 7-7 7"/></symbol>
    <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></symbol>
    <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></symbol>
    <symbol id="i-layers" viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></symbol>
    <symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.1 0l2-2A5 5 0 0 0 12 3l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 21l1.2-1.2"/></symbol>
    <symbol id="i-moon" viewBox="0 0 24 24"><path d="M20.5 14.3A8.7 8.7 0 0 1 9.7 3.5a8.8 8.8 0 1 0 10.8 10.8Z"/></symbol>
    <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></symbol>
    <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V4m0 16h16M8 15l4-4 3 2 5-7"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 20a6.5 6.5 0 0 0-3-5.5"/></symbol>
    <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/></symbol>
    <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V3m-4 4 4-4 4 4M4 16v4h16v-4"/></symbol>
    <symbol id="i-print" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
    <symbol id="i-restart" viewBox="0 0 24 24"><path d="M3 11a9 9 0 1 1 2.3 6M3 4v7h7"/></symbol>
    <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></symbol>
    <symbol id="i-chevron" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
    <symbol id="i-settings" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></symbol>
    <symbol id="i-close" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M18 6 6 18M6 6l12 12"/></symbol>
  </svg>

  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="./" aria-label="דף הבית של מפת האישיות">
        <span class="brand-mark" aria-hidden="true"><img src="./assets/logo-mark.png" alt="" width="38" height="38" decoding="async"></span>
        <span class="brand-type"><b>ofiLab<span class="brand-dot">.</span></b><span>פרופיל אישיותי מקיף</span></span>
      </a>
      <div class="results-header-badge" id="resultsHeaderBadge" hidden>
        <span class="badge-dot" aria-hidden="true"></span>
        <span class="badge-text" id="resultsHeaderBadgeText">שאלון 120 · תקני</span>
      </div>
      <nav class="header-links" aria-label="ניווט ראשי">
        <button type="button" id="loadResultsButton" class="header-share home-load-button" aria-label="טעינת תוצאות מקובץ שמור"><svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-upload"/></svg><span>טעינת תוצאות</span></button>
        <button type="button" id="resultsPrintTop" class="header-share results-print-top" aria-label="הדפסה או שמירה כ-PDF" title="הדפסה או שמירה כ-PDF" hidden><svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-print"/></svg><span>הדפסה</span></button>
        <a class="nav-link" href="./about.html">איך זה עובד</a>
        <span class="nav-divider" aria-hidden="true"></span>
        <button type="button" class="header-share header-settings-btn" id="openSettingsTop" aria-label="הגדרות המבחן" title="הגדרות המבחן" aria-haspopup="dialog" aria-controls="settingsDialog"><svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-settings"/></svg><span>הגדרות</span></button>
        <details class="header-save-menu" id="quizSaveMenu">
          <summary aria-label="אפשרויות שמירת התקדמות" title="שמירת התקדמות"><svg width="19" height="19" class="icon" aria-hidden="true"><use href="#i-shield"/></svg><span>שמירת התקדמות</span></summary>
          <div class="header-save-options">
            <button type="button" class="header-share" id="shareTop" hidden><svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-link"/></svg><span>קישור שמירה</span></button>
            <button type="button" class="header-share secure-save-trigger" id="protectSaveTop" hidden><svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-shield"/></svg><span>שמירה עם סיסמה</span></button>
          </div>
        </details>
        <button type="button" id="resultsShareTop" class="header-share results-share-top" aria-label="שמירה ושיתוף של התוצאות, כולל קישור וסיסמה" aria-haspopup="dialog" aria-controls="resultsShareDialog" aria-expanded="false" title="שמירה ושיתוף: קישור, סיסמה, PDF ותמונה"><svg width="19" height="19" class="icon" aria-hidden="true"><use href="#i-shield"/></svg><span>שמירה ושיתוף</span></button>
        <button type="button" id="themeToggle" class="theme-toggle" aria-label="מעבר למצב כהה" aria-pressed="false" title="שינוי ערכת נושא"><svg class="icon theme-icon" aria-hidden="true"><use href="#i-moon"/></svg></button>
      </nav>
    </div>
  </header>

  <main id="main">
    <section class="stage intro" id="introScreen">
      <div class="hero-grid">
        <div class="hero-copy">
          <span class="eyebrow"><span class="status-dot"></span> שאלון עומק פסיכומטרי מבוסס מודל חמש התכונות</span>
          <h1>לכל אדם<br><em>מפה משלו.</em></h1>
          <p class="lede">לא תווית אחת ולא מספר בודד. מפה אישית של חמש התכונות ושלושים תחומי המשנה, עם השוואה למדגמי מחקר — פרטית לחלוטין ובמכשיר שלך בלבד.</p>
          <div class="resume-card" id="resumeCard" hidden><div><span class="eyebrow">טוב שחזרת</span><p id="resumeProgress"></p><div id="resumeMeter" class="resume-meter" role="progressbar" aria-label="התקדמות המבחן השמור" aria-valuemin="0" aria-valuemax="120" aria-valuenow="0"><span></span></div></div><button id="continueBtn" class="primary" type="button" hidden>ממשיכים <svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button></div>
<div class="locked-resume-action"><button id="unlockProtectedAgain" type="button" class="primary" hidden>פתיחת התקדמות מוצפנת <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-shield"/></svg></button></div>
<div id="legacy50Banner" class="legacy-banner" role="alert" hidden>
  <strong>גרסת 50 השאלות (IPIP-50) יצאה משימוש</strong>
  <p class="legacy-banner__text">קישורים וקבצים ישנים של שאלון 50 אינם נתמכים עוד. להערכה מלאה הכוללת 30 תחומי משנה ונורמות עדכניות, אפשר להתחיל את גרסת 120 (מומלץ) או 300:</p>
  <div class="legacy-banner__actions">
    <button type="button" class="primary" id="legacyBannerStart120">להתחלת שאלון 120 (מומלץ)</button>
    <button type="button" class="secondary" id="legacyBannerStart300">להתחלת שאלון 300</button>
    <button type="button" class="ghost" id="legacyBannerDismiss">סגירה</button>
  </div>
</div>

</div>
        <div class="qf-cover-choice">
<section class="version-choice" id="versions" aria-label="בחירת אורך המבחן">
<article class="version-option recommended current" data-version="120" id="card-120"><div class="version-top"><h2>השאלון המרכזי</h2><span class="version-badge">מומלץ</span></div><p class="version-size"><span class="version-count"><strong>120</strong> שאלות</span> <span class="version-time">כ־<bdi>10–15</bdi> דקות</span></p><p class="version-description">חמש תכונות ו־30 תחומי משנה עם נורמות אמפיריות מלאות</p><button id="startBtn" class="primary start-form-btn" type="button" data-len="120">מתחילים ב־120<svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button></article>
<article class="version-option compact" data-version="300" id="card-300"><div class="version-top"><h2>העמקה מלאה</h2></div><p class="version-size"><span class="version-count"><strong>300</strong> שאלות</span> <span class="version-time">כ־<bdi>30–45</bdi> דקות</span></p><p class="version-description">300 היגדים מלאים, 30 תחומי משנה ב־10 מקטעים</p><button id="startBtn300" class="secondary start-form-btn" type="button" data-len="300" aria-label="להתחיל שאלון 300 שאלות">מתחילים<svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button></article>
</section>
<div class="hero-trust"><svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-shield"/></svg><span>בחינם · ללא הרשמה · ההתקדמות נשמרת במכשיר שלך</span></div>
        </div>
      </div>
      <section class="qf-cover-notes" aria-label="שמירה, גיבוי וההבדל בין הגרסאות">
<p class="home-save-warning">אין שרת ואין חשבון, ולכן אין שחזור. בסיום שמרו קישור או קובץ.</p>
<details class="home-save-note">
  <summary>התשובות נשמרות בדפדפן הזה בלבד · איך מגבים?</summary>
  <p>כדי לחזור גם ממכשיר אחר או אחרי ניקוי נתוני גלישה, שמרו קישור או קובץ גיבוי. בזמן המבחן השתמשו ב״קישור שמירה״, ובסיום ב״שמירה ושיתוף״. אין אצלנו עותק לשחזור.</p>
  <p>קישור רגיל כולל את התשובות. אפשר להגן עליו בסיסמה; שמרו את הסיסמה בנפרד.</p>
</details>
<details class="version-explainer"><summary>מה ההבדל בין הגרסאות?</summary><div><p><strong>120 · הבחירה המומלצת:</strong> IPIP-NEO-120, חמש תכונות ו־30 תחומי משנה, בארבע שאלות לכל תחום.</p><p><strong>300 · יותר העמקה:</strong> IPIP-NEO-300, עשר שאלות לכל אחד מ־30 תחומי המשנה. אורך לבדו אינו מבטיח דיוק גבוה יותר.</p><p>התרגומים לעברית ניסיוניים וטרם תוקפו מחקרית. הזמנים משוערים, כל גרסה נשמרת בנפרד והציונים אינם בני השוואה ישירה.</p></div></details>
</section>
<section class="home-restore" aria-label="טעינת תוצאות שמורות">
        <div><strong>כבר שמרת תוצאות?</strong><p>פתחו קובץ גיבוי של ofiLab כדי לחזור לדוח שלכם. הקובץ נקרא במכשירך בלבד.</p></div>
        <button type="button" id="loadResultsHome" class="secondary">טעינת דוח שמור</button>
        <input id="loadResultsFile" type="file" accept=".json,application/json" hidden>
        <p id="loadResultsStatus" role="status" aria-live="polite"></p>
      </section>
      <section class="home-report-preview" id="homeReportPreview" aria-labelledby="previewTitle">
        <div class="home-preview-report">
        <div class="home-preview-heading">
          <div><span class="home-preview-kicker">פרופיל לדוגמה</span><h2 id="previewTitle">הצצה למפת האישיות שלך</h2><p>כך נראה חלק מהדוח בסיום 120 שאלות.</p></div>
        </div>
        <div class="home-preview-paper">
          <div class="home-preview-paper-head"><strong>חמש התכונות במבט אחד</strong><span>אחוזונים לדוגמה</span></div>
          <ul class="home-preview-bars">
            <li class="home-preview-trait"><div class="home-preview-trait-caption"><span>פתיחות</span><strong>אחוזון 82</strong></div><div class="home-preview-track" aria-hidden="true"><span class="home-preview-fill" style="--preview-value:82%"></span></div></li>
            <li class="home-preview-trait"><div class="home-preview-trait-caption"><span>מצפוניות</span><strong>אחוזון 67</strong></div><div class="home-preview-track" aria-hidden="true"><span class="home-preview-fill" style="--preview-value:67%"></span></div></li>
            <li class="home-preview-trait"><div class="home-preview-trait-caption"><span>מוחצנות</span><strong>אחוזון 38</strong></div><div class="home-preview-track" aria-hidden="true"><span class="home-preview-fill" style="--preview-value:38%"></span></div></li>
            <li class="home-preview-trait"><div class="home-preview-trait-caption"><span>נעימות</span><strong>אחוזון 74</strong></div><div class="home-preview-track" aria-hidden="true"><span class="home-preview-fill" style="--preview-value:74%"></span></div></li>
            <li class="home-preview-trait"><div class="home-preview-trait-caption"><span>רגישות רגשית</span><strong>אחוזון 45</strong></div><div class="home-preview-track" aria-hidden="true"><span class="home-preview-fill" style="--preview-value:45%"></span></div></li>
          </ul>
          <div class="home-preview-insight">
            <svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-spark"/></svg>
            <div><strong>תובנה לדוגמה</strong><p>פתיחות גבוהה לצד מוחצנות נמוכה עשויה להתבטא בסקרנות לרעיונות חדשים ובהעדפה לחקור אותם בשקט ובדרך שלך.</p></div>
          </div>
        </div>
        <p class="home-preview-more">בדוח המלא אפשר לראות גם תחומי משנה, הסברים ותובנות נוספות.</p>
        <a class="primary home-preview-cta" href="./?len=120&amp;start=1">מתחילים בשאלון המומלץ <svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></a>
        </div>
        <aside class="home-preview-companion" aria-labelledby="previewCompanionTitle">
          <span class="home-preview-kicker">מאחורי המספרים</span>
          <h2 id="previewCompanionTitle">מה מקבלים בדוח?</h2>
          <ul class="home-preview-benefits">
            <li><svg class="icon" aria-hidden="true"><use href="#i-chart"/></svg><div><h3>התמונה הרחבה</h3><p>חמש תכונות, עם ציון שאלון ואחוזון ביחס למדגם ההשוואה.</p></div></li>
            <li><svg class="icon" aria-hidden="true"><use href="#i-layers"/></svg><div><h3>הצדדים שבתוך כל תכונה</h3><p>בגרסאות 120 ו־300: שלושים תחומי משנה, שאפשר לפתוח, לחפש ולמיין.</p></div></li>
            <li><svg class="icon" aria-hidden="true"><use href="#i-download"/></svg><div><h3>אפשר לשמור ולחזור</h3><p>מורידים קובץ תוצאות וטוענים אותו מחדש במסך הראשי. אפשר גם לשמור בסיסמה.</p></div></li>
          </ul>
          <section class="home-preview-reading" aria-labelledby="previewReadingTitle">
            <div class="home-preview-reading-heading"><h3 id="previewReadingTitle">איך קוראים אחוזון?</h3><span>דוגמה</span></div>
            <p class="home-preview-reading-value"><strong>82</strong><span>אחוזון במדגם</span></p>
            <div class="home-preview-reading-scale" role="img" aria-label="המחשה: אחוזון 82 על סולם 0 עד 100"><span></span></div>
            <div class="home-preview-reading-ends" aria-hidden="true"><bdi>0</bdi><bdi>100</bdi></div>
            <p>המיקום יחסי למשיבי מדגם ההשוואה. זה לא אומר ש־82% מהאישיות שלך היא התכונה הזאת.</p>
          </section>
          <p class="home-preview-limit">התוצאות הן נקודת מוצא להתבוננות. הנוסח העברי ניסיוני, והדוח אינו אבחון.</p>
        </aside>
      </section>
      <section class="home-additional-quizzes" id="homeAdditionalQuizzes" aria-labelledby="homeAdditionalQuizzesTitle">
        <div class="home-additional-head">
          <div>
            <span class="home-preview-kicker">מילוי שאלונים משלימים</span>
            <h2 id="homeAdditionalQuizzesTitle">להעמקה נוספת</h2>
            <p>שאלונים קצרים להרחבת מפת האישיות. אפשר למלא עכשיו או לחזור אליהם מתוך הדוח.</p>
          </div>
        </div>
        <div id="homeAdditionalHubMount" class="supp-hub-grid"></div>
        <div id="homeAdditionalResultsMount" class="home-additional-results-mount"></div>
      </section>
    </section>

    <section class="stage quiz hidden" id="quizScreen" aria-labelledby="questionText">
      <div class="quiz-shell">
        <p id="connectionState" class="connection-state" role="status" aria-live="polite" hidden></p>
        <div class="progress-meta"><span id="chapterCounter" class="chapter-pill">חלק 1 מתוך 5</span><span class="answered-counter" id="answeredCounter">0 מתוך 120 נענו</span><span class="quiz-eta-badge" id="quizEtaBadge" title="הערכת זמן לסיום בקצב הנוכחי" hidden></span><button type="button" class="quiz-settings-pill" id="openSettingsQuiz" title="הגדרות קצב ושמירה" aria-haspopup="dialog" aria-controls="settingsDialog"><svg width="14" height="14" class="icon" aria-hidden="true"><use href="#i-settings"/></svg><span>הגדרות</span></button><span class="save-note"><svg class="icon" width="14" height="14" aria-hidden="true"><use href="#i-check"/></svg><span id="saveStatus">שמירה אוטומטית פעילה</span><button type="button" class="save-recovery" id="saveRecovery" hidden>שמור קישור עכשיו</button></span></div>
        <div class="quiz-milestones" id="quizMilestones" role="img" aria-label="חלק 1 מתוך 5"><span></span><span></span><span></span><span></span><span></span></div>
        <div class="meter" role="progressbar" aria-label="התקדמות במבחן" aria-valuemin="0" aria-valuemax="120" aria-valuenow="0" id="progressMeter"><div id="meterFill"></div></div>

        <!-- Chapter journey panel for 300 questions mode -->
        <section class="chapter-panel" id="chapterPanel" aria-label="מקטעי המבחן" hidden>
          <div class="chapter-panel-head">
            <div>
              <span class="chapter-kicker">מתקדמים 30 שאלות בכל פעם</span>
              <h2 id="chapterTitle">מקטע 1 · יוצאים לדרך</h2>
              <p id="chapterRange" class="chapter-range">שאלות 1–30</p>
            </div>
            <span id="chapterLocalCount" class="chapter-count">0 מתוך 30 נענו במקטע</span>
          </div>
          <div class="chapter-local-meter" id="chapterLocalMeter" role="progressbar" aria-label="התקדמות במקטע הנוכחי" aria-valuemin="0" aria-valuemax="30" aria-valuenow="0">
            <span id="chapterLocalFill"></span>
          </div>
          <div class="chapter-steps" id="chapterSteps" role="group" aria-label="בחירת מקטע"></div>
        </section>

        <div class="complete-review-banner" id="completeReviewBanner" hidden>
          <p id="completeReviewText">בקישור השמור קיימת תשובה לכל השאלות.</p>
          <div class="complete-review-actions">
            <button type="button" class="primary" id="finishNowBtn">צפייה בתוצאות המלאות</button>
            <button type="button" class="secondary" id="inspectSavedBtn">סקירת כל התשובות</button>
          </div>
        </div>

        <div class="question-card">
          <div class="question-caption"><span id="questionCounter">שאלה 1</span><span class="question-invitation">מה הכי מתאים לך?</span></div>
          <div class="question-heading">
            <h2 id="questionText" tabindex="-1"></h2>
          </div>
          <details class="question-assistance" id="questionAssistance">
            <summary>עזרה בשאלה</summary>
          <div class="question-tools" role="group" aria-label="עזרה בהבנת השאלה">
            <button type="button" id="questionHelpBtn" class="question-help-trigger" aria-label="מה הכוונה בשאלה הזאת?" aria-haspopup="dialog" aria-controls="questionHelpPanel" aria-expanded="false" title="הסבר על ההיגד"><span aria-hidden="true">?</span> הסבר קצר</button>
            <span class="question-tools-divider" aria-hidden="true"></span>
            <button type="button" id="askAiQuestion" class="ai-inline-action" aria-label="לשאול את ה־AI על השאלה" aria-haspopup="dialog" aria-controls="aiDialog"><svg class="icon" aria-hidden="true" width="19" height="19"><use href="#i-spark"/></svg> לשאול AI</button>
          </div>
          </details>
          <fieldset class="answer-set" id="answerSet"><legend class="sr-only">בחירת תשובה</legend></fieldset>
          <p class="help" id="choiceFeedback" role="status" aria-live="polite">אין תשובה נכונה. בחר את מה שמתאים לך בדרך כלל.</p>
        </div>
        <div class="quiz-controls">
          <button id="prevBtn" type="button" class="secondary"><svg class="icon icon-prev" aria-hidden="true"><use href="#i-arrow-right"/></svg> הקודם</button>
          <button id="nextBtn" type="button" class="primary"><span id="nextLabel">ממשיכים</span> <svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button>
        </div>
        <div class="quiz-quickbar"><button id="jumpUnanswered" type="button" class="quiet-link" hidden>לשאלה הבאה שלא נענתה <span aria-hidden="true">←</span></button><span class="quiz-keyboard-hint">אפשר לבחור גם עם המקשים 1–5</span></div>
        <div class="quiz-settings-bar">
          <button type="button" class="quiet-link quiz-settings-link" id="openSettingsBottom" aria-haspopup="dialog" aria-controls="settingsDialog">
            <svg width="15" height="15" class="icon" aria-hidden="true"><use href="#i-settings"/></svg>
            <span>הגדרות קצב ושמירת המבחן</span>
          </button>
          <button id="resultsBtn" type="button" class="primary" hidden>לראות תוצאות <svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-arrow"/></svg></button>
        </div>
      </div>
    </section>

    <section class="stage results hidden" id="resultScreen">
      <div class="results-layout">
      <div class="results-mobile-picker" role="group" aria-label="ניווט בין חלקי הדוח">
        <span class="results-mobile-picker-label">חלקי הדוח</span>
        <div class="results-mobile-picker-field">
          <button id="resultsMobileTrigger" class="results-mobile-picker-trigger" type="button" aria-label="בחירת חלק בדוח התוצאות" aria-haspopup="menu" aria-expanded="false" aria-controls="resultsMobileMenu">
            <span id="resultsMobileCurrent" class="results-mobile-picker-current">01 · חמש התכונות</span>
            <svg class="results-mobile-picker-chevron" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6"/></svg>
          </button>
          <div id="resultsMobileMenu" class="results-mobile-picker-menu" role="menu" aria-label="מעבר לחלק אחר בדוח" hidden>
            <button type="button" class="results-mobile-menu-item" role="menuitemradio" aria-checked="true" data-mobile-section="traitOverview"><span class="results-mobile-menu-index" aria-hidden="true">01</span><span class="results-mobile-menu-name">חמש התכונות</span><span class="results-mobile-menu-check" aria-hidden="true">✓</span></button>
            <button type="button" class="results-mobile-menu-item" role="menuitemradio" aria-checked="false" data-mobile-section="responseValidityCard"><span class="results-mobile-menu-index" aria-hidden="true">02</span><span class="results-mobile-menu-name">איכות המענה</span><span class="results-mobile-menu-check" aria-hidden="true">✓</span></button>
            <button type="button" class="results-mobile-menu-item" role="menuitemradio" aria-checked="false" data-mobile-section="cyberneticLabCard"><span class="results-mobile-menu-index" aria-hidden="true">03</span><span class="results-mobile-menu-name">מנועי ההתנהגות</span><span class="results-mobile-menu-check" aria-hidden="true">✓</span></button>
            <button type="button" class="results-mobile-menu-item" role="menuitemradio" aria-checked="false" data-mobile-section="facetExplorer"><span class="results-mobile-menu-index" aria-hidden="true">04</span><span class="results-mobile-menu-name">תחומי המשנה</span><span class="results-mobile-menu-check" aria-hidden="true">✓</span></button>
            <button type="button" class="results-mobile-menu-item" role="menuitemradio" aria-checked="false" data-mobile-section="normPanel"><span class="results-mobile-menu-index" aria-hidden="true">05</span><span class="results-mobile-menu-name">השוואה למדגם</span><span class="results-mobile-menu-check" aria-hidden="true">✓</span></button>
            <button type="button" class="results-mobile-menu-item" role="menuitemradio" aria-checked="false" data-mobile-section="mbtiDisclosure"><span class="results-mobile-menu-index" aria-hidden="true">06</span><span class="results-mobile-menu-name">סגנון 4 אותיות</span><span class="results-mobile-menu-check" aria-hidden="true">✓</span></button>
            <button type="button" class="results-mobile-menu-item" role="menuitemradio" aria-checked="false" data-mobile-section="additionalQuizzesSection"><span class="results-mobile-menu-index" aria-hidden="true">07</span><span class="results-mobile-menu-name">שאלונים נוספים</span><span class="results-mobile-menu-check" aria-hidden="true">✓</span></button>
            <button type="button" class="results-mobile-menu-item results-mobile-menu-top" role="menuitem" data-mobile-section="__top"><span class="results-mobile-menu-index" aria-hidden="true">↑</span><span class="results-mobile-menu-name">חזרה לתחילת הדוח</span></button>
          </div>
        </div>
      </div>
      <nav class="results-journey" aria-label="ניווט בין חלקי התוצאות">
<span class="results-journey-caption" aria-hidden="true">חלקי הדוח</span>
<button type="button" data-scroll="traitOverview" aria-pressed="false"><bdi>01</bdi> חמש התכונות</button>
<button type="button" data-scroll="responseValidityCard" aria-pressed="false"><bdi>02</bdi> איכות המענה</button>
<button type="button" data-scroll="cyberneticLabCard" aria-pressed="false"><bdi>03</bdi> מנועי ההתנהגות</button>
<button type="button" data-scroll="facetExplorer" aria-pressed="false" class="results-nav-facets"><bdi>04</bdi> תחומי המשנה</button>
<button type="button" data-scroll="normPanel" aria-pressed="false" class="results-nav-norms"><bdi>05</bdi> השוואה למדגם</button>
<button type="button" data-scroll="mbtiDisclosure" aria-pressed="false"><bdi>06</bdi> סגנון 4 אותיות</button>
<button type="button" data-scroll="additionalQuizzesSection" aria-pressed="false"><bdi>07</bdi> שאלונים נוספים</button>
<button id="resultsBackToTop" class="results-back-to-top" type="button"><span aria-hidden="true">↑</span> חזרה לתחילת הדוח</button>

<div class="report-rail-actions">
  <button id="resultsAiFab" class="report-rail-action" type="button" aria-haspopup="dialog" aria-controls="aiDialog" aria-expanded="false"><svg class="icon" width="20" height="20" aria-hidden="true"><use href="#i-spark"/></svg> שיחה על הדוח</button>
  <button id="resultsSaveFab" class="report-rail-action report-rail-save" type="button" aria-haspopup="dialog" aria-controls="resultsShareDialog"><svg class="icon" width="20" height="20" aria-hidden="true"><use href="#i-download"/></svg> שמירת הדוח</button>
  <details class="report-rail-more">
    <summary>כלים נוספים</summary>
    <button type="button" data-report-action="downloadRawQuestionsMain">גיבוי שאלות ותשובות <small>JSON</small></button>
    <button type="button" data-report-action="normExport">טבלת ציונים <small>CSV</small></button>
    <button type="button" data-report-action="resultsFooterReview">עריכת תשובות</button>
  </details>
</div>
</nav>
      <div class="results-main-content">
      <div class="results-heading results-heading-compact"><div class="qf-report-issue" aria-hidden="true"><span>OFILAB / THE PERSONALITY ATLAS</span><span>FIELD REPORT / 01</span></div>
        <span class="eyebrow"><span class="status-dot"></span> המבחן הושלם · Big Five</span>
        <h1>חמש התכונות שלך</h1>
        <p class="lede">האחוזונים מציגים את מיקומך ביחס למשיבי מדגם ההשוואה המתאים לכל גרסת שאלון (120 או 300), לצד ציון טווח התשובות.</p>
      </div>
      <section id="traitOverview" class="big-five-section" aria-label="חמש התכונות שלך">
      <section id="resultsProfileSummary" class="results-profile-summary" aria-label="תמצית הפרופיל האישי" hidden></section>
      <section id="resultsSnapshot" class="results-snapshot" aria-label="סיכום תוצאות"></section>
      <div class="results-overview" id="traitDetailOverview">
      <details class="result-disclosure" id="chartDisclosure"><summary>מפת חמש התכונות<span>בחר תכונה בגרף או במקרא כדי לחקור אותה</span></summary><section class="radar-panel" aria-labelledby="radarTitle"><div class="panel-header"><div><span class="overline">התמונה הכללית</span><h2 id="radarTitle">חמש התכונות</h2></div><span class="panel-tag">0–100</span></div><div id="radarChart" class="radar-mount"></div></section></details>
      <div class="big-five-cards-shell" id="bigFiveCardsShell">
        <div class="big-five-cards-head">
          <div class="big-five-cards-titles">
            <span class="eyebrow"><span class="status-dot"></span> פירוט תכונות העל</span>
            <h2 class="section-title">חמש התכונות ותחומי המשנה</h2>
            <p class="body-copy">בשאלוני 120 ו־300 מוצג לכל תכונה גם פיזור 6 תחומי המשנה שלה. פתח תכונה כדי לחקור את הפירוט המלא.</p>
          </div>
          <div class="results-metric-switch" role="group" aria-label="בחירת יחידת תצוגה"><span class="results-metric-label">תצוגת ציונים:</span><div class="results-metric-pills"><button type="button" class="metric-pill active" data-metric="percentile" aria-pressed="true"><span class="metric-pill-title">אחוזון במדגם</span><span class="metric-pill-hint">השוואה למדגם</span></button><button type="button" class="metric-pill" data-metric="score" aria-pressed="false"><span class="metric-pill-title">ציון שאלון (0–100)</span><span class="metric-pill-hint">טווח התשובות</span></button></div><label for="resultsMetric" class="sr-only" hidden>הצגת התכונות ותחומי המשנה</label><select id="resultsMetric" hidden aria-hidden="true"><option value="percentile" selected>אחוזון במדגם</option><option value="score">ציון השאלון / 100</option></select><p id="resultsMetricHelp">אחוזון מתאר מיקום במדגם ההשוואה; ציון 0–100 מתאר את התשובות לשאלון.</p></div>
        </div>
        <div class="results-grid"><div id="domainResults" class="domains" aria-label="חמש התכונות והציונים"></div></div>
      </div>
      <section id="resultsParadoxPreview" class="results-paradox-preview" aria-label="מתחים פנימיים בפרופיל" hidden></section>
      </div>
      <section id="emotionalStabilityCard" class="emotional-stability-card" aria-labelledby="emotionalStabilityTitle" hidden>
        <div class="emotional-stability-head">
          <div>
            <span class="emotional-stability-eyebrow">מבט נוסף על חמש התכונות · Big Five</span>
            <h2 id="emotionalStabilityTitle">יציבות רגשית</h2>
            <p class="emotional-stability-subtitle">ציון רציף המשלים את מדד הרגישות הרגשית (N), ללא אות חמישית.</p>
          </div>
          <div class="emotional-stability-stat" aria-live="off">
            <strong id="emotionalStabilityValue">—</strong><span>מתוך 100</span>
          </div>
        </div>
        <div class="emotional-stability-range" id="emotionalStabilityTrack" role="img" aria-label="מדד יציבות רגשית">
          <span class="emotional-stability-marker" id="emotionalStabilityMarker"></span>
        </div>
        <div class="emotional-stability-endpoints"><span>יציבות נמוכה יותר</span><span>יציבות גבוהה יותר</span></div>
        <p id="emotionalStabilityContext" class="emotional-stability-context"></p>
        <p class="emotional-stability-note">המדד מחושב כהיפוך ציון הרגישות הרגשית בשאלון (<bdi>100 − N</bdi>). הוא אינו מבחן עצמאי לחוסן, להתמודדות עם לחץ או לבריאות נפשית.</p>
        <button type="button" class="emotional-stability-detail secondary" id="emotionalStabilityDetails">לניתוח התכונה ותחומי המשנה</button>
      </section>
      <section id="resultsSaveReminder" class="results-save-reminder" aria-labelledby="resultsSaveReminderTitle">
        <div class="rsr-icon" aria-hidden="true"><svg class="icon rsr-icon-warn" width="22" height="22"><use href="#i-info"/></svg><svg class="icon rsr-icon-done" width="22" height="22"><use href="#i-check"/></svg></div>
        <div class="rsr-body">
          <strong id="resultsSaveReminderTitle" class="rsr-title">התוצאות שמורות רק בדפדפן הזה</strong>
          <p class="rsr-text">אין לנו עותק בשרת. ניקוי הדפדפן, גלישה בסתר או מעבר למכשיר אחר, והן אבדו. כדי לשמור אותן:</p>
          <p class="rsr-done-text"><strong>שמרת עותק.</strong> אפשר לחזור לדוח מהקישור או מהקובץ, גם ממכשיר אחר.</p>
        </div>
        <div class="rsr-actions">
          <button type="button" id="saveReminderCopy" class="primary"><svg class="icon" width="17" height="17" aria-hidden="true"><use href="#i-link"/></svg>העתקת קישור</button>
          <button type="button" id="saveReminderFile" class="secondary"><svg class="icon" width="17" height="17" aria-hidden="true"><use href="#i-download"/></svg>הורדת קובץ</button>
        </div>
      </section>
      <div class="results-file-actions results-actions" aria-label="פעולות על התוצאות">
        <div class="results-action-tiles">
          <button id="resultsDownloadsToggle" class="results-action-tile is-primary" type="button" aria-expanded="false" aria-controls="resultsDownloadsPanel"><svg class="icon" aria-hidden="true"><use href="#i-download"/></svg><span class="results-action-tile-text"><strong>הורדות</strong><small>דוח, תקציר וקבצים</small></span><svg class="icon results-action-chevron" aria-hidden="true"><use href="#i-chevron"/></svg></button>
          <button id="resultsCompareToggle" class="results-action-tile" type="button" aria-expanded="false" aria-controls="resultsComparePanel"><svg class="icon" aria-hidden="true"><use href="#i-users"/></svg><span class="results-action-tile-text"><strong>השוואה</strong><small>למבחן קודם או לאדם אחר</small></span><svg class="icon results-action-chevron" aria-hidden="true"><use href="#i-chevron"/></svg></button>
          <button id="openResultsShareMain" class="results-action-tile results-mobile-only" type="button"><svg class="icon" aria-hidden="true"><use href="#i-link"/></svg><span class="results-action-tile-text"><strong>שמירה ושיתוף</strong><small>קישור, סיסמה או QR</small></span></button>
          <button id="openResultsAiMain" class="results-action-tile results-mobile-only" type="button"><svg class="icon" aria-hidden="true"><use href="#i-spark"/></svg><span class="results-action-tile-text"><strong>שיחה על הדוח</strong><small>שאלות חופשיות ל־AI</small></span></button>
        </div>
        <div id="resultsDownloadsPanel" class="results-action-panel" role="group" aria-label="מה להוריד" hidden>
          <button id="downloadMarkdownMain" class="results-action-option" type="button"><span class="results-action-option-kind">MD</span><span class="results-action-option-text"><strong>הדוח המלא</strong><small>כל מה שמוצג בעמוד, כקובץ טקסט לקריאה או להדבקה בצ'אט</small></span></button>
          <button id="downloadMarkdownSummaryMain" class="results-action-option" type="button"><span class="results-action-option-kind">MD</span><span class="results-action-option-text"><strong>תקציר קצר</strong><small>התכונות העיקריות והממצאים הבולטים בעמוד אחד</small></span></button>
          <button id="downloadPdfMain" class="results-action-option" type="button"><span class="results-action-option-kind">PDF</span><span class="results-action-option-text"><strong>דוח להדפסה</strong><small>הדוח מעוצב להדפסה או לשמירה כ־PDF</small></span></button>
          <button id="downloadResultsMain" class="results-action-option" type="button"><span class="results-action-option-kind">JSON</span><span class="results-action-option-text"><strong>קובץ תוצאות לשמירה</strong><small>לטעינה מחדש באתר, ולהשוואה במבחן הבא</small></span></button>
          <button id="downloadRawQuestionsMain" class="results-action-option" type="button"><span class="results-action-option-kind">JSON</span><span class="results-action-option-text"><strong>השאלות והתשובות</strong><small>כל היגד, התשובה שבחרת והניקוד שלו</small></span></button>
          <button id="downloadCsvMain" class="results-action-option" type="button"><span class="results-action-option-kind">CSV</span><span class="results-action-option-text"><strong>טבלת ציונים</strong><small>35 הציונים והאחוזונים, לאקסל</small></span></button>
        </div>
        <div id="resultsComparePanel" class="results-action-panel" role="group" aria-label="השוואה" hidden>
          <label class="results-action-option file-picker"><input type="file" id="rciCompareInput" accept=".json"><span class="results-action-option-kind"><svg class="icon" aria-hidden="true"><use href="#i-clock"/></svg></span><span class="results-action-option-text"><strong>מול מבחן קודם שלי</strong><small>טעינת קובץ התוצאות מהפעם הקודמת: מה השתנה באמת ומה בטווח הטעות</small></span></label>
          <button id="openPeerCompare" class="results-action-option" type="button"><span class="results-action-option-kind"><svg class="icon" aria-hidden="true"><use href="#i-users"/></svg></span><span class="results-action-option-text"><strong>מול אדם אחר</strong><small>חבר, בן משפחה או שותף: איפה אתם דומים ואיפה שונים</small></span></button>
        </div>
        <p id="resultsFileNote">🔒 הקבצים נוצרים במכשיר שלך ולא נשלחים לשרת. קובץ התוצאות וקובץ השאלות כוללים את התשובות שלך ואינם מוצפנים.</p>
        <p id="resultsFileStatus" role="status" aria-live="polite"></p>
      </div>
      <section id="resultsQuickGuide" class="results-quick-guide" aria-labelledby="resultsQuickGuideTitle"><h2 id="resultsQuickGuideTitle">מבט מהיר על הדוח</h2><p id="resultsQuickGuideText"></p></section>
      <section id="responseValidityCard" class="response-validity-card" aria-label="מדד איכות ועקביות מענה" hidden></section>
      <section id="cyberneticLabCard" class="cybernetic-lab-card" aria-label="10 האספקטים ומנועי ההתנהגות" hidden></section>
      <section id="uppsImpulsivityCard" class="upps-impulsivity-card" aria-label="מודל 4 מדדי האימפולסיביות (UPPS)" hidden></section>
      <section id="interpersonalCircumplexCard" class="interpersonal-circumplex-card" aria-label="המעגל הבינאישי (IPC)" hidden></section>
      <section id="neoStyleGraphsCard" class="neo-style-graphs-card" aria-label="סגנונות חיים (Style Graphs)" hidden></section>
      </section><!-- /.big-five-section -->
      <section class="facet-explorer" id="facetExplorer" aria-labelledby="facetExplorerTitle" hidden>
<header class="facet-explorer-header"><h2 id="facetExplorerTitle">תחומי המשנה לפי תכונה</h2><p>פתח תכונה כדי לראות את ההיבטים שלה. יחידת התצוגה זהה לבחירה בראש הדוח.</p></header>
<div class="facet-explorer-controls">
<label>חיפוש תחום משנה<input type="search" id="facetSearch" placeholder="למשל: סדר, דמיון, אמון…" autocomplete="off"></label>
<label>תכונה<select id="facetDomain"><option value="all">כל חמש התכונות</option><option value="N">רגישות רגשית</option><option value="E">מוחצנות</option><option value="O">פתיחות</option><option value="A">נעימות</option><option value="C">מצפוניות</option></select></label>
<label>סדר<select id="facetOrder"><option value="default">לפי תכונות</option><option value="desc">מהערך הגבוה לנמוך</option><option value="asc">מהערך הנמוך לגבוה</option></select></label>
<button type="button" id="facetToggleAll" class="secondary facet-toggle-all" aria-expanded="false" title="פתיחה או כיווץ של כל תחומי המשנה">הרחב הכל</button>
</div><p id="facetExplorerCount" class="facet-explorer-count" role="status" aria-live="polite"></p><div id="facetExplorerList" class="facet-explorer-list"></div></section>
      <section id="normPanel" class="norm-panel" aria-labelledby="normHeading" hidden>
        <div class="norm-head"><div><span class="eyebrow">השוואה למדגם</span>
          <h2 id="normHeading">איפה הציון שלך ביחס לאחרים?</h2>
          <p id="normIntro">ציון 0–100 מתאר את התשובות שלך; אחוזון משווה למדגם שבו נעשה שימוש בחישוב.</p>
        </div><span class="norm-flag">אחוזונים לפי מדגמי מחקר</span></div>
        <div class="norm-context"><div><strong>קבוצת השוואה</strong><span id="normReference">—</span></div>
          <div><strong>גודל המדגם</strong><span id="normStudySize">—</span></div></div>
        <p id="normStatus" role="status" aria-live="polite">האחוזונים יוצגו עם התוצאות.</p>
        <div id="normSummary" class="norm-summary" aria-label="חמש התכונות באחוזונים"></div>
        <details class="norm-full-disclosure"><summary>כל המדדים: ציונים ואחוזונים</summary><div id="normDetails" class="norm-details"></div></details>
        <details class="norm-method-disclosure"><summary>איך מחושבים הציון והאחוזון?</summary><div class="norm-method-copy">
          <p>תשובה הפוכה מחושבת כ־<bdi>6 − answer</bdi>. הציון 0–100 הוא <bdi>100 × (mean − 1) / 4</bdi>, מעוגל למספר שלם. ממוצע נמוך מ־2.5 מסווג כנמוך, וגבוה מ־3.5 כגבוה.</p>
          <p>האחוזון מחושב ישירות מהמדגם: <bdi id="normFormula">100 × (מספר הציונים הנמוכים + חצי ממספר הציונים השווים) / N</bdi>, ומעוגל למספר שלם.</p>
          <p><strong>מהו ציון תקן T?</strong> ציון T מציג את מיקומך בסולם סטנדרטי שבו ממוצע המדגם נקבע תמיד ל־50, וכל סטיית תקן שווה ל־10 נקודות (ציון 60 פירושו סטיית תקן אחת מעל הממוצע; ציון 40 – סטיית תקן אחת מתחתיו). האחוזון מציג כמה אחוזים מהמשיבים במדגם ההשוואה קיבלו ציון נמוך משלך (מי שקיבל ציון זהה נספר בחצי).</p>
          <p id="normMethodSource">בגרסאות 120 ו־300 קיימים מדגמי השוואה נפרדים. התוצאות מחושבות לפי אורך המבחן שבוצע.</p>
          <p>המדגם מבוסס על משיבים באינטרנט, בעיקר באנגלית. הוא אינו מדגם מייצג של ישראל. התרגום העברי ניסיוני וטרם תוקף.</p>
          <p><a href="https://bigfive-test.com/tests/ipip-neo-120/about" target="_blank" rel="noopener noreferrer">שיטת אתר Big Five</a> · <a href="https://osf.io/tbmh5/" target="_blank" rel="noopener noreferrer">נתוני Johnson</a> · <a id="normDatasetLink" href="./data/empirical-norms.json">טבלאות השכיחויות ומקורן</a> · <a href="./about.html">על המבחן</a></p>
        </div></details>
        <div class="norm-footer"><button id="normExport" class="secondary" type="button">ייצוא 35 הציונים והאחוזונים (CSV)</button>
          <p>החישוב מתבצע במכשיר שלך מול טבלאות שכיחויות מצטברות.</p></div>
      </section>
      <details class="result-disclosure" id="mbtiDisclosure" open><summary>סגנון אישיות משוער (4 אותיות)<span>גשר לארבע אותיות: אומדן מתוך Big Five, ולא אבחון MBTI</span></summary>      <section id="estimatedMbti" class="mbti-section" aria-labelledby="mbtiTitle">
        <div class="mbti-topline"><span class="eyebrow">סגנון אישיות · ארבע אותיות (מנוע v5)</span><span class="mbti-label">אומדן מבני מתוך 30 תחומי המשנה</span></div>
        <div class="mbti-title-row">
          <div>
            <h2 id="mbtiTitle" class="section-title">סגנון ארבע האותיות המשוער שלך</h2>
            <p class="body-copy">שקלול של תחומי המשנה לארבעה צירי העדפה בהשראת MBTI. כל ציר מוצג כרצף עם גבולות אי־ודאות, לצד חלופות קרובות. האחוזים הם הסתברויות לפי הנחות המודל, לא שיעור דיוק שנמדד: אין מדגם שמילא גם את השאלון הזה וגם MBTI. היציבות הרגשית מוצגת בנפרד מתוך Big Five.</p>
          </div>
          <div id="mbtiType" class="mbti-type" dir="ltr" aria-label="סגנון ארבע האותיות המשוער">-----</div>
        </div>
        <div id="mbtiAxes" class="mbti-axes" aria-label="פירוט ארבעת הצירים"></div>
        <p id="mbtiStatus" class="mbti-status"></p>
        <div id="mbtiAdvancedInsights" class="mbti-advanced-insights" aria-label="סגנונות קרובים והתאמה יחסית"></div>
        <div class="mbti-share-cta">
          <button type="button" class="primary mbti-card-share-btn" id="mbtiShareCardBtn" title="הורדת כרטיס תמונה מעוצב של הטיפוס שלך">
            <svg class="icon" width="20" height="20" aria-hidden="true"><use href="#i-chart"/></svg>
            <span>הורדת כרטיס תמונה לשיתוף (סטורי ורשתות)</span>
          </button>
        </div>
        <div class="mbti-science">
          <div class="mbti-research-card">
            <div class="mbti-research-head">
              <span class="mbti-research-tag">סקירה פסיכומטרית · מנוע מבני v5</span>
              <h4>איך מחושב אומדן ארבע האותיות מתוך Big Five?</h4>
              <p class="mbti-research-intro">במנוע <strong>v5</strong> ציוני 30 תחומי המשנה מתוקננים מול מדגמי הייחוס (<bdi>N = 555,764</bdi> ב־120 ו־<bdi>N = 145,388</bdi> ב־300 עם השוואת סולמות Levine), ומשוקללים לפי מתאמי התוכן שפורסמו בספרות מול MBTI (ללא מדגם משותף שמילא את שני השאלונים יחד). אין כאן מדידה ישירה של טיפוסי MBTI, אלא אומדן מודלי עם מהימנות <bdi>Mosier</bdi> וטווח סמך של 95%:</p>
            </div>

            <div class="mbti-research-grid">
              <div class="mbti-stat-card">
                <div class="mbti-stat-header">
                  <span class="mbti-stat-axis">מוחצנות (E / I)</span>
                  <span class="mbti-stat-pct is-strong">מתאם R ≈ 0.71</span>
                </div>
                <div class="mbti-stat-bar"><div class="mbti-stat-fill" style="width: 71%;"></div></div>
                <p class="mbti-stat-note">מתאם ממד יחיד של <strong><bdi>r = 0.74</bdi></strong> (McCrae &amp; Costa, 1989) ומתאם משוקלל של <strong><bdi>R ≈ 0.70–0.71</bdi></strong> (Furnham et al., 2003). משלב חברותיות (<bdi>E2</bdi>), חמימות (<bdi>E1</bdi>), חיוניות (<bdi>E6</bdi>), אסרטיביות (<bdi>E3</bdi>) ונינוחות חברתית (היפוך <bdi>N4</bdi>).</p>
                <div class="mbti-stat-personal" id="mbtiPersonalEI"></div>
              </div>

              <div class="mbti-stat-card">
                <div class="mbti-stat-header">
                  <span class="mbti-stat-axis">פתיחות (N / S)</span>
                  <span class="mbti-stat-pct is-strong">מתאם R ≈ 0.69</span>
                </div>
                <div class="mbti-stat-bar"><div class="mbti-stat-fill" style="width: 69%;"></div></div>
                <p class="mbti-stat-note">מתאם ממד יחיד של <strong><bdi>r = 0.72</bdi></strong> ומתאם משוקלל של <strong><bdi>R ≈ 0.67–0.69</bdi></strong> על תחומי התוכן של פתיחות (<bdi>O1–O5</bdi>, ללא <bdi>O6</bdi>), ועם משקל ייעודי לחשיבה רעיונית (<bdi>O5</bdi>).</p>
                <div class="mbti-stat-personal" id="mbtiPersonalSN"></div>
              </div>

              <div class="mbti-stat-card">
                <div class="mbti-stat-header">
                  <span class="mbti-stat-axis">תכנון וסדר (J / P)</span>
                  <span class="mbti-stat-pct is-moderate">מתאם R ≈ 0.55</span>
                </div>
                <div class="mbti-stat-bar"><div class="mbti-stat-fill is-moderate" style="width: 55%;"></div></div>
                <p class="mbti-stat-note">בממד המצפוניות הכללי המתאם הוא <strong><bdi>r ≈ 0.48–0.49</bdi></strong>, ובשילוב הרב־היבטי (<bdi>C2</bdi> סדר, <bdi>C6</bdi> שיקול דעת, <bdi>C5</bdi> משמעת מול <bdi>O4</bdi> גיוון) עולה ל־<strong><bdi>R ≈ 0.54–0.55</bdi></strong>.</p>
                <div class="mbti-stat-personal" id="mbtiPersonalJP"></div>
              </div>

              <div class="mbti-stat-card">
                <div class="mbti-stat-header">
                  <span class="mbti-stat-axis">קבלת החלטות (F / T)</span>
                  <span class="mbti-stat-pct is-moderate">מתאם R ≈ 0.39</span>
                </div>
                <div class="mbti-stat-bar"><div class="mbti-stat-fill is-moderate" style="width: 39%;"></div></div>
                <p class="mbti-stat-note">הקשר החלש ביותר בין שני המודלים (<strong><bdi>r ≈ 0.44–0.46</bdi></strong> ב־McCrae &amp; Costa; <strong><bdi>R ≈ 0.39</bdi></strong> בטבלת ההיבטים של Furnham, 2003): משקלל חמלה, אמון, קשב רגשי וחום (<bdi>A6, O3, A1, E1, A4, A2, A5, A3</bdi>).</p>
                <div class="mbti-stat-personal" id="mbtiPersonalTF"></div>
              </div>

              <div class="mbti-stat-card mbti-stat-card-total">
                <div class="mbti-stat-header">
                  <span class="mbti-stat-axis"><strong>הסתברות מודל להתאמה ויציבות מדידה (4 צירי MBTI)</strong></span>
                  <span class="mbti-stat-pct is-strong">יציבות מול קריטריון</span>
                </div>
                <p class="mbti-stat-note"><strong>הבחנה חשובה:</strong> יציבות התוצאה בין גרסאות השאלון אינה זהה לתוקף הסיווג מול מבחן MBTI חיצוני. אחוזי ההתאמה הם אומדני מודל ואינם הסתברות אישית מוכחת להיות טיפוס מסוים.</p>
                <div class="mbti-stat-personal mbti-stat-personal-total" id="mbtiPersonalTotal"></div>
              </div>
            </div>

            <div class="mbti-research-sources">
              <span>מקורות מדעיים:</span>
              McCrae &amp; Costa (1989), <em>Journal of Personality</em>, 57(1), 17–40 · Furnham (1996), <em>Pers. &amp; Ind. Diff.</em> · Furnham, Moutafi &amp; Crump (2003) · DeYoung et al. (2007) · Mosier (1943) · Kolen &amp; Brennan (2014).
            </div>
          </div>
          <a href="./about.html#five-letters">איך חישבנו את האותיות?</a>
        </div>
      </section>
</details>
      <section id="continue300" class="continue-300" aria-labelledby="continue300Title" hidden>
        <div class="continue-300-copy">
          <span class="eyebrow">מ־120 ל־300</span>
          <h2 id="continue300Title" class="section-title">רוצה תוצאה מדויקת יותר?</h2>
          <p class="body-copy">120 התשובות שלך כבר נמצאות בשאלון ה־300. נשארו עוד 180 שאלות, ובסופן תקבל 10 היגדים לכל תחום משנה במקום 4 וטווחי סמך צרים יותר. התוצאות של שאלון 120 נשמרות כמו שהן.</p>
        </div>
        <button id="continueTo300" class="primary" type="button">להמשיך לשאלון 300 · עוד 180 שאלות</button>
      </section>
      <section id="additionalQuizzesSection" class="additional-quizzes-section" aria-labelledby="additionalQuizzesTitle">
        <div class="additional-quizzes-header">
          <div>
            <span class="eyebrow">🧩 מילוי שאלונים משלימים · הרחבה ממוקדת</span>
            <h2 id="additionalQuizzesTitle" class="section-title">שאלונים נוספים מומלצים</h2>
            <p class="body-copy">שאלון ה-Big Five (IPIP-NEO) מעניק תשתית של כ־74%–85% ממיפוי האישיות. כאן תוכל להשלים בנפרד ובצורה מסודרת את הממדים שהמחקר הפסיכומטרי מזהה כבעלי תרומה ייחודית מעבר לחמש התכונות — חוזקות אופי (בהשראת IPIP-VIA-R), סגנון היקשרות (ECR-RS), וציר הכנות והענווה (HEXACO-H).</p>
          </div>
        </div>
        <div id="additionalQuizzesHub" class="supp-hub-grid"></div>
        <div id="additionalQuizzesResults" class="additional-quizzes-results">
          <section id="viaStrengthsCard" class="via-strengths-card" aria-label="24 חוזקות האופי ו-3 כוחות העל" hidden></section>
          <section id="ecrrsAttachmentCard" class="ecrrs-attachment-card" aria-label="סגנון היקשרות במערכות יחסים (ECR-RS)" hidden></section>
          <section id="hexacoHonestyCard" class="hexaco-honesty-card" aria-label="מדד כנות וענווה מתוך מודל HEXACO" hidden></section>
        </div>
      </section>
      <p class="result-metric-note"><svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-info"/></svg> <span id="resultMetricDescription">הציון 0–100 מתאר את טווח התשובות; אחוזון משווה למדגם המתאים לגרסת השאלון.</span></p>
      <button id="askAiResults" type="button" hidden aria-hidden="true"></button>
      <div class="notice"><svg width="20" height="20" class="icon" aria-hidden="true"><use href="#i-info"/></svg><span><strong>חשוב:</strong> זו דרך להכיר את עצמך, לא אבחון מקצועי.</span></div>

      <!-- Results Report Footer: Utility Hub & Wrap-up -->
      <footer class="results-report-footer" id="resultsReportFooter" aria-label="ניהול התוצאות וסיום הדוח">
        <div class="results-footer-head">
          <div class="results-footer-titles">
            <span class="eyebrow"><span class="status-dot"></span> סיום הדוח וניהול התוצאות</span>
            <h2 class="section-title">כל הכלים לדוח שלך</h2>
            <p class="body-copy">הורדה, שיתוף, ייצוא נתונים גולמיים וכלים לחקירה נוספת — הכל נשמר במכשירך בלבד.</p>
          </div>
          <div class="results-footer-primary-actions">
            <button type="button" id="resultsFooterBackToTop" class="primary" title="חזרה לתחילת הדוח">
              <svg width="18" height="18" class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              <span>חזרה לראש הדוח</span>
            </button>
            <button type="button" id="resultsFooterDownloadRaw" class="secondary" title="הורדת שאלות ותשובות בפורמט JSON RAW">
              <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-download"/></svg>
              <span>גיבוי שאלות ותשובות</span>
            </button>
            <button type="button" id="resultsFooterDownloadResults" class="secondary" title="הורדת קובץ תוצאות JSON">
              <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-download"/></svg>
              <span>גיבוי הדוח</span>
            </button>
            <button type="button" id="resultsFooterDownloadMarkdown" class="secondary" title="דוח טקסט מלא: כל מה שמוצג בדוח">
              <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-download"/></svg>
              <span>דוח טקסט מלא</span>
            </button>
            <button type="button" id="resultsFooterDownloadMarkdownSummary" class="secondary" title="תקציר טקסט של עמוד או שניים">
              <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-download"/></svg>
              <span>תקציר טקסט</span>
            </button>
          </div>
        </div>

        <div class="results-footer-tools-grid">
          <div class="results-tool-card">
            <div class="results-tool-icon"><svg width="22" height="22" class="icon" aria-hidden="true"><use href="#i-shield"/></svg></div>
            <div class="results-tool-body">
              <h3>שמירה ושיתוף מאובטח</h3>
              <p>העתקת קישור לשחזור, שמירה מוצפנת בסיסמה, כרטיס תמונה לסטורי או יצירת קוד QR.</p>
            </div>
            <button type="button" id="resultsFooterShare" class="secondary results-tool-btn">שמירה ושיתוף</button>
          </div>

          <div class="results-tool-card">
            <div class="results-tool-icon"><svg width="22" height="22" class="icon" aria-hidden="true"><use href="#i-spark"/></svg></div>
            <div class="results-tool-body">
              <h3>שיחה עם ofiLab AI</h3>
              <p>ניתוח מעמיק של התכונות, הסבר מתחים פנימיים ותובנות אישיות מבוססות מחקר.</p>
            </div>
            <button type="button" id="resultsFooterAi" class="secondary results-tool-btn">שיחה על הדוח</button>
          </div>

          <div class="results-tool-card">
            <div class="results-tool-icon"><svg width="22" height="22" class="icon" aria-hidden="true"><use href="#i-layers"/></svg></div>
            <div class="results-tool-body">
              <h3>סקירה ועריכת תשובות</h3>
              <p>רוצה לבדוק או לתקן שאלה מסוימת? אפשר לערוך כל היגד והציונים יתעדכנו מיד.</p>
            </div>
            <button type="button" id="resultsFooterReview" class="secondary results-tool-btn">עריכת תשובות</button>
          </div>

          <div class="results-tool-card">
            <div class="results-tool-icon"><svg width="22" height="22" class="icon" aria-hidden="true"><use href="#i-chart"/></svg></div>
            <div class="results-tool-body">
              <h3>ייצוא ציונים (CSV) ודוח PDF</h3>
              <p>הורדת טבלת 35 הציונים והאחוזונים לקובץ אקסל או יצירת דוח מסודר להדפסה.</p>
            </div>
            <div class="results-tool-dual-actions">
              <button type="button" id="resultsFooterExportCsv" class="secondary results-tool-mini-btn">ייצוא CSV</button>
              <button type="button" id="resultsFooterPrint" class="secondary results-tool-mini-btn">דוח PDF</button>
            </div>
          </div>
        </div>

        <div class="results-footer-trust-banner">
          <div class="results-trust-item">
            <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-shield"/></svg>
            <div>
              <strong>חישוב במכשיר, בלי חשבון</strong>
              <span>הציונים מחושבים בדפדפן ואין לאתר מסד נתונים של תשובות. האתר אינו משתמש ב־Cookies: גיבוי ההתקדמות נשמר רק במכשיר שלך ואינו נשלח לשרת. שמירה בסיסמה מצפינה גם את העותק שבמכשיר.</span>
            </div>
          </div>
          <div class="results-trust-item">
            <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-chart"/></svg>
            <div>
              <strong>שקיפות מדעית (IPIP-NEO)</strong>
              <span>מבוסס על שאלון Goldberg ו־Johnson (2014) עם נורמות אמפיריות גלויות.</span>
            </div>
          </div>
          <div class="results-trust-item">
            <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-info"/></svg>
            <div>
              <strong>שימוש אישי ולימודי</strong>
              <span>כלי להכרות עצמית והעמקה אישית; אינו מהווה אבחון קליני או פסיכולוגי.</span>
            </div>
          </div>
        </div>

        <div class="results-footer-bottom-bar">
          <div class="results-footer-nav-links">
            <span class="results-footer-nav-label">ניווט מהיר בדוח:</span>
            <button type="button" data-scroll="traitOverview" class="results-footer-nav-link">חמש התכונות</button>
            <button type="button" data-scroll="facetExplorer" class="results-footer-nav-link">תחומי המשנה</button>
            <button type="button" data-scroll="normPanel" class="results-footer-nav-link">השוואה למדגם</button>
            <button type="button" data-scroll="mbtiDisclosure" class="results-footer-nav-link">סגנון 4 אותיות</button>
          </div>
          <button type="button" id="resultsFooterRestart" class="ghost results-footer-restart-btn">
            <svg width="16" height="16" class="icon" aria-hidden="true"><use href="#i-restart"/></svg>
            <span>התחלת שאלון מחדש</span>
          </button>
        </div>
      </footer>
      </div><!-- /.results-main-content -->
      </div><!-- /.results-layout -->
    </section>
    <div id="errorBox" class="error hidden" role="alert"></div>
  </main>
  <script>
  (() => {
    document.getElementById('resultsSaveFab')?.addEventListener('click',()=>{
      document.getElementById('resultsShareTop')?.click();
    });
    document.querySelectorAll('[data-report-action]').forEach(button=>{
      button.addEventListener('click',()=>document.getElementById(button.dataset.reportAction)?.click());
    });
  })();
  </script>
  <!-- Actions previously duplicated at the end of the report now live
       in one accessible share hub, opened from the sticky top header. -->
  <dialog id="resultsShareDialog" class="results-share-dialog" aria-labelledby="resultsShareTitle" aria-describedby="resultsShareLead">
    <div class="results-share-shell" dir="rtl">
      <header class="results-share-head">
        <div class="results-share-head-copy">
          <div class="ofi-share-brand"><img src="./assets/logo-mark.png" alt="" width="34" height="34" decoding="async"><span class="results-share-kicker">ofiLab · התוצאות שלך</span></div>
          <h2 id="resultsShareTitle">שמירה ושיתוף</h2>
          <p id="resultsShareLead">שמרו קישור או קובץ גיבוי כדי לחזור לדוח גם אחרי ניקוי הדפדפן או ממכשיר אחר. אין אצלנו עותק לשחזור.</p>
        </div>
        <button id="closeResultsShare" class="results-share-close" type="button" aria-label="סגירת אפשרויות השיתוף"><svg class="icon" width="19" height="19" aria-hidden="true"><use href="#i-close"/></svg></button>
      </header>
      <div class="results-share-body">
        <div class="results-share-section-label">מומלץ לשמירה</div>
        <div class="results-share-options results-share-options-primary">
          <button id="copyResults" class="results-share-option results-share-option-featured" type="button">
            <span class="results-share-option-icon"><svg class="icon" width="23" height="23" aria-hidden="true"><use href="#i-link"/></svg></span>
            <span class="results-share-option-copy"><strong>קישור לשמירת התוצאות</strong><small>העתקת קישור לשחזור המבחן והתוצאות</small></span>
          </button>
          <button id="printReport" class="results-share-option results-share-option-featured" type="button">
            <span class="results-share-option-icon"><svg class="icon" width="23" height="23" aria-hidden="true"><use href="#i-download"/></svg></span>
            <span class="results-share-option-copy"><strong>דוח PDF</strong><small>דוח מסודר להדפסה ולשמירה</small></span>
          </button>
        </div>
        <div class="results-share-section-label">אפשרויות נוספות</div>
        <div class="results-share-options results-share-options-more">
          <button id="protectSaveResults" class="results-share-option secure-save-trigger" type="button">
            <span class="results-share-option-icon"><svg class="icon" width="23" height="23" aria-hidden="true"><use href="#i-lock"/></svg></span>
            <span class="results-share-option-copy"><strong>שמירה מוצפנת בסיסמה</strong><small>הגנה על התשובות בקישור מוצפן</small></span>
          </button>
          <button id="openResultsQr" class="results-share-option" type="button" aria-haspopup="dialog" aria-controls="resultsQrDialog">
            <span class="results-share-option-icon"><svg class="icon" width="23" height="23" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M15 14h2v2h-2zM20 14v3M20 20h-3M14 20v1"/></svg></span>
            <span class="results-share-option-copy"><strong>קוד QR לשחזור</strong><small>סריקה במכשיר אחר, בלי מסד נתונים</small></span>
          </button>
          <button id="nativeShareResultsLink" class="results-share-option" type="button">
            <span class="results-share-option-icon"><svg class="icon" width="23" height="23" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m7 11 9-5M7 13l9 5"/></svg></span>
            <span class="results-share-option-copy"><strong>שיתוף קישור</strong><small>תפריט השיתוף בטלפון, או העתקה</small></span>
          </button>
          <button id="openShareCard" class="results-share-option" type="button">
            <span class="results-share-option-icon"><svg class="icon" width="24" height="24" aria-hidden="true"><use href="#i-chart"/></svg></span>
            <span class="results-share-option-copy"><strong>כרטיס תמונה לשיתוף</strong><small>תמונה מעוצבת לסטורי או לשיתוף</small></span>
          </button>
          <button id="downloadResults" class="results-share-option" type="button">
            <span class="results-share-option-icon"><svg class="icon" width="23" height="23" aria-hidden="true"><use href="#i-download"/></svg></span>
            <span class="results-share-option-copy"><strong>קובץ גיבוי לדוח</strong><small>כולל תשובות לטעינה חוזרת ב־ofiLab · JSON</small></span>
          </button>
        </div>
        <div class="results-share-note"><svg class="icon" width="16" height="16" aria-hidden="true"><use href="#i-info"/></svg><p>קישור ו־QR רגילים כוללים את התשובות ואינם מוצפנים. להגנה, הפעל קודם שמירה בסיסמה; את הסיסמה יש לשמור ולמסור בנפרד. תמונה ו־PDF אינם כוללים תשובות בודדות.</p></div>
        <details class="results-share-more">
          <summary>ניהול התוצאות <span aria-hidden="true">⌄</span></summary>
          <div class="results-share-utilities">
            <button type="button" id="downloadRawQuestions"><svg class="icon" width="19" height="19" aria-hidden="true"><use href="#i-download"/></svg>גיבוי שאלות ותשובות</button>
            <button type="button" id="reviewResults"><svg class="icon" width="19" height="19" aria-hidden="true"><use href="#i-layers"/></svg>עריכת תשובות</button>
            <button type="button" id="restartResults" class="results-share-danger"><svg class="icon" width="19" height="19" aria-hidden="true"><use href="#i-restart"/></svg>מבחן חדש</button>
          </div>
        </details>
      </div>
    </div>
  </dialog>
  <script>
  (() => {
    const popup=document.getElementById('resultsShareDialog');
    const trigger=document.getElementById('resultsShareTop');
    const closeButton=document.getElementById('closeResultsShare');
    if(!popup||!trigger||!closeButton)return;
    const close=()=>{if(popup.open)popup.close();};
    trigger.addEventListener('click',()=>{
      if(document.documentElement.dataset.stage!=='results'||popup.open)return;
      const more=popup.querySelector('.results-share-more');
      if(more)more.open=false;
      popup.showModal();
      trigger.setAttribute('aria-expanded','true');
    });
    closeButton.addEventListener('click',close);
    popup.addEventListener('close',()=>trigger.setAttribute('aria-expanded','false'));
    popup.addEventListener('click',event=>{
      /* Close before another dialog (preview, password or review) opens,
         preserving the existing working handlers on the moved buttons. */
      if(event.target.closest('.results-share-option,.results-share-utilities button'))close();
    },true);
    let outsideDown=false;
    popup.addEventListener('pointerdown',event=>{
      const r=popup.getBoundingClientRect();
      outsideDown=event.target===popup&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);
    });
    popup.addEventListener('click',event=>{
      if(outsideDown&&event.target===popup)close();
      outsideDown=false;
    });
    trigger.setAttribute('aria-expanded','false');
  })();
  </script>
  <dialog id="resultsQrDialog" class="results-qr-dialog" aria-labelledby="resultsQrTitle" aria-describedby="resultsQrIntro">
    <div class="results-qr-shell" dir="rtl">
      <header class="results-qr-head">
        <div><span class="results-qr-kicker">ofiLab · שמירה ללא חשבון</span>
          <h2 id="resultsQrTitle">סריקה ושחזור במכשיר אחר</h2>
          <p id="resultsQrIntro">סרוק את הקוד במצלמת הטלפון לפתיחת קישור השחזור.</p>
        </div>
        <button type="button" id="closeResultsQr" class="results-qr-close" aria-label="סגירת קוד QR">×</button>
      </header>
      <div class="results-qr-body">
        <div class="results-qr-canvas-frame">
          <canvas id="resultsQrCanvas" role="img" aria-label="קוד QR המכיל את קישור השחזור של המבחן"></canvas>
        </div>
        <p id="resultsQrSecurity" class="results-qr-security"></p>
        <label for="resultsQrLink" class="results-qr-label">קישור השחזור
          <input id="resultsQrLink" type="text" dir="ltr" readonly autocomplete="off" spellcheck="false" aria-label="קישור השחזור להעתקה" />
        </label>
        <div class="results-qr-actions">
          <button type="button" id="copyResultsQrLink"><svg class="icon" width="17" height="17" aria-hidden="true"><use href="#i-link"/></svg>העתקת קישור</button>
          <button type="button" id="downloadResultsQr"><svg class="icon" width="17" height="17" aria-hidden="true"><use href="#i-download"/></svg>שמירת QR כתמונה</button>
        </div>
        <p id="resultsQrStatus" role="status" aria-live="polite" class="results-qr-status"></p>
      </div>
    </div>
  </dialog>
<dialog id="rciCompareDialog" class="ofi-modal" aria-labelledby="rciCompareTitle">
  <div class="ofi-modal-container ofi-modal-container--wide">
    <header class="ofi-modal-header">
      <h2 id="rciCompareTitle" class="ofi-modal-title">השוואה למבחן קודם (Reliable Change Index)</h2>
      <button id="closeRciCompare" class="ofi-modal-close" aria-label="סגירת חלון ההשוואה"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>
    </header>
    <div class="ofi-modal-body">
      <p>השוואה סטטיסטית בין התוצאות הנוכחיות לתוצאות העבר לפי שגיאת המדידה הקלאסית (SEM), עם תיקון Holm–Bonferroni לחמש התכונות הראשיות ופירוט תומך לתחומי המשנה.</p>
      <div id="rciCompareResults" class="rci-compare-results">
        <!-- Comparison rows will be injected here -->
      </div>
    </div>
  </div>
</dialog>
<dialog id="peerCompareDialog" class="ofi-modal peer-compare-dialog" aria-labelledby="peerCompareTitle">
  <div class="ofi-modal-container ofi-modal-container--wide">
    <header class="ofi-modal-header">
      <h2 id="peerCompareTitle" class="ofi-modal-title">השוואה לאדם אחר</h2>
      <button id="closePeerCompare" type="button" class="ofi-modal-close" aria-label="סגירת ההשוואה"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>
    </header>
    <div class="ofi-modal-body">
      <form id="peerCompareForm" class="peer-form" autocomplete="off" novalidate>
        <p class="peer-lead">בקשו מהאדם השני לשלוח לכם את קישור השמירה שלו (בכפתור "שמירה ושיתוף") או את קובץ התוצאות שלו. ההשוואה מחושבת במכשיר הזה בלבד, ושום דבר לא נשמר ולא נשלח.</p>
        <div class="peer-field">
          <label for="peerName">איך לקרוא לו/ה בהשוואה? <small>(לא חובה)</small></label>
          <input id="peerName" type="text" maxlength="24" placeholder="למשל: יוסי">
        </div>
        <div class="peer-field">
          <label for="peerLink">הקישור של האדם השני</label>
          <input id="peerLink" type="text" dir="ltr" inputmode="url" spellcheck="false" placeholder="https://ofilab.avrahamd.ovh/#p=…">
        </div>
        <div class="peer-or" aria-hidden="true"><span>או</span></div>
        <div class="peer-field peer-file-row">
          <label class="peer-file"><input type="file" id="peerFile" accept=".json,application/json"><svg class="icon" aria-hidden="true"><use href="#i-upload"/></svg><span>בחירת קובץ תוצאות (JSON)</span></label>
          <span id="peerFileName" class="peer-file-name" dir="ltr"></span>
        </div>
        <div id="peerPasswordRow" class="peer-field" hidden>
          <label for="peerPassword">הנתונים מוצפנים. הסיסמה שקיבלתם:</label>
          <input id="peerPassword" type="password" autocomplete="off">
        </div>
        <p id="peerError" class="peer-error" role="alert" hidden></p>
        <button type="submit" class="primary peer-submit" id="peerSubmit">השוואה</button>
      </form>
      <div id="peerResult" class="peer-result" aria-live="polite" hidden></div>
    </div>
  </div>
</dialog>
<dialog id="shareCardDialog" class="keepsake-dialog" aria-labelledby="shareCardTitle">
    <div class="keepsake-dialog-head"><div><span class="eyebrow">המפה שלך, בדרך שלך</span><h2 id="shareCardTitle">כרטיס לשיתוף</h2></div><button type="button" id="closeShareCard" class="review-close" aria-label="סגירת כרטיס השיתוף">×</button></div>
    <label class="share-format">גודל התמונה<select id="shareCardFormat"><option value="story">סטורי · 1080 × 1920</option><option value="square">ריבוע · 1080 × 1080</option><option value="wide">לרוחב · 1200 × 630</option></select></label>
    <div class="share-preview"><canvas id="shareCardCanvas" aria-label="תצוגה מקדימה של כרטיס חמש התכונות" role="img"></canvas></div>
    <p class="fine">הכרטיס מכיל חמישה ציונים ומשפט קצר לפי התכונה הבולטת בפרופיל שלך. אין בו תשובות או קישור לתשובות. השיתוף לבחירתך.</p>
    <p id="shareCardStatus" class="fine" role="status" aria-live="polite"></p>
    <div class="actions"><button type="button" id="downloadShareCard" class="primary" disabled>הורדת PNG</button><button type="button" id="nativeShareCard" class="secondary" hidden>שיתוף תמונה</button></div>
  </dialog>
  <div id="printableReport" class="printable-report"></div>
  <dialog id="questionHelpPanel" class="mindful-help" aria-labelledby="questionHelpTitle" aria-describedby="questionHelpText">
    <div class="mindful-help-content">
      <div class="mindful-help-header">
        <h2 id="questionHelpTitle" tabindex="-1">הסבר לשאלה</h2>
        <button type="button" id="closeQuestionHelp" class="mindful-help-close" aria-label="סגירת ההסבר">×</button>
      </div>
      <p id="questionHelpStatement" class="mindful-help-statement"></p>
      <p id="questionHelpText" class="mindful-help-text"></p>
      <p class="mindful-help-note">חשוב על עצמך בדרך כלל, לא רק על מקרה אחד.</p>
      <button type="button" id="questionHelpDone" class="primary mindful-help-done">חזרה לשאלה</button>
    </div>
  </dialog>
  <dialog id="reviewDialog" class="review-dialog" aria-labelledby="reviewTitle" aria-describedby="reviewSubtitle">
    <div class="review-shell">
      <header class="review-header">
        <div><span class="eyebrow"><span class="status-dot"></span> רוצה לשנות משהו?</span>
          <h2 id="reviewTitle">כל התשובות שלך</h2>
          <p id="reviewSubtitle">אפשר למצוא כל שאלה ולשנות את התשובה שלה. השינויים נשמרים מיד.</p>
        </div>
        <button type="button" id="closeReview" class="review-close" aria-label="סגירת סקירת התשובות">×</button>
      </header>
      <div class="review-toolbar">
        <label class="review-search-label" for="reviewSearch">חיפוש שאלה
          <input id="reviewSearch" type="search" autocomplete="off" placeholder="מה אתה מחפש?" />
        </label>
        <label class="review-filter-label" for="reviewFilter">הצגת שאלות
          <select id="reviewFilter">
            <option value="all">כל השאלות</option>
            <option value="unanswered">ללא תשובה</option>
            <option value="answered">נענו</option>
          </select>
        </label>
      </div>
      <div class="review-progressbar"><div id="reviewProgressFill"></div></div>
      <p id="reviewStatus" class="review-status" role="status" aria-live="polite"></p>
      <div class="review-scale-guide" aria-label="סולם התשובות"><span>1 · בכלל לא מתאר</span><span>2 · מעט</span><span>3 · בינוני</span><span>4 · במידה רבה</span><span>5 · מאוד</span></div>
      <div id="reviewList" class="review-list" aria-label="רשימת ההיגדים לעריכה"></div>
      <footer class="review-footer"><span>כל שינוי נשמר אוטומטית.</span><button id="reviewDone" class="primary" type="button">סיום</button></footer>
    </div>
  </dialog>
  <dialog id="aiDialog" class="ai-dialog" aria-labelledby="aiDialogTitle" aria-describedby="aiDialogSubtitle">
    <div class="ai-dialog-shell">
      <header class="ai-dialog-head">
        <div class="ai-head-brand">
          <div class="ai-avatar" aria-hidden="true"><span>AI</span></div>
          <div class="ai-head-titles">
            <div class="ai-head-topline"><img class="ofi-ai-brand" src="./assets/logo-mark.png" alt="" width="22" height="22" decoding="async"><span>ofiLab AI</span><span class="ai-beta-indicator">BETA</span></div>
            <h2 id="aiDialogTitle">שיחה על התוצאות</h2>
            <p id="aiDialogSubtitle" class="sr-only">עזרה מותאמת למבחן שלך</p>
            <div class="ai-context" id="aiContext" role="group" aria-label="הנושא של השיחה">
              <span class="ai-context-eyebrow" id="aiContextEyebrow">התוצאות שלך</span>
              <strong id="aiContextText">5 תכונות · 30 תחומים קטנים</strong>
            </div>
          </div>
        </div>
        <div class="ai-header-actions">
          <button type="button" id="aiRestartChat" class="ai-icon-button" title="שיחה חדשה" aria-label="התחלת שיחה חדשה">
            <svg width="19" height="19" class="icon" aria-hidden="true"><use href="#i-restart"/></svg>
          </button>
          <button type="button" id="aiClose" class="ai-icon-button ai-icon-close" aria-label="סגירת השיחה">×</button>
        </div>
      </header>
      <div id="aiChatMessages" class="ai-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
      <p class="ai-privacy-note">🔒 פרטיות: תוכן השיחה מועבר לעיבוד במודל שפה חיצוני לצורך מתן מענה. נתוני השאלון עצמם נשמרים במכשיר שלך בלבד.</p>
      <details class="ai-suggestion-fold" id="aiSuggestionDetails"><summary>רעיונות לשאלות</summary><div id="aiSuggestions" class="ai-suggestions" aria-label="רעיונות לשאלות"></div></details>
      <form id="aiChatForm" class="ai-chat-form" autocomplete="off">
        <div class="ai-composer">
          <label class="sr-only" for="aiChatInput">שאלה לעוזר</label>
          <textarea id="aiChatInput" rows="1" maxlength="700" placeholder="מה היית רוצה להבין?"></textarea>
          <button type="submit" id="aiSendBtn" class="ai-send-button" title="שליחה" aria-label="שליחת הודעה">
            <svg width="19" height="19" class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>
          </button>
        </div>
        <div class="ai-chat-controls">
          <span id="aiChatStatus" role="status" aria-live="polite">צ'אט AI · מספר פניות מוגבל</span>
          <span class="ai-char-count" id="aiCharCount">0/700</span>
        </div>
        <div class="ai-consent-notice" role="note" aria-label="פרטיות ואבטחה">
          <span class="ai-consent-pill">
            <svg width="13" height="13" class="icon" aria-hidden="true"><use href="#i-shield"/></svg>
            <span>השיחה מעובדת במודל ה־AI הנבחר · נתוני השאלון נשמרים במכשירך בלבד</span>
            <span class="ai-consent-dot" aria-hidden="true">•</span>
            <a href="./about.html" target="_blank" rel="noopener" id="aiDataNotice">מידע על אבטחה ופרטיות</a>
          </span>
        </div>
      </form>
      <div class="ai-dialog-footer"><svg width="13" height="13" class="icon" aria-hidden="true"><use href="#i-info"/></svg><span>ה־AI נועד להסביר, לא להחליט בשבילך.</span></div>
    </div>
  </dialog>
  <footer class="page-footer calm-quiet-footer ofi-site-footer" aria-label="קישורי האתר">
  <div class="ofi-footer-inner">
    <div class="ofi-footer-main">
      <div class="footer-brand-stack ofi-footer-brand">
        <a class="footer-ofilab" href="./" aria-label="ofiLab — חזרה לדף הבית">
          <img src="./assets/logo-mark.png" alt="" width="40" height="40" decoding="async">
          <span><strong dir="ltr">ofiLab</strong><small>מעבדת האישיות</small></span>
        </a>
        <p class="ofi-footer-tagline">שאלוני Big Five בעברית, עם השוואה למדגמים של מאות אלפי משיבים. החישוב כולו נעשה בדפדפן, והתשובות לא נשלחות לשרת.</p>
        <div class="ofi-footer-cta">
          <a class="ofi-footer-btn" href="./" data-inventory="120"><strong>שאלון 120</strong><small>היכרות מהירה</small></a>
          <a class="ofi-footer-btn" href="./?len=300" data-inventory="300"><strong>שאלון 300</strong><small>תמונה מעמיקה</small></a>
        </div>
      </div>
      <nav class="ofi-footer-col" aria-labelledby="footerSiteTitle">
        <p class="ofi-footer-title" id="footerSiteTitle">האתר</p>
        <ul class="ofi-footer-links">
          <li><a href="./about.html">אודות והשיטה</a></li>
          <li><a href="./about.html#privacy-crypto">פרטיות והצפנה</a></li>
          <li><a href="./about.html#instruments">השאלונים והמקורות</a></li>
        </ul>
      </nav>
      <nav class="ofi-footer-col" aria-labelledby="footerSourceTitle">
        <p class="ofi-footer-title" id="footerSourceTitle">קוד המקור</p>
        <ul class="ofi-footer-links">
          <li><a href="https://github.com/avraham-d/OfiLab" target="_blank" rel="noopener noreferrer" aria-label="קוד המקור ב־GitHub (נפתח בחלון חדש)"><svg class="ofi-footer-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>GitHub</a></li>
          <li><a href="https://github.com/avraham-d/OfiLab/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">רישיון שימוש</a></li>
          <li class="ofi-footer-note">קוד מקור גלוי, לשימוש שלא למטרת רווח</li>
        </ul>
      </nav>
      <nav class="ofi-footer-col" aria-labelledby="footerSupportTitle">
        <p class="ofi-footer-title" id="footerSupportTitle">תמיכה והקשבה</p>
        <ul class="ofi-footer-links">
          <li><a href="https://www.eran.org.il/online-emotional-help/" target="_blank" rel="noopener noreferrer" aria-label="ער״ן, 1201 — מעבר לאתר סיוע חיצוני">ער״ן · 1201</a></li>
          <li><a href="https://sahar.org.il/" target="_blank" rel="noopener noreferrer" aria-label="סה״ר — מעבר לאתר סיוע חיצוני">סה״ר · סיוע ברשת</a></li>
          <li class="ofi-footer-note">אם קשה עכשיו, אפשר לדבר עם מישהו.</li>
        </ul>
      </nav>
    </div>
    <div class="ofi-footer-bottom">
      <p>© <?= date('Y') ?> <span dir="ltr">ofiLab</span>. השאלון נועד להיכרות עצמית ואינו מחליף אבחון של איש מקצוע.</p>
      <a class="ofi-footer-avd" href="https://avrahamd.ovh/" target="_blank" rel="noopener noreferrer" aria-label="AVD, מעבר לאתר avrahamd.ovh"><span dir="ltr">AVD · avrahamd.ovh</span></a>
    </div>
  </div>
</footer>
  <div class="toast hidden" id="toast" role="status" aria-live="polite"></div>
    <!-- Settings Dialog (Modal Popup) -->
  <dialog id="settingsDialog" class="settings-dialog" aria-labelledby="settingsDialogTitle">
    <div class="settings-dialog-shell">
      <div class="settings-dialog-head">
        <div class="settings-head-brand">
          <div class="settings-mark" aria-hidden="true">
            <svg width="22" height="22" class="icon"><use href="#i-settings"/></svg>
          </div>
          <div>
            <h2 id="settingsDialogTitle">הגדרות המבחן</h2>
            <p class="settings-subtitle">התאמת קצב, מעבר שאלות ושמירה</p>
          </div>
        </div>
        <button type="button" class="settings-close-btn" id="closeSettingsBtn" aria-label="סגירת חלון הגדרות">
          <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-close"/></svg>
        </button>
      </div>

      <div class="settings-dialog-body">
        <!-- 1. Pace and Navigation -->
        <section class="settings-group" aria-labelledby="headingPace">
          <div class="settings-group-header">
            <span class="settings-icon-mini"><svg width="16" height="16" class="icon"><use href="#i-clock"/></svg></span>
            <h3 id="headingPace">קצב ומעבר שאלות</h3>
            <span class="pace-default-tag">מהיר ונוח</span>
          </div>
          <div class="settings-card">
            <label class="settings-toggle-row">
              <div class="settings-toggle-text">
                <strong>מעבר אוטומטי אחרי בחירה</strong>
                <span>השאלה הבאה תיפתח מיד לאחר בחירת תשובה</span>
              </div>
              <input type="checkbox" id="autoAdvance" class="settings-switch" checked/>
            </label>

            <div class="settings-subrow" id="speedSettingWrap">
              <label for="autoAdvanceSpeed" class="settings-label">מהירות מעבר לשאלה הבאה</label>
              <select id="autoAdvanceSpeed" class="settings-select" aria-label="השהיית מעבר אוטומטי">
                <option value="280">מיידי · 0.28 שניות</option>
                <option value="480" selected>מהיר · 0.48 שניות (מומלץ)</option>
                <option value="750">רגיל · 0.75 שניות</option>
                <option value="1200">רגוע · 1.2 שניות</option>
              </select>
            </div>

            <label class="settings-toggle-row">
              <div class="settings-toggle-text">
                <strong>קיצורי מקלדת</strong>
                <span>המקשים 1–5 לבחירת תשובה, והחיצים לניווט קדימה ואחורה</span>
              </div>
              <input type="checkbox" id="keyboardShortcuts" class="settings-switch" checked/>
            </label>

            <p class="settings-hint">פתיחת הסבר, צ'אט AI, עריכת תשובות או מעבר ללשונית אחרת עוצרת מעבר אוטומטי ממתין. ההגדרות נשמרות בדפדפן.</p>
          </div>
        </section>

        <!-- 2. Save & Privacy -->
        <section class="settings-group" aria-labelledby="headingSave">
          <div class="settings-group-header">
            <span class="settings-icon-mini"><svg width="16" height="16" class="icon"><use href="#i-shield"/></svg></span>
            <h3 id="headingSave">שמירה ופרטיות</h3>
          </div>
          <div class="settings-card">
            <p class="settings-hint">ההתקדמות נשמרת אוטומטית במכשיר שלך בלבד. ניתן לקבל קישור אישי להמשך מכל מכשיר או להצפין בסיסמה.</p>
            <div class="settings-actions-grid">
              <button id="saveBtn" type="button" class="settings-action-btn ghost">
                <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-link"/></svg>
                <span>שמירת קישור להמשך</span>
              </button>
              <button id="protectSaveQuiz" type="button" class="settings-action-btn secondary secure-save-trigger">
                <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-shield"/></svg>
                <span>שמירה מוצפנת בסיסמה</span>
              </button>
            </div>
          </div>
        </section>

        <!-- 3. Questionnaire Version & Review -->
        <section class="settings-group" aria-labelledby="headingVersion">
          <div class="settings-group-header">
            <span class="settings-icon-mini"><svg width="16" height="16" class="icon"><use href="#i-layers"/></svg></span>
            <h3 id="headingVersion">גרסת שאלון ועריכת תשובות</h3>
          </div>
          <div class="settings-card">
            <div>
              <span class="settings-label">אורך השאלון:</span>
              <div class="settings-version-tabs" id="settingsVersionTabs">
                <button type="button" class="version-tab" data-ver="120">
                  <strong>120</strong>
                  <small>המרכזי · מומלץ (10–15 דק')</small>
                </button>
                <button type="button" class="version-tab" data-ver="300">
                  <strong>300</strong>
                  <small>העמקה מלאה (30–45 דק')</small>
                </button>
              </div>
              <p class="settings-hint settings-hint--tight">השמירה של כל גרסה נשמרת בנפרד בדפדפן.</p>
            </div>

            <div class="settings-subrow settings-subrow--review">
              <button id="reviewBtn" type="button" class="settings-action-btn secondary review-entry">
                <svg width="18" height="18" class="icon" aria-hidden="true"><use href="#i-layers"/></svg>
                <span>עריכת תשובות</span>
                <span id="reviewCount" class="review-count">0/120</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <div class="settings-dialog-footer">
        <button type="button" class="primary" id="saveCloseSettingsBtn">סגירה</button>
      </div>
    </div>
  </dialog>

  <dialog id="protectedSaveDialog" class="protected-save-dialog" aria-labelledby="protectedDialogTitle" aria-describedby="protectedDialogHint">
    <form id="protectedSaveForm" class="protected-save-form" autocomplete="off">
      <div class="protected-save-heading">
        <div class="protected-mark" aria-hidden="true"><svg width="24" height="24" class="icon"><use href="#i-shield"/></svg></div>
        <div class="protected-save-heading-copy">
          <span class="protected-eyebrow">פרטי · מוצפן מקומית במכשיר</span>
          <h2 id="protectedDialogTitle">שמירה מוצפנת בסיסמה</h2>
        </div>
      </div>
      <p id="protectedDialogHint">המידע יוצפן במכשיר שלך ולא יישלח לשרת.</p>
      
      <div class="protected-password-group">
        <input type="text" name="username" class="sr-only" autocomplete="username" value="ofiLab User" readonly />
        <div class="protected-password-label-row">
          <label for="protectedPassword">סיסמה</label>
          <span id="passwordLength" class="protected-length" data-ready="false">0 / 8 תווים</span>
        </div>
        <div class="protected-password-field">
          <input id="protectedPassword" type="password" minlength="8" maxlength="256" autocomplete="new-password" required placeholder="לפחות 8 תווים"/>
          <button id="toggleProtectedPassword" class="protected-password-reveal" type="button" aria-pressed="false">הצג סיסמה</button>
        </div>
        <p id="passwordHint" class="protected-password-hint" aria-live="polite">לפחות 8 תווים, מומלץ משפט סיסמה ייחודי.</p>
      </div>

      <section id="passwordStrengthPanel" class="password-strength-card" data-level="0" data-has-value="false" aria-label="עמידות לכוח גס">
        <div class="password-strength-head">
          <span class="password-strength-kicker">עמידות לכוח גס</span>
          <span id="passwordStrengthLevel" class="password-strength-level" aria-live="polite">ממתין לסיסמה</span>
        </div>
        <div id="passwordStrengthTrack" class="password-strength-track" role="progressbar" aria-label="עמידות הסיסמה לכוח גס" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span id="passwordStrengthFill" class="password-strength-fill"></span>
          <div class="password-strength-segments" aria-hidden="true">
            <span class="strength-bar-seg seg-1" title="רמה 1: בסיסית (0–32 ביט)"></span>
            <span class="strength-bar-seg seg-2" title="רמה 2: בינונית (33–54 ביט)"></span>
            <span class="strength-bar-seg seg-3" title="רמה 3: גבוהה (55–76 ביט)"></span>
            <span class="strength-bar-seg seg-4" title="רמה 4: חסינות מלאה (77+ ביט)"></span>
          </div>
        </div>
        <p id="passwordStrengthHint" class="password-strength-hint">הזן סיסמה ייחודית בעלת 8 תווים לפחות עם מגוון אותיות וספרות.</p>
      </section>

      <div id="protectedPasswordConfirmWrap" class="protected-password-group">
        <label for="protectedPasswordConfirm">אימות הסיסמה</label>
        <input id="protectedPasswordConfirm" type="password" maxlength="256" autocomplete="new-password" dir="auto" placeholder="הקלד שוב את הסיסמה"/>
      </div>

      <p id="protectedError" class="protected-save-error" role="alert" aria-live="polite"></p>
      <p id="protectedSaveState" class="protected-save-notice">שמירה רגילה: כל מי שמחזיק בקישור יכול לקרוא את התשובות.</p>
      <div class="protected-save-actions">
        <button id="protectedSubmit" type="submit" class="primary">יצירת שמירה מוגנת</button>
        <button id="protectedCancel" type="button" class="secondary">סגירה</button>
      </div>
      <button id="disableProtection" type="button" class="protected-danger" hidden>כיבוי ההצפנה וחזרה לשמירה רגילה</button>
      <p class="protected-footnote">אין אפשרות לשחזר סיסמה שנשכחה ללא גיבוי נוסף. שמור את הסיסמה בנפרד מהקישור.</p>
    </form>
  </dialog>

  <!-- HEXACO Honesty-Humility 16-Item Full-Stage Quiz Dialog -->
  <dialog id="hexacoDialog" class="hexaco-dialog" aria-labelledby="hexacoDialogTitle">
    <div class="hexaco-dialog-shell" dir="rtl">
      <header class="hexaco-dialog-head">
        <div class="hexaco-dialog-head-inner">
          <div class="hexaco-dialog-brand">
            <div class="hexaco-head-badge">⚖️ HEXACO-H</div>
            <div>
              <h2 id="hexacoDialogTitle">כנות וענווה — התכונה השישית</h2>
              <p class="hexaco-dialog-sub">16 שאלות ממוקדות · מענה ישיר ל־16 היגדים</p>
            </div>
          </div>
          <button type="button" class="hexaco-dialog-close" id="closeHexacoDialogBtn" aria-label="סגירת שאלון כנות וענווה"><span>יציאה מהשאלון</span> <span aria-hidden="true">✕</span></button>
        </div>
      </header>

      <div class="hexaco-dialog-body" id="hexacoQuizBody">
        <div class="hexaco-quiz-stepper">
          <div class="hexaco-stepper-head">
            <span id="hexacoFacetPill" class="hexaco-facet-pill">כנות ואותנטיות</span>
            <span id="hexacoStepCount" class="answered-counter">שאלה 1 מתוך 16</span>
            <span class="quiz-eta-badge" id="hexacoEtaBadge" hidden></span>
            <span class="save-note"><svg class="icon" width="14" height="14" aria-hidden="true"><use href="#i-check"/></svg><span id="hexacoSaveStatus">שמירה אוטומטית פעילה</span></span>
          </div>
          <div class="quiz-milestones" id="hexacoMilestones" role="img" aria-label="חלק 1 מתוך 5"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="hexaco-stepper-track" role="progressbar" aria-valuenow="1" aria-valuemin="1" aria-valuemax="16">
            <div class="hexaco-stepper-fill" id="hexacoStepperFill" style="width: 6.25%;"></div>
          </div>
        </div>

        <div class="hexaco-question-card" id="hexacoQuestionCard">
          <div class="question-caption">
            <span class="supp-question-counter" id="hexacoCardCounter">שאלה 1</span>
            <span class="question-invitation">מה הכי מתאים לך?</span>
          </div>
          <p class="hexaco-question-text" id="hexacoQuestionText" aria-live="polite"></p>
          <div class="question-tools" role="group" aria-label="עזרה בהבנת השאלה">
            <button type="button" id="hexacoHelpBtn" class="question-help-trigger" aria-label="מה הכוונה בשאלה הזאת?" aria-haspopup="dialog" aria-controls="questionHelpPanel" title="הסבר על ההיגד"><span aria-hidden="true">?</span> הסבר קצר</button>
            <span class="question-tools-divider" aria-hidden="true"></span>
            <button type="button" id="askAiHexaco" class="ai-inline-action" aria-label="לשאול את ה־AI על השאלה" aria-haspopup="dialog" aria-controls="aiDialog"><svg class="icon" aria-hidden="true" width="19" height="19"><use href="#i-spark"/></svg> לשאול AI</button>
          </div>
          <div class="hexaco-scale-options" id="hexacoScaleOptions" role="radiogroup" aria-label="עד כמה ההיגד מתאר אותך">
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn" data-value="1">
              <span class="scale-num">1</span>
              <span class="scale-txt">בכלל לא מתאר אותי</span>
            </button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn" data-value="2">
              <span class="scale-num">2</span>
              <span class="scale-txt">מתאר אותי מעט</span>
            </button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn" data-value="3">
              <span class="scale-num">3</span>
              <span class="scale-txt">מתאר אותי במידה בינונית</span>
            </button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn" data-value="4">
              <span class="scale-num">4</span>
              <span class="scale-txt">מתאר אותי במידה רבה</span>
            </button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn" data-value="5">
              <span class="scale-num">5</span>
              <span class="scale-txt">מתאר אותי מאוד</span>
            </button>
          </div>
          <p class="help" id="hexacoChoiceFeedback" role="status" aria-live="polite">אין תשובה נכונה. בחר את מה שמתאים לך בדרך כלל.</p>
        </div>

        <div class="hexaco-nav-footer">
          <button type="button" class="hexaco-nav-btn is-prev" id="hexacoPrevBtn" disabled>→ הקודם</button>
          <button type="button" class="hexaco-nav-btn is-skip" id="hexacoSkipBtn">דלג (3 · במידה בינונית)</button>
          <button type="button" class="hexaco-nav-btn is-next" id="hexacoNextBtn">ממשיכים ←</button>
        </div>
        <div class="quiz-quickbar">
          <span class="quiz-keyboard-hint">אפשר לבחור גם עם המקשים 1–5</span>
        </div>
      </div>

      <!-- Completion Screen Inside Dialog -->
      <div class="hexaco-dialog-complete" id="hexacoQuizComplete" hidden>
        <div class="hexaco-complete-icon">🎉</div>
        <h3>השאלון הושלם בהצלחה!</h3>
        <p>ציון ה-HEXACO H המלא חושב והוטמע ישירות בדוח ובקישור התוצאות שלך.</p>
        <div class="hexaco-complete-preview" id="hexacoCompletePreview"></div>
        <button type="button" class="hexaco-complete-btn" id="hexacoFinishBtn">חזרה לדוח המעודכן</button>
      </div>
    </div>
  </dialog>

  <!-- IPIP-VIA-R (60 items) Full-Stage Quiz Dialog -->
  <dialog id="viaDialog" class="hexaco-dialog" aria-labelledby="viaDialogTitle">
    <div class="hexaco-dialog-shell" dir="rtl">
      <header class="hexaco-dialog-head">
        <div class="hexaco-dialog-head-inner">
          <div class="hexaco-dialog-brand">
            <div class="hexaco-head-badge">🌟 חוזקות אופי</div>
            <div>
              <h2 id="viaDialogTitle">שאלון חוזקות האופי המשולב</h2>
              <p class="hexaco-dialog-sub">60 שאלות ממוקדות · מדידה ישירה להשלמת 24 חוזקות האופי ו-3 כוחות העל</p>
            </div>
          </div>
          <button type="button" class="hexaco-dialog-close" id="closeViaDialogBtn" aria-label="סגור חלון" title="סגור"><span>יציאה מהשאלון</span> <span aria-hidden="true">✕</span></button>
        </div>
      </header>

      <div class="hexaco-dialog-body" id="viaQuizBody">
        <div class="hexaco-quiz-stepper">
          <div class="hexaco-stepper-head">
            <span id="viaFacetPill" class="hexaco-facet-pill">חוזקת אופי</span>
            <span id="viaStepCount" class="answered-counter">שאלה 1 מתוך 60</span>
            <span class="quiz-eta-badge" id="viaEtaBadge" hidden></span>
            <span class="save-note"><svg class="icon" width="14" height="14" aria-hidden="true"><use href="#i-check"/></svg><span id="viaSaveStatus">שמירה אוטומטית פעילה</span></span>
          </div>
          <div class="quiz-milestones" id="viaMilestones" role="img" aria-label="חלק 1 מתוך 5"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="hexaco-stepper-track" role="progressbar" aria-valuenow="1" aria-valuemin="1" aria-valuemax="60">
            <div class="hexaco-stepper-fill" id="viaStepperFill" style="width: 1.67%;"></div>
          </div>
        </div>

        <div class="hexaco-question-card">
          <div class="question-caption">
            <span class="supp-question-counter" id="viaCardCounter">שאלה 1</span>
            <span class="question-invitation">מה הכי מתאים לך?</span>
          </div>
          <p class="hexaco-question-text" id="viaQuestionText" aria-live="polite"></p>
          <div class="question-tools" role="group" aria-label="עזרה בהבנת השאלה">
            <button type="button" id="viaHelpBtn" class="question-help-trigger" aria-label="מה הכוונה בשאלה הזאת?" aria-haspopup="dialog" aria-controls="questionHelpPanel" title="הסבר על ההיגד"><span aria-hidden="true">?</span> הסבר קצר</button>
            <span class="question-tools-divider" aria-hidden="true"></span>
            <button type="button" id="askAiVia" class="ai-inline-action" aria-label="לשאול את ה־AI על השאלה" aria-haspopup="dialog" aria-controls="aiDialog"><svg class="icon" aria-hidden="true" width="19" height="19"><use href="#i-spark"/></svg> לשאול AI</button>
          </div>
          <div class="hexaco-scale-options" role="radiogroup" aria-label="סולם תשובות מ-1 עד 5">
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn via-scale-btn" data-value="1" aria-label="1 - בכלל לא מתאר אותי">
              <span class="scale-num">1</span>
              <span class="scale-txt">בכלל לא מתאר אותי</span>
            </button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn via-scale-btn" data-value="2" aria-label="2 - מתאר אותי מעט">
              <span class="scale-num">2</span>
              <span class="scale-txt">מתאר אותי מעט</span>
            </button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn via-scale-btn" data-value="3" aria-label="3 - מתאר אותי במידה בינונית">
              <span class="scale-num">3</span>
              <span class="scale-txt">מתאר אותי במידה בינונית</span>
            </button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn via-scale-btn" data-value="4" aria-label="4 - מתאר אותי במידה רבה">
              <span class="scale-num">4</span>
              <span class="scale-txt">מתאר אותי במידה רבה</span>
            </button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn via-scale-btn" data-value="5" aria-label="5 - מתאר אותי מאוד">
              <span class="scale-num">5</span>
              <span class="scale-txt">מתאר אותי מאוד</span>
            </button>
          </div>
          <p class="help" id="viaChoiceFeedback" role="status" aria-live="polite">אין תשובה נכונה. בחר את מה שמתאים לך בדרך כלל.</p>
        </div>

        <div class="hexaco-nav-footer">
          <button type="button" class="hexaco-nav-btn is-prev" id="viaPrevBtn" disabled>→ הקודם</button>
          <button type="button" class="hexaco-nav-btn is-skip" id="viaSkipBtn" title="דלג על השאלה (יסומן 3)">דלג (3 · במידה בינונית)</button>
          <button type="button" class="hexaco-nav-btn is-next" id="viaNextBtn">ממשיכים ←</button>
        </div>
        <div class="quiz-quickbar">
          <span class="quiz-keyboard-hint">אפשר לבחור גם עם המקשים 1–5</span>
        </div>
      </div>

      <div class="hexaco-dialog-complete" id="viaQuizComplete" hidden>
        <div class="hexaco-complete-icon">🌟</div>
        <h3>שאלון חוזקות האופי הושלם!</h3>
        <p>מיפוי 24 חוזקות האופי, 5 חוזקות החתימה שלך ו-3 כוחות העל חושב והוטמע בדוח ובקישור שלך.</p>
        <div class="hexaco-complete-preview" id="viaCompletePreview"></div>
        <button type="button" class="hexaco-complete-btn" id="viaFinishBtn">צפייה בתוצאות המעודכנות</button>
      </div>
    </div>
  </dialog>

  <!-- ECR-RS (9 items) Full-Stage Quiz Dialog -->
  <dialog id="ecrrsDialog" class="hexaco-dialog" aria-labelledby="ecrrsDialogTitle">
    <div class="hexaco-dialog-shell" dir="rtl">
      <header class="hexaco-dialog-head">
        <div class="hexaco-dialog-head-inner">
          <div class="hexaco-dialog-brand">
            <div class="hexaco-head-badge">🤝 ECR-RS</div>
            <div>
              <h2 id="ecrrsDialogTitle">שאלון סגנון היקשרות במערכות יחסים</h2>
              <p class="hexaco-dialog-sub">9 שאלות קצרות · מדידת צירי חרדת נטישה והימנעות מאינטימיות</p>
            </div>
          </div>
          <button type="button" class="hexaco-dialog-close" id="closeEcrrsDialogBtn" aria-label="סגור חלון" title="סגור"><span>יציאה מהשאלון</span> <span aria-hidden="true">✕</span></button>
        </div>
      </header>

      <div class="hexaco-dialog-body" id="ecrrsQuizBody">
        <div class="hexaco-quiz-stepper">
          <div class="hexaco-stepper-head">
            <span id="ecrrsFacetPill" class="hexaco-facet-pill">סגנון היקשרות</span>
            <span id="ecrrsStepCount" class="answered-counter">שאלה 1 מתוך 9</span>
            <span class="quiz-eta-badge" id="ecrrsEtaBadge" hidden></span>
            <span class="save-note"><svg class="icon" width="14" height="14" aria-hidden="true"><use href="#i-check"/></svg><span id="ecrrsSaveStatus">שמירה אוטומטית פעילה</span></span>
          </div>
          <div class="quiz-milestones" id="ecrrsMilestones" role="img" aria-label="חלק 1 מתוך 5"><span></span><span></span><span></span><span></span><span></span></div>
          <div class="hexaco-stepper-track" role="progressbar" aria-valuenow="1" aria-valuemin="1" aria-valuemax="9">
            <div class="hexaco-stepper-fill" id="ecrrsStepperFill" style="width: 11.1%;"></div>
          </div>
        </div>

        <div class="hexaco-question-card">
          <div class="question-caption">
            <span class="supp-question-counter" id="ecrrsCardCounter">שאלה 1</span>
            <span class="question-invitation">מה הכי מתאים לך בקשרים קרובים?</span>
          </div>
          <p class="hexaco-question-text" id="ecrrsQuestionText" aria-live="polite"></p>
          <div class="question-tools" role="group" aria-label="עזרה בהבנת השאלה">
            <button type="button" id="ecrrsHelpBtn" class="question-help-trigger" aria-label="מה הכוונה בשאלה הזאת?" aria-haspopup="dialog" aria-controls="questionHelpPanel" title="הסבר על ההיגד"><span aria-hidden="true">?</span> הסבר קצר</button>
            <span class="question-tools-divider" aria-hidden="true"></span>
            <button type="button" id="askAiEcrrs" class="ai-inline-action" aria-label="לשאול את ה־AI על השאלה" aria-haspopup="dialog" aria-controls="aiDialog"><svg class="icon" aria-hidden="true" width="19" height="19"><use href="#i-spark"/></svg> לשאול AI</button>
          </div>
          <div class="hexaco-scale-options ecrrs-scale-7" role="radiogroup" aria-label="סולם תשובות מ-1 עד 7">
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn ecrrs-scale-btn" data-value="1" aria-label="1 - בכלל לא מסכים/ה"><span class="scale-num">1</span><span class="scale-txt">בכלל לא מסכים/ה</span></button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn ecrrs-scale-btn" data-value="2" aria-label="2 - לא מסכים/ה"><span class="scale-num">2</span><span class="scale-txt">לא מסכים/ה</span></button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn ecrrs-scale-btn" data-value="3" aria-label="3 - נוטה לא להסכים"><span class="scale-num">3</span><span class="scale-txt">נוטה לא להסכים</span></button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn ecrrs-scale-btn" data-value="4" aria-label="4 - ניטרלי / באמצע"><span class="scale-num">4</span><span class="scale-txt">ניטרלי / באמצע</span></button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn ecrrs-scale-btn" data-value="5" aria-label="5 - נוטה להסכים"><span class="scale-num">5</span><span class="scale-txt">נוטה להסכים</span></button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn ecrrs-scale-btn" data-value="6" aria-label="6 - מסכים/ה"><span class="scale-num">6</span><span class="scale-txt">מסכים/ה</span></button>
            <button type="button" role="radio" aria-checked="false" class="hexaco-scale-btn ecrrs-scale-btn" data-value="7" aria-label="7 - מסכים/ה מאוד"><span class="scale-num">7</span><span class="scale-txt">מסכים/ה מאוד</span></button>
          </div>
          <p class="help" id="ecrrsChoiceFeedback" role="status" aria-live="polite">אין תשובה נכונה. חשוב על איך שאתה מרגיש בדרך כלל במערכות יחסים קרובות.</p>
        </div>

        <div class="hexaco-nav-footer">
          <button type="button" class="hexaco-nav-btn is-prev" id="ecrrsPrevBtn" disabled>→ הקודם</button>
          <button type="button" class="hexaco-nav-btn is-skip" id="ecrrsSkipBtn" title="דלג על השאלה (יסומן 4)">דלג (4 · ניטרלי)</button>
          <button type="button" class="hexaco-nav-btn is-next" id="ecrrsNextBtn">ממשיכים ←</button>
        </div>
        <div class="quiz-quickbar">
          <span class="quiz-keyboard-hint">אפשר לבחור גם עם המקשים 1–7</span>
        </div>
      </div>

      <div class="hexaco-dialog-complete" id="ecrrsQuizComplete" hidden>
        <div class="hexaco-complete-icon">🤝</div>
        <h3>שאלון סגנון ההיקשרות הושלם!</h3>
        <p>ציוני החרדה וההימנעות וסגנון ההיקשרות שלך במערכות יחסים חושבו והוטמעו בדוח ובקישור התוצאות שלך.</p>
        <div class="hexaco-complete-preview" id="ecrrsCompletePreview"></div>
        <button type="button" class="hexaco-complete-btn" id="ecrrsFinishBtn">צפייה בתוצאות המעודכנות</button>
      </div>
    </div>
  </dialog>

  <!-- Question banks and guidance: read from data/ by PHP on each request (no build step). -->
  <script id="data-bank-120" type="application/json"><?= ofilab_json('ipip-neo-120-he.json') ?></script>
  <script id="data-bank-300" type="application/json"><?= ofilab_json('ipip-neo-300-he.json') ?></script>
  <script id="data-guidance-120" type="application/json"><?= ofilab_json('question-guidance-he.json') ?></script>
  <script id="data-guidance-300" type="application/json"><?= ofilab_json('question-guidance-300-he.json') ?></script>
  <script id="data-hexaco-items" type="application/json"><?= ofilab_json('hexaco-h-16-he.json') ?></script>
  <script id="data-via-items" type="application/json"><?= ofilab_json('ipip-via-r-60-he.json') ?></script>
  <script id="data-ecrrs-items" type="application/json"><?= ofilab_json('ecrrs-he.json') ?></script>

  <script src="./assets/calm-lens.js"></script>
  <script src="./assets/calm-components.js"></script>
  <!-- Application modules, in load order. The short inline scripts keep the
       120 and 300 versions of the scoring and codec modules side by side
       and route each name to the active questionnaire. -->
  <script src="./assets/protected-link-routing.js"></script>
  <script src="./assets/theme.js"></script>
  <script src="./assets/scoring.js"></script>
  <script>window.AVDPersonalityCore120=window.AVDPersonalityCore;</script>
  <script src="./assets/scoring-300.js"></script>
  <script>window.AVDPersonalityCore300=window.AVDPersonalityCore;</script>
  <script>(function(root){Object.defineProperty(root,'AVDPersonalityCore',{get(){return root.document?.documentElement?.dataset?.inventory==='ipip-neo-300'?root.AVDPersonalityCore300:root.AVDPersonalityCore120;},set(v){root._customCore=v;},configurable:true});})(window);</script>
  <script src="./assets/compact-codec-small.js"></script>
  <script>window.OfiLabCodec120=window.OfiLabCodecSmall=window.OfiLabCompactV2;</script>
  <script src="./assets/compact-codec.js"></script>
  <script>window.OfiLabCodec300=window.OfiLabCompactV2;</script>
  <script src="./assets/codec-dispatch.js"></script>
  <script src="./assets/secure-save.js"></script>
  <script src="./assets/storage.js"></script>
  <script src="./assets/empirical-deep-models.js"></script>
  <script src="./assets/irt-facet-score-ci.js"></script>
  <script src="./assets/four-letter-estimate.js"></script>
  <script src="./assets/empirical-data.js"></script>
  <script src="./assets/empirical-data-300.js"></script>
  <script src="./assets/profile-links-data.js"></script>
  <script src="./assets/profile-links.js"></script>
  <script src="./assets/empirical-norms.js"></script>
  <script src="./assets/hexaco-codec.js"></script>
  <script src="./assets/via-codec.js"></script>
  <script src="./assets/ecrrs-codec.js"></script>
  <script src="./assets/export-markdown.js"></script>
  <script src="./assets/visuals.js"></script>
  <script src="./assets/chat-markdown.js"></script>
  <script src="./assets/ai-chat.js"></script>
  <script src="./assets/results-files.js"></script>
  <script src="./assets/profile-executive.js"></script>
  <script src="./assets/experience-validity.js"></script>
  <script src="./assets/experience-models.js"></script>
  <script src="./assets/experience.js"></script>
  <script src="./assets/experience-quizzes.js"></script>
  <script src="./assets/extended-journey.js"></script>
  <script src="./assets/password-strength.js"></script>
  <script src="./assets/peer-compare.js"></script>
  <script src="./assets/footer-status.js"></script>
  <script src="./assets/personality.js"></script>
  <script src="./assets/qrcode-generator.js"></script>
  <script>if(typeof qrcode==="function")window.qrcode=qrcode;</script>
  <script src="./assets/results-share-link.js"></script>
</body>
</html>
