import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { downloadFactSheet } from '../api/client';

interface FactSheetButtonProps {
  projectId: string;
  scenarioId: string;
  className?: string;
}

export default function FactSheetButton({ projectId, scenarioId, className = '' }: FactSheetButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await downloadFactSheet(projectId, scenarioId);
    } catch (err) {
      console.error('Failed to download fact sheet:', err);
      alert('Failed to generate fact sheet. Please ensure the API is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
      Fact Sheet
    </button>
  );
}
