import { IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { monthFromParam, type SearchParams } from "@/lib/month-param";
import { formatMonthLong } from "@/domain/month";

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const month = monthFromParam(params.m);
  const label = formatMonthLong(month);

  return (
    <>
      <PageHeader title="Rent" description={`Unit-by-unit expected and paid rent · ${label}`} />
      <EmptyState
        icon={IndianRupee}
        title={`Nothing recorded for ${label}`}
        nextStep="Rent entry arrives in Phase 4. Units and their rent are configured in Settings first."
      />
    </>
  );
}
