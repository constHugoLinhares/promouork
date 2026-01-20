'use client';

import { authService, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import KeyboardShortcuts from './KeyboardShortcuts';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [router]);

  const handleLogout = () => {
    authService.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-lg text-dark-text">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <KeyboardShortcuts />
      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-purple-900/20 to-dark-bg flex">
        <Sidebar userEmail={user?.email} onLogout={handleLogout} />
        <main className="flex-1 ml-64 p-6 min-w-0">
          {children}
        </main>
      </div>
    </>
  );
}

