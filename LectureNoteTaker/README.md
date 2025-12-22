# Bevo Notes - Chrome Extension

AI-powered lecture note generator for UT Austin's Lecture Capture system.

## Features

- 📄 Automatically extracts lecture transcripts from UT Lectures Online
- 🤖 Generates structured, comprehensive notes using Google Gemini AI
- 📚 Organizes content by topics with proper mathematical formatting
- 🌙 Dark mode support
- 💾 Local storage of generated notes
- 🖨️ Print and export capabilities

## Setup Instructions

### 1. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key (starts with `AIza...`)

### 2. Install the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the `LectureNoteTaker` folder

### 3. Add Your API Key

1. Open the file `popup.js` in a text editor
2. Find line 4: `const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";`
3. Replace `YOUR_GEMINI_API_KEY_HERE` with your actual API key
4. Save the file
5. Go back to `chrome://extensions/` and click the refresh icon on the Bevo Notes extension

## How to Use

### Generating Notes from a Lecture

1. **Navigate to a lecture page** on [lecturecapture.la.utexas.edu](https://lecturecapture.la.utexas.edu/)

2. **Enable captions**:
   - Click the CC (closed captions) button on the video player
   - Scrub through the video to ensure captions load properly

3. **Generate AI notes**:
   - Click the Bevo Notes extension icon in your Chrome toolbar
   - Click "Generate AI Notes"
   - Wait for the 3-step process to complete:
     - 📄 Fetching transcript from the lecture page
     - 🔍 Analyzing lecture content
     - ✨ Generating structured notes with AI

4. **View your notes**:
   - Preview appears in the extension popup
   - Click "View Full Notes" for the complete formatted document
   - Use the copy button to copy to clipboard
   - Use the print button to save as PDF

## Features in Detail

### AI Note Generation

The extension uses **Google Gemini 2.0 Flash Lite** (via the official `@google/genai` SDK) to transform lecture transcripts into high-quality study notes:

- **Content Preservation**: Keeps all important concepts, definitions, examples, and reasoning
- **Structured Format**: Organized by topics with clear headings
- **Mathematical Precision**: Uses MathML and Unicode symbols for formulas
- **Professional Tone**: Reads like professor-written lecture notes

### What Gets Included in Notes

✅ **Included**:
- All mathematical content and formulas
- Definitions and theorems
- Examples and worked problems
- Proofs and reasoning
- Important course logistics (exams, assignments)

❌ **Removed**:
- Filler words and classroom chatter
- Jokes and off-topic discussions
- Technical issues or interruptions
- Excessive repetition

### Dark Mode

- Toggle between light and dark themes using the moon/sun icon
- Preference is saved automatically
- Works in both popup and full notes view

## Troubleshooting

### "Please reload the lecture page and try again" Error
- This happens when you install/update the extension while already on the lecture page
- **Solution:** Simply refresh the lecture page (F5 or Cmd+R) and try again
- The extension's content script only loads when a page is freshly loaded

### "Set your Gemini API key" Error
- Make sure you've replaced `YOUR_GEMINI_API_KEY_HERE` in `popup.js` with your actual API key
- Reload the extension after editing the file

### No Transcript Found
- Ensure captions are enabled (CC button)
- Scrub through the video to force caption loading
- Some lectures may not have captions available

### API Rate Limits
- Free Gemini API tier has rate limits (60 requests per minute)
- If you hit the limit, wait a minute and try again
- Consider upgrading to a paid API plan for higher limits

### Notes Not Generating
- Check browser console for errors (F12 → Console tab)
- Verify you have internet connection
- Make sure the API key is valid and active

## Privacy & Data

- **Local Processing**: All notes are stored locally in your browser (`chrome.storage.local`)
- **API Calls**: Transcripts are sent to Google Gemini API for processing
- **No Account Required**: Extension works completely standalone
- **Your Data**: We don't collect, store, or track any of your data

## Cost Information

**Google Gemini 2.0 Flash Lite API Pricing** (as of December 2024):
- **Input**: FREE up to rate limits
- **Output**: FREE up to rate limits
- **Estimated cost per lecture**: $0.00 (completely free!)

**Free Tier**:
- 15 requests per minute
- 1,500 requests per day
- 1 million requests per month

For typical student usage (5-10 lectures per week), you'll stay well within the free tier.

## Supported Lecture Platforms

- ✅ lecturecapture.la.utexas.edu (UT Lectures Online)
- ✅ lectures-engage.la.utexas.edu

## Future Features

This extension will eventually sync with a web dashboard where you can:
- Store all your notes in the cloud
- Organize notes by course and semester
- Search across all lectures
- Export to PDF, Markdown, or HTML
- Access from any device

## Technical Details

**Built With**:
- Chrome Extension Manifest V3
- Google Gemini 2.0 Flash Lite API
- Official `@google/genai` SDK (via CDN)
- ES Modules (modern JavaScript)
- VTT caption parsing

**Permissions Used**:
- `activeTab`: Access current lecture page
- `scripting`: Inject content script to extract captions
- `storage`: Save generated notes locally
- `tabs`: Open full notes in new tab

## Support

For issues or questions:
- Check the troubleshooting section above
- Review extension logs in Chrome DevTools console
- Contact: [Your contact info]

## License

[Your license here]

---

**Hook 'em! 🤘**
