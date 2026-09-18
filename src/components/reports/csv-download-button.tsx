"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCsvAction } from "@/server/actions/reports";

type Props = {
  reportType: "rent" | "expenses" | "utilities" | "loans";
  fromMonth: string;
  toMonth: string;
  label?: string;
};

export function CsvDownloadButton({
  reportType,
  fromMonth,
  toMonth,
  label = "Export CSV",
}: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await exportCsvAction({
        reportType,
        fromMonth,
        toMonth,
      });

      if (result?.data) {
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
      <Download className="mr-1.5 h-4 w-4" />
      {pending ? "Exporting..." : label}
    </Button>
  );
}
