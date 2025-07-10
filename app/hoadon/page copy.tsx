"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface InvoiceData {
  id: string;
  [key: string]: any;
}

interface SavedDataState {
  sold: InvoiceData[];
  purchase: InvoiceData[];
}

// Use the same IndexedDB constants from app/page.tsx
const DB_NAME = 'InvoiceDB';
const DB_VERSION = 1;
const STORE_NAME_SOLD = 'invoice_sold';
const STORE_NAME_PURCHASE = 'invoice_purchase';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME_SOLD)) {
        db.createObjectStore(STORE_NAME_SOLD, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORE_NAME_PURCHASE)) {
        db.createObjectStore(STORE_NAME_PURCHASE, { keyPath: 'id' });
      }
    };
  });
};

const loadFromIndexedDB = async (storeName: string): Promise<InvoiceData[]> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error loading data from ${storeName}:`, error);
    return [];
  }
};

// Export functions
const exportToExcel = (data: InvoiceData[], filename: string) => {
  // Create CSV content
  const headers = ['ID', 'Số hóa đơn', 'Ngày lập', 'Tên khách hàng', 'Tổng tiền', 'Trạng thái'];
  const csvContent = [
    headers.join(','),
    ...data.map(invoice => [
      invoice.id || '',
      invoice.shdon || invoice.soHoaDon || '',
      invoice.tdlap || invoice.ngayLap || '',
      `"${(invoice.nban || invoice.khachHang || '').replace(/"/g, '""')}"`,
      invoice.ttien || '',
      invoice.tthai === '1' ? 'Đã ký' : invoice.tthai === '0' ? 'Chưa ký' : invoice.trangThai || ''
    ].join(','))
  ].join('\n');

  // Add BOM for proper UTF-8 encoding in Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

const exportToJSON = (data: InvoiceData[], filename: string) => {
  const jsonData = {
    exportDate: new Date().toISOString(),
    totalRecords: data.length,
    invoices: data
  };
  
  const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export default function HoaDonPage() {
  const [invoiceData, setInvoiceData] = useState<SavedDataState>({
    sold: [],
    purchase: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sold' | 'purchase'>('sold');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    const loadInvoiceData = async () => {
      try {
        setLoading(true);
        const [soldData, purchaseData] = await Promise.all([
          loadFromIndexedDB(STORE_NAME_SOLD),
          loadFromIndexedDB(STORE_NAME_PURCHASE)
        ]);
        
        setInvoiceData({
          sold: soldData,
          purchase: purchaseData
        });
      } catch (error) {
        console.error('Error loading invoice data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInvoiceData();
  }, []);

  // Filter invoices based on search term
  const filteredInvoices = invoiceData[activeTab].filter(invoice => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return Object.values(invoice).some(value => 
      value && value.toString().toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInvoices = filteredInvoices.slice(startIndex, endIndex);

  // Reset pagination when changing tabs or search
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // Export handlers
  const handleExportExcel = () => {
    const filename = `hoa-don-${activeTab === 'sold' ? 'ban-ra' : 'mua-vao'}-${new Date().toISOString().split('T')[0]}`;
    exportToExcel(filteredInvoices, filename);
  };

  const handleExportJSON = () => {
    const filename = `hoa-don-${activeTab === 'sold' ? 'ban-ra' : 'mua-vao'}-${new Date().toISOString().split('T')[0]}`;
    exportToJSON(filteredInvoices, filename);
  };

  const handleExportAll = (format: 'excel' | 'json') => {
    const allData = [...invoiceData.sold, ...invoiceData.purchase];
    const filename = `tat-ca-hoa-don-${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'excel') {
      exportToExcel(allData, filename);
    } else {
      exportToJSON(allData, filename);
    }
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Danh sách hóa đơn điện tử</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800">Hóa đơn bán ra</h3>
          <p className="text-2xl font-bold text-blue-600">{invoiceData.sold.length}</p>
        </div>
        <div className="bg-green-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800">Hóa đơn mua vào</h3>
          <p className="text-2xl font-bold text-green-600">{invoiceData.purchase.length}</p>
        </div>
        <div className="bg-purple-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-800">Tổng cộng</h3>
          <p className="text-2xl font-bold text-purple-600">
            {invoiceData.sold.length + invoiceData.purchase.length}
          </p>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Xuất dữ liệu hiện tại:</span>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              disabled={filteredInvoices.length === 0}
            >
              📊 Excel/CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              disabled={filteredInvoices.length === 0}
            >
              📄 JSON
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Xuất tất cả:</span>
            <button
              onClick={() => handleExportAll('excel')}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
              disabled={invoiceData.sold.length + invoiceData.purchase.length === 0}
            >
              📊 Tất cả Excel
            </button>
            <button
              onClick={() => handleExportAll('json')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
              disabled={invoiceData.sold.length + invoiceData.purchase.length === 0}
            >
              📄 Tất cả JSON
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('sold')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'sold'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Hóa đơn bán ra ({invoiceData.sold.length})
        </button>
        <button
          onClick={() => setActiveTab('purchase')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'purchase'
              ? 'bg-white text-green-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Hóa đơn mua vào ({invoiceData.purchase.length})
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Tìm kiếm hóa đơn..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Invoice Table */}
      {currentInvoices.length > 0 ? (
        <>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Số hóa đơn
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ngày lập
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tên khách hàng
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tổng tiền
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentInvoices.map((invoice, index) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.shdon || invoice.soHoaDon || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.tdlap || invoice.ngayLap || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.nban || invoice.khachHang || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.ttien ? new Intl.NumberFormat('vi-VN', {
                          style: 'currency',
                          currency: 'VND'
                        }).format(parseFloat(invoice.ttien)) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          invoice.tthai === '1' || invoice.trangThai === 'Đã thanh toán'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {invoice.tthai === '1' ? 'Đã ký' : 
                           invoice.tthai === '0' ? 'Chưa ký' :
                           invoice.trangThai || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/hoadonchitiet?id=${invoice.id}`}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-100 hover:bg-indigo-200 px-3 py-1 rounded-md transition-colors"
                        >
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredInvoices.length)} 
                trong tổng số {filteredInvoices.length} hóa đơn
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-600 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Trước
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
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === pageNum
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-600 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-gray-500">
            {searchTerm ? 
              `Không tìm thấy hóa đơn nào phù hợp với "${searchTerm}"` :
              `Chưa có dữ liệu hóa đơn ${activeTab === 'sold' ? 'bán ra' : 'mua vào'}`
            }
          </div>
          {!searchTerm && (
            <p className="text-sm text-gray-400 mt-2">
              Vui lòng tải dữ liệu từ trang chính trước
            </p>
          )}
        </div>
      )}
    </div>
  );
}
