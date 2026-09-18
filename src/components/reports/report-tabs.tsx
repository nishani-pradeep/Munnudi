"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

const TABS = [
  { value: "monthly", label: "Monthly Statement" },
  { value: "annual", label: "Annual Summary" },
  { value: "unit", label: "Unit" },
  { value: "loan", label: "Loan" },
  { value: "expense", label: "Expense" },
  { value: "utility", label: "Utility" },
] as const;

type Props = {
  activeTab: string;
  children: ReactNode;
};

export function ReportTabs({ activeTab, children }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onTabChange(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/reports?${params.toString()}`);
  }

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="mb-4 w-full flex-wrap">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
