import { useState, useEffect, useRef } from 'react';
import {
  Heading1, Heading2, Heading3, Bold, Italic, Code, Quote,
  MessageSquareQuote, AlertTriangle, Lightbulb, CheckSquare,
  Table, Minus, Braces, List, ListOrdered, Highlighter, Image,
  FileText, Leaf, Bug, Wrench, Shield,
} from 'lucide-react';

export interface SlashItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  insert: string;
  group: string;
}

export const SLASH_ITEMS: SlashItem[] = [
  // Text
  { id: 'h1', label: 'Heading 1', description: 'Big section heading', icon: Heading1, insert: '# ', group: 'Text' },
  { id: 'h2', label: 'Heading 2', description: 'Medium section heading', icon: Heading2, insert: '## ', group: 'Text' },
  { id: 'h3', label: 'Heading 3', description: 'Small section heading', icon: Heading3, insert: '### ', group: 'Text' },
  { id: 'bullet', label: 'Bullet List', description: 'Unordered list', icon: List, insert: '- ', group: 'Text' },
  { id: 'numbered', label: 'Numbered List', description: 'Ordered list', icon: ListOrdered, insert: '1. ', group: 'Text' },
  { id: 'todo', label: 'To-do', description: 'Task checkbox', icon: CheckSquare, insert: '- [ ] ', group: 'Text' },
  { id: 'quote', label: 'Quote', description: 'Blockquote', icon: Quote, insert: '> ', group: 'Text' },
  { id: 'divider', label: 'Divider', description: 'Horizontal rule', icon: Minus, insert: '---\n', group: 'Text' },

  // Rich blocks
  { id: 'callout', label: 'Callout', description: 'Note callout box', icon: MessageSquareQuote, insert: '> [!note] Title\n> Content\n', group: 'Blocks' },
  { id: 'warning', label: 'Warning', description: 'Warning callout', icon: AlertTriangle, insert: '> [!warning] Title\n> Content\n', group: 'Blocks' },
  { id: 'tip', label: 'Tip', description: 'Tip callout', icon: Lightbulb, insert: '> [!tip] Title\n> Content\n', group: 'Blocks' },
  { id: 'code', label: 'Code Block', description: 'Fenced code block', icon: Braces, insert: '```\n\n```\n', group: 'Blocks' },
  { id: 'table', label: 'Table', description: 'Markdown table', icon: Table, insert: '| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell     | Cell     | Cell     |\n', group: 'Blocks' },
  { id: 'mermaid', label: 'Diagram', description: 'Mermaid diagram', icon: Image, insert: '```mermaid\ngraph TD\n    A --> B\n```\n', group: 'Blocks' },

  // Inline (insert at cursor, not replacing line)
  { id: 'bold', label: 'Bold', description: '**text**', icon: Bold, insert: '**bold**', group: 'Inline' },
  { id: 'italic', label: 'Italic', description: '*text*', icon: Italic, insert: '*italic*', group: 'Inline' },
  { id: 'highlight', label: 'Highlight', description: '==text==', icon: Highlighter, insert: '==highlight==', group: 'Inline' },
  { id: 'inlinecode', label: 'Inline Code', description: '`code`', icon: Code, insert: '`code`', group: 'Inline' },
  { id: 'wikilink', label: 'Wiki Link', description: '[[page]]', icon: Quote, insert: '[[', group: 'Inline' },

  // Templates
  { id: 'tpl-enterprise', label: 'Enterprise Guide', description: 'Crop/livestock template', icon: Leaf, insert: '## Overview\n\nBrief description of this enterprise.\n\n## Key Facts\n\n| Metric | Value |\n|--------|-------|\n| Area | |\n| Revenue | |\n| Season | |\n\n## Production Process\n\n1. Step one\n2. Step two\n3. Step three\n\n## Key Risks\n\n> [!warning] Risk\n> Describe key risks here.\n', group: 'Templates' },
  { id: 'tpl-pest', label: 'Pest / Disease', description: 'Identification + treatment', icon: Bug, insert: '## Identification\n\nHow to identify this pest/disease.\n\n## Affected Crops\n\n- Crop 1\n\n## Symptoms\n\nDescribe visible symptoms.\n\n## Treatment\n\n> [!danger] Treatment\n> Treatment protocol here.\n\n## Prevention\n\nPreventive measures.\n', group: 'Templates' },
  { id: 'tpl-equipment', label: 'Equipment', description: 'Specs + maintenance', icon: Wrench, insert: '## Description\n\nEquipment name and purpose.\n\n## Specifications\n\n| Spec | Value |\n|------|-------|\n| Make | |\n| Model | |\n| Year | |\n\n## Maintenance Schedule\n\n- [ ] Weekly: check fluids\n- [ ] Monthly: inspect belts\n- [ ] Annual: full service\n', group: 'Templates' },
  { id: 'tpl-compliance', label: 'Compliance', description: 'Regulation + requirements', icon: Shield, insert: '## Regulation\n\nName and reference of the regulation.\n\n## Requirements\n\n1. Requirement one\n2. Requirement two\n\n## Current Status\n\n> [!info] Status\n> Compliance status as of last audit.\n\n## Documentation\n\n- [ ] Document 1\n- [ ] Document 2\n', group: 'Templates' },
  { id: 'tpl-process', label: 'Process / SOP', description: 'Standard operating procedure', icon: FileText, insert: '## Purpose\n\nWhat this process achieves.\n\n## Inputs Required\n\n- Input 1\n- Input 2\n\n## Steps\n\n1. Step one\n2. Step two\n3. Step three\n\n## Output\n\nExpected outcome and quality standards.\n\n> [!tip] Best Practice\n> Tips for optimal results.\n', group: 'Templates' },
];

interface WikiSlashMenuProps {
  position: { top: number; left: number };
  filter: string;
  onSelect: (item: SlashItem) => void;
  onClose: () => void;
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export default function WikiSlashMenu({ position, filter, onSelect, onClose }: WikiSlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = filter
    ? SLASH_ITEMS.filter(item => fuzzyMatch(item.label, filter) || fuzzyMatch(item.id, filter))
    : SLASH_ITEMS;

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (filtered.length > 0) onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Scroll selected into view
  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return (
      <div
        ref={menuRef}
        className="fixed z-50 w-72 bg-white rounded-lg shadow-xl border border-stone-200 p-3"
        style={{ top: position.top, left: Math.min(position.left, window.innerWidth - 300) }}
      >
        <p className="text-xs text-stone-400">No commands found</p>
      </div>
    );
  }

  // Group items
  const groups: Record<string, SlashItem[]> = {};
  for (const item of filtered) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }

  let flatIdx = 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto bg-white rounded-lg shadow-xl border border-stone-200 py-1 wiki-scale-in"
      style={{ top: position.top, left: Math.min(position.left, window.innerWidth - 300) }}
    >
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <div className="px-3 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">{group}</div>
          {items.map((item) => {
            const idx = flatIdx++;
            return (
              <button
                key={item.id}
                data-idx={idx}
                onClick={() => onSelect(item)}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 text-sm transition-colors ${
                  idx === selectedIndex ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-stone-50 text-stone-700'
                }`}
              >
                <item.icon size={15} className="flex-shrink-0 text-stone-400" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{item.label}</span>
                </div>
                <span className="text-[10px] text-stone-400 truncate">{item.description}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
