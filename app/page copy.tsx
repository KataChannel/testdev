'use client';

import { useState, useEffect } from 'react';

interface QueryParams {
  fromDate: string;
  toDate: string;
  sort: string;
  size: number;
  token: string;
}

interface InvoiceData {
  id: string;
  [key: string]: any;
}

export default function Home() {
  const [formData, setFormData] = useState<QueryParams>({
    fromDate: '2025-01-01T00:00',
    toDate: '2025-01-31T23:59',
    sort: 'tdlap:desc,khmshdon:asc,shdon:desc',
    size: 50,
    token: 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI1OTAxMjA5NzgyIiwidHlwZSI6MiwiZXhwIjoxNzUyMjIxOTI4LCJpYXQiOjE3NTIxMzU1Mjh9.vJV8m2B2zCm1BjZI6WexG8DW8vmIoI-ZLljpK8ga2zoheXAO3hUBHP3b0CFctLVzLbnheZLXfuuVmp3GGnzhaw'
  });
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<InvoiceData[]>([]);

  const STORAGE_KEY = 'invoice_data';

  // Load saved data from localStorage on component mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedData(JSON.parse(stored));
      } catch (err) {
        console.error('Error parsing stored data:', err);
      }
    }
  }, []);

  // Save data to localStorage
  const saveToLocalStorage = (data: InvoiceData[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSavedData(data);
  };

  // Check for duplicates and merge new data
  const mergeData = (newData: InvoiceData[]) => {
    const existingIds = new Set(savedData.map(item => item.id));
    const uniqueNewData = newData.filter(item => !existingIds.has(item.id));
    
    if (uniqueNewData.length > 0) {
      const mergedData = [...savedData, ...uniqueNewData];
      saveToLocalStorage(mergedData);
      return {
        added: uniqueNewData.length,
        duplicates: newData.length - uniqueNewData.length,
        total: mergedData.length
      };
    }
    
    return {
      added: 0,
      duplicates: newData.length,
      total: savedData.length
    };
  };

  // Clear all saved data
  const clearSavedData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedData([]);
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
    // Bắt đầu từ ngày 2 của tháng (ngày 1 + 1 ngày)
    const fromDate = new Date(year, month - 1, 2, 0, 0);
    // Kết thúc vào ngày cuối cùng của tháng
    const toDate = new Date(year, month, 0, 23, 59);

    const formatDateTime = (date: Date) => {
      return date.toISOString().slice(0, 16);
    };  
    setFormData(prev => ({
      ...prev,
      fromDate: formatDateTime(fromDate),
      toDate: formatDateTime(toDate)
    }));
  };

  const generateURL = () => {
    const formatDateForAPI = (dateString: string) => {
      const [datePart, timePart] = dateString.split('T');
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}T${timePart}`;
    };

    const fromDateFormatted = formatDateForAPI(formData.fromDate) + ':00';
    const toDateFormatted = formatDateForAPI(formData.toDate) + ':59';
    
    return `https://hoadondientu.gdt.gov.vn:30000/query/invoices/sold?sort=${formData.sort}&size=${formData.size}&search=tdlap=ge=${fromDateFormatted};tdlap=le=${toDateFormatted}`;
  };

  const handleInputChange = (field: keyof QueryParams, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const url = generateURL();
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

      const data = await apiResponse.json();
      setResponse(data);

      // Check if response has data array and merge with existing data
      if (data && Array.isArray(data.datas) && data.datas.length > 0) {
        const mergeResult = mergeData(data.datas);
        setError(`Đã thêm ${mergeResult.added} hóa đơn mới, ${mergeResult.duplicates} hóa đơn trùng lặp. Tổng: ${mergeResult.total} hóa đơn.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyURL = () => {
    navigator.clipboard.writeText(generateURL());
  };

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-bold text-center mb-8">Query Invoice API</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
        {/* Month Selection Buttons */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Chọn tháng nhanh (từ ngày 1):
          </label>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Query Invoices'}
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
            onClick={clearSavedData}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Clear Data
          </button>
        </div>
      </form>

      {/* Saved Data Summary */}
      <div className="bg-green-100 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Dữ liệu đã lưu:</h3>
        <p className="text-sm">Tổng số hóa đơn: {savedData.length}</p>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Generated URL:</h3>
        <code className="text-sm bg-white p-2 rounded block overflow-x-auto">
          {generateURL()}
        </code>
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
  );
}
