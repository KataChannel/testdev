'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/config';

interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  description: string;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Trang chủ',
    href: ROUTES.HOME,
    icon: '🏠',
    description: 'Trang chủ và quản lý dữ liệu'
  },
  {
    label: 'Hóa đơn',
    href: ROUTES.INVOICES,
    icon: '📋',
    description: 'Quản lý hóa đơn điện tử'
  },
  {
    label: 'Xuất nhập tồn',
    href: ROUTES.INVENTORY,
    icon: '📦',
    description: 'Quản lý hàng hóa xuất nhập tồn'
  },
  {
    label: 'Tổng đài',
    href: ROUTES.CALL_CENTER,
    icon: '☎️',
    description: 'Quản lý cuộc gọi và tổng đài'
  },
  {
    label: 'Facebook',
    href: ROUTES.FACEBOOK,
    icon: '📘',
    description: 'Quản lý tương tác Facebook'
  }
];

export const Navigation: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href={ROUTES.HOME} className="text-xl font-bold text-gray-800">
                📊 Business Manager
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigationItems.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== ROUTES.HOME && pathname.startsWith(item.href));
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                    title={item.description}
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-controls="mobile-menu"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden" id="mobile-menu">
        <div className="pt-2 pb-3 space-y-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== ROUTES.HOME && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
                <div className="text-xs text-gray-400 mt-1 ml-6">
                  {item.description}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

// Breadcrumb component for navigation context
interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="bg-gray-50 px-4 py-3 border-b" aria-label="Breadcrumb">
      <ol className="max-w-7xl mx-auto flex items-center space-x-4">
        <li>
          <Link href={ROUTES.HOME} className="text-gray-400 hover:text-gray-500">
            <span className="sr-only">Home</span>
            🏠
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex">
            <div className="flex items-center">
              <svg
                className="flex-shrink-0 h-5 w-5 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              {item.href ? (
                <Link
                  href={item.href}
                  className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="ml-4 text-sm font-medium text-gray-500">
                  {item.label}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
};

// Quick action component for common tasks
interface QuickAction {
  label: string;
  href: string;
  icon: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    label: 'Xem hóa đơn',
    href: ROUTES.INVOICES,
    icon: '📋',
    color: 'bg-blue-500 hover:bg-blue-600'
  },
  {
    label: 'Kiểm tra tồn kho',
    href: ROUTES.INVENTORY,
    icon: '📦',
    color: 'bg-green-500 hover:bg-green-600'
  },
  {
    label: 'Lịch sử gọi',
    href: ROUTES.CALL_CENTER,
    icon: '☎️',
    color: 'bg-purple-500 hover:bg-purple-600'
  },
  {
    label: 'Facebook tương tác',
    href: ROUTES.FACEBOOK,
    icon: '📘',
    color: 'bg-indigo-500 hover:bg-indigo-600'
  }
];

export const QuickActions: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Thao tác nhanh</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`${action.color} text-white p-4 rounded-lg text-center transition-colors duration-200 hover:scale-105 transform`}
          >
            <div className="text-2xl mb-2">{action.icon}</div>
            <div className="text-sm font-medium">{action.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};
