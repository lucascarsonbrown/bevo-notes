# Bevo Notes - MVP Design Document

**Project:** Full-stack subscription-based AI lecture notes platform for UT Austin students
**Created:** 2025-12-22
**Status:** Design Phase

---

## Executive Summary

Bevo Notes transforms UT Austin lecture recordings into searchable, organized AI-generated study notes. Students use a Chrome extension to extract lecture transcripts from UT's Lecture Capture system, which syncs to a web dashboard where they can organize, search, and export their notes library.

### MVP Scope
- **Chrome Extension:** Standalone note generation (existing functionality) + optional cloud sync for authenticated users
- **Web Dashboard:** Full-featured notes library with folders, search, and export capabilities
- **Authentication:** Magic link email authentication (@utexas.edu only) via Supabase
- **Billing:** Stripe subscriptions at $4.99/month with 3 free trial note generations
- **AI Processing:** Server-side Google Gemini 2.0 Flash (migration from client-side OpenAI)

---

## Product Architecture

### System Components

```
┌─────────────────────┐
│  Chrome Extension   │
│  (Standalone Mode)  │
│  - Extract VTT      │
│  - Generate Notes   │
│  - Local Storage    │
└──────────┬──────────┘
           │
           │ (If authenticated)
           │ Auto-sync
           ▼
┌─────────────────────┐
│   Next.js Backend   │
│  - Session Check    │
│  - Usage Tracking   │
│  - Gemini API       │
│  - Note Storage     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Supabase Services  │
│  - Auth (Magic Link)│
│  - PostgreSQL       │
│  - Row-Level Security│
└─────────────────────┘
           │
           ▼
┌─────────────────────┐
│   Stripe Billing    │
│  - Subscriptions    │
│  - Webhooks         │
│  - Customer Portal  │
└─────────────────────┘
```

---

## User Flow

### 1. New User Journey

1. **Install Extension**
   - User installs Chrome extension from store
   - Extension works immediately (no login required)
   - User can generate 3 free notes using local OpenAI processing

2. **First Note Generation** (Standalone)
   - Navigate to lecturecapture.la.utexas.edu lecture
   - Enable captions (CC button)
   - Click "Generate AI Notes" in extension
   - Extension extracts VTT transcript
   - Extension calls OpenAI GPT-4o-mini client-side
   - Notes stored in chrome.storage.local
   - Notes displayed in extension popup + full page

3. **Discover Cloud Features**
   - After 3 free notes, extension prompts: "Upgrade to save your notes forever"
   - User clicks "Sign Up" button in extension
   - Opens extension login popup

4. **Authentication**
   - Extension shows login form (email only)
   - User enters @utexas.edu email
   - Supabase sends magic link to email
   - User clicks link, completes authentication
   - Extension receives session token, stores in chrome.storage.local
   - Extension now auto-syncs all future notes to backend

5. **Subscription**
   - After login, user is redirected to web dashboard
   - Dashboard shows subscription prompt: "Subscribe for $4.99/month"
   - User clicks "Subscribe" → Stripe Checkout
   - Completes payment with card
   - Stripe webhook updates subscription status in Supabase
   - User can now generate unlimited notes (backend-processed)

6. **Ongoing Usage**
   - User generates note on lecture page
   - Extension checks: "Is user logged in?"
     - **No:** Generate locally (count toward free trial if under 3)
     - **Yes:** Send to backend
       - Backend checks subscription status
       - If active: Process with Gemini 2.0 Flash, save to database
       - If inactive: Return error "Subscription required"
   - Notes appear in extension + web dashboard
   - User organizes notes into folders on dashboard

### 2. Returning User Journey

1. Open lecturecapture.la.utexas.edu
2. Click extension → "Generate AI Notes"
3. Extension auto-syncs to backend (user already authenticated)
4. Note appears in dashboard within seconds
5. User logs into dashboard anytime to browse/search/organize/export

---

## Technical Specifications

### Database Schema (Supabase PostgreSQL)

