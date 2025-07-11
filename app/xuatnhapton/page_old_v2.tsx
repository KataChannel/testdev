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
  const invoiceFilter = searchParams.get('invoice');
  const searchFilter = searchParams.get('search');

  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetail[]>([]);
  const [soldInvoices, setSoldInvoices] = useState<InvoiceData[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<InvoiceData[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState(searchFilter || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(CONFIG.UI.DEFAULT_PAGE_SIZE);
  const [filterMST, setFilterMST] = useState(CONFIG.DEFAULT_MST);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(invoiceFilter);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [detailsData, soldData, purchaseData] = await Promise.all([
          db.loadData<InvoiceDetail>(CONFIG.DB.STORES.DETAILS),
          db.loadInvoices('sold'),
          db.loadInvoices('purchase')
        ]);

        setInvoiceDetails(detailsData);
        setSoldInvoices(soldData);
        setPurchaseInvoices(purchaseData);
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Lỗi khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Process inventory data when data changes
  useEffect(() => {
    if (invoiceDetails.length === 0) return;

    const processInventoryData = () => {
      const inventory: { [key: string]: InventoryItem } = {};

      // Filter details for specific MST
      const filteredDetails = invoiceDetails.filter(detail => {
        // Find corresponding invoice to check MST
        const soldInvoice = soldInvoices.find(inv => inv.id === detail.id);
        const purchaseInvoice = purchaseInvoices.find(inv => inv.id === detail.id);
        const invoice = soldInvoice || purchaseInvoice;
        
        return invoice && (
          invoice.nbmst === filterMST || 
          invoice.nmmst === filterMST
        );
      });

      filteredDetails.forEach(detail => {
        // Find corresponding invoice to determine direction
        const soldInvoice = soldInvoices.find(inv => inv.id === detail.id);
        const purchaseInvoice = purchaseInvoices.find(inv => inv.id === detail.id);
        const invoice = soldInvoice || purchaseInvoice;
        const isSold = !!soldInvoice;

        if (!invoice) return;

        // Get product details from both possible fields
        const products: ProductDetail[] = detail.hdhhdvu || detail.dshhdv || [];
        
        products.forEach((product: ProductDetail) => {
          const productName = product.ten || 'Sản phẩm không xác định';
          const quantity = product.sluong || 0;
          const amount = product.thtien || 0;

          if (!inventory[productName]) {
            inventory[productName] = {
              ten: productName,
              nhap: { sluong: 0, thtien: 0, count: 0, invoices: [] },
              xuat: { sluong: 0, thtien: 0, count: 0, invoices: [] },
              ton: { sluong: 0, thtien: 0 }
            };
          }

          if (isSold) {
            // Sold = Xuất
            inventory[productName].xuat.sluong += quantity;
            inventory[productName].xuat.thtien += amount;
            inventory[productName].xuat.count += 1;
            if (!inventory[productName].xuat.invoices.includes(invoice.id)) {
              inventory[productName].xuat.invoices.push(invoice.id);
            }
          } else {
            // Purchase = Nhập
            inventory[productName].nhap.sluong += quantity;
            inventory[productName].nhap.thtien += amount;
            inventory[productName].nhap.count += 1;
            if (!inventory[productName].nhap.invoices.includes(invoice.id)) {
              inventory[productName].nhap.invoices.push(invoice.id);
            }
          }

          // Calculate tồn kho
          inventory[productName].ton.sluong = 
            inventory[productName].nhap.sluong - inventory[productName].xuat.sluong;
          inventory[productName].ton.thtien = 
            inventory[productName].nhap.thtien - inventory[productName].xuat.thtien;
        });
      });

      setInventoryData(Object.values(inventory));
    };

    processInventoryData();
  }, [invoiceDetails, soldInvoices, purchaseInvoices, filterMST]);

  // Filter inventory data based on search term and selected invoice
  const filteredInventory = useMemo(() => {
    let filtered = inventoryData;

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.ten.toLowerCase().includes(searchLower)
      );
    }

    // Filter by selected invoice
    if (selectedInvoice) {
      filtered = filtered.filter(item => 
        item.nhap.invoices.includes(selectedInvoice) || 
        item.xuat.invoices.includes(selectedInvoice)
      );
    }

    return filtered;
  }, [inventoryData, searchTerm, selectedInvoice]);

  // Pagination
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredInventory.slice(startIndex, endIndex);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedInvoice]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredInventory.reduce(
      (acc, item) => ({
        nhap: {
          sluong: acc.nhap.sluong + item.nhap.sluong,
          thtien: acc.nhap.thtien + item.nhap.thtien,
          count: acc.nhap.count + item.nhap.count
        },
        xuat: {
          sluong: acc.xuat.sluong + item.xuat.sluong,
          thtien: acc.xuat.thtien + item.xuat.thtien,
          count: acc.xuat.count + item.xuat.count
        },
        ton: {
          sluong: acc.ton.sluong + item.ton.sluong,
          thtien: acc.ton.thtien + item.ton.thtien
        }
      }),
      {
        nhap: { sluong: 0, thtien: 0, count: 0 },
        xuat: { sluong: 0, thtien: 0, count: 0 },
        ton: { sluong: 0, thtien: 0 }
      }
    );
  }, [filteredInventory]);

  // Function to toggle product details
  const toggleProductDetails = (productName: string) => {
    setExpandedProduct(expandedProduct === productName ? null : productName);
  };

  // Export handlers
  const handleExportCSV = () => {
    const exportData = filteredInventory.map(item => ({
      ten: item.ten,
      nhap_sluong: item.nhap.sluong,
      nhap_thtien: item.nhap.thtien,
      nhap_count: item.nhap.count,
      xuat_sluong: item.xuat.sluong,
      xuat_thtien: item.xuat.thtien,
      xuat_count: item.xuat.count,
      ton_sluong: item.ton.sluong,
      ton_thtien: item.ton.thtien
    }));
    
    const filename = `xuat-nhap-ton-${new Date().toISOString().split('T')[0]}`;
    exportToCSV(exportData as any, filename);
  };

  const handleExportJSON = () => {
    const filename = `xuat-nhap-ton-${new Date().toISOString().split('T')[0]}`;
    exportToJSON(filteredInventory, filename);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-xl">Đang tải dữ liệu xuất nhập tồn...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumb items={[{ label: 'Xuất nhập tồn kho' }]} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-4">Báo cáo xuất nhập tồn kho</h1>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800">Tổng sản phẩm</h3>
              <p className="text-2xl font-bold text-blue-600">{filteredInventory.length}</p>
            </div>
            <div className="bg-green-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800">Tổng nhập</h3>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totals.nhap.thtien)}</p>
              <p className="text-sm text-green-700">{totals.nhap.count} lần nhập</p>
            </div>
            <div className="bg-red-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-red-800">Tổng xuất</h3>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totals.xuat.thtien)}</p>
              <p className="text-sm text-red-700">{totals.xuat.count} lần xuất</p>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-purple-800">Tồn kho</h3>
              <p className="text-xl font-bold text-purple-600">{formatCurrency(totals.ton.thtien)}</p>
              <p className="text-sm text-purple-700">{totals.ton.sluong.toLocaleString()} đơn vị</p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tìm kiếm sản phẩm</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nhập tên sản phẩm..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Lọc theo MST</label>
                <input
                  type="text"
                  value={filterMST}
                  onChange={(e) => setFilterMST(e.target.value)}
                  placeholder="Mã số thuế..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Lọc theo hóa đơn</label>
                <input
                  type="text"
                  value={selectedInvoice || ''}
                  onChange={(e) => setSelectedInvoice(e.target.value || null)}
                  placeholder="ID hóa đơn..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-4">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                📊 Xuất Excel
              </button>
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                📄 Xuất JSON
              </button>
              <Link
                href="/hoadon"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                📋 Xem hóa đơn
              </Link>
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        {currentItems.length > 0 ? (
          <>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tên sản phẩm
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Nhập
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Xuất
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Tồn kho
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentItems.map((item, index) => (
                      <React.Fragment key={index}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{item.ten}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm">
                              <div className="font-medium text-green-600">
                                {item.nhap.sluong.toLocaleString()} đơn vị
                              </div>
                              <div className="text-gray-500">
                                {formatCurrency(item.nhap.thtien)}
                              </div>
                              <div className="text-xs text-gray-400">
                                {item.nhap.count} lần nhập
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm">
                              <div className="font-medium text-red-600">
                                {item.xuat.sluong.toLocaleString()} đơn vị
                              </div>
                              <div className="text-gray-500">
                                {formatCurrency(item.xuat.thtien)}
                              </div>
                              <div className="text-xs text-gray-400">
                                {item.xuat.count} lần xuất
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm">
                              <div className={`font-medium ${
                                item.ton.sluong > 0 ? 'text-blue-600' : 
                                item.ton.sluong < 0 ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {item.ton.sluong.toLocaleString()} đơn vị
                              </div>
                              <div className="text-gray-500">
                                {formatCurrency(item.ton.thtien)}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleProductDetails(item.ten)}
                              className="text-blue-600 hover:text-blue-800 text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded"
                            >
                              {expandedProduct === item.ten ? '👁️ Ẩn' : '👁️ Chi tiết'}
                            </button>
                          </td>
                        </tr>
                        
                        {/* Expanded row for product details */}
                        {expandedProduct === item.ten && (
                          <tr>
                            <td colSpan={5} className="px-6 py-4 bg-gray-50">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Nhập */}
                                {item.nhap.invoices.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-green-700 mb-2">
                                      Hóa đơn nhập ({item.nhap.invoices.length})
                                    </h4>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                      {item.nhap.invoices.map(invoiceId => {
                                        const invoice = purchaseInvoices.find(inv => inv.id === invoiceId);
                                        return (
                                          <div key={invoiceId} className="flex justify-between items-center text-sm">
                                            <Link
                                              href={generateInvoiceUrl(invoiceId)}
                                              className="text-blue-600 hover:text-blue-800"
                                            >
                                              #{invoice?.shdon || invoiceId.slice(-8)}
                                            </Link>
                                            <span className="text-gray-500">
                                              {formatDate(invoice?.tdlap)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Xuất */}
                                {item.xuat.invoices.length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-red-700 mb-2">
                                      Hóa đơn xuất ({item.xuat.invoices.length})
                                    </h4>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                      {item.xuat.invoices.map(invoiceId => {
                                        const invoice = soldInvoices.find(inv => inv.id === invoiceId);
                                        return (
                                          <div key={invoiceId} className="flex justify-between items-center text-sm">
                                            <Link
                                              href={generateInvoiceUrl(invoiceId)}
                                              className="text-blue-600 hover:text-blue-800"
                                            >
                                              #{invoice?.shdon || invoiceId.slice(-8)}
                                            </Link>
                                            <span className="text-gray-500">
                                              {formatDate(invoice?.tdlap)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary row */}
              <tfoot className="bg-gray-100">
                <tr>
                  <td className="px-6 py-4 font-bold">TỔNG CỘNG</td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm">
                      <div className="font-bold text-green-600">
                        {totals.nhap.sluong.toLocaleString()} đơn vị
                      </div>
                      <div className="font-semibold text-gray-700">
                        {formatCurrency(totals.nhap.thtien)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm">
                      <div className="font-bold text-red-600">
                        {totals.xuat.sluong.toLocaleString()} đơn vị
                      </div>
                      <div className="font-semibold text-gray-700">
                        {formatCurrency(totals.xuat.thtien)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm">
                      <div className={`font-bold ${
                        totals.ton.sluong > 0 ? 'text-blue-600' : 
                        totals.ton.sluong < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {totals.ton.sluong.toLocaleString()} đơn vị
                      </div>
                      <div className="font-semibold text-gray-700">
                        {formatCurrency(totals.ton.thtien)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
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
                      Hiển thị <span className="font-medium">{startIndex + 1}</span> đến{' '}
                      <span className="font-medium">{Math.min(endIndex, filteredInventory.length)}</span> trong tổng số{' '}
                      <span className="font-medium">{filteredInventory.length}</span> sản phẩm
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        ← Trước
                      </button>
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
            <div className="text-gray-500 mb-4">
              {searchTerm || selectedInvoice
                ? 'Không tìm thấy sản phẩm nào phù hợp với bộ lọc'
                : 'Chưa có dữ liệu xuất nhập tồn kho'
              }
            </div>
            <div className="space-x-4">
              <Link 
                href="/hoadon"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                📋 Xem hóa đơn
              </Link>
              <Link 
                href="/"
                className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                🏠 Về trang chủ
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
