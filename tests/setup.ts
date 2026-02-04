// Jest setup file
import '@testing-library/jest-dom';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ADMIN_USERNAMES = 'admin';
