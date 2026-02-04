/**
 * 测试报告生成 - 实际调用 Deepseek API
 */

import { config } from 'dotenv';
config({ path: '.env' });

// 验证环境变量已加载
console.log('DEEPSEEK_API_KEY 已配置:', !!process.env.DEEPSEEK_API_KEY);

import { DeepseekService, DEFAULT_REPORT_TEMPLATE } from '../src/services/ai/DeepseekService';

// 创建新实例以确保读取到环境变量
const deepseekService = new DeepseekService();

// 模拟选中的文章
const mockArticles = [
  {
    id: 'article-1',
    title: '字节跳动发布最新AI战略规划',
    content: '字节跳动今日宣布了其AI战略的最新规划，将在人工智能领域投入更多资源，包括大模型研发、AI应用场景拓展等。公司表示将在未来三年投入100亿元用于AI研发，重点发展多模态大模型、智能推荐系统和AI辅助创作工具。',
    summary: '字节跳动AI战略规划，投入100亿研发',
    url: 'https://36kr.com/article/1',
  },
  {
    id: 'article-2',
    title: 'TikTok在欧洲市场快速增长',
    content: '字节跳动旗下TikTok在欧洲海外市场用户数突破1亿，成为欧洲最受欢迎的短视频平台。公司计划在欧洲建立数据中心以满足当地法规要求，同时加强与当地创作者的合作。',
    summary: 'TikTok欧洲用户破亿，建立数据中心',
    url: 'https://36kr.com/article/2',
  },
  {
    id: 'article-3',
    title: '抖音推出创作者激励计划',
    content: '字节跳动抖音平台推出新的短视频创作者激励计划，吸引更多优质内容创作者。计划包括流量扶持、现金奖励和培训支持等多项措施，预计将惠及超过100万创作者。',
    summary: '抖音创作者激励计划，多项扶持措施',
    url: 'https://36kr.com/article/3',
  },
];

const companyName = '字节跳动';
const focusPoints = 'AI战略、海外业务、短视频';

// 替换模板占位符
const template = DEFAULT_REPORT_TEMPLATE
  .replace('{公司名称}', companyName)
  .replace('{关注点}', focusPoints)
  .replace('{日期}', new Date().toLocaleDateString('zh-CN'))
  .replace('{来源数量}', String(mockArticles.length));

async function main() {
  console.log('='.repeat(60));
  console.log('测试报告生成');
  console.log('='.repeat(60));
  console.log('\n公司名称:', companyName);
  console.log('关注点:', focusPoints);
  console.log('文章数量:', mockArticles.length);
  console.log('\n');

  console.log('【使用的模板】');
  console.log('-'.repeat(40));
  console.log(template);
  console.log('-'.repeat(40));
  console.log('\n');

  console.log('正在调用 Deepseek 生成报告...\n');

  try {
    const startTime = Date.now();
    const report = await deepseekService.generateReport(
      mockArticles,
      companyName,
      focusPoints,
      template
    );
    const endTime = Date.now();

    console.log('='.repeat(60));
    console.log('【生成的报告】');
    console.log('='.repeat(60));
    console.log(report);
    console.log('='.repeat(60));
    console.log(`\n生成耗时: ${((endTime - startTime) / 1000).toFixed(2)} 秒`);
    console.log(`报告长度: ${report.length} 字符`);

    // 分析报告结构
    const h1Count = (report.match(/^#\s+[^#]/gm) || []).length;
    const h2Count = (report.match(/^##\s+[^#]/gm) || []).length;
    const h3Count = (report.match(/^###\s+[^#]/gm) || []).length;
    console.log(`报告结构: H1=${h1Count}, H2=${h2Count}, H3=${h3Count}`);

  } catch (error) {
    console.error('生成报告失败:', error);
  }
}

main();