#### Users Table
```sql
users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'none', -- none, trialing, active, past_due, canceled
  subscription_id TEXT,
  trial_notes_used INTEGER DEFAULT 0,
  trial_notes_limit INTEGER DEFAULT 3,
  current_period_end TIMESTAMP
)
```

#### Notes Table
```sql
notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  lecture_date DATE,
  transcript_hash TEXT, -- SHA-256 hash for deduplication
  raw_transcript TEXT,
  notes_json JSONB, -- Structured AI output
  notes_html TEXT, -- Rendered HTML
  gemini_tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL
)

-- Indexes
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_folder_id ON notes(folder_id);
CREATE INDEX idx_notes_transcript_hash ON notes(transcript_hash);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
```

#### Folders Table
```sql
folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#bf5700', -- UT orange
  icon TEXT DEFAULT '📚',
  created_at TIMESTAMP DEFAULT NOW()
)

-- Unique constraint: one folder name per user
CREATE UNIQUE INDEX idx_folders_user_name ON folders(user_id, name);
```

#### Row-Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own data
CREATE POLICY users_own_data ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY notes_own_data ON notes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY folders_own_data ON folders
  FOR ALL USING (auth.uid() = user_id);
```

---

### API Endpoints (Next.js App Router)

#### Authentication
- **POST /api/auth/magic-link** - Request magic link (validate @utexas.edu)
- **GET /api/auth/callback** - Supabase auth callback
- **POST /api/auth/logout** - Sign out user

#### Notes
- **POST /api/notes/generate** - Generate new note from transcript
  - Body: `{ title, date, transcript }`
  - Auth: Required (Supabase session)
  - Checks: Subscription status, usage limits
  - Processing:
    1. Hash transcript (SHA-256)
    2. Check cache (existing note with same hash)
    3. If cached: Return existing note
    4. If new: Clean transcript, call Gemini 2.0 Flash
    5. Store JSON + HTML in database
    6. Return note ID + HTML
  - Rate limit: 10 requests/minute per user

- **GET /api/notes** - List all notes for authenticated user
  - Query params: `?folder_id=uuid&search=query&limit=50&offset=0`
  - Returns: Array of notes with metadata

- **GET /api/notes/[id]** - Get single note
  - Returns: Full note (JSON + HTML + metadata)

- **PATCH /api/notes/[id]** - Update note
  - Body: `{ title?, folder_id?, lecture_date? }`
  - Cannot modify transcript or AI-generated content

- **DELETE /api/notes/[id]** - Delete note

#### Folders
- **GET /api/folders** - List all folders for user
- **POST /api/folders** - Create new folder
  - Body: `{ name, color?, icon? }`
- **PATCH /api/folders/[id]** - Update folder
- **DELETE /api/folders/[id]** - Delete folder (notes set to folder_id=null)

#### Exports
- **GET /api/export/pdf/[noteId]** - Export single note as PDF
- **GET /api/export/markdown/[noteId]** - Export as Markdown
- **POST /api/export/bulk** - Export multiple notes
  - Body: `{ note_ids: [], format: 'pdf' | 'markdown' | 'html' }`
  - Returns: ZIP file

#### Subscriptions
- **GET /api/subscription/status** - Get current subscription info
- **POST /api/subscription/checkout** - Create Stripe Checkout session
- **POST /api/subscription/portal** - Create Customer Portal session
- **POST /api/webhooks/stripe** - Stripe webhook handler
  - Events:
    - `checkout.session.completed` → Create subscription
    - `customer.subscription.created` → Set status to 'active'
    - `customer.subscription.updated` → Update status
    - `customer.subscription.deleted` → Set status to 'canceled'
    - `invoice.payment_succeeded` → Update current_period_end
    - `invoice.payment_failed` → Set status to 'past_due'

---

### Chrome Extension Updates

#### New Authentication Flow
1. Add login popup UI (`login.html`, `login.js`)
2. Use Supabase Auth Helpers for Chrome Extensions
3. Store session token in `chrome.storage.local`
4. Check session validity on each note generation

#### Auto-Sync Logic (`popup.js` updates)
```javascript
async function generateNotes() {
  const session = await getSession(); // Check chrome.storage.local

  if (session && session.expires_at > Date.now()) {
    // User is authenticated - send to backend
    await syncToBackend(transcript, session.access_token);
  } else {
    // User not authenticated - generate locally
    const trialCount = await getTrialCount();
    if (trialCount >= 3) {
      showUpgradePrompt();
      return;
    }
    await generateLocally(transcript);
    await incrementTrialCount();
  }
}

