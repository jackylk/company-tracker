# 公司信息采集与调研报告系统 - 架构设计文档

> 版本: 1.0
> 日期: 2026-02-03
> 状态: 已确认

---

## 1. 系统架构概览

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              客户端层                                    │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐       │
│  │      桌面浏览器              │  │      移动端浏览器            │       │
│  └─────────────────────────────┘  └─────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Next.js 应用层                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         前端 (React)                              │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │   │
│  │  │ 登录页  │ │任务列表 │ │ 步骤页  │ │ 详情页  │ │ 管理页  │    │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                       API Routes (后端)                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │   │
│  │  │用户认证 │ │任务管理 │ │信息源   │ │文章采集 │ │报告生成 │    │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ PostgreSQL  │ │  SearXNG    │ │  Deepseek   │ │   爬虫服务   │
│   数据库    │ │  搜索引擎   │ │    API      │ │   Crawlers  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

### 1.2 技术栈详情

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端框架 | Next.js | 14.x | React SSR框架 |
| UI组件 | Tailwind CSS | 3.x | 原子化CSS |
| 状态管理 | Zustand | 4.x | 轻量级状态管理 |
| HTTP客户端 | Axios | 1.x | API请求 |
| 后端运行时 | Node.js | 20.x | LTS版本 |
| 数据库 | PostgreSQL | 15.x | 关系型数据库 |
| ORM | Prisma | 5.x | 数据库ORM |
| 认证 | JWT | - | Token认证 |
| 密码加密 | bcrypt | 5.x | 密码哈希 |
| 爬虫 | Puppeteer | 22.x | 动态页面爬取 |
| XML解析 | rss-parser | 3.x | RSS/Atom解析 |
| HTML解析 | cheerio | 1.x | DOM解析 |

---

## 2. 目录结构

```
company-tracker/
├── doc/                          # 文档目录
│   ├── requirements/             # 需求文档
│   ├── architecture/             # 架构文档
│   └── test-reports/             # 测试报告
│
├── src/                          # 源代码
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # 认证相关页面
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (main)/               # 主应用页面
│   │   │   ├── tasks/            # 任务列表
│   │   │   └── research/         # 调研流程
│   │   │       └── [taskId]/     # 动态路由
│   │   ├── admin/                # 管理后台
│   │   ├── api/                  # API路由
│   │   │   ├── auth/
│   │   │   ├── tasks/
│   │   │   ├── sources/
│   │   │   ├── articles/
│   │   │   ├── reports/
│   │   │   └── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── components/               # React组件
│   │   ├── ui/                   # 基础UI组件
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Stepper.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── ...
│   │   ├── layout/               # 布局组件
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── GlobalProgress.tsx
│   │   └── features/             # 业务组件
│   │       ├── TaskCard.tsx
│   │       ├── SourceList.tsx
│   │       ├── ArticleCard.tsx
│   │       ├── ReportViewer.tsx
│   │       └── ...
│   │
│   ├── lib/                      # 工具库
│   │   ├── db.ts                 # Prisma客户端
│   │   ├── auth.ts               # 认证工具
│   │   ├── api.ts                # API客户端
│   │   └── utils.ts              # 通用工具
│   │
│   ├── services/                 # 后端服务
│   │   ├── crawlers/             # 爬虫服务
│   │   │   ├── BaseCrawler.ts
│   │   │   ├── RSSCrawler.ts
│   │   │   ├── BlogCrawler.ts
│   │   │   ├── NewsCrawler.ts
│   │   │   ├── JSRenderCrawler.ts
│   │   │   └── CrawlerFactory.ts
│   │   ├── search/               # 搜索服务
│   │   │   ├── SearXNGService.ts
│   │   │   └── BingService.ts    # 预留
│   │   ├── ai/                   # AI服务
│   │   │   └── DeepseekService.ts
│   │   └── collector/            # 采集服务
│   │       └── ArticleCollector.ts
│   │
│   ├── store/                    # Zustand状态
│   │   ├── useAuthStore.ts
│   │   ├── useTaskStore.ts
│   │   └── useProgressStore.ts
│   │
│   └── types/                    # TypeScript类型
│       └── index.ts
│
├── prisma/                       # Prisma配置
│   ├── schema.prisma             # 数据库Schema
│   ├── migrations/               # 数据库迁移
│   └── seed.ts                   # 种子数据
│
├── tests/                        # 测试目录
│   ├── unit/                     # 单元测试
│   ├── integration/              # 集成测试
│   └── e2e/                      # 端到端测试
│
├── public/                       # 静态资源
├── .env.example                  # 环境变量示例
├── .env.local                    # 本地环境变量
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── README.md
```

