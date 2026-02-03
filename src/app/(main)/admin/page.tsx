'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

interface Table {
  name: string;
  label: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!user?.isAdmin) {
      router.push('/tasks');
      return;
    }
    loadTables();
  }, [user, router]);

  const loadTables = async () => {
    try {
      const data = await api.getAdminTables();
      setTables(data);
    } catch (err) {
      console.error('加载表列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async (name: string) => {
    setSelectedTable(name);
    setLoadingData(true);
    try {
      const data = await api.getAdminTableData(name);
      setTableData(data);
    } catch (err) {
      console.error('加载表数据失败:', err);
      setTableData([]);
    } finally {
      setLoadingData(false);
    }
  };

  const handleClear = async (name: string) => {
    if (!confirm(`确定要清空表 "${name}" 的所有数据吗？此操作不可恢复！`)) {
      return;
    }

    try {
      await api.clearAdminTable(name);
      if (selectedTable === name) {
        setTableData([]);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || '清空失败');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">管理后台</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 表列表 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-100">数据表</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-700">
                {tables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => loadTableData(table.name)}
                    className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                      selectedTable === table.name
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    {table.label}
                    <span className="text-slate-500 ml-2">({table.name})</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 表数据 */}
        <div className="lg:col-span-3">
          {selectedTable ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <h2 className="font-semibold text-slate-100">
                  {tables.find((t) => t.name === selectedTable)?.label}
                  <span className="text-slate-500 font-normal ml-2">
                    ({tableData.length} 条记录)
                  </span>
                </h2>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleClear(selectedTable)}
                  disabled={selectedTable === 'users' || selectedTable === 'curated_sources'}
                >
                  清空表
                </Button>
              </CardHeader>
              <CardContent>
                {loadingData ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : tableData.length > 0 ? (
                  <div className="table-wrapper">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          {Object.keys(tableData[0]).slice(0, 6).map((key) => (
                            <th
                              key={key}
                              className="px-3 py-2 text-left font-medium text-slate-400"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {tableData.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-700/30">
                            {Object.entries(row).slice(0, 6).map(([key, value], j) => (
                              <td
                                key={j}
                                className="px-3 py-2 text-slate-300 truncate max-w-xs"
                                title={String(value)}
                              >
                                {typeof value === 'object'
                                  ? JSON.stringify(value).substring(0, 50)
                                  : String(value).substring(0, 50)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-8">暂无数据</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16 text-slate-400">
              请从左侧选择一个表来查看数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
