import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

type Severity = 'critical' | 'warning' | 'info';

interface ActionAlertProps {
  severity: Severity;
  message: string;
  actionLabel: string;
  actionTo: string;
}

const SEVERITY_CONFIG: Record<Severity, { icon: typeof AlertTriangle; bg: string; border: string; text: string }> = {
  critical: { icon: AlertTriangle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  warning: { icon: AlertCircle, bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
};

export default function ActionAlert({ severity, message, actionLabel, actionTo }: ActionAlertProps) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bg} ${config.border}`}>
      <Icon size={14} className={config.text} />
      <span className={`flex-1 text-xs ${config.text}`}>{message}</span>
      <Link to={actionTo} className={`text-xs font-medium underline ${config.text}`}>
        {actionLabel}
      </Link>
    </div>
  );
}
