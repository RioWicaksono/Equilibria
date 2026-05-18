import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load rules directly from file
const FIRESTORE_RULES = readFileSync(resolve(__dirname, 'firestore.rules'), 'utf8');

// Get emulator host from environment or use default
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [emulatorHost, emulatorPort] = EMULATOR_HOST.split(':');

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  // Initialize test environment with explicit host/port for emulator
  testEnv = await initializeTestEnvironment({
    projectId: 'equilibria-test',
    firestore: {
      host: emulatorHost || '127.0.0.1',
      port: parseInt(emulatorPort || '8080', 10),
      rules: FIRESTORE_RULES,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore Security Rules: The Dirty Dozen TDD', () => {
  const HACKER_UID = 'hacker_123';
  const VICTIM_UID = 'victim_999';

  const setupMockData = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      // Setup Victim Profile & Data
      await db.collection('users').doc(VICTIM_UID).set({ telegramChatId: '111', createdAt: 12345 });
      await db.collection('transactions').doc('victim_tx').set({
        userId: VICTIM_UID,
        desc: 'Groceries',
        category: 'Food',
        amount: 50000,
        date: '2026-05-18',
        type: 'expense',
        createdAt: 12345
      });
      
      // Setup Hacker Profile
      await db.collection('users').doc(HACKER_UID).set({ telegramChatId: '222', createdAt: 12345 });
      await db.collection('transactions').doc('hacker_tx').set({
        userId: HACKER_UID,
        desc: 'Salary',
        category: 'Work',
        amount: 1000000,
        date: '2026-05-18',
        type: 'income',
        createdAt: 12345
      });
    });
  };

  it('1. Identity Spoofing (Create): Hacker creates a transaction for victim_uid', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertFails(
      hackerDb.collection('transactions').add({
        userId: VICTIM_UID, // Spoofing identity
        desc: 'Fake Transaction',
        category: 'Food',
        amount: 20000,
        date: '2026-05-18',
        type: 'expense',
        createdAt: 12345
      })
    );
  });

  it('2. Ownership Theft (Update): Hacker changes userId of their own transaction to transfer it', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertFails(
      hackerDb.collection('transactions').doc('hacker_tx').update({
        userId: VICTIM_UID // Theft attempt
      })
    );
  });

  it('3. Ghost Field Injection (Create)', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertFails(
      hackerDb.collection('transactions').add({
        userId: HACKER_UID,
        desc: 'Salary',
        category: 'Work',
        amount: 1000000,
        date: '2026-05-18',
        type: 'income',
        createdAt: 12345,
        isAdmin: true // Ghost Field
      })
    );
  });

  it('4. Data Type Poisoning (Create): String instead of Number amount', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertFails(
      hackerDb.collection('transactions').add({
        userId: HACKER_UID,
        desc: 'Salary',
        category: 'Work',
        amount: '1000000', // Poisoned Type
        date: '2026-05-18',
        type: 'income',
        createdAt: 12345
      })
    );
  });

  it('5. Schema Enum Bypass (Update): Invalid type', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertFails(
      hackerDb.collection('transactions').doc('hacker_tx').update({
        type: 'refund' // Invalid enum
      })
    );
  });

  it('6. Denial of Wallet / Resource Exhaustion: 10KB string payload', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    const hugeString = 'A'.repeat(5000);
    await assertFails(
      hackerDb.collection('transactions').add({
        userId: HACKER_UID,
        desc: hugeString, // Exhaustion payload
        category: 'Work',
        amount: 100,
        date: '2026-05-18',
        type: 'income',
        createdAt: 12345
      })
    );
  });

  it('7. Document ID Poisoning', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    const hugeId = 'A'.repeat(200);
    await assertFails(
      hackerDb.collection('transactions').doc(hugeId).set({
        userId: HACKER_UID,
        desc: 'Salary',
        category: 'Work',
        amount: 1000000,
        date: '2026-05-18',
        type: 'income',
        createdAt: 12345
      })
    );
  });

  it('8. Orphaned Write: Creating without users/{userId} relational document existing', async () => {
    // Note: Do NOT run setupMockData() to make sure users/HACKER_UID does NOT exist
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertFails(
      hackerDb.collection('transactions').add({
        userId: HACKER_UID,
        desc: 'Salary',
        category: 'Work',
        amount: 1000000,
        date: '2026-05-18',
        type: 'income',
        createdAt: 12345
      })
    );
  });

  it('9. The Unbounded List Query (Scraping limit bypass)', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    // Fetching transactions without passing a "userId == request.auth.uid" where clause
    await assertFails(
      hackerDb.collection('transactions').get()
    );
  });

  it('10. PII / Cross-Tenant Read: Reading someone elses Document', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertFails(
      hackerDb.collection('transactions').doc('victim_tx').get()
    );
  });
  
  it('11. State Bypass: Modifying an immutable field alongside a mutable field during update', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertFails(
      hackerDb.collection('transactions').doc('hacker_tx').update({
        amount: 200,    // Valid edit
        createdAt: 0    // Invalid edit (cannot alter immutable createdAt after creation)
      })
    );
  });

  it('12. Missing Essential Bounds (Missing required fields)', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertFails(
      hackerDb.collection('transactions').add({
        userId: HACKER_UID,
        desc: 'Salary',
        // 'category' missing
        // 'amount' missing
        date: '2026-05-18',
        type: 'income',
        createdAt: 12345
      })
    );
  });

  // Example of a Passing Case
  it('13. SUCCESS: Authorized User Creates Valid Transaction', async () => {
    await setupMockData();
    const hackerDb = testEnv.authenticatedContext(HACKER_UID).firestore();
    await assertSucceeds(
      hackerDb.collection('transactions').doc('valid_id_1').set({
        userId: HACKER_UID,
        desc: 'Coffee',
        category: 'Food',
        amount: 30000,
        date: '2026-05-18',
        type: 'expense',
        createdAt: 12345
      })
    );
  });
});
