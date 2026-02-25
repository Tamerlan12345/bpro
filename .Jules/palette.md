## 2026-02-25 - Modal Accessibility
**Learning:** Modals often use `<span>` for close buttons, which are inaccessible to keyboard users. Replacing them with `<button>` and `aria-label` is a high-impact, low-effort fix.
**Action:** Always check modal close "buttons" for semantic HTML and keyboard accessibility.

## 2026-02-25 - Icon-Only Toolbars
**Learning:** Replacing text buttons with icons in toolbars significantly reduces visual clutter and saves space, but critically requires `aria-label` and `title` attributes to remain accessible and understandable.
**Action:** When converting to icon-only buttons, always ensure accessible names are preserved and tooltips (native or custom) are provided.
