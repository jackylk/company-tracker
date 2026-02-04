import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface CuratedSourceData {
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  category: string;
  description?: string;
  region?: string;
}

// 测试用户配置
const TEST_USERS = [
  {
    email: '1@test.com',
    password: 'test',
    isAdmin: true, // 设为管理员方便调试
  },
];

async function createTestUsers() {
  console.log('创建测试用户...');

  for (const user of TEST_USERS) {
    const existingUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existingUser) {
      console.log(`用户 ${user.email} 已存在，跳过`);
      continue;
    }

    const passwordHash = await bcrypt.hash(user.password, 12);

    await prisma.user.create({
      data: {
        email: user.email,
        passwordHash,
        isAdmin: user.isAdmin,
      },
    });

    console.log(`已创建用户: ${user.email}`);
  }
}

async function importCuratedSources() {
  console.log('开始导入内置信息源...');

  // 读取内置信息源文件
  const sourcePath = path.join(__dirname, '../data/curated-sources.json');

  // 如果本地没有，尝试从 news-agent 复制
  let sourceData: CuratedSourceData[];

  if (fs.existsSync(sourcePath)) {
    const fileContent = fs.readFileSync(sourcePath, 'utf-8');
    sourceData = JSON.parse(fileContent);
  } else {
    // 尝试从 news-agent 项目读取
    const newsAgentPath = '/Users/jacky/code/news-agent/server/data/curated-sources.json';
    if (fs.existsSync(newsAgentPath)) {
      const fileContent = fs.readFileSync(newsAgentPath, 'utf-8');
      sourceData = JSON.parse(fileContent);

      // 确保目录存在并复制文件
      const dataDir = path.dirname(sourcePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.copyFileSync(newsAgentPath, sourcePath);
      console.log('已从 news-agent 复制信息源文件');
    } else {
      console.log('未找到内置信息源文件，跳过导入');
      return;
    }
  }

  // 清空现有数据
  await prisma.curatedSource.deleteMany();
  console.log('已清空现有内置信息源');

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
    });

    imported += batch.length;
    console.log(`已导入 ${imported}/${sourceData.length} 条记录`);
  }

  console.log(`内置信息源导入完成，共 ${imported} 条`);
}

async function main() {
  // 创建测试用户
  await createTestUsers();

  // 导入内置信息源
  await importCuratedSources();
}

main()
  .catch((e) => {
    console.error('Seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
