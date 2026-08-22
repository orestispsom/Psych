# Design

<!-- impeccable:design-schema 1 -->

## Visual world — «Ψυχομετρικό φύλλο» / The clinical rating instrument

The world is the **psychometric rating instrument** the audience administers weekly: PANSS, HAM-D, MMSE, MoCA,
AIMS. Not the hospital's software — the *paper sheet on the clipboard*. Its grammar is the grammar of an
instrument built to be filled in fast and scored reliably:

- a **numbered gutter** on the left of every item, in tabular figures;
- an **anchored scale** of discrete boxes you mark, with the anchor definitions set in microtype beneath;
- **hairline subscale rules** separating groups, with a subtotal at the right edge;
- **printed cut-off bands** stating thresholds;
- **thumb-index tabs** on the edge, so the sheet opens at the right section;
- a **second ink** (oxide red) reserved for marks, position, and warnings — everything else is ink on stock.

Derivation: candidate 3 of seven grounded directions ordered by resonance for a Greek psychiatry trainee
(1 DSM/ICD criteria manual · 2 clinical drug formulary · 3 psychometric rating instrument · 4 MSE clerking
proforma · 5 EEG chart paper · 6 engraved neuroanatomy atlas plate · 7 ward handover board), built at the
assignment of `concept-seed --scope direction --mode operate` (key `cecb0210`, assigned index 3).

Challengers dealt and weighed on audience identification and product clarity:
- *used-future starship terminal* — loses: phosphor-on-black monospace is a costume for "technical" and fails
  dense Greek clinical prose at reading length.
- *Game Boy four-shade field* — loses on product clarity outright: an 8×8 pixel cap face cannot set Greek
  clinical text at a 65–75ch measure.
- *theatre cyclorama dawn* — fuses partially (its night→day phases map onto mastery) but makes colour the
  primary signal and puts atmosphere ahead of the task on an Operate surface.

The assigned direction wins on both axes: the audience administers these instruments professionally, and the
instrument's own scoring grammar *is* the product's mastery model made visible.

## Mode

**Operate** for the shell, the MCQ practice surfaces, the SOS quick reference, and every index.
**Read** for long-form answer surfaces: oral crucial-question answers, Oxford/Crash reference boxes,
SOS critical topics and differentials.

## Signature

**The mastery scale strip** — a five-box anchored scale, drawn exactly like a PANSS item's response row,
attached to every study item in the product. Boxes fill left to right with the second ink as mastery level
rises. It is the same object in the MCQ list, the oral index, and the SOS entries.

It is not decoration: it renders the existing `masteryLevel` field, and where mastery is user-set (oral, SOS) the
boxes are the control — you mark the box. It replaces every progress bar, ring, percentage badge, and
"x/y κατακτημένες" string in the product with one recognisable object.

## Colour

Strategy: **Restrained** — ink on stock, plus one second ink, plus two semantic inks. Correct for Operate.
Identity is carried by structure (gutters, rules, boxes, tabular figures), never by an unusual hue.

Ground is a blue-cast graphite rather than neutral near-black, so the warm paper white reads as ink on stock.
Dark is the default because the dominant use scene is evening and night revision on a phone and at a desk after
clinical duty; a light "printed sheet" theme is provided for daytime desk study and is the same world in
positive.

| Role | Token | Dark (default) | Light |
|---|---|---|---|
| Page ground | `--ground` | `#0F1116` | `#F2F1EC` |
| Field | `--field` | `#14171E` | `#FFFFFF` |
| Raised / hover | `--raised` | `#1A1E27` | `#E9E8E2` |
| Hairline rule | `--rule` | `rgba(233,231,226,.13)` | `rgba(24,26,32,.14)` |
| Strong rule | `--rule-strong` | `rgba(233,231,226,.26)` | `rgba(24,26,32,.28)` |
| Primary text | `--ink` | `#E9E7E2` | `#181A20` |
| Secondary text | `--ink-2` | `#A9AEB8` | `#4E535E` |
| Microtype / anchors | `--ink-3` | `#7B818D` | `#6B7079` |
| Second ink (marks, position, wrong) | `--mark` | `#D2543A` | `#B33C22` |
| Mastered | `--pass` | `#6E9E5E` | `#3F6B32` |
| Due / high-yield | `--due` | `#C08A3E` | `#8A5D14` |

