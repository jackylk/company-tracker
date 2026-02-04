// 用户相关类型
export interface User {
  id: string;
  username: string;
  email?: string | null;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  userId: string;
  username: string;
  isAdmin: boolean;
  exp?: number;
  iat?: number;
}

// 任务相关类型
export type TaskStatus = 'in_progress' | 'completed';

export interface ResearchTask {
  id: string;
  userId: string;
  companyName: string;
  focusPoints: string;
  currentStep: number;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskWithCounts extends ResearchTask {
  _count?: {
    dataSources: number;
    articles: number;
    reports: number;
  };
}

// 信息源相关类型
export type SourceType = 'rss' | 'atom' | 'feed' | 'blog' | 'news' | 'website';
export type SourceOrigin = 'builtin' | 'search' | 'deepseek' | 'manual';
export type CollectionStatus = 'unknown' | 'success' | 'failed' | 'slow';

export interface DataSource {
  id: string;
  taskId: string;
  name: string;
  url: string;
  type: SourceType;
  origin: SourceOrigin;
  category?: string | null;
  description?: string | null;
  selected: boolean;
  collectionStatus: CollectionStatus;
  lastCollectionError?: string | null;
  createdAt: Date;
}

export interface CuratedSource {
  id: string;
  name: string;
  url: string;
  type: string;
  category: string;
  description?: string;
  region?: string;
}

// 文章相关类型
export type ArticleSourceType = 'datasource' | 'search';

export interface Article {
  id: string;
  taskId: string;
  sourceId?: string | null;
  title: string;
  content: string;
  summary?: string | null;
  url: string;
  imageUrl?: string | null;
  publishDate?: Date | null;
  sourceType: ArticleSourceType;
  selected: boolean;
  createdAt: Date;
}

// 报告相关类型
export interface Report {
  id: string;
  taskId: string;
  template: string;
  content: string;
  createdAt: Date;
}

// API请求/响应类型
export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface CreateTaskRequest {
  companyName: string;
  focusPoints: string;
}

export interface UpdateTaskRequest {
  companyName?: string;
  focusPoints?: string;
  currentStep?: number;
  status?: TaskStatus;
}

export interface DiscoverSourcesRequest {
  methods?: ('builtin' | 'search' | 'deepseek')[];
}

export interface OptimizeSourcesRequest {
  userInput: string;
}

export interface BatchSelectRequest {
  ids: string[];
  selected: boolean;
}

export interface GenerateReportRequest {
  template: string;
}

// 进度状态类型
export interface ProgressState {
  taskId: string | null;
  stage: string;
  message: string;
  progress: number;
  details: string[];
  isExpanded: boolean;
  isVisible: boolean;
}

// API错误响应
export interface ApiError {
  error: string;
  message: string;
}

// 分页类型
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
