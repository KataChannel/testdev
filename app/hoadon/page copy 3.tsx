"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface InvoiceData {
  id: string;
  nbmst?: string;
  khhdon?: string;
  shdon?: string;
  khmshdon?: string;
  tdlap?: string;
  nmten?: string;
  nbten?: string;
  tgtcthue?: string | number;
  tgtthue?: string | number;
  tthai?: string;
  [key: string]: any;
}

interface InvoiceDetail {
  [key: string]: any;
}

interface SavedDataState {
  sold: InvoiceData[];
  purchase: InvoiceData[];
}

interface SortConfig {
  key: keyof InvoiceData | null;
  direction: "asc" | "desc";
}

interface FilterConfig {
  status: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

// Use the same IndexedDB constants from app/page.tsx
const DB_NAME = "InvoiceDB";
const DB_VERSION = 3;
const STORE_NAME_SOLD = "invoice_sold";
const STORE_NAME_PURCHASE = "invoice_purchase";
const STORE_NAME_DETAILS = "invoice_details";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME_SOLD)) {
        db.createObjectStore(STORE_NAME_SOLD, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORE_NAME_PURCHASE)) {
        db.createObjectStore(STORE_NAME_PURCHASE, { keyPath: "id" });
      }

      // Create new store for invoice details
      if (!db.objectStoreNames.contains(STORE_NAME_DETAILS)) {
        db.createObjectStore(STORE_NAME_DETAILS, { keyPath: "id" });
      }
    };
  });
};

