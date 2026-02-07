/**
 * Reset Database
 *
 * Truncates all indexer tables. Needed because Anvil restarts lose all
 * blockchain state, but PostgreSQL persists stale data from previous runs.
 *
 * Usage:
 *   npm run reset-db
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function reset() {
  console.log('[ResetDB] Clearing all indexer tables...');

  await prisma.$transaction([
    prisma.userShareLot.deleteMany(),
    prisma.userTransaction.deleteMany(),
    prisma.userPosition.deleteMany(),
    prisma.yieldEvent.deleteMany(),
    prisma.poolStateSnapshot.deleteMany(),
    prisma.sharePriceSnapshot.deleteMany(),
    prisma.indexerState.deleteMany(),
  ]);

  console.log('[ResetDB] All tables cleared successfully');
}

reset()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('[ResetDB] Error:', error);
    prisma.$disconnect();
    process.exit(1);
  });
