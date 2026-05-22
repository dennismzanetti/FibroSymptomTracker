# Changelog

## v2.1.0 — May 22, 2026

### Major Changes
- **Mood Tab**: Added dedicated Mood tab with a compact 14-day sidebar showing color-coded score pills, trend bars, and truncated notes
- **Journal Tab**: Reformatted timeline rows into a 5-column grid layout (Date | Block Pills | Sleep+Mood | Tags | Avg Score)
- **Save Toast**: Replaced static "Saved locally + cloud" status text with an animated toast notification on both Save Day buttons
- **Mood Sidebar**: Last 14 Days section redesigned as a compact stacked list optimized for sidebar width

### Bug Fixes
- Fixed save status message appearing as green text at top of screen instead of toast — save logic was in `entry.js`, not `app.js`
