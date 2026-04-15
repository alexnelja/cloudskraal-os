import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ClipboardText as ClipboardList, BookOpen } from '@phosphor-icons/react';
import { getField, getFieldCostOfProduction } from '../../api/farms';
import type {
  Field, FieldCostOfProduction as FieldCostOfProductionType,
  FieldInputTransaction, FieldTaskInput, FieldLabourEntry,
} from '../../types/farm';
import { ENTERPRISE_COLORS, ENTERPRISE_LABELS } from '../../types/farm';
import {
  STATUS_COLORS, TABS, type Tab, type ChartRow, hasProductionData,
} from './FieldPanelPrimitives';
import { OverviewTab, InputsTab, LabourTab, CostsTab } from './FieldPanelTabs';
import FieldEnrichmentTab from './FieldEnrichmentTab';

interface FieldPanelProps {
  fieldId: string | null;
  onClose: () => void;
}

export default function FieldPanel({ fieldId, onClose }: FieldPanelProps) {
  const [field, setField] = useState<Field | null>(null);
  const [costData, setCostData] = useState<FieldCostOfProductionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [costLoading, setCostLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  useEffect(() => {
    if (!fieldId) {
      setField(null);
      setCostData(null);
      setActiveTab('Overview');
      return;
    }
    setLoading(true);
    setError(null);
    getField(fieldId)
      .then(data => { setField(data); setLoading(false); })
      .catch(err => { console.error('Failed to load field:', err); setError('Failed to load field details.'); setLoading(false); });

    setCostLoading(true);
    getFieldCostOfProduction(fieldId)
      .then(data => { setCostData(data); setCostLoading(false); })
      .catch(() => setCostLoading(false));
  }, [fieldId]);

  const isOpen = fieldId !== null;

  const chartData: ChartRow[] = field?.production
    ?.filter(p => p.estimated_yield_kg !== null || p.actual_yield_kg !== null)
    .sort((a, b) => a.year - b.year)
    .map(p => ({ year: p.year, Estimated: p.estimated_yield_kg ?? 0, Actual: p.actual_yield_kg ?? 0 })) ?? [];

  const showChart = field?.production && hasProductionData(field.production) && chartData.length > 0;

  const enterpriseColor = field ? ENTERPRISE_COLORS[field.enterprise] ?? ENTERPRISE_COLORS.unclassified : '#d1d5db';
  const enterpriseLabel = field ? ENTERPRISE_LABELS[field.enterprise] ?? field.enterprise : '';
  const statusClass = STATUS_COLORS[field?.status ?? ''] ?? 'bg-stone-100 text-stone-700';

  const allInputs: FieldInputTransaction[] = costData?.lines.flatMap(l => l.inputs) ?? [];
  const allTaskInputs: FieldTaskInput[] = costData?.lines.flatMap(l => l.task_inputs) ?? [];
  const allLabour: FieldLabourEntry[] = costData?.lines.flatMap(l => l.labour) ?? [];

  const panelProps = {
    field, loading, error, chartData, showChart: showChart ?? false,
    enterpriseColor, enterpriseLabel, statusClass, onClose, fieldId,
    costData, costLoading, activeTab, setActiveTab,
    allInputs, allTaskInputs, allLabour,
  };

  return (
    <>
      <div className={`hidden md:flex flex-col fixed top-0 right-0 h-full w-[440px] bg-white border-l border-[#f3f4f3] shadow-xl overflow-y-auto z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <PanelContent {...panelProps} showDragHandle={false} />
      </div>
      <div className={`flex md:hidden flex-col fixed bottom-0 left-0 w-full max-h-[80vh] bg-white rounded-t-2xl shadow-xl overflow-y-auto z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <PanelContent {...panelProps} showDragHandle />
      </div>
    </>
  );
}

interface PanelContentProps {
  field: Field | null;
  loading: boolean;
  error: string | null;
  chartData: ChartRow[];
  showChart: boolean;
  enterpriseColor: string;
  enterpriseLabel: string;
  statusClass: string;
  onClose: () => void;
  showDragHandle: boolean;
  fieldId: string | null;
  costData: FieldCostOfProductionType | null;
  costLoading: boolean;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  allInputs: FieldInputTransaction[];
  allTaskInputs: FieldTaskInput[];
  allLabour: FieldLabourEntry[];
}

function PanelContent({
  field, loading, error, chartData, showChart, enterpriseColor, enterpriseLabel,
  statusClass, onClose, showDragHandle, fieldId, costData, costLoading, activeTab, setActiveTab,
  allInputs, allTaskInputs, allLabour,
}: PanelContentProps) {
  const navigate = useNavigate();
  const chartRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col min-h-0">
      {showDragHandle && (
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-[#f3f4f3] px-4 py-3 flex items-start justify-between gap-3 flex-shrink-0 z-10">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-5 w-40 bg-stone-200 rounded animate-pulse" />
          ) : field ? (
            <>
              <h2 className="text-lg font-bold text-stone-900 truncate">{field.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: enterpriseColor }}>
                  {enterpriseLabel}
                </span>
                <span className="text-xs text-stone-500">{field.farm_name}</span>
                {field.area_ha && <span className="text-xs text-stone-500">· {field.area_ha.toFixed(1)} ha</span>}
              </div>
            </>
          ) : (
            <h2 className="text-lg font-bold text-stone-900">Field Details</h2>
          )}
        </div>
        <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors mt-0.5" aria-label="Close panel">
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      {field && !loading && (
        <div className="flex border-b border-[#f3f4f3] px-2 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 bg-stone-100 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
            ))}
          </div>
        )}

        {error && <div className="p-4"><p className="text-sm text-red-600">{error}</p></div>}

        {!loading && !error && field && (
          <>
            {activeTab === 'Overview' && (
              <OverviewTab
                field={field} statusClass={statusClass} showChart={showChart}
                chartData={chartData} chartRef={chartRef}
                costData={costData} rotation={costData?.rotation ?? null}
              />
            )}
            {activeTab === 'Inputs' && (
              <InputsTab inputs={allInputs} taskInputs={allTaskInputs} loading={costLoading} />
            )}
            {activeTab === 'Labour' && (
              <LabourTab labour={allLabour} loading={costLoading} />
            )}
            {activeTab === 'Costs' && (
              <CostsTab
                costData={costData}
                field={field}
                loading={costLoading}
              />
            )}
            {activeTab === 'Enrichment' && fieldId && (
              <FieldEnrichmentTab fieldId={fieldId} />
            )}
          </>
        )}
      </div>

      {/* Quick Actions */}
      {field && !loading && (
        <div className="flex-shrink-0 border-t border-[#f3f4f3] p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Quick Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate(`/calendar?create=true&field_id=${fieldId}`)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors">
              <ClipboardList size={14} className="text-emerald-600" /> Create Task
            </button>
            <button onClick={() => navigate(`/wiki/search?q=${encodeURIComponent(field.name)}`)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors">
              <BookOpen size={14} className="text-blue-600" /> View in Wiki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
