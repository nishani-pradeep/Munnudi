"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { createLoanAction, updateLoanAction } from "@/server/actions/loans";

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  loanType: z.enum(["HOME_LOAN", "GOLD_LOAN", "OTHER"]),
  lender: z.string().trim(),
  originalPrincipal: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  openingOutstanding: z
    .string()
    .trim()
    .refine((v) => MONEY_RE.test(v), "Enter a valid amount"),
  openingAsOfMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month"),
  interestRate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+(\.\d{1,3})?$/.test(v), "e.g. 8.5"),
  scheduledEmi: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  remainingTenureMonths: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), "Whole number"),
  expectsMonthlyPayment: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export type ExistingLoan = {
  id: string;
  name: string;
  loanType: string;
  lender: string | null;
  originalPrincipal: string | null;
  openingOutstanding: string;
  openingAsOfMonth: string;
  interestRate: string | null;
  scheduledEmi: string | null;
  remainingTenureMonths: number | null;
  expectsMonthlyPayment: boolean;
};

type Props = { trigger: ReactNode; existing?: ExistingLoan };

export function LoanDialog({ trigger, existing }: Props) {
  const [open, setOpen] = useState(false);

  const defaults: FormValues = existing
    ? {
        name: existing.name,
        loanType: existing.loanType as FormValues["loanType"],
        lender: existing.lender ?? "",
        originalPrincipal: existing.originalPrincipal?.replace(/\.00$/, "") ?? "",
        openingOutstanding: existing.openingOutstanding.replace(/\.00$/, ""),
        openingAsOfMonth: existing.openingAsOfMonth,
        interestRate: existing.interestRate ?? "",
        scheduledEmi: existing.scheduledEmi?.replace(/\.00$/, "") ?? "",
        remainingTenureMonths:
          existing.remainingTenureMonths === null
            ? ""
            : String(existing.remainingTenureMonths),
        expectsMonthlyPayment: existing.expectsMonthlyPayment,
      }
    : {
        name: "",
        loanType: "HOME_LOAN" as const,
        lender: "",
        originalPrincipal: "",
        openingOutstanding: "",
        openingAsOfMonth: "",
        interestRate: "",
        scheduledEmi: "",
        remainingTenureMonths: "",
        expectsMonthlyPayment: true,
      };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  function onDone() {
    toast.success(existing ? "Loan updated" : "Loan added");
    setOpen(false);
  }
  function onFail(message?: string) {
    toast.error(message ?? "Could not save loan");
  }

  const { execute: create, isTransitioning: creating } = useAction(createLoanAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });
  const { execute: update, isTransitioning: updating } = useAction(updateLoanAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });

  function onSubmit(values: FormValues) {
    if (existing) {
      update({ loanId: existing.id, ...values });
    } else {
      create(values);
    }
  }

  const isPending = creating || updating;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit loan" : "Add loan"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Update loan details."
              : "Record a loan you want to track repayments for."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loan name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. SBI Home Loan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="loanType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HOME_LOAN">Home Loan</SelectItem>
                        <SelectItem value="GOLD_LOAN">Gold Loan</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lender</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SBI" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="openingOutstanding"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening outstanding (Rs)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 2500000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openingAsOfMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>As of month</FormLabel>
                    <FormControl>
                      <Input type="month" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="originalPrincipal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Original principal (optional)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="e.g. 3000000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate (%)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 8.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scheduledEmi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EMI (Rs)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 22450" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="remainingTenureMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenure (mo)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" placeholder="e.g. 180" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="expectsMonthlyPayment"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-md border p-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Expects monthly payment</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Turn off for bullet-repayment loans (e.g. gold loans).
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
