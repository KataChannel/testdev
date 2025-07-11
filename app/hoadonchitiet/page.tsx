'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppData } from '@/hooks/useAppData';
import { InvoiceData, InvoiceDetail } from '@/lib/database';
import { NavigationManager } from '@/lib/navigation';
import { formatCurrency, formatDate, getInvoiceStatus } from '@/lib/utils';
import { Breadcrumb, PageHeader } from '@/components/SharedNavigation';
import { CONFIG } from '@/lib/config';

export default function HoaDonChiTietPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const invoiceId = searchParams.get('id');
  const { findInvoiceById, getInvoiceDetail, loadInvoiceDetail } = useAppData();

  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>(CONFIG.API.DEFAULT_TOKEN);

  useEffect(() => {
    if (!invoiceId) {
      setError('Không tìm thấy ID hóa đơn');
      setLoading(false);
      return;
    }

    const loadInvoiceData = async () => {
      try {
        setLoading(true);
        
        // Load invoice data
        const invoice = findInvoiceById(invoiceId);
        if (!invoice) {
          setError('Không tìm thấy hóa đơn');
          return;
        }
        setInvoiceData(invoice);

        // Load detail if exists
        const detail = getInvoiceDetail(invoiceId);
        if (detail) {
          setInvoiceDetail(detail);
        }
      } catch (error) {
        console.error('Error loading invoice data:', error);
        setError('Lỗi khi tải dữ liệu hóa đơn');
      } finally {
        setLoading(false);
      }
    };

    loadInvoiceData();
  }, [invoiceId, findInvoiceById, getInvoiceDetail]);

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
      const detail = await loadInvoiceDetail(invoiceData, token);
      
      if (detail) {
        setInvoiceDetail(detail);
        alert('Đã tải và lưu chi tiết hóa đơn thành công!');
      }
    } catch (error) {
      console.error('Error loading detail:', error);
      alert(`Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDetailLoading(false);
    }
  };

  // Transform data to invoice template format
  const getFormattedInvoiceData = () => {
    if (!invoiceData) return null;

    const productItems = invoiceDetail?.hdhhdvu || invoiceDetail?.dshhdv || [];
    const formattedItems = productItems.length > 0 
      ? productItems.map((item: any, index: number) => ({
          no: item.stt || (index + 1).toString(),
          description: item.ten || "Không có tên sản phẩm",
          unit: item.dvtinh || "N/A",
          quantity: item.sluong || 0,
          unitPrice: item.dgia || 0,
          amount: item.thtien || 0,
          taxRate: item.tsuat || 0,
          taxAmount: item.tthue || 0
        }))
      : [{
          no: "1",
          description: "Chưa có chi tiết từ API",
          unit: "N/A", 
          quantity: "N/A",
          unitPrice: "N/A",
          amount: formatCurrency(invoiceData.tgtcthue),
        }];

    return {
      invoiceType: "HÓA ĐƠN GIÁ TRỊ GIA TĂNG",
      vatInvoice: "VAT INVOICE",
      date: formatDate(invoiceData.tdlap),
      series: invoiceData.khhdon || "N/A",
      invoiceNo: invoiceData.shdon || "N/A",
      seller: {
        name: invoiceData.nbten || "Không có dữ liệu",
        taxCode: invoiceData.nbmst || "N/A",
        address: invoiceData.nbdchi || "Không có dữ liệu",
        phone: invoiceData.nbsdthoai || "N/A",
      },
      buyer: {
        name: invoiceData.nmten || "Không có dữ liệu",
        taxCode: invoiceData.nmmst || "N/A",
        address: invoiceData.nmdchi || "Không có dữ liệu",
        paymentMethod: invoiceData.thtttoan || "N/A",
      },
      items: formattedItems,
      totalAmount: formatCurrency(invoiceData.tgtcthue),
      vatAmount: formatCurrency(invoiceData.tgtthue),
      totalPayment: formatCurrency(
        (parseFloat(invoiceData.tgtcthue?.toString() || '0') + 
         parseFloat(invoiceData.tgtthue?.toString() || '0'))
      ),
      status: getInvoiceStatus(invoiceData.tthai),
      hasApiDetail: !!invoiceDetail?.hdhhdvu?.length || !!invoiceDetail?.dshhdv?.length
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-xl">Đang tải chi tiết hóa đơn...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Breadcrumb items={[
          { label: 'Hóa đơn', href: '/hoadon' },
          { label: 'Chi tiết hóa đơn' }
        ]} />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error || 'Không tìm thấy hóa đơn'}
          </div>
          <Link 
            href="/hoadon"
            className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ← Quay lại danh sách hóa đơn
          </Link>
        </div>
      </div>
    );
  }

  const formattedData = getFormattedInvoiceData();
  if (!formattedData) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Breadcrumb items={[
        { label: 'Hóa đơn', href: '/hoadon' },
        { label: `Hóa đơn #${formattedData.invoiceNo}` }
      ]} />

      {/* Action Bar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/hoadon"
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                ← Quay lại
              </Link>
              <h1 className="text-xl font-semibold">Hóa đơn #{formattedData.invoiceNo}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                formattedData.status === 'Đã ký' 
                  ? 'bg-green-100 text-green-800'
                  : formattedData.status === 'Đã hủy'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {formattedData.status}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs ${
                formattedData.hasApiDetail
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {formattedData.hasApiDetail ? '✓ Có chi tiết API' : '⚠ Chưa có chi tiết API'}
              </span>
              
              <Link
                href={NavigationManager.generateInventoryUrl()}
                className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                title="Xem trong kho"
              >
                📦 Kho hàng
              </Link>
              
              <button
                onClick={() => window.print()}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                🖨️ In
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* API Controls */}
      <div className="container mx-auto px-4 py-4">
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-3">Tải chi tiết từ API</h3>
          <div className="flex items-center gap-4">
            <input
              type="password"
              placeholder="Nhập Bearer token..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={detailLoading}
            />
            <button
              onClick={handleLoadDetailFromAPI}
              disabled={detailLoading || !token.trim()}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {detailLoading ? '⏳ Đang tải...' : '🔄 Tải chi tiết'}
            </button>
          </div>
          {!formattedData.hasApiDetail && (
            <p className="text-sm text-gray-600 mt-2">
              Hiện tại chỉ có thông tin cơ bản. Nhập token để tải chi tiết sản phẩm từ API.
            </p>
          )}
        </div>
      </div>

      {/* Invoice Content */}
      <div className="container mx-auto px-4 pb-8">
        <div className="bg-white shadow-lg print:shadow-none rounded-lg overflow-hidden">
          {/* Header */}
          <div className="border-b-2 border-gray-800 p-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">{formattedData.invoiceType}</h1>
              <div className="text-right text-sm space-y-1">
                <p>Ngày: {formattedData.date}</p>
                <p>Ký hiệu: <span className="font-bold">{formattedData.series}</span></p>
                <p>Số: <span className="font-bold text-red-600">{formattedData.invoiceNo}</span></p>
              </div>
            </div>
          </div>

          {/* Seller & Buyer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            <div className="border rounded-lg p-6 bg-blue-50">
              <h3 className="text-lg font-bold mb-4 text-blue-800">Đơn vị bán hàng</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Tên:</span> {formattedData.seller.name}</p>
                <p><span className="font-semibold">MST:</span> {formattedData.seller.taxCode}</p>
                <p><span className="font-semibold">Địa chỉ:</span> {formattedData.seller.address}</p>
                <p><span className="font-semibold">Điện thoại:</span> {formattedData.seller.phone}</p>
              </div>
            </div>
            
            <div className="border rounded-lg p-6 bg-green-50">
              <h3 className="text-lg font-bold mb-4 text-green-800">Người mua hàng</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold">Tên:</span> {formattedData.buyer.name}</p>
                <p><span className="font-semibold">MST:</span> {formattedData.buyer.taxCode}</p>
                <p><span className="font-semibold">Địa chỉ:</span> {formattedData.buyer.address}</p>
                <p><span className="font-semibold">Hình thức thanh toán:</span> {formattedData.buyer.paymentMethod}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="p-8">
            <h3 className="text-lg font-bold mb-4">
              Chi tiết hàng hóa/dịch vụ
              {formattedData.hasApiDetail && (
                <span className="ml-2 text-sm font-normal text-green-600">
                  (Dữ liệu từ API - {formattedData.items.length} sản phẩm)
                </span>
              )}
            </h3>
            
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">STT</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Tên hàng hóa</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Đơn vị</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Số lượng</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Đơn giá</th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Thành tiền</th>
                    {formattedData.hasApiDetail && (
                      <>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase">% thuế</th>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase">Tiền thuế</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {formattedData.items.map((item: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-center">{item.no}</td>
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-center">{item.unit}</td>
                      <td className="px-4 py-3 text-center">
                        {typeof item.quantity === 'number' ? item.quantity.toLocaleString() : item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {typeof item.unitPrice === 'number' ? formatCurrency(item.unitPrice) : item.unitPrice}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {typeof item.amount === 'number' ? formatCurrency(item.amount) : item.amount}
                      </td>
                      {formattedData.hasApiDetail && (
                        <>
                          <td className="px-4 py-3 text-center">{item.taxRate || 0}%</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(item.taxAmount || 0)}</td>
                        </>
                      )}
                      <td className="px-4 py-3 text-center">
                        {item.description !== "Chưa có chi tiết từ API" && (
                          <Link
                            href={NavigationManager.generateInventoryUrl(item.description)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                            title="Xem trong kho"
                          >
                            📦
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div></div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="font-semibold mb-4">Tổng cộng</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Tổng tiền hàng:</span>
                    <span className="font-semibold">{formattedData.totalAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Thuế GTGT:</span>
                    <span className="font-semibold">{formattedData.vatAmount}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-lg font-bold">
                    <span>Tổng thanh toán:</span>
                    <span className="text-red-600">{formattedData.totalPayment}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t bg-gray-50 p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Người mua hàng</h4>
                <p className="text-gray-600">Ký, ghi rõ họ tên</p>
                <div className="h-16"></div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Người bán hàng</h4>
                <p className="text-gray-600">Ký, ghi rõ họ tên, đóng dấu</p>
                <div className="h-16"></div>
                <p className="font-medium">{formattedData.seller.name}</p>
              </div>
            </div>
            
            <div className="mt-6 text-center text-xs text-gray-500">
              <p>Hóa đơn điện tử - Mã tra cứu: {invoiceId}</p>
              <p>Ngày xuất: {formatDate(new Date().toISOString())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
