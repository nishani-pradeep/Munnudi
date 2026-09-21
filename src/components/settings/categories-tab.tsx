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
import { CategoryDialog, type ExistingCategory } from "./category-dialog";
import { deactivateCategoryAction } from "@/server/actions/settings";

type CategoryRow = {
  id: string;
  name: string;
  isMaintenance: boolean;
  active: boolean;
};

export function CategoriesTab({ categories }: { categories: CategoryRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
        </h3>
        <CategoryDialog
          trigger={<Button size="sm"><Plus className="mr-1 h-4 w-4" />Add category</Button>}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Maintenance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <CategoryRow key={cat.id} category={cat} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CategoryRow({ category }: { category: CategoryRow }) {
  const { execute, isTransitioning } = useAction(deactivateCategoryAction, {
    onSuccess: () => toast.success(`${category.name} deactivated`),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not deactivate"),
  });

  return (
    <TableRow className={category.active ? "" : "opacity-50"}>
      <TableCell className="font-medium">{category.name}</TableCell>
      <TableCell>
        <Badge variant={category.isMaintenance ? "default" : "secondary"}>
          {category.isMaintenance ? "Yes" : "No"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={category.active ? "default" : "secondary"}>
          {category.active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <CategoryDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit category">
                <Pencil className="h-4 w-4" />
              </Button>
            }
            existing={category as ExistingCategory}
          />
          {category.active && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Deactivate category" disabled={isTransitioning}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate &quot;{category.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This category will be hidden from new expense entries.
                    Existing expenses under this category are preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => execute({ categoryId: category.id })}>
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
