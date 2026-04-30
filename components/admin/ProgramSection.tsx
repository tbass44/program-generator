'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProgramSectionProps {
  title: string;
  content: string;
  className?: string;
  icon?: React.ReactNode;
}

export function ProgramSection({ title, content, className, icon }: ProgramSectionProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{content}</div>
      </CardContent>
    </Card>
  );
}
