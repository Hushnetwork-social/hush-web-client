/**
 * Unit tests for screenReaderAnnounce utility
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { announceToScreenReader, announceMentionNavigation } from './screenReaderAnnounce';

describe('screenReaderAnnounce', () => {
  beforeEach(() => {
    // Clean up any existing announce elements
    const existing = document.getElementById('screen-reader-announce');
    if (existing) {
      existing.remove();
    }
  });

  afterEach(() => {
    // Clean up after tests
    const existing = document.getElementById('screen-reader-announce');
    if (existing) {
      existing.remove();
    }
  });

  describe('announceToScreenReader', () => {
    it('creates a live region element on first call', async () => {
      announceToScreenReader('Test message');

      // Wait for requestAnimationFrame
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const element = document.getElementById('screen-reader-announce');
      expect(element).not.toBeNull();
      expect(element?.getAttribute('role')).toBe('status');
      expect(element?.getAttribute('aria-live')).toBe('polite');
      expect(element?.getAttribute('aria-atomic')).toBe('true');
    });

    it('sets message content', async () => {
      announceToScreenReader('Hello screen reader');

      await new Promise((resolve) => requestAnimationFrame(resolve));

      const element = document.getElementById('screen-reader-announce');
      expect(element?.textContent).toBe('Hello screen reader');
    });

    it('supports assertive priority', async () => {
      announceToScreenReader('Urgent message', 'assertive');

      await new Promise((resolve) => requestAnimationFrame(resolve));

      const element = document.getElementById('screen-reader-announce');
      expect(element?.getAttribute('aria-live')).toBe('assertive');
    });

    it('reuses existing element on subsequent calls', async () => {
      announceToScreenReader('First message');
      await new Promise((resolve) => requestAnimationFrame(resolve));

      announceToScreenReader('Second message');
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Should only have one element
      const elements = document.querySelectorAll('#screen-reader-announce');
      expect(elements.length).toBe(1);
      expect(elements[0].textContent).toBe('Second message');
    });
  });

  describe('announceMentionNavigation', () => {
    it('announces navigation without sender name', async () => {
      announceMentionNavigation(0, 3);

      await new Promise((resolve) => requestAnimationFrame(resolve));

      const element = document.getElementById('screen-reader-announce');
      expect(element?.textContent).toBe('Navigated to mention 1 of 3');
    });

    it('announces navigation with sender name', async () => {
      announceMentionNavigation(1, 5, 'Alice');

      await new Promise((resolve) => requestAnimationFrame(resolve));

      const element = document.getElementById('screen-reader-announce');
      expect(element?.textContent).toBe('Navigated to mention 2 of 5 from Alice');
    });

    it('uses 1-based index in announcement', async () => {
      announceMentionNavigation(0, 10, 'Bob');

      await new Promise((resolve) => requestAnimationFrame(resolve));

      const element = document.getElementById('screen-reader-announce');
      expect(element?.textContent).toContain('mention 1 of 10');
    });
  });
});