async function syncToBackend(transcript, token) {
  const response = await fetch('https://bevo-notes.vercel.app/api/notes/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: extractTitle(), // From page
      date: extractDate(),   // From page
      transcript: transcript
    })
  });

  const data = await response.json();

  if (response.ok) {
    // Display notes from backend
    displayNotes(data.notes_html);
  } else {
    // Handle errors (subscription expired, etc.)
    showError(data.message);
  }
}
```

#### Trial Tracking
- Store trial count in backend (authoritative source)
- Extension calls `GET /api/notes/trial-status` before local generation
- Backend returns `{ trial_notes_used: 2, trial_notes_limit: 3 }`

---

### AI Processing

#### Gemini 2.0 Flash Integration

**Model:** `gemini-2.0-flash-exp`
**Cost:** ~$0.10 per 1M input tokens, ~$0.30 per 1M output tokens
**Estimated cost per note:** $0.01 - $0.05 (depending on lecture length)

**Processing Pipeline:**
1. **Transcript Cleaning**
   - Remove VTT timestamps
   - Deduplicate repeated phrases
   - Fix common transcription errors
   - Limit to 50,000 characters (~12,500 tokens)

2. **Chunking** (if needed for long lectures)
   - Split by topic boundaries (detected via semantic breaks)
   - Process chunks separately
   - Merge results

3. **Gemini Prompt** (updated from OpenAI prompt)
```
You are an expert academic note-taker. Convert this lecture transcript into structured, comprehensive study notes.

**Input:** Lecture transcript from a university class

**Output Format:** Return ONLY valid JSON with this exact structure:
{
  "title": "Lecture title",
  "topics": [
    {
      "heading": "Topic name",
      "sections": [
        {
          "subheading": "Section name",
          "content": [
            {
              "type": "definition" | "explanation" | "formula" | "example" | "proof",
              "text": "Content here",
              "latex": "Optional LaTeX for formulas"
            }
          ]
        }
      ]
    }
  ]
}

**Requirements:**
- Preserve all key concepts, definitions, formulas, and examples
- Use clear academic language matching the professor's tone
- For mathematical expressions, provide LaTeX notation
- Organize logically by topic and subtopic
- Include context and explanations, not just bullet points

**Transcript:**
{transcript}
```

4. **JSON Validation**
   - Parse Gemini response
   - Validate against schema
   - Retry once if invalid (with error message)

5. **HTML Rendering**
   - Convert JSON to semantic HTML
   - Render LaTeX using MathJax or KaTeX
   - Apply consistent styling
   - Store both JSON (for future re-rendering) and HTML (for display)

**Cost Controls:**
- Cache by transcript hash (avoid regenerating identical lectures)
- Hard limit: 50,000 characters per transcript
- Rate limit: 10 notes/minute per user
- Monthly usage cap: 100 notes/user (configurable)
- Gemini quota monitoring with alerts

---

### Stripe Integration

#### Products & Prices
```javascript
// Create in Stripe Dashboard
Product: "Bevo Notes Pro"
Price: $4.99/month (recurring)
Price ID: price_xxxxx
```

#### Checkout Flow
1. User clicks "Subscribe" on dashboard
2. Frontend calls `POST /api/subscription/checkout`
3. Backend creates Stripe Checkout Session:
   ```javascript
   const session = await stripe.checkout.sessions.create({
     customer_email: user.email,
     mode: 'subscription',
     payment_method_types: ['card'],
     line_items: [{
       price: 'price_xxxxx',
       quantity: 1,
     }],
     success_url: 'https://bevo-notes.vercel.app/dashboard?success=true',
     cancel_url: 'https://bevo-notes.vercel.app/subscribe?canceled=true',
     metadata: {
       user_id: user.id
     }
   });
   ```
4. User completes payment on Stripe Checkout page
5. Redirected to success URL
6. Webhook updates database

#### Webhook Handler (`/api/webhooks/stripe`)
```javascript
// Verify webhook signature
const sig = request.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

