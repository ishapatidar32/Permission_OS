import { db, hashToken } from '../apps/gateway/src/db';
import { DEMO_ORDERS } from '@permissionos/shared';

export async function seedDemoData(): Promise<void> {
  console.log('🌱 Seeding PermissionOS SQLite database...');

  // 1. Clean existing records for clean demo state
  db.exec(`
    DELETE FROM audit_events;
    DELETE FROM approvals;
    DELETE FROM applied_actions;
    DELETE FROM api_keys;
    DELETE FROM orders;
    DELETE FROM users;
  `);

  const now = new Date().toISOString();

  // 2. Seed Users
  const insertUser = db.prepare(
    'INSERT INTO users (id, display_name, role, active) VALUES (?, ?, ?, 1)'
  );
  insertUser.run('usr_op_alexa', 'Alexa Assistant Simulator (Operator)', 'operator');
  insertUser.run('usr_op_dispatch', 'Dispatch Center Operator', 'operator');
  insertUser.run('usr_approver_sarah', 'Sarah Approver (Ops Supervisor)', 'approver');
  insertUser.run('usr_admin_master', 'Admin Master', 'admin');

  // 3. Seed API Keys for authentic Bearer tokens
  const insertApiKey = db.prepare(
    'INSERT INTO api_keys (id, actor_id, token_hash, label) VALUES (?, ?, ?, ?)'
  );
  insertApiKey.run('key_op_1', 'usr_op_alexa', hashToken('demo-operator-token'), 'Alexa Simulator Bearer Token');
  insertApiKey.run('key_op_2', 'usr_op_dispatch', hashToken('demo-dispatch-token'), 'Dispatch Operator Token');
  insertApiKey.run('key_appr_1', 'usr_approver_sarah', hashToken('demo-approver-token'), 'Sarah Supervisor Token');
  insertApiKey.run('key_admin_1', 'usr_admin_master', hashToken('demo-admin-token'), 'Master Admin Token');

  // 4. Seed Synthetic Orders (including primary order 1042)
  const insertOrder = db.prepare(
    'INSERT INTO orders (id, customer_name, address, status, version, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertOrder.run(
    DEMO_ORDERS.PRIMARY_ORDER_ID,
    'Aarav Sharma',
    DEMO_ORDERS.INITIAL_ADDRESS,
    DEMO_ORDERS.INITIAL_STATUS,
    1,
    now
  );
  insertOrder.run(
    '1043',
    'Priya Patel',
    '88 Tech City, Bengaluru',
    'Processing',
    1,
    now
  );
  insertOrder.run(
    '1044',
    'Rohan Verma',
    '19 Civil Lines, Delhi',
    'Delivered',
    1,
    now
  );

  console.log('✅ Users seeded: 2 operators, 1 approver, 1 admin');
  console.log('✅ API Keys seeded for token-based MCP authentication');
  console.log(`✅ Orders seeded: ${DEMO_ORDERS.PRIMARY_ORDER_ID} at "${DEMO_ORDERS.INITIAL_ADDRESS}" (Out for delivery)`);
  console.log('🎉 Demo data seeded successfully.');
}

if (require.main === module) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to seed:', err);
      process.exit(1);
    });
}
