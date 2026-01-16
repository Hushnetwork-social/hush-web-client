// Mentions module exports

export {
  formatMention,
  parseMentions,
  detectMentionTrigger,
  replaceMentionTrigger,
  getMentionDisplayText,
  hasMentions,
  findMentionAtCursor,
  type ParsedMention,
  type MentionTriggerResult,
  type ReplaceMentionResult,
} from './mentionParser';

export { MentionText } from './MentionText';

export { MentionBadge } from './MentionBadge';

export { MentionNavButton } from './MentionNavButton';

export { useMessageHighlight } from './useMessageHighlight';

export {
  trackMention,
  markMentionRead,
  getUnreadMentions,
  getUnreadCount,
  hasUnreadMentions,
  clearMentions,
  getAllFeedsWithMentions,
  checkForDataLoss,
  clearDataLossFlag,
  type MentionTrackingEntry,
  type MentionTrackingData,
} from './mentionTracker';
