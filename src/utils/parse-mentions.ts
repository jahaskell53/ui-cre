/**
 * Parses @ mentions from text and returns unique full names
 * Matches patterns like @John or @John Smith
 * Names can contain spaces and must be at least 1 character
 * Stops at punctuation, newlines, or when followed by lowercase words (common words)
 */
export function parseMentions(text: string): string[] {
  // Match @ followed by name (letters and spaces) 
  // Stop at: punctuation, newline, end of string, or space followed by lowercase word
  // This prevents matching "John Smith and" as "John Smith and"
  // Matches: @John, @John Smith, @John Smith! (captures "John Smith")
  const mentionRegex = /@([A-Za-z]+(?:\s+[A-Z][a-z]+)*)(?=[!?.,;:\n]|\s+[a-z]|$)/g;
  const matches = text.matchAll(mentionRegex);
  const names = new Set<string>();
  
  for (const match of matches) {
    const name = match[1].trim();
    // Name must be at least 1 character
    if (name.length >= 1) {
      names.add(name);
    }
  }
  
  return Array.from(names);
}