---

## 3. 数据库设计

### 3.1 ER图

```
┌─────────────┐       ┌─────────────────┐       ┌─────────────┐
│    User     │       │  ResearchTask   │       │ DataSource  │
├─────────────┤       ├─────────────────┤       ├─────────────┤
│ id (PK)     │──────<│ id (PK)         │>──────│ id (PK)     │
│ email       │       │ user_id (FK)    │       │ task_id(FK) │
│ password    │       │ company_name    │       │ name        │
│ is_admin    │       │ focus_points    │       │ url         │
│ created_at  │       │ current_step    │       │ type        │
│ updated_at  │       │ status          │       │ origin      │
└─────────────┘       │ created_at      │       │ selected    │
                      │ updated_at      │       └─────────────┘
                      └────────┬────────┘              │
                               │                       │
                               ▼                       ▼
                      ┌─────────────────┐       ┌─────────────┐
                      │    Article      │       │   Report    │
                      ├─────────────────┤       ├─────────────┤
                      │ id (PK)         │       │ id (PK)     │
                      │ task_id (FK)    │       │ task_id(FK) │
                      │ source_id (FK)  │       │ template    │
                      │ title           │       │ content     │
                      │ content         │       │ created_at  │
                      │ summary         │       └─────────────┘
                      │ url             │
                      │ publish_date    │
                      │ source_type     │
                      │ selected        │
                      └─────────────────┘

┌─────────────────┐
│  CuratedSource  │  (内置信息源，只读)
├─────────────────┤
│ id (PK)         │
│ name            │
│ url             │
│ type            │
│ category        │
│ description     │
│ region          │
└─────────────────┘
```

### 3.2 Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String         @id @default(uuid())
  email        String         @unique
  passwordHash String         @map("password_hash")
  isAdmin      Boolean        @default(false) @map("is_admin")
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")
  tasks        ResearchTask[]

  @@map("users")
}

model ResearchTask {
  id           String       @id @default(uuid())
  userId       String       @map("user_id")
  companyName  String       @map("company_name")
  focusPoints  String       @map("focus_points")
  currentStep  Int          @default(1) @map("current_step")
  status       TaskStatus   @default(in_progress)
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  user         User         @relation(fields: [userId], references: [id])
  dataSources  DataSource[]
  articles     Article[]
  reports      Report[]

  @@map("research_tasks")
}

model DataSource {
  id           String       @id @default(uuid())
  taskId       String       @map("task_id")
  name         String
  url          String
  type         SourceType
  origin       SourceOrigin
  selected     Boolean      @default(false)
  createdAt    DateTime     @default(now()) @map("created_at")

  task         ResearchTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  articles     Article[]

  @@map("data_sources")
}

model Article {
  id           String       @id @default(uuid())
  taskId       String       @map("task_id")
  sourceId     String?      @map("source_id")
  title        String
  content      String
  summary      String?
  url          String
  imageUrl     String?      @map("image_url")
  publishDate  DateTime?    @map("publish_date")
  sourceType   ArticleSourceType @map("source_type")
  selected     Boolean      @default(false)
  createdAt    DateTime     @default(now()) @map("created_at")

  task         ResearchTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  dataSource   DataSource?  @relation(fields: [sourceId], references: [id])

  @@map("articles")
}

model Report {
  id           String       @id @default(uuid())
  taskId       String       @map("task_id")
  template     String
  content      String
  createdAt    DateTime     @default(now()) @map("created_at")

  task         ResearchTask @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@map("reports")
}

model CuratedSource {
  id          String   @id @default(uuid())
  name        String   @map("source_name")
  url         String   @map("source_url")
  type        String   @map("source_type")
  category    String
  description String?
  region      String?

  @@map("curated_sources")
}

enum TaskStatus {
  in_progress
  completed
}

enum SourceType {
  rss
  atom
  feed
  blog
  news
  website
}

enum SourceOrigin {
  builtin
  search
  deepseek
  manual
}

