import { v4 as uuid } from 'uuid';
import { all, exec, first } from './index';
import { Role, User, UUID } from '@/types';

export async function listUsers(): Promise<User[]> {
  const rows = await all<any>('SELECT * FROM users ORDER BY name');
  return rows.map(rowToUser);
}

export async function getUser(id: UUID): Promise<User | null> {
  const r = await first<any>('SELECT * FROM users WHERE id = ?', [id]);
  return r ? rowToUser(r) : null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const r = await first<any>('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  return r ? rowToUser(r) : null;
}

export async function createUser(
  data: { name: string; email: string; role: Role; pinHash?: string }
): Promise<User> {
  const id = uuid();
  const now = new Date().toISOString();
  await exec(
    'INSERT INTO users (id, name, email, role, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, data.name, data.email.toLowerCase(), data.role, data.pinHash ?? null, now]
  );
  return { id, name: data.name, email: data.email.toLowerCase(), role: data.role, pinHash: data.pinHash, createdAt: now };
}

function rowToUser(r: any): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    pinHash: r.pin_hash,
    createdAt: r.created_at,
  };
}
