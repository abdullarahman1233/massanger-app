/**
 * Database seed script
 * Creates sample test accounts and demo data
 * 
 * Run with: npm run seed
 * 
 * Test accounts:
 *   admin@messenger.local  / Admin1234!
 *   alice@messenger.local  / Alice1234!
 *   bob@messenger.local    / Bob1234!
 */
import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'messenger',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create test users
    const users = [
      { id: uuidv4(), email: 'admin@messenger.local', password: 'Admin1234!', name: 'Admin User', role: 'admin' },
      { id: uuidv4(), email: 'alice@messenger.local', password: 'Alice1234!', name: 'Alice Johnson', role: 'user' },
      { id: uuidv4(), email: 'bob@messenger.local', password: 'Bob1234!', name: 'Bob Smith', role: 'user' },
      { id: uuidv4(), email: 'carol@messenger.local', password: 'Carol1234!', name: 'Carol Williams', role: 'user' },
    ];

    const userIds: Record<string, string> = {};

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 12);
      await client.query(
        `INSERT INTO users (id, email, password_hash, display_name, role, is_active, status)
         VALUES ($1, $2, $3, $4, $5, true, 'offline')
         ON CONFLICT (email) DO UPDATE SET display_name = $4`,
        [u.id, u.email, hash, u.name, u.role]
      );
      // Re-fetch ID in case of conflict
      const result = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [u.email]);
      userIds[u.email] = result.rows[0].id;
      console.log(`✓ User: ${u.email} / ${u.password}`);
    }

    // Create a direct message room between Alice and Bob
    const directRoomId = uuidv4();
    await client.query(
      `INSERT INTO rooms (id, type, created_by) VALUES ($1, 'direct', $2) ON CONFLICT DO NOTHING`,
      [directRoomId, userIds['alice@messenger.local']]
    );
    for (const email of ['alice@messenger.local', 'bob@messenger.local']) {
      await client.query(
        `INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [directRoomId, userIds[email]]
      );
    }

    // Create a group room
    const groupRoomId = uuidv4();
    await client.query(
      `INSERT INTO rooms (id, type, name, created_by) VALUES ($1, 'group', 'Team Chat', $2) ON CONFLICT DO NOTHING`,
      [groupRoomId, userIds['admin@messenger.local']]
    );
    for (const email of Object.keys(userIds)) {
      await client.query(
        `INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [groupRoomId, userIds[email], email === 'admin@messenger.local' ? 'admin' : 'member']
      );
    }

    // Seed sample messages
    const msgs = [
      { room: directRoomId, sender: 'alice@messenger.local', content: 'Hey Bob! How are you?' },
      { room: directRoomId, sender: 'bob@messenger.local', content: 'Doing great, thanks Alice! Ready to test this messenger?' },
      { room: directRoomId, sender: 'alice@messenger.local', content: 'Absolutely! The real-time messaging works great 🎉' },
      { room: groupRoomId, sender: 'admin@messenger.local', content: 'Welcome to Team Chat everyone!' },
      { room: groupRoomId, sender: 'alice@messenger.local', content: 'Thanks! Excited to be here.' },
      { room: groupRoomId, sender: 'bob@messenger.local', content: 'Great setup, looking forward to working together.' },
    ];

    for (const msg of msgs) {
      const msgId = uuidv4();
      await client.query(
        `INSERT INTO messages (id, room_id, sender_id, content, status)
         VALUES ($1, $2, $3, $4, 'read')`,
        [msgId, msg.room, userIds[msg.sender], msg.content]
      );
    }

    // Update room last_message_at
    await client.query(
      `UPDATE rooms SET last_message_at = NOW() WHERE id IN ($1, $2)`,
      [directRoomId, groupRoomId]
    );

    await client.query('COMMIT');
    console.log('\n✓ Seed complete!');
    console.log('  Direct room ID:', directRoomId);
    console.log('  Group room ID:', groupRoomId);
    console.log('\nTest accounts:');
    users.forEach(u => console.log(`  ${u.email} / ${u.password}`));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
