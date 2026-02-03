import axios, { AxiosInstance, AxiosError } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器 - 添加Token
    this.client.interceptors.request.use((config) => {
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // 响应拦截器 - 处理错误
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ message: string }>) => {
        if (error.response?.status === 401) {
          // 未授权，清除认证状态
          useAuthStore.getState().clearAuth();
          window.location.href = '/login';
        }
        throw error;
      }
    );
  }

  // 认证API
  async register(email: string, password: string) {
    const { data } = await this.client.post('/auth/register', { email, password });
    return data;
  }

  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    return data;
  }

  async getMe() {
    const { data } = await this.client.get('/auth/me');
    return data;
  }

  // 任务API
  async getTasks() {
    const { data } = await this.client.get('/tasks');
    return data;
  }

  async createTask(companyName: string, focusPoints: string) {
    const { data } = await this.client.post('/tasks', { companyName, focusPoints });
    return data;
  }

  async getTask(taskId: string) {
    const { data } = await this.client.get(`/tasks/${taskId}`);
    return data;
  }

  async updateTask(taskId: string, updates: Record<string, unknown>) {
    const { data } = await this.client.patch(`/tasks/${taskId}`, updates);
    return data;
  }

  async deleteTask(taskId: string) {
    const { data } = await this.client.delete(`/tasks/${taskId}`);
    return data;
  }

  // 信息源API
  async getSources(taskId: string) {
    const { data } = await this.client.get(`/tasks/${taskId}/sources`);
    return data;
  }

  async discoverSources(taskId: string, methods?: string[]) {
    const { data } = await this.client.post(`/tasks/${taskId}/sources/discover`, { methods });
    return data;
  }

  async optimizeSources(taskId: string, userInput: string) {
    const { data } = await this.client.post(`/tasks/${taskId}/sources/optimize`, { userInput });
    return data;
  }

  async batchSelectSources(taskId: string, ids: string[], selected: boolean) {
    const { data } = await this.client.patch(`/tasks/${taskId}/sources`, { ids, selected });
    return data;
  }

  // 文章API
  async getArticles(taskId: string, params?: { sourceType?: string; page?: number; pageSize?: number }) {
    const { data } = await this.client.get(`/tasks/${taskId}/articles`, { params });
    return data;
  }

  async collectArticles(taskId: string) {
    const { data } = await this.client.post(`/tasks/${taskId}/articles/collect`);
    return data;
  }

  async getArticle(taskId: string, articleId: string) {
    const { data } = await this.client.get(`/tasks/${taskId}/articles/${articleId}`);
    return data;
  }

  async updateArticle(taskId: string, articleId: string, selected: boolean) {
    const { data } = await this.client.patch(`/tasks/${taskId}/articles/${articleId}`, { selected });
    return data;
  }

  async batchSelectArticles(taskId: string, ids: string[], selected: boolean) {
    const { data } = await this.client.patch(`/tasks/${taskId}/articles`, { ids, selected });
    return data;
  }

  async selectAllArticles(taskId: string, selectAll: boolean) {
    const { data } = await this.client.patch(`/tasks/${taskId}/articles`, { selectAll });
    return data;
  }

  // 报告API
  async getReports(taskId: string) {
    const { data } = await this.client.get(`/tasks/${taskId}/reports`);
    return data;
  }

  async getReportTemplate(taskId: string) {
    const { data } = await this.client.get(`/tasks/${taskId}/reports/template`);
    return data;
  }

  async adjustTemplate(taskId: string, currentTemplate: string, userRequest: string) {
    const { data } = await this.client.post(`/tasks/${taskId}/reports/template`, {
      currentTemplate,
      userRequest,
    });
    return data;
  }

  async generateReport(taskId: string, template: string) {
    const { data } = await this.client.post(`/tasks/${taskId}/reports/generate`, { template });
    return data;
  }

  async getReport(taskId: string, reportId: string) {
    const { data } = await this.client.get(`/tasks/${taskId}/reports/${reportId}`);
    return data;
  }

  getReportDownloadUrl(taskId: string, reportId: string) {
    return `/api/tasks/${taskId}/reports/${reportId}?download=true`;
  }

  // 管理员API
  async getAdminTables() {
    const { data } = await this.client.get('/admin/tables');
    return data;
  }

  async getAdminTableData(tableName: string) {
    const { data } = await this.client.get(`/admin/tables/${tableName}`);
    return data;
  }

  async clearAdminTable(tableName: string) {
    const { data } = await this.client.delete(`/admin/tables/${tableName}`);
    return data;
  }

  async deleteAdminRecord(tableName: string, id: string) {
    const { data } = await this.client.delete(`/admin/tables/${tableName}/${id}`);
    return data;
  }
}

export const api = new ApiClient();
