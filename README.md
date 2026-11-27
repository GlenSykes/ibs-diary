# IBS Diary

A personal Android app for logging food, drink, IBS symptoms, mood, stress and
sleep, to build a record and later look for patterns.

It is an installable web app (PWA): opened once in Chrome on the phone, then
added to the home screen, after which it runs offline like a normal app.

## What it records

| Entry | Fields |
|---|---|
| Food & drink | one or more library foods or recipes, each small / normal / large |
| Symptoms | pain, bloating, wind, belching, each 0 to 3 (none, mild, moderate, severe) |
| Bowel movement | Bristol stool type 1 to 7, urgency 0 to 3 |
| Mood & stress | mood, stress, energy, each 1 to 5 (any can be skipped) |
| Sleep | hours, quality 1 to 5, time woken |

Every entry's time can be changed, since IBS reactions often lag hours.

**Food is never free text.** It is picked from a library (about 190 starter
foods in `js/seed.js`), and foods can be grouped into recipes. A food not in
the library is added once, with its FODMAP tags, and is then selectable.

Starter foods added to `js/seed.js` later reach phones already in use: the
app checks the list on every start and adds only foods it has never stored.
A food you edited or deleted keeps your version, and one whose name matches a
food you added yourself is skipped. Foods added on the phone stay on the
phone (and in backups); they do not flow back into `js/seed.js`.

FODMAP tags in the starter library are **approximate**, from general low-FODMAP
guidance at a normal serving. They are not Monash lab values; that data is
licensed and must not be copied in.

## Data

Stored only on the phone, in IndexedDB. The Data tab gives:

- **Backup** (JSON): everything, including deletions. Restorable. Shared
  backups are the same JSON with a `.txt` name, because Chrome on Android will
  not share a `.json` file ("Permission denied"); downloads stay `.json`.
- **CSV export** for analysis, in "long" format: one row per food eaten (recipes
  expanded into ingredients, with FODMAP tags) and one row per rating.
- **Restore**: merges a backup in; newest version of each record wins.

The home screen nags if there has been no backup for 7 days.

### Built for NAS sync later

`js/db.js` is written so sync can be added without changing the data format:
every record has a random id, an `updatedAt` stamp and soft deletes, and the
module already has `changesSince()` and `merge()` (newest wins). Restore uses
`merge()` today, so that path is already exercised. Starter foods have fixed
ids (`seed-...`) so two devices would not duplicate them.

Recipe ingredients are snapshotted into each food entry when it is logged, so
editing a recipe later does not rewrite past meals.

## Code

Plain JavaScript modules, no build step, no dependencies.

| File | Role |
|---|---|
| `index.html`, `css/app.css` | page shell, styles (light and dark) |
| `js/app.js` | start-up, routing, home screen, update prompt |
| `js/log.js` | the five logging screens |
| `js/picker.js` | food/recipe chooser |
| `js/library.js`, `js/foodform.js` | library and recipe editing |
| `js/history.js` | history and entry cards |
| `js/export.js` | backup, restore, CSV, Data screen |
| `js/db.js` | storage (see above) |
| `js/data.js` | categories, tags, scales. **Changing a key breaks saved data**; labels are safe |
| `js/seed.js` | starter food library. **Never change an existing food's name-derived id** |
| `sw.js` | offline support |

### Releasing a change

`sw.js` serves the app from a cache. **Bump `VERSION` in `sw.js` on every
release**, and add any new file to its `FILES` list, or phones keep running the
old copy. After a release the app shows "A new version is ready. Tap to
update"; it never reloads by itself, so nothing is lost mid-entry.

### Hosting

The source lives in the private `GlenSykes/home` repo under `ibs-diary/`.
GitHub Pages cannot serve a private repo on a free account, so a copy of this
folder alone is pushed to the public repo `GlenSykes/ibs-diary`, which Pages
serves at https://glensykes.github.io/ibs-diary/. Only the code is public;
diary data never leaves the phone.

To publish, commit in the home repo, then from its root:

```bash
git subtree push --prefix=ibs-diary https://github.com/GlenSykes/ibs-diary.git main
```

Pages rebuilds within a minute or two. Never edit the public repo directly,
or the next push will be refused.

### Running locally

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

then open http://localhost:8765. The service worker caches files, so during
development clear site data (or unregister the worker) to see edits.
