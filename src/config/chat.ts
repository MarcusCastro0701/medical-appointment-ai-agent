const raw = process.env.MAX_CHAT_MESSAGES;
const parsed = raw ? Number(raw) : 20;

if (!Number.isInteger(parsed) || parsed <= 0) {
  throw new Error('MAX_CHAT_MESSAGES must be a positive integer');
}

export const maxChatMessages = parsed;
