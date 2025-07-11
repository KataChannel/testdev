"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

// Use the same IndexedDB constants from app/page.tsx
const DB_NAME = 'InvoiceDB';
const DB_VERSION = 3;
const STORE_NAME_SOLD = 'invoice_sold';
const STORE_NAME_PURCHASE = 'invoice_purchase';
const STORE_NAME_DETAILS = 'invoice_details';

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

      if (!db.objectStoreNames.contains(STORE_NAME_DETAILS)) {
        db.createObjectStore(STORE_NAME_DETAILS, { keyPath: 'id' });
      }
    };
  });
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

const loadDetailFromIndexedDB = async (invoiceId: string): Promise<InvoiceDetail | null> => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME_DETAILS], 'readonly');
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

const findInvoiceById = async (invoiceId: string): Promise<InvoiceData | null> => {
  try {
    const [soldData, purchaseData] = await Promise.all([
      loadFromIndexedDB(STORE_NAME_SOLD),
      loadFromIndexedDB(STORE_NAME_PURCHASE)
    ]);
    
    const allInvoices = [...soldData, ...purchaseData];
    return allInvoices.find(invoice => invoice.id === invoiceId) || null;
  } catch (error) {
    console.error('Error finding invoice:', error);
    return null;
  }
};

const fetchInvoiceDetailFromAPI = async (
  nbmst: string,
  khhdon: string,
  shdon: string,
  khmshdon: string,
  token: string
): Promise<InvoiceDetail> => {
  const url = `https://hoadondientu.gdt.gov.vn:30000/query/invoices/detail?nbmst=${nbmst}&khhdon=${khhdon}&shdon=${shdon}&khmshdon=${khmshdon}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

const formatCurrency = (amount: string | number | undefined) => {
  if (!amount) return "0";
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "0";
  return new Intl.NumberFormat("vi-VN").format(numAmount);
};

const getInvoiceStatus = (tthai: string | undefined) => {
  if (!tthai) return "Không xác định";
  switch (tthai) {
    case "1": return "Đã ký";
    case "2": return "Đã gửi";
    case "3": return "Đã nhận";
    case "4": return "Đã hủy";
    case "5": return "Đã xác nhận";
    default: return "Không xác định";
  }
};

export default function HoaDonChiTietPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceId = searchParams.get('id');

  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    if (!invoiceId) {
      setError('Không tìm thấy ID hóa đơn');
      setLoading(false);
      return;
    }

    const loadInvoiceData = async () => {
      try {
        setLoading(true);
        
        // Load invoice data from IndexedDB
        const invoice = await findInvoiceById(invoiceId);
        if (!invoice) {
          setError('Không tìm thấy hóa đơn');
          return;
        }
        
        setInvoiceData(invoice);
        
        // Try to load detail from IndexedDB
        const detail = await loadDetailFromIndexedDB(invoiceId);
        if (detail) {
          setInvoiceDetail(detail);
        }
        
      } catch (error) {
        console.error('Error loading invoice:', error);
        setError('Lỗi khi tải dữ liệu hóa đơn');
      } finally {
        setLoading(false);
      }
    };

    loadInvoiceData();
  }, [invoiceId]);

  const handleLoadDetailFromAPI = async () => {
    if (!invoiceData || !token.trim()) {
      alert('Vui lòng nhập token và đảm bảo có dữ liệu hóa đơn');
      return;
    }

    if (!invoiceData.nbmst || !invoiceData.khhdon || !invoiceData.shdon || !invoiceData.khmshdon) {
      alert('Thiếu thông tin API params (nbmst, khhdon, shdon, khmshdon)');
      return;
    }

    try {
      setDetailLoading(true);
      const detail = await fetchInvoiceDetailFromAPI(
        invoiceData.nbmst,
        invoiceData.khhdon,
        invoiceData.shdon,
        invoiceData.khmshdon,
        token
      );
      
      setInvoiceDetail(detail);
      
      // Save to IndexedDB
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME_DETAILS], 'readwrite');
      const store = transaction.objectStore(STORE_NAME_DETAILS);
      
      const detailWithId = {
        id: invoiceData.id,
        ...detail,
        lastUpdated: new Date().toISOString(),
      };
      
      store.put(detailWithId);
      
    } catch (error) {
      console.error('Error loading detail from API:', error);
      alert('Lỗi khi tải chi tiết từ API: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDetailLoading(false);
    }
  };

  // Transform data to invoice template format
  const getFormattedInvoiceData = () => {
    if (!invoiceData) return null;

    return {
      invoiceType: "HÓA ĐƠN GIÁ TRỊ GIA TĂNG",
      vatInvoice: "VAT INVOICE",
      date: invoiceData.tdlap 
        ? new Date(invoiceData.tdlap).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric'
          }).replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$1 tháng $2 năm $3')
        : "Không có dữ liệu",
      taxAuthCode: invoiceData.khmshdon || "N/A",
      series: invoiceData.khhdon || "N/A",
      invoiceNo: invoiceData.shdon || "N/A",
      seller: {
        name: invoiceData.nbten || "Không có dữ liệu",
        taxCode: invoiceData.nbmst || "N/A",
        address: invoiceData.nbdchi || "Không có dữ liệu",
        phone: invoiceData.nbsdthoai || "N/A",
        accountNo: "N/A",
        bank: "N/A",
      },
      buyer: {
        customerName: invoiceData.nmten || "Không có dữ liệu",
        companyName: invoiceData.nmten || "Không có dữ liệu",
        taxCode: invoiceData.nmmst || "N/A",
        address: invoiceData.nmdchi || "Không có dữ liệu",
        paymentMethod: invoiceData.thtttoan || "N/A",
        accountNo: "N/A",
        bank: "N/A",
      },
      items: invoiceDetail?.dshhdv || [
        {
          no: "1",
          description: "Chưa có chi tiết từ API",
          unit: "N/A",
          quantity: "N/A",
          unitPrice: "N/A",
          amount: formatCurrency(invoiceData.tgtcthue),
        }
      ],
      vatRate: "N/A",
      totalAmount: formatCurrency(invoiceData.tgtcthue),
      vatAmount: formatCurrency(invoiceData.tgtthue),
      totalPayment: formatCurrency(
        (parseFloat(invoiceData.tgtcthue?.toString() || '0') + 
         parseFloat(invoiceData.tgtthue?.toString() || '0'))
      ),
      amountInWords: "Chưa có dữ liệu",
      signatureSeller: {
        name: invoiceData.nbten || "N/A",
        date: invoiceData.tdlap 
          ? new Date(invoiceData.tdlap).toLocaleString('vi-VN')
          : "N/A",
      },
      eInvoiceProvider: {
        name: "Hệ thống hóa đơn điện tử",
        taxCode: "N/A",
        phone: "N/A",
        lookupUrl: "N/A",
        lookupCode: invoiceData.id || "N/A",
      },
      status: getInvoiceStatus(invoiceData.tthai),
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu hóa đơn...</p>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Lỗi</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link 
            href="/hoadon"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Quay lại danh sách hóa đơn
          </Link>
        </div>
      </div>
    );
  }

  const formattedData = getFormattedInvoiceData();
  if (!formattedData) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Control Panel */}
      <div className="bg-white shadow-md p-4 mb-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Link 
              href="/hoadon"
              className="flex items-center text-blue-600 hover:text-blue-800"
            >
              ← Quay lại danh sách
            </Link>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                formattedData.status === 'Đã ký' || formattedData.status === 'Đã xác nhận'
                  ? 'bg-green-100 text-green-800'
                  : formattedData.status === 'Đã hủy'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {formattedData.status}
              </span>
              <button
                onClick={() => window.print()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                🖨️ In hóa đơn
              </button>
            </div>
          </div>

          {/* API Controls */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Tải chi tiết từ API</h3>
            <div className="flex items-center gap-4">
              <input
                type="text"
                placeholder="Nhập Bearer token..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={detailLoading}
              />
              <button
                onClick={handleLoadDetailFromAPI}
                disabled={detailLoading || !token.trim()}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {detailLoading ? '⏳ Đang tải...' : '🔄 Tải chi tiết'}
              </button>
            </div>
            {invoiceData && (!invoiceData.nbmst || !invoiceData.khhdon || !invoiceData.shdon || !invoiceData.khmshdon) && (
              <p className="text-amber-600 text-sm mt-2">
                ⚠️ Thiếu thông tin API params. Có thể không tải được chi tiết từ server.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Display */}
      <div className="p-4">
        <div className="max-w-5xl mx-auto bg-white shadow-2xl print:shadow-none">
          {/* Header với logo và thông tin công ty */}
          <div className="border-b-2 border-gray-800 p-6">
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-left">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  LOGO
                </div>
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">{formattedData.invoiceType}</h1>
                <p className="text-lg text-gray-600">({formattedData.vatInvoice})</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">Ngày: {formattedData.date}</p>
                <p>Ký hiệu: <span className="font-bold">{formattedData.series}</span></p>
                <p>Số: <span className="font-bold text-red-600">{formattedData.invoiceNo}</span></p>
              </div>
            </div>
          </div>

          {/* Thông tin mã cơ quan thuế */}
          <div className="px-6 py-2 bg-gray-100 text-center text-sm">
            <p>Mã của cơ quan thuế: <span className="font-mono font-bold">{formattedData.taxAuthCode}</span></p>
          </div>

          <div className="p-6">
            {/* Thông tin bên bán và bên mua */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Đơn vị bán hàng */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <h2 className="text-lg font-bold mb-3 text-blue-800 border-b border-blue-300 pb-2">
                  Đơn vị bán hàng (Seller)
                </h2>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Tên đơn vị:</span><br/>{formattedData.seller.name}</p>
                  <p><span className="font-semibold">Mã số thuế:</span> <span className="font-mono">{formattedData.seller.taxCode}</span></p>
                  <p><span className="font-semibold">Địa chỉ:</span><br/>{formattedData.seller.address}</p>
                  <p><span className="font-semibold">Điện thoại:</span> {formattedData.seller.phone}</p>
                  <p><span className="font-semibold">Số tài khoản:</span> {formattedData.seller.accountNo}</p>
                  <p><span className="font-semibold">Ngân hàng:</span><br/>{formattedData.seller.bank}</p>
                </div>
              </div>

              {/* Người mua hàng */}
              <div className="border rounded-lg p-4 bg-green-50">
                <h2 className="text-lg font-bold mb-3 text-green-800 border-b border-green-300 pb-2">
                  Người mua hàng (Buyer)
                </h2>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Họ tên:</span> {formattedData.buyer.customerName}</p>
                  <p><span className="font-semibold">Tên đơn vị:</span><br/>{formattedData.buyer.companyName}</p>
                  <p><span className="font-semibold">Mã số thuế:</span> <span className="font-mono">{formattedData.buyer.taxCode}</span></p>
                  <p><span className="font-semibold">Địa chỉ:</span><br/>{formattedData.buyer.address}</p>
                  <p><span className="font-semibold">Hình thức thanh toán:</span> {formattedData.buyer.paymentMethod}</p>
                  <p><span className="font-semibold">Số tài khoản:</span> {formattedData.buyer.accountNo}</p>
                  <p><span className="font-semibold">Ngân hàng:</span><br/>{formattedData.buyer.bank}</p>
                </div>
              </div>
            </div>

            {/* Bảng chi tiết hàng hóa */}
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-3 text-gray-800">Chi tiết hàng hóa/dịch vụ</h3>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th className="px-3 py-4 text-center text-xs font-bold uppercase w-12">STT<br/>No.</th>
                      <th className="px-3 py-4 text-left text-xs font-bold uppercase">Tên hàng hóa, dịch vụ<br/>Description</th>
                      <th className="px-3 py-4 text-center text-xs font-bold uppercase w-20">Đơn vị<br/>Unit</th>
                      <th className="px-3 py-4 text-center text-xs font-bold uppercase w-20">Số lượng<br/>Qty</th>
                      <th className="px-3 py-4 text-center text-xs font-bold uppercase w-32">Đơn giá<br/>Unit Price</th>
                      <th className="px-3 py-4 text-center text-xs font-bold uppercase w-32">Thành tiền<br/>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formattedData.items.map((item: any, index: number) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-3 py-4 text-center font-semibold">{item.no || index + 1}</td>
                        <td className="px-3 py-4">{item.description || item.ten || "N/A"}</td>
                        <td className="px-3 py-4 text-center">{item.unit || item.dvt || "N/A"}</td>
                        <td className="px-3 py-4 text-center">{formatCurrency(item.quantity || item.sluong || "N/A")}</td>
                        <td className="px-3 py-4 text-right font-mono">{formatCurrency(item.unitPrice || item.dgia || "N/A")}</td>
                        <td className="px-3 py-4 text-right font-mono font-semibold">{formatCurrency(item.amount || item.ttien || "N/A")}</td>
                      </tr>
                    ))}
                    {/* Thêm các hàng trống để đảm bảo chiều cao tối thiểu */}
                    {[...Array(Math.max(0, 3 - formattedData.items.length))].map((_, index) => (
                      <tr key={`empty-${index}`} className="border-b border-gray-200">
                        <td className="px-3 py-4 text-center">&nbsp;</td>
                        <td className="px-3 py-4">&nbsp;</td>
                        <td className="px-3 py-4">&nbsp;</td>
                        <td className="px-3 py-4">&nbsp;</td>
                        <td className="px-3 py-4">&nbsp;</td>
                        <td className="px-3 py-4">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tổng kết thanh toán */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-sm font-semibold mb-2">
                  Số tiền viết bằng chữ:
                </p>
                <p className="text-base font-bold text-gray-800 italic border-b border-dashed border-gray-400 pb-2">
                  {formattedData.amountInWords}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Cộng tiền hàng:</span>
                    <span className="font-mono font-semibold">{formattedData.totalAmount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Thuế GTGT ({formattedData.vatRate}):</span>
                    <span className="font-mono font-semibold">{formattedData.vatAmount}</span>
                  </div>
                  <div className="border-t-2 border-gray-400 pt-2">
                    <div className="flex justify-between text-lg font-bold text-red-600">
                      <span>Tổng cộng:</span>
                      <span className="font-mono">{formattedData.totalPayment}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Chữ ký */}
            <div className="grid grid-cols-2 gap-8 text-center mb-8">
              <div className="border rounded-lg p-4">
                <p className="font-bold text-gray-800 mb-2">Người mua hàng</p>
                <p className="text-sm text-gray-600 mb-8">(Ký, ghi rõ họ tên)</p>
                <div className="h-16 border-b border-dashed border-gray-400 mb-2"></div>
              </div>
              <div className="border rounded-lg p-4 bg-blue-50">
                <p className="font-bold text-gray-800 mb-2">Đơn vị bán hàng</p>
                <p className="text-sm text-gray-600 mb-2">(Ký, ghi rõ họ tên)</p>
                <div className="text-xs text-green-600 font-semibold mb-1">
                  {formattedData.status === 'Đã ký' ? '✓ Chữ ký số hợp lệ' : '⚠️ Chưa có chữ ký số'}
                </div>
                <p className="text-xs text-gray-600">Ký bởi: {formattedData.signatureSeller.name}</p>
                <p className="text-xs text-gray-600">Thời gian: {formattedData.signatureSeller.date}</p>
              </div>
            </div>
          </div>

          {/* Footer thông tin nhà cung cấp */}
          <div className="bg-gray-800 text-white p-4 text-center text-xs">
            <p className="mb-1">
              Đơn vị cung cấp giải pháp hóa đơn điện tử: {formattedData.eInvoiceProvider.name} | 
              MST: {formattedData.eInvoiceProvider.taxCode} | 
              Điện thoại: {formattedData.eInvoiceProvider.phone}
            </p>
            <p>
              Tra cứu tại: <span className="text-blue-300">{formattedData.eInvoiceProvider.lookupUrl}</span> | 
              Mã tra cứu: <span className="font-mono">{formattedData.eInvoiceProvider.lookupCode}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Debug Info - Only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="max-w-5xl mx-auto mt-8 bg-gray-100 p-4 rounded-lg print:hidden">
          <h3 className="font-semibold mb-2">Debug Information</h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <h4 className="font-medium mb-1">Raw Invoice Data:</h4>
              <pre className="bg-white p-2 rounded overflow-auto max-h-60">
                {JSON.stringify(invoiceData, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-medium mb-1">API Detail Data:</h4>
              <pre className="bg-white p-2 rounded overflow-auto max-h-60">
                {invoiceDetail ? JSON.stringify(invoiceDetail, null, 2) : 'Chưa có dữ liệu'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
