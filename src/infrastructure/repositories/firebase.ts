/**
 * Firebase Repository Implementations
 * Concrete implementations of repository interfaces using Firestore
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  QueryConstraint,
} from 'firebase/firestore';
import {
  Transaction,
  TransactionCreate,
  TransactionUpdate,
  User,
  UserCreate,
  Reminder,
  ReminderCreate,
  ReminderUpdate,
  Category,
  CategoryCreate,
  Budget,
  BudgetCreate,
  BudgetUpdate,
} from '../../domain/entities';
import { TransactionFilter } from '../../domain/value-objects';
import {
  ITransactionRepository,
  IUserRepository,
  IReminderRepository,
  ICategoryRepository,
  IBudgetRepository,
} from './repositories';
import { getFirebaseFirestore } from '../firebase/config';

// ============================================================
// BASE REPOSITORY
// ============================================================

function getDb() {
  return getFirebaseFirestore();
}

// ============================================================
// TRANSACTION REPOSITORY
// ============================================================

export class FirebaseTransactionRepository implements ITransactionRepository {
  private collectionName = 'transactions';

  async getAll(userId: string): Promise<Transaction[]> {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Transaction));
  }

  async getById(userId: string, transactionId: string): Promise<Transaction | null> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, transactionId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as Transaction;
  }

  async getFiltered(userId: string, filter: TransactionFilter): Promise<Transaction[]> {
    const db = getDb();
    const constraints: QueryConstraint[] = [where('userId', '==', userId)];

    if (filter.dateFrom) {
      constraints.push(where('date', '>=', filter.dateFrom));
    }
    if (filter.dateTo) {
      constraints.push(where('date', '<=', filter.dateTo));
    }
    if (filter.category && filter.category !== 'all') {
      constraints.push(where('category', '==', filter.category));
    }
    if (filter.type && filter.type !== 'all') {
      constraints.push(where('type', '==', filter.type));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, this.collectionName), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Transaction));
  }

  async create(userId: string, data: TransactionCreate): Promise<Transaction> {
    const db = getDb();
    const now = Date.now();
    const docData = {
      ...data,
      amount: data.type === 'expense' ? -Math.abs(data.amount) : Math.abs(data.amount),
      createdAt: now,
    };

    const docRef = await addDoc(collection(db, this.collectionName), docData);
    return { id: docRef.id, ...docData } as Transaction;
  }

  async update(
    userId: string,
    transactionId: string,
    data: TransactionUpdate
  ): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, transactionId);

    // Only update allowed fields
    const updateData: Record<string, unknown> = { ...data };
    delete updateData.userId;
    delete updateData.createdAt;

    await updateDoc(docRef, updateData);
  }

  async delete(userId: string, transactionId: string): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, transactionId);
    await deleteDoc(docRef);
  }

  // Real-time subscription
  subscribe(
    userId: string,
    callback: (transactions: Transaction[]) => void
  ): Unsubscribe {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Transaction)
      );
      callback(transactions);
    });
  }
}

// ============================================================
// USER REPOSITORY
// ============================================================

export class FirebaseUserRepository implements IUserRepository {
  private collectionName = 'users';

  async get(userId: string): Promise<User | null> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as User;
  }

  async create(userId: string, data: UserCreate): Promise<User> {
    const db = getDb();
    const now = Date.now();
    const docData = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, this.collectionName, userId), docData);
    return { id: userId, ...docData } as User;
  }

  async update(userId: string, data: Partial<User>): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, userId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: Date.now(),
    });
  }

  async findByTelegramChatId(chatId: string): Promise<User | null> {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('telegramChatId', '==', chatId),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  }

  async createIfNotExists(userId: string): Promise<User> {
    const existing = await this.get(userId);
    if (existing) {
      return existing;
    }
    return this.create(userId, {});
  }
}

// Import setDoc
import { setDoc } from 'firebase/firestore';

// ============================================================
// REMINDER REPOSITORY
// ============================================================

export class FirebaseReminderRepository implements IReminderRepository {
  private collectionName = 'reminders';

  async getAll(userId: string): Promise<Reminder[]> {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Reminder));
  }

  async getById(userId: string, reminderId: string): Promise<Reminder | null> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, reminderId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists() || docSnap.data().userId !== userId) {
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as Reminder;
  }

  async getActive(): Promise<Reminder[]> {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('isActive', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Reminder));
  }

  async create(userId: string, data: ReminderCreate): Promise<Reminder> {
    const db = getDb();
    const now = Date.now();
    const docData = {
      ...data,
      isActive: true,
      createdAt: now,
    };

    const docRef = await addDoc(collection(db, this.collectionName), docData);
    return { id: docRef.id, ...docData } as Reminder;
  }

  async update(
    userId: string,
    reminderId: string,
    data: ReminderUpdate
  ): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, reminderId);

    const updateData: Record<string, unknown> = { ...data };
    delete updateData.userId;
    delete updateData.createdAt;

    await updateDoc(docRef, updateData);
  }

  async delete(userId: string, reminderId: string): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, reminderId);
    await deleteDoc(docRef);
  }

  subscribe(
    userId: string,
    callback: (reminders: Reminder[]) => void
  ): Unsubscribe {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const reminders = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Reminder)
      );
      callback(reminders);
    });
  }
}

// ============================================================
// CATEGORY REPOSITORY
// ============================================================

export class FirebaseCategoryRepository implements ICategoryRepository {
  private collectionName = 'categories';

  async getAll(userId: string): Promise<Category[]> {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Category));
  }

  async create(userId: string, data: CategoryCreate): Promise<Category> {
    const db = getDb();
    const docData = {
      ...data,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, this.collectionName), docData);
    return { id: docRef.id, ...docData } as Category;
  }

  async delete(userId: string, categoryId: string): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, categoryId);
    await deleteDoc(docRef);
  }
}

// ============================================================
// BUDGET REPOSITORY
// ============================================================

export class FirebaseBudgetRepository implements IBudgetRepository {
  private collectionName = 'budgets';

  async getAll(userId: string): Promise<Budget[]> {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Budget));
  }

  async getByMonth(userId: string, month: string): Promise<Budget[]> {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('month', '==', month)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Budget));
  }

  async create(userId: string, data: BudgetCreate): Promise<Budget> {
    const db = getDb();
    const docData = {
      ...data,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, this.collectionName), docData);
    return { id: docRef.id, ...docData } as Budget;
  }

  async update(
    userId: string,
    budgetId: string,
    data: Partial<Budget>
  ): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, budgetId);
    await updateDoc(docRef, data);
  }

  async delete(userId: string, budgetId: string): Promise<void> {
    const db = getDb();
    const docRef = doc(db, this.collectionName, budgetId);
    await deleteDoc(docRef);
  }

  subscribe(
    userId: string,
    callback: (budgets: Budget[]) => void
  ): Unsubscribe {
    const db = getDb();
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const budgets = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Budget)
      );
      callback(budgets);
    });
  }
}

// Import limit
import { limit } from 'firebase/firestore';