# Web Design Guidelines — Murder IDE

> **Trigger this skill manually** when the user asks for a UI review, visual audit, polish pass, or design direction. The agent can take screenshots via `browser_take_screenshot` and `browser_snapshot` to inspect the live UI — use this capability to catch visual regressions, layout issues, and polish gaps that code-only review misses.

## How to Use

1. **For code review**: Read the relevant sections below, then inspect the target component file(s)
2. **For visual review**: Navigate to the page, take a screenshot, and audit against the visual inspection checklist
3. **For design direction**: Start with the "Design Direction" section to pick a bold aesthetic before coding

---

## Stack Context

This project uses:
- **React 18** with TypeScript
- **Tailwind CSS v4** (`@theme` block for CSS custom properties, no config file)
- **shadcn/ui** primitives (Button, Separator, Badge, Input, etc.)
- **Monaco Editor** — wrapped with `absolute inset-0` pattern, never style Monaco's internal DOM
- **xterm.js** — PTY-backed terminal, VTE emulator
- **react-mosaic-component v6** — tiling window manager, no `createDefaultDependencies`
- **react-dnd + HTML5Backend** — drag-and-drop
- **Dark theme only** — `--color-*` CSS custom properties, no light mode support

---

## Section 1: Visual Inspection (Vision Model)

> Take a screenshot and audit these visual properties. Many issues are invisible in code but obvious in a screenshot.

### Layout & Spacing
- [ ] **No clipping**: Text isn't cut off at container edges
- [ ] **No overflow scrollbars**: Horizontal scroll only where intentional (code blocks, tab bars)
- [ ] **Consistent padding**: All panels use the same inset (typically `p-2` or `p-3`)
- [ ] **Flex children truncate properly**: Long filenames/paths use `min-w-0 overflow-hidden text-ellipsis`
- [ ] **No dead space**: Empty areas aren't awkwardly large (fill with meaningful content or reduce)
- [ ] **Alignment is consistent**: Related elements share the same left/right alignment

### Typography
- [ ] **Readability at size**: Text isn't too small (minimum `text-[12px]` for UI chrome)
- [ ] **Hierarchy is clear**: Headings, labels, body text, and hints have distinct visual weight
- [ ] **No text collision**: Elements don't overlap or touch uncomfortably
- [ ] **Code is monospace**: All code/paths/commands use `font-mono`
- [ ] **Uppercase labels**: Panel titles use `uppercase tracking-wide text-[11px]`
- [ ] **Ellipsis not triple-dot**: Loading states say `"Loading…"` not `"Loading..."` (use `…` U+2026)

### Color & Contrast
- [ ] **All text readable**: Foreground on background has sufficient contrast
- [ ] **Active vs inactive**: Active tabs/panels have distinct visual treatment
- [ ] **Hover states exist**: Interactive elements change appearance on hover
- [ ] **No accidental transparency**: `opacity` isn't applied to containers when only text should be dimmed
- [ ] **Border colors consistent**: All borders use `var(--color-border)` or `border-[var(--color-border)]`
- [ ] **Destructive actions stand out**: Delete/close actions use `var(--color-destructive)`

### Interactive States
- [ ] **Focus rings visible**: Keyboard-navigated elements show focus indicator
- [ ] **Click targets adequate**: Buttons are at least `28×28px` or `h-7`
- [ ] **Hover feedback**: All clickable elements have a hover state (color change, background, etc.)
- [ ] **Disabled state clear**: Disabled inputs/buttons are visibly muted (`opacity-50`)
- [ ] **Loading state visible**: Async operations show spinner or skeleton, not frozen UI
- [ ] **Error state visible**: Errors use `var(--color-destructive)` and are impossible to miss

### Chrome Polish
- [ ] **Scrollbar styling**: Custom scrollbar matches theme (in `index.css`)
- [ ] **Resize handles visible**: Mosaic borders have visible drag indicators
- [ ] **Icons are aligned**: Icon buttons center their icons (`flex items-center justify-center`)
- [ ] **Close buttons work**: `×` buttons are tappable and have hover state
- [ ] **Tab bars don't wrap**: `overflow-x-auto whitespace-nowrap` on tab containers
- [ ] **Badge counts visible**: Notification counts use small circular badge, don't overlap parent

