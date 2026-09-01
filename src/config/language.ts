export type AppLanguage = 'pt-BR' | 'en';

const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  'pt-BR': 'Portuguese',
  en: 'English',
};

const raw = process.env.APP_LANGUAGE;

if (raw && !(raw in LANGUAGE_NAMES)) {
  throw new Error('APP_LANGUAGE must be either "pt-BR" or "en"');
}

export const appLanguage: AppLanguage = (raw as AppLanguage) ?? 'pt-BR';
export const preferredLanguage = LANGUAGE_NAMES[appLanguage];
