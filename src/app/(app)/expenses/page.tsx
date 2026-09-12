import { ReceiptText } from "lucide-react";
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
      <PageHeader title="Expenses" description={`Property and common expenses · ${label}`} />
      <EmptyState
        icon={ReceiptText}
        title={`Nothing recorded for ${label}`}
        nextStep="Expense capture across the six categories arrives in Phase 5."
      />
    </>
  );
}
