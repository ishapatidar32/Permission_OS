import { seedDemoData } from './seed-demo';
import { upstreamOrderStore } from '../apps/demo-upstream/src/orders/db';

export async function resetDemo(): Promise<void> {
  console.log('🔄 Resetting PermissionOS Demo State...');
  upstreamOrderStore.seedDefaults();
  await seedDemoData();
  console.log('✨ Demo reset complete.');
}

if (require.main === module) {
  resetDemo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to reset demo:', err);
      process.exit(1);
    });
}
