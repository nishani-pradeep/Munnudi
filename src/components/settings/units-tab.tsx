"use client";

import { Pencil, Plus, XCircle } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UnitDialog, type ExistingUnit } from "./unit-dialog";
import { deactivateUnitAction } from "@/server/actions/settings";

type UnitRow = {
  id: string;
  unitCode: string;
  unitType: string;
  defaultOccupancyStatus: string;
  electricityUom: string;
  waterUom: string;
  active: boolean;
};

export function UnitsTab({ units }: { units: UnitRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {units.length} unit{units.length !== 1 ? "s" : ""}
        </h3>
        <UnitDialog trigger={<Button size="sm"><Plus className="mr-1 h-4 w-4" />Add unit</Button>} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Occupancy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => (
              <UnitRow key={unit.id} unit={unit} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UnitRow({ unit }: { unit: UnitRow }) {
  const { execute, isTransitioning } = useAction(deactivateUnitAction, {
    onSuccess: () => toast.success(`${unit.unitCode} deactivated`),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not deactivate"),
  });

  const occupancyLabel: Record<string, string> = {
    SELF_OCCUPIED: "Self-occupied",
    OCCUPIED: "Occupied",
    VACANT: "Vacant",
  };

  return (
    <TableRow className={unit.active ? "" : "opacity-50"}>
      <TableCell className="font-medium">{unit.unitCode}</TableCell>
      <TableCell>{unit.unitType}</TableCell>
      <TableCell>{occupancyLabel[unit.defaultOccupancyStatus] ?? unit.defaultOccupancyStatus}</TableCell>
      <TableCell>
        <Badge variant={unit.active ? "default" : "secondary"}>
          {unit.active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <UnitDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit unit">
                <Pencil className="h-4 w-4" />
              </Button>
            }
            existing={unit as ExistingUnit}
          />
          {unit.active && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Deactivate unit" disabled={isTransitioning}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate {unit.unitCode}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This unit will be excluded from future rent and utility tracking.
                    Existing records are preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => execute({ unitId: unit.id })}>
                    Deactivate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
