// Validate UT Austin email addresses
// Accepts any email ending in utexas.edu (including all subdomains)
// Examples: @utexas.edu, @eid.utexas.edu, @cs.utexas.edu, @me.utexas.edu, etc.

export function isValidUTEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailLower = email.toLowerCase().trim();

  // Check if email ends with utexas.edu (catches all subdomains)
  return emailLower.endsWith('utexas.edu');
}

export function getEmailValidationMessage(): string {
  return 'Please use your UT Austin email address (must end in utexas.edu)';
}
