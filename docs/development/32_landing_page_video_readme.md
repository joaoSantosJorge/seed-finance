# Landing Page — Video Embed & README Content

## Overview
Added an embedded YouTube demo video and the full README.md rendered as styled markdown to the landing page, below the existing role-selection boxes.

## Changes Made
- `frontend/app/page.tsx` — Added YouTube iframe embed and MarkdownContent section; reads README.md at build time via `fs`; removed `justify-center` from main to allow scrolling
- `frontend/app/globals.css` — Added `.prose-retro` CSS class with full markdown element styling (headings, tables, code blocks, lists, links, blockquotes, hr) matching the retro typewriter theme
- `frontend/components/ui/MarkdownContent.tsx` — New client component wrapping `react-markdown` with `remark-gfm` plugin
- `frontend/package.json` — Added `react-markdown` and `remark-gfm` dependencies

## How It Works
The landing page is a Next.js Server Component, so it reads `README.md` from the repo root using `fs.readFileSync` at build/request time. The markdown string is passed to the `MarkdownContent` client component, which renders it with `react-markdown` and the `remark-gfm` plugin (for tables, strikethrough, etc.).

The YouTube video is embedded as a standard iframe with 16:9 aspect ratio using the padding-bottom technique. Both sections use the same `max-w-3xl` width as the role boxes for visual consistency.

All markdown elements are styled via the `.prose-retro` CSS class to match the existing retro typewriter aesthetic — monospace fonts, 2px borders on tables/code blocks, uppercase headings with letter-spacing, etc.

## Testing
1. Run `cd frontend && npm run dev` and open `http://localhost:3000`
2. Verify the 4 role boxes render correctly at the top
3. Verify the YouTube video is visible and playable inline below the role boxes
4. Verify the README content renders below the video with proper formatting (tables, code blocks, headings, links)
5. Verify the page scrolls naturally with footer at the bottom

## Related Files
- `frontend/app/page.tsx`
- `frontend/app/globals.css`
- `frontend/components/ui/MarkdownContent.tsx`
- `README.md` (repo root — content source)
