'use client';

import { useState, useEffect } from 'react';

// Define interfaces for TypeScript
interface InvoiceDetail {
  id: string;
  lastUpdated?: string;
  hdhhdvu?: ProductDetail[];
  [key: string]: any;
}

interface ProductDetail {
  idhdon: string;
  id: string;
  dgia: number | null;
  dvtinh: string | null;
  ltsuat: string;
  sluong: number | null;
  stbchu: string | null;
  stckhau: string | null;
  stt: number;
  tchat: string | null;
  ten: string | null;
  thtcthue: number | null;
  thtien: number;
  tlckhau: number | null;
  tsuat: number;
  tthue: number;
  sxep: number;
  ttkhac: any[];
  dvtte: string | null;
  tgia: number | null;
  tthhdtrung: any[];
}

interface InvoiceData {
  id: string;
  nbmst?: string;
  nmmst?: string;
  [key: string]: any;
}

interface InventoryItem {
  ten: string;
  nhap: {
    sluong: number;
    thtien: number;
    count: number;
  };
  xuat: {
    sluong: number;
    thtien: number;
    count: number;
  };
  ton: {
    sluong: number;
    thtien: number;
  };
}

// IndexedDB constants
const DB_NAME = 'InvoiceDB';
const DB_VERSION = 2;
const STORE_NAME_SOLD = 'invoice_sold';
const STORE_NAME_PURCHASE = 'invoice_purchase';
const STORE_NAME_DETAILS = 'invoice_details';

// Open IndexedDB
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
      
      if (!db.objectStoreNames.contains(STORE_NAME_DETAILS)) {
        db.createObjectStore(STORE_NAME_DETAILS, { keyPath: 'id' });
      }
    };
  });
};

