'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import React from 'react';

// Define interfaces for TypeScript
interface InvoiceDetail {
  id: string;
  lastUpdated?: string;
  hdhhdvu?: ProductDetail[];
  nlap?: string; // Ngày lập hóa đơn
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
  nlap?: string; // Ngày lập
  shdon?: string; // Số hóa đơn
  [key: string]: any;
}

interface InventoryItem {
  ten: string;
  date: string; // Ngày giao dịch
  nhap: {
    sluong: number;
    thtien: number;
    thtcthue: number;
    count: number;
    invoices: Array<{id: string, shdon: string, nlap: string}>;
  };
  xuat: {
    sluong: number;
    thtien: number;
    thtcthue: number;
    count: number;
    invoices: Array<{id: string, shdon: string, nlap: string}>;
  };
  ton: {
    sluong: number;
    thtien: number;
    thtcthue: number;
  };
}

type TimeFilter = 'all' | 'day' | 'month' | 'year';
type SortField = 'ten' | 'date' | 'nhap.sluong' | 'nhap.thtien' | 'xuat.sluong' | 'xuat.thtien' | 'ton.sluong' | 'ton.thtien';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface FilterConfig {
  minNhapSluong: number;
  maxNhapSluong: number;
  minXuatSluong: number;
  maxXuatSluong: number;
  minTonSluong: number;
  maxTonSluong: number;
  showNegativeInventory: boolean;
  showZeroInventory: boolean;
}

// IndexedDB constants - MUST match other pages exactly
const DB_NAME = 'InvoiceDB';
const DB_VERSION = 2; // Ensure this matches other pages
const STORE_NAME_SOLD = 'invoice_sold';
const STORE_NAME_PURCHASE = 'invoice_purchase';
const STORE_NAME_DETAILS = 'invoice_details';

// Open IndexedDB with proper error handling and version management
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // First, check current version
    const checkRequest = indexedDB.open(DB_NAME);
    
    checkRequest.onsuccess = () => {
      const db = checkRequest.result;
      const currentVersion = db.version;
      db.close();
      
      // Now open with correct version
      const request = indexedDB.open(DB_NAME, Math.max(currentVersion, DB_VERSION));
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create stores if they don't exist
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
    };
    
    checkRequest.onerror = () => {
      // If can't check version, try to open normally
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
    };
  });
};

// Load data from IndexedDB with better error handling
const loadFromIndexedDB = async (storeName: string): Promise<any[]> => {
  let retryCount = 0;
  const maxRetries = 3;
  
  while (retryCount < maxRetries) {
    try {
      const db = await openDB();
      
      // Check if store exists
      if (!db.objectStoreNames.contains(storeName)) {
        console.warn(`Store ${storeName} does not exist in database`);
        db.close();
        return [];
      }
      
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        
        request.onsuccess = () => {
          db.close();
          resolve(request.result || []);
        };
        
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
        
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      });
      
    } catch (error) {
      retryCount++;
      console.error(`Error loading data from ${storeName} (attempt ${retryCount}):`, error);
      
      if (retryCount >= maxRetries) {
        console.error(`Failed to load from ${storeName} after ${maxRetries} attempts`);
        return [];
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
    }
  }
  
  return [];
};

// Helper function to format date
const formatDate = (dateStr: string, filter: TimeFilter): string => {
  if (!dateStr) return 'Không rõ ngày';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Không rõ ngày';
    
    switch (filter) {
      case 'day':
        return date.toLocaleDateString('vi-VN');
      case 'month':
        return `${date.getMonth() + 1}/${date.getFullYear()}`;
      case 'year':
        return date.getFullYear().toString();
      default:
        return date.toLocaleDateString('vi-VN');
    }
  } catch {
    return 'Không rõ ngày';
  }
};

