import { Landmark } from "lucide-react";
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
      <PageHeader title="Loans" description={`Loan masters and monthly repayments · ${label}`} />
      <EmptyState
        icon={Landmark}
        title={`Nothing recorded for ${label}`}
        nextStep="Loan setup and repayment tracking arrive in Phase 6."
      />
    </>
  );
}
