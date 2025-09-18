import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

type GlobalSupabase = typeof globalThis & {
  __supabaseClient?: SupabaseClient | null;
  __supabaseAdminClient?: SupabaseClient | null;
};

const globalSupabase = globalThis as GlobalSupabase;

const createSupabaseClient = (key: string): SupabaseClient => {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const getOrCreateClient = (key: string | undefined, cacheKey: '__supabaseClient' | '__supabaseAdminClient') => {
  if (!key) {
    return null;
  }

  if (!globalSupabase[cacheKey]) {
    try {
      globalSupabase[cacheKey] = createSupabaseClient(key);
    } catch (error) {
      logger.error('Failed to initialise Supabase client', {
        error: error instanceof Error ? error.message : error,
      });
      globalSupabase[cacheKey] = null;
    }
  }

  return globalSupabase[cacheKey] ?? null;
};

export const getSupabaseClient = (): SupabaseClient | null => {
  return getOrCreateClient(process.env.SUPABASE_ANON_KEY, '__supabaseClient');
};

export const getSupabaseAdminClient = (): SupabaseClient | null => {
  return getOrCreateClient(process.env.SUPABASE_SERVICE_ROLE_KEY, '__supabaseAdminClient');
};

export const isSupabaseConfigured = (): boolean => {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
};

export const resetSupabaseClientsForTesting = () => {
  if ('__supabaseClient' in globalSupabase) {
    globalSupabase.__supabaseClient = null;
  }

  if ('__supabaseAdminClient' in globalSupabase) {
    globalSupabase.__supabaseAdminClient = null;
  }
};
