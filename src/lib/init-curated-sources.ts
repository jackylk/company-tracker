/**
 * 初始化内置信息源数据
 * 在应用启动时检查并导入数据
 */

import prisma from './db';
import * as fs from 'fs';
import * as path from 'path';

interface CuratedSourceData {
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  category: string;
  description?: string;
  region?: string;
}

let initialized = false;

export async function initCuratedSources(): Promise<void> {
  // 防止重复初始化
  if (initialized) {
    return;
  }

  try {
    // 检查是否已有数据
    const count = await prisma.curatedSource.count();
    if (count > 0) {
      console.log(`内置信息源已存在 ${count} 条记录，跳过初始化`);
      initialized = true;
      return;
    }

    console.log('开始初始化内置信息源...');

    // 尝试多个可能的路径
    const possiblePaths = [
      path.join(process.cwd(), 'data/curated-sources.json'),
      path.join(__dirname, '../../data/curated-sources.json'),
      '/app/data/curated-sources.json', // Docker/Railway 路径
    ];

    let sourceData: CuratedSourceData[] | null = null;
    let usedPath = '';

    for (const sourcePath of possiblePaths) {
      if (fs.existsSync(sourcePath)) {
        const fileContent = fs.readFileSync(sourcePath, 'utf-8');
        sourceData = JSON.parse(fileContent);
        usedPath = sourcePath;
        break;
      }
    }

    if (!sourceData) {
      console.log('未找到内置信息源文件，尝试的路径:', possiblePaths);
      initialized = true;
      return;
    }

    console.log(`从 ${usedPath} 加载了 ${sourceData.length} 条记录`);

    // 批量导入
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < sourceData.length; i += batchSize) {
      const batch = sourceData.slice(i, i + batchSize);

      await prisma.curatedSource.createMany({
        data: batch.map((item) => ({
          name: item.sourceName,
          url: item.sourceUrl,
          type: item.sourceType,
          category: item.category,
          description: item.description || null,
          region: item.region || null,
        })),
        skipDuplicates: true,
      });

      imported += batch.length;
    }

    console.log(`内置信息源初始化完成，共导入 ${imported} 条记录`);
    initialized = true;
  } catch (error) {
    console.error('初始化内置信息源失败:', error);
    // 不抛出错误，让应用继续运行
    initialized = true;
  }
}
