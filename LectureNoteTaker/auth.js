// auth.js - Authentication module for Bevo Notes Chrome extension

// Get backend URL from config (see config.js for environment settings)
const BACKEND_URL = typeof CONFIG !== 'undefined' ? CONFIG.BACKEND_URL : 'http://localhost:3000';

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
 * Sync session from web app cookies
 * Call this on popup open to detect if user logged in via web
 * @returns {Promise<{email: string} | null>}
 */
async function syncSession() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      credentials: 'include',
    });

    if (response.ok) {
      const user = await response.json();
      // User is logged in via web, save to chrome storage
      await saveSession({ authenticated: true }, { email: user.email });
      return { email: user.email };
    } else {
      // Not logged in, clear any stale session
      await clearSession();
      return null;
    }
  } catch {
    // Network error, keep existing session state
    return await getUser();
  }
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
  syncSession,
  BACKEND_URL,
};
