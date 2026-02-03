import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  isValidEmail,
  isValidPassword,
  isAdminEmail,
} from '@/lib/auth';

describe('Auth Utils', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('wrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT Token', () => {
    const payload = {
      userId: 'test-user-id',
      email: 'test@test.com',
      isAdmin: false,
    };

    it('should generate valid token', () => {
      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should verify valid token', () => {
      const token = generateToken(payload);
      const verified = verifyToken(token);

      expect(verified).toBeDefined();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
      expect(verified?.isAdmin).toBe(payload.isAdmin);
    });

    it('should reject invalid token', () => {
      const verified = verifyToken('invalid.token.here');
      expect(verified).toBeNull();
    });
  });

  describe('Email Validation', () => {
    it('should accept valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.org')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
    });
  });

  describe('Password Validation', () => {
    it('should accept valid passwords', () => {
      const result = isValidPassword('password123');
      expect(result.valid).toBe(true);
    });

    it('should reject short passwords', () => {
      const result = isValidPassword('pass1');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8');
    });

    it('should reject passwords without letters', () => {
      const result = isValidPassword('12345678');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('字母');
    });

    it('should reject passwords without numbers', () => {
      const result = isValidPassword('password');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('数字');
    });
  });

  describe('Admin Email Check', () => {
    it('should identify admin email', () => {
      expect(isAdminEmail('admin@test.com')).toBe(true);
      expect(isAdminEmail('ADMIN@TEST.COM')).toBe(true);
    });

    it('should reject non-admin email', () => {
      expect(isAdminEmail('user@test.com')).toBe(false);
    });
  });
});
