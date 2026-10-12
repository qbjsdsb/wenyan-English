# Wenyan Design Constitution v1

Status: experimental design contract. It is not production UI and does not change product behavior.

## 1. Product character

Wenyan is a quiet, precise, personal learning instrument. It should remain comfortable after hours of daily use and should still feel appropriate when the product expands from English vocabulary into reading and literature.

The working metaphor is **Luminous Paper**, but it is not a visual theme.

- **Paper** = the stable continuous plane that holds knowledge.
- **Ink** = information, memory and learning states that have settled.
- **Light** = a short-lived change in attention or cognition.
- **Rhythm** = the invisible spatial order that keeps different rooms recognizably Wenyan.

> Paper holds. Ink remembers. Light happens.

## 2. The five laws

1. **Nothing competes with cognition.** Current learning content has priority over navigation, metrics and decoration.
2. **Knowledge settles.** Every feedback effect returns to a stable ink state. No persistent glow.
3. **Space creates hierarchy before color does.** Use alignment, distance and density first.
4. **Motion explains, never decorates.** No animation exists only to make the product feel “alive”.
5. **Different work deserves different rooms.** Learning, reading, planning and indexing do not need one page template.

## 3. Four rooms

### Desk
Question: **What should I do next?**

- medium density
- medium/high whitespace
- restrained persistent chrome
- current task first, continuation second, practice third, activity last
- no dashboard card wall

### Focus
Question: **What am I thinking about now?**

- very low density
- very high whitespace
- minimum chrome
- one cognitive object dominates
- character shortcuts disabled while text input/IME is composing

### Folio
Question: **What am I understanding?**

- reading-first manuscript grid
- serif allowed for actual long-form reading copy, not general UI
- notes and concepts live in the page margin, not a permanent sidebar panel
- reading practice and literature Folio may share material rules without sharing the same task layout

### Index
Question: **What have I accumulated?**

- high density
- sans UI
- strong search, keyboard navigation, sorting and columns
- more rules/lines, almost no motion
- tabular numbers for data, proportional numbers for prose

## 4. Rhythm

Base geometry:

- micro unit: `4px`
- macro rhythm: `8px`
- preferred spacing set: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`

Avoid arbitrary per-page values unless optical correction requires them.

**Same anchors, different oxygen.** Rooms may use very different density but should reuse the same leadspace relationship and content anchors.

A page opening should answer:

- Where am I?
- Where am I within this work?

This is a relationship, not a universal Header component.

## 5. Typography

### UI
Use one coherent sans family for Chinese, Latin and numerals where possible. Do not build identity from constant font switching.

Suggested weight roles when variable fonts are available:

- auxiliary: ~380
- body: ~420
- active: ~470
- section: ~540
- primary heading: ~600–620

### Reading
Serif is reserved for genuine reading copy or content that benefits from book-like rhythm. Notes and tool UI remain sans.

### Learning object
A vocabulary headword or current cognitive object may be larger than the rest of the UI, but it should not become marketing-style display typography.

### Mixed CJK/Latin
Prefer proper CJK/Latin spacing, line-breaking and punctuation behavior. `text-autospace` can be progressive enhancement where supported. Use `line-break` intentionally for Chinese reading modes.

## 6. Material

### Paper
- continuous plane
- matte
- stable
- no visible fibres, parchment, folds, plant shadows or “paper illustration”
- any noise should sit below obvious screenshot-level perception

### Content
- zero elevation
- generally zero radius
- grouped first by whitespace, then by rules

### Controls
- small radius, approximately 6px when needed
- visible because they are controls, not because every item is a pill/card

### Temporary tools
Popover, command palette and modal may float. Elevation indicates temporariness.

Depth budget:
- Paper: 0
- toolbar: 0–1
- popover: 1
- command: 2
- modal: 3

## 7. Attention and Light

States:

1. **Rest** — default. Most screen time lives here.
2. **Attention** — surrounding chrome/support content may recede slightly.
3. **Cognition** — one short meaningful state change.
4. **Settlement** — feedback returns to stable ink.

**One Event, One Change.** A correct response does not simultaneously glow, scale, sparkle, recolor and bounce.

Preferred light mechanisms:
- relative contrast
- subtle font-weight change
- small local luminance change
- a short continuity trace between cause and result

Forbidden as default product language:
- decorative glow
- stardust / star particles
- aurora
- shine sweep on buttons
- confetti
- breathing/floating idle animation

## 8. Motion physics

Core timings:
- `83ms` — press / immediate mechanical response
- `167ms` — cognitive feedback
- `250ms` — tool/panel transition

Longer motion requires a functional reason. Respect `prefers-reduced-motion` and never make motion the only signal.

## 9. Chrome budget

- Desk: medium
- Focus: very low
- Folio: low
- Index: high

Persistent navigation should be small. Strong transient navigation such as a future command layer can carry actions that do not deserve permanent screen space.

Chrome hides or recedes because the work context changed, not because an idle timer wants to look cinematic.

## 10. Line budget

- Desk: mostly space, some rules
- Focus: almost no rules except baseline/progress
- Folio: rules only for notes, citations and meaningful boundaries
- Index: rules are welcome because scanning is the work

Semantic rule: the closer the user is to thinking, the fewer visible lines; the closer the user is to organizing, the more structure may remain visible.

## 11. Anti-pattern checklist

Reject a design if it depends on:

- hero cards on a productivity home page
- cream + teal + serif + yellow glow as an instant “premium” recipe
- repeating rounded cards for all hierarchy
- permanent AI-purple or AI-specific visual blocks
- decorative paper texture
- giant landing-page headings inside the application
- identical layouts for different kinds of work
- more than one prominent micro-light event at the same time

## 12. Migration order

Do not reskin the entire app at once.

1. validate **Focus** in real usage
2. reduce **Desk / Today**
3. split training Reading from long-form **Folio** behavior
4. establish **Index** as the dense information family
5. migrate secondary pages only after the four rooms are stable
6. consolidate old visual polish layers instead of adding another polish stylesheet

## 13. Stop-design criteria

The visual exploration phase ends when:

- static screenshots do not read as generic AI UI
- a 30-minute session feels calm rather than decorative
- Focus is comfortable with keyboard-only operation
- no motion lacks a state/explanation purpose
- hierarchy remains understandable with very little color
- Desk, Focus, Folio and Index are visibly different but still feel related
- dark mode does not become black-space + blue-glow
- covering the logo still leaves a recognizable product character

At that point, implementation should replace further style exploration.
