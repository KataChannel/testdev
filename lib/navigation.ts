import { CONFIG } from './config';

export interface NavigationItem {
  href: string;
  label: string;
  icon?: string;
  description?: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export const MAIN_NAVIGATION: NavigationItem[] = [
  { 
    href: '/', 
    label: 'Trang chủ',
    icon: '🏠',
    description: 'Tải và quản lý dữ liệu hóa đơn'
  },
  { 
    href: '/hoadon', 
    label: 'Hóa đơn',
    icon: '📄',
    description: 'Danh sách hóa đơn bán ra và mua vào'
  },
  { 
    href: '/hoadonchitiet', 
    label: 'Hóa đơn chi tiết',
    icon: '📋',
    description: 'Xem chi tiết từng hóa đơn'
  },
  { 
    href: '/xuatnhapton', 
    label: 'Xuất nhập tồn',
    icon: '📦',
    description: 'Báo cáo tồn kho theo sản phẩm'
  },
  { 
    href: '/facebook', 
    label: 'Facebook',
    icon: '📘',
    description: 'Quản lý trang Facebook'
  },
  { 
    href: '/callcenter', 
    label: 'Call Center',
    icon: '📞',
    description: 'Quản lý tổng đài'
  },
];

export class NavigationManager {
  static isActive(path: string, currentPath: string): boolean {
    if (path === '/') {
      return currentPath === '/';
    }
    if (path === '/hoadon') {
      return currentPath === '/hoadon';
    }
    if (path === '/hoadonchitiet') {
      return currentPath === '/hoadonchitiet' || currentPath.startsWith('/hoadonchitiet/');
    }
    return currentPath.startsWith(path);
  }

  static generateInvoiceUrl(invoiceId: string): string {
    return `/hoadonchitiet?id=${invoiceId}`;
  }

  static generateInventoryUrl(productName?: string): string {
    const baseUrl = '/xuatnhapton';
    return productName ? `${baseUrl}?search=${encodeURIComponent(productName)}` : baseUrl;
  }

  static generateInvoiceListUrl(type?: 'sold' | 'purchase', filters?: Record<string, string>): string {
    const baseUrl = '/hoadon';
    const params = new URLSearchParams();
    
    if (type) params.append('tab', type);
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }

  static navigateToPage(url: string, newTab: boolean = false): void {
    if (newTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  }

  static getBreadcrumb(currentPath: string, customItems?: BreadcrumbItem[]): BreadcrumbItem[] {
    const baseBreadcrumbs: BreadcrumbItem[] = [
      { label: 'Trang chủ', href: '/' }
    ];

    if (currentPath === '/') {
      return baseBreadcrumbs;
    }

    if (currentPath === '/hoadon') {
      return [...baseBreadcrumbs, { label: 'Hóa đơn điện tử' }];
    }

    if (currentPath === '/hoadonchitiet' || currentPath.startsWith('/hoadonchitiet')) {
      return [
        ...baseBreadcrumbs,
        { label: 'Hóa đơn', href: '/hoadon' },
        { label: 'Chi tiết hóa đơn' }
      ];
    }

    if (currentPath === '/xuatnhapton') {
      return [...baseBreadcrumbs, { label: 'Xuất nhập tồn' }];
    }

    if (currentPath === '/facebook') {
      return [...baseBreadcrumbs, { label: 'Facebook' }];
    }

    if (currentPath === '/callcenter') {
      return [...baseBreadcrumbs, { label: 'Call Center' }];
    }

    if (customItems) {
      return [...baseBreadcrumbs, ...customItems];
    }

    return baseBreadcrumbs;
  }

  static getPageTitle(currentPath: string): string {
    const navigation = MAIN_NAVIGATION.find(item => item.href === currentPath);
    return navigation?.label || 'Quản lý hóa đơn điện tử';
  }

  static getPageDescription(currentPath: string): string {
    const navigation = MAIN_NAVIGATION.find(item => item.href === currentPath);
    return navigation?.description || '';
  }
}
