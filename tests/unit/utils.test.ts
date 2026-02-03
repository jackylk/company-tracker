import {
  formatDate,
  timeAgo,
  truncate,
  stripHtml,
  extractSummary,
  isValidUrl,
  normalizeUrl,
  getDomain,
  getStepName,
  STEP_NAMES,
} from '@/lib/utils';

describe('Utils', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2025-06-15');
      const formatted = formatDate(date);
      expect(formatted).toContain('2025');
      expect(formatted).toContain('6');
      expect(formatted).toContain('15');
    });

    it('should handle null/undefined', () => {
      expect(formatDate(null)).toBe('');
      expect(formatDate(undefined)).toBe('');
    });
  });

  describe('timeAgo', () => {
    it('should return "刚刚" for recent times', () => {
      const now = new Date();
      expect(timeAgo(now)).toBe('刚刚');
    });

    it('should return minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(timeAgo(fiveMinutesAgo)).toContain('分钟前');
    });

    it('should return hours ago', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(timeAgo(threeHoursAgo)).toContain('小时前');
    });
  });

  describe('truncate', () => {
    it('should truncate long text', () => {
      const text = 'This is a very long text that should be truncated';
      const result = truncate(text, 20);
      expect(result.length).toBe(23); // 20 + '...'
      expect(result.endsWith('...')).toBe(true);
    });

    it('should not truncate short text', () => {
      const text = 'Short';
      const result = truncate(text, 20);
      expect(result).toBe(text);
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      const html = '<p>Hello <strong>World</strong></p>';
      expect(stripHtml(html)).toBe('Hello World');
    });

    it('should handle empty string', () => {
      expect(stripHtml('')).toBe('');
    });
  });

  describe('extractSummary', () => {
    it('should extract summary from content', () => {
      const content = '<p>This is some content with <strong>HTML</strong> tags.</p>';
      const summary = extractSummary(content, 20);
      expect(summary.length).toBeLessThanOrEqual(23);
    });
  });

  describe('URL Utils', () => {
    it('should validate URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('invalid')).toBe(false);
    });

    it('should normalize URLs', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com/');
      expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
    });

    it('should extract domain', () => {
      expect(getDomain('https://www.example.com/path')).toBe('www.example.com');
      expect(getDomain('https://example.com')).toBe('example.com');
    });
  });

  describe('Step Names', () => {
    it('should return correct step names', () => {
      expect(getStepName(1)).toBe('添加公司');
      expect(getStepName(2)).toBe('确认信息源');
      expect(getStepName(3)).toBe('采集信息');
      expect(getStepName(4)).toBe('生成报告');
    });

    it('should handle unknown steps', () => {
      expect(getStepName(5)).toBe('步骤5');
    });

    it('should have all steps defined', () => {
      expect(Object.keys(STEP_NAMES).length).toBe(4);
    });
  });
});
