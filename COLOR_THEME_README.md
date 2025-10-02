# PrimePlus+ Galactic Color Theme Reference

This document describes the official galactic/cosmic color palette, gradients, and effects for the PrimePlus+ platform. Use these styles for a consistent, branded, and visually stunning user experience.

---

## Core Colors (Tailwind CSS)

| Name                | Tailwind Class         | Example/Usage                |
|---------------------|-----------------------|------------------------------|
| Primary             | `bg-primary`          | Main buttons, highlights     |
| Primary Foreground  | `text-primary-foreground` | Button text, on primary bg  |
| Fuchsia             | `bg-fuchsia-500`      | Accents, badges, glows       |
| Indigo              | `bg-indigo-600`       | Gradients, backgrounds       |
| Purple              | `bg-purple-700`       | Gradients, backgrounds       |
| Cosmic Purple       | `bg-purple-900`       | Card backgrounds, overlays   |
| Cosmic Gray         | `bg-gray-900`         | Card backgrounds, overlays   |
| White               | `bg-white`            | Text, icons, highlights      |

---

## Gradients

- **Primary Cosmic Gradient:**
  - `bg-gradient-to-br from-purple-900 via-indigo-800 to-fuchsia-700`
  - Used for featured/active cards, backgrounds

- **Button Gradient:**
  - `bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-500`
  - Used for primary action buttons

- **Nebula/Aurora Glow:**
  - `bg-gradient-to-r from-fuchsia-400 via-indigo-400 to-purple-400`
  - Used as a blurred background behind price or plan name

---

## Glows & Shadows

- **Blue Glow:**
  - `shadow-glow-blue` (custom Tailwind, e.g. `0 0 30px rgba(43,85,255,0.5)`)
- **Pink Glow:**
  - `shadow-glow-pink` (custom Tailwind, e.g. `0 0 30px rgba(255,105,180,0.5)`)
- **White Glow:**
  - `shadow-glow-white` (custom Tailwind, e.g. `0 0 20px rgba(255,255,255,0.8)`)
- **Drop Shadow for Text:**
  - `drop-shadow-glow` (custom, for cosmic text effects)

---

## Special Effects

- **Starfield SVG:**
  - Used as a background for featured/galactic cards
  - Example: `<svg>...<circle ... className="animate-twinkle" /></svg>`
  - Place as an absolutely positioned background in the card
- **Animated Twinkle:**
  - `animate-twinkle` (custom Tailwind animation for stars/checkmarks)
  - Use on SVG stars or checkmarks for subtle cosmic animation
- **Nebula/Aurora Glow:**
  - Place a blurred, low-opacity gradient span behind the price or plan name for a cosmic glow
  - Example: `<span className="absolute -inset-2 rounded-full blur-2xl opacity-60 bg-gradient-to-r from-fuchsia-400 via-indigo-400 to-purple-400"></span>`
- **Cosmic/Sci-Fi Font:**
  - Use a font like `Orbitron`, `Audiowide`, or another sci-fi font for plan names and headings
  - Example: `font-sci-fi` utility
- **Drop Shadow for Plan Name/Price:**
  - Use `drop-shadow-glow` for extra cosmic effect
- **Planet/Comet Icon:**
  - SVG icon for extra galactic flair (optional)

---

## Example: Dramatic Galactic Plan Card

```jsx
<div className="relative bg-gradient-to-br from-purple-900 via-indigo-800 to-fuchsia-700 rounded-3xl shadow-glow-blue p-8 text-white overflow-hidden">
  {/* Starfield SVG background */}
  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 animate-pulse" viewBox="0 0 260 340" fill="none">
    <circle cx="40" cy="60" r="1.2" fill="#fff" opacity="0.7" className="animate-twinkle" />
    <circle cx="120" cy="180" r="1.5" fill="#fff" opacity="0.5" className="animate-twinkle" />
    <circle cx="200" cy="100" r="0.8" fill="#fff" opacity="0.6" />
    <circle cx="180" cy="250" r="1" fill="#fff" opacity="0.4" />
    <ellipse cx="130" cy="170" rx="80" ry="32" fill="url(#nebula)" opacity="0.10" />
    <defs>
      <radialGradient id="nebula" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
      </radialGradient>
    </defs>
  </svg>
  {/* Plan Name */}
  <div className="text-3xl font-sci-fi font-bold uppercase tracking-widest drop-shadow-glow mb-2 relative z-10">Galactic Plan</div>
  {/* Nebula/Aurora Glow behind price */}
  <div className="relative flex flex-col items-center mb-4 z-10">
    <span className="absolute -inset-2 rounded-full blur-2xl opacity-60 bg-gradient-to-r from-fuchsia-400 via-indigo-400 to-purple-400"></span>
    <span className="relative text-5xl font-extrabold text-fuchsia-200 drop-shadow-glow">$29.99</span>
    <span className="block text-xs text-fuchsia-100 mt-1">per 30 days</span>
  </div>
  {/* Features List */}
  <ul className="w-full mb-4 z-10">
    <li className="flex items-center gap-2 text-fuchsia-100 py-1 border-b border-fuchsia-700/20 last:border-b-0">
      <span className="text-green-400 animate-twinkle"><FiCheck size={14} /></span>
      <span className="font-semibold truncate">VR Experience</span>
    </li>
    {/* ...more features... */}
  </ul>
  {/* Action Button */}
  <button className="w-full py-2 rounded-xl font-bold text-sm shadow-glow-pink bg-gradient-to-r from-fuchsia-500 via-purple-600 to-indigo-500 text-white z-10">Get More</button>
</div>
```

---

## Usage Notes
- Use gradients and glows for all primary actions and featured cards.
- Use the starfield SVG and twinkle animation for galactic highlights.
- Use the nebula/aurora glow behind price or plan name for cosmic drama.
- Use the sci-fi font for plan names and important headings.
- Use the color palette for all new UI elements to maintain brand consistency.
- Featured/galactic cards should use more space, larger font, and more visual drama than standard cards.

---

**Keep this file updated as the theme evolves!** 