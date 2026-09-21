"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  createRentVersionAction,
  updateRentVersionAction,
} from "@/server/actions/settings";
import { MonthPicker } from "@/components/month-picker";

const MONEY_RE = /^\d+(\.\d{1,2})?$/;

const formSchema = z.object({
  unitId: z.string().uuid("Select a unit"),
  effectiveMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month"),
  expectedRent: z
    .string()
    .trim()
    .refine((v) => MONEY_RE.test(v), "Enter a valid amount"),
});

type FormValues = z.infer<typeof formSchema>;

type UnitOption = { id: string; unitCode: string };

export type ExistingVersion = {
  id: string;
  unitId: string;
  effectiveMonth: string;
  expectedRent: string;
};

type Props = {
  trigger: ReactNode;
  units: UnitOption[];
  existing?: ExistingVersion;
};

export function RentVersionDialog({ trigger, units, existing }: Props) {
  const [open, setOpen] = useState(false);

  const defaults: FormValues = existing
    ? {
        unitId: existing.unitId,
        effectiveMonth: existing.effectiveMonth,
        expectedRent: existing.expectedRent.replace(/\.00$/, ""),
      }
    : {
        unitId: units[0]?.id ?? "",
        effectiveMonth: "",
        expectedRent: "",
      };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  function onDone() {
    toast.success(existing ? "Rent updated" : "Rent version added");
    setOpen(false);
  }
  function onFail(message?: string) {
    toast.error(message ?? "Could not save rent version");
  }

  const { execute: create, isTransitioning: creating } = useAction(createRentVersionAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });
  const { execute: update, isTransitioning: updating } = useAction(updateRentVersionAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });

  function onSubmit(values: FormValues) {
    if (existing) {
      update({ versionId: existing.id, effectiveMonth: values.effectiveMonth, expectedRent: values.expectedRent });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit rent version" : "Set new rent"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Update the rent amount or effective month."
              : "Set a new expected rent effective from a specific month. Previous months keep their rent."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="unitId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!!existing}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="effectiveMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective from</FormLabel>
                    <FormControl>
                      <MonthPicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedRent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected rent (Rs)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="e.g. 15000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
