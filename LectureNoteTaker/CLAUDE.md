# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Bevo Notes** is a Chrome extension (Manifest V3) that extracts captions from UT Lectures Online and generates AI-organized study notes using OpenAI's API.

## Architecture

### Component Flow
1. **content.js** - Content script injected into `lecturecapture.la.utexas.edu` pages
   - Monitors network requests for caption_proxy URLs (using Performance API)
   - Fetches VTT caption files and converts them to plain text
   - Responds to messages from popup requesting transcripts

2. **popup.js** - Extension popup interface
   - Sends GET_TRANSCRIPT message to content script on active tab
   - Calls OpenAI API with structured prompt to generate HTML notes
   - Stores generated notes in chrome.storage.local
   - Opens notes.html in a new tab with the results

3. **notes.js** - Notes display page
   - Retrieves stored notes HTML from chrome.storage.local
   - Renders the AI-generated content

### Key Technical Details

- **Caption Extraction**: Uses `performance.getEntriesByType("resource")` to find the caption_proxy request URL, then fetches and parses VTT format
- **Message Passing**: Chrome extension message passing between popup and content script with async sendResponse pattern
- **Storage**: Uses chrome.storage.local API to pass generated HTML between popup and notes page
- **OpenAI Integration**: Calls chat completions API with a structured prompt requesting specific sections (Key Definitions, Examples, Quick Quiz)

## Configuration

**API Key**: The OpenAI API key is hardcoded in popup.js:3. To update it, modify the `OPENAI_API_KEY` constant.

**Target Sites**: The extension has host_permissions for:
- lecturecapture.la.utexas.edu
- lectures-engage.la.utexas.edu
- api.openai.com

## Loading the Extension

Since this is an unpacked extension:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `/Users/lucasbrown/Desktop/PersonalProjects/LectureNoteTaker` directory

## Testing

To test the extension:
1. Navigate to a lecture page on lecturecapture.la.utexas.edu
2. Play the video and enable captions (CC button)
3. Scrub through the video to trigger caption loading
4. Click the extension icon and press "Generate AI notes for this lecture"

**Common Issues**:
- If "No caption_proxy request found" error appears, ensure captions are enabled and the video has been scrubbed to load caption data
- If OpenAI API errors occur, verify the API key is valid and has sufficient credits
