import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { migrateMinimumQuantities, migrateAdminCredentials } from '../server/migrations.mjs';

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

test('administrator credentials migrate to configured admin and clean default local account', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE admins (email TEXT PRIMARY KEY, hash TEXT NOT NULL, salt TEXT NOT NULL);
      CREATE TABLE sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    db.prepare('INSERT INTO admins VALUES (?, ?, ?)').run('admin@powerplanet.local', 'oldhash', 'oldsalt');
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run('token123', 'admin@powerplanet.local', Date.now() + 10000);

    migrateAdminCredentials(db);

    const admins = db.prepare('SELECT email FROM admins').all();
    assert.equal(admins.length, 1);
    assert.equal(admins[0].email, 'nishatahmed0301@gmail.com');

    const sessions = db.prepare('SELECT token FROM sessions').all();
    assert.equal(sessions.length, 0);

    const meta = db.prepare('SELECT value FROM meta WHERE key=?').get('admin-credentials-nishat-v1');
    assert.ok(meta);
  } finally {
    db.close();
  }
});

