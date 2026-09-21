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
import { createCategoryAction, updateCategoryAction } from "@/server/actions/settings";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  isMaintenance: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export type ExistingCategory = {
  id: string;
  name: string;
  isMaintenance: boolean;
};

type Props = { trigger: ReactNode; existing?: ExistingCategory };

export function CategoryDialog({ trigger, existing }: Props) {
  const [open, setOpen] = useState(false);

  const defaults: FormValues = existing
    ? { name: existing.name, isMaintenance: existing.isMaintenance }
    : { name: "", isMaintenance: true };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  function onDone() {
    toast.success(existing ? "Category updated" : "Category added");
    setOpen(false);
  }
  function onFail(message?: string) {
    toast.error(message ?? "Could not save category");
  }

  const { execute: create, isTransitioning: creating } = useAction(createCategoryAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });
  const { execute: update, isTransitioning: updating } = useAction(updateCategoryAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });

  function onSubmit(values: FormValues) {
    if (existing) {
      update({ categoryId: existing.id, ...values });
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
          <DialogTitle>{existing ? "Edit category" : "Add category"}</DialogTitle>
          <DialogDescription>
            {existing
              ? "Update the expense category."
              : "Add a new expense category for this property."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Plumbing" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isMaintenance"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-md border p-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Maintenance expense</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Maintenance expenses are deducted from rental income in Operating Profit.
                      Changing this reinterprets historical figures.
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