### Empty States
- [ ] **No empty panels**: Every panel has a meaningful empty state (icon + text + CTA)
- [ ] **Empty state is centered**: `flex items-center justify-center` with `opacity-40`
- [ ] **Action-oriented**: Empty states guide the user to do something (not just "nothing here")

---

## Section 2: Code Review Checklist

### Accessibility
- [ ] Icon-only buttons have `aria-label` or `title`
- [ ] Inputs have `placeholder` text
- [ ] `<button>` for actions, not `<div onClick>`
- [ ] Decorative icons have `aria-hidden="true"` (or use inline SVG without roles)
- [ ] Semantic HTML: `<nav>`, `<main>`, `<aside>`, `<header>` where appropriate

### Focus States
- [ ] Interactive elements have `focus-visible:ring-*` or equivalent
- [ ] Never `outline-none` / `outline: 0` without a focus-visible replacement
- [ ] Use `:focus-visible` over `:focus` (avoid ring on mouse click)
- [ ] Compound controls (tab+close button) use `:focus-within`

### Tailwind Best Practices
- [ ] No `transition: all` — list properties explicitly: `transition-colors`, `transition-opacity`
- [ ] Prefer `h-[28px]` over `h-7` for exact pixel control (IDE chrome needs precision)
- [ ] Use `shrink-0` on elements that must not compress
- [ ] Use `min-w-0` on flex children that need truncation
- [ ] Use `truncate` or `line-clamp-*` for long text
- [ ] No hardcoded colors in JSX — use `var(--color-*)` or Tailwind theme tokens
- [ ] Avoid `!important` in Tailwind classes — use CSS specificity instead

### Monaco Integration
- [ ] Editor container uses `absolute inset-0` inside a `relative` parent
- [ ] Never apply Tailwind classes directly to Monaco's DOM
- [ ] `automaticLayout: true` is set for resize handling
- [ ] Model registry is shared outside React (use `Map<string, ITextModel>`)
- [ ] Web workers use Vite `?worker` imports + `MonacoEnvironment.getWorker()`

