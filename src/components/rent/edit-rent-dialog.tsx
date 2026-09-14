"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import { saveRentAction } from "@/server/actions/rent";
import type { MonthRow } from "@/server/db/repositories/unit-month-records";

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

const formSchema = z.object({
  paidAmount: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), {
      message: "Enter a valid amount, e.g. 12000 or 12000.50",
    }),
  paymentDate: z.string().trim(),
  comment: z.string().trim().max(500, "Keep comments under 500 characters"),
});

type FormValues = z.infer<typeof formSchema>;

/** paise (numeric string) -> plain "12000" or "12000.50" for the input field. */
function toRupeeInput(numericString: string | null): string {
  if (numericString === null) return "";
  return numericString.replace(/\.00$/, "");
}

export function EditRentDialog({ row, expectedLabel }: { row: MonthRow; expectedLabel: string }) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paidAmount: toRupeeInput(row.paidAmount),
      paymentDate: row.paymentDate ?? "",
      comment: row.comment ?? "",
    },
  });

  const { execute, isTransitioning } = useAction(saveRentAction, {
    onSuccess: () => {
      toast.success(`${row.unitCode} rent saved`);
      setOpen(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Could not save rent");
    },
  });

  function onSubmit(values: FormValues) {
    execute({ recordId: row.id, ...values });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next)
          form.reset({
            paidAmount: toRupeeInput(row.paidAmount),
            paymentDate: row.paymentDate ?? "",
            comment: row.comment ?? "",
          });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${row.unitCode} rent`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{row.unitCode} rent</DialogTitle>
          <DialogDescription>Expected {expectedLabel} for this month.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="paidAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid amount (Rs)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="e.g. 15000" {...field} />
                  </FormControl>
                  <FormMessage />
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
