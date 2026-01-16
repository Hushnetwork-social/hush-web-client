/**
 * Mention Parser Module
 *
 * Utility functions for parsing, formatting, and detecting @mentions in message content.
 * Mentions are stored in the format: @[displayName](identityId)
 */

/**
 * Represents a parsed mention from message content
 */
export interface ParsedMention {
  displayName: string;
  identityId: string;
  startIndex: number;
  endIndex: number;
  raw: string;
}

/**
 * Result of mention trigger detection
 */
export interface MentionTriggerResult {
  isActive: boolean;
  filterText: string;
  triggerPosition: number;
}

/**
 * Result of replacing a mention trigger with a formatted mention
 */
export interface ReplaceMentionResult {
  text: string;
  cursorPosition: number;
}

// Regex pattern to match stored mentions: @[displayName](identityId)
const MENTION_PATTERN = /@\[([^\]]+)\]\(([^)]+)\)/g;

// Regex to detect active mention trigger while typing
// Matches @ at word boundary followed by optional filter text (non-whitespace, non-bracket chars)
const MENTION_TRIGGER_PATTERN = /(?:^|[\s])@([^\s\[\]()]*)$/;

/**
 * Formats a mention for storage in message content.
 *
 * @param displayName - The display name of the mentioned user
 * @param identityId - The identity ID of the mentioned user
 * @returns The formatted mention string: @[displayName](identityId)
 *
 * @example
 * formatMention("John Smith", "abc123-def456")
 * // Returns: "@[John Smith](abc123-def456)"
 */
export function formatMention(displayName: string, identityId: string): string {
  return `@[${displayName}](${identityId})`;
}

/**
 * Parses all mentions from message content.
 *
 * @param content - The message content to parse
 * @returns Array of parsed mentions with display names, IDs, and positions
 *
 * @example
 * parseMentions("Hey @[John Smith](abc123) check this out!")
 * // Returns: [{ displayName: "John Smith", identityId: "abc123", startIndex: 4, endIndex: 25, raw: "@[John Smith](abc123)" }]
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];

  // Reset regex lastIndex to ensure fresh search
  const pattern = new RegExp(MENTION_PATTERN.source, 'g');

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    mentions.push({
      displayName: match[1],
      identityId: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      raw: match[0],
    });
  }

  return mentions;
}

/**
 * Detects if the user is currently typing a mention trigger.
 * Looks for @ followed by optional filter text at or before the cursor position.
 *
 * @param text - The current input text
 * @param cursorPosition - The cursor position in the text
 * @returns MentionTriggerResult if an active mention is detected, null otherwise
 *
 * @example
 * detectMentionTrigger("Hey @jo", 7)
 * // Returns: { isActive: true, filterText: "jo", triggerPosition: 4 }
 *
 * detectMentionTrigger("Hey there", 9)
 * // Returns: null
 */
export function detectMentionTrigger(
  text: string,
  cursorPosition: number
): MentionTriggerResult | null {
  // Get text up to cursor position
  const textUpToCursor = text.slice(0, cursorPosition);

  // Look for @ trigger pattern
  const match = textUpToCursor.match(MENTION_TRIGGER_PATTERN);

  if (!match) {
    return null;
  }

  const filterText = match[1] || '';

  // Calculate the position of the @ symbol
  // match.index is the start of the match (which may include a leading space)
  // We need to find where the @ actually is
  const atIndex = textUpToCursor.lastIndexOf('@');

  // Verify the @ we found is part of this match (at word boundary)
  // Check if there's a non-whitespace character immediately before @
  if (atIndex > 0) {
    const charBefore = textUpToCursor[atIndex - 1];
    // @ must be at start or after whitespace to be a valid trigger
    if (!/\s/.test(charBefore)) {
      return null;
    }
  }

  return {
    isActive: true,
    filterText,
    triggerPosition: atIndex,
  };
}

/**
 * Replaces the current mention trigger with a formatted mention.
 *
 * @param text - The current input text
 * @param triggerPosition - The position of the @ trigger
 * @param cursorPosition - The current cursor position
 * @param displayName - The display name of the selected user
 * @param identityId - The identity ID of the selected user
 * @returns Object with the new text and cursor position
 *
 * @example
 * replaceMentionTrigger("Hey @jo", 4, 7, "John", "id1")
 * // Returns: { text: "Hey @[John](id1) ", cursorPosition: 17 }
 */
export function replaceMentionTrigger(
  text: string,
  triggerPosition: number,
  cursorPosition: number,
  displayName: string,
  identityId: string
): ReplaceMentionResult {
  const formattedMention = formatMention(displayName, identityId);

  // Text before the @ trigger
  const beforeTrigger = text.slice(0, triggerPosition);

  // Text after the cursor (anything the user typed after the filter text)
  const afterCursor = text.slice(cursorPosition);

  // Combine: before + mention + space + after
  const newText = beforeTrigger + formattedMention + ' ' + afterCursor;

  // New cursor position is after the mention and space
  const newCursorPosition = triggerPosition + formattedMention.length + 1;

  return {
    text: newText,
    cursorPosition: newCursorPosition,
  };
}

/**
 * Extracts plain text from content with mentions (for display purposes).
 * Replaces @[displayName](identityId) with @displayName
 *
 * @param content - The message content with mention formatting
 * @returns The content with mentions displayed as @displayName
 *
 * @example
 * getMentionDisplayText("Hey @[John Smith](abc123)!")
 * // Returns: "Hey @John Smith!"
 */
export function getMentionDisplayText(content: string): string {
  return content.replace(MENTION_PATTERN, '@$1');
}

/**
 * Checks if a string contains any mentions.
 *
 * @param content - The message content to check
 * @returns True if the content contains at least one mention
 */
export function hasMentions(content: string): boolean {
  // Reset the pattern before testing
  const pattern = new RegExp(MENTION_PATTERN.source);
  return pattern.test(content);
}

/**
 * Finds the mention at or adjacent to the cursor position for atomic delete.
 * Returns the mention if cursor is inside it or immediately after it (for backspace).
 *
 * @param content - The message content
 * @param cursorPosition - The cursor position
 * @param direction - 'backward' for backspace (check if cursor is at end of mention)
 *                    'forward' for delete (check if cursor is at start of mention)
 * @returns The mention to delete, or null if cursor is not at a mention boundary
 *
 * @example
 * // Cursor at end of mention: "Hey @[John](id1)| more"
 * findMentionAtCursor("Hey @[John](id1) more", 16, 'backward')
 * // Returns: { startIndex: 4, endIndex: 16, ... }
 */
export function findMentionAtCursor(
  content: string,
  cursorPosition: number,
  direction: 'backward' | 'forward'
): ParsedMention | null {
  const mentions = parseMentions(content);

  for (const mention of mentions) {
    if (direction === 'backward') {
      // For backspace: check if cursor is inside or at the end of mention
      if (cursorPosition > mention.startIndex && cursorPosition <= mention.endIndex) {
        return mention;
      }
    } else {
      // For delete: check if cursor is inside or at the start of mention
      if (cursorPosition >= mention.startIndex && cursorPosition < mention.endIndex) {
        return mention;
      }
    }
  }

  return null;
}
