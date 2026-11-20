'use client';

import { Chrome as Home, FileText, Calendar, ShoppingBag, Package, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'ホーム' },
  { href: '/programs', icon: FileText, label: 'プログラム' },
  { href: '/visits', icon: Calendar, label: '通院履歴' },
  { href: '/product-support', icon: ShoppingBag, label: '商品サポート' },
  { href: '/rentals', icon: Package, label: 'レンタル' },
  { href: '/plans', icon: CreditCard, label: 'プラン' },
];

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-around py-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center py-1 px-2 ${
                    isActive ? 'text-teal-600' : 'text-gray-500'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] mt-1 leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
