export interface MentionMatch {
    query: string;
    position: number;
}

export interface AppliedMention {
    text: string;
    cursorPosition: number;
}

export function getMentionMatch(value: string, cursorPosition: number): MentionMatch | null {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
        return null;
    }

    const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
    if (textAfterAt.includes(" ") || textAfterAt.length === 0) {
        return null;
    }

    return {
        query: textAfterAt.trim(),
        position: lastAtIndex,
    };
}

export function applyMention(value: string, mentionPosition: number, mentionQuery: string, username: string): AppliedMention {
    const textBefore = value.substring(0, mentionPosition);
    const textAfter = value.substring(mentionPosition + 1 + mentionQuery.length);
    const text = `${textBefore}@${username} ${textAfter}`;

    return {
        text,
        cursorPosition: mentionPosition + username.length + 2,
    };
}
