# Landing Page Retro Redesign

## Overview
Redesigned the landing page (`/`) to match the retro typewriter aesthetic used throughout the dashboard pages (Supplier, Buyer, Financier, Operator). The previous design used a modern dark theme (seed-green accents, rounded corners, slate backgrounds) that was inconsistent with the rest of the app.

## Changes Made
- **`frontend/app/page.tsx`** — Full restyle of the landing page

## What Changed

### ASCII Logo
- Removed responsive text sizing (`text-[10px] sm:text-xs md:text-sm`) that caused misalignment at different breakpoints
- Fixed to `14px` monospace size for consistent character alignment
- Switched from `text-seed-green` to `text-[var(--text-primary)]` to match retro palette
- Uses Courier Prime font (inherited from body via `globals.css`)

### Subtitle
- Added `"Seed Finance — For Supply Chain Finance"` below the ASCII art
- Styled with `text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]`

### App Selection Boxes
- Replaced: `rounded-xl`, `border-slate-700`, `bg-slate-900/40`, `hover:border-seed-green/60`
- With: sharp corners (no border-radius), `border-2 border-[var(--border-color)]`, `bg-[var(--bg-card)]`
- Added retro hover effect: `shadow-[4px_4px_0_var(--border-color)]` + translate (matches `Card` hoverable pattern)
- Icons changed from `text-seed-green` to `text-[var(--text-primary)]`
- Titles styled with `font-bold uppercase tracking-wider` (matches `CardTitle` pattern)

### Page Background & Footer
- Background: `bg-deep-navy` → `bg-[var(--bg-primary)]`
- Footer border: `border-slate-800` → `border-t-2 border-[var(--border-color)]`
- Footer text: `text-cool-gray` → `text-[var(--text-muted)]`

## Design Patterns Reused
- CSS variables from `globals.css`: `--bg-primary`, `--bg-card`, `--border-color`, `--text-primary`, `--text-secondary`, `--text-muted`
- Card hover pattern from `components/ui/Card.tsx`
- CardTitle typography pattern: `font-bold uppercase tracking-wider`

## Testing
1. Run `npm run dev` in `frontend/`
2. Visit `http://localhost:3000`
3. Verify:
   - ASCII art characters align correctly in monospace
   - Subtitle appears below logo
   - 4 boxes have sharp corners, 2px borders, typewriter font
   - Hover produces hard shadow offset + slight translate
   - Overall aesthetic matches dashboard pages

## Related Files
- `frontend/app/page.tsx` — Landing page component
- `frontend/app/globals.css` — CSS variables and retro theme
- `frontend/components/ui/Card.tsx` — Reference for hover pattern
