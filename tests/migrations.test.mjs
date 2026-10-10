import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { migrateMinimumQuantities } from '../server/migrations.mjs';

test('existing bulk minimums reset to one once; future admin limits survive', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(
      'CREATE TABLE records (collection TEXT,id TEXT,data TEXT,PRIMARY KEY(collection,id)); CREATE TABLE meta (key TEXT PRIMARY KEY,value TEXT);',
    );
    const put = db.prepare('INSERT OR REPLACE INTO records VALUES (?,?,?)');
    put.run(
      'products',
      'panel',
      JSON.stringify({ id: 'panel', minQuantity: 20, stock: 7, price: 30000 }),
    );
    put.run('orders', 'old-order', JSON.stringify({ id: 'old-order', quantity: 20 }));
    migrateMinimumQuantities(db);
    const read = () =>
      JSON.parse(db.prepare("SELECT data FROM records WHERE collection='products'").get().data);
    assert.deepEqual(read(), { id: 'panel', minQuantity: 1, stock: 7, price: 30000 });
    const audit = JSON.parse(db.prepare('SELECT value FROM meta').get().value);
    assert.deepEqual(audit.previous, [{ id: 'panel', minQuantity: 20 }]);
    put.run('products', 'panel', JSON.stringify({ ...read(), minQuantity: 4 }));
    migrateMinimumQuantities(db);
    assert.equal(read().minQuantity, 4);
    assert.equal(
      JSON.parse(db.prepare("SELECT data FROM records WHERE collection='orders'").get().data)
        .quantity,
      20,
    );
  } finally {
    db.close();
  }
});
