'use client';

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {action}
    </div>
  );
}
