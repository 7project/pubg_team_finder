"use client";

import { useState, useEffect } from "react";
import { Button, Toggle, Card } from "@/components/ui";
import { Filter, X, ChevronDown, ChevronUp, Search } from "lucide-react";

export interface Filters {
  rank?: string;
  minRating?: number;
  onlineOnly?: boolean;
  fromGroupOnly?: boolean;
  activity?: string;
  search?: string;
}

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const ranks = [
  { value: "", label: "Все ранги" },
  { value: "Bronze", label: "Bronze" },
  { value: "Silver", label: "Silver" },
  { value: "Gold", label: "Gold" },
  { value: "Platinum", label: "Platinum" },
  { value: "Diamond", label: "Diamond" },
  { value: "Master", label: "Master" },
];

const ratingOptions = [
  { value: "", label: "Любой рейтинг" },
  { value: "4", label: "4+ звёзд" },
  { value: "3", label: "3+ звёзд" },
  { value: "2", label: "2+ звёзд" },
];

const activityOptions = [
  { value: "", label: "Любая активность" },
  { value: "ACTIVE", label: "Активный" },
  { value: "AVERAGE", label: "Средний" },
  { value: "PASSIVE", label: "Пассивный" },
];

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-sm text-gray-300 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-background-dark border border-white/10 rounded-lg text-gray-100 text-sm"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function FilterPanel({ filters, onChange }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search || "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onChange({ ...filters, search: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters, onChange]);

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== "" && value !== false
  ).length;

  const handleReset = () => {
    setSearchInput("");
    onChange({});
  };

  return (
    <div className="mb-4">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск по никнейму..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 bg-background-dark border border-white/10 rounded-lg text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:border-primary/50"
        />
      </div>

      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Фильтры
          {activeFiltersCount > 0 && (
            <span className="bg-primary text-white text-xs px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <X className="w-4 h-4 mr-1" />Сбросить
          </Button>
        )}
      </div>

      {isOpen && (
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectInput label="Ранг" value={filters.rank || ""} onChange={(v) => onChange({ ...filters, rank: v })} options={ranks} />
            <SelectInput label="Мин. рейтинг" value={filters.minRating?.toString() || ""} onChange={(v) => onChange({ ...filters, minRating: v ? Number(v) : undefined })} options={ratingOptions} />
          </div>
          {expanded && (
            <>
              <SelectInput label="Активность" value={filters.activity || ""} onChange={(v) => onChange({ ...filters, activity: v })} options={activityOptions} />
              <div className="space-y-2">
                <Toggle checked={filters.onlineOnly || false} onChange={(checked) => onChange({ ...filters, onlineOnly: checked })} label="Только онлайн" />
                <Toggle checked={filters.fromGroupOnly || false} onChange={(checked) => onChange({ ...filters, fromGroupOnly: checked })} label="Только из моей группы" />
              </div>
            </>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-sm text-primary flex items-center gap-1 hover:underline">
            {expanded ? <><ChevronUp className="w-4 h-4" />Свернуть</> : <><ChevronDown className="w-4 h-4" />Больше фильтров</>}
          </button>
        </Card>
      )}
    </div>
  );
}