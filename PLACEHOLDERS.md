# Placeholders — swap before this goes live

Everything below is provisional. Nothing here has been confirmed against
real Bombay Bioworks facts; it exists so the page is structurally complete.

| # | Item | Current value | Where | Notes |
|---|------|---------------|-------|-------|
| 1 | Contact email | `founders@bombaybioworks.com` | `index.html` — CTA `mailto:` | **Confirmed real**, no longer a placeholder. |
| 2 | Headline | "We make ~~black~~ green carbon." | `index.html` — `<h1>` | **Real copy, supplied directly.** "Black" struck through via `.strike`, "green carbon" in the brand gradient. Not a placeholder — alternate options were discussed in chat if this ever needs revisiting. |
| 3 | Sub-copy | "Industrial grade bio-coal manufactured with sustainable chemistry, using renewable and upcycled sources of raw material." | `index.html` — `.hero-sub` | **Real copy, supplied directly.** Meta + OG descriptions kept in sync. |
| 4 | Product chips | Soil & crop enhancement / Treatment & purification / Energy & power | `index.html` — `.chip-row` | **Real copy, supplied directly.** Replaces the earlier design-system placeholder categories. |
| 5 | Logo | "BB" in a forest-gradient rounded square | `index.html` — `.nav-logo-mark` + favicon | Still a placeholder mark. `~/Downloads/BombayBioworks_Logo_Concepts.png` exists — no concept has been picked. |
| 6 | Location | "Mumbai, India" | `index.html` — footer | From your existing pager. Verify it's the right registered location to state publicly. |
| 7 | Launch date | *omitted deliberately* | — | Your pager says "Ground operations begin August 2026". Left off the public page on purpose — a date is a promise. Add it if you want it. |

## Deliberately not included

- **Analytics.** No GA4 tag yet — I didn't want to invent a measurement ID.
  Say the word and I'll wire it plus `data-cta` on the CTA, per the convention
  I use on the LPM site.
- **Social preview image.** OG tags are present but there's no `og:image`;
  links will unfurl without a picture until we have artwork.
- **Canonical URL / `og:url`.** Needs the final domain confirmed.

## Design system compliance

Built strictly against the BB Design System v1.0 ("Linear Swapped"):
tokens copied verbatim into `assets/style.css`, forest leads, cranberry
confined to the industrial-energy chip only, Inter + IBM Plex Mono,
light default with the dark variant fully specified rather than inverted.