The primary action is **inverted stock** — paper block, ink text — because on a form the action is the field you
write in. There is no coloured CTA anywhere in the product.

## Typography

All three faces carry Greek (U+0370–03FF); Fira additionally carries Greek Extended. Verified against the
Google Fonts CSS API before selection.

- **Fira Sans** — interface, item text, controls. Humanist, designed for small sizes on screen, real italics.
- **Source Serif 4** — long-form Read surfaces only: crucial-question answers, reference boxes, critical topics.
- **Fira Mono** — question codes, plate numbers, scores. Legitimate as code/measurement, never as a costume.

Scale (fluid where noted): microtype 11px / label 12px / meta 13px / body 15px / item 16px / read 17px /
section 20px / screen title `clamp(22px, 2.4vw, 28px)`. Tabular figures (`tnum`) on every number that sits in a
column. Tracking: `+0.08em` on stencil labels and microtype only; `-0.01em` on screen titles; nothing below
`-0.04em`. Long-form measure capped at 68ch; item text at 78ch.

## Density and spacing

4px base grid. Study material is deliberately dense: item rows are 8–10px vertical padding with hairline
separation, not 24px cards on 16px gaps. Whitespace is spent on *separating groups*, not on separating rows.
More space above a heading than below it.

## Component vocabulary

`Sheet` (page container + gutter) · `ItemRow` (number gutter + content + scale strip — the core primitive that
replaces cards) · `ScaleStrip` (signature) · `SubscaleHead` (heading + rule + right-aligned subtotal) ·
`Tab` (thumb index) · `Stencil` (SOS / high-yield / status label — stencilled, never a pill) ·
`Field` · `Button` (`primary` inverted stock / `quiet` ruled ghost / `mark` destructive) · `PlateCode` (mono) ·
`Anchor` (microtype definition) · `Palette` (global search) · `Empty` / `Loading` / `Failed`.

**Containment rule:** content sits on the sheet, separated by rules and gutters. A container appears only for a
modal, the command palette, or a row that is itself a control. No cards. No nested containers, ever.

## Interaction model

- Persistent **thumb-index navigation**: a left edge rail on desktop (≥900px), a bottom tab bar on mobile.
  Replaces the per-screen «Πίσω / Αρχική» button pair, which is deleted.
- **Command palette** (`Ctrl/⌘ K`) searching all ~3,300 items across every corpus, with Greek accent folding.
- **Keyboard**: `1–5` / `Α–Ε` select option · `Enter` submit then advance · `←/→` previous/next ·
  `Space` reveal · `Ctrl/⌘K` search · `?` shortcut sheet · `Esc` close.
- **Resume**: last position (mode, index, scroll) persisted per profile and offered as the primary action.
- Mobile study surfaces carry a **fixed bottom action bar** so submit/next is always in the thumb zone.

## Motion

One authored moment: **the mark setting**. When an answer is recorded, the next box of the scale strip takes the
second ink over 160ms on an exponential ease-out, and the item's rule draws across on mastery completion.
Everything else changes state instantly. All of it is disabled under `prefers-reduced-motion`.

## Responsive

Breakpoints at 600px, 900px, and 1280px. Below 900px the rail becomes a bottom tab bar and the number gutter
collapses into the item's first line. Touch targets ≥44px throughout. Sheet max width 1180px; Read surfaces
68ch centred within it.

## Accessibility

Body and microtype ≥4.5:1 against their own ground; the second ink is never the only signal — marks carry a
glyph and a text equivalent. Visible focus ring in stock colour at 3px with 2px offset. Every icon-only control
carries an accessible name. Scale strips expose `role="img"` with a Greek text label stating the level.
