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
const DB_VERSION = 2;
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

// Export all IndexedDB data to JSON file
const exportAllData = async (): Promise<void> => {
  try {
    const [soldData, purchaseData, detailsData] = await Promise.all([
      loadFromIndexedDB(STORE_NAME_SOLD),
      loadFromIndexedDB(STORE_NAME_PURCHASE),
      loadFromIndexedDB('invoice_details') // Add details store if exists
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      version: DB_VERSION,
      data: {
        sold: soldData,
        purchase: purchaseData,
        details: detailsData
      },
      summary: {
        totalSold: soldData.length,
        totalPurchase: purchaseData.length,
        totalDetails: detailsData.length,
        totalRecords: soldData.length + purchaseData.length + detailsData.length
      }
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting data:', error);
    throw new Error(`Lỗi khi xuất dữ liệu: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Import data from JSON file to IndexedDB
const importAllData = async (file: File): Promise<{success: boolean, message: string}> => {
  try {
    const fileContent = await file.text();
    const importData = JSON.parse(fileContent);
    
    // Validate file structure
    if (!importData.data || !importData.data.sold || !importData.data.purchase) {
      throw new Error('File không đúng định dạng. Cần có cấu trúc data.sold và data.purchase');
    }

    const db = await openDB();
    
    // Clear existing data first (optional - you can modify this behavior)
    const clearTransaction = db.transaction([STORE_NAME_SOLD, STORE_NAME_PURCHASE, 'invoice_details'], 'readwrite');
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const clearRequest = clearTransaction.objectStore(STORE_NAME_SOLD).clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      }),
      new Promise<void>((resolve, reject) => {
        const clearRequest = clearTransaction.objectStore(STORE_NAME_PURCHASE).clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      }),
      new Promise<void>((resolve, reject) => {
        if (db.objectStoreNames.contains('invoice_details')) {
          const clearRequest = clearTransaction.objectStore('invoice_details').clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => reject(clearRequest.error);
        } else {
          resolve();
        }
      })
    ]);

    // Import sold invoices
    if (importData.data.sold.length > 0) {
      const soldTransaction = db.transaction([STORE_NAME_SOLD], 'readwrite');
      const soldStore = soldTransaction.objectStore(STORE_NAME_SOLD);
      
      for (const item of importData.data.sold) {
        await new Promise<void>((resolve, reject) => {
          const addRequest = soldStore.add(item);
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => reject(addRequest.error);
        });
      }
    }

    // Import purchase invoices
    if (importData.data.purchase.length > 0) {
      const purchaseTransaction = db.transaction([STORE_NAME_PURCHASE], 'readwrite');
      const purchaseStore = purchaseTransaction.objectStore(STORE_NAME_PURCHASE);
      
      for (const item of importData.data.purchase) {
        await new Promise<void>((resolve, reject) => {
          const addRequest = purchaseStore.add(item);
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => reject(addRequest.error);
        });
      }
    }

    // Import details if exists
    if (importData.data.details && importData.data.details.length > 0 && db.objectStoreNames.contains('invoice_details')) {
      const detailsTransaction = db.transaction(['invoice_details'], 'readwrite');
      const detailsStore = detailsTransaction.objectStore('invoice_details');
      
      for (const item of importData.data.details) {
        await new Promise<void>((resolve, reject) => {
          const addRequest = detailsStore.add(item);
          addRequest.onsuccess = () => resolve();
          addRequest.onerror = () => reject(addRequest.error);
        });
      }
    }

    db.close();

    return {
      success: true,
      message: `Nhập thành công: ${importData.summary?.totalSold || 0} hóa đơn bán, ${importData.summary?.totalPurchase || 0} hóa đơn mua, ${importData.summary?.totalDetails || 0} chi tiết`
    };

  } catch (error) {
    console.error('Error importing data:', error);
    return {
      success: false,
      message: `Lỗi khi nhập dữ liệu: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
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
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [delayBetweenRequests, setDelayBetweenRequests] = useState<number>(1000); // Default 1 second
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

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

  // Handle month selection (single or multiple)
  const toggleMonthSelection = (month: number) => {
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        return prev.filter(m => m !== month);
      } else {
        return [...prev, month].sort();
      }
    });
  };

  // Set date range for selected months
  const setSelectedMonthsRange = () => {
    if (selectedMonths.length === 0) return;

    const sortedMonths = [...selectedMonths].sort();
    const firstMonth = sortedMonths[0];
    const lastMonth = sortedMonths[sortedMonths.length - 1];

    const fromDate = new Date(selectedYear, firstMonth - 1, 2, 0, 0);
    const toDate = new Date(selectedYear, lastMonth, 0, 23, 59);

    const formatDateTime = (date: Date) => {
      return date.toISOString().slice(0, 16);
    };

    setFormData(prev => ({
      ...prev,
      fromDate: formatDateTime(fromDate),
      toDate: formatDateTime(toDate)
    }));
    resetState();
  };

  // Utility function to delay execution
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const fetchInvoicesWithCustomDate = async (customFormData: QueryParams, state?: string): Promise<ApiResponse> => {
    const formatDateForAPI = (dateString: string) => {
      const [datePart, timePart] = dateString.split('T');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}T${timePart}`;
    };

    const fromDateFormatted = formatDateForAPI(customFormData.fromDate) + ':00';
    const toDateFormatted = formatDateForAPI(customFormData.toDate) + ':59';
    
    let url = `https://hoadondientu.gdt.gov.vn:30000/query/invoices/${customFormData.invoiceType}?sort=${customFormData.sort}&size=${customFormData.size}&search=tdlap=ge=${fromDateFormatted};tdlap=le=${toDateFormatted}`;
    
    if (state) {
      url += `&state=${state}`;
    }

    const apiResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${customFormData.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!apiResponse.ok) {
      throw new Error(`HTTP error! status: ${apiResponse.status}`);
    }

    return await apiResponse.json();
  };

  // Load data for selected months with delay
  const loadSelectedMonths = async () => {
    if (selectedMonths.length === 0) {
      setError('Vui lòng chọn ít nhất một tháng');
      return;
    }

    setLoading(true);
    setError(null);
    resetState();

    try {
      let allInvoicesTotal: InvoiceData[] = [];
      let totalAdded = 0;
      let totalDuplicates = 0;

      for (let i = 0; i < selectedMonths.length; i++) {
        const month = selectedMonths.sort()[i];
        setError(`Đang tải tháng ${month}/${selectedYear} (${i + 1}/${selectedMonths.length})...`);
        
        // Set range for current month
        const fromDate = new Date(selectedYear, month - 1, 2, 0, 0);
        const toDate = new Date(selectedYear, month, 0, 23, 59);
        
        const formatDateTime = (date: Date) => {
          return date.toISOString().slice(0, 16);
        };

        const tempFormData = {
          ...formData,
          fromDate: formatDateTime(fromDate),
          toDate: formatDateTime(toDate)
        };

        // Load all pages for current month
        let allInvoicesMonth: InvoiceData[] = [];
        let currentStateParam = '';
        let page = 1;
        let hasMoreData = true;

        while (hasMoreData) {
          setCurrentPage(page);
          
          try {
            const data = await fetchInvoicesWithCustomDate(tempFormData, currentStateParam || undefined);
            
            if (data && Array.isArray(data.datas) && data.datas.length > 0) {
              allInvoicesMonth = [...allInvoicesMonth, ...data.datas];
              
              setError(`Tháng ${month}/${selectedYear} - Trang ${page}: ${data.datas.length} hóa đơn. Đã tải: ${allInvoicesMonth.length}/${data.total}`);

              if (data.state && allInvoicesMonth.length < data.total) {
                currentStateParam = data.state;
                page++;
                // Add delay between page requests
                await delay(delayBetweenRequests);
              } else {
                hasMoreData = false;
              }
            } else {
              hasMoreData = false;
            }
          } catch (error) {
            console.error(`Error loading page ${page} for month ${month}:`, error);
            setError(`Lỗi khi tải trang ${page} của tháng ${month}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Add longer delay on error
            await delay(delayBetweenRequests * 2);
            hasMoreData = false;
          }
        }

        allInvoicesTotal = [...allInvoicesTotal, ...allInvoicesMonth];
        setError(`Hoàn thành tháng ${month}/${selectedYear}: ${allInvoicesMonth.length} hóa đơn`);
        
        // Add delay between months (longer delay)
        if (i < selectedMonths.length - 1) {
          await delay(delayBetweenRequests * 2);
        }
      }

      // Merge all data
      if (allInvoicesTotal.length > 0) {
        const mergeResult = await mergeData(allInvoicesTotal, formData.invoiceType);
        totalAdded = mergeResult.added;
        totalDuplicates = mergeResult.duplicates;
        
        setError(`Hoàn thành tải ${selectedMonths.length} tháng! Thêm ${totalAdded} hóa đơn mới (${formData.invoiceType}), ${totalDuplicates} hóa đơn trùng lặp. Tổng trong DB: ${mergeResult.total} hóa đơn.`);
      } else {
        setError('Không có dữ liệu hóa đơn nào được tải về.');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
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
        
        try {
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
              
              // Add delay between requests
              await delay(delayBetweenRequests);
            } else {
              // No more data or reached the end
              hasMoreData = false;
            }
          } else {
            // No data returned, stop loading
            hasMoreData = false;
          }
        } catch (error) {
          console.error(`Error loading page ${page}:`, error);
          setError(`Lỗi khi tải trang ${page}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Add longer delay on error
          await delay(delayBetweenRequests * 2);
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

  // Add these handlers in the Home component
  const handleExportData = async () => {
    try {
      await exportAllData();
      setError('Xuất dữ liệu thành công!');
    } catch (error) {
      setError(`Lỗi khi xuất dữ liệu: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage(null);

    try {
      const result = await importAllData(file);
      setImportMessage(result.message);
      
      if (result.success) {
        // Reload saved data to reflect changes
        const [soldData, purchaseData] = await Promise.all([
          loadFromIndexedDB(STORE_NAME_SOLD),
          loadFromIndexedDB(STORE_NAME_PURCHASE)
        ]);
        
        setSavedData({
          sold: soldData,
          purchase: purchaseData
        });
      }
    } catch (error) {
      setImportMessage(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
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
          <div className="flex gap-4 justify-between items-center">
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
            {/* Delay Configuration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delay giữa các request (ms):
          </label>
          <input
            type="number"
            className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={delayBetweenRequests}
            onChange={(e) => setDelayBetweenRequests(parseInt(e.target.value))}
            min="500"
            max="5000"
            step="100"
          />
          <span className="text-xs text-gray-600 ml-2">
            (500-5000ms, khuyến nghị: 1000ms)
          </span>
        </div>
          </div>
        </div>

        {/* Month Selection */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-4 mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Chọn tháng:
            </label>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Năm:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded-md text-sm"
              >
                {[2023, 2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-12 gap-2 mb-3">
            {months.map((month) => (
              <button
                key={month.value}
                type="button"
                onClick={() => toggleMonthSelection(month.value)}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  selectedMonths.includes(month.value)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {month.name}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={setSelectedMonthsRange}
              disabled={selectedMonths.length === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Áp dụng khoảng thời gian ({selectedMonths.length} tháng)
            </button>
            <button
              type="button"
              onClick={loadSelectedMonths}
              disabled={selectedMonths.length === 0 || loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Đang tải...' : `Tải ${selectedMonths.length} tháng`}
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonths([])}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Bỏ chọn tất cả
            </button>
          </div>
          
          {selectedMonths.length > 0 && (
            <p className="text-sm text-gray-600 mt-2">
              Đã chọn: {selectedMonths.sort().map(m => `Tháng ${m}`).join(', ')} năm {selectedYear}
            </p>
          )}
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
            {loading ? `Đang tải... (Trang ${currentPage})` : 'Tải theo khoảng thời gian hiện tại'}
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

        {/* Add this section in the form after the existing buttons */}
        <div className="border-t pt-4">
          <h4 className="text-md font-medium text-gray-700 mb-3">Sao lưu & Khôi phục dữ liệu:</h4>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportData}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              📥 Xuất tất cả dữ liệu
            </button>
            
            <label className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer">
              📤 Nhập dữ liệu
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                disabled={importing}
                className="hidden"
              />
            </label>
            
            {importing && (
              <span className="px-4 py-2 text-sm bg-gray-100 text-gray-600 rounded-md">
                Đang nhập dữ liệu...
              </span>
            )}
          </div>
          
          {importMessage && (
            <div className={`mt-2 p-2 rounded text-sm ${
              importMessage.includes('thành công') 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {importMessage}
            </div>
          )}
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
            <p className="text-sm">
              <span className="font-medium">Delay:</span> {delayBetweenRequests}ms
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
