import type { SessionArgs, SessionSpec } from '../domain/types';
import type { Dict, SessionVariant } from './types';
import { en } from './en';
import { nl } from './nl';

export type Language = 'en' | 'nl';

export const DICTS: Record<Language, Dict> = { en, nl };

export const getDict = (lang: string): Dict => DICTS[lang as Language] ?? en;

export interface RenderedSession {
  title: string;
  pace: string;
  details: string;
  why: string;
  color: string;
}

const resolve = (field: SessionVariant[keyof SessionVariant], args: SessionArgs): string =>
  typeof field === 'function' ? field(args) : field;

/** Turns a domain SessionSpec into display strings in the chosen language. */
export function renderSession(spec: SessionSpec, dict: Dict): RenderedSession {
  const variant = dict.session[spec.variant as keyof Dict['session']] ?? dict.session.fallback;
  return {
    title: resolve(variant.title, spec.args),
    pace: resolve(variant.pace, spec.args),
    details: resolve(variant.details, spec.args),
    why: resolve(variant.why, spec.args),
    color: spec.color,
  };
}

export const EM_DASH = '\u2014';

export type { Dict };
