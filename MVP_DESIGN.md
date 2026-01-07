# Bevo Notes - MVP Design Document

**Project:** Full-stack AI lecture notes platform for UT Austin students (User-Provided API Keys)
**Created:** 2025-12-22
**Last Updated:** 2026-01-06
**Status:** Design Phase

---

## Executive Summary

Bevo Notes transforms UT Austin lecture recordings into searchable, organized AI-generated study notes. Students use a Chrome extension to extract lecture transcripts from UT's Lecture Capture system, which syncs to a web dashboard where they can organize, search, and export their notes library.

### MVP Scope
- **Chrome Extension:** Standalone note generation (existing functionality) + optional cloud sync for authenticated users
- **Web Dashboard:** Full-featured notes library with folders, search, and export capabilities
- **Authentication:** Magic link email authentication (@utexas.edu only) via Supabase
- **API Key Model:** Users provide their own Google Gemini API key, stored securely in database
- **AI Processing:** User's Google Gemini 2.0 Flash API key for note generation (client-side or server-side)

---

## Product Architecture

### System Components

```
┌─────────────────────┐
│  Chrome Extension   │
│  (Standalone Mode)  │
│  - Extract VTT      │
│  - Generate Notes   │
│  - User's Gemini Key│
│  - Local Storage    │
└──────────┬──────────┘
           │
           │ (If authenticated)
           │ Auto-sync
           ▼
┌─────────────────────┐
│   Next.js Backend   │
│  - Session Check    │
│  - User Gemini Key  │
│  - Note Generation  │
│  - Note Storage     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Supabase Services  │
│  - Auth (Magic Link)│
│  - PostgreSQL       │
│  - Row-Level Security│
│  - Encrypted API Keys│
└─────────────────────┘
```

---

## User Flow

### 1. New User Journey

1. **Install Extension**
   - User installs Chrome extension from store
   - Extension prompts: "Enter your Google Gemini API key to get started"
   - User clicks "Get API Key" → Opens Google AI Studio in new tab
   - User signs up for Google AI Studio, creates free API key
   - User copies API key, pastes into extension
   - Extension stores API key in chrome.storage.local
   - Extension is now ready to generate notes locally

2. **First Note Generation** (Standalone)
   - Navigate to lecturecapture.la.utexas.edu lecture
   - Enable captions (CC button)
   - Click "Generate AI Notes" in extension
   - Extension extracts VTT transcript
   - Extension calls Google Gemini 2.0 Flash using user's API key (client-side)
   - Notes generated and stored in chrome.storage.local
   - Notes displayed in extension popup + full page

3. **Discover Cloud Features**
   - Extension shows banner: "Want to save your notes forever? Sign up for free cloud sync"
   - User clicks "Sign Up" button in extension
   - Opens extension login popup

4. **Authentication & API Key Sync**
   - Extension shows login form (email only)
   - User enters @utexas.edu email
   - Supabase sends magic link to email
   - User clicks link, completes authentication
   - User is redirected to web dashboard
   - Dashboard shows: "Set up your API key to sync notes"
   - User enters their Google Gemini API key (or re-uses existing one from extension)
   - API key is encrypted and stored in Supabase database
   - Extension receives session token, stores in chrome.storage.local
   - Extension now auto-syncs all future notes to backend

5. **Ongoing Usage**
   - User generates note on lecture page
   - Extension checks: "Is user logged in?"
     - **No:** Generate locally using user's API key stored in extension
     - **Yes:** Send to backend
       - Backend retrieves user's encrypted API key from database
       - Backend calls Gemini 2.0 Flash using user's API key
       - Backend saves note to database
       - Backend returns note to extension
   - Notes appear in extension + web dashboard
   - User organizes notes into folders on dashboard
   - User pays for their own Gemini API usage (free tier: 1500 requests/day, 1M tokens/min)

### 2. Returning User Journey

1. Open lecturecapture.la.utexas.edu
2. Click extension → "Generate AI Notes"
3. Extension auto-syncs to backend (user already authenticated)
4. Backend uses user's stored API key for generation
5. Note appears in dashboard within seconds
6. User logs into dashboard anytime to browse/search/organize/export

