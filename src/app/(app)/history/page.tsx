import { History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <>
      <PageHeader title="History" description="Corrections and activity log" />
      <EmptyState
        icon={History}
        title="History is not available yet"
        nextStep="The audit trail arrives with the data layer in Phase 2."
      />
    </>
  );
}
