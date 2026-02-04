/**
 * 测试公司验证服务
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { companyValidationService } from '../src/services/validation/CompanyValidationService';
import { searxngService } from '../src/services/search/SearXNGService';

async function testCompanyValidation(companyName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试公司: ${companyName}`);
  console.log('='.repeat(60));

  // 先测试原始搜索
  console.log('\n【搜索测试】');
  const searchQuery = `${companyName} 公司`;
  console.log(`搜索词: "${searchQuery}"`);

  const results = await searxngService.search(searchQuery, 10);
  console.log(`搜索结果数量: ${results.length}`);

  if (results.length > 0) {
    console.log('\n前5个结果:');
    results.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.title}`);
      console.log(`     URL: ${r.url}`);
      console.log(`     内容: ${r.content.substring(0, 100)}...`);
    });
  }

  // 测试验证服务
  console.log('\n【验证结果】');
  const validation = await companyValidationService.validateCompany(companyName);
  console.log(`有效: ${validation.isValid}`);
  console.log(`置信度: ${validation.confidence}`);
  console.log(`消息: ${validation.message}`);
  if (validation.details) {
    console.log(`搜索结果数: ${validation.details.searchResultCount}`);
    console.log(`匹配结果: ${validation.details.matchedResults.join(', ')}`);
  }

  return validation;
}

async function main() {
  // 测试多个公司名
  const testCases = [
    'databricks',
    'Databricks',
    '字节跳动',
    'ByteDance',
    'OpenAI',
    '不存在的公司名abc123xyz',
  ];

  for (const company of testCases) {
    await testCompanyValidation(company);
  }
}

main().catch(console.error);
