/**
 * Presentation Layer - React Hooks
 * Custom hooks for state management
 */

import { useState, useEffect, useCallback } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { Unsubscribe } from 'firebase/firestore';
import { Transaction, Reminder, Category, Budget } from '../../domain/entities';
import { TransactionFilter, createEmptyFilter } from '../../domain/value-objects';
import { BalanceService, CategoryService, TransactionFilterService } from '../../domain/services';
import { BalanceSummary, CategorySummary } from '../../domain/services';
import { getFirebaseAuth, getGoogleProvider } from '../../infrastructure/firebase/config';
import {
  FirebaseTransactionRepository,
  FirebaseReminderRepository,
  FirebaseCategoryRepository,
  FirebaseBudgetRepository,
  FirebaseUserRepository,
} from '../../infrastructure/repositories/firebase';

// ============================================================
// AUTH HOOK
// ============================================================

export interface UseAuthReturn {
  user: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (currUser) => {
      setUser(currUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async () => {
    try {
      setError(null);
      const auth = getFirebaseAuth();
      const provider = getGoogleProvider();
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      console.error('Login error:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

  return { user, loading, error, login, logout };
}

// ============================================================
// TRANSACTIONS HOOK
// ============================================================

export interface UseTransactionsReturn {
  transactions: Transaction[];
  filteredTransactions: Transaction[];
  loading: boolean;
  error: string | null;
  balance: BalanceSummary;
  categories: CategorySummary[];
  uniqueCategories: string[];
  filters: TransactionFilter;
  setFilters: (filters: TransactionFilter) => void;
  addTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export function useTransactions(userId: string | undefined): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilter>(createEmptyFilter());

  const repository = new FirebaseTransactionRepository();

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = repository.subscribe(userId, (data) => {
      setTransactions(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const filteredTransactions = TransactionFilterService.filter(transactions, filters);
  const balance = BalanceService.calculate(transactions);
  const categories = CategoryService.aggregateByCategory(transactions, 'expense');
  const uniqueCategories = CategoryService.getUniqueCategories(transactions);

  const addTransaction = useCallback(
    async (data: Omit<Transaction, 'id' | 'createdAt'>) => {
      if (!userId) return;
      try {
        await repository.create(userId, data as any);
      } catch (err) {
        setError('Failed to add transaction');
        console.error(err);
      }
    },
    [userId]
  );

  const deleteTransaction = useCallback(async (id: string) => {
    if (!userId) return;
    try {
      await repository.delete(userId, id);
    } catch (err) {
      setError('Failed to delete transaction');
      console.error(err);
    }
  }, [userId]);

  return {
    transactions,
    filteredTransactions,
    loading,
    error,
    balance,
    categories,
    uniqueCategories,
    filters,
    setFilters,
    addTransaction,
    deleteTransaction,
  };
}

// ============================================================
// REMINDERS HOOK
// ============================================================

export interface UseRemindersReturn {
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  addReminder: (data: Omit<Reminder, 'id' | 'createdAt' | 'isActive'>) => Promise<void>;
  updateReminder: (id: string, data: Partial<Reminder>) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
}

export function useReminders(userId: string | undefined): UseRemindersReturn {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const repository = new FirebaseReminderRepository();

  useEffect(() => {
    if (!userId) {
      setReminders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = repository.subscribe(userId, (data) => {
      setReminders(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const addReminder = useCallback(
    async (data: Omit<Reminder, 'id' | 'createdAt' | 'isActive'>) => {
      if (!userId) return;
      try {
        await repository.create(userId, data as any);
      } catch (err) {
        setError('Failed to add reminder');
        console.error(err);
      }
    },
    [userId]
  );

  const updateReminder = useCallback(
    async (id: string, data: Partial<Reminder>) => {
      if (!userId) return;
      try {
        await repository.update(userId, id, data as any);
      } catch (err) {
        setError('Failed to update reminder');
        console.error(err);
      }
    },
    [userId]
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      if (!userId) return;
      try {
        await repository.delete(userId, id);
      } catch (err) {
        setError('Failed to delete reminder');
        console.error(err);
      }
    },
    [userId]
  );

  return { reminders, loading, error, addReminder, updateReminder, deleteReminder };
}

// ============================================================
// CATEGORIES HOOK
// ============================================================

export interface UseCategoriesReturn {
  categories: Category[];
  loading: boolean;
  error: string | null;
  addCategory: (data: Omit<Category, 'id' | 'createdAt'>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export function useCategories(userId: string | undefined): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const repository = new FirebaseCategoryRepository();

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    repository.getAll(userId).then((data) => {
      setCategories(data);
      setLoading(false);
    }).catch((err) => {
      setError('Failed to load categories');
      setLoading(false);
      console.error(err);
    });
  }, [userId]);

  const addCategory = useCallback(
    async (data: Omit<Category, 'id' | 'createdAt'>) => {
      if (!userId) return;
      try {
        const newCategory = await repository.create(userId, data as any);
        setCategories((prev) => [newCategory, ...prev]);
      } catch (err) {
        setError('Failed to add category');
        console.error(err);
      }
    },
    [userId]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      if (!userId) return;
      try {
        await repository.delete(userId, id);
        setCategories((prev) => prev.filter((c) => c.id !== id));
      } catch (err) {
        setError('Failed to delete category');
        console.error(err);
      }
    },
    [userId]
  );

  return { categories, loading, error, addCategory, deleteCategory };
}

// ============================================================
// BUDGETS HOOK
// ============================================================

export interface UseBudgetsReturn {
  budgets: Budget[];
  loading: boolean;
  error: string | null;
  addBudget: (data: Omit<Budget, 'id' | 'createdAt'>) => Promise<void>;
  updateBudget: (id: string, data: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
}

export function useBudgets(userId: string | undefined): UseBudgetsReturn {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const repository = new FirebaseBudgetRepository();

  useEffect(() => {
    if (!userId) {
      setBudgets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = repository.subscribe(userId, (data) => {
      setBudgets(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const addBudget = useCallback(
    async (data: Omit<Budget, 'id' | 'createdAt'>) => {
      if (!userId) return;
      try {
        await repository.create(userId, data as any);
      } catch (err) {
        setError('Failed to add budget');
        console.error(err);
      }
    },
    [userId]
  );

  const updateBudget = useCallback(
    async (id: string, data: Partial<Budget>) => {
      if (!userId) return;
      try {
        await repository.update(userId, id, data);
      } catch (err) {
        setError('Failed to update budget');
        console.error(err);
      }
    },
    [userId]
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      if (!userId) return;
      try {
        await repository.delete(userId, id);
      } catch (err) {
        setError('Failed to delete budget');
        console.error(err);
      }
    },
    [userId]
  );

  return { budgets, loading, error, addBudget, updateBudget, deleteBudget };
}

// ============================================================
// USER PROFILE HOOK
// ============================================================

export interface UseUserProfileReturn {
  telegramChatId: string | null;
  loading: boolean;
  error: string | null;
  updateTelegramChatId: (chatId: string) => Promise<void>;
}

export function useUserProfile(userId: string | undefined): UseUserProfileReturn {
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const repository = new FirebaseUserRepository();

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    repository.get(userId).then((user) => {
      setTelegramChatId(user?.telegramChatId || null);
      setLoading(false);
    }).catch((err) => {
      setError('Failed to load user profile');
      setLoading(false);
      console.error(err);
    });
  }, [userId]);

  const updateTelegramChatId = useCallback(
    async (chatId: string) => {
      if (!userId) return;
      try {
        await repository.createIfNotExists(userId);
        await repository.update(userId, { telegramChatId: chatId });
        setTelegramChatId(chatId);
      } catch (err) {
        setError('Failed to update Telegram chat ID');
        console.error(err);
      }
    },
    [userId]
  );

  return { telegramChatId, loading, error, updateTelegramChatId };
}