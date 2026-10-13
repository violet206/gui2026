# 🤖 Copilot Instructions for This Ocean Plastic Drift Platform

Purpose: Make an AI agent instantly productive in this hybrid front-end (static HTML/JS/CSS) + lightweight Streamlit simulation project.
Keep answers concrete, follow existing patterns, and preserve graceful-degradation + fallback logic.

## 1. High-Level Architecture
- `main.html` + `styles.css` + `main.js` render the interactive portal: 3D globe (Three.js loaded dynamically), charts (Chart.js), particle/visual backgrounds, simulation control buttons.
- `charts.js` encapsulates all Chart.js creation via a `ChartManager` class, exposes instance on `window.chartManager` for animation triggers / updates.
- `globe.js` handles Three.js earth rendering and size / rotation controls (must tolerate delayed Three.js load or file:// mode).
- `simulate.py` generates synthetic particle trajectories (`tracks.csv`, `tracks.geojson`) with optional real netCDF flow fallback (xarray). Prints `PROGRESS:` lines consumed by UIs.
- `app_streamlit.py` serves an advanced drift / parameter UI (background effects + map) and is discovered from the portal via local port scan (8501–8505 + custom ports like 8526).
- Fallback chain for detailed demo button: running Streamlit → local `drift_demo.html` → prompt user to start Streamlit.

## 2. Core Patterns & Conventions
- Defensive loading: always feature‑detect (`if(typeof Chart==='undefined')`) and retry with timeouts instead of assuming CDN success.
- Global exposure: after constructing managers, assign to `window.*` (e.g., `window.chartManager`) so other scripts can poke minimal public API.
- Fallback-first mindset: if fetch / CSV parse fails, render lightweight placeholder (see `renderMarineBioFallback`). Never let errors bubble uncaught to user.
- Progressive enhancement: file:// usage is supported (skip network fetch, use inline synthetic CSV generators like `generateMarineBioLossInlineCSV`). Keep that branch intact.
- Port scanning: keep timeout small (~1200–1500ms) per port to avoid blocking UI; abortable fetch with `AbortController`.
- Styling: heavy use of utility selectors bound to panel pieces (`.piece-6`, `.panel-grid-8`, `.unified-run-btn`). When adding UI, follow existing glass / gradient / soft shadow motifs and reuse CSS variables (`--glass-bg`, `--radius-medium`).

## 3. Data Flow
- Simulation data (tracks) is generated offline (`simulate.py`) and then read by Streamlit or static viewers.
- Charts: static + synthetic or CSV fallback -> created once, then animated when panels clicked (`animatePanel` triggers `chartManager.animateChart`).
- Streamlit detection: `navigateToDemo()` sequentially probes ports, then attempts local fallback file.

## 4. Adding New Visual Modules
1. Create a dedicated JS file (e.g., `drift.js`) that: (a) feature-detect dependencies; (b) exposes `initX(container)` + imperative controls on a global object.
2. Inject canvas elements inside an existing `.huarong-piece` or create a new one with consistent class naming (`piece-N`).
3. Avoid blocking on external libs: load lazily; if failed, degrade to a simple text / minimal animation.
4. Trigger resize reflow after large DOM insertions: `setTimeout(()=>window.dispatchEvent(new Event('resize')), 100);` to stabilize Chart.js sizing.

## 5. Safe Editing Guidelines
- Do not remove fallback / inline CSV generator functions; extend via new methods instead of in-place rewrites.
- When modifying `charts.js`, prefer adding new `createXChart()` + register inside `createCharts()` rather than embedding logic inside unrelated functions.
- Keep `simulate.py` stdout `PROGRESS:` format stable (external tools may parse it). If adding fields, append new lines, do not change existing prefix.
- Maintain port list logic in `navigateToDemo()` / `tryStreamlitPorts()`; if adding ports, update both probe arrays and documentation (`使用说明.md`).

## 6. Performance & UX
- Use `requestAnimationFrame` loops only when panel visible; pause or short‑circuit when hidden to avoid competing with Three.js render loop.
- Keep per-frame allocations minimal (reuse arrays) if creating new particle layers.
- Avoid large synchronous loops in click handlers—offload heavy work with `setTimeout(()=>{...},0)` if necessary.

## 7. File / Module Quick Map
- UI Shell: `main.html`, `styles.css` (layout, glass theme, responsive grid), `main.js` (navigation, modals, ripple, port scan).
- Visualization: `globe.js` (3D earth), `particles.js` (background), `charts.js` (all Chart.js logic), `responsive-layout.js` (adaptive sizing if present), `overflow-*` utilities for layout debugging.
- Simulation Backend: `simulate.py` (particle drift), `app_streamlit.py` (interactive Streamlit front-end), optional `tile_cache_server.py` & helpers.
- Data / Assets: `land_mask.geojson`, textures in `imgs/`, generated `tracks.*`.

## 8. Typical Workflows
- Run synthetic simulation: `python simulate.py` (produces tracks files) → open `app_streamlit.py` via `streamlit run app_streamlit.py --server.port 8526`.
- Local portal preview (static): open `main.html` directly (supports file://) or via `python -m http.server 8000`.
- Add dependency: update `requirements.txt` (keep minimal), mention in usage docs if required at runtime.

## 9. Extension Examples
- New Chart: implement `createMyMetricChart()` -> push into `createCharts()` -> add a `.piece-X` panel -> style in `styles.css` using existing variable palette.
- New Button: add inside `.simulation-controls` using `unified-run-btn` / `demo-btn` size rules; wire click -> new global function.
- Integrate alt dataset: extend generator fallback + conditional fetch (respect `window.__FILE_MODE__`).

## 10. Gotchas
- Chart canvases must exist before instantiation; if dynamically adding, call `chartManager.safeCreateCharts()` after insertion.
- Avoid renaming `piece-6` classes: legend & doughnut resizing CSS is highly specific.
- Three.js may fail via CDN; code must tolerate absence (skip advanced globe materials, use simple placeholder).
- Some code expects `tracks.geojson` to be fully written atomically (see temp file rename logic); preserve that pattern if refactoring.

## 11. Tone for Future AI Changes
Be surgical: modify only the region necessary; keep comments bilingual (简体中文 + concise English) when touching shared utilities; favor incremental augmentation over rewrites.

---
Feedback welcome: if any pattern feels unclear, request clarification before large refactors.
