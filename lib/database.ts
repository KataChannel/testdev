import { CONFIG } from './config';

export interface InvoiceData {
  id: string;
  nbmst?: string;
  khhdon?: string;
  shdon?: string;
  khmshdon?: string;
  tdlap?: string;
  nmten?: string;
  nbten?: string;
  nmmst?: string;
  nbdchi?: string;
  nmdchi?: string;
  nbsdthoai?: string;
  thtttoan?: string;
  tgtcthue?: string | number;
  tgtthue?: string | number;
  tthai?: string;
  [key: string]: any;
}

export interface InvoiceDetail {
  id: string;
  lastUpdated: string;
  hdhhdvu?: ProductDetail[];
  dshhdv?: ProductDetail[];
  [key: string]: any;
}

export interface ProductDetail {
  idhdon?: string;
  id?: string;
  dgia?: number | null;
  dvtinh?: string | null;
  ltsuat?: string;
  sluong?: number | null;
  stbchu?: string | null;
  stckhau?: string | null;
  stt?: number;
  tchat?: string | null;
  ten?: string | null;
  thtcthue?: number | null;
  thtien?: number;
  tlckhau?: number | null;
  tsuat?: number;
  tthue?: number;
  sxep?: number;
  ttkhac?: any[];
  dvtte?: string | null;
  tgia?: number | null;
  tthhdtrung?: any[];
}

export interface InventoryItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  category?: string;
  supplier?: string;
  lastUpdated: string;
  nhap: {
    sluong: number;
    thtien: number;
    count: number;
    invoices: string[];
  };
  xuat: {
    sluong: number;
    thtien: number;
    count: number;
    invoices: string[];
  };
  ton: {
    sluong: number;
    thtien: number;
  };
  [key: string]: any;
}

export interface CallRecord {
  uuid: string;
  domain_name: string;
  direction: 'inbound' | 'outbound' | 'local';
  caller_id_number: string;
  outbound_caller_id_number?: string;
  destination_number: string;
  start_stamp: string;
  answer_stamp?: string;
  end_stamp: string;
  duration: string;
  billsec: string;
  sip_hangup_disposition: string;
  record_path?: string;
  phonenumber: string;
  call_status: 'ANSWERED' | 'VOICEMAIL' | 'MISSED' | 'CANCELED' | 'FAILED' | 'UNKNOWN';
}

class DatabaseManager {
  private db: IDBDatabase | null = null;

