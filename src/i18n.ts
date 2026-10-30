import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { pt } from './i18n/pt';
import { vi } from './i18n/vi';

/**
 * Languages of the app. The English text in the code is the source; each other language is a dictionary from that
 * text to the translation (missing entries show in English). The choice is kept on the phone.
 */
export const LANGUAGES = { vi: 'Tiếng Việt', en: 'English', pt: 'Português' } as const;
export type Language = keyof typeof LANGUAGES;

const DICTIONARIES: Record<Language, Record<string, string>> = { en: {}, vi, pt };
const STORAGE_KEY = 'edm.language';
const isLanguage = (v: unknown): v is Language => typeof v === 'string' && v in LANGUAGES;

function initial(): Language {
  try {
    const saved = SecureStore.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // Not saved yet: the phone's language decides.
  }
  const phone = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2);
  return isLanguage(phone) ? phone : 'en';
}

let current: Language = initial();
const listeners = new Set<() => void>();

export function language(): Language {
  return current;
}

export function setLanguage(next: Language): void {
  try {
    SecureStore.setItem(STORAGE_KEY, next);
  } catch {
    // Kept until the app closes.
  }
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

/** Re-renders when the language changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current
  );
}

/** The text in the current language; {name} parts are filled from vars. */
export function t(text: string, vars?: Record<string, unknown>): string {
  const s = DICTIONARIES[current][text] ?? text;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Locale for dates and numbers in the current language. */
export function locale(): string {
  return current === 'vi' ? 'vi-VN' : current === 'pt' ? 'pt-MZ' : 'en-GB';
}

/**
 * Titles the server writes in English ("New connection, contract 88213", "Survey for new shop") in the current
 * language; other titles are looked up as they are.
 */
export function ticketTitle(title: string): string {
  const survey = /^Survey for new (\w+)$/.exec(title);
  if (survey) return t('Survey for new {premises}', { premises: t(survey[1]!) });
  const connection = /^New connection, contract (.+)$/.exec(title);
  if (connection) return t('New connection, contract {n}', { n: connection[1] });
  return t(title);
}