---

## Technical Specifications

### Database Schema (Supabase PostgreSQL)

#### Users Table
```sql
users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  gemini_api_key_encrypted TEXT, -- Encrypted Google Gemini API key
  api_key_last_verified TIMESTAMP, -- Last successful API call timestamp
  api_key_is_valid BOOLEAN DEFAULT TRUE -- Tracks if key is working
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

#### API Key Management
- **POST /api/user/api-key** - Save or update user's Gemini API key
  - Body: `{ api_key: string }`
  - Auth: Required (Supabase session)
  - Processing:
    1. Validate API key by making test call to Gemini API
    2. If valid: Encrypt API key using AES-256
    3. Store encrypted key in database
    4. Return success status
  - Security: API key never stored in plaintext

- **GET /api/user/api-key/status** - Check if user has valid API key
  - Auth: Required (Supabase session)
  - Returns: `{ has_key: boolean, is_valid: boolean, last_verified: timestamp }`

- **DELETE /api/user/api-key** - Remove user's API key
  - Auth: Required (Supabase session)
  - Processing: Delete encrypted key from database

#### Notes
- **POST /api/notes/generate** - Generate new note from transcript
  - Body: `{ title, date, transcript }`
  - Auth: Required (Supabase session)
  - Checks: User has valid API key stored
  - Processing:
    1. Hash transcript (SHA-256)
    2. Check cache (existing note with same hash)
    3. If cached: Return existing note
    4. If new: Clean transcript, retrieve user's encrypted API key
    5. Decrypt API key
    6. Call Gemini 2.0 Flash using user's API key
    7. Store JSON + HTML in database
    8. Return note ID + HTML
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

---

### Chrome Extension Updates

#### API Key Setup Flow
1. On first install, show API key setup UI (`setup.html`, `setup.js`)
2. Provide "Get API Key" button → Opens `https://aistudio.google.com/app/apikey`
3. User pastes API key into input field
4. Extension validates key by making test call to Gemini API
5. Store API key in `chrome.storage.local` (encrypted in extension storage)
6. Show success message and enable note generation

#### Authentication Flow (for Cloud Sync)
1. Add login popup UI (`login.html`, `login.js`)
2. Use Supabase Auth Helpers for Chrome Extensions
3. Store session token in `chrome.storage.local`
4. On first login, prompt user to enter API key on dashboard
5. Check session validity on each note generation

#### Auto-Sync Logic (`popup.js` updates)
```javascript
async function generateNotes() {
  const apiKey = await getApiKey(); // Check chrome.storage.local

  if (!apiKey) {
    showApiKeySetup();
    return;
  }

  const session = await getSession(); // Check chrome.storage.local

  if (session && session.expires_at > Date.now()) {
    // User is authenticated - send to backend (backend will use stored API key)
    await syncToBackend(transcript, session.access_token);
  } else {
    // User not authenticated - generate locally using their API key
    await generateLocally(transcript, apiKey);
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
    // Handle errors (invalid API key, etc.)
    if (data.error === 'invalid_api_key') {
      showApiKeyError();
    } else {
      showError(data.message);
    }
  }
}

async function generateLocally(transcript, apiKey) {
  // Call Gemini API directly using user's API key
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  // Generate notes and store locally
  const result = await model.generateContent(prompt);
  const notes = result.response.text();

  // Store in chrome.storage.local
  await saveNotesLocally(notes);
  displayNotes(notes);
}
```

#### API Key Management
- Store API key securely in extension storage
- Provide "Update API Key" button in extension settings
- If API key fails, show error and prompt to update
- Sync API key to backend when user authenticates (stored encrypted in database)

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

