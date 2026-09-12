import { Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default function Page() {
  return (
    <>
      <PageHeader title="Settings" description="Property, units, rent and loan setup" />
      <EmptyState
        icon={Settings}
        title="Settings is not available yet"
        nextStep="Property and unit configuration arrives in Phase 4."
      />
    </>
  );
}
