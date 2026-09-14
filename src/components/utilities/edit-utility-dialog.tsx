"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { saveUtilityAction } from "@/server/actions/utilities";
import { computeUsage } from "@/domain/utilities";
import type { UtilityRow } from "@/server/db/repositories/utility-records";
import type { MonthKey } from "@/domain/month";

const READING_RE = /^\d+(\.\d{1,3})?$/;
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

const optionalReading = z
  .string()
  .trim()
  .refine((v) => v === "" || READING_RE.test(v), "Enter a valid reading, e.g. 1234 or 1234.5");

const formSchema = z.object({
  previousReading: optionalReading,
  currentReading: optionalReading,
  usageOverride: optionalReading,
  meterEvent: z.enum(["NONE", "RESET", "ROLLOVER", "REPLACED"]),
  billAmount: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Enter a valid amount"),
  billPaid: z.enum(["yes", "no", "unset"]),
  noBillThisMonth: z.boolean(),
  comment: z.string().trim().max(500, "Keep comments under 500 characters"),
});

type FormValues = z.infer<typeof formSchema>;

function toStr(n: string | null): string {
  return n ?? "";
}

const METER_EVENT_LABEL: Record<string, string> = {
  NONE: "None",
  RESET: "Meter reset",
  ROLLOVER: "Rollover",
  REPLACED: "Meter replaced",
};

export function EditUtilityDialog({ row, month }: { row: UtilityRow; month: MonthKey }) {
  const [open, setOpen] = useState(false);

  const defaults: FormValues = {
    previousReading: toStr(row.previousReading),
    currentReading: toStr(row.currentReading),
    usageOverride: toStr(row.usageOverride),
    meterEvent: row.meterEvent as FormValues["meterEvent"],
    billAmount: toStr(row.billAmount),
    billPaid: row.billPaid === null ? "unset" : row.billPaid ? "yes" : "no",
    noBillThisMonth: row.noBillThisMonth,
    comment: toStr(row.comment),
  };

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults });

  const { execute, isTransitioning } = useAction(saveUtilityAction, {
    onSuccess: () => {
      toast.success(`${row.unitCode} ${row.utilityType.toLowerCase()} saved`);
      setOpen(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Could not save");
    },
  });

  function onSubmit(values: FormValues) {
    execute({
      unitId: row.unitId,
      month,
      utilityType: row.utilityType,
      uomSnapshot: row.uomSnapshot,
      ...values,
    });
  }

  const watched = useWatch({ control: form.control });
  const previewUsage = computeUsage(
    watched.previousReading === "" ? null : Number(watched.previousReading),
    watched.currentReading === "" ? null : Number(watched.currentReading),
    watched.usageOverride === "" ? null : Number(watched.usageOverride),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${row.unitCode} ${row.utilityType}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {row.unitCode} · {row.utilityType === "ELECTRICITY" ? "Electricity" : "Water"}
          </DialogTitle>
          <DialogDescription>Readings in {row.uomSnapshot}.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="previousReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previous reading</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currentReading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current reading</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Usage:{" "}
              <span className="font-medium text-foreground">
                {previewUsage === null ? "Not entered" : `${previewUsage} ${row.uomSnapshot}`}
              </span>
            </p>

            <FormField
              control={form.control}
              name="usageOverride"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Manual usage override (optional)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="Leave blank to use readings"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="meterEvent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meter event</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(METER_EVENT_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="billAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill amount (Rs)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="billPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill paid</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unset">Not entered</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="noBillThisMonth"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(c) => field.onChange(c === true)}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">No bill this month</FormLabel>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isTransitioning}>
                {isTransitioning ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
