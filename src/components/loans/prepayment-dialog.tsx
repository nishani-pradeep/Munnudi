"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { saveLoanRepaymentAction } from "@/server/actions/loans";
import { computeEmi } from "@/domain/loans";
import { paise, formatInrWhole } from "@/domain/money";

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

const formSchema = z.object({
  prepaymentAmount: z
    .string()
    .trim()
    .refine((v) => MONEY_RE.test(v) && Number(v) > 0, "Amount must be greater than 0"),
  remainingBalance: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  comment: z.string().trim().max(500, "Keep comments under 500 characters"),
});

type FormValues = z.infer<typeof formSchema>;

type Props = {
  loanId: string;
  loanName: string;
  currentMonth: string;
  /** Current outstanding in rupees (not paise). */
  currentOutstanding: number;
  interestRate: number | null;
  remainingTenure: number | null;
  trigger: ReactNode;
  /** If true, shows a warning that an EMI already exists this month. */
  existingRepaymentThisMonth?: boolean;
  existingAmount?: string;
};

export function PrepaymentDialog({
  loanId,
  loanName,
  currentMonth,
  currentOutstanding,
  interestRate,
  remainingTenure,
  trigger,
  existingRepaymentThisMonth,
  existingAmount,
}: Props) {
  const [open, setOpen] = useState(false);

  const defaults: FormValues = {
    prepaymentAmount: "",
    remainingBalance: "",
    paymentDate: "",
    comment: "Prepayment",
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  function onDone() {
    toast.success("Prepayment recorded");
    setOpen(false);
  }
  function onFail(message?: string) {
    toast.error(message ?? "Could not save prepayment");
  }

  const { execute, isTransitioning } = useAction(saveLoanRepaymentAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });

  function onSubmit(values: FormValues) {
    const outstandingAfter =
      values.remainingBalance !== ""
        ? values.remainingBalance
        : "";

    execute({
      loanId,
      month: currentMonth,
      paymentDate: values.paymentDate,
      totalPayment: values.prepaymentAmount,
      principalPaid: values.prepaymentAmount,
      interestPaid: "",
      otherCharges: "",
      principalAdjustment: "",
      adjustmentReason: "",
      outstandingAfterPayment: outstandingAfter,
      comment: values.comment || "Prepayment",
    });
  }

  // Impact preview calculations
  const watchedAmount = form.watch("prepaymentAmount");
  const watchedBalance = form.watch("remainingBalance");
  const prepayPaise = MONEY_RE.test(watchedAmount)
    ? Math.round(Number(watchedAmount) * 100)
    : 0;
  const outstandingPaise = Math.round(currentOutstanding * 100);

  const afterPrepay =
    watchedBalance !== "" && MONEY_RE.test(watchedBalance)
      ? Math.round(Number(watchedBalance) * 100)
      : Math.max(0, outstandingPaise - prepayPaise);

  const showImpact = interestRate !== null && remainingTenure !== null && remainingTenure > 0;
  const currentEmi =
    showImpact ? computeEmi(paise(outstandingPaise), interestRate, remainingTenure) : 0;
  const newEmi =
    showImpact && prepayPaise > 0
      ? computeEmi(paise(afterPrepay), interestRate, remainingTenure)
      : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record prepayment</DialogTitle>
          <DialogDescription>
            {loanName} &middot; {currentMonth}
          </DialogDescription>
        </DialogHeader>

        {existingRepaymentThisMonth && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              An EMI of {existingAmount ?? "an amount"} is already recorded for{" "}
              {currentMonth}. This prepayment will replace it.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="prepaymentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prepayment amount (Rs)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="e.g. 200000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remainingBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remaining balance after prepayment</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="From bank statement (optional)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    If entered, this overrides the calculated balance and drives the revised
                    schedule.
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
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

            {/* Impact preview */}
            {showImpact && prepayPaise > 0 && (
              <div className="rounded-md border p-3 space-y-1 text-sm">
                <p className="font-medium text-muted-foreground">Estimated impact</p>
                <div className="flex justify-between">
                  <span>Current outstanding</span>
                  <span className="tabular-nums">{formatInrWhole(paise(outstandingPaise))}</span>
                </div>
                <div className="flex justify-between">
                  <span>After prepayment</span>
                  <span className="tabular-nums">{formatInrWhole(paise(afterPrepay))}</span>
                </div>
                <div className="flex justify-between">
                  <span>Current EMI</span>
                  <span className="tabular-nums">{formatInrWhole(paise(currentEmi))}</span>
                </div>
                <div className="flex justify-between">
                  <span>New EMI (est.)</span>
                  <span className="tabular-nums font-medium text-green-700 dark:text-green-400">
                    {formatInrWhole(paise(newEmi))}
                  </span>
                </div>
                {currentEmi > newEmi && (
                  <div className="flex justify-between text-green-700 dark:text-green-400">
                    <span>EMI reduction</span>
                    <span className="tabular-nums font-medium">
                      {formatInrWhole(paise(currentEmi - newEmi))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {!showImpact && (
              <p className="text-xs text-muted-foreground">
                Add interest rate and tenure to the loan to see EMI impact.
              </p>
            )}

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