  async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB.NAME, CONFIG.DB.VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create all stores - ensure they all exist
        Object.values(CONFIG.DB.STORES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });

        // Specifically ensure inventory store exists
        if (!db.objectStoreNames.contains(CONFIG.DB.STORES.INVENTORY)) {
          db.createObjectStore(CONFIG.DB.STORES.INVENTORY, { keyPath: 'id' });
        }
      };
    });
  }

  async loadData<T>(storeName: string): Promise<T[]> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([storeName], "readonly");
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
  }

  async saveData<T extends { id: string }>(storeName: string, data: T): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      const dataWithTimestamp = {
        ...data,
        lastUpdated: new Date().toISOString(),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(dataWithTimestamp);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error saving data to ${storeName}:`, error);
      throw error;
    }
  }

  async saveMultipleData<T extends { id: string }>(storeName: string, dataArray: T[]): Promise<void> {
    try {
      const db = await this.openDB();
      
      // Check if store exists
      if (!db.objectStoreNames.contains(storeName)) {
        throw new Error(`Object store '${storeName}' does not exist`);
      }
      
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      const promises = dataArray.map(data => {
        const dataWithTimestamp = {
          ...data,
          lastUpdated: new Date().toISOString(),
        };
        
        return new Promise<void>((resolve, reject) => {
          const request = store.put(dataWithTimestamp);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      await Promise.all(promises);
    } catch (error) {
      console.error(`Error saving multiple data to ${storeName}:`, error);
      throw error;
    }
  }

  async getData<T>(storeName: string, id: string): Promise<T | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error getting data from ${storeName}:`, error);
      return null;
    }
  }

  async deleteData(storeName: string, id: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error deleting data from ${storeName}:`, error);
      throw error;
    }
  }

  async clearStore(storeName: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error clearing store ${storeName}:`, error);
      throw error;
    }
  }

  async checkExists(storeName: string, id: string): Promise<boolean> {
    try {
      const data = await this.getData(storeName, id);
      return !!data;
    } catch (error) {
      console.error(`Error checking existence in ${storeName}:`, error);
      return false;
    }
  }

  // Specific methods for invoice operations
  async loadInvoices(type: 'sold' | 'purchase'): Promise<InvoiceData[]> {
    const storeName = type === 'sold' ? CONFIG.DB.STORES.SOLD : CONFIG.DB.STORES.PURCHASE;
    console.log(`Loading invoices from ${storeName} store...`);
    
    return this.loadData<InvoiceData>(storeName);
  }

  async saveInvoice(type: 'sold' | 'purchase', invoice: InvoiceData): Promise<void> {
    const storeName = type === 'sold' ? CONFIG.DB.STORES.SOLD : CONFIG.DB.STORES.PURCHASE;
    return this.saveData(storeName, invoice);
  }

  async saveInvoices(type: 'sold' | 'purchase', invoices: InvoiceData[]): Promise<void> {
    const storeName = type === 'sold' ? CONFIG.DB.STORES.SOLD : CONFIG.DB.STORES.PURCHASE;
    return this.saveMultipleData(storeName, invoices);
  }

  async loadInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
    return this.getData<InvoiceDetail>(CONFIG.DB.STORES.DETAILS, id);
  }

  async saveInvoiceDetail(detail: InvoiceDetail): Promise<void> {
    return this.saveData(CONFIG.DB.STORES.DETAILS, detail);
  }

  async loadInventory(): Promise<InventoryItem[]> {
    return this.loadData<InventoryItem>(CONFIG.DB.STORES.INVENTORY);
  }

  async saveInventoryItem(item: InventoryItem): Promise<void> {
    return this.saveData(CONFIG.DB.STORES.INVENTORY, item);
  }

  async saveInventoryItems(items: InventoryItem[]): Promise<void> {
    return this.saveMultipleData(CONFIG.DB.STORES.INVENTORY, items);
  }

  async loadCallHistory(): Promise<CallRecord[]> {
    return this.loadData<CallRecord>(CONFIG.DB.STORES.CALL_HISTORY);
  }

  async saveCallRecord(record: CallRecord): Promise<void> {
    const recordWithId = { ...record, id: record.uuid };
    return this.saveData(CONFIG.DB.STORES.CALL_HISTORY, recordWithId);
  }

  // Find invoice by ID across both stores
  async findInvoiceById(invoiceId: string): Promise<InvoiceData | null> {
    try {
      const [soldData, purchaseData] = await Promise.all([
        this.loadInvoices('sold'),
        this.loadInvoices('purchase')
      ]);
      
      const allInvoices = [...soldData, ...purchaseData];
      return allInvoices.find(invoice => invoice.id === invoiceId) || null;
    } catch (error) {
      console.error('Error finding invoice:', error);
      return null;
    }
  }

  // Export all data
  async exportAllData(): Promise<any> {
    try {
      const [soldData, purchaseData, detailsData, inventoryData, callData] = await Promise.all([
        this.loadInvoices('sold'),
        this.loadInvoices('purchase'),
        this.loadData<InvoiceDetail>(CONFIG.DB.STORES.DETAILS),
        this.loadInventory(),
        this.loadCallHistory()
      ]);

      return {
        exportDate: new Date().toISOString(),
        version: CONFIG.DB.VERSION,
        data: {
          sold: soldData,
          purchase: purchaseData,
          details: detailsData,
          inventory: inventoryData,
          callHistory: callData
        },
        summary: {
          totalSold: soldData.length,
          totalPurchase: purchaseData.length,
          totalDetails: detailsData.length,
          totalInventory: inventoryData.length,
          totalCallHistory: callData.length,
          totalRecords: soldData.length + purchaseData.length + detailsData.length + inventoryData.length + callData.length
        }
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }
}

export const db = new DatabaseManager();
