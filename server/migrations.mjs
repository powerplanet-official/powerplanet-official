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
