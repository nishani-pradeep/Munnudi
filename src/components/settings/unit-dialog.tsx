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
import { createUnitAction, updateUnitAction } from "@/server/actions/settings";

const formSchema = z.object({
  unitCode: z.string().trim().min(1, "Unit code is required").max(10),
  unitType: z.enum(["2BHK", "1BHK"]),
  defaultOccupancyStatus: z.enum(["SELF_OCCUPIED", "OCCUPIED", "VACANT"]),
  electricityUom: z.string().trim(),
  waterUom: z.string().trim(),
});

type FormValues = z.infer<typeof formSchema>;

export type ExistingUnit = {
  id: string;
  unitCode: string;
  unitType: string;
  defaultOccupancyStatus: string;
  electricityUom: string;
  waterUom: string;
};

type Props = { trigger: ReactNode; existing?: ExistingUnit };

export function UnitDialog({ trigger, existing }: Props) {
  const [open, setOpen] = useState(false);

  const defaults: FormValues = existing
    ? {
        unitCode: existing.unitCode,
        unitType: existing.unitType as FormValues["unitType"],
        defaultOccupancyStatus:
          existing.defaultOccupancyStatus as FormValues["defaultOccupancyStatus"],
        electricityUom: existing.electricityUom,
        waterUom: existing.waterUom,
      }
    : {
        unitCode: "",
        unitType: "2BHK",
        defaultOccupancyStatus: "OCCUPIED",
        electricityUom: "kWh",
        waterUom: "L",
      };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  function onDone() {
    toast.success(existing ? "Unit updated" : "Unit added");
    setOpen(false);
  }
  function onFail(message?: string) {
    toast.error(message ?? "Could not save unit");
  }

  const { execute: create, isTransitioning: creating } = useAction(createUnitAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });
  const { execute: update, isTransitioning: updating } = useAction(updateUnitAction, {
    onSuccess: onDone,
    onError: ({ error }) => onFail(error.serverError),
  });

  function onSubmit(values: FormValues) {
    if (existing) {
      update({ unitId: existing.id, ...values });
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
          <DialogTitle>{existing ? "Edit unit" : "Add unit"}</DialogTitle>
          <DialogDescription>
            {existing ? "Update unit details." : "Add a new unit to the property."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="unitCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. D1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitType"
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
                        <SelectItem value="2BHK">2BHK</SelectItem>
                        <SelectItem value="1BHK">1BHK</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="defaultOccupancyStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupancy status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="OCCUPIED">Occupied</SelectItem>
                      <SelectItem value="SELF_OCCUPIED">Self-occupied</SelectItem>
                      <SelectItem value="VACANT">Vacant</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="electricityUom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Electricity UOM</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="waterUom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Water UOM</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
