import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Bold,
  Italic,
  Code,
  Quote,
  MessageSquareQuote,
  AlertTriangle,
  Lightbulb,
  CheckSquare,
  Table,
  Minus,
  Braces,
  MapPin,
  Wrench,
  ClipboardList,
  BookOpen,
  Egg,
  Package,
  Users,
  ShoppingCart,
  Search,
} from 'lucide-react';
import { getFields } from '../../api/farms';
import { getEquipment } from '../../api/equipment';
import { getTasks } from '../../api/calendar';
import { getWikiPages } from '../../api/wiki';
import { getLivestockGroups } from '../../api/livestock';
import { getBatches } from '../../api/production';
import { getEmployees } from '../../api/employees';
import { getProducts } from '../../api/inventory';

interface SlashCommandMenuProps {
  textarea: HTMLTextAreaElement;
  onInsert: (text: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  group: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  insert?: string;
  database?: string;
}

const COMMANDS: SlashCommand[] = [
  // Format
  { id: 'h1', label: 'Heading 1', description: '#', group: 'Format', icon: Heading1, insert: '# ' },
  { id: 'h2', label: 'Heading 2', description: '##', group: 'Format', icon: Heading2, insert: '## ' },
  { id: 'h3', label: 'Heading 3', description: '###', group: 'Format', icon: Heading3, insert: '### ' },
  { id: 'bold', label: 'Bold', description: '**text**', group: 'Format', icon: Bold, insert: '**bold**' },
  { id: 'italic', label: 'Italic', description: '*text*', group: 'Format', icon: Italic, insert: '*italic*' },
  { id: 'code', label: 'Code', description: '`code`', group: 'Format', icon: Code, insert: '`code`' },
  { id: 'quote', label: 'Blockquote', description: '> text', group: 'Format', icon: Quote, insert: '> ' },

  // Blocks
  { id: 'callout', label: 'Callout', description: '> [!note]', group: 'Blocks', icon: MessageSquareQuote, insert: '\n> [!note] Title\n> Content\n' },
  { id: 'warning', label: 'Warning', description: '> [!warning]', group: 'Blocks', icon: AlertTriangle, insert: '\n> [!warning] Title\n> Content\n' },
  { id: 'tip', label: 'Tip', description: '> [!tip]', group: 'Blocks', icon: Lightbulb, insert: '\n> [!tip] Title\n> Content\n' },
  { id: 'checklist', label: 'Checklist', description: '- [ ] item', group: 'Blocks', icon: CheckSquare, insert: '\n- [ ] ' },
  { id: 'table', label: 'Table', description: '|col|col|', group: 'Blocks', icon: Table, insert: '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n| Cell     | Cell     | Cell     |\n' },
  { id: 'divider', label: 'Divider', description: '---', group: 'Blocks', icon: Minus, insert: '\n---\n' },
  { id: 'codeblock', label: 'Code Block', description: '```', group: 'Blocks', icon: Braces, insert: '\n```\n\n```\n' },

  // Database
  { id: 'field', label: 'Link to field', description: 'Search fields...', group: 'Database', icon: MapPin, database: 'field' },
  { id: 'equipment', label: 'Link to equipment', description: 'Search...', group: 'Database', icon: Wrench, database: 'equipment' },
  { id: 'task', label: 'Link to task', description: 'Search...', group: 'Database', icon: ClipboardList, database: 'task' },
  { id: 'wiki', label: 'Link to wiki page', description: 'Search...', group: 'Database', icon: BookOpen, database: 'wiki' },
  { id: 'livestock', label: 'Link to group', description: 'Search...', group: 'Database', icon: Egg, database: 'livestock' },
  { id: 'batch', label: 'Link to batch', description: 'Search...', group: 'Database', icon: Package, database: 'batch' },
  { id: 'employee', label: 'Link to employee', description: 'Search...', group: 'Database', icon: Users, database: 'employee' },
  { id: 'product', label: 'Link to product', description: 'Search...', group: 'Database', icon: ShoppingCart, database: 'product' },
];

interface SearchResult {
  id: string;
  label: string;
  detail: string;
  insertText: string;
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

export default function SlashCommandMenu({
  textarea,
  onInsert,
  onClose,
  position,
}: SlashCommandMenuProps) {
  const [filter, setFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dbSearch, setDbSearch] = useState<string | null>(null);
  const [dbQuery, setDbQuery] = useState('');
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbSelectedIndex, setDbSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Listen for typing after slash to build filter
  useEffect(() => {
    function handleInput() {
      const pos = textarea.selectionStart;
      const text = textarea.value;
      // Find the slash that triggered us
      // Look backwards from cursor for the `/`
      let slashPos = -1;
      for (let i = pos - 1; i >= 0; i--) {
        if (text[i] === '/') {
          slashPos = i;
          break;
        }
        if (text[i] === '\n' || text[i] === ' ') break;
      }
      if (slashPos >= 0) {
        const typed = text.substring(slashPos + 1, pos);
        setFilter(typed);
      }
    }

    textarea.addEventListener('input', handleInput);
    return () => textarea.removeEventListener('input', handleInput);
  }, [textarea]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (dbSearch) {
        // In database search mode, let the search input handle keys
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands.length > 0) {
          selectCommand(filteredCommands[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    textarea.addEventListener('keydown', handleKeyDown);
    return () => textarea.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedIndex, dbSearch]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filteredCommands = filter
    ? COMMANDS.filter(
        (cmd) =>
          fuzzyMatch(cmd.id, filter) ||
          fuzzyMatch(cmd.label, filter),
      )
    : COMMANDS;

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  function selectCommand(cmd: SlashCommand) {
    if (cmd.database) {
      setDbSearch(cmd.database);
      setDbQuery('');
      setDbResults([]);
      setDbSelectedIndex(0);
      fetchDbResults(cmd.database, '');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (cmd.insert) {
      onInsert(cmd.insert);
    }
  }

  const fetchDbResults = useCallback(async (type: string, query: string) => {
    setDbLoading(true);
    try {
      let results: SearchResult[] = [];

      switch (type) {
        case 'field': {
          const fields = await getFields();
          results = fields
            .filter((f) => !query || f.name.toLowerCase().includes(query.toLowerCase()) || (f.code && f.code.toLowerCase().includes(query.toLowerCase())))
            .slice(0, 10)
            .map((f) => ({
              id: f.id,
              label: f.code ? `${f.code}: ${f.name}` : f.name,
              detail: `${f.area_ha} ha, ${f.enterprise}`,
              insertText: `**${f.code ? f.code + ': ' : ''}${f.name}** (${f.area_ha} ha, ${f.enterprise})`,
            }));
          break;
        }
        case 'equipment': {
          const equipment = await getEquipment();
          results = equipment
            .filter((e) => !query || e.name.toLowerCase().includes(query.toLowerCase()) || (e.code && e.code.toLowerCase().includes(query.toLowerCase())))
            .slice(0, 10)
            .map((e) => ({
              id: e.id,
              label: e.code ? `${e.code}: ${e.name}` : e.name,
              detail: [e.make, e.model, e.type].filter(Boolean).join(' - '),
              insertText: `**${e.code ? e.code + ': ' : ''}${e.name}**`,
            }));
          break;
        }
        case 'task': {
          const tasks = await getTasks();
          results = tasks
            .filter((t) => !query || t.title.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10)
            .map((t) => ({
              id: t.id,
              label: t.title,
              detail: `${t.status} - ${t.priority} priority`,
              insertText: `**Task: ${t.title}** (${t.status})`,
            }));
          break;
        }
        case 'wiki': {
          const pages = await getWikiPages(query ? { search: query } : undefined);
          results = pages
            .slice(0, 10)
            .map((p) => ({
              id: p.id,
              label: p.title,
              detail: p.category ?? 'general',
              insertText: `[[${p.title}]]`,
            }));
          break;
        }
        case 'livestock': {
          const groups = await getLivestockGroups();
          results = groups
            .filter((g) => !query || g.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10)
            .map((g) => ({
              id: g.id,
              label: g.name,
              detail: `${g.head_count} head, ${g.species}${g.breed ? ' - ' + g.breed : ''}`,
              insertText: `**${g.name}** (${g.head_count} head, ${g.species})`,
            }));
          break;
        }
        case 'batch': {
          const batches = await getBatches();
          results = batches
            .filter((b) => !query || b.batch_code.toLowerCase().includes(query.toLowerCase()) || b.enterprise.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10)
            .map((b) => ({
              id: b.id,
              label: b.batch_code,
              detail: `${b.enterprise} - ${b.status}`,
              insertText: `**Batch: ${b.batch_code}** (${b.enterprise}, ${b.status})`,
            }));
          break;
        }
        case 'employee': {
          const employees = await getEmployees();
          results = employees
            .filter((e) => !query || e.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10)
            .map((e) => ({
              id: e.id,
              label: e.name,
              detail: [e.role, e.department].filter(Boolean).join(' - '),
              insertText: `**${e.name}**${e.role ? ' (' + e.role + ')' : ''}`,
            }));
          break;
        }
        case 'product': {
          const products = await getProducts();
          results = products
            .filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 10)
            .map((p) => ({
              id: p.id,
              label: p.name,
              detail: p.category,
              insertText: `**${p.name}** (${p.category})`,
            }));
          break;
        }
      }

      setDbResults(results);
      setDbSelectedIndex(0);
    } catch (err) {
      console.error('Failed to fetch database results:', err);
      setDbResults([]);
    } finally {
      setDbLoading(false);
    }
  }, []);

  function handleDbSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDbSelectedIndex((prev) => Math.min(prev + 1, dbResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDbSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (dbResults.length > 0) {
        onInsert(dbResults[dbSelectedIndex].insertText);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDbSearch(null);
    }
  }

  function handleDbQueryChange(value: string) {
    setDbQuery(value);
    if (dbSearch) {
      fetchDbResults(dbSearch, value);
    }
  }

  // Group filtered commands
  const groups: Record<string, SlashCommand[]> = {};
  for (const cmd of filteredCommands) {
    if (!groups[cmd.group]) groups[cmd.group] = [];
    groups[cmd.group].push(cmd);
  }

  // Flat index for keyboard nav
  let flatIndex = 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto bg-white rounded-lg shadow-xl border border-stone-200"
      style={{ top: position.top, left: Math.min(position.left, window.innerWidth - 300) }}
    >
      {dbSearch ? (
        /* Database search sub-menu */
        <div className="p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
            <Search size={14} className="text-stone-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={dbQuery}
              onChange={(e) => handleDbQueryChange(e.target.value)}
              onKeyDown={handleDbSearchKeyDown}
              placeholder={`Search ${dbSearch}...`}
              className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-stone-400"
              autoFocus
            />
            <button
              onClick={() => setDbSearch(null)}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Back
            </button>
          </div>
          {dbLoading ? (
            <p className="px-3 py-2 text-xs text-stone-400">Loading...</p>
          ) : dbResults.length === 0 ? (
            <p className="px-3 py-2 text-xs text-stone-400">No results found</p>
          ) : (
            dbResults.map((result, i) => (
              <button
                key={result.id}
                onClick={() => onInsert(result.insertText)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  i === dbSelectedIndex
                    ? 'bg-emerald-50 text-emerald-900'
                    : 'hover:bg-stone-50 text-stone-800'
                }`}
              >
                <div className="font-medium truncate">{result.label}</div>
                <div className="text-xs text-stone-400 truncate">{result.detail}</div>
              </button>
            ))
          )}
        </div>
      ) : filteredCommands.length === 0 ? (
        <p className="px-3 py-3 text-xs text-stone-400">No commands found</p>
      ) : (
        /* Main command list */
        <div className="py-1">
          {Object.entries(groups).map(([groupName, cmds]) => (
            <div key={groupName}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                {groupName}
              </div>
              {cmds.map((cmd) => {
                const thisIndex = flatIndex++;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => selectCommand(cmd)}
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 text-sm transition-colors ${
                      thisIndex === selectedIndex
                        ? 'bg-emerald-50 text-emerald-900'
                        : 'hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <cmd.icon size={15} className="flex-shrink-0 text-stone-400" />
                    <span className="flex-1 truncate">{cmd.label}</span>
                    <span className="text-xs text-stone-400 font-mono truncate">
                      {cmd.description}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
