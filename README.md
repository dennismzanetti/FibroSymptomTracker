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

### 📈 Trends
- **Chart.js** powered line charts showing symptom scores over time
- Helps identify patterns in pain, fatigue, sleep, and mood

### 😊 Mood
- Dedicated Mood tab with a dedicated entry form
- **14-day sidebar** showing color-coded score pills, trend bars, and truncated notes
- Mood scores are included in Journal and Analysis summaries

### 🔍 Analysis
- Date-range selector to review any span of logged days
- **Day-by-day data table** with colour-coded cells across Functionality, Wellbeing, and Symptom sections
- **Sparkline trend indicators** per metric row showing direction of change over the selected period
- **Expandable Notes panel** — toggleable rows showing per-day notes for sleep, mood, pain, fatigue, and general observations
- **Clickable date headers** — jump directly to a specific day in the Daily Entry tab from the table
- **AI Insights panel** (requires Gemini API key — see [AI Insights Setup](#ai-insights-setup)) — automatically analyses the loaded data range and displays:
  - Observed patterns (e.g. sleep quality correlating with next-day fatigue)
  - Best and most challenging days with common factors
  - Gentle, data-driven recommendations
  - A compassionate summary of the overall period
- Insights are generated via **Google Gemini 2.5 Flash** and are observational only — not medical advice

### 💊 Medications
- Full medication list management (add, edit, delete)
- Tracks medication name, dosage, frequency, and notes
- Synced to Firestore per user

### 🩺 Conditions
- Manage a list of diagnosed conditions beyond Fibromyalgia
- Free-form condition notes per entry

### 👥 Care Team
- Maintain a directory of healthcare providers (name, specialty, phone, notes)
- Print-friendly report generation (`js/output/print.js`) for sharing with providers

### ⚙️ Settings
- User profile configuration
- App preferences and display options
- Data export controls

---

## AI Insights Setup

The Analysis tab includes an optional AI-powered insights panel driven by **Google Gemini 2.5 Flash**. To enable it:

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com) and sign in with a Google account.
2. Click **Get API key** → **Create API key**.
3. Copy the key.

> **Security tip:** In the [Google Cloud Console](https://console.cloud.google.com) under **APIs & Services → Credentials**, restrict the API key's HTTP referrer to your app's domain (e.g. `https://yourdomain.web.app/*`) to prevent unauthorised use.

### 2. Store the Key in Firestore

The key is stored server-side in Firestore (never hard-coded in the client) and is only readable by authenticated users.

1. Open [Firebase Console](https://console.firebase.google.com) → your project → **Firestore Database**.
2. Create a collection named **`config`**.
3. Add a document with the ID **`apiKeys`**.
4. Add a field:
   - **Field name:** `geminiKey`
   - **Type:** string
   - **Value:** your API key

### 3. Deploy the Firestore Security Rule

Ensure your `firestore.rules` includes the following rule so authenticated users can read the key but cannot write to it:

```
match /config/{doc} {
  allow read: if request.auth != null;
}
```

Deploy via the Firebase Console (**Firestore → Rules → Publish**) or CLI:

```bash
firebase deploy --only firestore:rules
```

### How It Works

- When a date range with 3+ days of data is loaded in the Analysis tab, `js/features/analysis.js` retrieves the API key from Firestore, builds a compact prompt from the loaded data, and calls the Gemini API.
- The response is parsed and rendered as insight cards above the data table.
- If no API key is configured, the panel is silently skipped — the rest of the Analysis tab functions normally.
- All AI output is clearly labelled as observational and non-medical.

---

## Architecture

### Frontend
- **Vanilla HTML / CSS / JavaScript** — no frontend framework
- **Partial-based HTML loading** — `js/core/loader.js` fetches HTML partials from the `partials/` directory and injects them into the DOM at runtime, keeping `index.html` lean
- **Modular CSS** — styles split into per-feature files in `css/` with `styles.css` as a legacy override layer
- **Modular JS** — organised into four subdirectories under `js/`:
  - `js/core/` — app bootstrap, auth, Firebase init, partial loader, build stamp
  - `js/features/` — one module per tab (entry, journal, history, analysis, mood, medications, conditions, careteam, trends, app router)
  - `js/output/` — print/report generation and settings
  - `js/utils/` — shared helpers (Firestore, dates, diagnostics, UI)

### Backend / Cloud
- **Firebase Authentication** (v8 compat SDK) — user sign-in/sign-out
- **Firebase Firestore** (v8 compat SDK) — cloud storage for all user data
- `js/core/firebase-init.js` — Firebase app initialization and config
- `js/utils/cloud.js` — Firestore read/write helpers

### Third-Party Libraries (CDN)
| Library | Version | Use |
|---|---|---|
| Firebase App | 8.10.1 | Core Firebase SDK |
| Firebase Auth | 8.10.1 | Authentication |
| Firebase Firestore | 8.10.1 | Cloud database |
| Chart.js | 4.4.3 | Trends charts |
| Google Gemini API | 2.5 Flash | AI Insights (Analysis tab) |

---

## File Structure

```
FibroSymptomTracker/
├── index.html                    # App shell — loads partials and scripts
├── favicon.svg                   # App icon
├── styles.css                    # Legacy/global CSS overrides
├── build-info.js                 # Static build stamp (root copy)
├── firestore.rules               # Firestore security rules
│
├── css/                          # Modular stylesheets (one per feature)
│   ├── base.css                  # Design tokens, resets, shared components
│   ├── layout.css                # App shell, header, tabs, cards
│   ├── entry.css                 # Today / Daily Entry tab
│   ├── history.css               # Analysis tab + AI insights
│   ├── journal.css               # Journal tab
│   ├── mood.css                  # Mood tab
│   ├── medications.css           # Medications tab
│   ├── careteam.css              # Care Team tab
│   ├── pain-map.css              # Pain Body Map
│   ├── subtabs.css               # Sub-tab pill navigation (shared)
│   └── analysis-subtabs.css      # Analysis tab sub-tab overrides
│
├── partials/                     # HTML fragments loaded at runtime
│   ├── auth.html
│   ├── header.html
│   ├── modals.html
│   ├── tab-today.html
│   ├── tab-journal.html
│   ├── tab-history.html          # Analysis tab content (history + AI insights)
│   ├── tab-trends.html
│   ├── tab-mood.html
│   ├── tab-medications.html
│   ├── tab-conditions.html
│   ├── tab-careteam.html
│   └── tab-settings.html
│
├── js/
│   ├── core/                     # App bootstrap & infrastructure
│   │   ├── app.js                # Main controller and tab routing
│   │   ├── auth.js               # Authentication state management
│   │   ├── build-info.js         # Build stamp displayed in footer
│   │   ├── firebase-init.js      # Firebase configuration and init
│   │   └── loader.js             # HTML partial loader
│   │
│   ├── features/                 # One module per tab/feature
│   │   ├── analysis.js           # AI Insights — Gemini API integration
│   │   ├── careteam.js           # Care Team feature logic
│   │   ├── conditions.js         # Conditions feature logic
│   │   ├── entry.js              # Today entry feature logic
│   │   ├── history.js            # Analysis tab data table logic
│   │   ├── journal.js            # Journal tab logic
│   │   ├── medications.js        # Medications feature logic
│   │   ├── mood.js               # Mood tab logic
│   │   └── trends.js             # Chart.js trend rendering
│   │
│   ├── output/                   # Reporting and settings
│   │   ├── print.js              # Print/report generation
│   │   └── settings.js           # Settings feature logic
│   │
│   └── utils/                    # Shared utility helpers
│       ├── cloud.js              # Firestore read/write helpers
│       ├── date.js               # Date utility functions
│       ├── diagnostics.js        # Global error handler (loads first)
│       └── ui.js                 # Shared UI utilities (toasts, modals)
│
├── dev/
│   └── local-fibro.html          # Standalone single-file version (no cloud)
│
├── VERSION                       # Current version number
├── CHANGELOG.md                  # Version history
└── commit-log.json               # Commit metadata for build footer
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
5. Optionally, follow the [AI Insights Setup](#ai-insights-setup) steps to enable the Gemini-powered Analysis panel.

> **Offline / no-cloud use:** Open `dev/local-fibro.html` directly — this is a self-contained single-file version that stores data in `localStorage` only.

---

## Version History

See [CHANGELOG.md](CHANGELOG.md) for full release notes.

| Version | Date | Highlights |
|---|---|---|
| 3.0 | June 2026 | Analysis tab with AI Insights (Gemini), History renamed to Analysis |
| 2.1.0 | May 2026 | Mood tab, Journal grid, animated save toast |

---

## Author

Dennis Zanetti — [@dennismzanetti](https://github.com/dennismzanetti)
