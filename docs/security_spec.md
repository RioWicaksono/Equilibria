# Phase 0: Payload-First Security TDD - Equilibria

## 1. Data Invariants

- **Authentication Invariant:** All operations require a verified authenticated user session.
- **Identity Integrity Invariant:** For every collection (`transactions`, `reminders`, `categories`, `budgets`), the `userId` field must exactly match the `request.auth.uid` of the caller.
- **Immutable Ownership Invariant:** The `userId` field is locked upon creation and can never be modified.
- **Type & Bounds Invariant:** Financial fields like `amount` must be numeric. Text fields like `desc`, `title`, and `name` must be bounded in length to prevent "Denial of Wallet" exhaustion.
- **Strict Keys Invariant (Anti-Ghost Field):** Documents must only contain expected schema keys. Extra fields injected by malicious clients must result in a rejection.
- **Enum Invariant:** The `type` field in transactions and categories must be strictly constrained to `'income'` or `'expense'`.
- **Relational Integrity Invariant:** A transaction or reminder can only be created if the associated `users/{userId}` document exists.
- **Query Enforcer Invariant:** List queries must be restricted at the rule level to `resource.data.userId == request.auth.uid`. Blanket reads without filtering are strictly denied.
- **Timestamp Integrity:** System timestamps like `createdAt` should ideally be server-enforced, or strictly validated to be valid numeric types.

## 2. The "Dirty Dozen" Payloads

These 12 distinct malicious payloads are designed to penetrate Identity, Integrity, and State boundary rules.

1. **Identity Spoofing (Create):** Creating a transaction, but passing `userId: 'victim_uid'` while authenticated as `hacker_uid`.
2. **Ownership Theft (Update):** Sending an update to an existing owned transaction to change `userId` to someone else's ID.
3. **Ghost Field Injection (Create):** Sending a valid transaction payload, but appending a hidden field e.g., `"isAdmin": true`. 
4. **Data Type Poisoning (Create):** Sending a transaction where `amount` is a string `"99999"` instead of a number.
5. **Schema Enum Bypass (Update):** Attempting to update a transaction `type` to `"refund"` (invalid enum state).
6. **Denial of Wallet / Resource Exhaustion (Create):** Injecting an exceptionally long 20,000-character string into the `desc` field of a transaction.
7. **Document ID Poisoning:** Attempting to write a transaction using a document ID filled with 10KB of junk characters over the 128-character limit.
8. **Orphaned Write (Integrity Bypass):** Creating a transaction with `userId` of the current user, but the user has never actually registered in the `users` collection.
9. **The Unbounded List Query:** A client executing `.get(collection('transactions'))` without attaching `.where('userId', '==', hacker_uid)`.
10. **The PII / Cross-Tenant Read:** Trying to fetch a profile by directly querying `users/victim_uid`.
11. **State Bypass (Reminders):** Attempting an update to `isActive` that also simultaneously alters the `createdAt` timestamp (mixing state and immutable fields).
12. **Missing Essential Bounds:** Sending a transaction creation request missing required fields like `amount` or `date`.

## 3. The Test Runner

A deterministic test suite utilizing `@firebase/rules-unit-testing` will be generated in `firestore.rules.test.ts`. This suite attempts to process the Dirty Dozen payloads against the local emulator configuration, expecting `PERMISSION_DENIED` for every single one of them.
