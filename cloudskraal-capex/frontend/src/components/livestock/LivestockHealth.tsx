interface HealthRecord {
  id: string;
  date: string;
  type: 'Vaccination' | 'Treatment' | 'Checkup';
  description: string;
  administeredBy: string;
}

const MOCK_HEALTH: HealthRecord[] = [
  { id: 'h1', date: '2026-03-15', type: 'Vaccination', description: 'Pulpy kidney (Enterotoxaemia) booster -- Multivax P Plus', administeredBy: 'Dr. van der Merwe' },
  { id: 'h2', date: '2026-02-28', type: 'Treatment', description: 'Internal parasite drench -- Ivermectin, full flock', administeredBy: 'Pieter (foreman)' },
  { id: 'h3', date: '2026-02-10', type: 'Checkup', description: 'Pre-lambing condition scoring, ewes body condition 3.2 avg', administeredBy: 'Dr. van der Merwe' },
  { id: 'h4', date: '2026-01-20', type: 'Vaccination', description: 'Blue tongue vaccine -- Onderstepoort BTV', administeredBy: 'Dr. van der Merwe' },
  { id: 'h5', date: '2025-12-05', type: 'Treatment', description: 'Footrot treatment -- 10% zinc sulphate footbath', administeredBy: 'Pieter (foreman)' },
  { id: 'h6', date: '2025-11-18', type: 'Vaccination', description: 'Clostridial diseases -- Covexin 10', administeredBy: 'Dr. van der Merwe' },
  { id: 'h7', date: '2025-10-01', type: 'Checkup', description: 'Ram fertility testing before joining season', administeredBy: 'Dr. van der Merwe' },
  { id: 'h8', date: '2025-09-12', type: 'Treatment', description: 'External parasite dip -- Deadline pour-on for lice', administeredBy: 'Pieter (foreman)' },
];

const TYPE_COLORS: Record<string, string> = {
  Vaccination: '#7c3aed',
  Treatment: '#d97706',
  Checkup: '#2563eb',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function LivestockHealth() {
  return (
    <div className="p-4 space-y-3">
      <div className="overflow-x-auto rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-[#f3f4f3]">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-stone-600">Date</th>
              <th className="text-left px-3 py-2 font-medium text-stone-600">Type</th>
              <th className="text-left px-3 py-2 font-medium text-stone-600">Description</th>
              <th className="text-left px-3 py-2 font-medium text-stone-600 hidden sm:table-cell">By</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_HEALTH.map((rec) => (
              <tr key={rec.id} className="border-b border-[#f3f4f3]">
                <td className="px-3 py-2 text-stone-800 whitespace-nowrap">{formatDate(rec.date)}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: TYPE_COLORS[rec.type] ?? '#6b7280' }}
                  >
                    {rec.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-stone-700">{rec.description}</td>
                <td className="px-3 py-2 text-stone-500 hidden sm:table-cell whitespace-nowrap">{rec.administeredBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-stone-400">Mock health data -- will connect to vet management system</p>
    </div>
  );
}
