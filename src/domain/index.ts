/**
 * Domain Layer - Equilibria Financial App
 * DDD (Domain-Driven Design) Architecture
 *
 * Structure:
 * - domain/        : Core business logic, entities, value objects
 * - application/   : Use cases and application services
 * - infrastructure/ : External dependencies (Firebase, Telegram, etc.)
 * - presentation/  : React components and UI
 * - shared/        : Utils, types, constants
 */

// Re-export domain types
export * from './entities';
export * from './value-objects';
export * from './services';