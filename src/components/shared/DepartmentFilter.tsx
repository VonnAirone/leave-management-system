import { X } from 'lucide-react';

interface DepartmentFilterProps {
  departments: string[];
  selected: string;
  onChange: (dept: string) => void;
  resultCount?: number;
  resultLabel?: string;
}

export function DepartmentFilter({
  departments,
  selected,
  onChange,
  resultCount,
  resultLabel = 'result',
}: DepartmentFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onChange('')}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          !selected
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {departments.map((dept) => (
        <button
          key={dept}
          onClick={() => onChange(selected === dept ? '' : dept)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selected === dept
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {dept}
          {selected === dept && <X size={14} className="opacity-70" />}
        </button>
      ))}
      {selected && resultCount !== undefined && (
        <span className="text-sm text-gray-500 ml-1">
          {resultCount} {resultLabel}{resultCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
