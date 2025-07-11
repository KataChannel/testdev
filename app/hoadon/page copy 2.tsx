"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface InvoiceData {
  id: string;
  nbmst?: string;
  khhdon?: string;
  shdon?: string;
  khmshdon?: string;
  [key: string]: any;
}

interface InvoiceDetail {
  [key: string]: any;
}

interface SavedDataState {
  sold: InvoiceData[];
  purchase: InvoiceData[];
}

// Use the same IndexedDB constants from app/page.tsx
const DB_NAME = 'InvoiceDB';
const DB_VERSION = 3;
const STORE_NAME_SOLD = 'invoice_sold';
const STORE_NAME_PURCHASE = 'invoice_purchase';
const STORE_NAME_DETAILS = 'invoice_details';

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

      // Create new store for invoice details
      if (!db.objectStoreNames.contains(STORE_NAME_DETAILS)) {
        db.createObjectStore(STORE_NAME_DETAILS, { keyPath: 'id' });
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

const saveDetailToIndexedDB = async (invoiceId: string, detail: InvoiceDetail): Promise<void> => {
  try {
    const db = await openDB();
    
    const transaction = db.transaction([STORE_NAME_DETAILS], 'readwrite');
    const store = transaction.objectStore(STORE_NAME_DETAILS);
    
    const detailWithId = {
      id: invoiceId,
      ...detail,
      lastUpdated: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const request = store.put(detailWithId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error saving detail for invoice ${invoiceId}:`, error);
    throw error;
  }
};

const checkDetailExists = async (invoiceId: string): Promise<boolean> => {
  try {
    const db = await openDB();
    
    const transaction = db.transaction([STORE_NAME_DETAILS], 'readonly');
    const store = transaction.objectStore(STORE_NAME_DETAILS);
    
    return new Promise((resolve, reject) => {
      const request = store.get(invoiceId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error checking detail for invoice ${invoiceId}:`, error);
    return false;
  }
};

const fetchInvoiceDetail = async (
  nbmst: string,
  khhdon: string,
  shdon: string,
  khmshdon: string,
  token: string
): Promise<InvoiceDetail> => {
  const url = `https://hoadondientu.gdt.gov.vn:30000/query/invoices/detail?nbmst=${nbmst}&khhdon=${khhdon}&shdon=${shdon}&khmshdon=${khmshdon}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
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

  // Detail loading states
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailProgress, setDetailProgress] = useState({ current: 0, total: 0, processed: 0, errors: 0 });
  const [token, setToken] = useState<string>('eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI1OTAxMjA5NzgyIiwidHlwZSI6MiwiZXhwIjoxNzUyMjIxOTI4LCJpYXQiOjE3NTIxMzU1Mjh9.vJV8m2B2zCm1BjZI6WexG8DW8vmIoI-ZLljpK8ga2zoheXAO3hUBHP3b0CFctLVzLbnheZLXfuuVmp3GGnzhaw');
  const [delayBetweenRequests, setDelayBetweenRequests] = useState<number>(2000); // Default 2 seconds

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

  // Utility function to delay execution
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Load all invoice details
  const loadAllInvoiceDetails = async () => {
    if (!token.trim()) {
      alert('Vui lòng nhập Authorization Token');
      return;
    }

    const currentInvoices = invoiceData[activeTab];
    
    // Filter invoices that have required parameters
    const validInvoices = currentInvoices.filter(invoice => 
      invoice.nbmst && invoice.khhdon && invoice.shdon && invoice.khmshdon
    );

    if (validInvoices.length === 0) {
      alert('Không có hóa đơn nào có đủ thông tin để tải chi tiết (nbmst, khhdon, shdon, khmshdon)');
      return;
    }

    const confirmed = window.confirm(
      `Bạn có muốn tải chi tiết cho ${validInvoices.length} hóa đơn ${activeTab === 'sold' ? 'bán ra' : 'mua vào'}?\n\n` +
      `Thời gian ước tính: ${Math.ceil(validInvoices.length * delayBetweenRequests / 1000 / 60)} phút\n` +
      `Delay giữa các request: ${delayBetweenRequests}ms`
    );

    if (!confirmed) return;

    setDetailLoading(true);
    setDetailProgress({ current: 0, total: validInvoices.length, processed: 0, errors: 0 });

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    try {
      for (let i = 0; i < validInvoices.length; i++) {
        const invoice = validInvoices[i];
        
        setDetailProgress(prev => ({ ...prev, current: i + 1 }));

        try {
          // Check if detail already exists
          const detailExists = await checkDetailExists(invoice.id);
          
          if (detailExists) {
            skipped++;
            console.log(`Detail already exists for invoice ${invoice.id}, skipping...`);
            continue;
          }

          // Fetch detail from API
          const detail = await fetchInvoiceDetail(
            invoice.nbmst!,
            invoice.khhdon!,
            invoice.shdon!,
            invoice.khmshdon!,
            token
          );

          // Save to IndexedDB
          await saveDetailToIndexedDB(invoice.id, detail);
          processed++;
          
          // console.log(`Successfully loaded and saved detail for invoice ${invoice.id}`);

        } catch (error) {
          errors++;
          console.error(`Error loading detail for invoice ${invoice.id}:`, error);
        }

        setDetailProgress(prev => ({ ...prev, processed, errors }));

        // Add delay between requests (except for the last one)
        if (i < validInvoices.length - 1) {
          await delay(delayBetweenRequests);
        }
      }

      // Show completion message
      const message = `Hoàn thành tải chi tiết hóa đơn!\n\n` +
        `Tổng số: ${validInvoices.length}\n` +
        `Đã xử lý: ${processed}\n` +
        `Bỏ qua (đã có): ${skipped}\n` +
        `Lỗi: ${errors}`;
      
      alert(message);

    } catch (error) {
      console.error('Error in loadAllInvoiceDetails:', error);
      alert(`Lỗi khi tải chi tiết hóa đơn: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDetailLoading(false);
      setDetailProgress({ current: 0, total: 0, processed: 0, errors: 0 });
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

      {/* Detail Loading Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Tải chi tiết hóa đơn từ API</h2>
        
        {/* Token Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Authorization Token:</label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 text-xs"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Bearer token"
            disabled={detailLoading}
          />
        </div>

        {/* Delay Setting and Load Button */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Delay (ms):</label>
            <input
              type="number"
              min="500"
              max="10000"
              step="500"
              className="w-24 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={delayBetweenRequests}
              onChange={(e) => setDelayBetweenRequests(parseInt(e.target.value) || 2000)}
              disabled={detailLoading}
            />
            <span className="text-xs text-gray-600">(2000ms khuyến nghị)</span>
          </div>
          
          <button
            onClick={loadAllInvoiceDetails}
            disabled={detailLoading || !token.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {detailLoading ? 'Đang tải...' : `🔄 Tải tất cả chi tiết ${activeTab === 'sold' ? 'bán ra' : 'mua vào'}`}
          </button>

          {detailLoading && (
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div>
                {detailProgress.current}/{detailProgress.total} ({Math.round((detailProgress.current / detailProgress.total) * 100)}%) | 
                Xử lý: {detailProgress.processed} | Lỗi: {detailProgress.errors}
              </div>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(detailProgress.current / detailProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          📊 Xuất Excel
        </button>
        <button
          onClick={handleExportJSON}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          📄 Xuất JSON
        </button>
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
          disabled={detailLoading}
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
          disabled={detailLoading}
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
          disabled={detailLoading}
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
                      API Params
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentInvoices.map((invoice) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {invoice.nbmst && invoice.khhdon && invoice.shdon && invoice.khmshdon ? (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            ✓ Đầy đủ
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                            ✗ Thiếu
                          </span>
                        )}
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
                  disabled={currentPage === 1 || detailLoading}
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
                      disabled={detailLoading}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === pageNum
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      } disabled:opacity-50`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || detailLoading}
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
