// Run with: npx tsx scripts/check-facilities.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const facilities = await prisma.facility.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      openTime: true,
      closeTime: true,
      active: true,
    },
  });

  console.log('\n=== FACILITY OPERATING HOURS ===\n');
  
  for (const f of facilities) {
    console.log(`📍 ${f.name} (${f.type})`);
    console.log(`   Active: ${f.active}`);
    console.log(`   Open Time: ${f.openTime ?? 'NULL (will default to 08:00)'}`);
    console.log(`   Close Time: ${f.closeTime ?? 'NULL (will default to 22:00)'}`);
    console.log('');
  }

  // Check for problematic facilities
  const problematic = facilities.filter(f => 
    f.openTime === '00:00' || 
    f.closeTime === '00:00' ||
    f.openTime === null ||
    f.closeTime === null
  );

  if (problematic.length > 0) {
    console.log('⚠️  FACILITIES WITH MISSING OR MIDNIGHT TIMES:');
    for (const f of problematic) {
      console.log(`   - ${f.name}: open=${f.openTime}, close=${f.closeTime}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
