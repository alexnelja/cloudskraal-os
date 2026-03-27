import { useState, useRef } from 'react';
import { formatZAR, parseZARInput } from '../utils/format';

interface ZARInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}

export default function ZARInput({ value, onChange, className = '', placeholder }: ZARInputProps) {
  const [editing, setEditing] = useState(false);
  const [rawValue, setRawValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = () => {
    setEditing(true);
    setRawValue(value === 0 ? '' : value.toString());
  };

  const handleBlur = () => {
    setEditing(false);
    const parsed = parseZARInput(rawValue);
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRawValue(e.target.value);
  };

  return (
    <input
      ref={inputRef}
      type={editing ? 'text' : 'text'}
      value={editing ? rawValue : value === 0 ? '' : formatZAR(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder || 'R 0.00'}
      className={`border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${className}`}
    />
  );
}
