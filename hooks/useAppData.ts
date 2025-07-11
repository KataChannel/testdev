import { useState, useEffect, useCallback } from 'react';
import { db, InvoiceData, InvoiceDetail, InventoryItem } from '@/lib/database';
import { apiService } from '@/lib/api';
import { CONFIG } from '@/lib/config';
import { delay, validateInvoiceParams } from '@/lib/utils';

export interface UseAppDataResult {
  // Invoice Data
  invoices: { sold: InvoiceData[]; purchase: InvoiceData[] };
  invoiceDetails: { [key: string]: InvoiceDetail };
  inventoryItems: InventoryItem[];
  
  // Loading States
  loading: boolean;
  detailLoading: boolean;
  inventoryLoading: boolean;
  error: string | null;
  
  // Progress tracking
  detailProgress: {
    current: number;
    total: number;
    processed: number;
    errors: number;
  };
  
  // Data Actions
  loadInvoices: () => Promise<void>;
  loadInvoiceDetail: (invoice: InvoiceData, token: string) => Promise<InvoiceDetail | null>;
  loadAllDetails: (type: 'sold' | 'purchase', token: string, delayMs?: number) => Promise<void>;
  refreshInventory: () => Promise<void>;
  
  // Navigation helpers
  findInvoiceById: (id: string) => InvoiceData | null;
  getInvoiceDetail: (id: string) => InvoiceDetail | null;
  getInventoryByProduct: (productName: string) => InventoryItem[];
  
  // Statistics
  getStatistics: () => {
    totalInvoices: number;
    totalSold: number;
    totalPurchase: number;
    totalDetails: number;
    totalInventoryItems: number;
    totalValue: number;
  };
}

