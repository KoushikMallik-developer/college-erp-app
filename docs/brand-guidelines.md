# Techomato Colleges: brand guide

One page. The colours and sizes below live in code: `src/styles/app.css` (palette at the top) and the files in `public/`.

## Name
- **Techomato Colleges** (two words, both capitalised). Short name on a phone home screen: **Colleges**.
- One-line description: *Attendance, timetables, exams and results for your whole college.*

## Voice
Calm, plain and direct. Short sentences, everyday words ("Sign in", "Nothing here yet"). Say what happened and what to do next. No exclamation marks in errors, no jargon, no blame ("That email already has an account", not "Invalid input").

## Mark
A white graduation cap on a rounded royal-blue tile (`#315bea`). Source: `public/logo-mark.svg`. The wordmark (`public/logo.svg`, `public/logo.png`) is the tile plus "Techomato" in ink and "Colleges" in brand blue.
- Keep clear space of at least a quarter of the tile's width around the mark.
- Do not recolour the tile, add shadows, or stretch it.
- Smallest size: 16 px (the tab icon).

## Colour
Brand blue `#315bea` (links and text on light backgrounds use the darker `#2748c4`). Navy `#152237` for the sidebar and dark panels. Page background `#e6ebf4`, cards white, ink `#172335`. Status: green (ok), amber (warning), rose (error). Never use a status colour as the only signal; pair it with text or an icon. The full scales and the dark theme are in `src/styles/app.css`. Use the meaning tokens (`--brand`, `--ink`, `--line`, ...), not raw hex values.

## Type
Inter Variable (bundled, `@fontsource-variable/inter`), falling back to the system font. Body 14 px, headings semibold with tight spacing. Smallest text is 11 px (labels only).

## Files
| File | Used for |
|---|---|
| `public/favicon.svg`, `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png` | Browser tab |
| `public/apple-touch-icon.png` | iPhone home screen |
| `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | Installed app (PWA) |
| `public/og-image.png` | Link previews (1200 × 630) |
| `public/logo.svg`, `logo.png`, `logo-mark.svg` | Slides, email, print |
