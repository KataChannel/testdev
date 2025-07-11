'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAppData } from '@/hooks/useAppData';
import { InvoiceData } from '@/lib/database';
import { NavigationManager } from '@/lib/navigation';
import { 
  formatCurrency, 
  formatDate, 
  getInvoiceStatus, 
  exportToCSV, 
  exportToJSON,
  parseCurrency 
} from '@/lib/utils';
import { Breadcrumb, PageHeader, QuickStats } from '@/components/SharedNavigation';
import { CONFIG } from '@/lib/config';

interface FilterConfig {
  status: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

interface SortConfig {
  key: keyof InvoiceData | null;
  direction: "asc" | "desc";
}

export default function HoaDonPage() {
  const searchParams = useSearchParams();
  const {
    invoices,
    loading,
    error,
    loadInvoices,
    loadInvoiceDetail,
    loadAllDetails,
    detailProgress,
    detailLoading,
    getStatistics
  } = useAppData();

  // UI States
  const [activeTab, setActiveTab] = useState<'sold' | 'purchase'>('sold');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(CONFIG.UI.DEFAULT_PAGE_SIZE);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterConfig>({
    status: "",
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
  });

  // API States
  const [token, setToken] = useState<string>(CONFIG.API.DEFAULT_TOKEN);
  const [delayBetweenRequests, setDelayBetweenRequests] = useState<number>(CONFIG.UI.DEFAULT_DELAY);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  // Sorting function
  const handleSort = (key: keyof InvoiceData) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort invoices
  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoices[activeTab];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice =>
        Object.values(invoice).some(value =>
          value && value.toString().toLowerCase().includes(searchLower)
        )
      );
    }

    // Apply advanced filters
    if (filters.status) {
      filtered = filtered.filter(invoice => invoice.tthai === filters.status);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(invoice => 
        invoice.tdlap && invoice.tdlap >= filters.dateFrom
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(invoice => 
        invoice.tdlap && invoice.tdlap <= filters.dateTo
      );
    }

    if (filters.amountMin) {
      const minAmount = parseFloat(filters.amountMin);
      filtered = filtered.filter(invoice => {
        const amount = parseFloat(invoice.tgtcthue?.toString() || '0');
        return amount >= minAmount;
      });
    }

    if (filters.amountMax) {
      const maxAmount = parseFloat(filters.amountMax);
      filtered = filtered.filter(invoice => {
        const amount = parseFloat(invoice.tgtcthue?.toString() || '0');
        return amount <= maxAmount;
      });
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        
        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [invoices, activeTab, searchTerm, filters, sortConfig]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalAmount = filteredAndSortedInvoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.tgtcthue?.toString() || '0');
    }, 0);

    const totalTax = filteredAndSortedInvoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.tgtthue?.toString() || '0');
    }, 0);

    return {
      count: filteredAndSortedInvoices.length,
      totalAmount,
      totalTax,
      averageAmount: filteredAndSortedInvoices.length > 0 ? totalAmount / filteredAndSortedInvoices.length : 0
    };
  }, [filteredAndSortedInvoices]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInvoices = filteredAndSortedInvoices.slice(startIndex, endIndex);

  // Reset pagination when changing tabs, search, or filters
  const resetPagination = () => setCurrentPage(1);

  // Export handlers
  const handleExportExcel = () => {
    const filename = `hoa-don-${activeTab}-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(filteredAndSortedInvoices, filename);
  };

  const handleExportJSON = () => {
    const filename = `hoa-don-${activeTab}-${new Date().toISOString().split('T')[0]}`;
    exportToJSON(filteredAndSortedInvoices, filename);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: "",
      dateFrom: "",
      dateTo: "",
      amountMin: "",
      amountMax: "",
    });
    resetPagination();
  };

  // Load all invoice details
  const handleLoadAllDetails = async () => {
    try {
      await loadAllDetails(activeTab, token, delayBetweenRequests);
      alert('Hoàn thành tải chi tiết hóa đơn!');
    } catch (error) {
      alert(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Sort icon component
  const SortIcon = ({ column }: { column: keyof InvoiceData }) => {
    if (sortConfig.key !== column) {
      return <span className="text-gray-400">↕️</span>;
    }
    return sortConfig.direction === "asc" ? 
      <span className="text-blue-500">↑</span> : 
      <span className="text-blue-500">↓</span>;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Đang tải dữ liệu hóa đơn...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumb items={[{ label: 'Hóa đơn điện tử' }]} />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Quản lý hóa đơn điện tử</h1>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-100 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800">Hóa đơn bán ra</h3>
            <p className="text-2xl font-bold text-blue-600">{invoices.sold.length}</p>
          </div>
          <div className="bg-green-100 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800">Hóa đơn mua vào</h3>
            <p className="text-2xl font-bold text-green-600">{invoices.purchase.length}</p>
          </div>
          <div className="bg-purple-100 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-800">Đang hiển thị</h3>
            <p className="text-2xl font-bold text-purple-600">{summaryStats.count}</p>
          </div>
          <div className="bg-orange-100 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-orange-800">Tổng giá trị</h3>
            <p className="text-xl font-bold text-orange-600">{formatCurrency(summaryStats.totalAmount)}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg mb-4">
            <button
              onClick={() => {
                setActiveTab('sold');
                resetPagination();
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sold'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Hóa đơn bán ra ({invoices.sold.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('purchase');
                resetPagination();
              }}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'purchase'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Hóa đơn mua vào ({invoices.purchase.length})
            </button>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Tìm kiếm hóa đơn..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                resetPagination();
              }}
            />
          </div>

          {/* Advanced Filters */}
          <div className="mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <span className="mr-2">🔍</span>
              Bộ lọc nâng cao
              <span className="ml-2">{showFilters ? '▲' : '▼'}</span>
            </button>
            
            {showFilters && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Trạng thái</label>
                    <select
                      value={filters.status}
                      onChange={(e) => {
                        setFilters(prev => ({ ...prev, status: e.target.value }));
                        resetPagination();
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">Tất cả</option>
                      <option value="1">Đã ký</option>
                      <option value="2">Đã gửi</option>
                      <option value="3">Đã nhận</option>
                      <option value="4">Đã hủy</option>
                      <option value="5">Đã xác nhận</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Từ ngày</label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => {
                        setFilters(prev => ({ ...prev, dateFrom: e.target.value }));
                        resetPagination();
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Đến ngày</label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => {
                        setFilters(prev => ({ ...prev, dateTo: e.target.value }));
                        resetPagination();
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Số tiền từ</label>
                    <input
                      type="number"
                      value={filters.amountMin}
                      onChange={(e) => {
                        setFilters(prev => ({ ...prev, amountMin: e.target.value }));
                        resetPagination();
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Số tiền đến</label>
                    <input
                      type="number"
                      value={filters.amountMax}
                      onChange={(e) => {
                        setFilters(prev => ({ ...prev, amountMax: e.target.value }));
                        resetPagination();
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="999999999"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Export */}
            <div>
              <h3 className="font-semibold mb-2">Xuất dữ liệu</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  📊 Excel
                </button>
                <button
                  onClick={handleExportJSON}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  📄 JSON
                </button>
              </div>
            </div>

            {/* Detail Loading */}
            <div>
              <h3 className="font-semibold mb-2">Tải chi tiết từ API</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAdvancedControls(!showAdvancedControls)}
                  className="px-3 py-2 bg-gray-100 rounded text-sm"
                >
                  ⚙️ Cài đặt
                </button>
                <button
                  onClick={handleLoadAllDetails}
                  disabled={detailLoading || !token.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {detailLoading ? 'Đang tải...' : '🔄 Tải tất cả'}
                </button>
              </div>
              
              {showAdvancedControls && (
                <div className="mt-2 p-3 border border-gray-200 rounded bg-gray-50">
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">API Token</label>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="Bearer token..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Delay (ms)</label>
                      <input
                        type="number"
                        value={delayBetweenRequests}
                        onChange={(e) => setDelayBetweenRequests(parseInt(e.target.value) || 2000)}
                        className="w-full px-2 py-1 border rounded text-sm"
                        min="500"
                        max="10000"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Progress */}
              {detailLoading && (
                <div className="mt-2 text-sm text-gray-600">
                  Tiến độ: {detailProgress.current}/{detailProgress.total} 
                  (Xử lý: {detailProgress.processed}, Lỗi: {detailProgress.errors})
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        {currentInvoices.length > 0 ? (
          <>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('shdon')}
                      >
                        <div className="flex items-center">
                          Số hóa đơn
                          <SortIcon column="shdon" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('tdlap')}
                      >
                        <div className="flex items-center">
                          Ngày lập
                          <SortIcon column="tdlap" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('nmten')}
                      >
                        <div className="flex items-center">
                          Khách hàng
                          <SortIcon column="nmten" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('tgtcthue')}
                      >
                        <div className="flex items-center">
                          Tổng tiền
                          <SortIcon column="tgtcthue" />
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('tthai')}
                      >
                        <div className="flex items-center">
                          Trạng thái
                          <SortIcon column="tthai" />
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentInvoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <Link 
                            href={NavigationManager.generateInvoiceUrl(invoice.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {invoice.shdon || 'N/A'}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {formatDate(invoice.tdlap)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm max-w-xs truncate">
                          {invoice.nmten || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                          {formatCurrency(invoice.tgtcthue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.tthai === '1' || invoice.tthai === '5'
                              ? 'bg-green-100 text-green-800'
                              : invoice.tthai === '4'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {getInvoiceStatus(invoice.tthai)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <Link
                              href={NavigationManager.generateInvoiceUrl(invoice.id)}
                              className="text-indigo-600 hover:text-indigo-900 bg-indigo-100 hover:bg-indigo-200 px-3 py-1 rounded-md"
                            >
                              Chi tiết
                            </Link>
                            {/* Optional: Add inventory link if product exists */}
                            <Link
                              href={`/xuatnhapton?invoice=${invoice.id}`}
                              className="text-green-600 hover:text-green-900 bg-green-100 hover:bg-green-200 px-3 py-1 rounded-md"
                              title="Xem trong kho"
                            >
                              📦
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4 rounded-lg shadow-md">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Hiển thị{' '}
                      <span className="font-medium">{startIndex + 1}</span> đến{' '}
                      <span className="font-medium">
                        {Math.min(endIndex, filteredAndSortedInvoices.length)}
                      </span>{' '}
                      trong tổng số{' '}
                      <span className="font-medium">{filteredAndSortedInvoices.length}</span> kết quả
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        ← Trước
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === pageNum
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Sau →
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-500">
              {searchTerm || Object.values(filters).some(v => v)
                ? 'Không tìm thấy hóa đơn nào phù hợp với bộ lọc'
                : `Chưa có dữ liệu hóa đơn ${activeTab === 'sold' ? 'bán ra' : 'mua vào'}`
              }
            </div>
            <Link 
              href="/"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Về trang chủ để tải dữ liệu
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