switch (event.type) {
  case 'checkout.session.completed':
    const session = event.data.object;
    // Update user with customer_id and subscription_id
    await supabase
      .from('users')
      .update({
        stripe_customer_id: session.customer,
        subscription_id: session.subscription,
        subscription_status: 'active'
      })
      .eq('id', session.metadata.user_id);
    break;

  case 'customer.subscription.updated':
    const subscription = event.data.object;
    await supabase
      .from('users')
      .update({
        subscription_status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000)
      })
      .eq('subscription_id', subscription.id);
    break;

  case 'customer.subscription.deleted':
    await supabase
      .from('users')
      .update({ subscription_status: 'canceled' })
      .eq('subscription_id', event.data.object.id);
    break;
}
```

#### Customer Portal
- Managed by Stripe (no custom code needed)
- Users can cancel, update payment method, view invoices
- Access via `POST /api/subscription/portal` → redirect to Stripe portal

---

## Dashboard Features

### 1. Notes Library View

**Layout:**
```
┌─────────────────────────────────────────────┐
│  [Bevo Notes Logo]  [Search bar]  [Profile] │
├──────────┬──────────────────────────────────┤
│          │                                   │
│ Folders  │  Notes Grid / List                │
│          │                                   │
│ 📚 All   │  ┌──────────┐  ┌──────────┐       │
│ 📘 CS    │  │ Lecture  │  │ Lecture  │       │
│ 🧪 Chem  │  │ Title    │  │ Title    │       │
│ + New    │  │ Date     │  │ Date     │       │
│          │  └──────────┘  └──────────┘       │
└──────────┴──────────────────────────────────┘
```

**Features:**
- Grid or list view toggle
- Sort by: Date (newest/oldest), Title (A-Z), Folder
- Filter by folder (sidebar navigation)
- Search: Full-text search across note titles and content
- Pagination: 50 notes per page

### 2. Note Detail View

**Layout:**
```
┌─────────────────────────────────────────────┐
│  ← Back to Library                          │
│  [Lecture Title]                            │
│  📅 Date  📁 Folder  [Move] [Export] [Delete]│
├─────────────────────────────────────────────┤
│                                             │
│  [Rendered HTML Notes]                      │
│                                             │
│  ## Topic 1                                 │
│  ### Definition                             │
│  Lorem ipsum...                             │
│                                             │
│  ### Formula                                │
│  E = mc²                                    │
│                                             │
└─────────────────────────────────────────────┘
```

**Features:**
- Clean, readable typography
- MathJax/KaTeX rendering for formulas
- Dark/light mode toggle (persisted)
- Print-optimized styles
- Action buttons:
  - Move to folder (dropdown)
  - Export (PDF, Markdown, HTML)
  - Delete (with confirmation)

### 3. Folder Management

**Features:**
- Create folder: Name + color + icon picker
- Edit folder: Rename, change color/icon
- Delete folder: Confirmation dialog, notes become unorganized
- Drag-and-drop notes between folders (future enhancement)

**Default Folders:**
- "All Notes" (virtual folder, shows everything)
- User-created folders

### 4. Export System

**Single Note Export:**
- PDF: Server-side HTML → PDF using Puppeteer or jsPDF
- Markdown: Convert JSON structure to markdown
- HTML: Download standalone HTML file with embedded CSS

**Bulk Export:**
- Select multiple notes (checkboxes)
- Export as ZIP containing individual files
- Maintains folder structure in ZIP

**Implementation:**
- `/api/export/pdf/[noteId]` - Returns PDF buffer
- Frontend triggers download via blob URL

---

## Authentication & Authorization

### Email Restriction
```javascript
// Supabase Auth Config
{
  auth: {
    providers: {
      email: {
        enabled: true,
        require_email_verification: true,
        allowed_email_domains: ['utexas.edu']
      }
    }
  }
}
```

### Magic Link Flow
1. User enters email on login page
2. Frontend calls Supabase `signInWithOtp()`
3. Supabase validates @utexas.edu domain
4. Sends magic link email
5. User clicks link → authenticated
6. Session stored in cookie + localStorage
7. Extension reads session from backend API

### Session Management
- Supabase handles session refresh automatically
- Extension checks session validity every 5 minutes
- Backend validates session on every API call using middleware

### Authorization Checks
```javascript
// Middleware for protected routes
export async function requireAuth(request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  return user;
}

