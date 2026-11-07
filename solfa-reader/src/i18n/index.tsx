// Translations (I-02): typed dictionaries, `t()` with {placeholders}, plural pairs, provider.
// Malagasy is bundled (default language); English and French are loaded on demand so the first
// visit downloads only one dictionary.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { MessageKey, Messages } from './en';
import { mg } from './mg';

export type { MessageKey, Messages } from './en';

export type Lang = 'mg' | 'en' | 'fr';
export const LANGS: readonly Lang[] = ['mg', 'en', 'fr'];
export const DEFAULT_LANG: Lang = 'mg';

export type Params = Readonly<Record<string, string | number>>;

type BaseOf<K> = K extends `${infer B}_one` ? (`${B}_other` extends MessageKey ? B : never) : never;
/** Keys that come as `<base>_one` / `<base>_other` pairs. */
export type PluralBase = BaseOf<MessageKey>;

export type TFunction = (key: MessageKey, params?: Params) => string;
export type TPluralFunction = (base: PluralBase, count: number, params?: Params) => string;

/** Replace `{name}` placeholders; unknown placeholders are left visible (easy to spot). */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = params[name];
    return v === undefined ? whole : String(v);
  });
}

/** Is a string a known translation key? (for codes coming from other modules) */
export function isMessageKey(dict: Messages, key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(dict, key);
}

const pluralRulesCache = new Map<Lang, Intl.PluralRules>();
function pluralCategory(lang: Lang, count: number): 'one' | 'other' {
  let rules = pluralRulesCache.get(lang);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(lang);
    } catch {
      rules = new Intl.PluralRules('en');
    }
    pluralRulesCache.set(lang, rules);
  }
  return rules.select(count) === 'one' ? 'one' : 'other';
}

export interface I18n {
  lang: Lang;
  messages: Messages;
  t: TFunction;
  tp: TPluralFunction;
}

/** Build the translation functions for one language. */
export function createI18n(lang: Lang, messages: Messages): I18n {
  const t: TFunction = (key, params) => interpolate(messages[key] ?? key, params);
  const tp: TPluralFunction = (base, count, params) => {
    const key = `${base}_${pluralCategory(lang, count)}` as MessageKey;
    return t(key, { count, ...params });
  };
  return { lang, messages, t, tp };
}

/** The dictionary of a language (Malagasy is already loaded; others are fetched once). */
export async function loadMessages(lang: Lang): Promise<Messages> {
  if (lang === 'en') return (await import('./en')).en;
  if (lang === 'fr') return (await import('./fr')).fr;
  return mg;
}

/** True when the value is one of the supported languages. */
export function isLang(v: unknown): v is Lang {
  return v === 'mg' || v === 'en' || v === 'fr';
}

const I18nContext = createContext<I18n>(createI18n(DEFAULT_LANG, mg));

/** Provides `t()` for the given language to the whole tree. */
export function I18nProvider({ lang, messages, children }: { lang: Lang; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => createI18n(lang, messages), [lang, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Current language + `t()` / `tp()`. */
export function useI18n(): I18n {
  return useContext(I18nContext);
}

/** Shortcut for `useI18n().t`. */
export function useT(): TFunction {
  return useContext(I18nContext).t;
}
