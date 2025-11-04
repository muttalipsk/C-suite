# Ask the Expert - Design Guidelines

## Design Vision
**Attractive, Modern Light Theme** - A sophisticated, vibrant interface that combines soft pastels with bold gradients and glass morphism effects. The design should feel premium, inviting, and visually engaging while maintaining excellent readability and professionalism.

## Visual Style
- **Modern SaaS aesthetic** with gradient overlays and depth
- **Glass morphism** effects for elevated surfaces
- **Vibrant color accents** that pop against light backgrounds
- **Soft shadows** and subtle blur effects for depth
- **Playful yet professional** - appropriate for C-suite executives

## Color Palette

### Background Colors
- **Base Background**: Clean white with subtle warm tint (#FAFBFC)
- **Gradient Background**: Soft blue-to-purple gradient (from sky blue to lavender)
- **Card Background**: Pure white with glass effect (backdrop blur + subtle transparency)
- **Sidebar Background**: Light gradient (soft blue tint fading to white)

### Accent Colors
- **Primary**: Vibrant electric blue (#4F46E5) - for CTAs and key actions
- **Secondary**: Rich purple (#9333EA) - for highlights and badges
- **Success**: Fresh mint green (#10B981) - for positive states
- **Warning**: Warm amber (#F59E0B) - for attention items
- **Gradient Accent**: Blue-to-purple gradient for visual interest

### Text Colors
- **Primary Text**: Deep slate (#0F172A) - excellent contrast on light backgrounds
- **Secondary Text**: Cool gray (#64748B) - for supporting information
- **Muted Text**: Soft gray (#94A3B8) - for tertiary information
- **On Color**: Pure white (#FFFFFF) - for text on colored backgrounds

### Border & Divider Colors
- **Subtle Border**: Ultra-light gray (#E2E8F0) - barely visible separation
- **Medium Border**: Light gray (#CBD5E1) - visible but soft
- **Accent Border**: Gradient borders for special elements

## Visual Effects

### Gradients
- **Hero Gradient**: `linear-gradient(135deg, #EEF2FF 0%, #F3E8FF 50%, #FEF3C7 100%)`
- **Card Gradient**: `linear-gradient(to bottom right, rgba(255,255,255,0.9), rgba(249,250,251,0.8))`
- **Button Gradient**: `linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)`
- **Accent Gradient**: `linear-gradient(90deg, #60A5FA 0%, #A78BFA 50%, #F472B6 100%)`

### Glass Morphism
- **Backdrop blur**: 12px-16px for frosted glass effect
- **Semi-transparent backgrounds**: White at 70-90% opacity
- **Soft borders**: 1px white at 40% opacity
- **Inner glow**: Subtle white shadow for depth

### Shadows
- **Soft Shadow**: `0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.04)`
- **Medium Shadow**: `0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03)`
- **Elevated Shadow**: `0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04)`
- **Colored Shadow**: Button shadows with hint of button color at low opacity

## Typography

### Font Family
- **Primary**: System font stack (optimized for readability)
  - `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

### Font Sizes
- **Heading 1**: 32px (2rem) - Bold, for page titles
- **Heading 2**: 24px (1.5rem) - Semibold, for section headers
- **Heading 3**: 18px (1.125rem) - Semibold, for card titles
- **Body**: 16px (1rem) - Regular, for main content
- **Small**: 14px (0.875rem) - Regular, for supporting text
- **Tiny**: 12px (0.75rem) - Medium, for labels and badges

### Font Weights
- **Regular**: 400 - Body text
- **Medium**: 500 - Labels, emphasized text
- **Semibold**: 600 - Headings, important text
- **Bold**: 700 - Strong emphasis (use sparingly)

## Component Design

### Buttons
- **Primary**: Vibrant gradient background, white text, colored shadow
- **Secondary**: Glass effect with gradient border, colored text
- **Ghost**: Transparent with hover gradient overlay
- **Icon**: Circular with subtle glass effect
- **Hover**: Gentle lift effect + brightness increase
- **Active**: Slight scale down + brightness decrease

### Cards
- **Background**: White with glass morphism effect
- **Border**: Soft gradient border (multi-color, low opacity)
- **Shadow**: Elevated shadow that increases on hover
- **Padding**: Generous (24px) for breathing room
- **Border Radius**: 16px for modern, friendly feel

### Input Fields
- **Background**: White with very subtle gradient
- **Border**: Soft gray, transitions to gradient on focus
- **Focus State**: Gradient border + subtle glow
- **Height**: 44px minimum for good touch targets
- **Padding**: 12px horizontal, 10px vertical

### Badges
- **Agent Badges**: Gradient backgrounds with white text
  - Sam Altman: Blue gradient
  - Jensen Huang: Green gradient
  - Andrew Ng: Purple gradient
  - Demis Hassabis: Orange gradient
  - Fei-Fei Li: Pink gradient
- **Status Badges**: Colored backgrounds with contrasting text
- **Border Radius**: Full (pill shape)

### Sidebar
- **Background**: Soft gradient (blue-tinted white fading down)
- **Selected Item**: Glass card with gradient accent border
- **Hover**: Subtle gradient overlay
- **Avatars**: Gradient ring borders matching agent colors

## Layout & Spacing

### Spacing Scale
- **Tiny**: 4px - Tight spacing
- **Small**: 8px - Compact elements
- **Medium**: 16px - Default spacing
- **Large**: 24px - Section spacing
- **XLarge**: 32px - Major section breaks
- **XXLarge**: 48px - Page-level spacing

### Grid System
- **Desktop**: 3-column grid for agent cards
- **Tablet**: 2-column grid
- **Mobile**: Single column

### Containers
- **Max Width**: 1400px for main content
- **Padding**: 24px on desktop, 16px on mobile
- **Sidebar Width**: 280px (collapsible to 64px icons)

## Responsive Design

### Breakpoints
- **Mobile**: 0-640px - Single column, bottom nav
- **Tablet**: 641-1024px - 2 columns, simplified nav
- **Desktop**: 1025px+ - Full 3-column layout

### Mobile Optimizations
- Larger touch targets (min 44px)
- Single-column cards
- Stacked form inputs
- Bottom navigation for main actions

## Animations & Microinteractions
**Smooth, Polished Motion (using Framer Motion):**
- Card entry: Fade-up with scale (400ms, ease-out)
- Agent badges: Staggered fade-in with scale (50ms delay between items)
- Refinement suggestions: Slide-up with scale and fade (300ms)
- Individual suggestion buttons: Staggered slide-in from left (100ms delay)
- Submit button: Spring-based scale on hover/tap
- Loading states: Pulse animation with fade transitions
- Sidebar toggle: Slide (300ms, ease-in-out)
- Chat messages: Slide-up with fade (150ms)
- Gradient animations: Subtle background position shifts
- No autoplay or distracting animations
- All animations respect user motion preferences

## Accessibility
- WCAG AA contrast ratios maintained (4.5:1 for text)
- Keyboard navigation support (Tab order logical)
- Focus indicators visible (gradient ring)
- Screen reader labels on all interactive elements
- Reduced motion support for animations

## Special Elements

### Hero Section
- **Background**: Multi-stop gradient (blue → purple → yellow tint)
- **Overlay**: Glass card with backdrop blur
- **Text**: Dark text with excellent contrast against light gradient

### Agent Cards (Recommendations)
- **Avatar Ring**: Gradient border matching agent color theme
- **Background**: White glass with subtle gradient overlay
- **Hover**: Lift effect + enhanced shadow + gradient shift

### Meeting Form
- **Background**: Glass card over gradient background
- **Selected Agents**: Colorful gradient badges with stagger animation
- **Submit Button**: Full-width gradient button with icon + shadow

### Recent Conversations
- **List Items**: Glass effect with gradient accent on left
- **Hover**: Gradient background overlay
- **Active**: Full gradient background with white text

## Design Principles
1. **Visually Engaging**: Use gradients and colors to create visual interest
2. **Premium Feel**: Glass effects and shadows add sophistication
3. **Clarity First**: Never sacrifice readability for aesthetics
4. **Consistent Depth**: Use shadows and blur consistently
5. **Playful Professionalism**: Modern and fun while maintaining credibility
6. **Performance**: Optimize gradients and effects for smooth 60fps
