import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
