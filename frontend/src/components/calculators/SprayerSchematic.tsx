export default function SprayerSchematic({ lHa }: { lHa: number | null }) {
  const nozzles = [60, 110, 160, 210, 260];
  return (
    <svg viewBox="0 0 320 150" className="w-full" fontFamily="system-ui" role="img" aria-label="sprayer boom">
      {/* boom */}
      <rect x="40" y="34" width="240" height="6" rx="3" fill="#047857" />
      <rect x="156" y="14" width="8" height="22" rx="2" fill="#047857" />
      {/* ground line */}
      <line x1="20" y1="128" x2="300" y2="128" stroke="#d6d3d1" strokeWidth="2" />
      {nozzles.map((x) => (
        <g key={x}>
          {/* spray cone */}
          <polygon points={`${x},42 ${x - 18},126 ${x + 18},126`} fill="#047857" opacity="0.12" />
          {/* nozzle dot */}
          <circle cx={x} cy={42} r={3.5} fill="#047857" />
        </g>
      ))}
      <text x="160" y="146" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1c1917">
        {lHa ?? '—'} L/ha
      </text>
    </svg>
  );
}
