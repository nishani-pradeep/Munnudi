"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { KpiScope } from "@/lib/scope-param";

const SCOPES: { value: KpiScope; label: string }[] = [
  { value: "current", label: "Current Month" },
  { value: "tillNow", label: "Till Now" },
  { value: "average", label: "Monthly Average" },
];

type Props = {
  currentScope: KpiScope;
};

export function ScopeToggle({ currentScope }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "current") {
      params.delete("scope");
    } else {
      params.set("scope", value);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "/dashboard");
  }

  return (
    <Tabs value={currentScope} onValueChange={handleChange} className="mb-6">
      <TabsList>
        {SCOPES.map((s) => (
          <TabsTrigger key={s.value} value={s.value}>
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
