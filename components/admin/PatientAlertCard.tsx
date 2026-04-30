'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PatientAlertCardProps {
  patientName: string;
  patientId: string;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  href?: string;
}

const urgencyConfig = {
  high: { label: '要対応', className: 'bg-red-50 text-red-700 border-red-200' },
  medium: { label: '確認', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: '参考', className: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export function PatientAlertCard({
  patientName,
  reason,
  urgency,
  href,
}: PatientAlertCardProps) {
  const config = urgencyConfig[urgency];

  const content = (
    <Card className="hover:shadow-sm transition-shadow cursor-pointer">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Badge className={config.className} variant="outline">
            {config.label}
          </Badge>
          <div>
            <p className="font-medium text-sm">{patientName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{reason}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }

  return content;
}
