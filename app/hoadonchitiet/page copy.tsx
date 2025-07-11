"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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

// Use the same IndexedDB constants from app/page.tsx
const DB_NAME = 'InvoiceDB';
const DB_VERSION = 3;
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

const findInvoiceById = async (invoiceId: string): Promise<InvoiceData | null> => {
  try {
    const [soldData, purchaseData] = await Promise.all([
      loadFromIndexedDB(STORE_NAME_SOLD),
      loadFromIndexedDB(STORE_NAME_PURCHASE)
    ]);
    
    const allInvoices = [...soldData, ...purchaseData];
    return allInvoices.find(invoice => invoice.id === invoiceId) || null;
  } catch (error) {
    console.error('Error finding invoice:', error);
    return null;
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

export default function HoaDonChiTietPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI1OTAxMjA5NzgyIiwidHlwZSI6MiwiZXhwIjoxNzUyMjIxOTI4LCJpYXQiOjE3NTIxMzU1Mjh9.vJV8m2B2zCm1BjZI6WexG8DW8vmIoI-ZLljpK8ga2zoheXAO3hUBHP3b0CFctLVzLbnheZLXfuuVmp3GGnzhaw');

  const invoiceId = searchParams.get('id');

  useEffect(() => {
    const loadInvoiceData = async () => {
      if (!invoiceId) {
        setError('Không tìm thấy ID hóa đơn');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const invoice = await findInvoiceById(invoiceId);
        
        if (!invoice) {
          setError('Không tìm thấy hóa đơn trong cơ sở dữ liệu');
          setLoading(false);
          return;
        }

        setInvoiceData(invoice);
        
        // Auto load detail if we have required parameters
        if (invoice.nbmst && invoice.khhdon && invoice.shdon && invoice.khmshdon) {
          await loadInvoiceDetail(
            invoice.nbmst, 
            invoice.khhdon, 
            invoice.shdon, 
            invoice.khmshdon
          );
        }
      } catch (error) {
        console.error('Error loading invoice data:', error);
        setError('Lỗi khi tải dữ liệu hóa đơn');
      } finally {
        setLoading(false);
      }
    };

    loadInvoiceData();
  }, [invoiceId]);

  const loadInvoiceDetail = async (
    nbmst: string, 
    khhdon: string, 
    shdon: string, 
    khmshdon: string
  ) => {
    try {
      setDetailLoading(true);
      setError(null);
      
      const detail = await fetchInvoiceDetail(nbmst, khhdon, shdon, khmshdon, token);
      setInvoiceDetail(detail);
    } catch (error) {
      console.error('Error loading invoice detail:', error);
      setError(`Lỗi khi tải chi tiết hóa đơn: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const formatCurrency = (amount: string | number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(parseFloat(amount.toString()));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      // Handle different date formats
      let date: Date;
      if (dateString.includes('T')) {
        date = new Date(dateString);
      } else if (dateString.includes('/')) {
        // DD/MM/YYYY format
        const [day, month, year] = dateString.split('/');
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        date = new Date(dateString);
      }
      
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const renderObjectData = (data: any, title: string) => {
    if (!data || typeof data !== 'object') return null;

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">{title}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(data).map(([key, value]) => {
            if (value === null || value === undefined || value === '') return null;
            
            let displayValue: string;
            if (typeof value === 'object') {
              displayValue = JSON.stringify(value, null, 2);
            } else if (key.toLowerCase().includes('tien') || key.toLowerCase().includes('thue')) {
              displayValue = formatCurrency(value.toString());
            } else if (key.toLowerCase().includes('ngay') || key.toLowerCase().includes('date') || key === 'tdlap') {
              displayValue = formatDate(value.toString());
            } else {
              displayValue = value.toString();
            }

            return (
              <div key={key} className="p-3 bg-gray-50 rounded border">
                <div className="text-sm font-medium text-gray-600 mb-1">{key}</div>
                <div className="text-sm text-gray-900 break-words">
                  {typeof value === 'object' ? (
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                      {displayValue}
                    </pre>
                  ) : (
                    displayValue
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Đang tải thông tin hóa đơn...</div>
        </div>
      </div>
    );
  }

  if (error && !invoiceData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Lỗi:</strong> {error}
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Chi tiết hóa đơn</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            ← Quay lại
          </button>
          {invoiceData && invoiceData.nbmst && invoiceData.khhdon && invoiceData.shdon && invoiceData.khmshdon && (
            <button
              onClick={() => loadInvoiceDetail(
                invoiceData.nbmst!, 
                invoiceData.khhdon!, 
                invoiceData.shdon!, 
                invoiceData.khmshdon!
              )}
              disabled={detailLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {detailLoading ? 'Đang tải...' : '🔄 Tải chi tiết từ API'}
            </button>
          )}
        </div>
      </div>

      {/* Token Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Authorization Token:
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Lỗi:</strong> {error}
        </div>
      )}

      {/* Invoice Basic Info */}
      {invoiceData && (
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">Thông tin cơ bản</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <span className="font-medium text-gray-600">ID:</span>
              <p className="text-gray-900">{invoiceData.id}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Số hóa đơn:</span>
              <p className="text-gray-900">{invoiceData.shdon || 'N/A'}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Ngày lập:</span>
              <p className="text-gray-900">{formatDate(invoiceData.tdlap || '')}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600">Tổng tiền:</span>
              <p className="text-gray-900">{formatCurrency(invoiceData.ttien || 0)}</p>
            </div>
          </div>
          
          {/* API Parameters */}
          {invoiceData.nbmst && invoiceData.khhdon && invoiceData.shdon && invoiceData.khmshdon && (
            <div className="mt-4 p-4 bg-white rounded border">
              <h3 className="font-medium text-gray-700 mb-2">Thông số API:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">nbmst:</span> {invoiceData.nbmst}
                </div>
                <div>
                  <span className="font-medium">khhdon:</span> {invoiceData.khhdon}
                </div>
                <div>
                  <span className="font-medium">shdon:</span> {invoiceData.shdon}
                </div>
                <div>
                  <span className="font-medium">khmshdon:</span> {invoiceData.khmshdon}
                </div>
              </div>
              <div className="mt-2">
                <span className="font-medium">API URL:</span>
                <code className="text-xs bg-gray-100 p-1 rounded ml-2 break-all">
                  https://hoadondientu.gdt.gov.vn:30000/query/invoices/detail?nbmst={invoiceData.nbmst}&khhdon={invoiceData.khhdon}&shdon={invoiceData.shdon}&khmshdon={invoiceData.khmshdon}
                </code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice Detail from API */}
      {detailLoading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
            <span>Đang tải chi tiết hóa đơn từ API...</span>
          </div>
        </div>
      )}

      {invoiceDetail && renderObjectData(invoiceDetail, "Chi tiết hóa đơn từ API")}

      {/* Invoice Data from IndexedDB */}
      {invoiceData && renderObjectData(invoiceData, "Dữ liệu hóa đơn từ IndexedDB")}

      {/* Instructions */}
      {invoiceData && (!invoiceData.nbmst || !invoiceData.khhdon || !invoiceData.shdon || !invoiceData.khmshdon) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-2">Thông báo:</h3>
          <p className="text-yellow-700">
            Hóa đơn này thiếu thông tin cần thiết để gọi API chi tiết (nbmst, khhdon, shdon, khmshdon).
            Chỉ có thể hiển thị dữ liệu từ IndexedDB.
          </p>
        </div>
      )}

      {!invoiceData && !loading && (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600">Không tìm thấy dữ liệu hóa đơn</p>
        </div>
      )}
    </div>
  );
}
