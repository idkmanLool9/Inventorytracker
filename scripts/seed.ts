/**
 * CLI seed script. Run with:
 *   npm run seed
 *
 * Note: this script targets the Node test environment, NOT the Expo app's
 * SQLite database. Use it for local data exploration or for integration with
 * a future Node-backed mirror. From within the app, you can call
 * `seedDummyData()` directly from `src/db/seed.ts`.
 */
import { seedDummyData } from '../src/db/seed';
import { runMigrations } from '../src/db/migrations';

async function main() {
  await runMigrations();
  const out = await seedDummyData(50);
  // eslint-disable-next-line no-console
  console.log(`Geseed: ${out.products} producten, ${out.locations} locaties`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
