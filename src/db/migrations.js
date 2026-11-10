
import db from './index.js';

/**
 * Run all pending migrations
 */
async function runMigrations() {
  try {
    const [batch, migrations] = await db.migrate.latest();

    if (migrations.length === 0) {
      console.log('Database is already up to date');
    } else {
      console.log(`Batch ${batch} run: ${migrations.length} migrations`);

      migrations.forEach((migration) => {
        console.log(`  - ${migration}`);
      });
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback the last batch of migrations
 */
async function rollbackMigrations() {
  try {
    const [batch, migrations] = await db.migrate.rollback();

    if (migrations.length === 0) {
      console.log('Already at the base migration');
    } else {
      console.log(`Batch ${batch} rolled back: ${migrations.length} migrations`);

      migrations.forEach((migration) => {
        console.log(`  - ${migration}`);
      });
    }
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
}

/**
 * Get migration status
 */
async function getMigrationStatus() {
  try {
    const [completed] = await db.migrate.list();

    console.log('Completed migrations:');

    completed.forEach((migration) => {
      console.log(`  ✓ ${migration}`);
    });

    return completed;
  } catch (error) {
    console.error('Failed to get migration status:', error);
    throw error;
  }
}

export {
  runMigrations,
  rollbackMigrations,
  getMigrationStatus,
};
