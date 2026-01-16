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
