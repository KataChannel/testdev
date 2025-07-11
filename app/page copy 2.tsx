'use client';

import { useState, useEffect } from 'react';

interface QueryParams {
  fromDate: string;
  toDate: string;
  sort: string;
  size: number;
  token: string;
  invoiceType: 'sold' | 'purchase';
}

interface InvoiceData {
  id: string;
  [key: string]: any;
}

interface SavedDataState {
  sold: InvoiceData[];
  purchase: InvoiceData[];
}

interface ApiResponse {
  datas: InvoiceData[];
  total: number;
  state: string;
  time: number;
}

// IndexedDB utility functions
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

const saveToIndexedDB = async (storeName: string, data: InvoiceData[]): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  
  // Clear existing data
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(clearRequest.error);
  });
  
  // Add new data
  for (const item of data) {
    await new Promise<void>((resolve, reject) => {
      const addRequest = store.add(item);
      addRequest.onsuccess = () => resolve();
      addRequest.onerror = () => reject(addRequest.error);
    });
  }
  
  db.close();
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

const clearIndexedDB = async (storeName?: string): Promise<void> => {
  const db = await openDB();
  
  if (storeName) {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } else {
    // Clear both stores
    const transaction = db.transaction([STORE_NAME_SOLD, STORE_NAME_PURCHASE], 'readwrite');
    const soldStore = transaction.objectStore(STORE_NAME_SOLD);
    const purchaseStore = transaction.objectStore(STORE_NAME_PURCHASE);
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = soldStore.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = purchaseStore.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);
  }
  
  db.close();
};

