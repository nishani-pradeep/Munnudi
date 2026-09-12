import { LayoutDashboard } from "lucide-react";
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
      <PageHeader title="Dashboard" description={`Portfolio health and trends · ${label}`} />
      <EmptyState
        icon={LayoutDashboard}
        title={`Nothing recorded for ${label}`}
        nextStep="KPI cards and charts arrive in Phase 7, once the data layer and calculation engine are in place."
      />
    </>
  );
}
