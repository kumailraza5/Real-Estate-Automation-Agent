import { db, tasksTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

async function test() {
  const [existing] = await db.select().from(tasksTable).where(eq(tasksTable.id, 44));
  console.log('existing.status:', existing.status);
  console.log('existing keys:', Object.keys(existing));
}
test().catch(console.error).finally(() => process.exit(0));
