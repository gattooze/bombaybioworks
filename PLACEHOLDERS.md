# Placeholders — swap before this goes live

Everything below is provisional. Nothing here has been confirmed against
real Bombay Bioworks facts; it exists so the page is structurally complete.

| # | Item | Current value | Where | Notes |
|---|------|---------------|-------|-------|
| 1 | Contact email | `hello@bombaybioworks.com` | `index.html` — CTA `mailto:` | **Invented.** Do not publish until confirmed — a bouncing address on a holding page is worse than no address. |
| 2 | Headline | "Carbon built for land, water, and kilns." | `index.html` — `<h1>` | **Chosen (option A).** From the design system hero specimen. Output-led. |
| 3 | Sub-copy | "…India's most integrated bamboo and agri-biomass platform…" | `index.html` — `.hero-sub` | **Chosen (option C).** From your own pager. Bamboo now leads, as it should. Meta + OG descriptions kept in sync. |
| 4 | Product chips | Soil amendment / Water treatment / Industrial energy | `index.html` — `.chip-row` | Design-system categories; kept because they agree with the output-led headline. Real lines per your pager are Pellets & Briquettes, Biochar & Black Pellets, Activated Carbon, Feedstock. |
| 5 | Logo | "BB" in a forest-gradient rounded square | `index.html` — `.nav-logo-mark` + favicon | Placeholder mark. `~/Downloads/BombayBioworks_Logo_Concepts.png` exists — no concept has been picked. |
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