### xterm.js Integration
- [ ] Terminal container uses `absolute inset-0` inside a `relative` parent
- [ ] Resize sends only `Number.isFinite()` values (guard against NaN)
- [ ] No `convertEol: true` in xterm config (causes double line wrapping)
- [ ] Each terminal tab gets its own PTY (don't share terminal IDs)

### Mosaic Layout
- [ ] Tiles are wrapped in `MosaicWindow` with custom `renderToolbar`
- [ ] Drag strip is an 8px gradient header (`.mosaic-drag-strip`)
- [ ] `draggable={path.length > 0}` prevents dragging root tile
- [ ] Minimize unmounts from tree; state preserved in `tileRegistry`
- [ ] `removeFromTree` collapses single-child parents

---

## Section 3: Typography Rules

### Punctuation
- Use `…` (U+2026) not `...` for ellipsis
- Use `"` `"` (curly quotes) not `"` `"` for quoted text in copy
- Use `–` (en-dash) not `-` for ranges
- Use `×` (multiplication sign) for close buttons, not `x`

### Font Sizing
| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Panel title | `text-[11px]` | `font-semibold` | `uppercase tracking-wide` |
| Body text | `text-[13px]` | `font-normal` | Default UI text |
| Small text | `text-[12px]` | `font-normal` | Hints, metadata |
| Tiny text | `text-[10px]` | `font-medium` | Labels, tags |
| File names | `text-[13px]` | `font-normal` | Truncated with ellipsis |
| Code | `text-[11px]` | `font-mono` | In tool call accordions |
| Status bar | `text-[12px]` | `font-medium` | Bottom bar text |

### Line Heights
- Body text: `leading-[1.5]` or `leading-normal`
- Tight UI labels: `leading-none` or `leading-[1.2]`
- Code blocks: `leading-[1.4]`
- Headings: `leading-tight`

### Number Display
- Use `font-variant-numeric: tabular-nums` for columns of numbers (line/col counts, file sizes)
- Numerals for counts: `"8 files"` not `"eight files"`

---

## Section 4: Animation & Motion

### Timing Defaults
| Element | Duration | Easing |
|---------|----------|--------|
| Hover (color/opacity) | 150ms | `ease` |
| Button press | 100ms | `ease-out` |
| Panel expand/collapse | 200ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Modal/drawer | 250ms | `cubic-bezier(0.32, 0.72, 0, 1)` |
| Drag strip highlight | 100ms | `ease` |

### Core Rules
- Animate only `transform` and `opacity` (compositor-friendly, no layout recalc)
- Never `transition: all`
- Never animate layout properties (`width`, `height`, `top`, `left`)
- Hover animations gated behind `@media (hover: hover) and (pointer: fine)`
- Exit animations should be faster than enter animations
- Start scale at `0.9` not `0` for popovers (nothing appears from nothing)
- Stagger reveals at 30-50ms per item, total under 300ms

### Anti-patterns
- `transition: all` — triggers layout recalc
- Animating `width`/`height` for interactive feedback
- `ease-in` for UI entrances (feels sluggish)
- Animating from `scale(0)` — use `scale(0.85–0.95)`
- Permanent `will-change` — toggle only during animation

---

## Section 5: Content & Microcopy

### Writing Style
- **Active voice**: "Open the folder" not "The folder will be opened"
- **Title Case** for headings and buttons: "Open Folder" not "Open folder"
- **Second person**: "Your file has been saved" not "The file has been saved"
- **Specific labels**: "Save All" not "Continue", "New Terminal" not "Add"
- **Error messages include fix**: "File not found. Check the path and try again." not just "Error"
- **Use `&` over "and"** where space-constrained

### Loading States
- End with `…`: `"Saving…"`, `"Connecting…"`, `"Initializing…"`
- Show progress where possible (spinner + text, not just spinner)
- Disable inputs during async operations

### Empty States
- Icon + descriptive text + action button
- Example: `"No files open"` with `"Open a file from the explorer or press Ctrl+P"`
- Centered with `opacity-40` for non-urgent feel

---

## Section 6: Dark Mode & Theming

### CSS Custom Properties
All colors use CSS custom properties defined in `:root`:

```css
--color-background       /* Main app background */
--color-background-dark  /* Panel backgrounds */
--color-background-light /* Lighter panel backgrounds */
--color-foreground       /* Primary text */
--color-foreground-dim   /* Secondary/muted text */
--color-foreground-muted /* Tertiary/hint text */
--color-border           /* Borders and separators */
--color-card             /* Active/selected card background */
--color-primary          /* Accent color (green in Murder IDE) */
--color-primary-faint    /* Subtle primary background */
--color-primary-foreground /* Text on primary background */
--color-destructive      /* Error/delete color (red) */
--color-active           /* Active element color */
--color-hover            /* Hover background */
--color-muted            /* Muted background (badges) */
```

### Rules
- Never hardcode hex/RGB colors in JSX or Tailwind — use `var(--color-*)`
- For Tailwind arbitrary values: `bg-[var(--color-background)]`
- `color-scheme: dark` on `<html>` for native scrollbar/input styling
- `<meta name="theme-color">` matches app background
- Test all interactive states (hover, active, focus, disabled) in dark mode

---

## Section 7: Layout & Responsive

### Flexbox Rules
- Always set `min-w-0` on flex children that need truncation
- Use `shrink-0` on elements that must maintain size (icons, buttons, badges)
- Use `overflow-hidden` on containers that hold truncating content
- Flex direction for panels: `flex-col` for vertical stacks, `flex-row` for horizontal

### Grid Rules
- Prefer CSS grid for 2D layouts (complex panels)
- Use flexbox for 1D layouts (tab bars, status bars, toolbars)
- Grid over JS measurement for layout

### Overflow Handling
- `overflow-x-auto` for horizontal scroll (tab bars, long paths)
- `overflow-y-auto` for vertical scroll (file lists, message panels)
- `overflow-hidden` for containers that clip content intentionally
- Never let content break the layout — always contain overflow

### Safe Areas
- Full-height elements use `h-[calc(100vh-28px)]` (subtracting bottom bar)
- Bottom bar is fixed `h-[28px]` with `shrink-0`
- Mosaic layout fills `flex-1` between menu bar and bottom bar

---

## Section 8: Performance

### Rendering
- Large lists (>50 items): consider virtualization
- No `getBoundingClientRect`/`offsetHeight` in render
- Batch DOM reads/writes; avoid interleaving
- Prefer uncontrolled inputs; controlled inputs must be cheap per keystroke

### CSS
- No `* { transition: all }` resets
- No expensive selectors (`div > * > span`)
- Use CSS containment (`contain: layout`) for isolated panels

### Monaco
- Dispose models when closing files to free memory
- Share model registry across editors to avoid duplicate models
- Use `automaticLayout: true` instead of manual resize handlers

---

## Section 9: Anti-patterns to Flag

| Anti-pattern | Why | Fix |
|-------------|-----|-----|
| `transition: all` | Layout recalc, animates unintended properties | `transition-colors transition-opacity` |
| `outline: none` without focus-visible | Removes keyboard focus indicator | `focus-visible:ring-2 ring-[var(--color-primary)]` |
| `<div onClick>` for actions | No keyboard support, wrong semantics | `<button onClick>` |
| `autoFocus` without justification | Disorienting on mount | Remove or gate behind user action |
| Hardcoded colors in JSX | Breaks theming, inconsistent | `var(--color-*)` or Tailwind tokens |
| `text-ellipsis` without `min-w-0` | Doesn't truncate in flex | Add `min-w-0` to flex parent |
| Images without dimensions | Layout shift (CLS) | Not applicable (no images in IDE) |
| `...` instead of `…` | Wrong character, looks amateurish | Use `…` (U+2026) |
| `ease-in` for UI | Feels sluggish | `ease-out` or custom `cubic-bezier` |
| `scale(0)` for popovers | Unnatural | `scale(0.85-0.95)` |
| Form inputs without labels | No context | Add `placeholder` or visible label |
| Icon buttons without `aria-label` | Inaccessible | Add `title` or `aria-label` |
| `onPaste` with `preventDefault` | Blocks legitimate paste | Remove or handle gracefully |
| `user-scalable=no` | Disables zoom | Remove |
| Large `.map()` without virtualization | Performance | Consider virtualization for >50 items |

---

## Section 10: Component-Specific Patterns

### Tab Bars
```tsx
<div className="flex bg-[var(--color-background)] border-b border-[var(--color-border)] overflow-x-auto shrink-0 h-[35px]">
  {/* Tabs with: min-w-0, overflow-hidden, text-ellipsis, whitespace-nowrap */}
  {/* Active tab: bg-[var(--color-card)], top accent line, full opacity */}
  {/* Inactive tab: transparent bg, dim color */}
  {/* Close button: h-5 w-5, hover:color-destructive */}
</div>
```

### Status Bar (Bottom Bar)
```tsx
<div className="h-[28px] flex items-center px-2 text-[12px] shrink-0 font-medium flex-nowrap select-none">
  {/* Fixed height, no text wrapping, no selection */}
  {/* Left: activity icons (28×28px) */}
  {/* Center: workspace name, dirty indicator */}
  {/* Right: status info, toggle buttons, explorer */}
</div>
```

### Tool Call Accordion
```tsx
<div className="text-[12px] rounded overflow-hidden border border-[color]33 bg-[var(--color-background)]">
  {/* Header: click to toggle, icon + code label + chevron */}
  {/* Body: border-t, px-2.5 py-2, content */}
  {/* Status colors: completed=green, failed=red, in-progress=primary */}
</div>
```

### Empty State
```tsx
<div className="flex flex-col items-center justify-center gap-3 opacity-40">
  <div className="text-3xl">◆</div>
  <div className="text-sm">No files open</div>
</div>
```

---

## Section 11: Review Workflow

### When to Trigger
- After implementing a new component or page
- Before merging a PR that touches UI
- When the user asks "review my UI" or "audit this"
- When adding animations or transitions
- When changing colors, fonts, or spacing

### Review Process
1. **Take a screenshot** of the current state
2. **Read the relevant sections** above based on what changed
3. **Check the visual inspection checklist** against the screenshot
4. **Review the code** against the code review checklist
5. **Report findings** in this format:

```markdown
## UI Findings

### src/components/Component.tsx
- [CRITICAL] `a11y-icon-button-missing-label`: Close button has no accessible name.
  - Fix: Add `title="Close"` or `aria-label="Close"`.
- [HIGH] `typo-ellipsis`: Using `...` instead of `…` in loading text.
  - Fix: Replace with `…` (U+2026).

### src/components/CleanComponent.tsx
- ✓ pass
```

### Priority Levels
- **CRITICAL**: Accessibility violations, broken interactions, data loss
- **HIGH**: Visual bugs, missing states, poor contrast, layout breaks
- **MEDIUM**: Typography issues, inconsistent spacing, missing hover states
- **LOW**: Microcopy improvements, polish suggestions



---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.
license: Apache 2.0
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.
