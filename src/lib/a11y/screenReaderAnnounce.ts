/**
 * Screen Reader Announcement Utility
 *
 * Provides a way to announce messages to screen reader users without
 * disrupting the visual interface. Uses a visually hidden live region.
 */

let announceElement: HTMLElement | null = null;

/**
 * Gets or creates the visually hidden live region for announcements.
 */
function getAnnounceElement(): HTMLElement {
  if (announceElement && document.body.contains(announceElement)) {
    return announceElement;
  }

  // Create a new element
  announceElement = document.createElement('div');
  announceElement.setAttribute('role', 'status');
  announceElement.setAttribute('aria-live', 'polite');
  announceElement.setAttribute('aria-atomic', 'true');
  // Visually hidden but accessible to screen readers
  announceElement.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `;
  announceElement.id = 'screen-reader-announce';
  document.body.appendChild(announceElement);

  return announceElement;
}

/**
 * Announces a message to screen reader users.
 *
 * @param message - The message to announce
 * @param priority - 'polite' (default) or 'assertive' for urgent messages
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void {
  if (typeof document === 'undefined') return;

  const element = getAnnounceElement();
  element.setAttribute('aria-live', priority);

  // Clear and set the message (triggers announcement)
  element.textContent = '';
  // Small delay to ensure screen readers pick up the change
  requestAnimationFrame(() => {
    element.textContent = message;
  });
}

/**
 * Announces mention navigation to screen readers.
 *
 * @param currentIndex - Current mention index (0-based)
 * @param total - Total number of mentions
 * @param senderName - Optional sender name
 */
export function announceMentionNavigation(
  currentIndex: number,
  total: number,
  senderName?: string
): void {
  const fromSender = senderName ? ` from ${senderName}` : '';
  const message = `Navigated to mention ${currentIndex + 1} of ${total}${fromSender}`;
  announceToScreenReader(message);
}
