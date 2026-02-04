import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  isValidEmail,
  isValidUsername,
  isValidPassword,
  isAdminUsername,
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
      username: 'testuser',
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
      expect(verified?.username).toBe(payload.username);
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
    it('should accept any non-empty passwords', () => {
      expect(isValidPassword('password123').valid).toBe(true);
      expect(isValidPassword('123456').valid).toBe(true);
      expect(isValidPassword('abc').valid).toBe(true);
      expect(isValidPassword('1').valid).toBe(true);
    });

    it('should reject empty passwords', () => {
      const result = isValidPassword('');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不能为空');
    });
  });

  describe('Admin Email Check', () => {
    it('should identify admin username', () => {
      expect(isAdminUsername('admin')).toBe(true);
      expect(isAdminUsername('ADMIN')).toBe(true);
    });

    it('should reject non-admin username', () => {
      expect(isAdminUsername('user')).toBe(false);
    });
  });

  describe('Username Validation', () => {
    it('should accept valid usernames', () => {
      expect(isValidUsername('user123')).toBe(true);
      expect(isValidUsername('test_user')).toBe(true);
      expect(isValidUsername('abc')).toBe(true);
    });

    it('should reject invalid usernames', () => {
      expect(isValidUsername('ab')).toBe(false); // too short
      expect(isValidUsername('a'.repeat(21))).toBe(false); // too long
      expect(isValidUsername('user@name')).toBe(false); // special char
      expect(isValidUsername('user name')).toBe(false); // space
    });
  });
});