**Cost Controls (User's Responsibility):**
- Cache by transcript hash (avoid regenerating identical lectures for user)
- Hard limit: 50,000 characters per transcript (protect user's quota)
- Rate limit: 10 notes/minute per user (prevent abuse of user's key)
- User pays for their own Gemini API usage
- Gemini Free Tier: 1,500 requests/day, 1M tokens/minute (typically sufficient for students)
- If user exceeds free tier, they pay Google directly for overage

---

### API Key Security & Encryption

#### Encryption Implementation

**Algorithm:** AES-256-GCM (Galois/Counter Mode)
**Key Derivation:** Environment variable `ENCRYPTION_KEY` (32-byte random key)

```javascript
// Server-side encryption (Next.js API route)
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte hex string
const IV_LENGTH = 16; // AES block size

function encryptApiKey(apiKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return IV + authTag + encrypted data (all in hex)
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decryptApiKey(encryptedData: string): string {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

#### API Key Validation

```javascript
// Validate user's API key before storing
async function validateGeminiApiKey(apiKey: string): Promise<boolean> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Make a minimal test call
    const result = await model.generateContent('Test');
    return result.response.text().length > 0;
  } catch (error) {
    return false; // Invalid key
  }
}
```

#### Security Best Practices

1. **Never Log API Keys:** Ensure API keys are never logged in console, error messages, or analytics
2. **Environment Variables:** Store encryption key in secure environment variables (never in code)
3. **HTTPS Only:** All API key transmission must use HTTPS
4. **Rate Limiting:** Prevent brute-force attacks on API key validation endpoint
5. **Audit Logging:** Log when API keys are added, updated, or fail validation (but not the keys themselves)

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

// Middleware for API key check
export async function requireApiKey(user) {
  const { data: userData } = await supabase
    .from('users')
    .select('gemini_api_key_encrypted, api_key_is_valid')
    .eq('id', user.id)
    .single();

  if (!userData.gemini_api_key_encrypted) {
    return new Response('API key required. Please set up your Gemini API key in settings.', { status: 402 });
  }

  if (!userData.api_key_is_valid) {
    return new Response('Your API key is invalid. Please update it in settings.', { status: 402 });
  }

  return userData;
}
```

---

## Security Considerations

### 1. User API Key Storage & Encryption
- **Storage:** User's Gemini API keys are encrypted using AES-256-GCM before storing in database
- **Encryption Key:** Stored in environment variable `ENCRYPTION_KEY`, never in code or version control
- **Decryption:** Only happens server-side when making API calls on behalf of user
- **Never Client-Side:** Encrypted keys are never sent to client (extension or browser)
- **Validation:** All API keys are validated before storage with test Gemini API call
- **Key Rotation:** Users can update/delete their API keys anytime via settings

### 2. API Key Transmission Security
- **HTTPS Only:** All API key submissions must use HTTPS
- **No Logging:** API keys are never logged in console, error messages, analytics, or monitoring tools
- **Input Sanitization:** API keys are validated to match expected format before processing
- **Rate Limiting:** API key validation endpoint is rate-limited to prevent brute-force attacks

### 3. Row-Level Security (RLS)
- All database tables use RLS policies
- Users can only access their own data
- Even if API is compromised, users can't access others' notes

### 4. Rate Limiting
- API Key Management: 5 validation attempts per hour per user (prevent abuse)
- Note Generation: 10 requests per minute per user (protect user's Gemini quota)
- Search API: 60 requests per minute per user
- Implement using Upstash Redis or Vercel KV

### 5. Input Validation
- Sanitize all user inputs (lecture titles, folder names, API keys)
- Validate transcript length (max 50,000 chars)
- Prevent XSS in rendered notes (use DOMPurify)
- Validate API key format before encryption

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

### Platform Costs (User-Provided API Keys Model)

**AI Processing (Gemini 2.0 Flash):**
- **Platform Cost:** $0 (users provide their own API keys)
- **User Cost:** Google Gemini Free Tier
  - 1,500 requests per day
  - 1M tokens per minute
  - For typical student: ~20 notes/month = well within free tier
  - If user exceeds: They pay Google directly (~$0.032/month for 20 notes)

**Infrastructure:**
- **Vercel:** Free tier (10M serverless function executions, sufficient for MVP)
- **Supabase:** Free tier (500MB database, 2GB file storage, unlimited API requests)
- **Domain:** ~$12/year (~$1/month) - Optional, can use .vercel.app
- **Monitoring/Analytics:** Free tier (PostHog, Sentry)

**Total Monthly Platform Cost:** ~$1/month (domain only)
**Cost Per User:** $0 (infrastructure scales on free tiers)
**Revenue Model:** Free platform (no subscription fees)

**Monetization Strategy (Post-MVP):**
- Completely free for students during MVP
- Future options if scaling beyond free tiers:
  - Optional premium features (advanced analytics, integrations)
  - Institutional licensing to universities
  - Donations/sponsorships
  - Ads (not recommended for student tool)

**Break-even:** Already profitable at $0 monthly cost
**Target:** 100+ active users with $0 operating costs

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
- [ ] Extension API key setup UI (first-time setup flow)
- [ ] Extension login popup UI
- [ ] Supabase Auth in extension (chrome.storage.local)
- [ ] Session token refresh logic
- [ ] Backend API: `POST /api/notes/generate`
- [ ] Gemini 2.0 Flash integration using user's API key
- [ ] API key retrieval and decryption in backend
- [ ] Transcript cleaning & validation
- [ ] JSON schema validation
- [ ] HTML rendering from JSON
- [ ] Database note storage
- [ ] Extension auto-sync logic
- [ ] Error handling for invalid API keys & retry logic

**Deliverable:** Extension can authenticate, manage API keys, and sync notes to backend

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

### Phase 6: API Key Management (Week 6)
- [ ] API key setup UI in dashboard (input, validate, save)
- [ ] `POST /api/user/api-key` - Save encrypted API key
- [ ] `GET /api/user/api-key/status` - Check API key validity
- [ ] `DELETE /api/user/api-key` - Remove API key
- [ ] Encryption/decryption utility functions (AES-256-GCM)
- [ ] API key validation with test Gemini call
- [ ] Extension API key setup flow (first-time setup)
- [ ] API key sync between extension and dashboard
- [ ] Error handling for invalid/expired API keys
- [ ] Settings page with API key management
- [ ] "Get API Key" guide/tutorial for users

**Deliverable:** Users can securely store and manage their Gemini API keys

---

### Phase 7: Polish & Testing (Week 7-8)
- [ ] Error handling & user-friendly messages
- [ ] Loading states & skeleton screens
- [ ] Empty states (no notes, no folders, no API key)
- [ ] Onboarding flow for new users (API key setup guide)
- [ ] Email notifications (welcome email)
- [ ] API key setup tutorial/walkthrough
- [ ] Performance optimization (caching, lazy loading)
- [ ] Security audit (RLS, API key encryption, rate limits, input validation)
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
- [ ] Environment variables setup (ENCRYPTION_KEY for API key storage)
- [ ] Analytics setup (PostHog, Plausible, or similar)
- [ ] Launch announcement (UT subreddit, class GroupMe's, flyers)
- [ ] Support channel setup (email or Discord)
- [ ] API key setup guide/documentation
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
- **AI:** Google Gemini 2.0 Flash (via @google/generative-ai SDK, using user's API key)
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

# Encryption (for user API keys)
ENCRYPTION_KEY=64_character_hex_string # 32-byte AES-256 key, generate with: openssl rand -hex 32

# App Config
NEXT_PUBLIC_APP_URL=https://bevo-notes.vercel.app
ALLOWED_EMAIL_DOMAIN=utexas.edu

# Rate Limiting (Upstash Redis or Vercel KV)
KV_REST_API_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=xxx

# Optional: For testing/demo purposes only
DEMO_GEMINI_API_KEY=AIzaSyxxx... # NOT for production, only for testing API integration
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
- API key setup completion rate
- Average notes per user per month
- Error rates (note generation failures, invalid API keys)
- User retention (weekly/monthly active users)

---

## Success Criteria

### MVP Launch Goals (First Semester)
- [ ] 100 extension installs
- [ ] 50 registered users (authenticated on dashboard)
- [ ] 30 users with API keys configured
- [ ] < 5% note generation error rate
- [ ] < $5/month in infrastructure costs
- [ ] Positive user feedback (NPS > 30)
- [ ] 80%+ API key setup completion rate

### 6-Month Goals
- [ ] 500 extension installs
- [ ] 250 registered users
- [ ] 150+ active users generating notes regularly
- [ ] Sustained growth without infrastructure cost increases
- [ ] Feature requests prioritized for V2
- [ ] Community engagement (Discord/Reddit discussions)

---

## Risks & Mitigation

### Risk 1: Low Adoption / API Key Setup Friction
**Mitigation:**
- Clear, step-by-step API key setup guide with screenshots
- Video tutorial showing how to get Gemini API key
- Completely free platform (no payment required)
- Emphasize Gemini free tier (1,500 requests/day = ~1,500 notes/day)
- Grassroots marketing (class GroupMe's, Reddit, flyers)

### Risk 2: User API Key Security Concerns
**Mitigation:**
- Transparent encryption documentation (show we use AES-256-GCM)
- Open-source codebase (users can audit security)
- Clear privacy policy (we never use their keys for anything except their notes)
- Option to use extension-only mode (no cloud sync, no key storage)
- API key validation before storage
- User can delete their key anytime

### Risk 3: Google API Key Abuse / Quota Exhaustion
**Mitigation:**
- Rate limiting (10 notes/minute per user)
- Transcript caching (avoid regenerating identical lectures)
- Character limits (50,000 chars max)
- User education about Gemini free tier limits
- Error messages when user hits quota (with guidance)

### Risk 4: Transcript Quality Issues
**Mitigation:**
- Transcript cleaning pipeline (dedupe, fix errors)
- Fallback to raw transcript if cleaning fails
- User feedback button ("Report Poor Quality Notes")
- Clear expectations (AI-generated notes may have errors)

### Risk 5: UT System Changes
**Mitigation:**
- Monitor lecturecapture.la.utexas.edu for updates
- Extension content script is robust (uses Performance API)
- Have backup extraction method (direct VTT download)
- Community can report issues quickly (Discord/email)

---

## Support & Maintenance

### User Support Channels
- **Email:** support@bevo-notes.com (or Gmail for MVP)
- **FAQ Page:** Common issues (extension not working, no captions, API key setup, invalid API key)
- **In-app Help:** Tooltips, onboarding tour, API key setup guide
- **Documentation:** Step-by-step guide for getting Gemini API key from Google AI Studio

### Monitoring Tools
- **Error Tracking:** Sentry (catch backend errors, API key failures)
- **Uptime Monitoring:** Vercel built-in or UptimeRobot
- **Analytics:** PostHog (user behavior, feature usage, API key setup funnel)
- **Logs:** Vercel logs (serverless function logs)

### Maintenance Tasks
- Weekly: Review error logs, user feedback, API key validation failures
- Monthly: Usage analysis, infrastructure cost review
- Quarterly: Security audit (especially encryption), dependency updates

---

## Conclusion

This MVP design balances **speed to market** (8-week timeline) with **robust architecture** (Supabase RLS, API key encryption, zero operating costs). The phased approach allows us to validate the product incrementally:

1. **Week 2:** Users can see a beautiful dashboard (even with mock data) ✅ COMPLETED
2. **Week 3:** Users can authenticate (proves email restriction works)
3. **Week 4:** Extension syncs to backend (proves AI pipeline works with user's API key)
4. **Week 6:** Users can set up and securely store their Gemini API keys
5. **Week 7:** Polish and testing (proves robustness)
6. **Week 8:** Public launch (proves market fit)

By using a user-provided API key model, we achieve:
- **Zero ongoing costs:** Users pay Google directly for their own AI usage (typically free tier)
- **Scalability:** No infrastructure cost scaling with user growth
- **Privacy:** Users control their own API keys and can delete them anytime
- **Transparency:** Open about encryption and security practices
- **Accessibility:** Completely free platform for all students

The extension remains standalone-capable, allowing users to generate notes locally without authentication. The cloud sync feature provides the convenience of cross-device access and permanent storage when users are ready.

**Next Steps:** Continue with Phase 2 (Authentication) and Phase 3 (Extension Sync with API Key Management).
