import type { ReactNode } from 'react';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8">
        <h1 className="text-xl font-semibold mb-6 text-center">{title}</h1>
        {children}
      </div>
    </div>
  );
}
