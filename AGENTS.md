# AGENTS.md

## Repository Context

This repository is a Vite + React + TypeScript frontend MVP.

Primary objective:

* keep the app runnable at all times
* ship working features quickly
* minimize unnecessary user intervention
* prefer simple implementations over architecture-heavy solutions

Default assumptions:

* personal-use webapp
* frontend-first
* local-first persistence
* early-stage prototype

---

## Working Rules

* Deliver runnable code, not pseudocode or TODO scaffolding.

* Prefer editing existing files over creating new ones.

* Do not create files unless:

  * clearly necessary, and
  * they are wired into the app immediately.

* Do not add imports unless:

  * the target file already exists, or
  * the file is created in the same change.

* Before finalizing:

  * verify every import path,
  * verify exported symbols exist,
  * verify TypeScript compiles successfully.

* Avoid speculative abstractions.

* Avoid unnecessary refactors.

* Keep changes minimal and targeted.

If the request is slightly ambiguous:

* make a reasonable product assumption,
* proceed without unnecessary follow-up questions,
* unless blocked or potentially destructive.

---

## Preferred MVP Structure

Prefer keeping the app compact unless complexity clearly justifies separation.

Preferred structure:

* `src/App.tsx`
* `src/main.tsx`
* `src/styles.css`

Avoid introducing:

* `components/`
* `hooks/`
* `utils/`
* `types/`
* `lib/`

unless:

* there is clear reuse,
* complexity meaningfully increases,
* or the user explicitly requests it.

---

## Product Defaults

* Prefer frontend-only implementations.
* Use `localStorage` for persistence unless server storage is explicitly requested.
* Do not introduce:

  * backend infrastructure,
  * authentication,
  * databases,
  * global state libraries,
  * routers

unless explicitly requested.

* Prefer controlled React inputs.
* Prefer directly testable state flow.
* Render real empty states instead of fake analytics or mock data.

---

## Stack Conventions

* Use TypeScript strictly.
* Avoid `any` unless unavoidable.
* Use React function components and hooks.
* Use relative imports by default.
* Only use alias imports if already configured.

Styling:

* If Tailwind already exists, use it.
* Otherwise use `src/styles.css`.
* Do not silently introduce Tailwind.

Charts:

* Ensure chart containers have explicit sizing so rendering cannot silently fail.

UI:

* Keep layouts responsive and mobile-friendly by default.

---

## UI / Visual Design Direction

The UI should feel modern, clean, lightweight, and data-focused.

This is a dashboard-style body tracking application.
The design should prioritize:

* readability
* visual consistency
* information hierarchy
* responsive usability
* calm and modern aesthetics

Do not make the design overly plain or purely utilitarian.
Some visual polish is welcome, but it must support usability and consistency.

---

## Design System Rules

### Colors

* Use a small and consistent color palette.
* Prefer neutral backgrounds with one primary accent color.
* Use chart colors consistently across the app.
* Avoid random colors per card or section.
* Avoid oversaturated palettes.
* Avoid neon colors unless explicitly requested.
* Avoid excessive gradients.

### Typography

* Maintain a clear hierarchy between:

  * page titles
  * section titles
  * metric values
  * labels
  * helper text

* Keep typography consistent.

* Avoid oversized headings.

* Avoid tiny chart labels.

* Ensure mobile readability.

### Spacing and Layout

* Use consistent spacing values.
* Prefer card-based layouts.
* Keep layouts aligned to a consistent visual grid.
* Avoid cramped layouts.
* Avoid excessive whitespace.
* Avoid horizontal scrolling on mobile.
* Prioritize important metrics above the fold.

### Cards and Surfaces

* Use consistent border radius.
* Use subtle shadows or subtle borders.
* Avoid aggressive shadows.
* Avoid excessive nested cards.
* Avoid fake glassmorphism unless explicitly requested.

### Buttons and Controls

* Keep button styles visually consistent.
* Prefer segmented controls or tabs for small option sets.
* Ensure hover, active, and selected states are visually clear.
* Avoid mixing unrelated control styles.

### Charts

* Prioritize readability over decoration.
* Avoid overlapping labels.
* Use automatic axis scaling with reasonable padding.
* Do not force charts to start at zero if readability suffers.
* Keep chart colors consistent by metric.
* Avoid putting unrelated units on the same axis unless readability remains high.
* Time-range selectors should behave similarly to stock-chart controls.

---

## Avoid Common AI-Generated UI Problems

Avoid:

* random gradients
* excessive shadows
* inconsistent spacing
* inconsistent border radius
* too many accent colors
* cramped mobile layouts
* tiny touch targets
* decorative animations without usability value
* chart labels overlapping
* dashboard cards with inconsistent sizing
* visually impressive elements that reduce usability
* introducing heavy UI libraries without strong justification
* redesigning unrelated features unless requested

---

## Accessibility and Usability

* Maintain sufficient visual contrast.
* Keep interactions easy on touch devices.
* Preserve strong visual hierarchy.
* Remove visual noise that does not support user tasks.
* Keep interfaces lightweight and understandable.

Minimalism should improve clarity, not reduce functionality.

---

## Dependency Policy

* Prefer existing dependencies.
* Add dependencies only if they materially simplify implementation.
* Avoid unnecessary package bloat.
* If dependencies are added:

  * update the lockfile if present,
  * ensure imports are actually used.

Do not add:

* backend frameworks,
* auth systems,
* ORMs,
* routers,
* global state managers

unless explicitly requested.

---

## Bugfix Workflow

When fixing bugs:

1. Identify the actual failing path.
2. Apply the smallest viable fix.
3. Re-check the failing path.
4. Verify no adjacent functionality broke.

Do not guess blindly from logs.

---

## Verification

Before finalizing, run the strongest available non-interactive checks in this order:

1. `npm run build`
2. `npm run test` (if available)
3. `npm run lint` (if available)

Rules:

* Never claim commands passed unless actually run.
* Treat build errors, unresolved imports, missing exports, and TypeScript errors as blocking failures.
* Do not finalize with a broken build.

---

## Final Response Contract

Always include:

* files changed
* what changed
* assumptions made
* commands run
* whether each command passed
* unavailable scripts
* dependencies added and why

---

## Anti-Patterns

* no missing-file imports
* no orphaned files
* no unused dependencies
* no fake mock data presented as real
* no placeholder implementations
* no unnecessary multi-file refactors
* no unverifiable “should work” claims