export default function Home() {
  const [formData, setFormData] = useState<QueryParams>({
    fromDate: '2025-01-01T00:00',
    toDate: '2025-01-31T23:59',
    sort: 'tdlap:desc,khmshdon:asc,shdon:desc',
    size: 50,
    token: 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI1OTAxMjA5NzgyIiwidHlwZSI6MiwiZXhwIjoxNzUyMjIxOTI4LCJpYXQiOjE3NTIxMzU1Mjh9.vJV8m2B2zCm1BjZI6WexG8DW8vmIoI-ZLljpK8ga2zoheXAO3hUBHP3b0CFctLVzLbnheZLXfuuVmp3GGnzhaw',
    invoiceType: 'sold'
  });
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<SavedDataState>({
    sold: [],
    purchase: []
  });
  const [currentState, setCurrentState] = useState<string>('');
  const [totalInvoices, setTotalInvoices] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Load saved data from IndexedDB on component mount
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const [soldData, purchaseData] = await Promise.all([
          loadFromIndexedDB(STORE_NAME_SOLD),
          loadFromIndexedDB(STORE_NAME_PURCHASE)
        ]);
        
        setSavedData({
          sold: soldData,
          purchase: purchaseData
        });
      } catch (error) {
        console.error('Error loading stored data:', error);
      }
    };
    
    loadStoredData();
  }, []);

  // Save data to IndexedDB
  const saveToStorage = async (type: 'sold' | 'purchase', data: InvoiceData[]) => {
    const storeName = type === 'sold' ? STORE_NAME_SOLD : STORE_NAME_PURCHASE;
    try {
      await saveToIndexedDB(storeName, data);
      setSavedData(prev => ({
        ...prev,
        [type]: data
      }));
    } catch (error) {
      console.error(`Error saving data to ${storeName}:`, error);
    }
  };

  // Check for duplicates and merge new data
  const mergeData = async (newData: InvoiceData[], type: 'sold' | 'purchase') => {
    const currentData = savedData[type];
    const existingIds = new Set(currentData.map(item => item.id));
    const uniqueNewData = newData.filter(item => !existingIds.has(item.id));
    
    if (uniqueNewData.length > 0) {
      const mergedData = [...currentData, ...uniqueNewData];
      await saveToStorage(type, mergedData);
      return {
        added: uniqueNewData.length,
        duplicates: newData.length - uniqueNewData.length,
        total: mergedData.length
      };
    }
    
    return {
      added: 0,
      duplicates: newData.length,
      total: currentData.length
    };
  };

  // Clear saved data for specific type
  const clearSavedData = async (type?: 'sold' | 'purchase') => {
    try {
      if (type) {
        const storeName = type === 'sold' ? STORE_NAME_SOLD : STORE_NAME_PURCHASE;
        await clearIndexedDB(storeName);
        setSavedData(prev => ({
          ...prev,
          [type]: []
        }));
      } else {
        // Clear all data
        await clearIndexedDB();
        setSavedData({
          sold: [],
          purchase: []
        });
      }
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  };

  // Reset state when changing month or invoice type
  const resetState = () => {
    setCurrentState('');
    setCurrentPage(1);
    setTotalInvoices(0);
    setResponse(null);
    setError(null);
  };

  const months = [
    { name: 'Tháng 1', value: 1 },
    { name: 'Tháng 2', value: 2 },
    { name: 'Tháng 3', value: 3 },
    { name: 'Tháng 4', value: 4 },
    { name: 'Tháng 5', value: 5 },
    { name: 'Tháng 6', value: 6 },
    { name: 'Tháng 7', value: 7 },
    { name: 'Tháng 8', value: 8 },
    { name: 'Tháng 9', value: 9 },
    { name: 'Tháng 10', value: 10 },
    { name: 'Tháng 11', value: 11 },
    { name: 'Tháng 12', value: 12 }
  ];

  const setMonthRange = (month: number, year: number = new Date().getFullYear()) => {
    const fromDate = new Date(year, month - 1, 2, 0, 0);
    const toDate = new Date(year, month, 0, 23, 59);

    const formatDateTime = (date: Date) => {
      return date.toISOString().slice(0, 16);
    };  
    setFormData(prev => ({
      ...prev,
      fromDate: formatDateTime(fromDate),
      toDate: formatDateTime(toDate)
    }));
    // Reset state when changing month
    resetState();
  };

  const generateURL = (state?: string) => {
    const formatDateForAPI = (dateString: string) => {
      const [datePart, timePart] = dateString.split('T');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}T${timePart}`;
    };

    const fromDateFormatted = formatDateForAPI(formData.fromDate) + ':00';
    const toDateFormatted = formatDateForAPI(formData.toDate) + ':59';
    
    let url = `https://hoadondientu.gdt.gov.vn:30000/query/invoices/${formData.invoiceType}?sort=${formData.sort}&size=${formData.size}&search=tdlap=ge=${fromDateFormatted};tdlap=le=${toDateFormatted}`;
    
    if (state) {
      url += `&state=${state}`;
    }
    
    return url;
  };

  const handleInputChange = (field: keyof QueryParams, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Reset state when changing invoice type
    if (field === 'invoiceType') {
      resetState();
    }
  };

  const fetchInvoices = async (state?: string): Promise<ApiResponse> => {
    const url = generateURL(state);
    const apiResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${formData.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      throw new Error(`HTTP error! status: ${apiResponse.status}`);
    }

    return await apiResponse.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    resetState();
    
    try {
      let allInvoices: InvoiceData[] = [];
      let currentStateParam = '';
      let page = 1;
      let totalProcessed = 0;
      let hasMoreData = true;

      // Auto load all pages until no more data
      while (hasMoreData) {
        setCurrentPage(page);
        const data = await fetchInvoices(currentStateParam || undefined);
        setResponse(data);
        setTotalInvoices(data.total);

        if (data && Array.isArray(data.datas) && data.datas.length > 0) {
          allInvoices = [...allInvoices, ...data.datas];
          totalProcessed += data.datas.length;
          
          setError(`Đang tải trang ${page}: ${data.datas.length} hóa đơn. Tổng đã tải: ${totalProcessed}/${data.total}`);

          // Check if we need to continue pagination
          if (data.state && totalProcessed < data.total) {
            currentStateParam = data.state;
            setCurrentState(data.state);
            page++;
            
            // Add a small delay to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            // No more data or reached the end
            hasMoreData = false;
          }
        } else {
          // No data returned, stop loading
          hasMoreData = false;
        }
      }

      // Save all collected invoices
      if (allInvoices.length > 0) {
        const mergeResult = await mergeData(allInvoices, formData.invoiceType);
        setError(`Hoàn thành! Đã tải ${page} trang. Thêm ${mergeResult.added} hóa đơn mới (${formData.invoiceType}), ${mergeResult.duplicates} hóa đơn trùng lặp. Tổng trong DB: ${mergeResult.total} hóa đơn.`);
      } else {
        setError('Không có dữ liệu hóa đơn nào được tải về.');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyURL = () => {
    navigator.clipboard.writeText(generateURL(currentState || undefined));
  };

  return (
    <div className="w-full mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold text-center mb-8">Query Invoice API</h1>
      <div className="w-full flex flex-row gap-4 mb-6">
      <form onSubmit={handleSubmit} className="w-2/3 space-y-6 bg-white p-6 rounded-lg shadow-md">
        {/* Invoice Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Loại hóa đơn:
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="invoiceType"
                value="sold"
                checked={formData.invoiceType === 'sold'}
                onChange={(e) => handleInputChange('invoiceType', e.target.value)}
                className="mr-2"
              />
              <span className="text-sm">Bán ra (Sold)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="invoiceType"
                value="purchase"
                checked={formData.invoiceType === 'purchase'}
                onChange={(e) => handleInputChange('invoiceType', e.target.value)}
                className="mr-2"
              />
              <span className="text-sm">Mua vào (Purchase)</span>
            </label>
          </div>
        </div>

        {/* Month Selection Buttons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Chọn tháng nhanh (từ ngày 1):
          </label>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-12 gap-2">
            {months.map((month) => (
              <button
                key={month.value}
                type="button"
                onClick={() => setMonthRange(month.value)}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                {month.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.fromDate}
              onChange={(e) => handleInputChange('fromDate', e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Date
            </label>
            <input
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.toDate}
              onChange={(e) => handleInputChange('toDate', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.sort}
              onChange={(e) => handleInputChange('sort', e.target.value)}
              placeholder="Sort parameters"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Size
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formData.size}
              onChange={(e) => handleInputChange('size', parseInt(e.target.value))}
              min="1"
              max="100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Authorization Token
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
              value={formData.token}
              onChange={(e) => handleInputChange('token', e.target.value)}
              placeholder="Bearer token"
            />
          </div>

          <div className="bg-gray-100 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Generated URL:</h3>
            <code className="text-sm bg-white p-2 rounded block overflow-x-auto">
              {generateURL(currentState || undefined)}
            </code>
            {currentState && (
              <p className="text-xs text-gray-600 mt-2">
                State: {currentState.substring(0, 50)}...
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? `Đang tải tự động... (Trang ${currentPage})` : 'Tải hết dữ liệu tháng'}
          </button>
          <button
            type="button"
            onClick={copyURL}
            className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors"
          >
            Copy URL
          </button>
          <button
            type="button"
            onClick={() => clearSavedData(formData.invoiceType)}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Clear {formData.invoiceType === 'sold' ? 'Sold' : 'Purchase'}
          </button>
          <button
            type="button"
            onClick={() => clearSavedData()}
            className="flex-1 bg-red-800 text-white py-2 px-4 rounded-md hover:bg-red-900 transition-colors"
          >
            Clear All
          </button>
        </div>
      </form>

      {/* Saved Data Summary */}
      <div className="w-1/3 bg-white p-6 rounded-lg shadow-md space-y-4">
        <div className="bg-green-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Dữ liệu đã lưu (IndexedDB):</h3>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Hóa đơn bán ra:</span> {savedData.sold.length}
            </p>
            <p className="text-sm">
              <span className="font-medium">Hóa đơn mua vào:</span> {savedData.purchase.length}
            </p>
            <p className="text-sm">
              <span className="font-medium">Tổng cộng:</span> {savedData.sold.length + savedData.purchase.length}
            </p>
            <p className="text-sm">
              <span className="font-medium">Loại hiện tại:</span> {formData.invoiceType === 'sold' ? 'Bán ra' : 'Mua vào'}
            </p>
            {totalInvoices > 0 && (
              <p className="text-sm">
                <span className="font-medium">Tổng trên server:</span> {totalInvoices}
              </p>
            )}
            {loading && (
              <p className="text-sm text-blue-600">
                <span className="font-medium">Đang tải trang:</span> {currentPage}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <strong>Info:</strong> {error}
          </div>
        )}

        {response && (
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-2">API Response:</h3>
            <pre className="text-sm bg-gray-100 p-4 rounded overflow-x-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
