/* ==========================================================================
   Noor-e-Tasbeeh – Digital Tasbee Counter
   Plain JavaScript, no dependencies, fully offline.

   Sections
     1. Constants & built-in tasbeeh list
     2. Translations (English / Urdu)
     3. Small utilities
     4. State: defaults, validation (normalize), load / save
     5. Counting logic (tap, minus, undo, sessions, history helpers)
     6. Feedback (vibration, sound, wake lock)
     7. UI helpers: icons, toast, modal / confirm
     8. Screens: Home, Tasbeeh, History, Settings
     9. Backup: export / import / snapshots / share
    10. PWA: service worker, install, online indicator
    11. Event wiring & start-up
   ========================================================================== */
(function () {
  'use strict';

  /* ======================================================================
     1. CONSTANTS
     ====================================================================== */
  const APP_VERSION = '1.0.0';
  const STORE_KEY = 'noor-e-tasbeeh:data:v1';       // main data
  const PREV_KEY = 'noor-e-tasbeeh:safety-copy';    // copy of data taken before an import / restore
  const SNAP_KEY = 'noor-e-tasbeeh:snapshot';       // manual on-device backup
  const BACKUP_APP_ID = 'noor-e-tasbeeh';
  const MAX_TARGET = 1000000;
  const PRESETS = [33, 100, 500, 1000];
  const CIRC = 2 * Math.PI * 45;                    // ring circumference (r = 45)
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const ID_RE = /^[bc][a-z0-9]{1,30}$/;

  // Built-in tasbeeh. Arabic text is fixed; meanings are shown under the Arabic.
  const BUILTINS = [
    { id: 'b1', ar: 'سبحان الله', tr: 'SubhanAllah', en: 'Glory be to Allah', ur: 'اللہ پاک ہے', target: 33 },
    { id: 'b2', ar: 'الحمد لله', tr: 'Alhamdulillah', en: 'All praise is for Allah', ur: 'تمام تعریفیں اللہ کے لیے ہیں', target: 33 },
    { id: 'b3', ar: 'الله أكبر', tr: 'Allahu Akbar', en: 'Allah is the Greatest', ur: 'اللہ سب سے بڑا ہے', target: 33 },
    { id: 'b4', ar: 'لا إله إلا الله', tr: 'La ilaha illallah', en: 'There is no god but Allah', ur: 'اللہ کے سوا کوئی معبود نہیں', target: 100 },
    { id: 'b5', ar: 'أستغفر الله', tr: 'Astaghfirullah', en: 'I seek forgiveness from Allah', ur: 'میں اللہ سے معافی مانگتا ہوں', target: 100 },
    { id: 'b6', ar: 'اللهم صل على محمد', tr: 'Durood', en: 'O Allah, send blessings upon Muhammad', ur: 'اے اللہ! محمد ﷺ پر درود بھیج', target: 100 },
    { id: 'b7', ar: 'لا حول ولا قوة إلا بالله', tr: 'La hawla wa la quwwata illa billah', en: 'There is no power or strength except with Allah', ur: 'اللہ کے بغیر نہ کوئی طاقت ہے نہ قوت', target: 100 },
    { id: 'b8', ar: 'سبحان الله وبحمده', tr: 'SubhanAllahi wa bihamdihi', en: 'Glory and praise be to Allah', ur: 'اللہ پاک ہے اور اسی کی تعریف ہے', target: 100 },
    { id: 'b9', ar: 'سبحان الله العظيم', tr: 'SubhanAllahil Azeem', en: 'Glory be to Allah, the Magnificent', ur: 'عظمت والا اللہ پاک ہے', target: 100 }
  ];
  const BUILTIN_MAP = {};
  BUILTINS.forEach(function (b) { BUILTIN_MAP[b.id] = b; });

  /* ======================================================================
     2. TRANSLATIONS
     ====================================================================== */
  const I18N = {
    en: {
      appName: 'Noor-e-Tasbeeh', tagline: 'Digital Tasbee Counter',
      navHome: 'Home', navTasbeeh: 'Tasbeeh', navHistory: 'History', navSettings: 'Settings',
      countPlus: 'Count one', minusOne: 'Minus one', undo: 'Undo', reset: 'Reset',
      prev: 'Previous tasbeeh', next: 'Next tasbeeh', favorite: 'Favorite',
      target: 'Target', remaining: 'remaining', beyond: 'beyond target', targetDone: 'Target complete',
      today: 'Today', lifetime: 'Lifetime', completedTargets: 'Completed targets', streak: 'Day streak',
      days: 'days', day: 'day', dailyGoal: 'Daily goal', session: 'Session', total: 'Total',
      goalReached: 'Daily goal reached. MashaAllah!',
      darkMode: 'Switch to dark screen', lightMode: 'Switch to light screen',
      nothingToUndo: 'Nothing to undo', undone: 'Last count undone',
      resetTitle: 'Reset this counter?', resetMsg: 'The current count ({n}) is saved in the session history and the counter restarts from 0. Your totals and daily history are not changed.',
      resetOk: 'Reset', cancel: 'Cancel', save: 'Save', delete: 'Delete', close: 'Close', ok: 'OK',
      completeTitle: 'Target complete!', completeMsg: 'You completed {n} repetitions.',
      continueCount: 'Continue counting', newSession: 'New session',
      newSessionTitle: 'Start a new session?', newSessionMsg: 'The current count is saved in session history and the counter restarts from 0.',
      sessionStarted: 'New session started',
      tasbeehTitle: 'Tasbeeh', all: 'All', favorites: 'Favorites', select: 'Select', edit: 'Edit',
      active: 'Active', custom: 'Custom', addCustom: 'Add custom tasbeeh', editTasbeeh: 'Edit tasbeeh',
      zikrArabic: 'Zikr (Arabic)', zikrName: 'Name / transliteration (optional)',
      errEmpty: 'Please enter the zikr text.', errLong: 'Too long (max {n} characters).',
      errTarget: 'Enter a whole number from 1 to {n}.', errDup: 'You already have this tasbeeh.',
      added: 'Tasbeeh added', saved: 'Saved', deleted: 'Tasbeeh deleted',
      deleteTitle: 'Delete this tasbeeh?', deleteMsg: '“{name}” will be removed from your list. Counts already recorded in your history and lifetime totals are kept.',
      noFavorites: 'No favorites yet. Tap the star on a tasbeeh to add it.',
      sessions: 'Recent sessions', noSessions: 'No saved sessions yet.',
      setTarget: 'Set target', targetSaved: 'Target updated',
      histTitle: 'History', last7: 'Last 7 days', todayBy: 'Today by tasbeeh', prevDays: 'Previous days',
      noToday: 'Nothing counted yet today.', noPrev: 'Previous days will appear here.',
      shareToday: 'Share today', resetToday: 'Reset today',
      resetTodayTitle: 'Reset today’s count?', resetTodayMsg: 'Today’s daily total ({n}) will be set to 0. Lifetime totals and other days are not changed.',
      todayReset: 'Today’s count reset',
      shareTitle: 'Noor-e-Tasbeeh', shareHeader: 'My zikr today', copied: 'Copied to clipboard', copyManual: 'Copy this text',
      settingsTitle: 'Settings', appearance: 'Appearance', language: 'Language', theme: 'Theme',
      themeAuto: 'Auto', themeLight: 'Light', themeDark: 'Dark',
      counting: 'Counting', vibration: 'Vibration', vibrationDesc: 'Vibrate on each tap',
      sound: 'Sound', soundDesc: 'Soft click on each tap', wake: 'Keep screen awake', wakeDesc: 'While counting on the Home screen',
      goalDesc: 'Total zikr per day', goalSave: 'Save goal', goalInvalid: 'Enter a number from 1 to {n}.', goalSaved: 'Goal saved',
      backup: 'Backup & restore', exportJson: 'Export backup (JSON)', importJson: 'Import backup',
      snapSave: 'Save snapshot on this device', snapRestore: 'Restore snapshot', snapNone: 'No snapshot saved yet',
      snapLast: 'Last snapshot: {d}', snapSaved: 'Snapshot saved', snapFail: 'Could not save the snapshot.',
      restoreSafety: 'Restore safety copy', safetyDesc: 'A copy of your data from just before the last import or restore.',
      exported: 'Backup file created', importBad: 'This file is not a valid Noor-e-Tasbeeh backup.',
      importTitle: 'Replace your data with this backup?', importMsg: 'Backup from {d}: {n} total zikr. Your current data is saved as a safety copy first, so you can undo this.',
      importOk: 'Replace', imported: 'Backup restored', safetyFail: 'A safety copy could not be saved (storage is full or blocked). Export a backup first if you want to keep your current data.',
      restoreTitle: 'Restore this copy?', restoreMsg: 'Your current data is saved as a safety copy first.', restored: 'Data restored',
      about: 'About', version: 'Version', offlineReady: 'Ready for offline use', offlinePrep: 'Preparing offline files…', offlineNo: 'Offline mode is not supported in this browser.',
      storage: 'Storage', storagePersist: 'Protected from automatic cleanup', storageNormal: 'Standard browser storage',
      install: 'Install app', installDesc: 'Add Noor-e-Tasbeeh to your home screen', checkUpdate: 'Check for updates',
      upToDate: 'You have the latest version', updateAvail: 'A new version is ready.', updateBtn: 'Update',
      offline: 'Offline – everything still works',
      storageError: 'Could not save to this device’s storage. Export a backup to avoid losing data.',
      storageBlocked: 'Storage is blocked, so your progress cannot be saved. Please allow site data for this page.',
      corrupt: 'Saved data could not be read. A copy was kept and a fresh start was created.',
      noteDeleted: '(removed)', byLabel: 'Total today', lifetimeLabel: 'Lifetime'
    },
    ur: {
      appName: 'نورِ تسبیح', tagline: 'ڈیجیٹل تسبیح کاؤنٹر',
      navHome: 'ہوم', navTasbeeh: 'تسبیحات', navHistory: 'ریکارڈ', navSettings: 'سیٹنگز',
      countPlus: 'ایک گنیں', minusOne: 'ایک کم کریں', undo: 'واپس', reset: 'ری سیٹ',
      prev: 'پچھلی تسبیح', next: 'اگلی تسبیح', favorite: 'پسندیدہ',
      target: 'ہدف', remaining: 'باقی', beyond: 'ہدف سے زائد', targetDone: 'ہدف مکمل',
      today: 'آج', lifetime: 'کل مجموعہ', completedTargets: 'مکمل اہداف', streak: 'مسلسل دن',
      days: 'دن', day: 'دن', dailyGoal: 'روزانہ ہدف', session: 'سیشن', total: 'کل',
      goalReached: 'ماشاءاللہ! آج کا ہدف پورا ہو گیا',
      darkMode: 'ڈارک اسکرین', lightMode: 'لائٹ اسکرین',
      nothingToUndo: 'واپس کرنے کے لیے کچھ نہیں', undone: 'آخری گنتی واپس کر دی گئی',
      resetTitle: 'کاؤنٹر ری سیٹ کریں؟', resetMsg: 'موجودہ گنتی ({n}) سیشن ہسٹری میں محفوظ ہو جائے گی اور کاؤنٹر 0 سے شروع ہوگا۔ آپ کے کل مجموعے اور روزانہ ریکارڈ میں کوئی تبدیلی نہیں ہوگی۔',
      resetOk: 'ری سیٹ', cancel: 'منسوخ', save: 'محفوظ کریں', delete: 'حذف کریں', close: 'بند کریں', ok: 'ٹھیک ہے',
      completeTitle: 'ہدف مکمل!', completeMsg: 'آپ نے {n} مرتبہ پڑھ لیا۔',
      continueCount: 'گنتی جاری رکھیں', newSession: 'نیا سیشن',
      newSessionTitle: 'نیا سیشن شروع کریں؟', newSessionMsg: 'موجودہ گنتی سیشن ہسٹری میں محفوظ ہو جائے گی اور کاؤنٹر 0 سے شروع ہوگا۔',
      sessionStarted: 'نیا سیشن شروع ہو گیا',
      tasbeehTitle: 'تسبیحات', all: 'سب', favorites: 'پسندیدہ', select: 'منتخب کریں', edit: 'ترمیم',
      active: 'فعال', custom: 'اپنی', addCustom: 'اپنی تسبیح شامل کریں', editTasbeeh: 'تسبیح میں ترمیم',
      zikrArabic: 'ذکر (عربی)', zikrName: 'نام / رومن (اختیاری)',
      errEmpty: 'براہ کرم ذکر لکھیں۔', errLong: 'بہت لمبا ہے (زیادہ سے زیادہ {n} حروف)۔',
      errTarget: '1 سے {n} تک کوئی عدد لکھیں۔', errDup: 'یہ تسبیح پہلے سے موجود ہے۔',
      added: 'تسبیح شامل ہو گئی', saved: 'محفوظ ہو گیا', deleted: 'تسبیح حذف ہو گئی',
      deleteTitle: 'یہ تسبیح حذف کریں؟', deleteMsg: '«{name}» آپ کی فہرست سے ہٹ جائے گی۔ ریکارڈ اور کل مجموعے میں پہلے سے درج گنتی محفوظ رہے گی۔',
      noFavorites: 'ابھی کوئی پسندیدہ نہیں۔ تسبیح پر ستارے کو دبائیں۔',
      sessions: 'حالیہ سیشن', noSessions: 'ابھی کوئی محفوظ سیشن نہیں۔',
      setTarget: 'ہدف مقرر کریں', targetSaved: 'ہدف تبدیل ہو گیا',
      histTitle: 'ریکارڈ', last7: 'پچھلے 7 دن', todayBy: 'آج کی تسبیحات', prevDays: 'پچھلے دن',
      noToday: 'آج ابھی کچھ نہیں گنا۔', noPrev: 'پچھلے دنوں کا ریکارڈ یہاں نظر آئے گا۔',
      shareToday: 'آج کا ریکارڈ شیئر کریں', resetToday: 'آج کا ری سیٹ',
      resetTodayTitle: 'آج کی گنتی ری سیٹ کریں؟', resetTodayMsg: 'آج کا کل ({n}) صفر ہو جائے گا۔ کل مجموعہ اور دوسرے دن تبدیل نہیں ہوں گے۔',
      todayReset: 'آج کی گنتی ری سیٹ ہو گئی',
      shareTitle: 'نورِ تسبیح', shareHeader: 'آج میرا ذکر', copied: 'کاپی ہو گیا', copyManual: 'یہ متن کاپی کریں',
      settingsTitle: 'سیٹنگز', appearance: 'ظاہری شکل', language: 'زبان', theme: 'تھیم',
      themeAuto: 'خودکار', themeLight: 'روشن', themeDark: 'گہرا',
      counting: 'گنتی', vibration: 'وائبریشن', vibrationDesc: 'ہر ٹیپ پر وائبریٹ ہو',
      sound: 'آواز', soundDesc: 'ہر ٹیپ پر ہلکی آواز', wake: 'اسکرین آن رکھیں', wakeDesc: 'ہوم اسکرین پر گنتی کے دوران',
      goalDesc: 'روزانہ کل ذکر', goalSave: 'ہدف محفوظ کریں', goalInvalid: '1 سے {n} تک کوئی عدد لکھیں۔', goalSaved: 'ہدف محفوظ ہو گیا',
      backup: 'بیک اپ اور بحالی', exportJson: 'بیک اپ ایکسپورٹ کریں (JSON)', importJson: 'بیک اپ امپورٹ کریں',
      snapSave: 'اس ڈیوائس پر اسنیپ شاٹ محفوظ کریں', snapRestore: 'اسنیپ شاٹ بحال کریں', snapNone: 'ابھی کوئی اسنیپ شاٹ نہیں',
      snapLast: 'آخری اسنیپ شاٹ: {d}', snapSaved: 'اسنیپ شاٹ محفوظ ہو گیا', snapFail: 'اسنیپ شاٹ محفوظ نہ ہو سکا۔',
      restoreSafety: 'حفاظتی کاپی بحال کریں', safetyDesc: 'آخری امپورٹ یا بحالی سے پہلے کے ڈیٹا کی کاپی۔',
      exported: 'بیک اپ فائل بن گئی', importBad: 'یہ فائل درست نورِ تسبیح بیک اپ نہیں ہے۔',
      importTitle: 'اپنا ڈیٹا اس بیک اپ سے بدلیں؟', importMsg: '{d} کا بیک اپ: کل {n} ذکر۔ پہلے آپ کے موجودہ ڈیٹا کی حفاظتی کاپی بنے گی، تاکہ آپ واپس جا سکیں۔',
      importOk: 'بدلیں', imported: 'بیک اپ بحال ہو گیا', safetyFail: 'حفاظتی کاپی محفوظ نہ ہو سکی (اسٹوریج بھرا ہے یا بند ہے)۔ موجودہ ڈیٹا رکھنا ہو تو پہلے بیک اپ ایکسپورٹ کریں۔',
      restoreTitle: 'یہ کاپی بحال کریں؟', restoreMsg: 'پہلے آپ کے موجودہ ڈیٹا کی حفاظتی کاپی بنے گی۔', restored: 'ڈیٹا بحال ہو گیا',
      about: 'ایپ کے بارے میں', version: 'ورژن', offlineReady: 'آف لائن استعمال کے لیے تیار', offlinePrep: 'آف لائن فائلیں تیار ہو رہی ہیں…', offlineNo: 'اس براؤزر میں آف لائن موڈ دستیاب نہیں۔',
      storage: 'اسٹوریج', storagePersist: 'خودکار صفائی سے محفوظ', storageNormal: 'عام براؤزر اسٹوریج',
      install: 'ایپ انسٹال کریں', installDesc: 'نورِ تسبیح کو ہوم اسکرین پر شامل کریں', checkUpdate: 'اپ ڈیٹ چیک کریں',
      upToDate: 'آپ کے پاس تازہ ترین ورژن ہے', updateAvail: 'نیا ورژن تیار ہے۔', updateBtn: 'اپ ڈیٹ',
      offline: 'آف لائن – سب کچھ کام کرتا ہے',
      storageError: 'اس ڈیوائس کے اسٹوریج میں محفوظ نہیں ہو سکا۔ ڈیٹا بچانے کے لیے بیک اپ ایکسپورٹ کریں۔',
      storageBlocked: 'اسٹوریج بند ہے، اس لیے آپ کی پیش رفت محفوظ نہیں ہو سکتی۔ براہ کرم اس صفحے کے لیے سائٹ ڈیٹا کی اجازت دیں۔',
      corrupt: 'محفوظ ڈیٹا پڑھا نہیں جا سکا۔ اس کی کاپی رکھ لی گئی اور نئی شروعات کی گئی۔',
      noteDeleted: '(ہٹائی گئی)', byLabel: 'آج کا کل', lifetimeLabel: 'کل مجموعہ'
    }
  };

  /* ======================================================================
     3. UTILITIES
     ====================================================================== */
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  const pad = function (n) { return n < 10 ? '0' + n : '' + n; };

  /** Local calendar date as YYYY-MM-DD (NOT UTC), so "today" matches the user's clock. */
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function keyToDate(key) {
    const p = key.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(date, n) { const d = new Date(date.getTime()); d.setDate(d.getDate() + n); return d; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  function toInt(v, min, max, def) {
    v = Math.floor(Number(v));
    if (!isFinite(v)) return def;
    return Math.min(max, Math.max(min, v));
  }
  /** Trim, remove control / bidi-override characters, collapse whitespace, limit length. */
  function cleanText(v, max) {
    if (typeof v !== 'string') return '';
    return v.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  /** Accepts Latin, Arabic-Indic and Persian digits; returns an integer or NaN. */
  function parseNumber(str) {
    const s = String(str).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x660; })
      .replace(/[۰-۹]/g, function (c) { return c.charCodeAt(0) - 0x6f0; })
      .replace(/[,\s٬]/g, '');
    return /^\d{1,9}$/.test(s) ? parseInt(s, 10) : NaN;
  }
  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ======================================================================
     4. STATE
     ====================================================================== */
  let state = null;
  let storageOk = true;       // false when localStorage is unavailable (progress would not persist)
  let saveFailedShown = false;

  function lang() { return state && state.settings.lang === 'ur' ? 'ur' : 'en'; }
  function t(key, vars) {
    let s = (I18N[lang()] && I18N[lang()][key]) || I18N.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }

  function newTasbeeh(b) {
    return { id: b.id, builtin: true, ar: b.ar, tr: b.tr, target: b.target, count: 0, total: 0, completed: 0, fav: false, sessions: [] };
  }
  function defaultState() {
    return {
      v: 1,
      settings: { lang: 'en', theme: 'light', vibrate: true, sound: true, wake: true, goal: 100 },
      tasbeehs: BUILTINS.map(newTasbeeh),
      activeId: 'b1',
      days: {},            // 'YYYY-MM-DD' -> { total, per: { tasbeehId: n } }
      deleted: {},         // removed custom tasbeeh names (so old history can still show a label)
      lifetime: 0,
      completedTotal: 0,
      undo: []             // last counting actions: { id, key, delta }
    };
  }

  /**
   * Validate and sanitise any state object (from storage or an imported file).
   * Never trusts the input: every field is type-checked, clamped and defaulted.
   */
  function normalizeState(src) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) throw new Error('Invalid data');
    const st = defaultState();
    const s = src.settings && typeof src.settings === 'object' ? src.settings : {};
    st.settings = {
      lang: s.lang === 'ur' ? 'ur' : 'en',
      theme: ['auto', 'light', 'dark'].indexOf(s.theme) >= 0 ? s.theme : 'light',
      vibrate: s.vibrate !== false,
      sound: s.sound !== false,
      wake: s.wake !== false,
      goal: toInt(s.goal, 1, MAX_TARGET, 100)
    };

    function readCounters(r, target) {
      const sessions = [];
      (Array.isArray(r.sessions) ? r.sessions.slice(-50) : []).forEach(function (x) {
        if (x && DATE_RE.test(x.d)) sessions.push({ d: x.d, n: toInt(x.n, 0, 1e9, 0), t: toInt(x.t, 1, MAX_TARGET, target), ts: toInt(x.ts, 0, 8.64e15, 0) });
      });
      return {
        count: toInt(r.count, 0, 1e9, 0), total: toInt(r.total, 0, 1e12, 0),
        completed: toInt(r.completed, 0, 1e9, 0), fav: r.fav === true, sessions: sessions
      };
    }

    const incoming = {};
    (Array.isArray(src.tasbeehs) ? src.tasbeehs.slice(0, 300) : []).forEach(function (r) {
      if (r && typeof r === 'object' && typeof r.id === 'string' && ID_RE.test(r.id) && !incoming[r.id]) incoming[r.id] = r;
    });
    const list = [];
    BUILTINS.forEach(function (b) {
      const r = incoming[b.id] || {};
      const base = newTasbeeh(b);
      base.target = toInt(r.target, 1, MAX_TARGET, b.target);
      Object.assign(base, readCounters(r, base.target));
      list.push(base);
      delete incoming[b.id];
    });
    Object.keys(incoming).forEach(function (id) {
      const r = incoming[id];
      if (id.charAt(0) !== 'c') return;
      const ar = cleanText(r.ar, 80);
      if (!ar) return;
      const target = toInt(r.target, 1, MAX_TARGET, 100);
      list.push(Object.assign({ id: id, builtin: false, ar: ar, tr: cleanText(r.tr, 40), target: target }, readCounters(r, target)));
    });
    st.tasbeehs = list;

    const deleted = {};
    if (src.deleted && typeof src.deleted === 'object') {
      Object.keys(src.deleted).slice(0, 300).forEach(function (id) {
        const d = src.deleted[id];
        if (ID_RE.test(id) && d && cleanText(d.ar, 80)) deleted[id] = { ar: cleanText(d.ar, 80), tr: cleanText(d.tr, 40) };
      });
    }
    st.deleted = deleted;

    const days = {};
    if (src.days && typeof src.days === 'object') {
      Object.keys(src.days).slice(0, 6000).forEach(function (k) {
        const v = src.days[k];
        if (!DATE_RE.test(k) || !v || typeof v !== 'object') return;
        const per = {};
        if (v.per && typeof v.per === 'object') {
          Object.keys(v.per).slice(0, 400).forEach(function (id) {
            if (ID_RE.test(id)) { const n = toInt(v.per[id], 0, 1e9, 0); if (n > 0) per[id] = n; }
          });
        }
        days[k] = { total: toInt(v.total, 0, 1e10, 0), per: per };
      });
    }
    st.days = days;

    const sumTotals = list.reduce(function (a, b) { return a + b.total; }, 0);
    st.lifetime = toInt(src.lifetime, 0, 1e12, sumTotals);
    st.completedTotal = toInt(src.completedTotal, 0, 1e9, list.reduce(function (a, b) { return a + b.completed; }, 0));
    const ids = {};
    list.forEach(function (b) { ids[b.id] = true; });
    st.undo = (Array.isArray(src.undo) ? src.undo : []).filter(function (u) {
      return u && ids[u.id] && DATE_RE.test(u.key) && (u.delta === 1 || u.delta === -1);
    }).slice(-100).map(function (u) { return { id: u.id, key: u.key, delta: u.delta }; });
    st.activeId = typeof src.activeId === 'string' && ids[src.activeId] ? src.activeId : 'b1';
    return st;
  }

  function loadState() {
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); }
    catch (e) { storageOk = false; }
    if (!raw) return defaultState();
    try {
      return normalizeState(JSON.parse(raw));
    } catch (e) {
      // Never overwrite unreadable data: keep a copy under another key first.
      try { localStorage.setItem(STORE_KEY + ':corrupt-' + Date.now(), raw); } catch (e2) { /* ignore */ }
      state = defaultState();
      setTimeout(function () { toast(t('corrupt'), { type: 'error', duration: 9000 }); }, 300);
      return state;
    }
  }

  function save() {
    if (!storageOk) return false;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      saveFailedShown = false;
      return true;
    } catch (e) {
      if (!saveFailedShown) { saveFailedShown = true; toast(t('storageError'), { type: 'error', duration: 8000 }); }
      return false;
    }
  }

  /* ======================================================================
     5. COUNTING LOGIC
     ====================================================================== */
  const byId = function (id) { return state.tasbeehs.filter(function (b) { return b.id === id; })[0] || null; };
  const active = function () { return byId(state.activeId) || state.tasbeehs[0]; };

  /** Favorites first (stable), used for the picker and list. */
  function ordered() {
    return state.tasbeehs.filter(function (b) { return b.fav; }).concat(state.tasbeehs.filter(function (b) { return !b.fav; }));
  }
  function dayRec(key) {
    if (!state.days[key]) state.days[key] = { total: 0, per: {} };
    return state.days[key];
  }
  function todayTotal() { const d = state.days[dateKey()]; return d ? d.total : 0; }

  function nameOf(id) {
    const b = byId(id);
    if (b) return b.ar;
    if (state.deleted[id]) return state.deleted[id].ar;
    return BUILTIN_MAP[id] ? BUILTIN_MAP[id].ar : '—';
  }
  function subtitle(b) {
    if (b.builtin) { const m = BUILTIN_MAP[b.id]; return lang() === 'ur' ? m.ur : m.tr + ' · ' + m.en; }
    return b.tr || '';
  }

  /**
   * The single place where a count changes. Keeps the tasbeeh counter, its lifetime
   * total, the daily record, the global lifetime and completed-target counters in sync.
   * Returns { ok, reached } – `reached` is true when this change hit the target.
   */
  function change(tb, key, delta) {
    if (delta < 0 && tb.count <= 0) return { ok: false, reached: false };
    const wasAtTarget = tb.count === tb.target;
    tb.count += delta;
    tb.total = Math.max(0, tb.total + delta);
    const d = dayRec(key);
    d.total = Math.max(0, d.total + delta);
    const n = Math.max(0, (d.per[tb.id] || 0) + delta);
    if (n > 0) d.per[tb.id] = n; else delete d.per[tb.id];
    state.lifetime = Math.max(0, state.lifetime + delta);
    let reached = false;
    if (delta > 0 && tb.count === tb.target) { tb.completed += 1; state.completedTotal += 1; reached = true; }
    if (delta < 0 && wasAtTarget) { tb.completed = Math.max(0, tb.completed - 1); state.completedTotal = Math.max(0, state.completedTotal - 1); }
    return { ok: true, reached: reached };
  }
  function pushUndo(id, key, delta) {
    state.undo.push({ id: id, key: key, delta: delta });
    if (state.undo.length > 100) state.undo.shift();
  }

  let lastTapAt = 0;
  let lastPointerTapAt = -1000;
  /** +1 on the active tasbeeh. The 35 ms guard blocks accidental duplicate events. */
  function tap() {
    const now = performance.now();
    if (now - lastTapAt < 35) return;
    lastTapAt = now;
    const tb = active();
    const key = dateKey();
    const goal = state.settings.goal;
    const before = todayTotal();
    const r = change(tb, key, 1);
    if (!r.ok) return;
    pushUndo(tb.id, key, 1);
    save();
    updateCounter(true);
    if (r.reached) {
      feedback('complete');
      showComplete(tb);
    } else {
      feedback('tap');
      if (before < goal && todayTotal() >= goal) toast(t('goalReached'));
    }
  }

  function minusOne() {
    const tb = active();
    const key = dateKey();
    // Remove from today's record when possible; otherwise from the day of the most recent count.
    const r = change(tb, key, -1);
    if (!r.ok) { toast(t('nothingToUndo')); return; }
    pushUndo(tb.id, key, -1);
    save();
    feedback('tap');
    updateCounter(true);
  }

  function undoLast() {
    for (let i = state.undo.length - 1; i >= 0; i--) {
      const u = state.undo[i];
      const tb = byId(u.id);
      state.undo.pop();
      if (!tb) continue;
      const r = change(tb, u.key, -u.delta);
      if (!r.ok) continue;   // e.g. counter was reset in between – skip stale entry
      if (state.activeId !== tb.id) { state.activeId = tb.id; save(); renderCurrent(); } else { save(); }
      updateCounter(true);
      feedback('tap');
      toast(t('undone'));
      return;
    }
    save();
    toast(t('nothingToUndo'));
  }

  /** Archive the current count in the tasbeeh's session history and restart at 0. */
  function endSession(tb) {
    if (tb.count > 0) {
      tb.sessions.push({ d: dateKey(), n: tb.count, t: tb.target, ts: Date.now() });
      if (tb.sessions.length > 50) tb.sessions.shift();
    }
    tb.count = 0;
    state.undo = state.undo.filter(function (u) { return u.id !== tb.id; });
    save();
  }

  function streakDays() {
    let d = new Date();
    let k = dateKey(d);
    if (!(state.days[k] && state.days[k].total > 0)) d = addDays(d, -1);   // today may not have started yet
    let n = 0;
    while (n < 6000) {
      k = dateKey(d);
      if (state.days[k] && state.days[k].total > 0) { n++; d = addDays(d, -1); } else break;
    }
    return n;
  }

  /* ======================================================================
     6. FEEDBACK
     ====================================================================== */
  let audioCtx = null;
  function beep(freq, dur, vol, when) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t0 = audioCtx.currentTime + (when || 0);
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio is optional */ }
  }
  function feedback(kind) {
    const s = state.settings;
    if (s.vibrate && navigator.vibrate) {
      try { navigator.vibrate(kind === 'complete' ? [120, 60, 120, 60, 260] : 14); } catch (e) { /* ignore */ }
    }
    if (s.sound) {
      if (kind === 'complete') { beep(660, 0.25, 0.12, 0); beep(880, 0.25, 0.12, 0.18); beep(1100, 0.5, 0.12, 0.36); }
      else beep(540, 0.07, 0.09, 0);
    }
  }

  let wakeLock = null;
  let currentTab = 'home';
  function updateWake() {
    const want = state.settings.wake && document.visibilityState === 'visible' && currentTab === 'home';
    if (want && !wakeLock && navigator.wakeLock && navigator.wakeLock.request) {
      navigator.wakeLock.request('screen').then(function (l) {
        wakeLock = l;
        l.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () { /* not allowed (e.g. low battery) – ignore */ });
    } else if (!want && wakeLock) {
      try { wakeLock.release(); } catch (e) { /* ignore */ }
      wakeLock = null;
    }
  }

  /* ======================================================================
     7. UI HELPERS
     ====================================================================== */
  function icon(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"/></svg>';
  }

  function toast(msg, opts) {
    opts = opts || {};
    const root = $('#toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast' + (opts.type === 'error' ? ' error' : '');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (opts.action ? '<button type="button">' + esc(opts.action.label) + '</button>' : '');
    if (opts.action) {
      el.querySelector('button').addEventListener('click', function () { el.remove(); opts.action.fn(); });
    }
    root.appendChild(el);
    while (root.children.length > 3) root.removeChild(root.firstChild);
    setTimeout(function () { if (el.parentNode) el.remove(); }, opts.duration || 2600);
  }

  // ---- Modal sheet -------------------------------------------------------
  let modal = null;
  function openSheet(html, o) {
    o = o || {};
    closeSheet();
    const ov = document.createElement('div');
    ov.className = 'overlay' + (o.center ? ' center' : '');
    ov.innerHTML = '<div class="sheet ' + (o.cls || '') + '" role="dialog" aria-modal="true" tabindex="-1">' +
      (o.center ? '' : '<div class="grab"></div>') + html + '</div>';
    $('#modal-root').appendChild(ov);
    modal = { el: ov, onClose: o.onClose || null, prevFocus: document.activeElement };
    ov.addEventListener('pointerdown', function (e) { if (e.target === ov && !o.sticky) closeSheet(); });
    const sheet = $('.sheet', ov);
    try { sheet.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return ov;
  }
  function closeSheet() {
    if (!modal) return;
    const m = modal;
    modal = null;
    m.el.remove();
    try { if (m.prevFocus && m.prevFocus.focus && document.contains(m.prevFocus)) m.prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    if (m.onClose) m.onClose();
  }
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      let answer = false;
      const ov = openSheet(
        '<h2>' + esc(o.title) + '</h2><p class="msg">' + esc(o.msg) + '</p>' +
        '<div class="btns"><button type="button" class="btn" data-modal="cancel">' + esc(t('cancel')) + '</button>' +
        '<button type="button" class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-modal="ok">' + esc(o.ok) + '</button></div>',
        { center: true, onClose: function () { resolve(answer); } }
      );
      ov.addEventListener('click', function (e) {
        const b = e.target.closest('[data-modal]');
        if (!b) return;
        answer = b.dataset.modal === 'ok';
        closeSheet();
      });
    });
  }

  /* ======================================================================
     8. SCREENS
     ====================================================================== */
  const views = { home: '#view-home', tasbeeh: '#view-tasbeeh', history: '#view-history', settings: '#view-settings' };

  function resolvedTheme() {
    const th = state.settings.theme;
    if (th === 'auto') return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return th;
  }
  function applyTheme() {
    const r = resolvedTheme();
    document.documentElement.setAttribute('data-theme', r);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', r === 'dark' ? '#031610' : '#0b5d44');
  }
  function applyLang() {
    document.documentElement.lang = lang();
    document.documentElement.dir = lang() === 'ur' ? 'rtl' : 'ltr';
    document.title = 'Noor-e-Tasbeeh – Digital Tasbee Counter';
  }

  function renderNav() {
    const items = [['home', 'home', 'navHome'], ['tasbeeh', 'beads', 'navTasbeeh'], ['history', 'chart', 'navHistory'], ['settings', 'settings', 'navSettings']];
    $('#nav').innerHTML = items.map(function (it) {
      return '<button type="button" data-action="tab" data-tab="' + it[0] + '"' + (currentTab === it[0] ? ' aria-current="page"' : '') + '>' +
        icon(it[1]) + '<span>' + esc(t(it[2])) + '</span></button>';
    }).join('');
  }

  function switchTab(tab) {
    currentTab = tab;
    Object.keys(views).forEach(function (k) { $(views[k]).hidden = k !== tab; });
    renderNav();
    renderCurrent();
    $('#main').scrollTop = 0;
    updateWake();
  }
  function renderCurrent() {
    ({ home: renderHome, tasbeeh: renderTasbeeh, history: renderHistory, settings: renderSettings })[currentTab]();
  }
  function renderAll() { applyTheme(); applyLang(); renderNav(); renderCurrent(); updateOnline(); }

  // ---- Home -----------------------------------------------------------------
  function progressFrac(tb) { return tb.target > 0 ? Math.min(1, tb.count / tb.target) : 0; }
  function subHTML(tb) {
    if (tb.count < tb.target) return '<b class="num">' + fmt(tb.target - tb.count) + '</b> ' + esc(t('remaining'));
    if (tb.count === tb.target) return '<span class="done-badge">' + icon('check', 'sm') + ' ' + esc(t('targetDone')) + '</span>';
    return '<span class="done-badge">+<span class="num">' + fmt(tb.count - tb.target) + '</span> ' + esc(t('beyond')) + '</span>';
  }

  function renderHome() {
    const tb = active();
    const dark = resolvedTheme() === 'dark';
    const rtl = lang() === 'ur';
    $('#view-home').innerHTML =
      '<div class="home" id="home-root">' +
        '<div class="home-top">' +
          '<div class="brand"><img class="logo" src="icon-192.png" alt="" width="34" height="34"><h1>' + esc(t('appName')) + '</h1></div>' +
          '<button type="button" class="icon-btn" data-action="toggle-night" aria-label="' + esc(dark ? t('lightMode') : t('darkMode')) + '">' + icon(dark ? 'sun' : 'moon') + '</button>' +
        '</div>' +
        '<div class="picker">' +
          '<button type="button" class="icon-btn" data-action="prev-tb" aria-label="' + esc(t('prev')) + '">' + icon('prev', 'flip-rtl') + '</button>' +
          '<div class="name"><div class="ar" id="h-ar">' + esc(tb.ar) + '</div><div class="sub" id="h-sub">' + esc(subtitle(tb)) + '</div></div>' +
          '<button type="button" class="icon-btn" data-action="next-tb" aria-label="' + esc(t('next')) + '">' + icon('next', 'flip-rtl') + '</button>' +
        '</div>' +
        '<div class="counter-wrap">' +
          '<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="45"/><circle class="bar" id="ring-bar" cx="50" cy="50" r="45" stroke-dasharray="' + CIRC.toFixed(3) + '" stroke-dashoffset="' + (CIRC * (1 - progressFrac(tb))).toFixed(3) + '"/></svg>' +
          '<div class="counter-face"><div class="count-num num" id="cnt-num" role="status" aria-live="off">' + fmt(tb.count) + '</div><div class="count-sub" id="cnt-sub"></div></div>' +
        '</div>' +
        '<div class="target-row">' +
          '<button type="button" class="chip btnlike" data-action="edit-target" aria-label="' + esc(t('setTarget')) + '">' + icon('target') + '<span id="target-txt"></span></button>' +
          '<button type="button" class="chip btnlike fav-btn" id="fav-btn" data-action="toggle-fav" aria-label="' + esc(t('favorite')) + '" aria-pressed="' + tb.fav + '">' + icon(tb.fav ? 'starfill' : 'star') + '</button>' +
          '<button type="button" class="chip btnlike" data-action="reset" aria-label="' + esc(t('reset')) + '">' + icon('reset') + '<span>' + esc(t('reset')) + '</span></button>' +
        '</div>' +
        '<div class="tap-zone">' +
          '<button type="button" class="icon-btn side-btn" data-action="minus" aria-label="' + esc(t('minusOne')) + '">' + icon('minus') + '</button>' +
          '<button type="button" class="tap-btn" id="tap-btn" data-tap="1" aria-label="' + esc(t('countPlus')) + '">' + icon('plus') + '<span class="tap-label">+1</span></button>' +
          '<button type="button" class="icon-btn side-btn" data-action="undo" aria-label="' + esc(t('undo')) + '">' + icon('undo') + '</button>' +
        '</div>' +
        '<div class="card today-strip" id="today-strip"></div>' +
      '</div>';
    updateCounter(false);
  }

  /** Cheap partial update used on every tap (no full re-render, keeps taps fast). */
  function updateCounter(pop) {
    if (!$('#home-root')) return;
    const tb = active();
    const num = $('#cnt-num');
    num.textContent = fmt(tb.count);
    num.classList.toggle('long', String(tb.count).length > 5);
    if (pop) { num.classList.add('pop'); setTimeout(function () { num.classList.remove('pop'); }, 90); }
    $('#ring-bar').style.strokeDashoffset = (CIRC * (1 - progressFrac(tb))).toFixed(3);
    $('#cnt-sub').innerHTML = subHTML(tb);
    $('#target-txt').textContent = t('target') + ': ' + fmt(tb.target);
    const goal = state.settings.goal;
    const tt = todayTotal();
    $('#today-strip').innerHTML =
      '<div class="grow"><div class="row between small"><span>' + esc(t('today')) + ': <b class="num">' + fmt(tt) + '</b></span><span class="muted">' + esc(t('dailyGoal')) + ': <span class="num">' + fmt(goal) + '</span></span></div>' +
      '<div class="bar" style="margin-top:6px"><i style="width:' + Math.min(100, Math.round(tt / goal * 100)) + '%"></i></div></div>' +
      '<span class="chip">' + icon('flame') + '<span class="num">' + fmt(streakDays()) + '</span></span>';
  }

  function stepTasbeeh(dir) {
    const list = ordered();
    const i = list.findIndex(function (b) { return b.id === state.activeId; });
    state.activeId = list[(i + dir + list.length) % list.length].id;
    save();
    renderHome();
  }

  function showComplete(tb) {
    let sparks = '';
    for (let i = 0; i < 14; i++) sparks += '<i style="inset-inline-start:' + Math.round(Math.random() * 92) + '%;bottom:' + Math.round(Math.random() * 30) + '%;animation-delay:' + (Math.random() * 0.6).toFixed(2) + 's"></i>';
    const ov = openSheet(
      '<div class="sparkles" aria-hidden="true">' + sparks + '</div><div class="celebrate">' +
      '<div class="badge-ring">' + icon('check') + '</div>' +
      '<h2>' + esc(t('completeTitle')) + '</h2><div class="ar">' + esc(tb.ar) + '</div>' +
      '<p class="msg">' + esc(t('completeMsg', { n: fmt(tb.target) })) + '</p>' +
      '<div class="btns"><button type="button" class="btn primary" data-modal="continue" data-autofocus>' + esc(t('continueCount')) + '</button>' +
      '<button type="button" class="btn" data-modal="new">' + esc(t('newSession')) + '</button></div></div>',
      { center: true, cls: 'celebrate-sheet' }
    );
    ov.addEventListener('click', function (e) {
      const b = e.target.closest('[data-modal]');
      if (!b) return;
      closeSheet();
      if (b.dataset.modal === 'new') { endSession(tb); updateCounter(false); toast(t('sessionStarted')); }
    });
  }

  // ---- Tasbeeh tab ----------------------------------------------------------
  let tbFilter = 'all';
  function renderTasbeeh() {
    let list = ordered();
    if (tbFilter === 'fav') list = list.filter(function (b) { return b.fav; });
    const cards = list.map(function (b) {
      const isActive = b.id === state.activeId;
      return '<div class="card tcard' + (isActive ? ' active' : '') + '" data-id="' + b.id + '">' +
        '<div><div class="ar">' + esc(b.ar) + (isActive ? '<span class="badge">' + esc(t('active')) + '</span>' : '') + (b.builtin ? '' : '<span class="badge custom">' + esc(t('custom')) + '</span>') + '</div>' +
        '<div class="meta">' + esc(subtitle(b)) + '</div></div>' +
        '<button type="button" class="icon-btn plain fav-btn" data-action="fav" data-id="' + b.id + '" aria-pressed="' + b.fav + '" aria-label="' + esc(t('favorite')) + '">' + icon(b.fav ? 'starfill' : 'star') + '</button>' +
        '<div class="mini-bar"><div class="bar"><i style="width:' + Math.round(Math.min(1, b.count / b.target) * 100) + '%"></i></div>' +
        '<div class="meta" style="margin-top:6px">' + esc(t('session')) + ': <b class="num">' + fmt(b.count) + '/' + fmt(b.target) + '</b> · ' + esc(t('total')) + ': <b class="num">' + fmt(b.total) + '</b> · ' + icon('check', 'sm') + '<b class="num">' + fmt(b.completed) + '</b></div></div>' +
        '<div class="actions"><button type="button" class="btn primary small grow" data-action="select" data-id="' + b.id + '">' + esc(t('select')) + '</button>' +
        '<button type="button" class="btn small" data-action="edit-tb" data-id="' + b.id + '">' + icon('edit', 'sm') + ' ' + esc(t('edit')) + '</button></div></div>';
    }).join('');
    $('#view-tasbeeh').innerHTML =
      '<div class="page-title"><h1>' + esc(t('tasbeehTitle')) + '</h1>' +
      '<div class="filters"><button type="button" class="chip btnlike" data-action="filter" data-f="all" aria-pressed="' + (tbFilter === 'all') + '">' + esc(t('all')) + '</button>' +
      '<button type="button" class="chip btnlike" data-action="filter" data-f="fav" aria-pressed="' + (tbFilter === 'fav') + '">' + icon('star', 'sm') + esc(t('favorites')) + '</button></div></div>' +
      (cards || '<div class="empty">' + esc(t('noFavorites')) + '</div>') +
      '<button type="button" class="add-card" data-action="add-tb">' + icon('plus') + '<span>' + esc(t('addCustom')) + '</span></button>';
  }

  function targetField(val) {
    return '<label class="field"><span>' + esc(t('target')) + '</span>' +
      '<input class="input num" id="f-target" inputmode="numeric" autocomplete="off" maxlength="9" value="' + esc(val) + '">' +
      '<div class="presets">' + PRESETS.map(function (p) { return '<button type="button" data-preset="' + p + '" aria-pressed="' + (p === val) + '">' + fmt(p) + '</button>'; }).join('') + '</div>' +
      '<div class="err" id="e-target"></div></label>';
  }
  function wirePresets(ov) {
    const input = $('#f-target', ov);
    function sync() { $$('[data-preset]', ov).forEach(function (b) { b.setAttribute('aria-pressed', String(parseNumber(input.value) === +b.dataset.preset)); }); }
    ov.addEventListener('click', function (e) {
      const b = e.target.closest('[data-preset]');
      if (b) { input.value = b.dataset.preset; sync(); }
    });
    input.addEventListener('input', sync);
  }
  function readTarget(ov) {
    const v = parseNumber($('#f-target', ov).value);
    const err = $('#e-target', ov);
    if (!(v >= 1 && v <= MAX_TARGET)) {
      err.textContent = t('errTarget', { n: fmt(MAX_TARGET) });
      $('#f-target', ov).setAttribute('aria-invalid', 'true');
      return NaN;
    }
    err.textContent = '';
    $('#f-target', ov).removeAttribute('aria-invalid');
    return v;
  }

  /** Quick target sheet from the Home screen. */
  function openTargetSheet() {
    const tb = active();
    const ov = openSheet(
      '<h2>' + esc(t('setTarget')) + '</h2><div class="ar" style="font-size:24px;text-align:center">' + esc(tb.ar) + '</div>' +
      '<form id="t-form" novalidate>' + targetField(tb.target) +
      '<div class="btns"><button type="button" class="btn" data-modal="cancel">' + esc(t('cancel')) + '</button><button type="submit" class="btn primary">' + esc(t('save')) + '</button></div></form>'
    );
    wirePresets(ov);
    $('[data-modal="cancel"]', ov).addEventListener('click', closeSheet);
    $('#t-form', ov).addEventListener('submit', function (e) {
      e.preventDefault();
      const v = readTarget(ov);
      if (isNaN(v)) return;
      tb.target = v;
      save(); closeSheet(); updateCounter(false); toast(t('targetSaved'));
    });
  }

  /** Add / edit sheet for a tasbeeh (id = null → add a new custom one). */
  function openTbSheet(id) {
    const tb = id ? byId(id) : null;
    const isNew = !tb;
    const custom = isNew || !tb.builtin;
    const sess = tb ? tb.sessions.slice(-5).reverse() : [];
    const html =
      '<h2>' + esc(isNew ? t('addCustom') : t('editTasbeeh')) + '</h2>' +
      '<form id="tb-form" novalidate>' +
      (custom
        ? '<label class="field"><span>' + esc(t('zikrArabic')) + '</span><input class="input ar-input" id="f-ar" maxlength="80" autocomplete="off" dir="rtl" value="' + esc(tb ? tb.ar : '') + '"><div class="err" id="e-ar"></div></label>' +
          '<label class="field"><span>' + esc(t('zikrName')) + '</span><input class="input" id="f-tr" maxlength="40" autocomplete="off" value="' + esc(tb ? tb.tr : '') + '"><div class="err" id="e-tr"></div></label>'
        : '<div class="ar" style="font-size:28px;text-align:center">' + esc(tb.ar) + '</div><p class="muted small" style="text-align:center">' + esc(subtitle(tb)) + '</p>') +
      targetField(tb ? tb.target : 100) +
      '<div class="btns"><button type="button" class="btn" data-modal="cancel">' + esc(t('cancel')) + '</button><button type="submit" class="btn primary">' + esc(t('save')) + '</button></div></form>' +
      (tb ? '<div class="section-title">' + esc(t('sessions')) + '</div>' +
        (sess.length ? sess.map(function (s) { return '<div class="row between small" style="padding:3px 0"><span class="muted">' + esc(fmtDate(keyToDate(s.d))) + '</span><b class="num">' + fmt(s.n) + ' / ' + fmt(s.t) + '</b></div>'; }).join('') : '<div class="muted small">' + esc(t('noSessions')) + '</div>') +
        '<div class="btns"><button type="button" class="btn" data-modal="newsession">' + icon('reset', 'sm') + ' ' + esc(t('newSession')) + '</button>' +
        (custom ? '<button type="button" class="btn danger" data-modal="delete">' + icon('trash', 'sm') + ' ' + esc(t('delete')) + '</button>' : '') + '</div>' : '');
    const ov = openSheet(html);
    wirePresets(ov);

    ov.addEventListener('click', function (e) {
      const b = e.target.closest('[data-modal]');
      if (!b) return;
      const act = b.dataset.modal;
      if (act === 'cancel') closeSheet();
      if (act === 'newsession') {
        closeSheet();
        confirmDialog({ title: t('newSessionTitle'), msg: t('newSessionMsg'), ok: t('newSession') }).then(function (ok) {
          if (ok) { endSession(tb); renderCurrent(); toast(t('sessionStarted')); }
        });
      }
      if (act === 'delete') {
        closeSheet();
        confirmDialog({ title: t('deleteTitle'), msg: t('deleteMsg', { name: tb.ar }), ok: t('delete'), danger: true }).then(function (ok) {
          if (!ok) return;
          state.deleted[tb.id] = { ar: tb.ar, tr: tb.tr };
          state.tasbeehs = state.tasbeehs.filter(function (x) { return x.id !== tb.id; });
          state.undo = state.undo.filter(function (u) { return u.id !== tb.id; });
          if (state.activeId === tb.id) state.activeId = 'b1';
          save(); renderCurrent(); toast(t('deleted'));
        });
      }
    });

    $('#tb-form', ov).addEventListener('submit', function (e) {
      e.preventDefault();
      let ok = true;
      const target = readTarget(ov);
      if (isNaN(target)) ok = false;
      let ar = '', tr = '';
      if (custom) {
        ar = cleanText($('#f-ar', ov).value, 80);
        tr = cleanText($('#f-tr', ov).value, 40);
        const eAr = $('#e-ar', ov);
        eAr.textContent = '';
        $('#f-ar', ov).removeAttribute('aria-invalid');
        if (!ar) { eAr.textContent = t('errEmpty'); ok = false; }
        else if ($('#f-ar', ov).value.trim().length > 80) { eAr.textContent = t('errLong', { n: 80 }); ok = false; }
        else if (state.tasbeehs.some(function (x) { return x.ar === ar && (!tb || x.id !== tb.id); })) { eAr.textContent = t('errDup'); ok = false; }
        if (eAr.textContent) $('#f-ar', ov).setAttribute('aria-invalid', 'true');
      }
      if (!ok) return;
      if (isNew) {
        const n = { id: uid(), builtin: false, ar: ar, tr: tr, target: target, count: 0, total: 0, completed: 0, fav: false, sessions: [] };
        state.tasbeehs.push(n);
        state.activeId = n.id;
        toast(t('added'));
      } else {
        tb.target = target;
        if (custom) { tb.ar = ar; tb.tr = tr; }
        toast(t('saved'));
      }
      save(); closeSheet(); renderCurrent();
    });
  }

  // ---- History ----------------------------------------------------------------
  function fmtDate(d, withYear) {
    return d.toLocaleDateString(lang() === 'ur' ? 'ur-PK' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: withYear === false ? undefined : 'numeric' });
  }
  function dayBreakdown(rec) {
    return Object.keys(rec.per).sort(function (a, b) { return rec.per[b] - rec.per[a]; }).map(function (id) {
      return '<div><span class="ar">' + esc(nameOf(id)) + (byId(id) || !state.deleted[id] ? '' : ' <small class="muted">' + esc(t('noteDeleted')) + '</small>') + '</span><b class="num">' + fmt(rec.per[id]) + '</b></div>';
    }).join('');
  }

  function renderHistory() {
    const key = dateKey();
    const today = state.days[key] || { total: 0, per: {} };
    const goal = state.settings.goal;

    // Weekly chart: the last 7 local days, oldest first
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(new Date(), -i);
      const k = dateKey(d);
      week.push({ k: k, total: state.days[k] ? state.days[k].total : 0, label: d.toLocaleDateString(lang() === 'ur' ? 'ur-PK' : 'en-US', { weekday: 'short' }) });
    }
    const max = Math.max.apply(null, week.map(function (w) { return w.total; }).concat([goal, 1]));
    const bars = week.map(function (w) {
      return '<div class="col' + (w.k === key ? ' today' : '') + '"><span class="val num">' + (w.total ? fmt(w.total) : '') + '</span><div class="b" style="height:' + Math.round(w.total / max * 100) + '%"></div><span class="lbl">' + esc(w.label) + '</span></div>';
    }).join('');
    const goalFrac = (goal / max).toFixed(4);

    const prev = Object.keys(state.days).filter(function (k) { return k !== key && state.days[k].total > 0; }).sort().reverse().slice(0, 90);
    const prevHtml = prev.length
      ? '<div class="card day-list">' + prev.map(function (k) {
        const r = state.days[k];
        return '<details><summary><span>' + esc(fmtDate(keyToDate(k))) + '</span><b class="num">' + fmt(r.total) + '</b></summary><div class="detail">' + dayBreakdown(r) + '</div></details>';
      }).join('') + '</div>'
      : '<div class="card empty">' + esc(t('noPrev')) + '</div>';

    $('#view-history').innerHTML =
      '<div class="page-title"><h1>' + esc(t('histTitle')) + '</h1></div>' +
      '<div class="stats">' +
        '<div class="stat"><div class="k">' + icon('target') + esc(t('today')) + '</div><div class="v num" id="h-today">' + fmt(today.total) + '</div></div>' +
        '<div class="stat"><div class="k">' + icon('beads') + esc(t('lifetime')) + '</div><div class="v num" id="h-life">' + fmt(state.lifetime) + '</div></div>' +
        '<div class="stat"><div class="k">' + icon('check') + esc(t('completedTargets')) + '</div><div class="v num" id="h-done">' + fmt(state.completedTotal) + '</div></div>' +
        '<div class="stat"><div class="k">' + icon('flame') + esc(t('streak')) + '</div><div class="v num" id="h-streak">' + fmt(streakDays()) + '</div></div>' +
      '</div>' +
      '<div class="card" style="margin-top:12px"><div class="row between small"><b>' + esc(t('dailyGoal')) + '</b><span class="num">' + fmt(today.total) + ' / ' + fmt(goal) + '</span></div>' +
        '<div class="bar" style="margin-top:8px"><i style="width:' + Math.min(100, Math.round(today.total / goal * 100)) + '%"></i></div></div>' +
      '<div class="section-title">' + esc(t('last7')) + '</div>' +
      '<div class="card"><div class="chart" role="img" aria-label="' + esc(t('last7')) + '">' + bars + '<div class="goal-line" style="bottom:calc(20px + (100% - 36px) * ' + goalFrac + ')"><span class="num">' + fmt(goal) + '</span></div></div></div>' +
      '<div class="section-title">' + esc(t('todayBy')) + '</div>' +
      '<div class="card day-list">' + (today.total > 0 && Object.keys(today.per).length ? '<div class="detail" style="padding-top:6px">' + dayBreakdown(today) + '</div>' : '<div class="empty" style="padding:8px">' + esc(t('noToday')) + '</div>') + '</div>' +
      '<div class="row" style="margin-top:12px"><button type="button" class="btn primary grow" data-action="share-today">' + icon('share', 'sm') + ' ' + esc(t('shareToday')) + '</button>' +
      '<button type="button" class="btn danger" data-action="reset-today">' + icon('reset', 'sm') + ' ' + esc(t('resetToday')) + '</button></div>' +
      '<div class="section-title">' + esc(t('prevDays')) + '</div>' + prevHtml;
  }

  // ---- Settings --------------------------------------------------------------
  let swState = 'unknown';     // 'unknown' | 'preparing' | 'ready' | 'unsupported'
  let deferredInstall = null;
  let persisted = null;

  function toggleRow(key, labelKey, descKey) {
    return '<div class="setting"><div class="label"><b>' + esc(t(labelKey)) + '</b><span>' + esc(t(descKey)) + '</span></div>' +
      '<button type="button" class="switch" role="switch" data-action="toggle" data-key="' + key + '" aria-checked="' + state.settings[key] + '" aria-label="' + esc(t(labelKey)) + '"></button></div>';
  }
  function readJson(key) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; } }

  function renderSettings() {
    const s = state.settings;
    const snap = readJson(SNAP_KEY);
    const hasSafety = !!readJson(PREV_KEY);
    const swText = swState === 'ready' ? t('offlineReady') : swState === 'unsupported' ? t('offlineNo') : t('offlinePrep');
    $('#view-settings').innerHTML =
      '<div class="page-title"><h1>' + esc(t('settingsTitle')) + '</h1></div>' +
      '<div class="card"><div class="section-title" style="margin-top:0">' + esc(t('appearance')) + '</div>' +
        '<div class="setting"><div class="label"><b>' + esc(t('language')) + '</b></div><div class="seg" style="min-width:170px">' +
          '<button type="button" data-action="set-lang" data-v="en" aria-pressed="' + (s.lang === 'en') + '">English</button>' +
          '<button type="button" data-action="set-lang" data-v="ur" aria-pressed="' + (s.lang === 'ur') + '">اردو</button></div></div>' +
        '<div class="setting"><div class="label"><b>' + esc(t('theme')) + '</b></div><div class="seg" style="min-width:210px">' +
          ['auto', 'light', 'dark'].map(function (v) { return '<button type="button" data-action="set-theme" data-v="' + v + '" aria-pressed="' + (s.theme === v) + '">' + esc(t('theme' + v.charAt(0).toUpperCase() + v.slice(1))) + '</button>'; }).join('') + '</div></div></div>' +
      '<div class="card"><div class="section-title" style="margin-top:0">' + esc(t('counting')) + '</div>' +
        toggleRow('vibrate', 'vibration', 'vibrationDesc') + toggleRow('sound', 'sound', 'soundDesc') + toggleRow('wake', 'wake', 'wakeDesc') +
        '<form id="goal-form" class="setting" novalidate style="flex-wrap:wrap"><div class="label"><b>' + esc(t('dailyGoal')) + '</b><span>' + esc(t('goalDesc')) + '</span></div>' +
        '<input class="input num" id="goal-input" inputmode="numeric" autocomplete="off" maxlength="9" style="width:110px;text-align:center" value="' + s.goal + '" aria-label="' + esc(t('dailyGoal')) + '">' +
        '<button type="submit" class="btn small">' + esc(t('goalSave')) + '</button><div class="err" id="goal-err" style="flex-basis:100%"></div></form></div>' +
      '<div class="card"><div class="section-title" style="margin-top:0">' + esc(t('backup')) + '</div>' +
        '<div style="display:grid;gap:10px">' +
        '<button type="button" class="btn block" data-action="export">' + icon('download', 'sm') + ' ' + esc(t('exportJson')) + '</button>' +
        '<button type="button" class="btn block" data-action="import">' + icon('upload', 'sm') + ' ' + esc(t('importJson')) + '</button>' +
        '<button type="button" class="btn block" data-action="snap-save">' + icon('save', 'sm') + ' ' + esc(t('snapSave')) + '</button>' +
        '<button type="button" class="btn block" data-action="snap-restore"' + (snap ? '' : ' disabled') + '>' + icon('reset', 'sm') + ' ' + esc(t('snapRestore')) + '</button>' +
        '<div class="muted small">' + esc(snap && snap.ts ? t('snapLast', { d: new Date(snap.ts).toLocaleString(lang() === 'ur' ? 'ur-PK' : 'en-GB') }) : t('snapNone')) + '</div>' +
        (hasSafety ? '<button type="button" class="btn block" data-action="restore-safety">' + icon('undo', 'sm') + ' ' + esc(t('restoreSafety')) + '</button><div class="muted small">' + esc(t('safetyDesc')) + '</div>' : '') +
        '</div></div>' +
      '<div class="card"><div class="section-title" style="margin-top:0">' + esc(t('about')) + '</div>' +
        '<div class="setting"><div class="label"><b>' + esc(t('appName')) + '</b><span>' + esc(t('tagline')) + '</span></div><span class="chip num">v' + APP_VERSION + '</span></div>' +
        '<div class="setting"><div class="label"><b>' + esc(swText) + '</b><span>' + esc(persisted === null ? '' : persisted ? t('storagePersist') : t('storageNormal')) + '</span></div>' +
        '<button type="button" class="btn small" data-action="check-update">' + esc(t('checkUpdate')) + '</button></div>' +
        (deferredInstall ? '<div class="setting"><div class="label"><b>' + esc(t('install')) + '</b><span>' + esc(t('installDesc')) + '</span></div><button type="button" class="btn gold small" data-action="install">' + esc(t('install')) + '</button></div>' : '') +
      '</div>';
  }

  /* ======================================================================
     9. BACKUP / SHARE
     ====================================================================== */
  function exportBackup() {
    const payload = { app: BACKUP_APP_ID, version: 1, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), data: state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'noor-e-tasbeeh-backup-' + dateKey() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast(t('exported'));
  }

  /** Save the current data as a safety copy before it gets replaced. Returns false if that failed. */
  function makeSafetyCopy() {
    try { localStorage.setItem(PREV_KEY, JSON.stringify({ ts: Date.now(), data: state })); return true; }
    catch (e) { return false; }
  }

  function replaceState(newState, safetyOk) {
    state = newState;
    save();
    applyTheme(); applyLang();
    renderAll();
    updateWake();
  }

  function handleImportFile(file) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast(t('importBad'), { type: 'error' }); return; }
    const reader = new FileReader();
    reader.onerror = function () { toast(t('importBad'), { type: 'error' }); };
    reader.onload = function () {
      let parsed;
      try {
        const obj = JSON.parse(String(reader.result));
        if (!obj || obj.app !== BACKUP_APP_ID || !obj.data) throw new Error('not a backup');
        parsed = { st: normalizeState(obj.data), at: obj.exportedAt };
      } catch (e) { toast(t('importBad'), { type: 'error' }); return; }
      const when = parsed.at && !isNaN(Date.parse(parsed.at)) ? new Date(parsed.at).toLocaleDateString(lang() === 'ur' ? 'ur-PK' : 'en-GB') : '—';
      confirmDialog({ title: t('importTitle'), msg: t('importMsg', { d: when, n: fmt(parsed.st.lifetime) }), ok: t('importOk'), danger: true }).then(function (ok) {
        if (!ok) return;
        if (!makeSafetyCopy()) toast(t('safetyFail'), { type: 'error', duration: 8000 });
        replaceState(parsed.st);
        toast(t('imported'));
      });
    };
    reader.readAsText(file);
  }

  function restoreFrom(key) {
    const rec = readJson(key);
    if (!rec || !rec.data) return;
    let st;
    try { st = normalizeState(rec.data); } catch (e) { toast(t('importBad'), { type: 'error' }); return; }
    confirmDialog({ title: t('restoreTitle'), msg: t('restoreMsg'), ok: t('snapRestore') }).then(function (ok) {
      if (!ok) return;
      if (!makeSafetyCopy()) toast(t('safetyFail'), { type: 'error', duration: 8000 });
      replaceState(st);
      toast(t('restored'));
    });
  }

  function shareText() {
    const key = dateKey();
    const rec = state.days[key] || { total: 0, per: {} };
    const lines = [t('shareHeader') + ' — ' + fmtDate(new Date()), t('byLabel') + ': ' + fmt(rec.total)];
    Object.keys(rec.per).sort(function (a, b) { return rec.per[b] - rec.per[a]; }).forEach(function (id) { lines.push('• ' + nameOf(id) + ': ' + fmt(rec.per[id])); });
    lines.push(t('lifetimeLabel') + ': ' + fmt(state.lifetime) + ' | ' + t('streak') + ': ' + streakDays());
    lines.push('Noor-e-Tasbeeh');
    return lines.join('\n');
  }
  function shareToday() {
    const text = shareText();
    function fallback() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast(t('copied')); }, manualCopy);
      } else manualCopy();
    }
    function manualCopy() {
      const ov = openSheet('<h2>' + esc(t('copyManual')) + '</h2><textarea class="input" id="copy-area" rows="8" readonly style="user-select:text">' + esc(text) + '</textarea><div class="btns"><button type="button" class="btn primary" data-modal="close">' + esc(t('close')) + '</button></div>');
      $('[data-modal="close"]', ov).addEventListener('click', closeSheet);
      const ta = $('#copy-area', ov); ta.focus(); ta.select();
    }
    if (navigator.share) {
      navigator.share({ title: t('shareTitle'), text: text }).catch(function (e) { if (!e || e.name !== 'AbortError') fallback(); });
    } else fallback();
  }

  /* ======================================================================
     10. PWA
     ====================================================================== */
  let swReg = null;
  let updateRequested = false;

  function updateOnline() {
    const chip = $('#offline-chip');
    if (!chip) return;
    const off = navigator.onLine === false;
    chip.hidden = !off;
    chip.innerHTML = off ? icon('offline', 'sm') + '<span>' + esc(t('offline')) + '</span>' : '';
  }

  function promptUpdate(worker) {
    toast(t('updateAvail'), {
      duration: 15000,
      action: { label: t('updateBtn'), fn: function () { updateRequested = true; worker.postMessage({ type: 'SKIP_WAITING' }); } }
    });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) { swState = 'unsupported'; return; }
    swState = 'preparing';
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      // Reload only when the user asked for an update (user data lives in localStorage and is untouched).
      if (updateRequested) location.reload();
    });
    navigator.serviceWorker.register('service-worker.js').then(function (reg) {
      swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(nw);
        });
      });
    }).catch(function () { swState = 'unsupported'; if (currentTab === 'settings') renderSettings(); });
    navigator.serviceWorker.ready.then(function () { swState = 'ready'; if (currentTab === 'settings') renderSettings(); });
  }

  /* ======================================================================
     11. EVENTS & START-UP
     ====================================================================== */
  const actions = {
    tab: function (el) { switchTab(el.dataset.tab); },
    'toggle-night': function () { state.settings.theme = resolvedTheme() === 'dark' ? 'light' : 'dark'; save(); applyTheme(); renderCurrent(); },
    'prev-tb': function () { stepTasbeeh(-1); },
    'next-tb': function () { stepTasbeeh(1); },
    'edit-target': openTargetSheet,
    'toggle-fav': function () { const tb = active(); tb.fav = !tb.fav; save(); renderHome(); },
    minus: minusOne,
    undo: undoLast,
    reset: function () {
      const tb = active();
      if (tb.count === 0) { toast(t('nothingToUndo')); return; }
      confirmDialog({ title: t('resetTitle'), msg: t('resetMsg', { n: fmt(tb.count) }), ok: t('resetOk'), danger: true }).then(function (ok) {
        if (ok) { endSession(tb); updateCounter(false); toast(t('sessionStarted')); }
      });
    },
    filter: function (el) { tbFilter = el.dataset.f; renderTasbeeh(); },
    fav: function (el) { const tb = byId(el.dataset.id); if (tb) { tb.fav = !tb.fav; save(); renderTasbeeh(); } },
    select: function (el) { if (byId(el.dataset.id)) { state.activeId = el.dataset.id; save(); switchTab('home'); } },
    'edit-tb': function (el) { openTbSheet(el.dataset.id); },
    'add-tb': function () { openTbSheet(null); },
    'share-today': shareToday,
    'reset-today': function () {
      const key = dateKey();
      const total = todayTotal();
      if (!total) { toast(t('noToday')); return; }
      confirmDialog({ title: t('resetTodayTitle'), msg: t('resetTodayMsg', { n: fmt(total) }), ok: t('resetToday'), danger: true }).then(function (ok) {
        if (!ok) return;
        state.days[key] = { total: 0, per: {} };
        state.undo = state.undo.filter(function (u) { return u.key !== key; });   // those entries no longer apply
        save(); renderCurrent(); toast(t('todayReset'));
      });
    },
    'set-lang': function (el) { state.settings.lang = el.dataset.v === 'ur' ? 'ur' : 'en'; save(); renderAll(); },
    'set-theme': function (el) { state.settings.theme = el.dataset.v; save(); applyTheme(); renderCurrent(); },
    toggle: function (el) {
      const k = el.dataset.key;
      if (['vibrate', 'sound', 'wake'].indexOf(k) < 0) return;
      state.settings[k] = !state.settings[k];
      save(); renderSettings(); updateWake();
      if (k === 'vibrate' && state.settings.vibrate && navigator.vibrate) navigator.vibrate(30);
    },
    export: exportBackup,
    import: function () { const f = $('#import-file'); f.value = ''; f.click(); },
    'snap-save': function () {
      try { localStorage.setItem(SNAP_KEY, JSON.stringify({ ts: Date.now(), data: state })); toast(t('snapSaved')); }
      catch (e) { toast(t('snapFail'), { type: 'error' }); }
      renderSettings();
    },
    'snap-restore': function () { restoreFrom(SNAP_KEY); },
    'restore-safety': function () { restoreFrom(PREV_KEY); },
    'check-update': function () {
      if (!swReg) { toast(t('offlineNo')); return; }
      swReg.update().then(function () {
        if (swReg.waiting) promptUpdate(swReg.waiting); else toast(t('upToDate'));
      }).catch(function () { toast(t('upToDate')); });
    },
    install: function () {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      deferredInstall.userChoice.finally(function () { deferredInstall = null; renderSettings(); });
    }
  };

  function wireEvents() {
    // Counting: pointerdown gives instant response on touch screens. A click with detail === 0
    // (keyboard / screen-reader activation) is also supported. The browser's follow-up click
    // after a touch/mouse tap is ignored so one tap can never count twice.
    document.addEventListener('pointerdown', function (e) {
      const b = e.target.closest && e.target.closest('[data-tap]');
      if (!b) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      lastPointerTapAt = performance.now();
      b.classList.add('pressed');
      tap();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      document.addEventListener(ev, function () { $$('.tap-btn.pressed').forEach(function (b) { b.classList.remove('pressed'); }); }, true);
    });
    document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest('[data-tap]')) e.preventDefault(); });

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-tap]')) {
        if (e.detail === 0 && performance.now() - lastPointerTapAt > 800) tap();
        return;
      }
      const a = e.target.closest('[data-action]');
      if (a && actions[a.dataset.action]) actions[a.dataset.action](a, e);
    });

    document.addEventListener('submit', function (e) {
      if (e.target.id !== 'goal-form') return;
      e.preventDefault();
      const v = parseNumber($('#goal-input').value);
      if (!(v >= 1 && v <= MAX_TARGET)) { $('#goal-err').textContent = t('goalInvalid', { n: fmt(MAX_TARGET) }); return; }
      state.settings.goal = v;
      save(); renderSettings(); toast(t('goalSaved'));
    });

    $('#import-file').addEventListener('change', function (e) { handleImportFile(e.target.files && e.target.files[0]); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') save();
      else { checkNewDay(); if (swReg) swReg.update().catch(function () {}); }
      updateWake();
    });
    window.addEventListener('pagehide', save);

    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const h = function () { if (state.settings.theme === 'auto') { applyTheme(); renderCurrent(); } };
      if (mq.addEventListener) mq.addEventListener('change', h); else if (mq.addListener) mq.addListener(h);
    }
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (currentTab === 'settings') renderSettings(); });
    window.addEventListener('appinstalled', function () { deferredInstall = null; if (currentTab === 'settings') renderSettings(); });
  }

  // Start a fresh daily record automatically when the local date changes (midnight, or app resumed next day).
  let shownDay = dateKey();
  function checkNewDay() {
    const k = dateKey();
    if (k !== shownDay) { shownDay = k; renderCurrent(); }
  }

  function init() {
    state = loadState();
    applyTheme(); applyLang();
    renderNav();
    switchTab('home');
    updateOnline();
    wireEvents();
    registerSW();
    setInterval(checkNewDay, 30000);
    if (!storageOk) toast(t('storageBlocked'), { type: 'error', duration: 10000 });
    // Ask the browser not to evict our data under storage pressure.
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(function (p) { persisted = !!p; }).catch(function () { });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
