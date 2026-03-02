import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for extension build');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key: string) =>
        new Promise((resolve) => {
          chrome.storage.local.get(key, (result) => resolve(result[key] ?? null));
        }),
      setItem: (key: string, value: string) =>
        new Promise<void>((resolve) => {
          chrome.storage.local.set({ [key]: value }, () => resolve());
        }),
      removeItem: (key: string) =>
        new Promise<void>((resolve) => {
          chrome.storage.local.remove(key, () => resolve());
        }),
    },
  },
});
