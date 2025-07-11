'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAppData } from '@/hooks/useAppData';
import { NavigationManager } from '@/lib/navigation';
import { formatCurrency, formatDate, exportToCSV, exportToJSON } from '@/lib/utils';
import { Breadcrumb, PageHeader, QuickStats } from '@/components/SharedNavigation';
import { CONFIG } from '@/lib/config';

export default function XuatNhapTonPage() {
  const searchParams = useSearchParams();
  const {
    inventoryItems,
    loading,
    error,
    refreshInventory,
    getStatistics
  } = useAppData();

  // URL params
  const invoiceFilter = searchParams.get('invoice');
  const searchFilter = searchParams.get('search');

  // UI states
  const [searchTerm, setSearchTerm] = useState(searchFilter || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'productName',
    direction: 'asc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(CONFIG.UI.DEFAULT_PAGE_SIZE);

  // Filter and sort inventory items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = inventoryItems;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchLower)
      );
    }

    // Apply category filter
    if (categoryFilter) {
      filtered = filtered.filter(item =>
        item.category?.toLowerCase().includes(categoryFilter.toLowerCase())
      );
    }

    // Apply supplier filter
    if (supplierFilter) {
      filtered = filtered.filter(item =>
        item.supplier?.toLowerCase().includes(supplierFilter.toLowerCase())
      );
    }

    // Sort items
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortConfig.key) {
        case 'productName':
          aValue = a.productName.toLowerCase();
          bValue = b.productName.toLowerCase();
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'totalValue':
          aValue = a.totalValue;
          bValue = b.totalValue;
          break;
        case 'nhap':
          aValue = a.nhap.sluong;
          bValue = b.nhap.sluong;
          break;
        case 'xuat':
          aValue = a.xuat.sluong;
          bValue = b.xuat.sluong;
          break;
        default:
          aValue = a.productName.toLowerCase();
          bValue = b.productName.toLowerCase();
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return filtered;
  }, [inventoryItems, searchTerm, categoryFilter, supplierFilter, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredAndSortedItems.slice(startIndex, endIndex);

  // Statistics
  const stats = useMemo(() => {
    const totalItems = filteredAndSortedItems.length;
    const totalValue = filteredAndSortedItems.reduce((sum, item) => sum + item.totalValue, 0);
    const totalQuantity = filteredAndSortedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalNhap = filteredAndSortedItems.reduce((sum, item) => sum + item.nhap.sluong, 0);
    const totalXuat = filteredAndSortedItems.reduce((sum, item) => sum + item.xuat.sluong, 0);

    return {
      totalItems,
      totalValue,
      totalQuantity,
      totalNhap,
      totalXuat
    };
  }, [filteredAndSortedItems]);

  // Handlers
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleExportExcel = () => {
    const filename = `xuat-nhap-ton-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(filteredAndSortedItems, filename);
  };

  const handleExportJSON = () => {
    const filename = `xuat-nhap-ton-${new Date().toISOString().split('T')[0]}`;
    exportToJSON(filteredAndSortedItems, filename);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setSupplierFilter('');
    setCurrentPage(1);
  };

  const resetPagination = () => setCurrentPage(1);

  // Sort icon component
  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) {
      return <span className="text-gray-400">↕️</span>;
    }
    return sortConfig.direction === "asc" ? 
      <span className="text-blue-500">↑</span> : 
      <span className="text-blue-500">↓</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-xl">Đang tải báo cáo tồn kho...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumb items={NavigationManager.getBreadcrumb('/xuatnhapton')} />
      
      <div className="container mx-auto px-4 py-8">
        <PageHeader 
          title="Báo cáo xuất nhập tồn"
          description="Quản lý tồn kho theo sản phẩm"
        />

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Quick Stats */}
        <QuickStats stats={[
          { label: 'Tổng sản phẩm', value: stats.totalItems.toLocaleString(), color: 'blue' },
          { label: 'Tổng giá trị', value: formatCurrency(stats.totalValue), color: 'green' },
          { label: 'Tổng số lượng', value: stats.totalQuantity.toLocaleString(), color: 'purple' },
          { label: 'Tỷ lệ xuất/nhập', value: `${((stats.totalXuat / stats.totalNhap) * 100).toFixed(1)}%`, color: 'orange' }
        ]} />

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap gap-4 mb-4">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  resetPagination();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="min-w-48">
              <input
                type="text"
                placeholder="Lọc theo danh mục..."
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  resetPagination();
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Export buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                📊 Excel
              </button>
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📄 JSON
              </button>
              <button
                onClick={refreshInventory}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                🔄 Làm mới
              </button>
            </div>
          </div>

          {/* Clear filters */}
          {(searchTerm || categoryFilter || supplierFilter) && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                Hiển thị {filteredAndSortedItems.length} / {inventoryItems.length} sản phẩm
              </span>
              <button
                onClick={clearFilters}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>

        {/* Inventory Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('productName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Sản phẩm</span>
                      <SortIcon column="productName" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('nhap')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Nhập</span>
                      <SortIcon column="nhap" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('xuat')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Xuất</span>
                      <SortIcon column="xuat" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Tồn kho</span>
                      <SortIcon column="quantity" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalValue')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Giá trị</span>
                      <SortIcon column="totalValue" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.productName}
                      </div>
                      {item.category && (
                        <div className="text-sm text-gray-500">
                          {item.category}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.nhap.sluong.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(item.nhap.thtien)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.xuat.sluong.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(item.xuat.thtien)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.quantity.toLocaleString()}
                      </div>
                      <div className={`text-sm ${item.quantity < 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {item.quantity < 0 ? 'Thiếu hàng' : 'Còn hàng'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(item.totalValue)}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{formatCurrency(item.unitPrice)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link
                        href={NavigationManager.generateInventoryUrl(item.productName)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Chi tiết
                      </Link>
                      <button
                        onClick={() => NavigationManager.navigateToPage(
                          NavigationManager.generateInvoiceListUrl('sold', { search: item.productName })
                        )}
                        className="text-green-600 hover:text-green-900"
                      >
                        Hóa đơn
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
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
                    Hiển thị <span className="font-medium">{startIndex + 1}</span> đến{' '}
                    <span className="font-medium">{Math.min(endIndex, filteredAndSortedItems.length)}</span> của{' '}
                    <span className="font-medium">{filteredAndSortedItems.length}</span> kết quả
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      ‹
                    </button>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
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
                      ›
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Empty state */}
        {currentItems.length === 0 && !loading && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-500 text-lg mb-4">📦</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Không có dữ liệu tồn kho</h3>
            <p className="text-gray-500 mb-4">
              {inventoryItems.length === 0 
                ? 'Chưa có dữ liệu hóa đơn chi tiết để tạo báo cáo tồn kho'
                : 'Không tìm thấy sản phẩm nào phù hợp với bộ lọc hiện tại'
              }
            </p>
            {inventoryItems.length === 0 ? (
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Về trang chủ
              </Link>
            ) : (
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
