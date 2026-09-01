import React from 'react';
import { Sidebar } from '../components/Sidebar';
import { TopNav } from '../components/TopNav';

export const MainLayout = ({ children, title = 'Fleet Intelligence' }) => {
  return (
    <div className="flex min-h-screen bg-industrial-bg text-slate-100 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title={title} />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