// Middleware for subscription check
export async function requireSubscription(user) {
  const { data: userData } = await supabase
    .from('users')
    .select('subscription_status, trial_notes_used, trial_notes_limit')
    .eq('id', user.id)
    .single();

  const hasActiveSubscription = ['active', 'trialing'].includes(userData.subscription_status);
  const hasTrialRemaining = userData.trial_notes_used < userData.trial_notes_limit;

  if (!hasActiveSubscription && !hasTrialRemaining) {
    return new Response('Subscription required', { status: 402 });
  }

  return userData;
}
```

---

## Security Considerations

### 1. API Key Management
- **Current Issue:** OpenAI API key hardcoded in extension `popup.js`
- **Solution:** Remove API key from extension entirely
- **New Flow:** All AI calls happen server-side via backend API

### 2. Stripe Webhook Verification
```javascript
// CRITICAL: Verify webhook signatures
const sig = request.headers['stripe-signature'];
let event;

try {
  event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
} catch (err) {
  return new Response('Webhook signature verification failed', { status: 400 });
}
```

### 3. Row-Level Security (RLS)
- All database tables use RLS policies
- Users can only access their own data
- Even if API is compromised, users can't access others' notes

### 4. Rate Limiting
- Extension: 10 note generations per minute
- Search API: 60 requests per minute
- Implement using Upstash Redis or Vercel KV

### 5. Input Validation
- Sanitize all user inputs (lecture titles, folder names)
- Validate transcript length (max 50,000 chars)
- Prevent XSS in rendered notes (use DOMPurify)

### 6. CORS Configuration
```javascript
// Next.js API routes
export const config = {
  api: {
    cors: {
      origin: ['chrome-extension://*', 'https://bevo-notes.vercel.app'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      credentials: true
    }
  }
}
```

---

## Cost Analysis

### Per-User Monthly Costs

**AI Processing (Gemini 2.0 Flash):**
- Average lecture: 10,000 tokens input, 2,000 tokens output
- Cost per note: ~$0.001 (input) + ~$0.0006 (output) = **$0.0016**
- Assumed usage: 20 notes/month
- **AI cost/user/month: $0.032**

**Infrastructure:**
- Vercel: Free tier (10M serverless function executions)
- Supabase: Free tier (500MB database, 2GB file storage, unlimited API requests)
- Stripe: 2.9% + $0.30 per transaction = **$0.44/month** (on $4.99 subscription)

**Total Cost Per Paying User:** ~$0.50/month
**Revenue Per User:** $4.99/month
**Gross Margin:** ~90% ($4.49 profit per user)

**Break-even:** ~10 paying users to cover fixed costs
**Target:** 100 users in first semester = $449/month profit

---

## Build Order & Milestones

### Phase 1: Dashboard UI (Week 1-2) ✅ COMPLETED
- [x] Set up Next.js project structure
- [x] Design system: Typography, colors, components (CSS custom properties)
- [x] Notes library page (static data)
- [x] Note detail page (static data)
- [x] Folder sidebar navigation
- [x] Search bar UI (fully functional with filtering)
- [x] Export buttons (fully functional - PDF/Markdown/HTML)
- [x] Responsive design (mobile + desktop)
- [x] Dark mode toggle

**Deliverable:** ✅ Fully designed, interactive dashboard with mock data

**Components Created:**
- `TopNav.tsx` - Navigation with logo, search, theme toggle, profile
- `Sidebar.tsx` - Folder navigation with counts and selection states
- `NotesGrid.tsx` - Responsive grid layout for note cards
- `NoteCard.tsx` - Individual note card with preview and actions
- `UsageBanner.tsx` - Trial/subscription status banner
- `app/dashboard/page.tsx` - Main dashboard page with state management
- `app/notes/[id]/page.tsx` - Full note view with markdown rendering

### Phase 2: Interactive Functionality ✅ COMPLETED
- [x] Create folder modal with form validation
- [x] Move note to folder modal
- [x] Delete confirmation modal
- [x] Export dropdown component
- [x] Folder CRUD operations (client-side state)
- [x] Note CRUD operations (client-side state)
- [x] Search and filter functionality
- [x] Export functionality (PDF via print, Markdown download, HTML download)
- [x] Dark/light theme persistence

**Components Created:**
- `CreateFolderModal.tsx` - Modal for creating new folders with icon/color picker
- `MoveFolderModal.tsx` - Modal for moving notes between folders
- `DeleteConfirmationModal.tsx` - Reusable delete confirmation dialog
- `ExportDropdown.tsx` - Export menu with PDF/Markdown/HTML options

**Features Implemented:**
- Full folder management (create, filter, organize)
- Note organization (move to folders, delete with confirmation)
- Export in 3 formats with proper formatting
- Click-outside detection for modals and dropdowns
- State management with React hooks
- Mock data with 6 sample notes and 4 folders

**Deliverable:** ✅ Fully functional dashboard UI with all interactive features

---

### Phase 2: Authentication (Week 2-3)
- [ ] Supabase project setup
- [ ] Database schema creation (users, notes, folders tables)
- [ ] RLS policies
- [ ] Magic link email authentication flow
- [ ] Login/signup pages
- [ ] Email domain restriction (@utexas.edu)
- [ ] Session management (cookies + localStorage)
- [ ] Protected route middleware
- [ ] User profile page

**Deliverable:** Working authentication system; users can sign up and log in

---

### Phase 3: Extension Sync (Week 3-4)
- [ ] Extension login popup UI
- [ ] Supabase Auth in extension (chrome.storage.local)
- [ ] Session token refresh logic
- [ ] Backend API: `POST /api/notes/generate`
- [ ] Gemini 2.0 Flash integration
- [ ] Transcript cleaning & validation
- [ ] JSON schema validation
- [ ] HTML rendering from JSON
- [ ] Database note storage
- [ ] Extension auto-sync logic
- [ ] Trial usage tracking (backend)
- [ ] Error handling & retry logic

**Deliverable:** Extension can authenticate and sync notes to backend

---

### Phase 4: Dashboard Backend (Week 4-5)
- [ ] `GET /api/notes` - List notes with pagination
- [ ] `GET /api/notes/[id]` - Single note detail
- [ ] `PATCH /api/notes/[id]` - Update note metadata
- [ ] `DELETE /api/notes/[id]` - Delete note
- [ ] `GET /api/folders` - List folders
- [ ] `POST /api/folders` - Create folder
- [ ] `PATCH /api/folders/[id]` - Update folder
- [ ] `DELETE /api/folders/[id]` - Delete folder
- [ ] Full-text search implementation
- [ ] Folder filtering
- [ ] Connect dashboard UI to real APIs

**Deliverable:** Fully functional dashboard with CRUD operations

---

### Phase 5: Export System (Week 5-6)
- [ ] PDF export: HTML → PDF conversion (Puppeteer or jsPDF)
- [ ] Markdown export: JSON → Markdown
- [ ] HTML export: Standalone file with CSS
- [ ] Bulk export: Multiple notes → ZIP
- [ ] Export API endpoints
- [ ] Download triggers in frontend
- [ ] Export progress indicators

**Deliverable:** Users can export notes in multiple formats

---

### Phase 6: Subscriptions & Billing (Week 6-7)
- [ ] Stripe account setup
- [ ] Create product & price ($4.99/month)
- [ ] `POST /api/subscription/checkout` - Create Checkout session
- [ ] Subscription page in dashboard
- [ ] Stripe webhook endpoint setup
- [ ] Webhook event handlers (subscription lifecycle)
- [ ] Customer Portal integration
- [ ] Subscription status checks in note generation
- [ ] Trial limit enforcement (3 notes)
- [ ] Subscription required gates
- [ ] Billing page in dashboard

**Deliverable:** Complete payment system; users can subscribe and billing is enforced

---

### Phase 7: Polish & Testing (Week 7-8)
- [ ] Error handling & user-friendly messages
- [ ] Loading states & skeleton screens
- [ ] Empty states (no notes, no folders)
- [ ] Onboarding flow for new users
- [ ] Email notifications (welcome, subscription confirmed, trial ending)
- [ ] Performance optimization (caching, lazy loading)
- [ ] Security audit (RLS, rate limits, input validation)
- [ ] Cross-browser extension testing
- [ ] Mobile responsive testing
- [ ] Beta user testing with 5-10 students
- [ ] Bug fixes from testing feedback

**Deliverable:** Production-ready MVP

---

### Phase 8: Launch (Week 8)
- [ ] Chrome Web Store submission (extension)
- [ ] Domain setup (bevo-notes.com or use .vercel.app)
- [ ] Production deployment (Vercel + Supabase)
- [ ] Stripe production mode
- [ ] Analytics setup (PostHog, Plausible, or similar)
- [ ] Launch announcement (UT subreddit, class GroupMe's, flyers)
- [ ] Support channel setup (email or Discord)
- [ ] Monitor error logs & usage metrics

**Deliverable:** Public launch to UT Austin students

---

## Technical Stack Summary

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **UI Components:** Radix UI (headless components) + custom styling
- **Math Rendering:** KaTeX (faster than MathJax)
- **State Management:** React Context + hooks (no Redux needed for MVP)
- **Forms:** React Hook Form + Zod validation

### Backend
- **Runtime:** Next.js API routes (serverless functions)
- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth (magic links)
- **ORM:** Supabase JS client (no Prisma needed)
- **File Storage:** Supabase Storage (for exported files)
- **Caching:** Vercel KV (Redis) for transcript hash cache

### Third-Party Services
- **AI:** Google Gemini 2.0 Flash (via @google/generative-ai SDK)
- **Payments:** Stripe (Checkout + Customer Portal + Webhooks)
- **Email:** Supabase Auth emails (transactional)
- **Hosting:** Vercel (frontend + API)
- **Analytics:** PostHog (open-source, privacy-friendly)

### Chrome Extension
- **Manifest:** V3
- **Auth:** Supabase Auth (chrome.storage.local for session)
- **Storage:** chrome.storage.local (for offline notes + session)
- **Network:** Fetch API (to backend)

### DevOps
- **Version Control:** Git + GitHub
- **CI/CD:** Vercel automatic deployments
- **Monitoring:** Vercel Analytics + Sentry (error tracking)
- **Secrets:** Vercel environment variables

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx... # Server-side only

# Google Gemini
GEMINI_API_KEY=AIzaSyxxx...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx...
STRIPE_SECRET_KEY=sk_test_xxx...
STRIPE_WEBHOOK_SECRET=whsec_xxx...
STRIPE_PRICE_ID=price_xxx... # $4.99/month price ID

# App Config
NEXT_PUBLIC_APP_URL=https://bevo-notes.vercel.app
ALLOWED_EMAIL_DOMAIN=utexas.edu

# Rate Limiting (Upstash Redis or Vercel KV)
KV_REST_API_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=xxx
```

---

## Open Questions / Future Considerations

### MVP Scope (Resolved)
- ✅ Extension mode: Standalone with auto-sync
- ✅ Subscription model: 3 free trials then $4.99/month
- ✅ Auth flow: Magic link email
- ✅ Dashboard features: Full feature set (organize, export)
- ✅ AI model: Gemini 2.0 Flash
- ✅ Metadata: Basic (title + date)
- ✅ Build order: Dashboard → Auth → Sync → Subscriptions

### Post-MVP Features (Not in Scope)
- Collaborative notes (share with classmates)
- Note annotations/highlights by students
- Flashcard generation from notes
- Quiz generation from notes
- Mobile app (iOS/Android)
- Integration with Canvas/other LMS
- Note versioning (regenerate with different styles)
- Audio playback sync (jump to timestamp in lecture)
- OCR for slide images in videos
- Multi-university support (expand beyond UT Austin)

### Monitoring & Metrics
- Daily active users (extension installs + dashboard logins)
- Notes generated per day
- Conversion rate (free trial → paid subscriber)
- Churn rate (monthly subscription cancellations)
- Average notes per user per month
- Gemini API cost per user
- Error rates (note generation failures)

---

## Success Criteria

### MVP Launch Goals (First Semester)
- [ ] 100 extension installs
- [ ] 50 registered users (authenticated on dashboard)
- [ ] 20 paying subscribers ($99.80/month MRR)
- [ ] < 5% note generation error rate
- [ ] < $50/month in AI costs
- [ ] Positive user feedback (NPS > 30)

### 6-Month Goals
- [ ] 500 extension installs
- [ ] 250 registered users
- [ ] 100 paying subscribers ($499/month MRR)
- [ ] Break-even on costs
- [ ] Feature requests prioritized for V2

---

## Risks & Mitigation

### Risk 1: Low Adoption
**Mitigation:**
- Free trial (3 notes) reduces barrier to entry
- Student-friendly pricing ($4.99/month)
- Grassroots marketing (class GroupMe's, Reddit)
- Referral program (future: give 1 free month for each referral)

### Risk 2: High AI Costs
**Mitigation:**
- Transcript caching (hash-based deduplication)
- Gemini 2.0 Flash (cheapest viable model)
- Hard usage caps (100 notes/month per user)
- Monitoring + alerts for cost spikes

### Risk 3: Stripe Chargebacks
**Mitigation:**
- Clear trial terms (3 free notes, then $4.99/month)
- Easy cancellation (Customer Portal)
- Responsive support (handle refund requests quickly)

### Risk 4: Transcript Quality Issues
**Mitigation:**
- Transcript cleaning pipeline (dedupe, fix errors)
- Fallback to raw transcript if cleaning fails
- User feedback button ("Report Poor Quality Notes")

### Risk 5: UT System Changes
**Mitigation:**
- Monitor lecturecapture.la.utexas.edu for updates
- Extension content script is robust (uses Performance API)
- Have backup extraction method (direct VTT download)

---

## Support & Maintenance

### User Support Channels
- **Email:** support@bevo-notes.com (or Gmail for MVP)
- **FAQ Page:** Common issues (extension not working, no captions, billing)
- **In-app Help:** Tooltips, onboarding tour

### Monitoring Tools
- **Error Tracking:** Sentry (catch backend errors)
- **Uptime Monitoring:** Vercel built-in or UptimeRobot
- **Analytics:** PostHog (user behavior, feature usage)
- **Logs:** Vercel logs (serverless function logs)

### Maintenance Tasks
- Weekly: Review error logs, user feedback
- Monthly: Cost analysis, churn analysis
- Quarterly: Security audit, dependency updates

---

## Conclusion

This MVP design balances **speed to market** (8-week timeline) with **robust architecture** (Supabase RLS, Stripe webhooks, cost controls). The phased approach allows us to validate the product incrementally:

1. **Week 2:** Users can see a beautiful dashboard (even with mock data)
2. **Week 3:** Users can authenticate (proves email restriction works)
3. **Week 4:** Extension syncs to backend (proves AI pipeline works)
4. **Week 6:** Users can export notes (proves value beyond just viewing)
5. **Week 7:** Billing goes live (proves revenue model)
6. **Week 8:** Public launch (proves market fit)

By keeping the extension standalone during development, we maintain backwards compatibility and don't block users who want to use the existing functionality. The auto-sync feature seamlessly transitions users to the cloud when they're ready.

**Next Steps:** Begin Phase 1 (Dashboard UI) by setting up the design system and building the notes library view with mock data.
