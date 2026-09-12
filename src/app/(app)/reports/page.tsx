import { ChartNoAxesCombined } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <>
      <PageHeader title="Reports" description="Historical analysis and CSV export" />
      <EmptyState
        icon={ChartNoAxesCombined}
        title="Reports is not available yet"
        nextStep="Statements, summaries and CSV export arrive in Phase 8."
      />
    </>
  );
}
