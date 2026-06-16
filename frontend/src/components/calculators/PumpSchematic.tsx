export default function PumpSchematic({
  kw, motorKw,
}: { kw: number | null; motorKw: number | null }) {
  return (
    <svg viewBox="0 0 320 150" className="w-full" fontFamily="system-ui" role="img" aria-label="pump and motor">
      {/* motor body */}
      <rect x="150" y="40" width="90" height="46" rx="6" fill="#047857" />
      <line x1="160" y1="40" x2="160" y2="86" stroke="#065f46" strokeWidth="2" />
      <line x1="172" y1="40" x2="172" y2="86" stroke="#065f46" strokeWidth="2" />
      <line x1="184" y1="40" x2="184" y2="86" stroke="#065f46" strokeWidth="2" />
      {/* shaft */}
      <rect x="116" y="60" width="34" height="6" fill="#a8a29e" />
      {/* pump volute */}
      <circle cx="86" cy="63" r="34" fill="#ecfdf5" stroke="#047857" strokeWidth="2.5" />
      <circle cx="86" cy="63" r="8" fill="#047857" />
      {/* outlet */}
      <rect x="78" y="14" width="16" height="20" rx="2" fill="#047857" />
      <text x="86" y="120" textAnchor="middle" fontSize="12" fill="#57534e">
        required
      </text>
      <text x="86" y="136" textAnchor="middle" fontSize="14" fontWeight="600" fill="#1c1917">
        {kw ?? '—'} kW
      </text>
      <text x="240" y="120" textAnchor="end" fontSize="12" fill="#57534e">
        motor
      </text>
      <text x="240" y="136" textAnchor="end" fontSize="14" fontWeight="600" fill="#1c1917">
        {motorKw ?? '—'} kW
      </text>
    </svg>
  );
}
