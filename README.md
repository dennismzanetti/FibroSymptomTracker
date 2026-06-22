# FibroSymptomTracker

**Version 3.0** — A web-based Fibromyalgia symptom tracking application built with vanilla JavaScript and Firebase.

---

## Overview

FibroSymptomTracker is a personal health dashboard designed to help people with Fibromyalgia log, review, and share their daily symptoms with their care team. Data is saved both locally (in the browser) and synced to Firebase Firestore for cloud persistence across sessions and devices.

---

## Features

### 📋 Today (Daily Entry)
- Log up to **4 time blocks** per day (Morning, Afternoon, Evening, Night)
- Track **pain level** (0–10 scale), **fatigue**, **sleep quality**, and **activity level** per block
- Record **symptoms**, **triggers**, and free-text **notes** for each block
- **Pain Body Map** — interactive body diagram for marking pain locations
- **Save Day** button syncs the entry locally and to Firestore with an animated toast confirmation

### 📓 Journal
- Chronological timeline of all saved days
- **5-column grid layout**: Date | Block Pills | Sleep + Mood | Tags | Avg Score
- Quick visual summary of each day without drilling in

### 📅 History
- Detailed day-by-day review of past entries
- Expandable block-level detail for any logged date

### 📈 Trends
- **Chart.js** powered line charts showing symptom scores over time
- Helps identify patterns in pain, fatigue, sleep, and mood

### 😊 Mood
- Dedicated Mood tab with a dedicated entry form
- **14-day sidebar** showing color-coded score pills, trend bars, and truncated notes
- Mood scores are included in Journal and History summaries

### 💊 Medications
- Full medication list management (add, edit, delete)
- Tracks medication name, dosage, frequency, and notes
- Synced to Firestore per user

### 🩺 Conditions
- Manage a list of diagnosed conditions beyond Fibromyalgia
- Free-form condition notes per entry

### 👥 Care Team
- Maintain a directory of healthcare providers (name, specialty, phone, notes)
- Print-friendly report generation (`print.js`) for sharing with providers

### ⚙️ Settings
- User profile configuration
- App preferences and display options
- Data export controls

---

## Architecture

### Frontend
- **Vanilla HTML / CSS / JavaScript** — no frontend framework
- **Partial-based HTML loading** — `loader.js` fetches HTML partials from the `partials/` directory and injects them into the DOM at runtime, keeping `index.html` lean
- **Modular CSS** — styles split into per-feature files in `css/` (`base.css`, `layout.css`, `entry.css`, `history.css`, `journal.css`, `mood.css`, `medications.css`, `careteam.css`, `pain-map.css`) with `styles.css` as a legacy override layer
- **Modular JS** — each tab has a corresponding module: `entry.js`, `history.js`, `journal.js`, `mood.js`, `medications.js`, `conditions.js`, `careteam.js`, `settings.js`, `trends.js`
- `app.js` — main application controller and tab routing
- `ui.js` — shared UI helpers (toasts, modals, tab switching)
- `auth.js` — authentication state management
- `diagnostics.js` — global error handling (loaded first)
- `build-info.js` — static build stamp displayed in the footer (SHA + commit message)

### Backend / Cloud
- **Firebase Authentication** (v8 compat SDK) — user sign-in/sign-out
- **Firebase Firestore** (v8 compat SDK) — cloud storage for all user data
- `firebase-init.js` — Firebase app initialization and config
- `cloud.js` — Firestore read/write helpers

### Third-Party Libraries (CDN)
| Library | Version | Use |
|---|---|---|
| Firebase App | 8.10.1 | Core Firebase SDK |
| Firebase Auth | 8.10.1 | Authentication |
| Firebase Firestore | 8.10.1 | Cloud database |
| Chart.js | 4.4.3 | Trends charts |

---

## File Structure

```
FibroSymptomTracker/
├── index.html              # App shell — loads partials and scripts
├── local-fibro.html        # Standalone single-file version (no cloud)
├── favicon.svg             # App icon
├── styles.css              # Legacy/global CSS overrides
│
├── css/                    # Modular stylesheets (one per feature)
│   ├── base.css
│   ├── layout.css
│   ├── entry.css
│   ├── history.css
│   ├── journal.css
│   ├── mood.css
│   ├── medications.css
│   ├── careteam.css
│   └── pain-map.css
│
├── partials/               # HTML fragments loaded at runtime
│   ├── auth.html
│   ├── header.html
│   ├── modals.html
│   ├── tab-today.html
│   ├── tab-journal.html
│   ├── tab-history.html
│   ├── tab-trends.html
│   ├── tab-mood.html
│   ├── tab-medications.html
│   ├── tab-conditions.html
│   ├── tab-careteam.html
│   └── tab-settings.html
│
├── app.js                  # Main controller, tab routing
├── auth.js                 # Auth state management
├── build-info.js           # Static build stamp
├── careteam.js             # Care team feature logic
├── cloud.js                # Firestore helpers
├── conditions.js           # Conditions feature logic
├── date.js                 # Date utility functions
├── diagnostics.js          # Global error handler (loads first)
├── entry.js                # Today entry feature logic
├── firebase-init.js        # Firebase configuration and init
├── history.js              # History tab logic
├── journal.js              # Journal tab logic
├── loader.js               # HTML partial loader
├── medications.js          # Medications feature logic
├── mood.js                 # Mood tab logic
├── print.js                # Print/report generation
├── settings.js             # Settings feature logic
├── trends.js               # Chart.js trend rendering
├── ui.js                   # Shared UI utilities
│
├── VERSION                 # Current version number
├── CHANGELOG.md            # Version history
└── commit-log.json         # Commit metadata for build footer
```

---

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/dennismzanetti/FibroSymptomTracker.git
   ```
2. Open `index.html` in a browser (requires a local server due to partial loading via `fetch`).
   ```bash
   # Example using the VS Code Live Server extension, or:
   npx serve .
   ```
3. Sign in with a Google account via Firebase Authentication.
4. Your data will be saved locally and synced to your Firestore collection.

> **Offline / no-cloud use:** Open `local-fibro.html` directly — this is a self-contained single-file version that stores data in `localStorage` only.

---

## Version History

See [CHANGELOG.md](CHANGELOG.md) for full release notes.

| Version | Date | Highlights |
|---|---|---|
| 3.0 | June 2026 | Current release |
| 2.1.0 | May 2026 | Mood tab, Journal grid, animated save toast |

---

## Author

Dennis Zanetti — [@dennismzanetti](https://github.com/dennismzanetti)
