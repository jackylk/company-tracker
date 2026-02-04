import { searxngService } from '@/services/search/SearXNGService';

export interface CompanyValidationResult {
  isValid: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  message: string;
  details?: {
    searchResultCount: number;
    matchedResults: string[];
  };
}

// 公司相关关键词，用于判断搜索结果是否与公司相关
const COMPANY_KEYWORDS = [
  '公司', '企业', '集团', '科技', '有限', '股份',
  'company', 'inc', 'corp', 'ltd', 'limited', 'group', 'co.',
  '官网', '官方', 'official',
  'ceo', '创始人', 'founder', '董事长',
  '股票', '上市', 'ipo', 'stock', 'nasdaq', 'nyse',
  '融资', '投资', 'funding', 'investment', 'venture',
  'platform', 'software', 'technology', 'ai', 'cloud',
];

// 判断公司名是否主要是英文
const isEnglishName = (name: string): boolean => {
  const englishChars = name.match(/[a-zA-Z]/g) || [];
  return englishChars.length > name.length / 2;
};

export class CompanyValidationService {
  /**
   * 验证公司名称是否真实存在
   * 通过搜索引擎搜索公司名，分析结果判断公司是否存在
   */
  async validateCompany(companyName: string): Promise<CompanyValidationResult> {
    if (!companyName || companyName.trim().length === 0) {
      return {
        isValid: false,
        confidence: 'none',
        message: '公司名称不能为空',
      };
    }

    const trimmedName = companyName.trim();

    // 公司名称太短可能不是有效的公司名
    if (trimmedName.length < 2) {
      return {
        isValid: false,
        confidence: 'none',
        message: '公司名称太短，请输入完整的公司名称',
      };
    }

    try {
      // 根据公司名是中文还是英文，使用不同的搜索词
      const isEnglish = isEnglishName(trimmedName);
      const searchQuery = isEnglish
        ? `${trimmedName} company`
        : `${trimmedName} 公司`;

      const results = await searxngService.search(searchQuery, 10);

      if (results.length === 0) {
        // 搜索无结果，可能是搜索服务问题，允许用户继续
        return {
          isValid: true,
          confidence: 'low',
          message: `无法在线验证"${trimmedName}"，但您可以继续操作`,
          details: {
            searchResultCount: 0,
            matchedResults: [],
          },
        };
      }

      // 分析搜索结果
      const matchedResults: string[] = [];
      let companyRelatedCount = 0;

      for (const result of results) {
        const combinedText = `${result.title} ${result.content}`.toLowerCase();
        const nameInText = combinedText.includes(trimmedName.toLowerCase());
        const hasCompanyKeyword = COMPANY_KEYWORDS.some(keyword =>
          combinedText.includes(keyword.toLowerCase())
        );

        if (nameInText && hasCompanyKeyword) {
          companyRelatedCount++;
          matchedResults.push(result.title);
        }
      }

      // 根据匹配数量判断置信度
      let confidence: 'high' | 'medium' | 'low' | 'none';
      let isValid: boolean;
      let message: string;

      if (companyRelatedCount >= 3) {
        confidence = 'high';
        isValid = true;
        message = `已验证"${trimmedName}"是一个存在的公司`;
      } else if (companyRelatedCount >= 1) {
        confidence = 'medium';
        isValid = true;
        message = `找到了与"${trimmedName}"相关的公司信息`;
      } else if (results.length > 0) {
        // 有搜索结果但没匹配到公司关键词，仍允许继续
        confidence = 'low';
        isValid = true;
        message = `找到了"${trimmedName}"的相关信息，您可以继续操作`;
      } else {
        confidence = 'none';
        isValid = true;
        message = `无法确认"${trimmedName}"的信息，但您可以继续操作`;
      }

      return {
        isValid,
        confidence,
        message,
        details: {
          searchResultCount: results.length,
          matchedResults: matchedResults.slice(0, 5),
        },
      };
    } catch (error) {
      console.error('公司验证失败:', error);
      // 搜索失败时，返回一个允许继续的结果，但标记为低置信度
      return {
        isValid: true,
        confidence: 'low',
        message: '无法在线验证公司信息，但您可以继续操作',
      };
    }
  }
}

export const companyValidationService = new CompanyValidationService();
