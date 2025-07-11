export const CONFIG = {
  // API Configuration
  API: {
    BASE_URL: process.env.NEXT_PUBLIC_INVOICE_API_URL || 'https://hoadondientu.gdt.gov.vn:30000',
    DEFAULT_TOKEN: process.env.NEXT_PUBLIC_INVOICE_API_TOKEN || '',
    VERSION: 'v1.0'
  },
  
  // Call Center Configuration  
  CALL_CENTER: {
    BASE_URL: process.env.NEXT_PUBLIC_CALL_CENTER_API_URL || '',
    API_TOKEN: process.env.NEXT_PUBLIC_CALL_CENTER_API_TOKEN || '',
    DOMAIN: process.env.NEXT_PUBLIC_CALL_CENTER_API_DOMAIN || ''
  },

  // Facebook Configuration
  FACEBOOK: {
    ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN || '',
    ACCESS_TOKEN1: process.env.FACEBOOK_ACCESS_TOKEN1 || '',
    PAGE_ID: process.env.FACEBOOK_PAGE_ID || '',
    PAGE_ID1: process.env.FACEBOOK_PAGE_ID1 || '',
    API_VERSION: process.env.FACEBOOK_API_VERSION || 'v23.0'
  },

  // IndexedDB Configuration
  DB: {
    NAME: 'InvoiceDB',
    VERSION: 4, // Incremented from 3 to 4 to force database upgrade
    STORES: {
      SOLD: 'sold_invoices',
      PURCHASE: 'purchase_invoices',
      DETAILS: 'invoice_details',
      INVENTORY: 'inventory_data',
      CALL_HISTORY: 'call_history'
    }
  },

  // Pagination & UI
  UI: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    DEFAULT_DELAY: 2000,
    DATE_FORMAT: 'vi-VN'
  },

  // Default MST for filtering
  DEFAULT_MST: '5901209782'
};

export const INVOICE_STATUS = {
  '1': 'Đã ký',
  '2': 'Đã gửi', 
  '3': 'Đã nhận',
  '4': 'Đã hủy',
  '5': 'Đã xác nhận'
} as const;

export const INVOICE_TYPES = {
  SOLD: 'sold',
  PURCHASE: 'purchase'
} as const;

export const ROUTES = {
  HOME: '/',
  INVOICES: '/hoadon',
  INVOICE_DETAIL: '/hoadonchitiet',
  INVENTORY: '/xuatnhapton',
  CALL_CENTER: '/callcenter',
  FACEBOOK: '/facebook'
} as const;
