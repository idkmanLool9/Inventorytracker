import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '@/types';
import { findUserByEmail, getUser, listUsers, createUser } from '@/db/users';

const SESSION_KEY = 'session_user_id';

interface AuthState {
  user: User | null;
  loading: boolean;
  restoreSession: () => Promise<void>;
  signIn: (email: string) => Promise<User | null>;
  signOut: () => Promise<void>;
  bootstrapOwnerIfEmpty: () => Promise<User | null>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  restoreSession: async () => {
    const id = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null);
    if (!id) {
      await bootstrapIfNeeded(set);
      return;
    }
    const user = await getUser(id);
    if (user) set({ user });
    else await bootstrapIfNeeded(set);
  },
  signIn: async (email: string) => {
    const user = await findUserByEmail(email);
    if (!user) return null;
    await SecureStore.setItemAsync(SESSION_KEY, user.id);
    set({ user });
    return user;
  },
  signOut: async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY).catch(() => undefined);
    set({ user: null });
  },
  bootstrapOwnerIfEmpty: async () => {
    const users = await listUsers();
    if (users.length > 0) return null;
    const owner = await createUser({
      name: 'Eigenaar',
      email: 'owner@local',
      role: 'owner',
    });
    await SecureStore.setItemAsync(SESSION_KEY, owner.id);
    set({ user: owner });
    return owner;
  },
}));

async function bootstrapIfNeeded(set: (s: Partial<AuthState>) => void) {
  const users = await listUsers();
  if (users.length === 0) {
    const owner = await createUser({ name: 'Eigenaar', email: 'owner@local', role: 'owner' });
    await SecureStore.setItemAsync(SESSION_KEY, owner.id);
    set({ user: owner });
  } else {
    // Auto-pick first user in dev so the app is usable without a login screen.
    await SecureStore.setItemAsync(SESSION_KEY, users[0].id);
    set({ user: users[0] });
  }
}

/** Role-based capability helper used by screens. */
export function canEditProducts(user: User | null): boolean {
  return user?.role === 'owner' || user?.role === 'manager';
}

export function canSeeFinancials(user: User | null): boolean {
  return user?.role === 'owner';
}
