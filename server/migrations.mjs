import { randomBytes, scryptSync } from 'node:crypto';

// Reset inherited supplier minimums once. Later administrator choices survive restarts.
export function migrateMinimumQuantities(db) {
  const migration = 'minimum-order-quantity-one-v1';
  if (db.prepare('SELECT value FROM meta WHERE key=?').get(migration)) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    const previous = [];
    for (const row of db.prepare("SELECT id,data FROM records WHERE collection='products'").all()) {
      const product = JSON.parse(row.data);
      if ((product.minQuantity || 1) === 1) continue;
      previous.push({ id: row.id, minQuantity: product.minQuantity });
      db.prepare("UPDATE records SET data=? WHERE collection='products' AND id=?").run(
        JSON.stringify({ ...product, minQuantity: 1 }),
        row.id,
      );
    }
    // Keep the old limits in the migration record for recovery or audit.
    db.prepare('INSERT INTO meta (key,value) VALUES (?,?)').run(
      migration,
      JSON.stringify({ appliedAt: new Date().toISOString(), previous }),
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// Provision or update administrator credentials on startup.
export function migrateAdminCredentials(db) {
  const migration = 'admin-credentials-nishat-v1';
  if (db.prepare('SELECT value FROM meta WHERE key=?').get(migration)) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admins (email TEXT PRIMARY KEY, hash TEXT NOT NULL, salt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    const email = (process.env.ADMIN_EMAIL || 'nishatahmed0301@gmail.com').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'Musa8142@';
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');

    db.prepare(
      'INSERT INTO admins (email, hash, salt) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET hash=excluded.hash, salt=excluded.salt',
    ).run(email, hash, salt);

    if (email !== 'admin@powerplanet.local') {
      db.prepare('DELETE FROM admins WHERE email=?').run('admin@powerplanet.local');
    }

    db.prepare('DELETE FROM sessions WHERE email=?').run('admin@powerplanet.local');

    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(
      migration,
      JSON.stringify({ appliedAt: new Date().toISOString(), email }),
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

