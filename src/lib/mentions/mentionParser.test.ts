/**
 * Mention Parser Tests
 *
 * Comprehensive tests for all mention parser utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  formatMention,
  parseMentions,
  detectMentionTrigger,
  replaceMentionTrigger,
  getMentionDisplayText,
  hasMentions,
} from './mentionParser';

describe('mentionParser', () => {
  describe('formatMention', () => {
    it('creates valid mention syntax', () => {
      const result = formatMention('John Smith', 'abc123');
      expect(result).toBe('@[John Smith](abc123)');
    });

    it('handles special characters in display name', () => {
      const result = formatMention("O'Brien Jr.", 'xyz789');
      expect(result).toBe("@[O'Brien Jr.](xyz789)");
    });

    it('handles display names with spaces', () => {
      const result = formatMention('Anna Maria Jones', 'id-456');
      expect(result).toBe('@[Anna Maria Jones](id-456)');
    });

    it('handles identity IDs with hyphens', () => {
      const result = formatMention('Test User', 'abc123-def456-ghi789');
      expect(result).toBe('@[Test User](abc123-def456-ghi789)');
    });

    it('handles empty display name', () => {
      const result = formatMention('', 'id123');
      expect(result).toBe('@[](id123)');
    });
  });

  describe('parseMentions', () => {
    it('finds single mention', () => {
      const content = 'Hello @[Alice](id1)!';
      const result = parseMentions(content);

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Alice');
      expect(result[0].identityId).toBe('id1');
    });

    it('finds multiple mentions', () => {
      const content = '@[A](1) @[B](2) @[C](3)';
      const result = parseMentions(content);

      expect(result).toHaveLength(3);
      expect(result[0].displayName).toBe('A');
      expect(result[1].displayName).toBe('B');
      expect(result[2].displayName).toBe('C');
    });

    it('returns empty array for no mentions', () => {
      const content = 'Hello world';
      const result = parseMentions(content);

      expect(result).toEqual([]);
    });

    it('provides correct indices for single mention', () => {
      const content = 'Hi @[Bob](123) there';
      const result = parseMentions(content);

      expect(result).toHaveLength(1);
      expect(result[0].startIndex).toBe(3);
      expect(result[0].endIndex).toBe(14);
      expect(result[0].raw).toBe('@[Bob](123)');
    });

    it('provides correct indices for multiple mentions', () => {
      const content = '@[Alice](id1) and @[Bob](id2) please review';
      const result = parseMentions(content);

      expect(result).toHaveLength(2);

      // First mention: @[Alice](id1) at position 0
      expect(result[0].startIndex).toBe(0);
      expect(result[0].endIndex).toBe(13);

      // Second mention: @[Bob](id2) at position 18
      expect(result[1].startIndex).toBe(18);
      expect(result[1].endIndex).toBe(29);
    });

    it('handles mentions with special characters in names', () => {
      const content = "Hey @[John O'Brien](id1)!";
      const result = parseMentions(content);

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe("John O'Brien");
    });

    it('handles mentions with long identity IDs', () => {
      const content = 'Check @[User](abc123-def456-ghi789-jkl012)';
      const result = parseMentions(content);

      expect(result).toHaveLength(1);
      expect(result[0].identityId).toBe('abc123-def456-ghi789-jkl012');
    });

    it('ignores incomplete mention syntax', () => {
      const content = 'Hey @[NotComplete and @NoParens(id)';
      const result = parseMentions(content);

      expect(result).toEqual([]);
    });

    it('handles adjacent mentions', () => {
      const content = '@[A](1)@[B](2)';
      const result = parseMentions(content);

      expect(result).toHaveLength(2);
    });
  });

  describe('detectMentionTrigger', () => {
    it('finds active mention at end of text', () => {
      const text = 'Hey @jo';
      const result = detectMentionTrigger(text, 7);

      expect(result).not.toBeNull();
      expect(result?.isActive).toBe(true);
      expect(result?.filterText).toBe('jo');
      expect(result?.triggerPosition).toBe(4);
    });

    it('finds active mention with @ only', () => {
      const text = 'Hey @';
      const result = detectMentionTrigger(text, 5);

      expect(result).not.toBeNull();
      expect(result?.isActive).toBe(true);
      expect(result?.filterText).toBe('');
      expect(result?.triggerPosition).toBe(4);
    });

    it('returns null with no @', () => {
      const text = 'Hey there';
      const result = detectMentionTrigger(text, 9);

      expect(result).toBeNull();
    });

    it('ignores @ in middle of word (email-like)', () => {
      const text = 'email@example.com';
      const result = detectMentionTrigger(text, 17);

      expect(result).toBeNull();
    });

    it('finds mention at start of text', () => {
      const text = '@john';
      const result = detectMentionTrigger(text, 5);

      expect(result).not.toBeNull();
      expect(result?.isActive).toBe(true);
      expect(result?.filterText).toBe('john');
      expect(result?.triggerPosition).toBe(0);
    });

    it('finds mention after newline', () => {
      const text = 'Hello\n@user';
      const result = detectMentionTrigger(text, 11);

      expect(result).not.toBeNull();
      expect(result?.filterText).toBe('user');
    });

    it('handles cursor in middle of filter text', () => {
      const text = 'Hey @johnny';
      const result = detectMentionTrigger(text, 8); // cursor after "joh"

      expect(result).not.toBeNull();
      expect(result?.filterText).toBe('joh');
    });

    it('returns null when cursor is before @', () => {
      const text = 'Hey @john';
      const result = detectMentionTrigger(text, 3); // cursor at "Hey|"

      expect(result).toBeNull();
    });

    it('finds mention after multiple spaces', () => {
      const text = 'Hey   @test';
      const result = detectMentionTrigger(text, 11);

      expect(result).not.toBeNull();
      expect(result?.filterText).toBe('test');
    });
  });

  describe('replaceMentionTrigger', () => {
    it('inserts mention correctly', () => {
      const text = 'Hey @jo';
      const result = replaceMentionTrigger(text, 4, 7, 'John', 'id1');

      expect(result.text).toBe('Hey @[John](id1) ');
      expect(result.cursorPosition).toBe(17);
    });

    it('preserves text after cursor', () => {
      const text = 'Hey @jo and more text';
      // Assuming user selected when cursor was at position 7 (after "jo")
      // Text after cursor is " and more text"
      const result = replaceMentionTrigger(text, 4, 7, 'John', 'id1');

      expect(result.text).toBe('Hey @[John](id1)  and more text');
    });

    it('handles @ at start of text', () => {
      const text = '@john';
      const result = replaceMentionTrigger(text, 0, 5, 'John Smith', 'abc123');

      expect(result.text).toBe('@[John Smith](abc123) ');
      expect(result.cursorPosition).toBe(22);
    });

    it('handles empty filter text', () => {
      const text = 'Hey @';
      const result = replaceMentionTrigger(text, 4, 5, 'Alice', 'id2');

      expect(result.text).toBe('Hey @[Alice](id2) ');
    });

    it('handles names with special characters', () => {
      const text = 'Ping @ob';
      const result = replaceMentionTrigger(text, 5, 8, "O'Brien", 'id3');

      expect(result.text).toBe("Ping @[O'Brien](id3) ");
    });
  });

  describe('getMentionDisplayText', () => {
    it('converts single mention to display format', () => {
      const content = 'Hey @[John Smith](abc123)!';
      const result = getMentionDisplayText(content);

      expect(result).toBe('Hey @John Smith!');
    });

    it('converts multiple mentions to display format', () => {
      const content = '@[Alice](id1) and @[Bob](id2) please check';
      const result = getMentionDisplayText(content);

      expect(result).toBe('@Alice and @Bob please check');
    });

    it('returns unchanged text when no mentions', () => {
      const content = 'Hello world';
      const result = getMentionDisplayText(content);

      expect(result).toBe('Hello world');
    });

    it('handles empty string', () => {
      const result = getMentionDisplayText('');
      expect(result).toBe('');
    });
  });

  describe('hasMentions', () => {
    it('returns true when content has mentions', () => {
      expect(hasMentions('Hey @[John](id1)!')).toBe(true);
    });

    it('returns false when content has no mentions', () => {
      expect(hasMentions('Hello world')).toBe(false);
    });

    it('returns false for incomplete mention syntax', () => {
      expect(hasMentions('Hey @john')).toBe(false);
      expect(hasMentions('Hey @[john]')).toBe(false);
      expect(hasMentions('Hey (id1)')).toBe(false);
    });

    it('returns true for multiple mentions', () => {
      expect(hasMentions('@[A](1) @[B](2)')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(hasMentions('')).toBe(false);
    });
  });
});