// Helper function to get nested property value
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((value, key) => value?.[key], obj);
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
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [filterMST, setFilterMST] = useState('5901209782');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // New state for sorting and advanced filtering
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'ten',
    direction: 'asc'
  });
  
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    minNhapSluong: 0,
    maxNhapSluong: Infinity,
    minXuatSluong: 0,
    maxXuatSluong: Infinity,
    minTonSluong: -Infinity,
    maxTonSluong: Infinity,
    showNegativeInventory: true,
    showZeroInventory: true
  });
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Starting to load data from IndexedDB...');
        
        // Load data with individual error handling
        const [detailsData, soldData, purchaseData] = await Promise.allSettled([
          loadFromIndexedDB(STORE_NAME_DETAILS),
          loadFromIndexedDB(STORE_NAME_SOLD),
          loadFromIndexedDB(STORE_NAME_PURCHASE)
        ]);

        // Handle results
        const details = detailsData.status === 'fulfilled' ? detailsData.value : [];
        const sold = soldData.status === 'fulfilled' ? soldData.value : [];
        const purchase = purchaseData.status === 'fulfilled' ? purchaseData.value : [];

        console.log('Loaded data:', {
          details: details.length,
          sold: sold.length,
          purchase: purchase.length
        });

        setInvoiceDetails(details);
        setSoldInvoices(sold);
        setPurchaseInvoices(purchase);

        // Check for any errors
        const errors = [detailsData, soldData, purchaseData]
          .filter(result => result.status === 'rejected')
          .map(result => (result as PromiseRejectedResult).reason);

        if (errors.length > 0) {
          console.warn('Some data failed to load:', errors);
          setError(`Một số dữ liệu không tải được: ${errors.length} lỗi`);
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
        setError(`Lỗi khi tải dữ liệu từ IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Filter details for MST
      const filteredDetails = invoiceDetails.filter(detail => {
        const soldInvoice = soldInvoices.find(inv => inv.id === detail.id);
        const purchaseInvoice = purchaseInvoices.find(inv => inv.id === detail.id);
        const invoice = soldInvoice || purchaseInvoice;
        
        return invoice && (invoice.nbmst === filterMST || invoice.nmmst === filterMST);
      });

      filteredDetails.forEach(detail => {
        if (!detail.hdhhdvu || !Array.isArray(detail.hdhhdvu)) return;

        // Get invoice info to determine type and date
        const soldInvoice = soldInvoices.find(inv => inv.id === detail.id);
        const purchaseInvoice = purchaseInvoices.find(inv => inv.id === detail.id);
        const invoice = soldInvoice || purchaseInvoice;
        const isPurchase = !soldInvoice;
        const invoiceDate = invoice?.nlap || detail.lastUpdated || new Date().toISOString();

        detail.hdhhdvu.forEach((product: ProductDetail) => {
          const productName = product.ten || 'Không rõ tên';
          const quantity = product.sluong || 0;
          const amount = product.thtien || 0;
          const taxAmount = product.thtcthue || 0;
          
          // Create unique key based on product name and time period
          let timeKey = '';
          if (timeFilter === 'all') {
            timeKey = 'all';
          } else {
            timeKey = formatDate(invoiceDate, timeFilter);
          }
          
          const inventoryKey = `${productName}_${timeKey}`;

          if (!inventory[inventoryKey]) {
            inventory[inventoryKey] = {
              ten: productName,
              date: timeKey,
              nhap: { sluong: 0, thtien: 0, thtcthue: 0, count: 0, invoices: [] },
              xuat: { sluong: 0, thtien: 0, thtcthue: 0, count: 0, invoices: [] },
              ton: { sluong: 0, thtien: 0, thtcthue: 0 }
            };
          }

          // Create invoice info for linking
          const invoiceInfo = {
            id: detail.id,
            shdon: invoice?.shdon || `HĐ-${detail.id.slice(-6)}`,
            nlap: invoice?.nlap || detail.lastUpdated || ''
          };

          if (isPurchase) {
            inventory[inventoryKey].nhap.sluong += quantity;
            inventory[inventoryKey].nhap.thtien += amount;
            inventory[inventoryKey].nhap.thtcthue += taxAmount;
            inventory[inventoryKey].nhap.count += 1;
            inventory[inventoryKey].nhap.invoices.push(invoiceInfo);
          } else {
            inventory[inventoryKey].xuat.sluong += quantity;
            inventory[inventoryKey].xuat.thtien += amount;
            inventory[inventoryKey].xuat.thtcthue += taxAmount;
            inventory[inventoryKey].xuat.count += 1;
            inventory[inventoryKey].xuat.invoices.push(invoiceInfo);
          }

          // Calculate inventory balance
          inventory[inventoryKey].ton.sluong = 
            inventory[inventoryKey].nhap.sluong - inventory[inventoryKey].xuat.sluong;
          inventory[inventoryKey].ton.thtien = 
            inventory[inventoryKey].nhap.thtien - inventory[inventoryKey].xuat.thtien;
          inventory[inventoryKey].ton.thtcthue = 
            inventory[inventoryKey].nhap.thtcthue - inventory[inventoryKey].xuat.thtcthue;
        });
      });

      const sortedInventory = Object.values(inventory);
      setInventoryData(sortedInventory);
    };

    processInventoryData();
  }, [invoiceDetails, soldInvoices, purchaseInvoices, filterMST, timeFilter]);

  // Memoized filtered and sorted data
  const filteredAndSortedInventory = React.useMemo(() => {
    let filtered = inventoryData.filter(item => {
      // Basic search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = item.ten.toLowerCase().includes(searchLower) ||
                             item.date.toLowerCase().includes(searchLower) ||
                             item.nhap.invoices.some(inv => inv.shdon.toLowerCase().includes(searchLower)) ||
                             item.xuat.invoices.some(inv => inv.shdon.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Advanced filters
      if (item.nhap.sluong < filterConfig.minNhapSluong || 
          item.nhap.sluong > filterConfig.maxNhapSluong) return false;
      
      if (item.xuat.sluong < filterConfig.minXuatSluong || 
          item.xuat.sluong > filterConfig.maxXuatSluong) return false;
      
      if (item.ton.sluong < filterConfig.minTonSluong || 
          item.ton.sluong > filterConfig.maxTonSluong) return false;

      // Inventory status filters
      if (!filterConfig.showNegativeInventory && item.ton.sluong < 0) return false;
      if (!filterConfig.showZeroInventory && item.ton.sluong === 0) return false;

      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.field);
      const bValue = getNestedValue(b, sortConfig.field);
      
      let comparison = 0;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        // Handle date comparison for 'date' field
        if (sortConfig.field === 'date') {
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          comparison = aDate.getTime() - bDate.getTime();
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [inventoryData, searchTerm, filterConfig, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedInventory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = filteredAndSortedInventory.slice(startIndex, endIndex);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, timeFilter, filterConfig, sortConfig]);

  // Calculate totals
  const totals = filteredAndSortedInventory.reduce(
    (acc, item) => ({
      nhap: {
        sluong: acc.nhap.sluong + item.nhap.sluong,
        thtien: acc.nhap.thtien + item.nhap.thtien,
        thtcthue: acc.nhap.thtcthue + item.nhap.thtcthue,
        count: acc.nhap.count + item.nhap.count
      },
      xuat: {
        sluong: acc.xuat.sluong + item.xuat.sluong,
        thtien: acc.xuat.thtien + item.xuat.thtien,
        thtcthue: acc.xuat.thtcthue + item.xuat.thtcthue,
        count: acc.xuat.count + item.xuat.count
      },
      ton: {
        sluong: acc.ton.sluong + item.ton.sluong,
        thtien: acc.ton.thtien + item.ton.thtien,
        thtcthue: acc.ton.thtcthue + item.ton.thtcthue
      }
    }),
    {
      nhap: { sluong: 0, thtien: 0, thtcthue: 0, count: 0 },
      xuat: { sluong: 0, thtien: 0, thtcthue: 0, count: 0 },
      ton: { sluong: 0, thtien: 0, thtcthue: 0 }
    }
  );

  // Sort handler
  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) return '⇅';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Reset filters
  const resetFilters = () => {
    setFilterConfig({
      minNhapSluong: 0,
      maxNhapSluong: Infinity,
      minXuatSluong: 0,
      maxXuatSluong: Infinity,
      minTonSluong: -Infinity,
      maxTonSluong: Infinity,
      showNegativeInventory: true,
      showZeroInventory: true
    });
    setSearchTerm('');
    setSortConfig({ field: 'ten', direction: 'asc' });
  };

  // Toggle row expansion
  const toggleRowExpansion = (key: string) => {
    setExpandedRow(expandedRow === key ? null : key);
  };

  // Component for rendering invoice list
  const InvoiceList = ({ invoices, type }: { invoices: Array<{id: string, shdon: string, nlap: string}>, type: 'nhap' | 'xuat' }) => {
    if (invoices.length === 0) return <span className="text-gray-400">Không có</span>;
    
    return (
      <div className="space-y-1">
        {invoices.map((invoice, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <Link 
              href={`/hoadonchitiet?id=${invoice.id}`}
              className={`text-blue-600 hover:text-blue-800 underline font-medium ${
                type === 'nhap' ? 'text-blue-600' : 'text-red-600'
              }`}
              title={`Xem chi tiết hóa đơn ${invoice.shdon}`}
            >
              {invoice.shdon}
            </Link>
            <span className="text-gray-500 ml-2">
              {new Date(invoice.nlap).toLocaleDateString('vi-VN')}
            </span>
          </div>
        ))}
      </div>
    );
  };

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
        <div className="mt-4">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Báo cáo Xuất Nhập Tồn</h1>
        
        {/* Debug Info */}
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
          <strong>Thông tin dữ liệu:</strong> Chi tiết: {invoiceDetails.length}, 
          Bán ra: {soldInvoices.length}, Mua vào: {purchaseInvoices.length}
        </div>
        
        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* MST Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mã số thuế:
            </label>
            <input
              type="text"
              value={filterMST}
              onChange={(e) => setFilterMST(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nhập mã số thuế..."
            />
          </div>

          {/* Time Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hiển thị theo:
            </label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'day', 'month', 'year'] as TimeFilter[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    timeFilter === filter
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {filter === 'all' ? 'Tất cả' :
                   filter === 'day' ? 'Theo ngày' :
                   filter === 'month' ? 'Theo tháng' : 'Theo năm'}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tìm kiếm:
            </label>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm, ngày, số HĐ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Items per page */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hiển thị:
            </label>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={10}>10 bản ghi</option>
              <option value={20}>20 bản ghi</option>
              <option value={50}>50 bản ghi</option>
              <option value={100}>100 bản ghi</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters Toggle */}
        <div className="mb-4">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            {showAdvancedFilters ? '🔼 Ẩn bộ lọc nâng cao' : '🔽 Hiện bộ lọc nâng cao'}
          </button>
          <button
            onClick={resetFilters}
            className="ml-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            🔄 Reset tất cả
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Bộ lọc nâng cao</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Nhập kho filters */}
              <div>
                <h4 className="font-medium mb-2">Lọc theo nhập kho:</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm text-gray-600">Số lượng nhập tối thiểu:</label>
                    <input
                      type="number"
                      value={filterConfig.minNhapSluong === 0 ? '' : filterConfig.minNhapSluong}
                      onChange={(e) => setFilterConfig(prev => ({
                        ...prev,
                        minNhapSluong: Number(e.target.value) || 0
                      }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Số lượng nhập tối đa:</label>
                    <input
                      type="number"
                      value={filterConfig.maxNhapSluong === Infinity ? '' : filterConfig.maxNhapSluong}
                      onChange={(e) => setFilterConfig(prev => ({
                        ...prev,
                        maxNhapSluong: Number(e.target.value) || Infinity
                      }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Không giới hạn"
                    />
                  </div>
                </div>
              </div>

              {/* Xuất kho filters */}
              <div>
                <h4 className="font-medium mb-2">Lọc theo xuất kho:</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm text-gray-600">Số lượng xuất tối thiểu:</label>
                    <input
                      type="number"
                      value={filterConfig.minXuatSluong === 0 ? '' : filterConfig.minXuatSluong}
                      onChange={(e) => setFilterConfig(prev => ({
                        ...prev,
                        minXuatSluong: Number(e.target.value) || 0
                      }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Số lượng xuất tối đa:</label>
                    <input
                      type="number"
                      value={filterConfig.maxXuatSluong === Infinity ? '' : filterConfig.maxXuatSluong}
                      onChange={(e) => setFilterConfig(prev => ({
                        ...prev,
                        maxXuatSluong: Number(e.target.value) || Infinity
                      }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Không giới hạn"
                    />
                  </div>
                </div>
              </div>

              {/* Tồn kho filters */}
              <div>
                <h4 className="font-medium mb-2">Lọc theo tồn kho:</h4>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm text-gray-600">Tồn kho tối thiểu:</label>
                    <input
                      type="number"
                      value={filterConfig.minTonSluong === -Infinity ? '' : filterConfig.minTonSluong}
                      onChange={(e) => setFilterConfig(prev => ({
                        ...prev,
                        minTonSluong: Number(e.target.value) || -Infinity
                      }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Không giới hạn"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Tồn kho tối đa:</label>
                    <input
                      type="number"
                      value={filterConfig.maxTonSluong === Infinity ? '' : filterConfig.maxTonSluong}
                      onChange={(e) => setFilterConfig(prev => ({
                        ...prev,
                        maxTonSluong: Number(e.target.value) || Infinity
                      }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="Không giới hạn"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filterConfig.showNegativeInventory}
                        onChange={(e) => setFilterConfig(prev => ({
                          ...prev,
                          showNegativeInventory: e.target.checked
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm">Hiện tồn âm</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filterConfig.showZeroInventory}
                        onChange={(e) => setFilterConfig(prev => ({
                          ...prev,
                          showZeroInventory: e.target.checked
                        }))}
                        className="mr-2"
                      />
                      <span className="text-sm">Hiện tồn bằng 0</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
            <p className="text-xs text-blue-600">
              Thuế: {totals.nhap.thtcthue.toLocaleString()} VND
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
            <p className="text-xs text-red-600">
              Thuế: {totals.xuat.thtcthue.toLocaleString()} VND
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
            <p className="text-xs text-green-600">
              Thuế: {totals.ton.thtcthue.toLocaleString()} VND
            </p>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg">
            <h3 className="font-semibold text-yellow-800">Tổng bản ghi</h3>
            <p className="text-xl font-bold text-yellow-900">{filteredAndSortedInventory.length}</p>
            <p className="text-sm text-yellow-700">
              {timeFilter === 'all' ? 'Tất cả sản phẩm' : 
               timeFilter === 'day' ? 'Theo ngày' :
               timeFilter === 'month' ? 'Theo tháng' : 'Theo năm'}
            </p>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Báo cáo tồn kho ({filteredAndSortedInventory.length} bản ghi)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Click vào số hóa đơn để xem chi tiết • Click vào dòng để xem/ẩn danh sách hóa đơn
          </p>
        </div>

        {currentItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm || showAdvancedFilters ? 'Không tìm thấy kết quả phù hợp với bộ lọc' : 'Chưa có dữ liệu tồn kho'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('ten')}
                    >
                      Tên sản phẩm {getSortIcon('ten')}
                    </th>
                    {timeFilter !== 'all' && (
                      <th 
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('date')}
                      >
                        {timeFilter === 'day' ? 'Ngày' : 
                         timeFilter === 'month' ? 'Tháng' : 'Năm'} {getSortIcon('date')}
                      </th>
                    )}
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('nhap.sluong')}
                    >
                      Nhập kho {getSortIcon('nhap.sluong')}
                    </th>
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('xuat.sluong')}
                    >
                      Xuất kho {getSortIcon('xuat.sluong')}
                    </th>
                    <th 
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('ton.sluong')}
                    >
                      Tồn kho {getSortIcon('ton.sluong')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentItems.map((item, index) => {
                    const rowKey = `${item.ten}_${item.date}`;
                    const isExpanded = expandedRow === rowKey;
                    
                    return (
                      <React.Fragment key={index}>
                        <tr 
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleRowExpansion(rowKey)}
                        >
                          <td className="px-2 py-4 text-center text-sm text-gray-600">
                            <button className="text-blue-600 hover:text-blue-800">
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {item.ten}
                          </td>
                          {timeFilter !== 'all' && (
                            <td className="px-6 py-4 text-center text-sm text-gray-700">
                              {item.date}
                            </td>
                          )}
                          <td className="px-6 py-4 text-center text-sm">
                            <div className="text-blue-600 font-semibold">
                              {item.nhap.sluong.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.nhap.thtien.toLocaleString()} VND
                            </div>
                            <div className="text-xs text-blue-500">
                              Thuế: {item.nhap.thtcthue.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-400">
                              ({item.nhap.count} HĐ)
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center text-sm">
                            <div className="text-red-600 font-semibold">
                              {item.xuat.sluong.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {item.xuat.thtien.toLocaleString()} VND
                            </div>
                            <div className="text-xs text-red-500">
                              Thuế: {item.xuat.thtcthue.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-400">
                              ({item.xuat.count} HĐ)
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
                            <div className="text-xs text-green-500">
                              Thuế: {item.ton.thtcthue.toLocaleString()}
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded row showing invoice details */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={timeFilter === 'all' ? 5 : 6} className="px-6 py-4 bg-gray-50">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold text-blue-800 mb-2">
                                    🔵 Hóa đơn nhập ({item.nhap.invoices.length})
                                  </h4>
                                  <InvoiceList invoices={item.nhap.invoices} type="nhap" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-red-800 mb-2">
                                    🔴 Hóa đơn xuất ({item.xuat.invoices.length})
                                  </h4>
                                  <InvoiceList invoices={item.xuat.invoices} type="xuat" />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Hiển thị {startIndex + 1} đến {Math.min(endIndex, filteredAndSortedInventory.length)} của {filteredAndSortedInventory.length} bản ghi
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                  >
                    Đầu
                  </button>
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
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded disabled:opacity-50"
                  >
                    Cuối
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
              timeFilter,
              sortConfig,
              filterConfig,
              totalRecords: filteredAndSortedInventory.length,
              totals,
              inventory: filteredAndSortedInventory.map(item => ({
                ...item,
                nhapInvoices: item.nhap.invoices,
                xuatInvoices: item.xuat.invoices
              }))
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `xuat-nhap-ton-${filterMST}-${timeFilter}-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
          }}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          📊 Xuất JSON
        </button>
        
        <button
          onClick={() => {
            const headers = timeFilter === 'all' 
              ? ['Tên sản phẩm', 'Nhập-SL', 'Nhập-Tiền', 'Nhập-Thuế', 'Nhập-HĐ', 'Xuất-SL', 'Xuất-Tiền', 'Xuất-Thuế', 'Xuất-HĐ', 'Tồn-SL', 'Tồn-Tiền', 'Tồn-Thuế']
              : ['Tên sản phẩm', 'Thời gian', 'Nhập-SL', 'Nhập-Tiền', 'Nhập-Thuế', 'Nhập-HĐ', 'Xuất-SL', 'Xuất-Tiền', 'Xuất-Thuế', 'Xuất-HĐ', 'Tồn-SL', 'Tồn-Tiền', 'Tồn-Thuế'];
            
            const csvContent = [
              headers.join(','),
              ...filteredAndSortedInventory.map(item => {
                const nhapHoaDon = item.nhap.invoices.map(inv => inv.shdon).join(';');
                const xuatHoaDon = item.xuat.invoices.map(inv => inv.shdon).join(';');
                
                const baseData = [
                  `"${item.ten}"`,
                  ...(timeFilter !== 'all' ? [`"${item.date}"`] : []),
                  item.nhap.sluong,
                  item.nhap.thtien,
                  item.nhap.thtcthue,
                  `"${nhapHoaDon}"`,
                  item.xuat.sluong,
                  item.xuat.thtien,
                  item.xuat.thtcthue,
                  `"${xuatHoaDon}"`,
                  item.ton.sluong,
                  item.ton.thtien,
                  item.ton.thtcthue
                ];
                return baseData.join(',');
              })
            ].join('\n');
            
            const BOM = '\uFEFF';
            const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `xuat-nhap-ton-${filterMST}-${timeFilter}-${new Date().toISOString().split('T')[0]}.csv`;
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
