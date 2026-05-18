/**
 * Repository Interfaces - Domain Layer
 * Defines contracts for data access
 */

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

// ============================================================
// REPOSITORY INTERFACES
// ============================================================

export interface ITransactionRepository {
  getAll(userId: string): Promise<Transaction[]>;
  getById(userId: string, transactionId: string): Promise<Transaction | null>;
  getFiltered(userId: string, filter: TransactionFilter): Promise<Transaction[]>;
  create(userId: string, data: TransactionCreate): Promise<Transaction>;
  update(userId: string, transactionId: string, data: TransactionUpdate): Promise<void>;
  delete(userId: string, transactionId: string): Promise<void>;
}

export interface IUserRepository {
  get(userId: string): Promise<User | null>;
  create(userId: string, data: UserCreate): Promise<User>;
  update(userId: string, data: Partial<User>): Promise<void>;
  findByTelegramChatId(chatId: string): Promise<User | null>;
}

export interface IReminderRepository {
  getAll(userId: string): Promise<Reminder[]>;
  getById(userId: string, reminderId: string): Promise<Reminder | null>;
  getActive(): Promise<Reminder[]>;
  create(userId: string, data: ReminderCreate): Promise<Reminder>;
  update(userId: string, reminderId: string, data: ReminderUpdate): Promise<void>;
  delete(userId: string, reminderId: string): Promise<void>;
}

export interface ICategoryRepository {
  getAll(userId: string): Promise<Category[]>;
  create(userId: string, data: CategoryCreate): Promise<Category>;
  delete(userId: string, categoryId: string): Promise<void>;
}

export interface IBudgetRepository {
  getAll(userId: string): Promise<Budget[]>;
  getByMonth(userId: string, month: string): Promise<Budget[]>;
  create(userId: string, data: BudgetCreate): Promise<Budget>;
  update(userId: string, budgetId: string, data: Partial<Budget>): Promise<void>;
  delete(userId: string, budgetId: string): Promise<void>;
}