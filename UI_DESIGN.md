# Bevo Notes - UI Design Specification

**Created:** 2025-12-22
**Status:** Ready for Implementation

---

## Design Principles

1. **UT Branding**: Uses burnt orange (#bf5700) as primary accent, matching the extension
2. **Clean & Academic**: Professional, distraction-free interface for students
3. **Familiar Patterns**: Uses standard dashboard layout (sidebar + main content)
4. **Responsive**: Works on desktop, tablet, and mobile
5. **Dark Mode**: Full dark mode support with persistent user preference

---

## Color Palette

### Light Mode
```css
--bg-primary: #ffffff
--bg-secondary: #f8f9fa
--bg-tertiary: #ffffff
--text-primary: #1a1a1a
--text-secondary: #6b7280
--text-tertiary: #9ca3af
--border-color: #e5e7eb
--accent-primary: #bf5700 (UT burnt orange)
--accent-hover: #a04a00
--accent-light: #fff5ed
```

### Dark Mode
```css
--bg-primary: #1a1a1a
--bg-secondary: #242424
--bg-tertiary: #2d2d2d
--text-primary: #f3f4f6
--text-secondary: #9ca3af
--text-tertiary: #6b7280
--border-color: #374151
--accent-light: #2d1a0a
```

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  TOP NAV (64px fixed)                                       │
│  [Logo] [Search.....................] [Theme] [Profile ▼]   │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                   │
│ SIDEBAR  │  MAIN CONTENT AREA                               │
│ (240px)  │                                                   │
│          │  [Usage Banner] (if trial/free)                  │
│ Folders  │                                                   │
│ ────     │  ┌────────┐ ┌────────┐ ┌────────┐               │
│ 📚 All   │  │ Note   │ │ Note   │ │ Note   │               │
│ 📘 CS    │  │ Card 1 │ │ Card 2 │ │ Card 3 │               │
│ 🧪 Chem  │  └────────┘ └────────┘ └────────┘               │
│ + New    │  ┌────────┐ ┌────────┐ ┌────────┐               │
│          │  │ Note   │ │ Note   │ │ Note   │               │
│          │  │ Card 4 │ │ Card 5 │ │ Card 6 │               │
│          │  └────────┘ └────────┘ └────────┘               │
└──────────┴──────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Top Navigation Bar

**Height:** 64px
**Position:** Fixed, spans full width
**Background:** `var(--bg-secondary)`
**Border:** 1px bottom border `var(--border-color)`

**Layout (left to right):**

1. **Logo** (left, 24px padding)
   - UT burnt orange square with "B" (32px × 32px, rounded 8px)
   - "Bevo Notes" text (18px, font-weight: 600)
   - Clickable, returns to home/all notes

2. **Search Bar** (center, flexible width, max 600px)
   - Input: "Search notes by title or content..."
   - Icon: 🔍 (left side)
   - Background: `var(--bg-primary)`
   - Border: 1px `var(--border-color)`
   - Rounded: 8px
   - On focus: border becomes `var(--accent-primary)`
   - **Advanced Filters:**
     - When focused, show filter chips below:
       - [Folder: All ▼] [Date: Any ▼] [Sort: Newest ▼]
     - Dropdowns appear on click

3. **Theme Toggle** (right side)
   - Icon button: 🌙 (light mode) or ☀️ (dark mode)
   - 36px × 36px, rounded 8px
   - Border: 1px `var(--border-color)`
   - Hover: background `var(--bg-tertiary)`

4. **Profile Menu** (right, 24px padding)
   - Avatar: Circle with user's initials or email first letter
   - Background: gradient `var(--accent-primary)` to `var(--accent-hover)`
   - 40px × 40px
   - Click → dropdown menu:
     - Email address (text-secondary, 12px)
     - ──────
     - Settings
     - API Key Management
     - ──────
     - Log Out

**Responsive:**
- Mobile (<768px): Hide search bar, show search icon button that opens full-screen search modal

---

### 2. Sidebar (Folders)

**Width:** 240px
**Position:** Fixed left, below top nav
**Background:** `var(--bg-primary)`
**Border:** 1px right border `var(--border-color)`

**Content:**

1. **Folder List**
   - "All Notes" (always first, 📚 icon, shows total count)
   - "Unorganized" (if any notes without folder, shows count)
   - ──────
   - User folders (alphabetical):
     - Icon/emoji + Name + Count
     - Hover: show edit/delete icons on right
   - ──────
   - "+ New Folder" button (bottom)

2. **Folder Item Styling**
   - Height: 40px
   - Padding: 8px 16px
   - Hover: background `var(--bg-secondary)`
   - Active/selected: background `var(--accent-light)`, left border 3px `var(--accent-primary)`
   - Font: 14px, regular
   - Count badge: right side, `var(--text-tertiary)`, 12px

**Responsive:**
- Tablet (<1024px): Collapse to icons only (60px width), expand on hover
- Mobile (<768px): Hide by default, hamburger menu in top nav to open as overlay

---

### 3. Usage Banner

**Display:** Only when user hasn't set up their API key yet
**Position:** Top of main content area, below nav, full width
**Height:** Auto (min 48px)
**Background:** Linear gradient `var(--accent-light)` to transparent
**Border:** 1px bottom `var(--accent-primary)` with 20% opacity

**Content:**

**No API Key Configured:**
```
🔑 Set up your Google Gemini API key to start generating notes  [Get Started →]
```

**API Key Invalid:**
```
⚠️ Your API key is invalid or expired. Please update it to continue.  [Update API Key →]
```

**API Key Configured:**
- No banner displayed

**Styling:**
- Text: 14px, `var(--text-primary)`
- CTA Button: Orange, solid, rounded 6px
- Dismissible: ✕ icon on right (hides banner, can be shown again via settings)
- Link to API key setup guide

---

### 4. Main Content Area (Notes Grid)

**Layout:** CSS Grid
**Columns:** Auto-fill, minmax(320px, 1fr)
**Gap:** 24px
**Padding:** 32px

**Responsive:**
- Desktop (>1280px): 3-4 columns
- Laptop (>1024px): 2-3 columns
- Tablet (>768px): 2 columns
- Mobile (<768px): 1 column

---

### 5. Note Card

**Dimensions:**
- Width: 100% (within grid cell)
- Min-height: 200px
- Max-height: 280px

**Structure:**

```
┌──────────────────────────────────┐
│ 📘 CS 331                        │ ← Folder badge (if assigned)
│                                   │
│ Lecture Title Here                │ ← h3, 18px, bold, 2 lines max
│ October 15, 2024                  │ ← Date, 13px, text-secondary
│                                   │
│ Lorem ipsum dolor sit amet,       │ ← Preview snippet
│ consectetur adipiscing elit.      │   3 lines max, 14px, line-clamp
│ Sed do eiusmod tempor...          │
│                                   │
├───────────────────────────────────┤
│ [📤 Export ▼] [🗑️]  [→ Open]     │ ← Actions footer
└──────────────────────────────────┘
```

**Card Styling:**
- Background: `var(--bg-secondary)`
- Border: 1px `var(--border-color)`
- Border-radius: 12px
- Padding: 20px
- Box-shadow: `var(--shadow-sm)` (subtle)
- Hover:
  - Border: `var(--accent-primary)`
  - Shadow: `var(--shadow-md)`
  - Transform: translateY(-2px)
  - Transition: all 0.2s ease

**Folder Badge:**
- Position: Top right
- Background: Folder's custom color (or default orange)
- Text: Folder emoji + name
- Padding: 4px 10px
- Border-radius: 6px
- Font: 11px, semi-bold
- If no folder: Badge not shown

**Actions Footer:**
- Height: 44px
- Border-top: 1px `var(--border-color)`
- Display: Flex, space-between
- Buttons:
  - **Export** (left): Dropdown with PDF/Markdown/HTML options
  - **Delete** (center): Trash icon, confirmation modal on click
  - **Open** (right): Primary button, full note view

**Empty Card State (No Notes):**
```
┌──────────────────────────────────┐
│                                   │
│       📚                          │
│   No notes yet!                   │
│                                   │
│  Install the Chrome extension     │
│  and generate your first notes.   │
│                                   │
│   [Install Extension →]           │
│                                   │
└──────────────────────────────────┘
```
- Center-aligned, gray text
- Link to Chrome Web Store
- If >0 notes but current filter shows none: "No notes in this folder"

---

### 6. Full Note View Page

**Route:** `/notes/[noteId]`
**Layout:** Single column, centered, max-width 900px

**Structure:**

```
┌─────────────────────────────────────────────────────────┐
│  TOP NAV (same as dashboard)                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ← Back to Library                                      │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │ STICKY HEADER                                  │     │
│  │ Lecture Title                                  │     │
│  │ 📅 Oct 15, 2024  📁 CS 331                     │     │
│  │ [Move to Folder ▼] [Export ▼] [Delete]        │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │ NOTE CONTENT                                   │     │
│  │                                                │     │
│  │ <h1>Recursion and Recurrence Relations</h1>   │     │
│  │                                                │     │
│  │ <h2>Introduction</h2>                          │     │
│  │ <p>Lorem ipsum...</p>                          │     │
│  │                                                │     │
│  │ <h2>Base Cases</h2>                            │     │
│  │ ...                                            │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Sticky Header:**
- Background: `var(--bg-primary)` with backdrop blur
- Padding: 24px
- Border-radius: 12px
- Box-shadow: `var(--shadow-md)`
- Sticks to top when scrolling (64px from top, below nav)

**Note Content:**
- Background: `var(--bg-secondary)`
- Padding: 40px
- Border-radius: 12px
- Typography:
  - `h1`: 32px, bold, `var(--accent-primary)`
  - `h2`: 24px, semi-bold, `var(--accent-primary)`, margin-top: 32px
  - `p`: 16px, line-height: 1.7, `var(--text-primary)`
  - `ul/li`: 16px, margin-left: 24px
  - MathML: Render properly with KaTeX or browser native
- Print-friendly: Hide header buttons, remove shadows

**Back Button:**
- Left side, text + icon
- "← Back to Library"
- Returns to previous view (or /dashboard if direct link)

---

### 7. Modals

#### Create/Edit Folder Modal

**Trigger:** Click "+ New Folder" or edit icon on folder
**Size:** 480px wide × auto height
**Position:** Centered on screen

**Content:**
```
┌────────────────────────────────────┐
│  Create New Folder            [✕]  │
├────────────────────────────────────┤
│                                    │
│  Folder Name                       │
│  [CS 331 - Algorithms_____]        │
│                                    │
│  Icon/Emoji (optional)             │
│  [📘] ← click to open emoji picker │
│                                    │
│  Color (optional)                  │
│  ⬤ 🟠 🔵 🟢 🟡 🟣 ⚫              │
│  ↑ default (orange)                │
│                                    │
│        [Cancel]  [Create Folder]   │
│                                    │
└────────────────────────────────────┘
```

**Fields:**
- Name: Text input, required, max 50 chars
- Icon: Button that opens native emoji picker or preset list
- Color: Preset swatches (8 colors), default is UT orange

**Validation:**
- Name required
- No duplicate names (case-insensitive)
- Show error below input if invalid

#### Move to Folder Modal

**Trigger:** Click "Move to Folder" on note card or note view
**Size:** 400px wide × auto height

**Content:**
```
┌────────────────────────────────────┐
│  Move to Folder               [✕]  │
├────────────────────────────────────┤
│                                    │
│  Select a folder:                  │
│                                    │
│  ( ) 📘 CS 331                     │
│  ( ) 🧪 Chemistry 101              │
│  ( ) 📐 Calculus II                │
│  (•) 📊 Statistics                 │ ← selected
│                                    │
│  ────────                          │
│  [+ Create New Folder]             │
│                                    │
│        [Cancel]  [Move Note]       │
│                                    │
└────────────────────────────────────┘
```

**Behavior:**
- Radio buttons (single selection)
- Shows all folders with icons
- Click "Create New Folder" → opens Create Folder modal, then auto-selects it
- "Move Note" updates note's folder_id in database

#### Delete Confirmation Modal

**Trigger:** Click delete (trash icon) on note
**Size:** 400px wide × auto height

**Content:**
```
┌────────────────────────────────────┐
│  Delete Note?                 [✕]  │
├────────────────────────────────────┤
│                                    │
│  ⚠️  Are you sure you want to     │
│      delete this note?             │
│                                    │
│  "Recursion and Recurrence..."     │ ← note title preview
│                                    │
│  This action cannot be undone.     │
│                                    │
│        [Cancel]  [Delete]          │
│                   ↑ red, danger    │
│                                    │
└────────────────────────────────────┘
```

**Delete Button:**
- Background: #dc2626 (red)
- Hover: #b91c1c (darker red)

---

### 8. Settings Page

**Route:** `/settings`
**Layout:** Same sidebar + nav, main content centered (max 800px)

**Sections:**

1. **Account**
   - Email: [user@utexas.edu] (read-only)
   - Joined: October 1, 2024

2. **API Key Management**
   - Current Status: ✓ Valid API key configured / ⚠️ No API key / ✗ Invalid API key
   - Last verified: October 15, 2024, 3:45 PM
   - **API Key Input:**
     - Input field: [••••••••••••••••••••••••] (masked)
     - [Update API Key] button
     - [Test API Key] button (validates with Gemini API)
     - [Delete API Key] button (danger action)
   - **Help Section:**
     - "Don't have an API key?" link → Opens Google AI Studio guide
     - Link to setup tutorial
     - Information about Gemini free tier (1,500 requests/day)

3. **Preferences**
   - Theme: ( ) Light (•) Dark ( ) Auto
   - Default folder for new notes: [Dropdown]
   - Notes per page: [20 ▼]

4. **Extension**
   - Extension installed: ✓ Yes / ✗ Not detected
   - [Download Extension] button (if not installed)
   - Extension version: 1.0.0

5. **Danger Zone**
   - [Delete All Notes] (confirmation modal)
   - [Delete API Key] (confirmation modal)
   - [Delete Account] (confirmation modal)

---

## Page Routes

1. **/** (unauthenticated) → Landing/login page
2. **/dashboard** → Main notes library (default view)
3. **/notes/[id]** → Full note view
4. **/settings** → User settings and API key management

---

## Interactions & Animations

### Micro-interactions

1. **Card Hover:**
   - Transition: 200ms ease
   - Lift: translateY(-2px)
   - Shadow: expand
   - Border: color change to orange

2. **Button Clicks:**
   - Scale: 0.98 on mousedown
   - Transition: 100ms ease

3. **Folder Selection:**
   - Slide-in left border (3px orange)
   - Background fade-in
   - Transition: 150ms ease

4. **Search Focus:**
   - Input border color change
   - Filter chips slide down (200ms)
   - Icon color change to orange

5. **Theme Toggle:**
   - Icon rotate 180deg
   - Color scheme fade: 300ms

### Loading States

1. **Notes Loading:**
   - Skeleton cards (animated gradient shimmer)
   - Match card dimensions
   - 6 skeleton cards minimum

2. **Note Content Loading:**
   - Skeleton text lines (animated shimmer)
   - Match typography sizes

3. **Button Loading:**
   - Spinner icon replaces text
   - Button disabled
   - Opacity: 0.6

### Success/Error States

1. **Success Toast:**
   - Green background, white text
   - Slide in from top right
   - Auto-dismiss after 3s
   - Examples:
     - "✓ Note moved to CS 331"
     - "✓ Folder created"
     - "✓ Note exported as PDF"

2. **Error Toast:**
   - Red background, white text
   - Slide in from top right
   - Manual dismiss (✕ button)
   - Examples:
     - "✗ Failed to delete note. Try again."
     - "✗ Subscription required"

---

## Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 767px) {
  - Single column grid
  - Hamburger menu for sidebar
  - Search icon only (modal on click)
  - Stack header elements vertically
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  - 2 column grid
  - Collapsible sidebar (icons only)
  - Full search bar
}

/* Laptop */
@media (min-width: 1024px) and (max-width: 1279px) {
  - 2-3 column grid
  - Full sidebar (240px)
}

/* Desktop */
@media (min-width: 1280px) {
  - 3-4 column grid
  - Full sidebar (240px)
}
```

---

## Accessibility

1. **Keyboard Navigation:**
   - All interactive elements focusable
   - Tab order: logical flow
   - Focus indicators: 2px orange outline

2. **Screen Readers:**
   - ARIA labels on icon buttons
   - ARIA live regions for toasts
   - Semantic HTML (nav, main, aside)

3. **Color Contrast:**
   - WCAG AA compliant
   - Text: 4.5:1 minimum
   - Icons: 3:1 minimum

4. **Text Scaling:**
   - Supports up to 200% zoom
   - No horizontal scroll at 200%
   - Rem-based spacing

---

## Performance Targets

1. **Page Load:**
   - First Contentful Paint: < 1.5s
   - Time to Interactive: < 3s
   - Lighthouse score: > 90

2. **Interactions:**
   - Search filter: < 100ms
   - Folder switch: < 200ms
   - Card hover: 60fps

3. **Optimizations:**
   - Lazy load note content (only in viewport)
   - Virtual scrolling for >100 notes
   - Image optimization (WebP, lazy load)
   - Code splitting per route

---

## Implementation Priority

### Phase 1 (Core UI)
- [ ] Layout shell (nav, sidebar, grid)
- [ ] Note cards (static)
- [ ] Folder sidebar (static)
- [ ] Theme toggle
- [ ] Responsive layout

### Phase 2 (Functionality)
- [ ] Search with filters
- [ ] Folder CRUD
- [ ] Note detail view
- [ ] Move to folder
- [ ] Delete note

### Phase 3 (Polish)
- [ ] Animations & transitions
- [ ] Loading states
- [ ] Empty states (no notes, no API key)
- [ ] Toasts & notifications
- [ ] Usage banner (API key setup prompt)

### Phase 4 (Advanced)
- [ ] Export functionality
- [ ] Settings page with API key management
- [ ] API key setup guide/tutorial
- [ ] Keyboard shortcuts
- [ ] Accessibility audit

---

**Next Steps:** Begin implementation with Phase 1, starting with the layout shell and basic components.
