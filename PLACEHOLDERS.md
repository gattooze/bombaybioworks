# Placeholders, swap before this goes live

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

## Imagery (added during the seven page build)

Placeholder photography from Wikimedia Commons, credited in `assets/img/ATTRIBUTION.md`.
CC BY and CC BY-SA require that credit to be retained wherever the image appears.

| File | Subject | Status |
|---|---|---|
| `bamboo.jpg` | Bamboo grove | Placeholder, swap for real plantation photography |
| `biochar.jpg` | Biochar close up | Placeholder, but genuinely on subject |
| `farmer.jpg` | Rice harvest, Karnataka | Placeholder, swap for your own community photography |
| `kiln.jpg` | Kontiki pyrolysis kiln | Placeholder, swap for your facility |

**Still missing:** a purification image. Wikimedia Commons is thin on modern water
treatment and process photography, so nothing usable was found. Either supply one
or that section runs on a motif background instead.

## Em-dash rule

Enforced by `tools/lint.sh`, run before every push. The live page title previously
read "Bombay Bioworks, Coming soon" with an em-dash and has been corrected to a comma.

## Products, Chemistry, Industry, Planet, Circularity, About: built on placeholders

Per your instruction not to let missing data block the build, all six pages now
carry real structure, real modules, and real researched stats where available,
with clearly marked placeholder content standing in everywhere else. Every
placeholder below has an inline `<!-- PLACEHOLDER -->` comment at its exact
location in the HTML, so a find for that string in the repo surfaces all of them.

**Before pushing any of these to main, replace:**

| # | Item | Current value | Where | Needs |
|---|------|---------------|-------|-------|
| 1 | Facility capacity | "TBC t/yr" | `chemistry.html`, stat strip | Real annual capacity figure, even approximate |
| 2 | Activation method | "Steam" | `chemistry.html`, stat strip | Confirm steam vs chemical activation |
| 3 | Facility location | "India" | `chemistry.html`, stat strip | Region or city, if you want it public |
| 4 | Purification specs | BET 900 to 1,100 m²/g, iodine 850 to 950 mg/g, ash under 5% | `products.html` | Your COA. The bamboo test report in your Pictures folder has this |
| 5 | Enrichment specs | Fixed carbon 65 to 75%, pH 8 to 9 | `products.html` | Your COA. The H:Corg below 0.4 line is a real published EBC threshold, not a placeholder, that one can stay |
| 6 | Combustion specs | Calorific 24 to 28 MJ/kg, ash 8 to 12%, sulphur under 0.5% | `products.html` and `industry.html`, same figures both places | Your COA |
| 7 | Community and sourcing detail | Generic "agrarian and tribal communities" framing, no names or geography | `circularity.html` | Real partner or region detail, only if you're comfortable naming it |
| 8 | Team | "Name pending" x3, generic icon | `about.html` | Real names, roles, and bios |
| 9 | Timeline dates | "Now / Next / Then", no dates | `about.html` | Real dates, or confirm they stay vague |
| 10 | Purification section image | None, runs on a motif background | `industry.html` | A real water treatment or process photo, Commons had nothing usable |

Everything else on these pages, the process description, the emissions comparison,
the permanence figures, the bamboo statistics, the yield percentage, is the real
researched data from the build brief, not placeholder.
