# Archive Notes

## Files to Archive (Manual Cleanup)

### 1. Old Test Files
```
src/__archive__/
├── __tests__/
│   └── business-logic.test.ts  # Merged into domain/__tests__/domain.test.ts
└── types/
    └── index.ts                 # Merged into domain/entities/index.ts
```

### 2. How to Archive (Manual)

Run these commands in PowerShell:

```powershell
# Create archive folder
New-Item -ItemType Directory -Path "src/__archive__" -Force

# Move old test files
Move-Item -Path "src/__tests__" -Destination "src/__archive__/__tests__-old"

# Move old types
Move-Item -Path "src/types" -Destination "src/__archive__/types-old"
```

### 3. Files That Are Still In Use (DO NOT DELETE)
- `src/lib/firebase.ts` - Active, used by App.tsx
- `src/lib/firestore_error.ts` - Active, used by App.tsx
- `src/components/ErrorBoundary.tsx` - Active, ready for use
- `src/infrastructure/` - New DDD layer, active
- `src/domain/` - New DDD layer, active
- `src/presentation/hooks/` - New hooks, active

---

## New DDD Structure

```
src/
├── domain/                    # Core business logic
│   ├── entities/             # Transaction, User, Reminder, Budget
│   ├── value-objects/        # Money, DateRange, ValidId
│   ├── services/             # BalanceService, CategoryService
│   └── __tests__/           # TDD tests
├── infrastructure/           # External dependencies
│   ├── firebase/             # Firebase config
│   └── repositories/         # Firestore repositories
├── presentation/             # React layer
│   └── hooks/                # Custom hooks
├── lib/                      # Still in use (Firebase client)
│   ├── firebase.ts           # Firebase initialization
│   └── firestore_error.ts    # Error handling
├── components/               # UI components
├── App.tsx                  # Main app
└── main.tsx                 # Entry point
```

---

## Cleanup Commands (Run Manually)

```powershell
# In project root:
mkdir src/__archive__
mv src/__tests__ src/__archive__/__tests__-old
mv src/types src/__archive__/types-old
```