enum ArticleSourceType {
  datasource
  search
}
```

---

## 4. API设计

### 4.1 认证API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/logout | 用户登出 |
| GET | /api/auth/me | 获取当前用户 |

### 4.2 任务API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks | 获取用户任务列表 |
| POST | /api/tasks | 创建新任务 |
| GET | /api/tasks/:id | 获取任务详情 |
| PATCH | /api/tasks/:id | 更新任务 |
| DELETE | /api/tasks/:id | 删除任务 |

### 4.3 信息源API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks/:id/sources | 获取任务信息源 |
| POST | /api/tasks/:id/sources/discover | 发现信息源（三种方式） |
| POST | /api/tasks/:id/sources/optimize | AI优化信息源 |
| PATCH | /api/tasks/:id/sources/:sourceId | 更新信息源选中状态 |
| POST | /api/tasks/:id/sources/batch-select | 批量选择信息源 |

### 4.4 文章API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks/:id/articles | 获取任务文章列表 |
| POST | /api/tasks/:id/articles/collect | 开始采集文章 |
| GET | /api/tasks/:id/articles/:articleId | 获取文章详情 |
| PATCH | /api/tasks/:id/articles/:articleId | 更新文章选中状态 |
| POST | /api/tasks/:id/articles/batch-select | 批量选择文章 |

### 4.5 报告API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks/:id/reports | 获取任务报告列表 |
| GET | /api/tasks/:id/reports/template | 获取默认模板 |
| POST | /api/tasks/:id/reports/generate | 生成报告 |
| GET | /api/tasks/:id/reports/:reportId | 获取报告内容 |
| GET | /api/tasks/:id/reports/:reportId/download | 下载报告 |

### 4.6 管理API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/tables | 获取所有表名 |
| GET | /api/admin/tables/:name | 获取表数据 |
| DELETE | /api/admin/tables/:name | 清空表数据 |
| DELETE | /api/admin/tables/:name/:id | 删除单条记录 |

---

## 5. 核心模块设计

### 5.1 认证模块

```typescript
// JWT Token结构
interface JWTPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
  exp: number;
}

// 认证流程
1. 注册：邮箱+密码 → bcrypt加密 → 存储
2. 登录：验证密码 → 生成JWT → 返回Token
3. 请求：Header携带Token → 中间件验证 → 放行或拒绝
```

### 5.2 信息源发现模块

```typescript
// 信息源发现服务
class SourceDiscoveryService {
  // 1. 从内置源过滤
  async filterBuiltinSources(companyName: string, focusPoints: string): Promise<Source[]>

  // 2. 搜索引擎发现
  async searchSources(companyName: string, focusPoints: string): Promise<Source[]>

  // 3. Deepseek推荐
  async recommendSources(companyName: string, focusPoints: string): Promise<Source[]>

  // 合并去重
  async discoverAll(companyName: string, focusPoints: string): Promise<Source[]>
}
```

### 5.3 爬虫模块（参考news-agent）

```typescript
// 爬虫工厂
class CrawlerFactory {
  static getCrawler(sourceType: SourceType): BaseCrawler
}

// 基础爬虫
abstract class BaseCrawler {
  abstract crawl(url: string): Promise<Article[]>
  protected extractTitle($: CheerioAPI): string
  protected extractContent($: CheerioAPI): string
  protected extractDate($: CheerioAPI): Date
}

// 具体爬虫
class RSSCrawler extends BaseCrawler { }
class BlogCrawler extends BaseCrawler { }
class NewsCrawler extends BaseCrawler { }
class JSRenderCrawler extends BaseCrawler { }
```

### 5.4 文章采集模块

```typescript
// 采集服务
class ArticleCollector {
  // 从信息源采集
  async collectFromSources(taskId: string, sources: Source[]): Promise<void>

  // 从搜索引擎采集
  async collectFromSearch(taskId: string, query: string): Promise<void>

  // 过滤相关文章
  async filterRelevant(articles: Article[], companyName: string, focusPoints: string): Promise<Article[]>
}
```

### 5.5 报告生成模块

```typescript
// Deepseek服务
class DeepseekService {
  // 信息源推荐
  async recommendSources(prompt: string): Promise<Source[]>

  // 优化信息源
  async optimizeSources(currentSources: Source[], userInput: string): Promise<Source[]>

