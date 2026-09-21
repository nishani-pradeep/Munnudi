"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
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
import { RentVersionDialog, type ExistingVersion } from "./rent-version-dialog";
import { deleteRentVersionAction } from "@/server/actions/settings";
import { formatInrWhole, parsePaise, type Paise } from "@/domain/money";
import { resolveCurrentMonth } from "@/lib/app-config";

type UnitOption = { id: string; unitCode: string };
type VersionRow = { id: string; unitId: string; effectiveMonth: string; expectedRent: string };

function currentRentForUnit(unitId: string, versions: VersionRow[]): Paise | null {
  const now = resolveCurrentMonth();
  const applicable = versions
    .filter((v) => v.unitId === unitId && v.effectiveMonth <= now)
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth));
  return applicable.length > 0 ? parsePaise(applicable[0].expectedRent) : null;
}

export function RentTab({ units, versions }: { units: UnitOption[]; versions: VersionRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(unitId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Rent configuration per unit
        </h3>
        <RentVersionDialog
          trigger={<Button size="sm"><Plus className="mr-1 h-4 w-4" />Set new rent</Button>}
          units={units}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Unit</TableHead>
              <TableHead>Current Rent</TableHead>
              <TableHead>Versions</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => {
              const unitVersions = versions.filter((v) => v.unitId === unit.id);
              const current = currentRentForUnit(unit.id, versions);
              const isExpanded = expanded.has(unit.id);

              return (
                <UnitRentRow
                  key={unit.id}
                  unit={unit}
                  units={units}
                  versions={unitVersions}
                  currentRent={current}
                  isExpanded={isExpanded}
                  onToggle={() => toggle(unit.id)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Rent carries forward automatically — a version set for a month applies to all
        future months until a new version is created. Use &quot;Set new rent&quot; for yearly increments.
      </p>
    </div>
  );
}

function UnitRentRow({
  unit,
  units,
  versions,
  currentRent,
  isExpanded,
  onToggle,
}: {
  unit: UnitOption;
  units: UnitOption[];
  versions: VersionRow[];
  currentRent: Paise | null;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow>
        <TableCell>
          {versions.length > 0 && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          )}
        </TableCell>
        <TableCell className="font-medium">{unit.unitCode}</TableCell>
        <TableCell>
          {currentRent !== null ? (
            <span className="font-mono">{formatInrWhole(currentRent)}</span>
          ) : (
            <span className="text-muted-foreground">Not set</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="secondary">{versions.length}</Badge>
        </TableCell>
        <TableCell>
          <RentVersionDialog
            trigger={
              <Button variant="ghost" size="sm">
                <Plus className="mr-1 h-3 w-3" />Set
              </Button>
            }
            units={units}
            existing={undefined}
          />
        </TableCell>
      </TableRow>
      {isExpanded &&
        versions.map((v) => (
          <VersionRow key={v.id} version={v} units={units} />
        ))}
    </>
  );
}

function VersionRow({ version, units }: { version: VersionRow; units: UnitOption[] }) {
  const { execute, isTransitioning } = useAction(deleteRentVersionAction, {
    onSuccess: () => toast.success("Rent version deleted"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not delete"),
  });

  const rent = parsePaise(version.expectedRent);

  return (
    <TableRow className="bg-muted/30">
      <TableCell />
      <TableCell className="text-xs text-muted-foreground pl-8">
        From {version.effectiveMonth}
      </TableCell>
      <TableCell>
        <span className="font-mono text-sm">{formatInrWhole(rent)}</span>
      </TableCell>
      <TableCell />
      <TableCell>
        <div className="flex items-center gap-1">
          <RentVersionDialog
            trigger={
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Edit version">
                <Pencil className="h-3 w-3" />
              </Button>
            }
            units={units}
            existing={version as ExistingVersion}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete version" disabled={isTransitioning}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this rent version?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the rent of {formatInrWhole(rent)} effective from{" "}
                  {version.effectiveMonth}. Future months will fall back to the previous version.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => execute({ versionId: version.id })}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
