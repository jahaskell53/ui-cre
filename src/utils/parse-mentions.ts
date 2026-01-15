/**
 * Parses @ mentions from text and returns unique usernames
 * Matches patterns like @username or @username123
 * Usernames must be at least 3 characters (matching database constraint)
 */
export function parseMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = text.matchAll(mentionRegex);
  const usernames = new Set<string>();
  
  for (const match of matches) {
    const username = match[1];
    // Username must be at least 3 characters (matching database constraint)
    if (username.length >= 3) {
      usernames.add(username);
    }
  }
  
  return Array.from(usernames);
}

