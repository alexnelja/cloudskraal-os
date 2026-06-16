export default function PipeSchematic({
  velocity, headLoss,
}: { velocity: number | null; headLoss: number | null }) {
  const arrows = [70, 130, 190, 250];
  return (
    <svg viewBox="0 0 320 150" className="w-full" fontFamily="system-ui" role="img" aria-label="pipe flow">
      {/* pipe body */}
      <rect x="20" y="48" width="280" height="40" rx="6" fill="#ecfdf5" stroke="#047857" strokeWidth="2" />
      {/* flow arrows */}
      {arrows.map((x) => (
        <g key={x} stroke="#047857" strokeWidth="2.5" fill="none">
          <line x1={x - 14} y1={68} x2={x + 10} y2={68} />
          <polyline points={`${x + 2},62 ${x + 12},68 ${x + 2},74`} />
        </g>
      ))}
      <text x="20" y="118" fontSize="12" fill="#57534e">
        velocity
      </text>
      <text x="20" y="134" fontSize="14" fontWeight="600" fill="#1c1917">
        {velocity ?? '—'} m/s
      </text>
      <text x="300" y="118" textAnchor="end" fontSize="12" fill="#57534e">
        head loss
      </text>
      <text x="300" y="134" textAnchor="end" fontSize="14" fontWeight="600" fill="#1c1917">
        {headLoss ?? '—'} m
      </text>
    </svg>
  );
}
