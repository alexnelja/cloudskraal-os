import { useState, useEffect } from 'react';
import { getWikiHistory } from '../../api/wiki';
import type { WikiRevision } from '../../api/wiki';

interface WikiHistoryProps {
  slug: string;
  currentBody: string;
}

/** Simple line diff — returns lines with +/- markers */
function lineDiff(oldText: string, newText: string): { type: 'same' | 'add' | 'del'; text: string }[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: { type: 'same' | 'add' | 'del'; text: string }[] = [];

  // Simple O(n) diff using line matching
  const oldSet = new Map<string, number[]>();
  oldLines.forEach((line, i) => {
    if (!oldSet.has(line)) oldSet.set(line, []);
    oldSet.get(line)!.push(i);
  });

  let oi = 0;
  let ni = 0;
  while (oi < oldLines.length && ni < newLines.length) {
    if (oldLines[oi] === newLines[ni]) {
      result.push({ type: 'same', text: oldLines[oi] });
      oi++; ni++;
    } else {
      // Look ahead in new for match with current old
      let foundInNew = -1;
      for (let j = ni + 1; j < Math.min(ni + 5, newLines.length); j++) {
        if (newLines[j] === oldLines[oi]) { foundInNew = j; break; }
      }
      let foundInOld = -1;
      for (let j = oi + 1; j < Math.min(oi + 5, oldLines.length); j++) {
        if (oldLines[j] === newLines[ni]) { foundInOld = j; break; }
      }

      if (foundInNew >= 0 && (foundInOld < 0 || foundInNew - ni <= foundInOld - oi)) {
        // Lines added in new
        for (let j = ni; j < foundInNew; j++) result.push({ type: 'add', text: newLines[j] });
        ni = foundInNew;
      } else if (foundInOld >= 0) {
        // Lines removed from old
        for (let j = oi; j < foundInOld; j++) result.push({ type: 'del', text: oldLines[j] });
        oi = foundInOld;
      } else {
        result.push({ type: 'del', text: oldLines[oi] });
        result.push({ type: 'add', text: newLines[ni] });
        oi++; ni++;
      }
    }
  }
  while (oi < oldLines.length) { result.push({ type: 'del', text: oldLines[oi++] }); }
  while (ni < newLines.length) { result.push({ type: 'add', text: newLines[ni++] }); }

  return result;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function WikiHistory({ slug, currentBody }: WikiHistoryProps) {
  const [revisions, setRevisions] = useState<WikiRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    getWikiHistory(slug)
      .then(setRevisions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <p className="text-xs text-stone-400">Loading history...</p>;
  if (revisions.length === 0) return <p className="text-xs text-stone-400">No previous versions.</p>;

  return (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {revisions.map((rev, i) => {
        const newerBody = i === 0 ? currentBody : revisions[i - 1].body;
        const diff = lineDiff(rev.body, newerBody);
        const added = diff.filter(d => d.type === 'add').length;
        const removed = diff.filter(d => d.type === 'del').length;
        const isSelected = selectedIdx === i;

        return (
          <div key={rev.id}>
            <button
              onClick={() => setSelectedIdx(isSelected ? null : i)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${isSelected ? 'bg-stone-100' : 'hover:bg-stone-50'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-stone-600 flex-1 truncate">{formatDate(rev.created_at)}</span>
                {added > 0 && <span className="text-emerald-600 font-mono">+{added}</span>}
                {removed > 0 && <span className="text-red-500 font-mono">-{removed}</span>}
              </div>
            </button>
            {isSelected && (
              <div className="mt-1 mx-1 rounded border border-stone-200 overflow-hidden max-h-48 overflow-y-auto text-[10px] font-mono">
                {diff.filter(d => d.type !== 'same').slice(0, 50).map((d, j) => (
                  <div
                    key={j}
                    className={`px-2 py-0.5 ${
                      d.type === 'add' ? 'bg-emerald-50 text-emerald-800' :
                      d.type === 'del' ? 'bg-red-50 text-red-700' :
                      'text-stone-600'
                    }`}
                  >
                    <span className="select-none mr-1.5 text-stone-400">{d.type === 'add' ? '+' : '-'}</span>
                    {d.text || '\u00A0'}
                  </div>
                ))}
                {diff.filter(d => d.type !== 'same').length > 50 && (
                  <div className="px-2 py-1 text-stone-400 text-center">...{diff.filter(d => d.type !== 'same').length - 50} more changes</div>
                )}
                {diff.filter(d => d.type !== 'same').length === 0 && (
                  <div className="px-2 py-2 text-stone-400 text-center">No changes</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
