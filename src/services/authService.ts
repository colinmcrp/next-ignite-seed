import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  private readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  private readonly SALT_ROUNDS = 12;

  async register(data: RegisterData): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { email, password, name } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });

    logger.info(`New user registered: ${email}`);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    const tokens = this.generateTokens(authUser);

    return { user: authUser, tokens };
  }

  async login(data: LoginData): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    logger.info(`User logged in: ${email}`);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    const tokens = this.generateTokens(authUser);

    return { user: authUser, tokens };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as any;
      
      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name
      };

      return this.generateTokens(authUser);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async verifyAccessToken(token: string): Promise<AuthUser> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      
      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name
      };
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  private generateTokens(user: AuthUser): AuthTokens {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.JWT_REFRESH_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
  }

  async getUserFams(userId: string): Promise<Array<{ famId: string; role: string; famName: string }>> {
    const memberships = await prisma.famMembership.findMany({
      where: { userId },
      include: {
        fam: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return memberships.map(membership => ({
      famId: membership.famId,
      role: membership.role,
      famName: membership.fam.name
    }));
  }
}

export const authService = new AuthService();