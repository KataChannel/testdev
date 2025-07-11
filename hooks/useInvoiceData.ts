'use client';

import { useState, useEffect, useCallback } from 'react';
import { db, InvoiceData, InvoiceDetail } from '@/lib/database';
import { apiService } from '@/lib/api';
import { CONFIG, INVOICE_TYPES } from '@/lib/config';
import { delay, validateInvoiceParams } from '@/lib/utils';

export interface UseInvoiceDataResult {
  // Data
  invoices: { sold: InvoiceData[]; purchase: InvoiceData[] };
  loading: boolean;
  error: string | null;
  
  // Actions
  loadInvoices: () => Promise<void>;
  loadInvoiceDetail: (invoice: InvoiceData, token: string) => Promise<InvoiceDetail | null>;
  loadAllDetails: (type: 'sold' | 'purchase', token: string, delayMs?: number) => Promise<void>;
  
  // Progress tracking
  detailProgress: {
    current: number;
    total: number;
    processed: number;
    errors: number;
  };
  detailLoading: boolean;
}

export const useInvoiceData = (): UseInvoiceDataResult => {
  const [invoices, setInvoices] = useState<{ sold: InvoiceData[]; purchase: InvoiceData[] }>({
    sold: [],
    purchase: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailProgress, setDetailProgress] = useState({
    current: 0,
    total: 0,
    processed: 0,
    errors: 0
  });

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInvoiceDetail = useCallback(async (invoice: InvoiceData, token: string): Promise<InvoiceDetail | null> => {
    try {
      // Check if detail exists in IndexedDB first
      const existingDetail = await db.loadInvoiceDetail(invoice.id);
      if (existingDetail) {
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

      // Save to IndexedDB
      const detailWithId: InvoiceDetail = {
        ...detail,
        id: invoice.id,
        lastUpdated: new Date().toISOString()
      };
      
      await db.saveInvoiceDetail(detailWithId);
      
      return detailWithId;
    } catch (err) {
      console.error('Error loading invoice detail:', err);
      throw err;
    }
  }, []);

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
          const exists = await db.checkExists(CONFIG.DB.STORES.DETAILS, invoice.id);
          
          if (!exists) {
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
  }, [invoices, loadInvoiceDetail]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  return {
    invoices,
    loading,
    error,
    loadInvoices,
    loadInvoiceDetail,
    loadAllDetails,
    detailProgress,
    detailLoading
  };
};
