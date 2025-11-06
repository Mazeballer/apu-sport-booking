import { prisma } from '@/lib/prisma';
import { requireStaffOrAdmin } from '@/lib/authz';
import { EquipmentManagement } from '@/components/admin/equipment-management';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  await requireStaffOrAdmin();

  const [facilities, equipment] = await Promise.all([
    prisma.facility.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.equipment.findMany({
      select: {
        id: true,
        name: true,
        qtyTotal: true,
        qtyAvailable: true,
        facilityId: true,
        facility: { select: { name: true } },
      },
      orderBy: [{ name: 'asc' }],
    }),
  ]);

  // Massage into the shape your component expects
  const facilitiesProp = facilities.map((f) => ({ id: f.id, name: f.name }));
  const equipmentProp = equipment.map((e) => ({
    id: e.id,
    name: e.name,
    facilityId: e.facilityId,
    qtyTotal: e.qtyTotal,
    qtyAvailable: e.qtyAvailable,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <EquipmentManagement
          facilities={facilitiesProp}
          equipment={equipmentProp}
        />
      </CardContent>
    </Card>
  );
}
