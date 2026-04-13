import type { ReactNode, ElementType } from 'react';

interface PageHeaderProps {
  icon: ElementType;
  title: string;
  children?: ReactNode; // right-side actions slot
}

export default function PageHeader({ icon: Icon, title, children }: PageHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between border-b border-[#f3f4f3] px-4 py-3 bg-white">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-[#6e7a73]" />
        <h1 className="text-lg font-semibold text-[#1a2e1a]">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
