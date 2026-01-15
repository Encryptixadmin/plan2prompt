# Design Guidelines: Production-Ready Web Platform

## Design Approach
**System**: Material Design + Linear-inspired refinement
**Rationale**: This platform requires clean, scalable patterns for data-heavy interfaces with professional polish. Material's component library provides consistency, while Linear's typography and spacing refinement adds modern sophistication.

## Core Design Principles
1. **Clarity First**: Information hierarchy drives every layout decision
2. **Scalable Patterns**: Reusable components that work across modules
3. **Professional Polish**: Production-grade quality in every detail
4. **Efficient Density**: Maximize information without overwhelming users

---

## Typography System

**Font Family**: Inter (primary), JetBrains Mono (code/data)

**Hierarchy**:
- Display: text-5xl font-bold (hero headlines)
- H1: text-4xl font-bold
- H2: text-3xl font-semibold
- H3: text-2xl font-semibold
- H4: text-xl font-semibold
- Body: text-base font-normal
- Small: text-sm font-normal
- Caption: text-xs font-medium

**Line Heights**: leading-tight (headings), leading-relaxed (body)

---

## Layout System

**Spacing Units**: Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Micro spacing: 2, 4 (within components)
- Component spacing: 6, 8 (between elements)
- Section spacing: 12, 16, 20 (between groups)
- Major spacing: 24 (between major sections)

**Container Strategy**:
- Full-width sections: `w-full` with inner `max-w-7xl mx-auto px-6`
- Content sections: `max-w-6xl mx-auto`
- Forms/focused content: `max-w-2xl mx-auto`

**Grid System**:
- Desktop: `grid-cols-12` (flexible layouts)
- Tables/Data: `grid-cols-[auto_1fr_auto]` (adaptive columns)
- Cards: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Dashboards: `grid-cols-1 lg:grid-cols-[280px_1fr]` (sidebar + main)

---

## Component Library

### Navigation
**Top Navigation**: Fixed header (h-16), logo left, primary nav center, user menu right, subtle border-b
**Sidebar**: w-64 (desktop), full drawer (mobile), sections with headers, active state indicators

### Cards
**Standard Card**: Rounded (rounded-lg), subtle shadow (shadow-sm), padding (p-6), hover lift effect (minimal)
**Stat Card**: Larger value display, trend indicators, compact layout
**Data Card**: Dense information, clear labels, scannable metrics

### Forms
**Input Fields**: h-10, rounded-md, full border, focus ring, label above, helper text below
**Buttons**: h-10 (default), h-12 (large), h-8 (small), rounded-md, font-medium
**Checkbox/Radio**: Custom styled, accessible, clear hit areas (min 44px)

### Tables
**Data Tables**: Sticky header, alternating row backgrounds (subtle), sortable columns, row actions on hover
**Responsive**: Stack to cards on mobile (<768px)

### Modals/Overlays
**Modal**: max-w-lg to max-w-2xl, rounded-lg, backdrop blur, centered, escape to close
**Drawer**: Slide from right, w-96 to w-[500px], full-height

### Feedback
**Alerts**: Top-right toast notifications, 4-second auto-dismiss, icon + message
**Loading States**: Skeleton screens for data, spinner for actions
**Empty States**: Centered, illustration placeholder, clear CTA

---

## Page Structures

### Landing/Marketing Page
**Hero Section**: h-[600px], large centered headline, two-column layout (text left, hero image right), primary CTA, secondary link below

**Features Section**: 3-column grid, icon + title + description cards, py-20

**Stats Section**: 4-column grid, large numbers, labels, py-16

**Testimonials**: 2-column grid, quote + author + role, avatar images

**CTA Section**: Centered, bold headline, description, prominent button, py-24

**Footer**: 4-column grid (product, company, resources, legal), newsletter signup, social links, copyright

### Dashboard
**Layout**: Sidebar navigation (left) + main content area (right)
**Overview**: KPI cards row (4 across), charts section, recent activity table
**Responsive**: Collapsible sidebar, mobile drawer

### Data/Admin Tables
**Layout**: Page header (title + actions), filters row, data table, pagination footer
**Actions**: Bulk actions toolbar (appears on selection), inline row actions (dropdown)

### Settings/Forms
**Layout**: Two-column (navigation left, form right on desktop), stacked on mobile
**Sections**: Clear section headers, grouped fields, save/cancel footer

---

## Images

### Hero Section (Landing Page)
**Large hero image**: Product dashboard screenshot or abstract tech visualization
**Placement**: Right side of two-column hero layout
**Size**: Approximately 600x500px, rounded-lg corners
**Treatment**: Subtle shadow, may include device frame mockup

### Feature Sections
**Icons**: Use Heroicons (outline style) at w-12 h-12 for feature highlights
**Supporting Images**: Optional product screenshots for key features (400x300px)

### Testimonials
**Avatar Images**: 48x48px circular photos
**Optional**: Customer company logos (grayscale, 120x40px)

### Empty States
**Illustrations**: Centered, 240x240px, simple line art style
**Placement**: Above empty state message and CTA

**Buttons on Images**: Any button overlaying images must have `backdrop-blur-sm bg-white/20` or similar treatment for legibility

---

## Interaction Patterns

**Hover States**: Subtle scale (1.02) on cards, underline on text links, opacity shift on icons
**Focus States**: Thick ring (ring-2), offset (ring-offset-2), brand-appropriate
**Active States**: Scale down (0.98) on buttons, darker background
**Transitions**: duration-200 for most interactions, duration-300 for page transitions

**Animations**: Minimal. Use only for:
- Page load (fade-in)
- Data loading (skeleton shimmer)
- Success confirmation (checkmark scale)

---

## Accessibility Standards

- Minimum text contrast: 4.5:1 (body), 3:1 (large text)
- Touch targets: min 44x44px
- Focus indicators: Always visible, never removed
- Form labels: Always present, associated with inputs
- Alt text: Descriptive for all images
- Keyboard navigation: Full support, logical tab order

---

## Responsive Breakpoints

- Mobile: < 640px (stack all columns, full-width components)
- Tablet: 640px - 1024px (2-column max, collapsible sidebar)
- Desktop: 1024px+ (full layouts, fixed sidebar)

**Mobile-First Approach**: Design for mobile, progressively enhance for larger screens.