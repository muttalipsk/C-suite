# Design Guidelines for Ask the Expert

## Design Approach
**Modern Light Theme:** Inspired by Linear, Stripe, and modern SaaS platforms with vibrant accents, clean surfaces, and professional aesthetics optimized for executive-focused AI advisory interface.

## Core Design System

### Color Palette
**Light Mode Primary (Modern & Vibrant):**
- Background: 210 20% 98% (soft blue-tinted white)
- Surface: 210 40% 96% (subtle blue-gray cards)
- Text Primary: 222 47% 11% (deep blue-black)
- Text Secondary: 215 16% 46% (muted slate)
- Accent Primary: 217 91% 60% (vibrant electric blue)
- Accent Secondary: 262 83% 58% (bright purple)
- Success: 142 71% 45% (fresh green)
- Border: 215 16% 88% (soft neutral divider)

### Typography
- **Primary Font:** Inter or System UI stack for clean, professional readability
- **Headings:** Font weights 600-700, sizes: H1 (2.5rem), H2 (2rem), H3 (1.5rem)
- **Body:** Font weight 400, size 1rem, line-height 1.6
- **Small Text:** 0.875rem for timestamps, metadata

### Layout System
**Spacing Units:** Consistent Tailwind units of 4, 8, 12, 16, 24, 32
- Component padding: 16-24px
- Section spacing: 32-48px
- Card gaps: 16-24px

**Grid Structure:**
- Desktop: 3-column grid for agent recommendation cards
- Tablet: 2-column grid
- Mobile: Single column stack

## Component Library

### Authentication Components
**Signup Form:**
- Multi-step progressive disclosure (3 steps: Personal Info → Professional Details → Goals)
- Photo upload with circular preview (120px diameter)
- Input fields with floating labels and light surface backgrounds
- Full-width text areas for descriptive fields
- Progress indicator at top showing step completion

**Login Form:**
- Centered card (max-width: 400px) on light background
- Email/username and password fields with eye toggle for password
- "Remember me" checkbox with accent color
- Prominent login button with vibrant gradient (blue to purple)

### Dashboard Layout
**Three-Panel Structure:**

1. **Left Sidebar (280px, fixed):**
   - Agent list with avatar images (48px circular)
   - Agent name and company below avatar
   - Memory preview (truncated, 2 lines max)
   - Hover state: subtle accent highlight with vibrant blue tint

2. **Main Content Area (flexible):**
   - Top bar with run configuration
   - Meeting form section
   - Results area with agent cards

3. **Right Sidebar (300px, fixed, collapsible on tablet/mobile):**
   - User profile summary with uploaded photo (80px circular)
   - Quick stats (runs completed, active chats)
   - Recent activity feed

### Meeting Interface
**Task Input Section:**
- Large textarea (min-height: 150px) with placeholder guiding C-suite use cases
- Auto-filled user profile display (read-only, expandable accordion)
- Agent selection: Checkboxes with "Select All" toggle
- Selected agents shown in pill badges above results

**Results Display:**
- Agent recommendation cards (3-column desktop grid)
- Each card: Agent avatar header, company badge, structured recommendation sections
- Expandable/collapsible sections (Summary, Key Recommendations, Rationale, Next Steps)
- Chat toggle button at card bottom (opens inline chat)

### Chat Interface
**Message Bubbles:**
- User messages: Right-aligned, vibrant blue background (217 91% 60%)
- Agent messages: Left-aligned, soft surface background (210 40% 96%)
- Agent avatar (32px) next to agent messages
- Timestamps below messages (small, muted text)
- Input area: Fixed bottom with send button, auto-resize textarea

### Knowledge Ingestion
**Upload Interface:**
- Left panel: Persona selector with agent cards (avatar + name)
- Right panel: Drag-drop zone or file browser
- Progress indicator during upload/indexing
- Success confirmation with indexed chunks count

## Visual Elements

### Agent Avatars
**Image Requirements:**
- Professional headshots of AI leaders (Sam Altman, Jensen Huang, Andrew Ng, Demis Hassabis, Fei-Fei Li)
- Circular crop with 2px border in accent color
- Sizes: 48px (sidebar), 80px (cards), 32px (chat)
- Fallback: Initials on gradient background if image unavailable

### Tables & Data Display
- Striped rows for readability (alternating surface/background)
- Fixed header on scroll
- Hover state: row highlight with subtle blue accent
- Column headers: Bold, uppercase, letter-spacing: 0.05em
- Borders: Soft neutral (215 16% 88%)

### Interactive States
- **Hover:** Background lift (+2-3% lightness)
- **Active:** Scale down (0.98) with slight shadow
- **Focus:** 2px accent outline with offset
- **Disabled:** 40% opacity with cursor not-allowed

## Responsive Behavior

### Desktop (1280px+)
- Three-panel layout fully visible
- 3-column recommendation grid
- Sidebars fixed (280px + 300px)

### Tablet (768px - 1279px)
- Right sidebar collapses to icon-only or hidden
- 2-column recommendation grid
- Left sidebar remains visible

### Mobile (< 768px)
- Hamburger menu for left sidebar (slide-in drawer)
- Right sidebar hidden, accessible via menu
- Single-column cards
- Stacked form inputs
- Bottom navigation for main actions

## Animations & Microinteractions
**Minimal, Purposeful Motion:**
- Card entry: Fade-up (200ms, ease-out)
- Sidebar toggle: Slide (300ms, ease-in-out)
- Chat messages: Slide-up with fade (150ms)
- Button clicks: Subtle scale (100ms)
- No autoplay or distracting animations

## Accessibility
- WCAG AA contrast ratios maintained (4.5:1 for text)
- Keyboard navigation support (Tab order logical)
- Screen reader labels for icons and avatars
- Focus indicators visible (2px vibrant accent outline)
- Light mode optimized with optional dark mode toggle for extended use

## Image Assets

### Hero/Landing (if added later)
- Abstract AI visualization (neural network, geometric patterns)
- Composite of AI leader headshots with glassmorphism overlay
- Size: 1920x800px, optimized WebP format

### Agent Avatars (Required)
- Professional headshots: Sam Altman, Jensen Huang, Andrew Ng, Demis Hassabis, Fei-Fei Li
- Format: Square originals, circular crop in CSS
- Size: 256x256px minimum resolution

### Icons
- Use Heroicons (outline style) for UI actions via CDN
- Agent-specific icons for persona indicators (brain, chip, book, etc.)

## Key Design Principles
1. **Executive Focus:** Professional, polished, trust-building aesthetics with modern vibrancy
2. **Information Density:** Pack data without clutter using tables, cards, and hierarchy
3. **Light & Fresh:** Clean, vibrant design optimized for clarity and engagement
4. **Multi-Agent Clarity:** Distinct visual separation between agent recommendations
5. **Conversational Flow:** Natural chat progression with clear turn-taking