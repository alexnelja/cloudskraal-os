import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

interface Animal {
  tag: string;
  breed: string;
  age: number;
  weight: number;
  conditionScore: number;
  status: string;
}

const MOCK_ANIMALS: Record<string, Animal[]> = {
  default: [
    { tag: 'DM-0001', breed: 'Dohne Merino', age: 3, weight: 72, conditionScore: 3.5, status: 'Productive' },
    { tag: 'DM-0002', breed: 'Dohne Merino', age: 5, weight: 68, conditionScore: 3.0, status: 'Productive' },
    { tag: 'DM-0003', breed: 'Dohne Merino', age: 2, weight: 45, conditionScore: 4.0, status: 'Growing' },
    { tag: 'DM-0004', breed: 'Dohne Merino', age: 4, weight: 74, conditionScore: 3.5, status: 'Productive' },
    { tag: 'DM-0005', breed: 'Dohne Merino', age: 6, weight: 65, conditionScore: 2.5, status: 'Cull' },
    { tag: 'DM-0006', breed: 'Dohne Merino', age: 1, weight: 38, conditionScore: 3.5, status: 'Growing' },
    { tag: 'DM-0007', breed: 'Dohne Merino', age: 3, weight: 71, conditionScore: 3.0, status: 'Productive' },
    { tag: 'DM-0008', breed: 'Dohne Merino', age: 4, weight: 76, conditionScore: 4.0, status: 'Productive' },
    { tag: 'DM-0009', breed: 'Dohne Merino', age: 2, weight: 48, conditionScore: 3.5, status: 'Growing' },
    { tag: 'DM-0010', breed: 'Dohne Merino', age: 5, weight: 70, conditionScore: 3.0, status: 'Productive' },
    { tag: 'DM-0011', breed: 'Dohne Merino', age: 3, weight: 73, conditionScore: 3.5, status: 'Productive' },
    { tag: 'DM-0012', breed: 'Dohne Merino', age: 7, weight: 62, conditionScore: 2.0, status: 'Cull' },
    { tag: 'DM-0013', breed: 'Dohne Merino', age: 1, weight: 35, conditionScore: 3.0, status: 'Growing' },
    { tag: 'DM-0014', breed: 'Dohne Merino', age: 4, weight: 78, conditionScore: 4.5, status: 'Stud' },
    { tag: 'DM-0015', breed: 'Dohne Merino', age: 2, weight: 52, conditionScore: 3.5, status: 'Growing' },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  Productive: '#047857',
  Growing: '#2563eb',
  Cull: '#ba1a1a',
  Stud: '#7c3aed',
};

interface Props {
  groupName: string;
}

export default function LivestockAnimals({ groupName }: Props) {
  const [search, setSearch] = useState('');
  const animals = MOCK_ANIMALS[groupName] ?? MOCK_ANIMALS.default;

  const filtered = useMemo(() => {
    if (!search) return animals;
    const q = search.toLowerCase();
    return animals.filter(
      (a) => a.tag.toLowerCase().includes(q) || a.breed.toLowerCase().includes(q) || a.status.toLowerCase().includes(q),
    );
  }, [animals, search]);

  return (
    <div className="p-4 space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          placeholder="Search by tag, breed, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-[#f3f4f3]">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-stone-600">Tag</th>
              <th className="text-left px-3 py-2 font-medium text-stone-600 hidden sm:table-cell">Breed</th>
              <th className="text-right px-3 py-2 font-medium text-stone-600">Age</th>
              <th className="text-right px-3 py-2 font-medium text-stone-600">Weight</th>
              <th className="text-right px-3 py-2 font-medium text-stone-600">CS</th>
              <th className="text-left px-3 py-2 font-medium text-stone-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((animal) => (
              <tr key={animal.tag} className="border-b border-[#f3f4f3]">
                <td className="px-3 py-2 font-medium text-stone-800">{animal.tag}</td>
                <td className="px-3 py-2 text-stone-600 hidden sm:table-cell">{animal.breed}</td>
                <td className="px-3 py-2 text-right text-stone-600">{animal.age}y</td>
                <td className="px-3 py-2 text-right text-stone-800">{animal.weight} kg</td>
                <td className="px-3 py-2 text-right text-stone-800">{animal.conditionScore}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: STATUS_COLORS[animal.status] ?? '#6b7280' }}
                  >
                    {animal.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-stone-400">
                  No animals match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-stone-400">
        Showing {filtered.length} of {animals.length} animals -- mock data, will connect to KLK DSS API
      </p>
    </div>
  );
}