// Load data from IndexedDB
const loadFromIndexedDB = async (storeName: string): Promise<any[]> => {
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

export default function XuatNhapTonPage() {
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetail[]>([]);
  const [soldInvoices, setSoldInvoices] = useState<InvoiceData[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<InvoiceData[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [filterMST, setFilterMST] = useState('5901209782'); // Default MST filter

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const [detailsData, soldData, purchaseData] = await Promise.all([
          loadFromIndexedDB(STORE_NAME_DETAILS),
          loadFromIndexedDB(STORE_NAME_SOLD),
          loadFromIndexedDB(STORE_NAME_PURCHASE)
        ]);

        setInvoiceDetails(detailsData);
        setSoldInvoices(soldData);
        setPurchaseInvoices(purchaseData);
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Lỗi khi tải dữ liệu từ IndexedDB');
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

      // Filter details for MST = 5901209782
      const filteredDetails = invoiceDetails.filter(detail => {
        // Find corresponding invoice to check MST
        const soldInvoice = soldInvoices.find(inv => inv.id === detail.id);
        const purchaseInvoice = purchaseInvoices.find(inv => inv.id === detail.id);
        const invoice = soldInvoice || purchaseInvoice;
        
        return invoice && (invoice.nbmst === filterMST || invoice.nmmst === filterMST);
      });

      filteredDetails.forEach(detail => {
        if (!detail.hdhhdvu || !Array.isArray(detail.hdhhdvu)) return;

        // Determine if this is purchase (nhập) or sale (xuất)
        const soldInvoice = soldInvoices.find(inv => inv.id === detail.id);
        const isPurchase = !soldInvoice; // If not in sold invoices, it's purchase

        detail.hdhhdvu.forEach((product: ProductDetail) => {
          const productName = product.ten || 'Không rõ tên';
          const quantity = product.sluong || 0;
          const amount = product.thtien || 0;

          if (!inventory[productName]) {
            inventory[productName] = {
              ten: productName,
              nhap: { sluong: 0, thtien: 0, count: 0 },
              xuat: { sluong: 0, thtien: 0, count: 0 },
              ton: { sluong: 0, thtien: 0 }
            };
          }

          if (isPurchase) {
            inventory[productName].nhap.sluong += quantity;
            inventory[productName].nhap.thtien += amount;
            inventory[productName].nhap.count += 1;
          } else {
            inventory[productName].xuat.sluong += quantity;
            inventory[productName].xuat.thtien += amount;
            inventory[productName].xuat.count += 1;
          }

          // Calculate inventory balance (ton = nhap - xuat)
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

  // Filter inventory data based on search term
  const filteredInventory = inventoryData.filter(item => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return item.ten.toLowerCase().includes(searchLower);
  });

  // Pagination
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredInventory.slice(startIndex, endIndex);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate totals
  const totals = filteredInventory.reduce(
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Đang tải dữ liệu xuất nhập tồn...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Lỗi:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Báo cáo Xuất Nhập Tồn</h1>
        
        {/* MST Filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mã số thuế:
          </label>
          <input
            type="text"
            value={filterMST}
            onChange={(e) => setFilterMST(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Nhập mã số thuế..."
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-100 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800">Tổng nhập</h3>
            <p className="text-xl font-bold text-blue-900">
              {totals.nhap.sluong.toLocaleString()} SP
            </p>
            <p className="text-sm text-blue-700">
              {totals.nhap.thtien.toLocaleString()} VND
            </p>
          </div>
          <div className="bg-red-100 p-4 rounded-lg">
            <h3 className="font-semibold text-red-800">Tổng xuất</h3>
            <p className="text-xl font-bold text-red-900">
              {totals.xuat.sluong.toLocaleString()} SP
            </p>
            <p className="text-sm text-red-700">
              {totals.xuat.thtien.toLocaleString()} VND
            </p>
          </div>
          <div className="bg-green-100 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800">Tồn kho</h3>
            <p className="text-xl font-bold text-green-900">
              {totals.ton.sluong.toLocaleString()} SP
            </p>
            <p className="text-sm text-green-700">
              {totals.ton.thtien.toLocaleString()} VND
            </p>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg">
            <h3 className="font-semibold text-yellow-800">Loại sản phẩm</h3>
            <p className="text-xl font-bold text-yellow-900">{filteredInventory.length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Tìm kiếm theo tên sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Báo cáo tồn kho ({filteredInventory.length} sản phẩm)
          </h2>
        </div>

        {currentItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có dữ liệu tồn kho'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tên sản phẩm
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nhập kho
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Xuất kho
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tồn kho
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentItems.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {item.ten}
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        <div className="text-blue-600 font-semibold">
                          {item.nhap.sluong.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.nhap.thtien.toLocaleString()} VND
                        </div>
                        <div className="text-xs text-gray-400">
                          ({item.nhap.count} lần)
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        <div className="text-red-600 font-semibold">
                          {item.xuat.sluong.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.xuat.thtien.toLocaleString()} VND
                        </div>
                        <div className="text-xs text-gray-400">
                          ({item.xuat.count} lần)
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        <div className={`font-semibold ${
                          item.ton.sluong > 0 ? 'text-green-600' : 
                          item.ton.sluong < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {item.ton.sluong.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.ton.thtien.toLocaleString()} VND
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Hiển thị {startIndex + 1} đến {Math.min(endIndex, filteredInventory.length)} của {filteredInventory.length} sản phẩm
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <span className="px-3 py-1 text-sm bg-blue-500 text-white rounded">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Export Actions */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => {
            const data = {
              exportDate: new Date().toISOString(),
              mst: filterMST,
              totalProducts: filteredInventory.length,
              totals,
              inventory: filteredInventory
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `xuat-nhap-ton-${filterMST}-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
          }}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          📊 Xuất JSON
        </button>
        
        <button
          onClick={() => {
            const headers = ['Tên sản phẩm', 'Nhập - SL', 'Nhập - Tiền', 'Xuất - SL', 'Xuất - Tiền', 'Tồn - SL', 'Tồn - Tiền'];
            const csvContent = [
              headers.join(','),
              ...filteredInventory.map(item => [
                `"${item.ten}"`,
                item.nhap.sluong,
                item.nhap.thtien,
                item.xuat.sluong,
                item.xuat.thtien,
                item.ton.sluong,
                item.ton.thtien
              ].join(','))
            ].join('\n');
            
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `xuat-nhap-ton-${filterMST}-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          📋 Xuất CSV
        </button>
      </div>
    </div>
  );
}