const loadFromIndexedDB = async (storeName: string): Promise<InvoiceData[]> => {
  try {
    const db = await openDB();
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
};

const saveDetailToIndexedDB = async (
  invoiceId: string,
  detail: InvoiceDetail
): Promise<void> => {
  try {
    const db = await openDB();

    const transaction = db.transaction([STORE_NAME_DETAILS], "readwrite");
    const store = transaction.objectStore(STORE_NAME_DETAILS);

    const detailWithId = {
      id: invoiceId,
      ...detail,
      lastUpdated: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(detailWithId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error saving detail for invoice ${invoiceId}:`, error);
    throw error;
  }
};

const checkDetailExists = async (invoiceId: string): Promise<boolean> => {
  try {
    const db = await openDB();

    const transaction = db.transaction([STORE_NAME_DETAILS], "readonly");
    const store = transaction.objectStore(STORE_NAME_DETAILS);

    return new Promise((resolve, reject) => {
      const request = store.get(invoiceId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error checking detail for invoice ${invoiceId}:`, error);
    return false;
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
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

// Export functions
const exportToExcel = (data: InvoiceData[], filename: string) => {
  // Create CSV content with correct field mappings
  const headers = [
    "ID",
    "Mã số thuế NB",
    "Ký hiệu hóa đơn",
    "Số hóa đơn",
    "Ngày lập",
    "Tên người bán",
    "Tên người mua",
    "Tổng tiền",
    "Tiền thuế",
    "Trạng thái",
  ];
  const csvContent = [
    headers.join(","),
    ...data.map((invoice) =>
      [
        invoice.id || "",
        invoice.nbmst || "",
        invoice.khhdon || "",
        invoice.shdon || "",
        invoice.tdlap
          ? new Date(invoice.tdlap).toLocaleDateString("vi-VN")
          : "",
        `"${(invoice.nbten || "").replace(/"/g, '""')}"`,
        `"${(invoice.nmten || "").replace(/"/g, '""')}"`,
        invoice.tgtcthue || "",
        invoice.tgtthue || "",
        getInvoiceStatus(invoice.tthai),
      ].join(",")
    ),
  ].join("\n");

  // Add BOM for proper UTF-8 encoding in Excel
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
  }
};

const exportToJSON = (data: InvoiceData[], filename: string) => {
  const jsonData = {
    exportDate: new Date().toISOString(),
    totalRecords: data.length,
    invoices: data,
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
  }
};

// Add helper function for status mapping
const getInvoiceStatus = (tthai: string | undefined) => {
  if (!tthai) return "Không xác định";
  switch (tthai) {
    case "1":
      return "Đã ký";
    case "2":
      return "Đã gửi";
    case "3":
      return "Đã nhận";
    case "4":
      return "Đã hủy";
    case "5":
      return "Đã xác nhận";
    default:
      return "Không xác định";
  }
};
// Format currency helper
const formatCurrency = (amount: string | number | undefined) => {
  if (!amount) return "N/A";
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "N/A";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(numAmount);
};
// Parse currency value for calculations
const parseCurrency = (amount: string | number | undefined): number => {
  if (!amount) return 0;
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return isNaN(numAmount) ? 0 : numAmount;
};

// Add new component for invoice detail dialog
const DialogChitiet = ({
  isOpen,
  onClose,
  invoice,
  detail,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceData | null;
  detail: InvoiceDetail | null;
}) => {
  if (!isOpen || !invoice) return null;

  const formatDetailValue = (value: any) => {
    if (value === null || value === undefined) return "N/A";
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return value.toString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Chi tiết hóa đơn #{invoice.shdon}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Basic Invoice Info */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Thông tin cơ bản
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  ID:
                </label>
                <p className="text-sm text-gray-900">{invoice.id}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Số hóa đơn:
                </label>
                <p className="text-sm text-gray-900">
                  {invoice.shdon || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Ký hiệu hóa đơn:
                </label>
                <p className="text-sm text-gray-900">
                  {invoice.khhdon || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Mã số thuế NB:
                </label>
                <p className="text-sm text-gray-900">
                  {invoice.nbmst || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Ngày lập:
                </label>
                <p className="text-sm text-gray-900">
                  {invoice.tdlap
                    ? new Date(invoice.tdlap).toLocaleDateString("vi-VN")
                    : "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Tên khách hàng:
                </label>
                <p className="text-sm text-gray-900">{invoice.nmten || "N/A"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Tên người bán:
                </label>
                <p className="text-sm text-gray-900">{invoice.nbten || "N/A"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Tổng tiền:
                </label>
                <p className="text-sm text-gray-900 font-semibold">
                  {formatCurrency(invoice.tgtcthue)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Tiền thuế:
                </label>
                <p className="text-sm text-gray-900">
                  {formatCurrency(invoice.tgtthue)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  Trạng thái:
                </label>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    invoice.tthai === "1" || invoice.tthai === "5"
                      ? "bg-green-100 text-green-800"
                      : invoice.tthai === "4"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {getInvoiceStatus(invoice.tthai)}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Info from API */}
          {detail ? (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Chi tiết từ API
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Chi tiết từ API
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Chưa có dữ liệu chi tiết từ API. Vui lòng sử dụng chức năng "Tải
                  chi tiết" để lấy thông tin đầy đủ.
                </p>
              </div>
            </div>
          )}

          {/* All fields from invoice object */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Tất cả dữ liệu
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {Object.entries(invoice).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-medium text-gray-600 w-32 flex-shrink-0">
                      {key}:
                    </span>
                    <span className="text-gray-900 break-all">
                      {formatDetailValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default function HoaDonPage() {
  const [invoiceData, setInvoiceData] = useState<SavedDataState>({
    sold: [],
    purchase: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sold" | "purchase">("sold");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterConfig>({
    status: "",
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
  });

  // Detail loading states
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailProgress, setDetailProgress] = useState({
    current: 0,
    total: 0,
    processed: 0,
    errors: 0,
  });
  const [token, setToken] = useState<string>(
    "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiI1OTAxMjA5NzgyIiwidHlwZSI6MiwiZXhwIjoxNzUyMjIxOTI4LCJpYXQiOjE3NTIxMzU1Mjh9.vJV8m2B2zCm1BjZI6WexG8DW8vmIoI-ZLljpK8ga2zoheXAO3hUBHP3b0CFctLVzLbnheZLXfuuVmp3GGnzhaw"
  );
  const [delayBetweenRequests, setDelayBetweenRequests] =
    useState<number>(2000);

  // Add state for showing/hiding the advanced controls
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  // Add new states for dialog
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);

  useEffect(() => {
    const loadInvoiceData = async () => {
      try {
        setLoading(true);
        const [soldData, purchaseData] = await Promise.all([
          loadFromIndexedDB(STORE_NAME_SOLD),
          loadFromIndexedDB(STORE_NAME_PURCHASE),
        ]);
        console.log("Sold Invoices:", soldData);
        console.log("Purchase Invoices:", purchaseData);

        setInvoiceData({
          sold: soldData,
          purchase: purchaseData,
        });
      } catch (error) {
        console.error("Error loading invoice data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInvoiceData();
  }, []);

  // Sorting function
  const handleSort = (key: keyof InvoiceData) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort invoices
  const filteredAndSortedInvoices = useMemo(() => {
    let filtered = invoiceData[activeTab].filter((invoice) => {
      // Text search
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const searchMatch = Object.values(invoice).some(
          (value) =>
            value && value.toString().toLowerCase().includes(searchLower)
        );
        if (!searchMatch) return false;
      }

      // Status filter
      if (filters.status && invoice.tthai !== filters.status) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom || filters.dateTo) {
        const invoiceDate = invoice.tdlap ? new Date(invoice.tdlap) : null;
        if (invoiceDate) {
          if (filters.dateFrom && invoiceDate < new Date(filters.dateFrom))
            return false;
          if (filters.dateTo && invoiceDate > new Date(filters.dateTo))
            return false;
        }
      }

      // Amount range filter
      const amount = parseCurrency(invoice.tgtcthue);
      if (filters.amountMin && amount < parseFloat(filters.amountMin))
        return false;
      if (filters.amountMax && amount > parseFloat(filters.amountMax))
        return false;

      return true;
    });

    // Sort
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        // Handle dates
        if (sortConfig.key === "tdlap") {
          const aDate = aValue ? new Date(aValue) : new Date(0);
          const bDate = bValue ? new Date(bValue) : new Date(0);
          return sortConfig.direction === "asc"
            ? aDate.getTime() - bDate.getTime()
            : bDate.getTime() - aDate.getTime();
        }

        // Handle numbers (amounts)
        if (sortConfig.key === "tgtcthue" || sortConfig.key === "tgtthue") {
          const aNum = parseCurrency(aValue);
          const bNum = parseCurrency(bValue);
          return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
        }

        // Handle strings
        const aStr = (aValue || "").toString().toLowerCase();
        const bStr = (bValue || "").toString().toLowerCase();

        if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [invoiceData, activeTab, searchTerm, filters, sortConfig]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalAmount = filteredAndSortedInvoices.reduce(
      (sum, invoice) => sum + parseCurrency(invoice.tgtcthue),
      0
    );
    const totalTax = filteredAndSortedInvoices.reduce(
      (sum, invoice) => sum + parseCurrency(invoice.tgtthue),
      0
    );

    const statusCounts = filteredAndSortedInvoices.reduce((acc, invoice) => {
      const status = invoice.tthai || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRecords: filteredAndSortedInvoices.length,
      totalAmount,
      totalTax,
      statusCounts,
    };
  }, [filteredAndSortedInvoices]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentInvoices = filteredAndSortedInvoices.slice(startIndex, endIndex);

  // Reset pagination when changing tabs, search, or filters
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, filters, sortConfig]);

  // Export handlers
  const handleExportExcel = () => {
    const filename = `hoa-don-${activeTab === "sold" ? "ban-ra" : "mua-vao"}-${
      new Date().toISOString().split("T")[0]
    }`;
    exportToExcel(filteredAndSortedInvoices, filename);
  };

  const handleExportJSON = () => {
    const filename = `hoa-don-${activeTab === "sold" ? "ban-ra" : "mua-vao"}-${
      new Date().toISOString().split("T")[0]
    }`;
    exportToJSON(filteredAndSortedInvoices, filename);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: "",
      dateFrom: "",
      dateTo: "",
      amountMin: "",
      amountMax: "",
    });
    setSearchTerm("");
    setSortConfig({ key: null, direction: "asc" });
  };

  // Utility function to delay execution
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Load all invoice details
  const loadAllInvoiceDetails = async () => {
    if (!token.trim()) {
      alert("Vui lòng nhập Authorization Token");
      return;
    }

    const currentInvoices = invoiceData[activeTab];

    // Filter invoices that have required parameters
    const validInvoices = currentInvoices.filter(
      (invoice) =>
        invoice.nbmst && invoice.khhdon && invoice.shdon && invoice.khmshdon
    );

    if (validInvoices.length === 0) {
      alert(
        "Không có hóa đơn nào có đủ thông tin để tải chi tiết (nbmst, khhdon, shdon, khmshdon)"
      );
      return;
    }

    const confirmed = window.confirm(
      `Bạn có muốn tải chi tiết cho ${validInvoices.length} hóa đơn ${
        activeTab === "sold" ? "bán ra" : "mua vào"
      }?\n\n` +
        `Thời gian ước tính: ${Math.ceil(
          (validInvoices.length * delayBetweenRequests) / 1000 / 60
        )} phút\n` +
        `Delay giữa các request: ${delayBetweenRequests}ms`
    );

    if (!confirmed) return;

    setDetailLoading(true);
    setDetailProgress({
      current: 0,
      total: validInvoices.length,
      processed: 0,
      errors: 0,
    });

    let processed = 0;
    let errors = 0;
    let skipped = 0;

    try {
      for (let i = 0; i < validInvoices.length; i++) {
        const invoice = validInvoices[i];

        setDetailProgress((prev) => ({ ...prev, current: i + 1 }));

        try {
          // Check if detail already exists
          const detailExists = await checkDetailExists(invoice.id);

          if (detailExists) {
            skipped++;
            console.log(
              `Detail already exists for invoice ${invoice.id}, skipping...`
            );
            continue;
          }

          // Fetch detail from API
          const detail = await fetchInvoiceDetail(
            invoice.nbmst!,
            invoice.khhdon!,
            invoice.shdon!,
            invoice.khmshdon!,
            token
          );

          // Save to IndexedDB
          await saveDetailToIndexedDB(invoice.id, detail);
          processed++;
        } catch (error) {
          errors++;
          console.error(
            `Error loading detail for invoice ${invoice.id}:`,
            error
          );
        }

        setDetailProgress((prev) => ({ ...prev, processed, errors }));

        // Add delay between requests (except for the last one)
        if (i < validInvoices.length - 1) {
          await delay(delayBetweenRequests);
        }
      }

      // Show completion message
      const message =
        `Hoàn thành tải chi tiết hóa đơn!\n\n` +
        `Tổng số: ${validInvoices.length}\n` +
        `Đã xử lý: ${processed}\n` +
        `Bỏ qua (đã có): ${skipped}\n` +
        `Lỗi: ${errors}`;

      alert(message);
    } catch (error) {
      console.error("Error in loadAllInvoiceDetails:", error);
      alert(
        `Lỗi khi tải chi tiết hóa đơn: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setDetailLoading(false);
      setDetailProgress({ current: 0, total: 0, processed: 0, errors: 0 });
    }
  };

  // Sort icon component
  const SortIcon = ({ column }: { column: keyof InvoiceData }) => {
    if (sortConfig.key !== column) {
      return <span className="text-gray-400">↕️</span>;
    }
    return (
      <span className="text-blue-600">
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // Function to load detail from IndexedDB
  const loadDetailFromIndexedDB = async (invoiceId: string): Promise<InvoiceDetail | null> => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME_DETAILS], "readonly");
      const store = transaction.objectStore(STORE_NAME_DETAILS);

      return new Promise((resolve, reject) => {
        const request = store.get(invoiceId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error loading detail for invoice ${invoiceId}:`, error);
      return null;
    }
  };

  // Function to handle opening detail dialog
  const handleOpenDetail = async (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setIsDialogOpen(true);
    setDialogLoading(true);
    setSelectedInvoiceDetail(null);

    try {
      // Try to load detail from IndexedDB first
      const detail = await loadDetailFromIndexedDB(invoice.id);
      setSelectedInvoiceDetail(detail);
    } catch (error) {
      console.error('Error loading invoice detail:', error);
    } finally {
      setDialogLoading(false);
    }
  };

  // Function to close dialog
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedInvoice(null);
    setSelectedInvoiceDetail(null);
    setDialogLoading(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-xl">Đang tải dữ liệu hóa đơn...</div>
        </div>
      </div>
    );
  }
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Danh sách hóa đơn điện tử</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800">
            Hóa đơn bán ra
          </h3>
          <p className="text-2xl font-bold text-blue-600">
            {invoiceData.sold.length}
          </p>
        </div>
        <div className="bg-green-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800">
            Hóa đơn mua vào
          </h3>
          <p className="text-2xl font-bold text-green-600">
            {invoiceData.purchase.length}
          </p>
        </div>
        <div className="bg-purple-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-800">Tổng cộng</h3>
          <p className="text-2xl font-bold text-purple-600">
            {invoiceData.sold.length + invoiceData.purchase.length}
          </p>
        </div>
        <div className="bg-orange-100 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-orange-800">Đã lọc</h3>
          <p className="text-2xl font-bold text-orange-600">
            {summaryStats.totalRecords}
          </p>
        </div>
      </div>

      {/* Filtered Summary */}
      {summaryStats.totalRecords > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-2">Thống kê đã lọc</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-gray-600">
                Tổng tiền (chưa thuế):
              </span>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(summaryStats.totalAmount)}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Tổng thuế:</span>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(summaryStats.totalTax)}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Trạng thái:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(summaryStats.statusCounts).map(
                  ([status, count]) => (
                    <span
                      key={status}
                      className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                    >
                      {getInvoiceStatus(status)}: {count}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Controls (Detail Loading + Export) - Collapsible */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowAdvancedControls(!showAdvancedControls)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              🔧 Công cụ nâng cao
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                Tải chi tiết & Xuất dữ liệu
              </span>
              <span className="text-gray-400">
                {showAdvancedControls ? "▲" : "▼"}
              </span>
            </div>
          </button>
        </div>

        {showAdvancedControls && (
          <div className="p-6">
            {/* Export Buttons */}
            <div className="mb-6">
              <h3 className="text-md font-medium text-gray-700 mb-3">
                📄 Xuất dữ liệu
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  📊 Xuất Excel ({summaryStats.totalRecords})
                </button>
                <button
                  onClick={handleExportJSON}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  📄 Xuất JSON ({summaryStats.totalRecords})
                </button>
              </div>
            </div>

            {/* Detail Loading Controls */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-md font-medium text-gray-700 mb-4">
                🔄 Tải chi tiết hóa đơn từ API
              </h3>

              {/* Token Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Authorization Token:
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 text-xs"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Bearer token"
                  disabled={detailLoading}
                />
              </div>

              {/* Delay Setting and Load Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    Delay (ms):
                  </label>
                  <input
                    type="number"
                    min="500"
                    max="10000"
                    step="500"
                    className="w-24 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={delayBetweenRequests}
                    onChange={(e) =>
                      setDelayBetweenRequests(parseInt(e.target.value) || 2000)
                    }
                    disabled={detailLoading}
                  />
                  <span className="text-xs text-gray-600">
                    (2000ms khuyến nghị)
                  </span>
                </div>

                <button
                  onClick={loadAllInvoiceDetails}
                  disabled={detailLoading || !token.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {detailLoading
                    ? "Đang tải..."
                    : `🔄 Tải tất cả chi tiết ${
                        activeTab === "sold" ? "bán ra" : "mua vào"
                      }`}
                </button>
              </div>

              {/* Progress Bar */}
              {detailLoading && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span>
                      Tiến độ: {detailProgress.current}/{detailProgress.total} (
                      {Math.round(
                        (detailProgress.current / detailProgress.total) * 100
                      )}
                      %)
                    </span>
                    <span>
                      Xử lý: {detailProgress.processed} | Lỗi:{" "}
                      {detailProgress.errors}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          (detailProgress.current / detailProgress.total) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-row space-x-2">
        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab("sold")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "sold"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
            disabled={detailLoading}
          >
            Hóa đơn bán ra ({invoiceData.sold.length})
          </button>
          <button
            onClick={() => setActiveTab("purchase")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "purchase"
                ? "bg-white text-green-600 shadow-sm"
                : "text-gray-600 hover:text-gray-800"
            }`}
            disabled={detailLoading}
          >
            Hóa đơn mua vào ({invoiceData.purchase.length})
          </button>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Tìm kiếm hóa đơn..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={detailLoading}
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              🔍 Bộ lọc {showFilters ? "▲" : "▼"}
            </button>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              🗑️ Xóa lọc
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trạng thái:
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={filters.status}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                  >
                    <option value="">Tất cả</option>
                    <option value="1">Đã ký</option>
                    <option value="2">Đã gửi</option>
                    <option value="3">Đã nhận</option>
                    <option value="4">Đã hủy</option>
                    <option value="5">Đã xác nhận</option>
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Từ ngày:
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={filters.dateFrom}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateFrom: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Đến ngày:
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={filters.dateTo}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateTo: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Amount Min */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiền từ:
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={filters.amountMin}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        amountMin: e.target.value,
                      }))
                    }
                    placeholder="0"
                  />
                </div>

                {/* Amount Max */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiền đến:
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={filters.amountMax}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        amountMax: e.target.value,
                      }))
                    }
                    placeholder="999999999"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Invoice Table */}
      {currentInvoices.length > 0 ? (
        <>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("shdon")}
                    >
                      <div className="flex items-center gap-1">
                        Số hóa đơn
                        <SortIcon column="shdon" />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("tdlap")}
                    >
                      <div className="flex items-center gap-1">
                        Ngày lập
                        <SortIcon column="tdlap" />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("nmten")}
                    >
                      <div className="flex items-center gap-1">
                        Tên khách hàng
                        <SortIcon column="nmten" />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("tgtcthue")}
                    >
                      <div className="flex items-center gap-1">
                        Tổng tiền
                        <SortIcon column="tgtcthue" />
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("tthai")}
                    >
                      <div className="flex items-center gap-1">
                        Trạng thái
                        <SortIcon column="tthai" />
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      API Params
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.shdon || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invoice.tdlap
                          ? new Date(invoice.tdlap).toLocaleDateString("vi-VN")
                          : "N/A"}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate"
                        title={invoice.nmten || "N/A"}
                      >
                        {invoice.nmten || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(invoice.tgtcthue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            invoice.tthai === "1" || invoice.tthai === "5"
                              ? "bg-green-100 text-green-800"
                              : invoice.tthai === "4"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {getInvoiceStatus(invoice.tthai)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {invoice.nbmst &&
                        invoice.khhdon &&
                        invoice.shdon &&
                        invoice.khmshdon ? (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                            ✓ Đầy đủ
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                            ✗ Thiếu
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleOpenDetail(invoice)}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-100 hover:bg-indigo-200 px-3 py-1 rounded-md transition-colors"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-600">
                Hiển thị {startIndex + 1}-
                {Math.min(endIndex, filteredAndSortedInvoices.length)}
                trong tổng số {filteredAndSortedInvoices.length} hóa đơn
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1 || detailLoading}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-600 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Trước
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={detailLoading}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === pageNum
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      } disabled:opacity-50`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages || detailLoading}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-600 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-gray-500">
            {searchTerm || Object.values(filters).some((f) => f)
              ? `Không tìm thấy hóa đơn nào phù hợp với điều kiện lọc`
              : `Chưa có dữ liệu hóa đơn ${
                  activeTab === "sold" ? "bán ra" : "mua vào"
                }`}
          </div>
          {!searchTerm && !Object.values(filters).some((f) => f) && (
            <p className="text-sm text-gray-400 mt-2">
              Vui lòng tải dữ liệu từ trang chính trước
            </p>
          )}
        </div>
      )}

      {/* Detail Dialog */}
      <DialogChitiet
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        invoice={selectedInvoice}
        detail={selectedInvoiceDetail}
      />
    </div>
  );
}
