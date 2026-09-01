import { appLanguage, type AppLanguage } from '../../config/index.ts';

const PATTERNS_BY_LANGUAGE: Record<AppLanguage, { yes: RegExp; no: RegExp }> = {
  'pt-BR': {
    yes: /^(sim|s|ok(ay)?|confirmo|confirmar|isso mesmo|isso a[íi]|isso|pode confirmar|beleza|claro|com certeza|manda ver|pode ser)\b/i,
    no: /^(n[ãa]o|n|nunca|negativo|deixa (pra|para) l[áa]|esquece|cancela isso)\b/i,
  },
  en: {
    yes: /^(yes|y|ok(ay)?|confirm|confirmed|that'?s right|sounds good|go ahead|sure|absolutely|do it)\b/i,
    no: /^(no|n|never|nope|forget it|never ?mind|cancel that)\b/i,
  },
};

const { yes: CONFIRM_YES_PATTERN, no: CONFIRM_NO_PATTERN } = PATTERNS_BY_LANGUAGE[appLanguage];

// deterministic yes/no check; unmatched messages fall back to the LLM's semantic judgment
export function detectExplicitConfirmation(message: string): boolean | undefined {
  const normalized = message.trim().toLowerCase();
  if (CONFIRM_YES_PATTERN.test(normalized)) return true;
  if (CONFIRM_NO_PATTERN.test(normalized)) return false;
  return undefined;
}
