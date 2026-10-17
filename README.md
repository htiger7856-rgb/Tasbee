# Noor-e-Tasbeeh – Digital Tasbee Counter

A free, offline digital tasbeeh counter for Android phones. It is a Progressive Web App (PWA)
built with plain HTML, CSS and JavaScript – **no server, no login, no ads, no tracking, no external requests.**

All counters, history and settings are stored on your own device (browser `localStorage`) and survive closing the
app and restarting the phone.

## Features

- 9 built-in tasbeeh (سبحان الله، الحمد لله، الله أكبر، لا إله إلا الله، أستغفر الله، اللهم صل على محمد، لا حول ولا قوة إلا بالله، سبحان الله وبحمده، سبحان الله العظيم) **plus unlimited custom tasbeeh** with your own Arabic zikr
- Each tasbeeh has its own counter, target (33 / 100 / 500 / 1,000 / any number), total, completed-target count and saved progress
- Large +1 button, minus-one, **undo**, reset (always asks first), progress ring, remaining count
- Completion animation, continue counting beyond the target, or start a new session (old sessions are kept in history)
- Vibration and sound feedback (each can be switched off), keep-screen-awake, dark screen mode for night use
- Favorites, add / edit / delete custom tasbeeh (delete asks first and never removes recorded history)
- History: today, per-tasbeeh totals for today, previous days, lifetime total, completed targets, 7-day chart, daily goal, day streak
- A new day starts automatically at local midnight – lifetime totals are never touched
- Share today's totals through the Android share menu (falls back to copy)
- Export / import JSON backup, plus a one-tap on-device snapshot; a **safety copy** of your data is saved automatically before any import or restore, so it can be undone
- English and Urdu (اردو, right-to-left) interface, light / dark / auto theme
- Offline indicator; works 100 % offline after the first load

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell and inline SVG icons |
| `style.css` | Styling (emerald / dark green / gold / cream theme, light + dark) |
| `app.js` | All app logic (state, counting, history, backup, UI, PWA wiring) |
| `manifest.json` | Install metadata (name, icons, colors, standalone display) |
| `service-worker.js` | Caches every file so the app runs offline |
| `icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png` | App icons |
| `amiri-arabic-400-normal.woff2`, `amiri-arabic-700-normal.woff2`, `Amiri-OFL-LICENSE.txt` | Amiri Arabic font, bundled locally (SIL Open Font License) |

## Publish on GitHub Pages

1. Create a new GitHub repository (for example `noor-e-tasbeeh`).
2. Upload **the contents of the ZIP** (so `index.html` is at the top level of the repository): unzip it, then use "Add file → Upload files" and drag in all the files. There are no sub-folders – every file sits in one flat folder.
3. Go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, select branch `main` and folder `/ (root)`, then **Save**.
4. After a minute the app is live at `https://YOUR-USERNAME.github.io/noor-e-tasbeeh/`.

All paths in the app are relative, so it works from a sub-folder like this without changes. The page must be served over **HTTPS** (GitHub Pages does this) – service workers do not run from `file://`.

## Install on Android

1. Open the GitHub Pages link in **Chrome** and wait for the page to finish loading once (this downloads the offline files).
2. Chrome menu **⋮ → Install app** (or *Add to Home screen*). Settings → About also shows an **Install app** button when Chrome offers it.
3. Open it from the home screen. Turn on airplane mode to confirm: the app, counters, history and settings all still work.

## Using the app

- **Home** – tap the big **+1** button. **−** removes one, the arrow button undoes the last action, **Reset** starts the counter from 0 (the old count is saved in the tasbeeh's session history). Tap **Target** to change the target. Use the arrows to switch tasbeeh, the star to mark a favorite and the moon for night mode.
- **Tasbeeh** – all tasbeeh with their session count, total and completed targets. **Select** makes one active, **Edit** changes the target (and the name for custom ones), starts a new session or deletes a custom one. **Add custom tasbeeh** creates your own.
- **History** – today, lifetime, completed targets, streak, daily goal, 7-day chart, breakdown per tasbeeh, previous days (tap a day to expand). **Share today** opens the share menu. **Reset today** zeroes only today's daily total (asks first; lifetime and other days are unchanged).
- **Settings** – language, theme, vibration, sound, keep awake, daily goal, backup / restore, offline status, check for updates.

### Backup and restore

- **Export backup (JSON)** downloads `noor-e-tasbeeh-backup-YYYY-MM-DD.json`. Keep it somewhere safe (Drive, WhatsApp to yourself, etc.).
- **Import backup** replaces the current data with a backup file after you confirm. The file is validated first; your current data is saved as a *safety copy* that you can bring back with **Restore safety copy**.
- **Save snapshot / Restore snapshot** keep one extra copy inside the app on the same device.
- Browser data can be erased if you clear "site data" for the page or uninstall the app together with its data – export a backup now and then.

## Updating the app (for the publisher)

1. Change the files you want.
2. In `service-worker.js` change `const VERSION = '1.0.0';` to a new value (e.g. `'1.0.1'`) and commit.
3. Users who are online get a notice with an **Update** button. Updating only replaces the app files – saved counters, history and settings live in `localStorage` and are never deleted by an update.

## Privacy

Nothing leaves the device. There are no analytics, no accounts and no network requests apart from loading the app's own files from the site where it is hosted. The share button only sends text to the app *you* pick in the Android share menu.

## Tests that were run

Automated checks against the real code, in a simulated browser (jsdom) and in real Chromium (Playwright):

- Counter accuracy: touch taps, keyboard / screen-reader activation, duplicate-event protection, minus, undo, target completion, continue beyond target
- Independent progress for different tasbeeh; reset / new session of one tasbeeh leaves the others untouched
- Custom tasbeeh validation (empty, duplicate, bad target, Arabic-Indic digits), edit, favorite, delete with history kept, HTML escaped
- Persistence after closing and reopening, including settings (language / theme)
- Daily history: local-date keys, automatic new day, lifetime unchanged, streak, 7-day chart, reset today
- JSON export, import, rejection of invalid / hostile files, safety copy, restore, snapshot
- Service worker precaches all files; the app reloads and counts **with the network switched off**; no external requests are made
- Storage-failure and corrupted-data handling (data is never overwritten silently)

## Credits

Arabic typeface: **Amiri** by Khaled Hosny, SIL Open Font License 1.1 (see `Amiri-OFL-LICENSE.txt`).
