import type { User as SupabaseUser } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';
import { getSupabaseAdminClient, isSupabaseConfigured } from '../lib/supabase';
import { authService, AuthTokens, AuthUser } from './authService';

export type SupabaseAuthStatus = {
  enabled: boolean;
  configured: boolean;
  projectUrl: string | null;
};

export type SupabaseAuthResult = {
  user: AuthUser;
  tokens: AuthTokens;
  supabaseUserId: string;
  email: string;
};

export class SupabaseAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'SupabaseAuthError';
  }
}

class SupabaseAuthService {
  private readonly SALT_ROUNDS = 12;

  isEnabled(): boolean {
    return process.env.SUPABASE_AUTH_ENABLED === 'true';
  }

  getStatus(): SupabaseAuthStatus {
    const enabled = this.isEnabled();
    const configured = enabled && isSupabaseConfigured();

    return {
      enabled,
      configured,
      projectUrl: enabled ? process.env.SUPABASE_URL ?? null : null,
    };
  }

  async exchangeSupabaseToken(accessToken: string): Promise<SupabaseAuthResult> {
    if (!this.isEnabled()) {
      throw new SupabaseAuthError(
        'SUPABASE_DISABLED',
        'Supabase authentication integration is not enabled',
        503
      );
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      throw new SupabaseAuthError(
        'SUPABASE_NOT_CONFIGURED',
        'Supabase credentials are not configured',
        503
      );
    }

    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data?.user) {
      logger.warn('Supabase token verification failed', {
        error: error?.message ?? error,
      });
      throw new SupabaseAuthError(
        'SUPABASE_TOKEN_INVALID',
        'Supabase access token could not be verified',
        401
      );
    }

    const supabaseUser = data.user;
    const email = supabaseUser.email?.toLowerCase();

    if (!email) {
      throw new SupabaseAuthError(
        'SUPABASE_USER_MISSING_EMAIL',
        'Supabase user does not have an email address',
        400
      );
    }

    const prismaUser = await this.syncSupabaseUser(supabaseUser, email);

    const authUser: AuthUser = {
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name,
    };

    const tokens = authService.issueTokensForUser(authUser);

    return {
      user: authUser,
      tokens,
      supabaseUserId: supabaseUser.id,
      email,
    };
  }

  private resolveDisplayName(
    supabaseUser: SupabaseUser,
    currentName?: string | null
  ): string {
    const metadata = supabaseUser.user_metadata ?? {};
    const metadataName =
      metadata.full_name || metadata.name || metadata.preferred_username;

    if (typeof metadataName === 'string' && metadataName.trim().length > 0) {
      return metadataName.trim();
    }

    if (currentName && currentName.trim().length > 0) {
      return currentName;
    }

    const email = supabaseUser.email ?? '';
    return email.split('@')[0] || 'Supabase User';
  }

  private async syncSupabaseUser(
    supabaseUser: SupabaseUser,
    email: string
  ) {
    try {
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { supabaseId: supabaseUser.id },
            { email },
          ],
        },
      });

      const displayName = this.resolveDisplayName(supabaseUser, user?.name);

      if (!user) {
        const passwordSeed = `supabase:${supabaseUser.id}:${email}`;
        const hashedPassword = await bcrypt.hash(passwordSeed, this.SALT_ROUNDS);

        user = await prisma.user.create({
          data: {
            email,
            name: displayName,
            password: hashedPassword,
            supabaseId: supabaseUser.id,
          },
        });

        logger.info('Created local user from Supabase identity', {
          supabaseId: supabaseUser.id,
          email,
        });
      } else {
        const updates: { supabaseId?: string; name?: string } = {};

        if (!user.supabaseId) {
          updates.supabaseId = supabaseUser.id;
        }

        if (displayName && displayName !== user.name) {
          updates.name = displayName;
        }

        if (Object.keys(updates).length > 0) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: updates,
          });
        }
      }

      return user;
    } catch (error) {
      logger.error('Failed to synchronise Supabase user', {
        error: error instanceof Error ? error.message : error,
        supabaseUserId: supabaseUser.id,
      });

      throw new SupabaseAuthError(
        'SUPABASE_SYNC_FAILED',
        'Failed to synchronise Supabase user with FamSpace',
        500
      );
    }
  }
}

export const supabaseAuthService = new SupabaseAuthService();
