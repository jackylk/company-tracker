import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import type { JWTPayload } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const TOKEN_EXPIRY = '7d';
const SALT_ROUNDS = 12;

// 密码加密
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// 密码验证
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 生成JWT Token
export function generateToken(payload: Omit<JWTPayload, 'exp' | 'iat'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// 验证JWT Token
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// 从请求头获取Token
export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

// 从Cookie获取Token（用于服务端组件）
export async function getTokenFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('token');
    return tokenCookie?.value || null;
  } catch {
    return null;
  }
}

// 获取当前用户信息（从Cookie或Header）
export async function getCurrentUser(request?: Request): Promise<JWTPayload | null> {
  let token: string | null = null;

  if (request) {
    // 优先从Header获取
    token = getTokenFromHeader(request.headers.get('Authorization'));
  }

  // 如果Header没有，尝试从Cookie获取
  if (!token) {
    token = await getTokenFromCookie();
  }

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

// 检查是否为管理员用户名
export function isAdminUsername(username: string): boolean {
  const adminUsernames = process.env.ADMIN_USERNAMES?.split(',').map((u) => u.trim().toLowerCase()) || ['admin'];
  return adminUsernames.includes(username.toLowerCase());
}

// 验证用户名格式（3-20个字符，字母、数字、下划线）
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

// 验证邮箱格式
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 验证密码强度
export function isValidPassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 1) {
    return { valid: false, message: '密码不能为空' };
  }
  return { valid: true };
}
