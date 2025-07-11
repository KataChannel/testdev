import { CONFIG, INVOICE_STATUS } from './config';
import { InvoiceData } from './database';

export const formatCurrency = (amount: string | number | undefined): string => {
  if (!amount) return "N/A";
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "N/A";
  return new Intl.NumberFormat(CONFIG.UI.DATE_FORMAT, {
    style: "currency",
    currency: "VND",
  }).format(numAmount);
};

export const parseCurrency = (amount: string | number | undefined): number => {
  if (!amount) return 0;
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return isNaN(numAmount) ? 0 : numAmount;
};

export const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString(CONFIG.UI.DATE_FORMAT);
  } catch {
    return dateString;
  }
};

export const formatDateTime = (dateString: string | undefined): string => {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleString(CONFIG.UI.DATE_FORMAT);
  } catch {
    return dateString;
  }
};

export const getInvoiceStatus = (status: string | undefined): string => {
  if (!status) return "Không xác định";
  return INVOICE_STATUS[status as keyof typeof INVOICE_STATUS] || "Không xác định";
};

export const formatDateForAPI = (dateString: string): string => {
  const [datePart, timePart] = dateString.split('T');
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}T${timePart}`;
};

export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const exportToCSV = (data: InvoiceData[], filename: string): void => {
  const headers = [
    "ID", "Mã số thuế NB", "Ký hiệu hóa đơn", "Số hóa đơn",
    "Ngày lập", "Tên người bán", "Tên người mua", 
    "Tổng tiền", "Tiền thuế", "Trạng thái"
  ];
  
  const csvContent = [
    headers.join(","),
    ...data.map((invoice) =>
      [
        invoice.id || "",
        invoice.nbmst || "",
        invoice.khhdon || "",
        invoice.shdon || "",
        formatDate(invoice.tdlap),
        `"${(invoice.nbten || "").replace(/"/g, '""')}"`,
        `"${(invoice.nmten || "").replace(/"/g, '""')}"`,
        invoice.tgtcthue || "",
        invoice.tgtthue || "",
        getInvoiceStatus(invoice.tthai),
      ].join(",")
    ),
  ].join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const exportToJSON = (data: any[], filename: string): void => {
  const jsonData = {
    exportDate: new Date().toISOString(),
    totalRecords: data.length,
    data: data,
  };

  const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
    type: "application/json",
  });
  
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

export const validateInvoiceParams = (invoice: InvoiceData): boolean => {
  return !!(invoice.nbmst && invoice.khhdon && invoice.shdon && invoice.khmshdon);
};

export const generateInvoiceUrl = (invoiceId: string): string => {
  return `/hoadonchitiet?id=${invoiceId}`;
};

export const generateInventoryUrl = (productName?: string): string => {
  const baseUrl = '/xuatnhapton';
  return productName ? `${baseUrl}?search=${encodeURIComponent(productName)}` : baseUrl;
};

// Utility function to navigate between pages
export const navigateToPage = (url: string, newTab: boolean = false): void => {
  if (newTab) {
    window.open(url, '_blank');
  } else {
    window.location.href = url;
  }
};

// Format duration for call center
export const formatDuration = (seconds: string | number): string => {
  const sec = typeof seconds === 'string' ? parseInt(seconds) : seconds;
  if (isNaN(sec)) return '0:00';
  const minutes = Math.floor(sec / 60);
  const remainingSeconds = sec % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Get status color for different entities
export const getStatusColor = (status: string, type: 'invoice' | 'call' | 'extension' = 'invoice'): string => {
  if (type === 'call') {
    switch (status) {
      case 'ANSWERED': return 'text-green-600';
      case 'MISSED': return 'text-red-600';
      case 'CANCELED': return 'text-yellow-600';
      case 'FAILED': return 'text-red-800';
      default: return 'text-gray-600';
    }
  }
  
  if (type === 'extension') {
    return status ? 'text-green-600' : 'text-red-600';
  }
  
  // Default invoice status colors
  switch (status) {
    case '1':
    case '5': return 'text-green-600';
    case '4': return 'text-red-600';
    default: return 'text-yellow-600';
  }
};
