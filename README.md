# Bevo Notes

An AI-powered lecture notes platform for UT Austin students. Transform lecture recordings from UT's Lecture Capture system into organized, searchable study notes using Google Gemini AI.

## Features

- **Chrome Extension** - Automatically extracts captions from UT Lecture Capture pages
- **AI Note Generation** - Uses Google Gemini 2.0 Flash to create structured study notes with key definitions, examples, and quick quizzes
- **Cloud Dashboard** - Organize notes into folders, search across all content, and access from anywhere
- **UT Austin Integration** - Magic link authentication restricted to @utexas.edu emails

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Row-Level Security)
- **AI**: Google Gemini 2.0 Flash API
- **Extension**: Chrome Manifest V3

## Project Structure

```
bevo-notes/
├── app/                    # Next.js app router pages
│   ├── dashboard/          # Main notes dashboard
│   ├── login/              # Authentication
│   └── notes/[id]/         # Individual note viewer
├── components/             # React components
├── lib/supabase/           # Supabase client configuration
└── LectureNoteTaker/       # Chrome extension
    ├── manifest.json
    ├── content.js          # Caption extraction
    ├── popup.js            # Extension UI logic
    └── notes.js            # Notes display
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- Google Gemini API key

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/lucascarsonbrown/bevo-notes.git
   cd bevo-notes
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up environment variables
   ```bash
   cp .env.example .env.local
   ```
   Add your Supabase URL, anon key, and other required variables.

4. Run the development server
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

### Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `LectureNoteTaker` folder
4. The extension will appear in your toolbar

## Usage

1. Navigate to a UT Lecture Capture page
2. Click the Bevo Notes extension icon
3. Enter your Google Gemini API key (first time only)
4. Click "Generate Notes" to create AI-powered study notes
5. View and organize notes in the web dashboard

## Development

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
```

## License

MIT