export const useAppData = (): UseAppDataResult => {
  // Data states
  const [invoices, setInvoices] = useState<{ sold: InvoiceData[]; purchase: InvoiceData[] }>({
    sold: [],
    purchase: []
  });
  const [invoiceDetails, setInvoiceDetails] = useState<{ [key: string]: InvoiceDetail }>({});
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Progress tracking
  const [detailProgress, setDetailProgress] = useState({
    current: 0,
    total: 0,
    processed: 0,
    errors: 0
  });

  // Load all invoices from database
  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [soldData, purchaseData] = await Promise.all([
        db.loadInvoices('sold'),
        db.loadInvoices('purchase')
      ]);
      console.log('Sold Invoices:', soldData);
      console.log('Purchase Invoices:', purchaseData);

      setInvoices({
        sold: soldData,
        purchase: purchaseData
      });

      // Load existing details
      const detailsArray = await db.loadData<InvoiceDetail>(CONFIG.DB.STORES.DETAILS);
      // console.log('Loaded Invoice Details:', detailsArray);
      
      const detailsMap: { [key: string]: InvoiceDetail } = {};
      detailsArray.forEach(detail => {
        detailsMap[detail.id] = detail;
      });
      // console.log('Details Map:', detailsMap);
      // console.log('Details Array:', detailsArray);
      setInvoiceDetails(detailsMap);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load single invoice detail
  const loadInvoiceDetail = useCallback(async (invoice: InvoiceData, token: string): Promise<InvoiceDetail | null> => {
    try {
      // Check if detail exists in memory first
      if (invoiceDetails[invoice.id]) {
        return invoiceDetails[invoice.id];
      }

      // Check if detail exists in IndexedDB
      const existingDetail = await db.loadInvoiceDetail(invoice.id);
      if (existingDetail) {
        setInvoiceDetails(prev => ({ ...prev, [invoice.id]: existingDetail }));
        return existingDetail;
      }

      // Validate invoice parameters
      if (!validateInvoiceParams(invoice)) {
        throw new Error('Thiếu thông tin API params (nbmst, khhdon, shdon, khmshdon)');
      }

      // Fetch from API
      const detail = await apiService.fetchInvoiceDetail({
        nbmst: invoice.nbmst!,
        khhdon: invoice.khhdon!,
        shdon: invoice.shdon!,
        khmshdon: invoice.khmshdon!,
        token
      });

      // Save to memory and IndexedDB
      const detailWithId: InvoiceDetail = {
        ...detail,
        id: invoice.id,
        lastUpdated: new Date().toISOString()
      };
      
      setInvoiceDetails(prev => ({ ...prev, [invoice.id]: detailWithId }));
      await db.saveInvoiceDetail(detailWithId);
      
      return detailWithId;
    } catch (err) {
      console.error('Error loading invoice detail:', err);
      throw err;
    }
  }, [invoiceDetails]);

  // Load all details for a specific type
  const loadAllDetails = useCallback(async (
    type: 'sold' | 'purchase', 
    token: string, 
    delayMs: number = CONFIG.UI.DEFAULT_DELAY
  ) => {
    if (!token.trim()) {
      throw new Error('Vui lòng nhập Authorization Token');
    }

    const currentInvoices = invoices[type];
    const validInvoices = currentInvoices.filter(validateInvoiceParams);

    if (validInvoices.length === 0) {
      throw new Error('Không có hóa đơn nào có đủ thông tin để tải chi tiết');
    }

    setDetailLoading(true);
    setDetailProgress({
      current: 0,
      total: validInvoices.length,
      processed: 0,
      errors: 0
    });

    let processed = 0;
    let errors = 0;

    try {
      for (let i = 0; i < validInvoices.length; i++) {
        const invoice = validInvoices[i];
        
        setDetailProgress(prev => ({ ...prev, current: i + 1 }));

        try {
          // Check if detail already exists
          if (!invoiceDetails[invoice.id]) {
            await loadInvoiceDetail(invoice, token);
            processed++;
          }
        } catch (error) {
          errors++;
          console.error(`Error loading detail for invoice ${invoice.id}:`, error);
        }

        setDetailProgress(prev => ({ ...prev, processed, errors }));

        // Add delay between requests (except for the last one)
        if (i < validInvoices.length - 1) {
          await delay(delayMs);
        }
      }
    } finally {
      setDetailLoading(false);
      setDetailProgress({ current: 0, total: 0, processed: 0, errors: 0 });
    }
  }, [invoices, invoiceDetails, loadInvoiceDetail]);

  // Refresh inventory from invoice details
  const refreshInventory = useCallback(async () => {
    try {
      setInventoryLoading(true);
      setError(null);

      const inventory: { [key: string]: InventoryItem } = {};
      const allInvoices = [...invoices.sold, ...invoices.purchase];

      // Process each invoice detail
      Object.values(invoiceDetails).forEach(detail => {
        // Find corresponding invoice to determine direction
        const invoice = allInvoices.find(inv => inv.id === detail.id);
        if (!invoice) return;

        const isSold = invoices.sold.some(inv => inv.id === detail.id);
        const productItems = detail.hdhhdvu || detail.dshhdv || [];

        productItems.forEach((item: any) => {
          const productName = item.ten || item.tenhhdv || 'Không có tên';
          const productKey = productName.toLowerCase().trim();
          
          if (!inventory[productKey]) {
            inventory[productKey] = {
              id: productKey,
              productName: productName,
              quantity: 0,
              unit: item.dvtinh || 'N/A',
              unitPrice: parseFloat(item.dgia?.toString() || '0'),
              totalValue: 0,
              category: item.nhom || 'Chưa phân loại',
              supplier: isSold ? invoice.nbten : invoice.nmten,
              lastUpdated: new Date().toISOString(),
              nhap: {
                sluong: 0,
                thtien: 0,
                count: 0,
                invoices: []
              },
              xuat: {
                sluong: 0,
                thtien: 0,
                count: 0,
                invoices: []
              },
              ton: {
                sluong: 0,
                thtien: 0
              },
              inQuantity: 0,
              outQuantity: 0,
              transactions: []
            };
          }

          const quantity = parseFloat(item.sluong?.toString() || '0');
          const amount = parseFloat(item.ttien?.toString() || '0');

          if (isSold) {
            // Xuất hàng (bán ra)
            inventory[productKey].outQuantity += quantity;
            inventory[productKey].quantity -= quantity;
            inventory[productKey].xuat.sluong += quantity;
            inventory[productKey].xuat.thtien += amount;
            inventory[productKey].xuat.count += 1;
            inventory[productKey].xuat.invoices.push(invoice.id);
          } else {
            // Nhập hàng (mua vào)
            inventory[productKey].inQuantity += quantity;
            inventory[productKey].quantity += quantity;
            inventory[productKey].nhap.sluong += quantity;
            inventory[productKey].nhap.thtien += amount;
            inventory[productKey].nhap.count += 1;
            inventory[productKey].nhap.invoices.push(invoice.id);
          }

          // Update tồn kho
          inventory[productKey].ton.sluong = inventory[productKey].quantity;
          inventory[productKey].totalValue = inventory[productKey].quantity * inventory[productKey].unitPrice;
          inventory[productKey].ton.thtien = inventory[productKey].totalValue;
          
          // Add transaction record
          inventory[productKey].transactions = inventory[productKey].transactions || [];
          inventory[productKey].transactions.push({
            date: invoice.tdlap || '',
            type: isSold ? 'out' : 'in',
            quantity: quantity,
            amount: amount,
            invoiceId: invoice.id,
            invoiceNo: invoice.shdon || ''
          });
        });
      });

      const inventoryArray = Object.values(inventory);
      setInventoryItems(inventoryArray);
      
      // Save to IndexedDB
      await db.saveInventoryItems(inventoryArray);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tạo báo cáo tồn kho');
    } finally {
      setInventoryLoading(false);
    }
  }, [invoices, invoiceDetails]);

  // Helper functions
  const findInvoiceById = useCallback((id: string): InvoiceData | null => {
    return [...invoices.sold, ...invoices.purchase].find(inv => inv.id === id) || null;
  }, [invoices]);

  const getInvoiceDetail = useCallback((id: string): InvoiceDetail | null => {
    return invoiceDetails[id] || null;
  }, [invoiceDetails]);

  const getInventoryByProduct = useCallback((productName: string): InventoryItem[] => {
    const searchTerm = productName.toLowerCase();
    return inventoryItems.filter(item => 
      item.productName.toLowerCase().includes(searchTerm)
    );
  }, [inventoryItems]);

  const getStatistics = useCallback(() => {
    const totalValue = inventoryItems.reduce((sum, item) => sum + item.totalValue, 0);
    
    return {
      totalInvoices: invoices.sold.length + invoices.purchase.length,
      totalSold: invoices.sold.length,
      totalPurchase: invoices.purchase.length,
      totalDetails: Object.keys(invoiceDetails).length,
      totalInventoryItems: inventoryItems.length,
      totalValue
    };
  }, [invoices, invoiceDetails, inventoryItems]);

  // Auto-refresh inventory when details change
  useEffect(() => {
    if (Object.keys(invoiceDetails).length > 0) {
      refreshInventory();
    }
  }, [invoiceDetails, refreshInventory]);

  // Initial load
  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  return {
    // Data
    invoices,
    invoiceDetails,
    inventoryItems,
    
    // Loading states
    loading,
    detailLoading,
    inventoryLoading,
    error,
    
    // Progress
    detailProgress,
    
    // Actions
    loadInvoices,
    loadInvoiceDetail,
    loadAllDetails,
    refreshInventory,
    
    // Helpers
    findInvoiceById,
    getInvoiceDetail,
    getInventoryByProduct,
    getStatistics
  };
};
