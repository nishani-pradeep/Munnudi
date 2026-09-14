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
import { createExpenseAction, updateExpenseAction } from "@/server/actions/expenses";
import type { MonthKey } from "@/domain/month";

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

const formSchema = z.object({
  categoryId: z.string().uuid("Choose a category"),
  unitId: z.string(),
  expenseDate: z.string().trim(),
  amount: z
    .string()
    .trim()
    .refine((v) => MONEY_RE.test(v), "Enter a valid amount, e.g. 500 or 499.99"),
  comment: z.string().trim().max(500, "Keep comments under 500 characters"),
});

type FormValues = z.infer<typeof formSchema>;

type Category = { id: string; name: string };
type Unit = { id: string; unitCode: string };

type Props = {
  month: MonthKey;
  categories: Category[];
  units: Unit[];
  trigger: ReactNode;
  /** When present, edits this expense instead of creating a new one. */
  existing?: {
    id: string;
    categoryId: string;
    unitId: string | null;
    expenseDate: string | null;
    amount: string;
    comment: string | null;
  };
};

export function ExpenseDialog({ month, categories, units, trigger, existing }: Props) {
  const [open, setOpen] = useState(false);

  const defaults: FormValues = existing
    ? {
        categoryId: existing.categoryId,
        unitId: existing.unitId ?? "none",
        expenseDate: existing.expenseDate ?? "",
        amount: existing.amount.replace(/\.00$/, ""),
        comment: existing.comment ?? "",
      }
    : {
        categoryId: categories[0]?.id ?? "",
        unitId: "none",
        expenseDate: "",
        amount: "",
        comment: "",
      };

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults });

  function onDone() {
    toast.success(existing ? "Expense updated" : "Expense added");
    setOpen(false);
  }
  function onFail(message?: string) {
    toast.error(message ?? "Could not save expense");
  }

  const { execute: create, isTransitioning: creating } = useAction(createExpenseAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });
  const { execute: update, isTransitioning: updating } = useAction(updateExpenseAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });

  function onSubmit(values: FormValues) {
    const unitId = values.unitId === "none" ? "" : values.unitId;
    if (existing) {
      update({ expenseId: existing.id, ...values, unitId });
    } else {
      create({ month, ...values, unitId });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>Property or common expense for this month.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
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
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (Rs)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 850" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expenseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="unitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allocate to a unit (optional)</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Property-wide / common</SelectItem>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.unitCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
