// auth.js - Authentication module for Bevo Notes Chrome extension

const BACKEND_URL = 'http://localhost:3000'; // Change to production URL when deployed

// Storage keys
const SESSION_KEY = 'bevo_session';
const USER_KEY = 'bevo_user';

/**
 * Check if user is logged in
 * @returns {Promise<boolean>}
 */
async function isLoggedIn() {
  const { [SESSION_KEY]: session } = await chrome.storage.local.get(SESSION_KEY);
  return !!session;
}

/**
 * Get current session
 * @returns {Promise<{accessToken: string, refreshToken: string} | null>}
 */
async function getSession() {
  const { [SESSION_KEY]: session } = await chrome.storage.local.get(SESSION_KEY);
  return session || null;
}

/**
 * Get current user info
 * @returns {Promise<{email: string} | null>}
 */
async function getUser() {
  const { [USER_KEY]: user } = await chrome.storage.local.get(USER_KEY);
  return user || null;
}

/**
 * Save session to storage
 * @param {Object} session - Session object with accessToken and refreshToken
 * @param {Object} user - User object with email
 */
async function saveSession(session, user) {
  await chrome.storage.local.set({
    [SESSION_KEY]: session,
    [USER_KEY]: user,
  });
}

/**
 * Clear session from storage (logout)
 */
async function clearSession() {
  await chrome.storage.local.remove([SESSION_KEY, USER_KEY]);
}

/**
 * Open login page in new tab
 */
function openLoginPage() {
  chrome.tabs.create({ url: `${BACKEND_URL}/login?from=extension` });
}

/**
 * Open settings page in new tab
 */
function openSettingsPage() {
  chrome.tabs.create({ url: `${BACKEND_URL}/settings` });
}

/**
 * Generate notes via backend API
 * @param {string} transcript - The lecture transcript
 * @param {string} title - Optional title for the notes
 * @returns {Promise<{id: string, title: string, notes_html: string}>}
 */
async function generateNotes(transcript, title = null) {
  const session = await getSession();

  if (!session) {
    throw new Error('Not logged in');
  }

  const response = await fetch(`${BACKEND_URL}/api/notes/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for session
    body: JSON.stringify({
      transcript,
      title,
    }),
  });

  if (response.status === 401) {
    // Session expired, clear and prompt re-login
    await clearSession();
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to generate notes');
  }

  return response.json();
}

/**
 * Check API key status
 * @returns {Promise<{has_key: boolean, is_valid: boolean}>}
 */
async function checkApiKeyStatus() {
  const response = await fetch(`${BACKEND_URL}/api/user/api-key/status`, {
    credentials: 'include',
  });

  if (!response.ok) {
    return { has_key: false, is_valid: false };
  }

  return response.json();
}

// Export functions for use in popup.js
window.BevoAuth = {
  isLoggedIn,
  getSession,
  getUser,
  saveSession,
  clearSession,
  openLoginPage,
  openSettingsPage,
  generateNotes,
  checkApiKeyStatus,
  BACKEND_URL,
};
