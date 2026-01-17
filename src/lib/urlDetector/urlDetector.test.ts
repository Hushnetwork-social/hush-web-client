import { describe, it, expect } from 'vitest';
import {
  detectUrls,
  deduplicateUrls,
  normalizeUrl,
  hasUrls,
  extractUniqueUrls,
  type ParsedUrl,
} from './urlDetector';

describe('urlDetector', () => {
  describe('detectUrls', () => {
    it('should detect https URL', () => {
      const text = 'Check out https://example.com/article today';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/article');
      expect(result[0].startIndex).toBe(10);
      // URL is 27 chars: https://example.com/article
      expect(result[0].endIndex).toBe(37);
    });

    it('should detect http URL', () => {
      const text = 'Visit http://test.org for more';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('http://test.org');
    });

    it('should detect www URL without protocol', () => {
      const text = 'Visit www.example.com for more';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('www.example.com');
      expect(result[0].normalizedUrl).toBe('https://www.example.com');
    });

    it('should detect multiple URLs in order', () => {
      const text = 'First https://a.com then https://b.com and www.c.com';
      const result = detectUrls(text);

      expect(result).toHaveLength(3);
      expect(result[0].url).toBe('https://a.com');
      expect(result[1].url).toBe('https://b.com');
      expect(result[2].url).toBe('www.c.com');
    });

    it('should return empty array when no URLs found', () => {
      const text = 'Hello, no links here!';
      const result = detectUrls(text);

      expect(result).toHaveLength(0);
    });

    it('should not detect bare domain without protocol or www', () => {
      const text = 'Check example.com today';
      const result = detectUrls(text);

      expect(result).toHaveLength(0);
    });

    it('should detect URL with path and query params', () => {
      const text = 'Link: https://example.com/path?query=1&other=2';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/path?query=1&other=2');
    });

    it('should detect URL with fragment', () => {
      const text = 'See https://example.com/page#section';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/page#section');
    });

    it('should not include trailing period', () => {
      const text = 'Visit https://example.com.';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com');
      expect(result[0].endIndex).toBe(25);
    });

    it('should not include trailing comma', () => {
      const text = 'See https://example.com, and more';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com');
    });

    it('should not include trailing exclamation mark', () => {
      const text = 'Amazing site https://example.com!';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com');
    });

    it('should handle URL at the start of text', () => {
      const text = 'https://example.com is great';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].startIndex).toBe(0);
    });

    it('should handle URL at the end of text', () => {
      const text = 'Check https://example.com';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].endIndex).toBe(25);
    });

    it('should detect multiple URLs with same domain but different paths', () => {
      const text = 'https://a.com/1 and https://a.com/2';
      const result = detectUrls(text);

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://a.com/1');
      expect(result[1].url).toBe('https://a.com/2');
    });

    it('should handle URL with port number', () => {
      // Note: localhost is not matched as it has no TLD
      // Test with a real domain that has a port
      const text = 'Server at https://api.example.com:8080/endpoint';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://api.example.com:8080/endpoint');
    });

    it('should handle URL with subdomain', () => {
      const text = 'Visit https://blog.example.com';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://blog.example.com');
    });

    it('should handle parentheses in URL correctly', () => {
      const text = 'Wikipedia https://en.wikipedia.org/wiki/URL_(disambiguation)';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://en.wikipedia.org/wiki/URL_(disambiguation)');
    });

    it('should not include unbalanced closing parenthesis', () => {
      const text = '(see https://example.com)';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com');
    });

    it('should handle URL with encoded characters', () => {
      const text = 'Search https://example.com/search?q=hello%20world';
      const result = detectUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://example.com/search?q=hello%20world');
    });
  });

  describe('normalizeUrl', () => {
    it('should lowercase domain but preserve path case', () => {
      const result = normalizeUrl('https://EXAMPLE.COM/Path');
      expect(result).toBe('https://example.com/Path');
    });

    it('should preserve case-sensitive query parameters like YouTube video IDs', () => {
      const result = normalizeUrl('https://www.youtube.com/watch?v=ABCdef123XYZ');
      expect(result).toBe('https://www.youtube.com/watch?v=ABCdef123XYZ');
    });

    it('should remove trailing slash', () => {
      const result = normalizeUrl('https://example.com/');
      expect(result).toBe('https://example.com');
    });

    it('should remove multiple trailing slashes', () => {
      const result = normalizeUrl('https://example.com///');
      expect(result).toBe('https://example.com');
    });

    it('should add https:// to www URLs', () => {
      const result = normalizeUrl('www.example.com');
      expect(result).toBe('https://www.example.com');
    });

    it('should not modify already normalized URL', () => {
      const result = normalizeUrl('https://example.com/page');
      expect(result).toBe('https://example.com/page');
    });
  });

  describe('deduplicateUrls', () => {
    it('should remove duplicate URLs', () => {
      const urls: ParsedUrl[] = [
        { url: 'https://Example.com', normalizedUrl: 'https://example.com', startIndex: 0, endIndex: 20, raw: 'https://Example.com' },
        { url: 'https://example.com/', normalizedUrl: 'https://example.com', startIndex: 30, endIndex: 51, raw: 'https://example.com/' },
      ];

      const result = deduplicateUrls(urls);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://Example.com');
    });

    it('should keep different URLs', () => {
      const urls: ParsedUrl[] = [
        { url: 'https://a.com', normalizedUrl: 'https://a.com', startIndex: 0, endIndex: 13, raw: 'https://a.com' },
        { url: 'https://b.com', normalizedUrl: 'https://b.com', startIndex: 20, endIndex: 33, raw: 'https://b.com' },
      ];

      const result = deduplicateUrls(urls);
      expect(result).toHaveLength(2);
    });

    it('should keep first occurrence when duplicates exist', () => {
      const urls: ParsedUrl[] = [
        { url: 'https://example.com', normalizedUrl: 'https://example.com', startIndex: 0, endIndex: 19, raw: 'https://example.com' },
        { url: 'https://other.com', normalizedUrl: 'https://other.com', startIndex: 25, endIndex: 42, raw: 'https://other.com' },
        { url: 'https://Example.com/', normalizedUrl: 'https://example.com', startIndex: 50, endIndex: 71, raw: 'https://Example.com/' },
      ];

      const result = deduplicateUrls(urls);
      expect(result).toHaveLength(2);
      expect(result[0].startIndex).toBe(0);
      expect(result[1].normalizedUrl).toBe('https://other.com');
    });

    it('should return empty array for empty input', () => {
      const result = deduplicateUrls([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('hasUrls', () => {
    it('should return true when URL present', () => {
      expect(hasUrls('Check https://example.com')).toBe(true);
    });

    it('should return false when no URL present', () => {
      expect(hasUrls('No links here')).toBe(false);
    });

    it('should return true for www URL', () => {
      expect(hasUrls('Visit www.example.com')).toBe(true);
    });

    it('should return false for bare domain', () => {
      expect(hasUrls('Check example.com')).toBe(false);
    });
  });

  describe('extractUniqueUrls', () => {
    it('should return unique normalized URLs', () => {
      const text = 'Visit https://a.com and https://b.com and https://a.com/';
      const result = extractUniqueUrls(text);

      expect(result).toHaveLength(2);
      expect(result).toContain('https://a.com');
      expect(result).toContain('https://b.com');
    });

    it('should return empty array when no URLs', () => {
      const result = extractUniqueUrls('No links here');
      expect(result).toHaveLength(0);
    });

    it('should normalize www URLs', () => {
      const text = 'Visit www.example.com';
      const result = extractUniqueUrls(text);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('https://www.example.com');
    });
  });
});
