---
name: Tedmark Core
colors:
  surface: '#faf8ff'
  surface-dim: '#d9d9e2'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3fb'
  surface-container: '#ededf6'
  surface-container-high: '#e8e7f0'
  surface-container-highest: '#e2e2ea'
  on-surface: '#1a1b21'
  on-surface-variant: '#434652'
  inverse-surface: '#2e3037'
  inverse-on-surface: '#f0f0f8'
  outline: '#737783'
  outline-variant: '#c3c6d4'
  surface-tint: '#2a5ab7'
  primary: '#002e73'
  on-primary: '#ffffff'
  primary-container: '#0143a0'
  on-primary-container: '#9ab6ff'
  inverse-primary: '#b0c6ff'
  secondary: '#712ae2'
  on-secondary: '#ffffff'
  secondary-container: '#8a4cfc'
  on-secondary-container: '#fffbff'
  tertiary: '#5e1c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#832b01'
  on-tertiary-container: '#ff9f7c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#b0c6ff'
  on-primary-fixed: '#001946'
  on-primary-fixed-variant: '#00419d'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#ffdbcf'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#802900'
  background: '#faf8ff'
  on-background: '#1a1b21'
  surface-variant: '#e2e2ea'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.01em
  label-xs:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style
The design system for this platform is built on the intersection of institutional reliability and cutting-edge AI capability. It targets high-growth enterprises and digital agencies that require a sophisticated, high-performance toolset.

The aesthetic follows a **Premium Modern SaaS** movement, blending high-utility minimalism with expressive technical details. Key stylistic pillars include:
- **Clean Precision:** High whitespace and clear typographic hierarchies inspired by industry leaders like Stripe and Vercel.
- **Glassmorphism:** Subdued use of backdrop blurs on navigation and overlays to create a sense of depth and modern layering.
- **AI Sophistication:** A dedicated "AI Processing" violet hue paired with subtle mesh gradients to signify intelligent automation without overwhelming the professional data-centric UI.
- **Tactile Softness:** Elements utilize large 14px border radii and multi-layered soft shadows to feel approachable and high-end, contrasting against the technical data-heavy nature of the platform.

## Colors
The palette is engineered for clarity and high-action visibility. 

### Core Palette
- **Primary (#0143A0):** A deep, authoritative blue used for brand presence, primary actions, and key navigation states.
- **AI Processing (#7C3AED):** Reserved for AI-driven insights, loading states for intelligence engines, and premium feature highlights.
- **Functional Colors:** Standardized Success, Warning, and Danger tokens ensure high accessibility for lead status and system alerts.

### Surface Strategy
- **Light Mode:** Uses a "Slate" scale (50-950) with high-value whites (#FFFFFF) for cards and subtle light-gray backgrounds (#F8FAFC) to differentiate UI sections.
- **Dark Mode:** Anchored by Slate 950 (#020617) as the base surface, using Slate 900 for container backgrounds. This provides a deep, "Vercel-like" contrast that makes data visualization pop.

## Typography
The system utilizes **Inter** exclusively to achieve a systematic, neutral, and highly readable interface.

- **Weight Usage:** Use `600` (SemiBold) for all semantic headings to provide strong visual anchoring. Use `400` (Regular) for body text to ensure maximum legibility in data-dense tables.
- **Letter Spacing:** Larger headlines use negative tracking (-0.01em to -0.02em) to appear tighter and more "editorial," while small labels use slight positive tracking (+0.01em) to improve readability.
- **Hierarchy:** Primary emphasis should be placed on data values (numbers) using SemiBold weights, while supporting labels use Regular weight and secondary text colors.

## Layout & Spacing
This design system adheres to an **8-point grid** to ensure mathematical harmony across all components.

- **Grid Model:** A 12-column fluid grid is used for main dashboards. Gutters are fixed at 24px (lg) to maintain breathing room between data widgets.
- **Safe Areas:** Page margins should scale from 16px on mobile to 48px on large desktops.
- **Content Density:** In data-heavy views (Lead Tables), the spacing may shift to a 4px (xs) and 8px (sm) increment to maximize information density without sacrificing clarity.
- **Breakpoints:**
  - Mobile: < 640px (Stacked layouts, full-width buttons).
  - Tablet: 640px - 1024px (2-column grids for cards).
  - Desktop: > 1024px (Sidebar navigation + 12-column grid).

## Elevation & Depth
Depth is created through a combination of **Ambient Shadows** and **Tonal Layering**, avoiding heavy black shadows in favor of tinted, diffused elevations.

- **Level 1 (Low):** 1px border (Slate 200/800) for standard cards and input fields. No shadow.
- **Level 2 (Medium):** For hover states on cards. Shadow: `0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)`.
- **Level 3 (High):** For Modals and Toasts. Utilizes a high-blur backdrop filter (`12px`) and a semi-transparent background (`rgba(255, 255, 255, 0.8)` in light mode) to create a glass effect.
- **AI Elevation:** Elements related to AI processing use a subtle violet outer glow (`0 0 15px rgba(124, 58, 237, 0.15)`) instead of standard gray shadows.

## Shapes
The shape language is defined by a consistent **14px radius** for primary containers, creating a modern, friendly, yet professional silhouette.

- **Buttons & Inputs:** Fixed at 14px (`rounded-lg` equivalent in this system) to match card containers.
- **Small Elements:** Tooltips and tags use a 6px radius for finer detail.
- **AI Accents:** Interactive AI components may use "Pill" shapes (999px) to distinguish them from standard rectangular lead management tools.

## Components

### Buttons
- **Primary:** Background #0143A0, white text. Subtle 1px inner light border on top for a "Clay" tactile feel.
- **AI Action:** Gradient background from #7C3AED to #0143A0. White text with a subtle shimmer animation on hover.
- **Ghost:** No background, Slate 600 text, becomes Slate 100 on hover.

### Sticky Header Tables
- Header uses a `backdrop-filter: blur(8px)` with a semi-transparent background to remain legible while scrolling.
- Rows feature a subtle bottom border; hover state applies a Slate 50/900 background shift.

### Hover-Animated Cards
- Default: 1px border.
- Hover: Elevates to Level 2 shadow, moves -4px on Y-axis, and the border color shifts to the primary brand blue.

### Interactive Charts
- Uses the full palette: Primary for main data, Purple for AI predictions, and Green/Red for growth metrics.
- Tooltips are glassmorphic with sharp typography.

### Modals & Toasts
- **Modals:** Centered, Level 3 elevation, enters with a scale-up animation (0.95 to 1.0).
- **Toasts:** Positioned bottom-right. Floating with a high-blur glass background. Success/Error status indicated by a 4px left-accent border color.

### Input Fields
- Focus state: Border color moves to Primary Blue with a 3px outer glow (ring) of #0143A0 at 15% opacity.