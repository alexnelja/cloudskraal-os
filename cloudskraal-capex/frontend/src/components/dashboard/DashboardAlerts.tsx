import ActionAlert from '../shared/ActionAlert';

// TODO: Replace with real alert data from API
const MOCK_ALERTS: { severity: 'critical' | 'warning' | 'info'; message: string; actionLabel: string; actionTo: string }[] = [
  { severity: 'critical', message: 'Overdue service: Bovic Cutter', actionLabel: 'Log now', actionTo: '/equipment' },
  { severity: 'warning', message: 'Low stock: Veterinary supplies', actionLabel: 'Reorder', actionTo: '/inventory' },
  { severity: 'warning', message: 'Feed trough low: Ram paddock', actionLabel: 'Check', actionTo: '/livestock' },
  { severity: 'info', message: '3 tasks due this week', actionLabel: 'View', actionTo: '/calendar' },
];

export default function DashboardAlerts() {
  return (
    <div className="bg-white rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6e7a73]">
          Alerts
        </h3>
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">
          {MOCK_ALERTS.length}
        </span>
      </div>
      <div className="space-y-2">
        {MOCK_ALERTS.map((alert, i) => (
          <ActionAlert
            key={i}
            severity={alert.severity}
            message={alert.message}
            actionLabel={alert.actionLabel}
            actionTo={alert.actionTo}
          />
        ))}
      </div>
    </div>
  );
}
