"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function currentYear() {
  return new Date().getFullYear();
}

function years() {
  const now = currentYear();
  const result: number[] = [];
  for (let y = now - 2; y <= now + 2; y++) result.push(y);
  return result;
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function MonthPicker({ value, onChange, disabled }: Props) {
  const [yearStr, monthStr] = value ? value.split("-") : ["", ""];

  function update(year: string, month: string) {
    if (year && month) onChange(`${year}-${month}`);
  }

  return (
    <div className="flex gap-2">
      <Select
        value={yearStr}
        onValueChange={(y) => update(y, monthStr || "01")}
        disabled={disabled}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {years().map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={monthStr}
        onValueChange={(m) => update(yearStr || String(currentYear()), m)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
