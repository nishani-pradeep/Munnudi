"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { updatePropertyAction } from "@/server/actions/settings";
import type { ActiveProperty } from "@/server/db/scope";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  timezone: z.string().trim().min(1, "Timezone is required"),
  trackingStartMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Invalid month"),
  includeSelfOccupiedInTarget: z.boolean(),
  countVacantInTarget: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export function PropertyForm({ property }: { property: ActiveProperty }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: property.name,
      timezone: property.timezone,
      trackingStartMonth: property.trackingStartMonth,
      includeSelfOccupiedInTarget: property.includeSelfOccupiedInTarget,
      countVacantInTarget: property.countVacantInTarget,
    },
  });

  const { execute, isTransitioning } = useAction(updatePropertyAction, {
    onSuccess: () => toast.success("Property updated"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not update property"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(execute)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Input value={property.currency} disabled />
                <p className="text-xs text-muted-foreground">
                  Currency cannot be changed after creation.
                </p>
              </FormItem>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <FormControl>
                      <Input placeholder="Asia/Kolkata" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trackingStartMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tracking start month</FormLabel>
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
              name="includeSelfOccupiedInTarget"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-md border p-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Include self-occupied in rental target</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Count self-occupied units when calculating target rental income.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="countVacantInTarget"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 rounded-md border p-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Count vacant units in rental target</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Include vacant units when calculating expected rental income.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isTransitioning}>
              {isTransitioning ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
