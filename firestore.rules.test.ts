/**
 * Automated specification & adversarial payload verification suite for Dinemelly Firestore Rules.
 * Validates the "Dirty Dozen" invariants against firebase-blueprint.json bounds.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated read on private orders',
    path: '/users/u1/orders',
    operation: 'list',
    authUid: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-tenant read on another user client PII',
    path: '/users/u2/clients/c1',
    operation: 'get',
    authUid: 'u1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-tenant write with spoofed ownerId',
    path: '/users/u1/purchases/p1',
    operation: 'create',
    authUid: 'u1',
    payload: { ownerId: 'u2', id: 'p1', materialName: 'Lana', totalPrice: 1000 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow / ghost field injection on UserWorkspace',
    path: '/users/u1',
    operation: 'create',
    authUid: 'u1',
    payload: { ownerId: 'u1', email: 'a@b.com', displayName: 'Ana', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Immutable ownerId/createdAt mutation on update',
    path: '/users/u1',
    operation: 'update',
    authUid: 'u1',
    payload: { ownerId: 'u2', displayName: 'Ana' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Client-forged serverCreatedAt timestamp',
    path: '/users/u1/inventory/inv_1',
    operation: 'create',
    authUid: 'u1',
    payload: { ownerId: 'u1', id: 'inv_1', serverCreatedAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Path traversal / invalid characters in document ID',
    path: '/users/u1/clients/.._evil$',
    operation: 'create',
    authUid: 'u1',
    payload: { ownerId: 'u1', id: '.._evil$' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Resource exhaustion string > 1000 chars on observations',
    path: '/users/u1/clients/cli_1',
    operation: 'create',
    authUid: 'u1',
    payload: { ownerId: 'u1', id: 'cli_1', observations: 'x'.repeat(5000) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Unbounded array > 100 items on Order',
    path: '/users/u1/orders/ord_1',
    operation: 'create',
    authUid: 'u1',
    payload: { ownerId: 'u1', id: 'ord_1', items: new Array(150).fill({}) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid enum value on Payment.method',
    path: '/users/u1/payments/pay_1',
    operation: 'create',
    authUid: 'u1',
    payload: { ownerId: 'u1', id: 'pay_1', method: 'Crypto' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Missing required fields on Client',
    path: '/users/u1/clients/cli_2',
    operation: 'create',
    authUid: 'u1',
    payload: { ownerId: 'u1', id: 'cli_2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'List query when document ownerId mismatches auth.uid',
    path: '/users/u1/clients',
    operation: 'list',
    authUid: 'u1',
    payload: { ownerId: 'u2' },
    expected: 'PERMISSION_DENIED',
  },
];

export function validateIdFormat(id: string): boolean {
  return id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
}
