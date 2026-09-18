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
import { saveLoanRepaymentAction } from "@/server/actions/loans";

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

const formSchema = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  totalPayment: z
    .string()
    .trim()
    .refine((v) => MONEY_RE.test(v) && Number(v) > 0, "Total payment must be greater than 0"),
  principalPaid: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  interestPaid: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  otherCharges: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  outstandingAfterPayment: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  principalAdjustment: z
    .string()
    .trim()
    .refine((v) => v === "" || /^-?\d+(\.\d{1,2})?$/.test(v), "Invalid amount"),
  adjustmentReason: z.string().trim().max(500).optional(),
  comment: z.string().trim().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export type Prefill = {
  totalPayment?: string;
  principalPaid?: string;
  interestPaid?: string;
};

export type ExistingRepayment = {
  paymentDate: string;
  totalPayment: string;
  principalPaid: string;
  interestPaid: string;
  otherCharges: string;
  outstandingAfterPayment: string | null;
  principalAdjustment: string;
  adjustmentReason: string | null;
  comment: string | null;
};

type Props = {
  loanId: string;
  loanName: string;
  month: string;
  trigger: ReactNode;
  prefill?: Prefill;
  existing?: ExistingRepayment;
};

export function RepaymentDialog({ loanId, loanName, month, trigger, prefill, existing }: Props) {
  const [open, setOpen] = useState(false);

  const defaults: FormValues = existing
    ? {
        paymentDate: existing.paymentDate,
        totalPayment: existing.totalPayment.replace(/\.00$/, ""),
        principalPaid: existing.principalPaid.replace(/\.00$/, ""),
        interestPaid: existing.interestPaid.replace(/\.00$/, ""),
        otherCharges: existing.otherCharges.replace(/\.00$/, ""),
        outstandingAfterPayment: existing.outstandingAfterPayment?.replace(/\.00$/, "") ?? "",
        principalAdjustment: existing.principalAdjustment.replace(/\.00$/, ""),
        adjustmentReason: existing.adjustmentReason ?? "",
        comment: existing.comment ?? "",
      }
    : {
        paymentDate: "",
        totalPayment: prefill?.totalPayment?.replace(/\.00$/, "") ?? "",
        principalPaid: prefill?.principalPaid?.replace(/\.00$/, "") ?? "",
        interestPaid: prefill?.interestPaid?.replace(/\.00$/, "") ?? "",
        otherCharges: "",
        outstandingAfterPayment: "",
        principalAdjustment: "",
        adjustmentReason: "",
        comment: "",
      };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  function onDone() {
    toast.success(existing ? "Repayment updated" : "Repayment recorded");
    setOpen(false);
  }
  function onFail(message?: string) {
    toast.error(message ?? "Could not save repayment");
  }

  const { execute, isTransitioning } = useAction(saveLoanRepaymentAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });

  function onSubmit(values: FormValues) {
    execute({
      loanId,
      month,
      ...values,
      adjustmentReason: values.adjustmentReason ?? "",
      comment: values.comment ?? "",
    });
  }

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
          <DialogTitle>{existing ? "Edit repayment" : "Record repayment"}</DialogTitle>
          <DialogDescription>
            {loanName} &middot; {month}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
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
                name="totalPayment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total payment (Rs)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 22450" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="principalPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Principal</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="interestPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="otherCharges"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other charges</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="outstandingAfterPayment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Outstanding after</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="From statement" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
