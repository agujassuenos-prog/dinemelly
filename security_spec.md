# Dinemelly Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. Every document across `/users/{userId}` and its 7 subcollections (`inventory`, `purchases`, `movements`, `calculations`, `clients`, `orders`, `payments`) is strictly owned by `userId`.
2. `request.auth != null && request.auth.uid == userId` is mandatory for every read (`get`, `list`) and write (`create`, `update`, `delete`).
3. Every written document must set `ownerId == request.auth.uid` on `create`, and `ownerId` + `serverCreatedAt` are immutable on `update`.
4. All server timestamps (`createdAt`/`updatedAt` on `/users/{userId}`, `serverCreatedAt`/`serverUpdatedAt` on subcollection docs) must equal `request.time`.
5. No document ID path variable may exceed 128 chars or contain characters outside `^[a-zA-Z0-9_\-]+$`.
6. Every string field enforces `.size()` upper bounds matching `firebase-blueprint.json`; every array (`materials`, `items`) enforces `.size() <= 100`.
7. `allow list` validates `isOwner(userId) && existing().ownerId == request.auth.uid` with zero `get()` or `exists()` lookups.
8. All client-supplied `keys()` must match strict `hasAll` and `hasOnly` allowlists (no shadow/ghost fields).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated read on `/users/u1/orders`**: `auth = null` -> DENIED by `isOwner(userId)`.
2. **Cross-tenant read on `/users/u2/clients/c1`**: `auth = { uid: 'u1' }` -> DENIED by `isOwner('u2')`.
3. **Cross-tenant write with spoofed `ownerId`**: `auth = { uid: 'u1' }`, path `/users/u1/purchases/p1`, payload `{ ownerId: 'u2', ... }` -> DENIED by `incoming().ownerId == request.auth.uid`.
4. **Shadow/Ghost Field Injection**: `auth = { uid: 'u1' }`, payload includes `{ ..., isAdmin: true }` -> DENIED by `hasOnly(...)`.
5. **Privilege Escalation on `UserWorkspace` update**: updating `ownerId` or `createdAt` -> DENIED by `affectedKeys().hasOnly(...)` and immutability gate.
6. **Client-forged Timestamp**: `serverCreatedAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> DENIED by `incoming().serverCreatedAt == request.time`.
7. **ID Poisoning / Path Traversal**: doc ID `../../evil` or 500-char string -> DENIED by `isValidId(...)`.
8. **Resource Exhaustion (1MB String)**: `observations` of 5,000 chars -> DENIED by `observations.size() <= 1000`.
9. **Unbounded Array Attack**: `Order.items` with 200 items -> DENIED by `items.size() <= 100`.
10. **Invalid Enum Value**: `Payment.method = "Crypto"` -> DENIED by `method in ['Efectivo', 'Transferencia', 'Otro']`.
11. **Missing Required Fields**: `Client` missing `name` or `phone` -> DENIED by `hasAll(...)`.
12. **Blanket List Without Owner Filter**: `list` on `/users/u1/clients` where a stored doc has mismatched `ownerId` -> DENIED by `existing().ownerId == request.auth.uid`.
