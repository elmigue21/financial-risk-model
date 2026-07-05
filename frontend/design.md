# Design System — Financial Health Check

The visual language for the app. Two rules drive everything: **no borders**
(separation comes from shadows) and **consistent tokens** (spacing, type, color
never ad-hoc). All tokens live in [`tailwind.config.ts`](./tailwind.config.ts)
and [`app/globals.css`](./app/globals.css).

---

## Principles

1. **No borders.** Nothing uses `border`. Containers separate from the
   background with a soft shadow; inputs separate by being _filled_ (a light
   background) rather than outlined.
2. **Shadows for depth.** Three shadow tokens only — `soft` (inputs/buttons),
   `card` (containers), `focus` (input focus ring). Don't invent new ones.
3. **Consistent spacing.** Use Tailwind's spacing scale (multiples of 4px). The
   app leans on a small set: `2` (8px), `4` (16px), `6` (24px), `8` (32px),
   `12` (48px). Card padding is always `p-8` (`p-5` on mobile).
4. **Consistent type.** Use Tailwind's type scale only. See the table below —
   every piece of text maps to one of these.
5. **One accent color.** `brand` (indigo) for actions. Risk states use the
   semantic `low` / `medium` / `high` colors and nothing else.

---

## Tokens

### Color

| Token          | Hex       | Use                                  |
| -------------- | --------- | ------------------------------------ |
| `canvas`       | `#eef1f6` | Page background                      |
| `surface`      | `#ffffff` | Cards                                |
| `field`        | `#f1f3f7` | Input backgrounds, inset panels      |
| `ink`          | `#1f2733` | Primary text                         |
| `muted`        | `#6b7685` | Secondary text, hints                |
| `brand`        | `#3b5bdb` | Buttons, links, focus                |
| `brand.strong` | `#2f4bc4` | Button hover                         |
| `low` / `bg`   | green     | Low-risk result                      |
| `medium` / `bg`| amber     | Medium-risk result                   |
| `high` / `bg`  | red       | High-risk result + errors            |

### Type scale (Tailwind defaults)

| Class       | Size | Use                          |
| ----------- | ---- | ---------------------------- |
| `text-xs`   | 12px | Hints, notes, disclaimers    |
| `text-sm`   | 14px | Labels, body, advice         |
| `text-base` | 16px | Inputs, buttons              |
| `text-xl`   | 20px | Card headings                |
| `text-3xl`  | 30px | Page title                   |
| `text-5xl`  | 48px | The risk percentage          |

### Spacing

Card padding `p-8`; grid/stack gaps `gap-6`; label→hint→input gap `gap-2`.
Page max width `max-w-3xl`, vertical rhythm `py-12`.

### Shadow

| Token          | Value                                 | Use             |
| -------------- | ------------------------------------- | --------------- |
| `shadow-soft`  | `0 1px 2px rgba(23,33,51,.06)`        | Inputs, buttons |
| `shadow-card`  | `0 6px 20px rgba(23,33,51,.08)`       | Containers      |
| `shadow-focus` | `0 0 0 3px rgba(59,91,219,.25)`       | Input focus     |

### Radius

`rounded-card` (14px) for containers, `rounded-field` (10px) for inputs and
buttons, `rounded-full` for the risk badge.

---

## Components

- **Card** — `rounded-card bg-surface p-8 shadow-card`. The only container.
- **Input** — `rounded-field bg-field px-4 py-3 shadow-soft` + `focus:shadow-focus`.
  No border; filled background. Number spinners are hidden in `globals.css`.
- **Button** — `rounded-field bg-brand px-4 py-4 text-white shadow-soft` +
  `hover:bg-brand-strong`. Spans the full form grid (`col-span-full`).
- **Risk badge** — pill (`rounded-full`) tinted by risk level.
- **Advisor panel** — an inset `field`-colored block inside the result card for
  the streamed AI advice.

---

## Layout

Single centered column (`max-w-3xl`), three stacked cards: **form → result →**
the advice sits _inside_ the result card. The form is a 2-column grid on desktop
(`sm:grid-cols-2`) collapsing to 1 column on mobile.
