import { Gauge } from "lucide-react";
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
      <PageHeader title="Utilities" description={`Electricity and water readings · ${label}`} />
      <EmptyState
        icon={Gauge}
        title={`Nothing recorded for ${label}`}
        nextStep="Meter readings and bills arrive in Phase 5."
      />
    </>
  );
}
