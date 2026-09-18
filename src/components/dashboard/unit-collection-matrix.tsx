import { Badge } from "@/components/ui/badge";
import { formatMonthShort, type MonthKey } from "@/domain/month";

type MatrixRow = {
  unitId: string;
  unitCode: string;
  months: Record<string, string>;
};

type Props = {
  matrix: MatrixRow[];
  months: MonthKey[];
};

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  unpaid: { label: "Unpaid", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  pending: { label: "Unset", className: "bg-muted text-muted-foreground" },
  self: { label: "Self", className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  "": { label: "", className: "" },
};

export function UnitCollectionMatrix({ matrix, months }: Props) {
  if (matrix.length === 0) {
    return <p className="text-sm text-muted-foreground">No unit data to display.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Unit</th>
            {months.map((m) => (
              <th key={m} className="px-2 py-1.5 text-center font-medium text-muted-foreground">
                {formatMonthShort(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.unitId} className="border-b last:border-0">
              <td className="px-2 py-1.5 font-medium">{row.unitCode}</td>
              {months.map((m) => {
                const status = row.months[m] ?? "";
                const style = STATUS_STYLES[status] ?? STATUS_STYLES[""];
                return (
                  <td key={m} className="px-2 py-1.5 text-center">
                    {style.label ? (
                      <Badge variant="outline" className={`text-[10px] ${style.className}`}>
                        {style.label}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
