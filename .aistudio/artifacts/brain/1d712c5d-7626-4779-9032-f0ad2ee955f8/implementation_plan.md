# Implementation Plan: Book a Call | Popup 1 — 3-Line Descriptions & Card Layout Alignment

## Overview
This plan implements the requested updates to **Popup 1** (Call Type Selection) inside the existing **Book a Call** flow of Funzy Tech:
1. Increase description text in all four call type boxes to properly fill the available space.
2. Structure all four boxes with the exact order: **Icon at top** (with price pill at top-right) → **Title directly below icon** → **Description directly below title**.
3. Format descriptions across **strictly 3 lines** across all 4 boxes (Live Chat, Voice Call, Video Call, and Custom Call) with uniform vertical alignment and no clipping.
4. Use professionally crafted English descriptions matching the website's tech & design consultancy tone (as confirmed in clarifying question turn).

---

## 1. Description Copy (Strict 3-Line Formatting)

Each description is crafted to comfortably fill 3 visual lines within the cards:

| Call Type | Price | 3-Line English Description |
| :--- | :--- | :--- |
| **Live Chat** | `₹1/Min` | Quick text assistance for instant queries, tech guidance, and step-by-step problem resolution. |
| **Voice Call** | `₹3/Min` | Direct one-on-one voice conversation for detailed project discussion and clear guidance. |
| **Video Call** | `₹7/Min` | Face-to-face screen sharing and interactive visual consultation for your tech requirements. |
| **Custom Call** | `₹49/Min` | Choose your preferred call type, combine multiple services, and select your preferred date. |

---

## 2. Card Content & Layout Hierarchy

In each of the four cards in the 2×2 grid:
1. **Top Row**: 
   - Animated Icon (`animate-call-chat-loop`, `animate-call-voice-loop`, `animate-call-video-loop`, `animate-call-calendar-loop`) on the left.
   - Price pill on the top right (`₹1/Min`, `₹3/Min`, `₹7/Min`, `₹49/Min`).
2. **Title**:
   - Positioned directly underneath the icon with bold font: `font-['Outfit',sans-serif] font-black text-[14px] sm:text-[15.5px] text-[#261508] leading-tight`.
3. **Description**:
   - Positioned directly below the title.
   - Typography: `text-[11.5px] sm:text-[12px] text-[#7d644d] font-medium leading-[1.38] sm:leading-[1.4]`.
   - Layout constraint: `line-clamp-3 min-h-[3.8em] sm:min-h-[4.2em]` to guarantee identical 3-line layout across mobile and desktop without visual shifts or empty space.
4. **Card Proportions**:
   - `min-h-[164px] sm:min-h-[178px]` square-like rounded rectangle (`rounded-[22px] sm:rounded-[24px]`).
   - Smooth `scale-[1.035] sm:scale-[1.04]` scale-up animation on selection.

---

## 3. Preserved Features & Constraints

- **Developer Identity**: Shiv Kumar & Funzy Tech preserved (`metadata.json`, email, admin credentials unchanged).
- **Header**: Animated phone logo badge with "Choose Your Call Type" and "Select how you'd like to connect with us." preserved.
- **Button**: Slow smooth fade-out continue button preserved.
- **Navigation**: Clean transitions to Step 2 without cut icon in Step 2 preserved.
- **Liquid Glass Design**: Dark liquid glass frosted aesthetic preserved.

---

## 4. Verification & Testing

1. Validate syntax and types with `lint_applet` (`tsc --noEmit`).
2. Validate bundling with `compile_applet`.
3. Verify 2×2 grid appearance, text alignment, and line counts across viewport sizes.