  // 验证用户输入相关性
  async validateInput(input: string): Promise<{valid: boolean, message: string}>

  // 生成报告
  async generateReport(articles: Article[], focusPoints: string, template: string): Promise<string>
}
```

### 5.6 进度管理模块

```typescript
// 进度状态
interface ProgressState {
  taskId: string;
  stage: string;          // 当前阶段
  message: string;        // 当前操作描述
  progress: number;       // 0-100
  details: string[];      // 详细信息列表
  isExpanded: boolean;    // 是否展开
}

// 进度更新（通过SSE或轮询）
// 前端订阅进度更新，实时显示
```

---

## 6. 前端页面设计

### 6.1 页面路由

| 路由 | 页面 | 说明 |
|------|------|------|
| / | 首页 | 重定向到登录或任务列表 |
| /login | 登录页 | |
| /register | 注册页 | |
| /tasks | 任务列表页 | 登录后首页 |
| /research/[taskId] | 调研流程页 | 包含4个步骤 |
| /research/[taskId]/article/[articleId] | 文章详情页 | |
| /research/[taskId]/report/[reportId] | 报告查看页 | |
| /admin | 管理后台 | 仅管理员 |

### 6.2 响应式断点

```css
/* Tailwind断点 */
sm: 640px   /* 手机横屏 */
md: 768px   /* 平板 */
lg: 1024px  /* 小桌面 */
xl: 1280px  /* 大桌面 */
```

### 6.3 组件层次

```
App
├── AuthProvider (认证上下文)
├── ProgressProvider (进度上下文)
├── Layout
│   ├── Header (顶部导航)
│   ├── Main (主内容区)
│   └── GlobalProgress (底部进度栏)
│
└── Pages
    ├── LoginPage
    ├── RegisterPage
    ├── TaskListPage
    │   └── TaskCard[]
    ├── ResearchPage
    │   ├── Stepper
    │   ├── Step1Form
    │   ├── Step2SourceList
    │   ├── Step3ArticleList
    │   └── Step4ReportGenerator
    ├── ArticleDetailPage
    ├── ReportViewPage
    └── AdminPage
```

---

## 7. 安全设计

### 7.1 认证安全
- 密码使用 bcrypt (cost=12) 加密
- JWT Token 有效期 7 天
- HTTPS 传输（生产环境）
- 登录失败限制

### 7.2 API安全
- 所有API需要认证（除注册/登录）
- 用户只能访问自己的数据
- 管理API需要管理员权限
- 输入验证和清理

### 7.3 爬虫安全
- 请求频率限制
- User-Agent 设置
- 超时控制
- 错误处理

---

## 8. 部署架构

### 8.1 本地开发

```
┌─────────────────┐     ┌─────────────────┐
│   Next.js Dev   │────>│  PostgreSQL     │
│   localhost:3000│     │  localhost:5432 │
└─────────────────┘     └─────────────────┘
```

### 8.2 Railway生产

```
┌─────────────────┐     ┌─────────────────┐
│   Next.js       │────>│  PostgreSQL     │
│   (Railway)     │     │  (Railway)      │
└─────────────────┘     └─────────────────┘
        │
        ▼
┌─────────────────┐
│   CDN (可选)    │
└─────────────────┘
```

### 8.3 环境变量

```env
# 数据库
DATABASE_URL=postgresql://user:pass@host:5432/db

# JWT
JWT_SECRET=your-secret-key

# Deepseek
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# SearXNG
SEARXNG_BASE_URL=https://searxng.instance.url

# 管理员
ADMIN_EMAILS=admin@example.com

# 应用
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 9. 测试策略

### 9.1 单元测试
- 服务层函数测试
- 工具函数测试
- 组件渲染测试

### 9.2 集成测试
- API端点测试
- 数据库操作测试
- 认证流程测试

### 9.3 E2E测试
- 用户注册登录流程
- 完整调研流程
- 响应式显示测试

### 9.4 测试工具
- Jest：单元测试
- Supertest：API测试
- Playwright：E2E测试

---

## 10. 性能考虑

### 10.1 前端优化
- Next.js 自动代码分割
- 图片懒加载
- 虚拟滚动（长列表）

### 10.2 后端优化
- 数据库索引
- 查询优化
- 缓存策略

### 10.3 爬虫优化
- 并发控制
- 重试机制
- 资源拦截（广告等）
