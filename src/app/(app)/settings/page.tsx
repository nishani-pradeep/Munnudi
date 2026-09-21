import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getActiveProperty } from "@/server/db/scope";
import { listAllUnits } from "@/server/db/repositories/units";
import { listRentVersionsForProperty } from "@/server/db/repositories/unit-rent-versions";
import { listAllCategories } from "@/server/db/repositories/expenses";
import { PropertyForm } from "@/components/settings/property-form";
import { UnitsTab } from "@/components/settings/units-tab";
import { RentTab } from "@/components/settings/rent-tab";
import { CategoriesTab } from "@/components/settings/categories-tab";

export default async function Page() {
  const property = await getActiveProperty();
  const [allUnits, rentVersions, categories] = await Promise.all([
    listAllUnits(property.id),
    listRentVersionsForProperty(property.id),
    listAllCategories(property.id),
  ]);

  const activeUnits = allUnits
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, unitCode: u.unitCode }));

  return (
    <>
      <PageHeader
        title="Settings"
        description="Property, units, rent and expense category configuration"
      />

      <Tabs defaultValue="property">
        <TabsList variant="line">
          <TabsTrigger value="property">Property</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="rent">Rent</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="property" className="mt-4">
          <PropertyForm property={property} />
        </TabsContent>

        <TabsContent value="units" className="mt-4">
          <UnitsTab units={allUnits} />
        </TabsContent>

        <TabsContent value="rent" className="mt-4">
          <RentTab units={activeUnits} versions={rentVersions} />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab categories={categories} />
        </TabsContent>
      </Tabs>
    </>
  );
}
