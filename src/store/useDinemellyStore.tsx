import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { AppStateData, createSeedData } from '../data/seedData';
import {
  ActiveModule,
  Client,
  ConsumedMaterial,
  InventoryItem,
  InventoryItemType,
  InventoryMovement,
  MaterialCategory,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Purchase,
  SavedCalculation,
  ToastMessage,
} from '../types';
import { generateId, getTodayISO } from '../utils/format';

export function createEmptyData(): AppStateData {
  return {
    inventory: [],
    purchases: [],
    movements: [],
    calculations: [],
    clients: [],
    orders: [],
    payments: [],
  };
}

export interface PurchaseInput {
  materialName: string;
  existingItemId?: string;
  category: MaterialCategory;
  itemType: InventoryItemType;
  quantity: number;
  unit: string;
  purchasedQuantity?: number;
  purchasedUnit?: string;
  contentPerUnit?: number;
  totalPrice: number;
  supplier: string;
  date: string;
  invoiceRef: string;
  observations: string;
  minStock?: number;
}

export interface OrderInitialPaymentInput {
  mode: 'ninguno' | 'abono' | 'total';
  amount: number;
  method: PaymentMethod;
  date: string;
  observations: string;
}

export interface OrderConsumedMaterialInput {
  inventoryItemId: string;
  quantity: number;
}

export interface OrderInputItem {
  productName: string;
  description: string;
  quantity: number;
  unitSalePrice: number;
  estimatedProductionCost: number;
  laborAndExtrasPerUnit?: number;
  suggestedMaterials?: OrderItem['suggestedMaterials'];
  materialsToDeduct?: OrderConsumedMaterialInput[];
}

export interface OrderInput {
  clientId: string;
  requestDate: string;
  deliveryDate: string;
  items: OrderInputItem[];
  discount: number;
  observations: string;
  initialPayment?: OrderInitialPaymentInput;
  authorizeNegativeStock?: boolean;
}

export interface ReturnMaterialInput {
  itemId: string;
  inventoryItemId: string;
  name: string;
  quantity: number;
  unit: string;
}

interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

interface DinemellyContextValue {
  user: User | null;
  authReady: boolean;
  dataLoading: boolean;
  monthlyBudget: number | null;
  updateMonthlyBudget: (budget: number | null) => void;
  signOutUser: () => Promise<void>;

  data: AppStateData;
  activeModule: ActiveModule;
  setActiveModule: (mod: ActiveModule) => void;
  calculatorDraftCalculation: SavedCalculation | null;
  setCalculatorDraftCalculation: (calc: SavedCalculation | null) => void;
  pendingOrderDraftFromCalc: SavedCalculation | null;
  setPendingOrderDraftFromCalc: (calc: SavedCalculation | null) => void;
  preselectedPurchaseMaterialId: string | null;
  setPreselectedPurchaseMaterialId: (id: string | null) => void;
  autoOpenCreateFor: ActiveModule | null;
  setAutoOpenCreateFor: (mod: ActiveModule | null) => void;
  toasts: ToastMessage[];
  addToast: (type: ToastMessage['type'], title: string, description?: string) => void;
  dismissToast: (id: string) => void;

  // Helpers financieros y de pedidos
  getOrderTotal: (order: Order) => number;
  getOrderPaid: (orderId: string) => number;
  getOrderPending: (order: Order) => number;
  getOrderPaymentStatus: (order: Order) => PaymentStatus;
  getOrderCost: (order: Order) => number;
  getOrderProfit: (order: Order) => number;

  // Compras
  addPurchase: (input: PurchaseInput) => ActionResult;
  updatePurchase: (id: string, input: PurchaseInput) => ActionResult;
  deletePurchase: (id: string) => ActionResult;

  // Inventario
  addInventoryItem: (
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ) => ActionResult;
  updateInventoryItem: (id: string, patch: Partial<InventoryItem>) => ActionResult;
  deleteInventoryItem: (id: string) => ActionResult;
  adjustInventoryStock: (
    itemId: string,
    delta: number,
    reason: string,
    date: string,
    authorizeNegative?: boolean
  ) => ActionResult;
  retireTool: (
    itemId: string,
    date: string,
    reason: string,
    notes: string
  ) => ActionResult;

  // Calculadora
  saveCalculation: (
    calc: Omit<SavedCalculation, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => ActionResult;
  deleteCalculation: (id: string) => ActionResult;

  // Clientes
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => ActionResult;
  updateClient: (id: string, patch: Partial<Client>) => ActionResult;
  deleteClient: (id: string) => ActionResult;

  // Pedidos
  addOrder: (input: OrderInput) => ActionResult;
  updateOrder: (
    orderId: string,
    patch: {
      clientId: string;
      requestDate: string;
      deliveryDate: string;
      discount: number;
      observations: string;
      items: OrderItem[];
      status: OrderStatus;
      pendingDeductions?: { itemId: string; materials: OrderConsumedMaterialInput[] }[];
      authorizeNegativeStock?: boolean;
    }
  ) => ActionResult;
  deleteOrder: (orderId: string) => ActionResult;
  setOrderStatus: (orderId: string, status: OrderStatus) => ActionResult;
  finishOrderItemWithMaterials: (
    orderId: string,
    itemId: string,
    materialsUsed: { inventoryItemId: string; quantity: number }[],
    extraLaborAndWearPerUnit?: number,
    authorizeNegative?: boolean
  ) => ActionResult;
  cancelOrderWithReturns: (
    orderId: string,
    returns: ReturnMaterialInput[]
  ) => ActionResult;

  // Pagos
  addPayment: (input: {
    orderId: string;
    date: string;
    amount: number;
    method: PaymentMethod;
    observations: string;
  }) => ActionResult;
  updatePayment: (
    paymentId: string,
    patch: { date: string; amount: number; method: PaymentMethod; observations: string }
  ) => ActionResult;
  deletePayment: (paymentId: string) => ActionResult;

  // Gestión de datos
  resetToSeedData: () => void;
  clearAllData: () => void;
  importJsonData: (rawJson: string) => ActionResult;
}

const DinemellyContext = createContext<DinemellyContextValue | null>(null);

type CollectionKey = keyof AppStateData;

const COLLECTION_KEYS: CollectionKey[] = [
  'inventory',
  'purchases',
  'movements',
  'calculations',
  'clients',
  'orders',
  'payments',
];

const MUTABLE_FIELDS_BY_COLLECTION: Record<CollectionKey, string[]> = {
  inventory: [
    'name',
    'category',
    'itemType',
    'quantity',
    'unit',
    'unitCost',
    'minStock',
    'observations',
    'estimatedWearCost',
    'status',
    'retiredAt',
    'retireReason',
    'retireNotes',
    'updatedAt',
  ],
  purchases: [
    'materialName',
    'category',
    'quantity',
    'unit',
    'purchasedQuantity',
    'purchasedUnit',
    'contentPerUnit',
    'totalPrice',
    'unitCost',
    'supplier',
    'date',
    'invoiceRef',
    'observations',
  ],
  movements: ['quantity', 'date', 'reason'],
  calculations: [
    'productName',
    'materials',
    'laborMode',
    'timeValue',
    'timeUnit',
    'hourlyRate',
    'laborCost',
    'toolsWearAuto',
    'toolsWearCost',
    'additionalCosts',
    'totalProductionCost',
    'desiredMarginPercent',
    'suggestedPrice',
    'finalSalePrice',
    'estimatedProfit',
    'actualMarginPercent',
    'notes',
    'updatedAt',
  ],
  clients: ['name', 'phone', 'email', 'address', 'observations'],
  orders: [
    'clientId',
    'requestDate',
    'deliveryDate',
    'status',
    'items',
    'discount',
    'observations',
    'updatedAt',
  ],
  payments: ['clientName', 'date', 'amount', 'method', 'observations'],
};

function sanitizeDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = sanitizeDeep(v);
    }
    return out as T;
  }
  return value;
}

function clampStr(v: unknown, maxLen: number, fallback = ''): string {
  const s = typeof v === 'string' ? v : fallback;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeId(v: unknown, prefix: string): string {
  const raw = typeof v === 'string' ? v.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
  return raw.length > 0 ? raw.slice(0, 128) : generateId(prefix);
}

function normalizeCollectionDoc(col: CollectionKey, raw: Record<string, unknown>): Record<string, unknown> {
  const today = getTodayISO();
  switch (col) {
    case 'inventory': {
      const obj: Record<string, unknown> = {
        id: sanitizeId(raw.id, 'inv'),
        name: clampStr(raw.name, 200, 'Material'),
        category: clampStr(raw.category, 60, 'Otros materiales'),
        itemType: raw.itemType === 'herramienta' ? 'herramienta' : 'consumible',
        quantity: safeNum(raw.quantity, 0),
        unit: clampStr(raw.unit, 40, 'unidades') || 'unidades',
        unitCost: Math.max(0, safeNum(raw.unitCost, 0)),
        minStock: Math.max(0, safeNum(raw.minStock, 0)),
        observations: clampStr(raw.observations, 1000, ''),
        estimatedWearCost: Math.max(0, safeNum(raw.estimatedWearCost, 0)),
        status: raw.status === 'baja' ? 'baja' : 'activo',
        createdAt: clampStr(raw.createdAt, 32, today) || today,
        updatedAt: clampStr(raw.updatedAt, 32, today) || today,
      };
      if (typeof raw.retiredAt === 'string') obj.retiredAt = clampStr(raw.retiredAt, 32);
      if (typeof raw.retireReason === 'string') obj.retireReason = clampStr(raw.retireReason, 300);
      if (typeof raw.retireNotes === 'string') obj.retireNotes = clampStr(raw.retireNotes, 1000);
      return obj;
    }
    case 'purchases': {
      const qty = Math.max(0.001, safeNum(raw.quantity, 1));
      const total = Math.max(1, safeNum(raw.totalPrice, 1));
      const obj: Record<string, unknown> = {
        id: sanitizeId(raw.id, 'pur'),
        code: clampStr(raw.code, 40, 'COM-001') || 'COM-001',
        inventoryItemId: sanitizeId(raw.inventoryItemId, 'inv'),
        materialName: clampStr(raw.materialName, 200, 'Material') || 'Material',
        category: clampStr(raw.category, 60, 'Otros materiales') || 'Otros materiales',
        itemType: raw.itemType === 'herramienta' ? 'herramienta' : 'consumible',
        quantity: qty,
        unit: clampStr(raw.unit, 40, 'unidades') || 'unidades',
        totalPrice: total,
        unitCost: Math.max(0, safeNum(raw.unitCost, total / qty)),
        supplier: clampStr(raw.supplier, 200, ''),
        date: clampStr(raw.date, 32, today) || today,
        invoiceRef: clampStr(raw.invoiceRef, 120, ''),
        observations: clampStr(raw.observations, 1000, ''),
        createdAt: clampStr(raw.createdAt, 32, today) || today,
      };
      if (typeof raw.purchasedQuantity === 'number' && Number.isFinite(raw.purchasedQuantity)) {
        obj.purchasedQuantity = raw.purchasedQuantity;
      }
      if (typeof raw.purchasedUnit === 'string') {
        obj.purchasedUnit = clampStr(raw.purchasedUnit, 40);
      }
      if (typeof raw.contentPerUnit === 'number' && Number.isFinite(raw.contentPerUnit)) {
        obj.contentPerUnit = raw.contentPerUnit;
      }
      return obj;
    }
    case 'movements': {
      const validTypes = [
        'entrada_compra',
        'salida_pedido',
        'ajuste_manual',
        'devolucion_material',
        'baja_herramienta',
      ];
      const obj: Record<string, unknown> = {
        id: sanitizeId(raw.id, 'mov'),
        inventoryItemId: sanitizeId(raw.inventoryItemId, 'inv'),
        itemName: clampStr(raw.itemName, 200, 'Material') || 'Material',
        type: validTypes.includes(String(raw.type)) ? raw.type : 'ajuste_manual',
        quantity: safeNum(raw.quantity, 0),
        unit: clampStr(raw.unit, 40, 'unidades') || 'unidades',
        date: clampStr(raw.date, 32, today) || today,
        reason: clampStr(raw.reason, 500, 'Movimiento de inventario') || 'Movimiento de inventario',
        createdAt: clampStr(raw.createdAt, 32, today) || today,
      };
      if (
        raw.referenceType === 'compra' ||
        raw.referenceType === 'pedido' ||
        raw.referenceType === 'manual' ||
        raw.referenceType === 'baja'
      ) {
        obj.referenceType = raw.referenceType;
      }
      if (typeof raw.referenceId === 'string') obj.referenceId = clampStr(raw.referenceId, 128);
      if (typeof raw.referenceLabel === 'string') {
        obj.referenceLabel = clampStr(raw.referenceLabel, 120);
      }
      return obj;
    }
    case 'calculations': {
      const mats = Array.isArray(raw.materials) ? raw.materials.slice(0, 100) : [];
      return sanitizeDeep({
        id: sanitizeId(raw.id, 'calc'),
        productName: clampStr(raw.productName, 200, 'Producto') || 'Producto',
        materials: mats,
        laborMode: raw.laborMode === 'fijo' ? 'fijo' : 'tiempo',
        timeValue: safeNum(raw.timeValue, 0),
        timeUnit: raw.timeUnit === 'minutos' ? 'minutos' : 'horas',
        hourlyRate: safeNum(raw.hourlyRate, 0),
        laborCost: safeNum(raw.laborCost, 0),
        toolsWearAuto: safeNum(raw.toolsWearAuto, 0),
        toolsWearCost: safeNum(raw.toolsWearCost, 0),
        additionalCosts: safeNum(raw.additionalCosts, 0),
        totalProductionCost: safeNum(raw.totalProductionCost, 0),
        desiredMarginPercent: safeNum(raw.desiredMarginPercent, 0),
        suggestedPrice: safeNum(raw.suggestedPrice, 0),
        finalSalePrice: safeNum(raw.finalSalePrice, 0),
        estimatedProfit: safeNum(raw.estimatedProfit, 0),
        actualMarginPercent: safeNum(raw.actualMarginPercent, 0),
        notes: clampStr(raw.notes, 1000, ''),
        createdAt: clampStr(raw.createdAt, 32, today) || today,
        updatedAt: clampStr(raw.updatedAt, 32, today) || today,
      });
    }
    case 'clients': {
      return {
        id: sanitizeId(raw.id, 'cli'),
        name: clampStr(raw.name, 200, 'Cliente') || 'Cliente',
        phone: clampStr(raw.phone, 60, ''),
        email: clampStr(raw.email, 320, ''),
        address: clampStr(raw.address, 300, ''),
        observations: clampStr(raw.observations, 1000, ''),
        createdAt: clampStr(raw.createdAt, 32, today) || today,
      };
    }
    case 'orders': {
      const validStatuses = ['pendiente', 'en_proceso', 'terminado', 'entregado', 'cancelado'];
      const items = Array.isArray(raw.items) ? raw.items.slice(0, 100) : [];
      return sanitizeDeep({
        id: sanitizeId(raw.id, 'ord'),
        orderNumber: clampStr(raw.orderNumber, 40, 'PED-001') || 'PED-001',
        clientId: sanitizeId(raw.clientId, 'cli'),
        requestDate: clampStr(raw.requestDate, 32, today) || today,
        deliveryDate: clampStr(raw.deliveryDate, 32, ''),
        status: validStatuses.includes(String(raw.status)) ? raw.status : 'pendiente',
        items,
        discount: Math.max(0, safeNum(raw.discount, 0)),
        observations: clampStr(raw.observations, 1000, ''),
        createdAt: clampStr(raw.createdAt, 32, today) || today,
        updatedAt: clampStr(raw.updatedAt, 32, today) || today,
      });
    }
    case 'payments': {
      const validMethods = ['Efectivo', 'Transferencia', 'Otro'];
      return {
        id: sanitizeId(raw.id, 'pay'),
        orderId: sanitizeId(raw.orderId, 'ord'),
        orderNumber: clampStr(raw.orderNumber, 40, 'PED-001') || 'PED-001',
        clientId: sanitizeId(raw.clientId, 'cli'),
        clientName: clampStr(raw.clientName, 200, 'Cliente') || 'Cliente',
        date: clampStr(raw.date, 32, today) || today,
        amount: Math.max(1, safeNum(raw.amount, 1)),
        method: validMethods.includes(String(raw.method)) ? raw.method : 'Efectivo',
        observations: clampStr(raw.observations, 1000, ''),
        createdAt: clampStr(raw.createdAt, 32, today) || today,
      };
    }
  }
}

function stripFirestoreMeta<T extends Record<string, unknown>>(docData: T): T {
  const clone = { ...docData };
  delete clone.ownerId;
  delete clone.serverCreatedAt;
  delete clone.serverUpdatedAt;
  return clone;
}

function sortCollection(col: CollectionKey, items: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...items].sort((a, b) => {
    const da = String(a.date || a.requestDate || a.updatedAt || a.createdAt || '');
    const dbDate = String(b.date || b.requestDate || b.updatedAt || b.createdAt || '');
    const cmp = dbDate.localeCompare(da);
    if (cmp !== 0) return cmp;
    const ca = String(a.orderNumber || a.code || a.name || '');
    const cb = String(b.orderNumber || b.code || b.name || '');
    return cb.localeCompare(ca);
  });
}

export const DinemellyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);

  const [data, setData] = useState<AppStateData>(createEmptyData);
  const dataRef = useRef<AppStateData>(data);

  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [calculatorDraftCalculation, setCalculatorDraftCalculation] =
    useState<SavedCalculation | null>(null);
  const [pendingOrderDraftFromCalc, setPendingOrderDraftFromCalc] =
    useState<SavedCalculation | null>(null);
  const [preselectedPurchaseMaterialId, setPreselectedPurchaseMaterialId] = useState<string | null>(
    null
  );
  const [autoOpenCreateFor, setAutoOpenCreateFor] = useState<ActiveModule | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const lastPurchaseFingerprintRef = useRef<{ sig: string; ts: number } | null>(null);
  const workspaceInitUidRef = useRef<string | null>(null);

  if (syncError) {
    throw syncError;
  }

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = generateId('toast');
      setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

  // Autenticación y suscripción aislada por usuario en Firestore
  useEffect(() => {
    let unsubs: (() => void)[] = [];

    const cleanupListeners = () => {
      unsubs.forEach((u) => u());
      unsubs = [];
    };

    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      cleanupListeners();
      setUser(nextUser);
      setAuthReady(true);
      setSyncError(null);

      if (!nextUser) {
        workspaceInitUidRef.current = null;
        const empty = createEmptyData();
        dataRef.current = empty;
        setData(empty);
        setMonthlyBudget(null);
        setActiveModule('dashboard');
        setDataLoading(false);
        return;
      }

      const uid = nextUser.uid;
      setDataLoading(true);
      const loadedFlags: Record<string, boolean> = { workspace: false };
      COLLECTION_KEYS.forEach((k) => {
        loadedFlags[k] = false;
      });

      const checkAllLoaded = () => {
        if (Object.values(loadedFlags).every(Boolean)) {
          setDataLoading(false);
        }
      };

      // 1. Documento raíz de usuario /users/{uid}
      const userDocRef = doc(db, 'users', uid);
      const unsubWorkspace = onSnapshot(
        userDocRef,
        (snap) => {
          if (!snap.exists()) {
            if (workspaceInitUidRef.current !== uid) {
              workspaceInitUidRef.current = uid;
              const fallbackName =
                nextUser.displayName?.trim() ||
                nextUser.email?.split('@')[0] ||
                'Taller Dinemelly';
              setDoc(userDocRef, {
                ownerId: uid,
                email: (nextUser.email || '').slice(0, 320),
                displayName: fallbackName.slice(0, 120),
                monthlyBudget: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }).catch((err) => {
                try {
                  handleFirestoreError(err, OperationType.CREATE, `users/${uid}`);
                } catch (wrapped) {
                  setSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
                }
              });
            }
            setMonthlyBudget(null);
          } else {
            const ws = snap.data();
            const mb =
              typeof ws.monthlyBudget === 'number' &&
              Number.isFinite(ws.monthlyBudget) &&
              ws.monthlyBudget > 0
                ? ws.monthlyBudget
                : null;
            setMonthlyBudget(mb);
          }
          loadedFlags.workspace = true;
          checkAllLoaded();
        },
        (err) => {
          try {
            handleFirestoreError(err, OperationType.GET, `users/${uid}`);
          } catch (wrapped) {
            setSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
          }
        }
      );
      unsubs.push(unsubWorkspace);

      // 2. Suscripciones a las 7 subcolecciones privadas del usuario (con filtro where ownerId == uid)
      COLLECTION_KEYS.forEach((colKey) => {
        const colQuery = query(
          collection(db, 'users', uid, colKey),
          where('ownerId', '==', uid)
        );
        const unsubCol = onSnapshot(
          colQuery,
          (snapshot) => {
            const items = sortCollection(
              colKey,
              snapshot.docs.map((d) =>
                stripFirestoreMeta({ ...d.data(), id: d.id } as Record<string, unknown>)
              )
            );
            const updated: AppStateData = {
              ...dataRef.current,
              [colKey]: items,
            };
            dataRef.current = updated;
            setData(updated);
            loadedFlags[colKey] = true;
            checkAllLoaded();
          },
          (err) => {
            try {
              handleFirestoreError(err, OperationType.LIST, `users/${uid}/${colKey}`);
            } catch (wrapped) {
              setSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
            }
          }
        );
        unsubs.push(unsubCol);
      });
    });

    return () => {
      cleanupListeners();
      unsubAuth();
    };
  }, []);

  const persistStateDiff = useCallback(
    async (uid: string, prev: AppStateData, next: AppStateData) => {
      type PendingOp =
        | { kind: 'set'; col: CollectionKey; id: string; payload: Record<string, unknown> }
        | { kind: 'update'; col: CollectionKey; id: string; payload: Record<string, unknown> }
        | { kind: 'delete'; col: CollectionKey; id: string };

      const ops: PendingOp[] = [];

      for (const colKey of COLLECTION_KEYS) {
        const prevArr = (prev[colKey] as unknown as Record<string, unknown>[]) || [];
        const nextArr = (next[colKey] as unknown as Record<string, unknown>[]) || [];
        const prevMap = new Map<string, Record<string, unknown>>();
        prevArr.forEach((item) => {
          if (typeof item.id === 'string') prevMap.set(item.id, item);
        });
        const nextMap = new Map<string, Record<string, unknown>>();
        nextArr.forEach((item) => {
          if (typeof item.id === 'string') nextMap.set(item.id, item);
        });

        for (const [id] of prevMap) {
          if (!nextMap.has(id)) {
            ops.push({ kind: 'delete', col: colKey, id });
          }
        }

        for (const [id, nextItem] of nextMap) {
          const prevItem = prevMap.get(id);
          const normalized = normalizeCollectionDoc(colKey, nextItem);
          if (!prevItem) {
            ops.push({
              kind: 'set',
              col: colKey,
              id: String(normalized.id),
              payload: {
                ...normalized,
                ownerId: uid,
                serverCreatedAt: serverTimestamp(),
                serverUpdatedAt: serverTimestamp(),
              },
            });
          } else {
            const normalizedPrev = normalizeCollectionDoc(colKey, prevItem);
            if (JSON.stringify(normalizedPrev) !== JSON.stringify(normalized)) {
              const mutableKeys = MUTABLE_FIELDS_BY_COLLECTION[colKey];
              const updatePayload: Record<string, unknown> = {
                serverUpdatedAt: serverTimestamp(),
              };
              for (const k of mutableKeys) {
                if (normalized[k] !== undefined) {
                  updatePayload[k] = normalized[k];
                }
              }
              ops.push({
                kind: 'update',
                col: colKey,
                id: String(normalized.id),
                payload: updatePayload,
              });
            }
          }
        }
      }

      if (ops.length === 0) return;

      try {
        for (let i = 0; i < ops.length; i += 400) {
          const chunk = ops.slice(i, i + 400);
          const batch = writeBatch(db);
          for (const op of chunk) {
            const docRef = doc(db, 'users', uid, op.col, op.id);
            if (op.kind === 'delete') {
              batch.delete(docRef);
            } else if (op.kind === 'set') {
              batch.set(docRef, op.payload);
            } else {
              batch.update(docRef, op.payload);
            }
          }
          await batch.commit();
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
        } catch (wrapped) {
          setSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    },
    []
  );

  const commitStateUpdate = useCallback(
    (updater: (prev: AppStateData) => AppStateData) => {
      const prev = dataRef.current;
      const next = updater(prev);
      dataRef.current = next;
      setData(next);
      if (user) {
        void persistStateDiff(user.uid, prev, next);
      }
    },
    [user, persistStateDiff]
  );

  const updateMonthlyBudget = useCallback(
    (budget: number | null) => {
      const cleanBudget =
        budget !== null && Number.isFinite(budget) && budget > 0
          ? Math.round(budget)
          : null;
      setMonthlyBudget(cleanBudget);
      if (!user) return;
      const userDocRef = doc(db, 'users', user.uid);
      updateDoc(userDocRef, {
        monthlyBudget: cleanBudget,
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        try {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
        } catch (wrapped) {
          setSyncError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      });
    },
    [user]
  );

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  // Helpers
  const getOrderTotal = useCallback((order: Order): number => {
    const itemsSum = order.items.reduce(
      (sum, item) => sum + item.quantity * item.unitSalePrice,
      0
    );
    return Math.max(0, itemsSum - (order.discount || 0));
  }, []);

  const getOrderPaid = useCallback(
    (orderId: string): number => {
      return data.payments
        .filter((p) => p.orderId === orderId)
        .reduce((sum, p) => sum + p.amount, 0);
    },
    [data.payments]
  );

  const getOrderPending = useCallback(
    (order: Order): number => {
      if (order.status === 'cancelado') return 0;
      return Math.max(0, getOrderTotal(order) - getOrderPaid(order.id));
    },
    [getOrderTotal, getOrderPaid]
  );

  const getOrderPaymentStatus = useCallback(
    (order: Order): PaymentStatus => {
      const total = getOrderTotal(order);
      const paid = getOrderPaid(order.id);
      if (paid <= 0) return 'Pendiente';
      if (paid >= total && total > 0) return 'Pagado';
      return 'Parcialmente pagado';
    },
    [getOrderTotal, getOrderPaid]
  );

  const getOrderCost = useCallback((order: Order): number => {
    return order.items.reduce((sum, item) => {
      const unitCost =
        item.materialsDeducted && item.actualProductionCost > 0
          ? item.actualProductionCost
          : item.estimatedProductionCost;
      return sum + unitCost * item.quantity;
    }, 0);
  }, []);

  const getOrderProfit = useCallback(
    (order: Order): number => {
      if (order.status === 'cancelado') return 0;
      return getOrderTotal(order) - getOrderCost(order);
    },
    [getOrderTotal, getOrderCost]
  );

  const computeHighestUnitCostForItem = (
    itemId: string,
    purchases: Purchase[],
    fallbackCost: number
  ): number => {
    const related = purchases.filter((p) => p.inventoryItemId === itemId);
    if (related.length === 0) return fallbackCost;
    return Math.max(...related.map((p) => p.unitCost));
  };

  // --- COMPRAS ---
  const addPurchase = useCallback(
    (input: PurchaseInput): ActionResult => {
      const trimmedName = input.materialName.trim();
      if (!trimmedName) {
        return { ok: false, error: 'Ingresa el nombre del material o herramienta.' };
      }
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        return { ok: false, error: 'La cantidad comprada debe ser mayor a cero.' };
      }
      if (!Number.isFinite(input.totalPrice) || input.totalPrice <= 0) {
        return { ok: false, error: 'El precio total de compra debe ser mayor a cero.' };
      }
      if (!input.date) {
        return { ok: false, error: 'Selecciona la fecha de compra.' };
      }

      const fingerprint = `${trimmedName.toLowerCase()}|${input.quantity}|${input.totalPrice}|${input.date}|${input.supplier}`;
      const nowMs = Date.now();
      if (
        lastPurchaseFingerprintRef.current &&
        lastPurchaseFingerprintRef.current.sig === fingerprint &&
        nowMs - lastPurchaseFingerprintRef.current.ts < 2500
      ) {
        return {
          ok: false,
          error: 'Esta compra acaba de ser registrada. Evitando registro duplicado.',
        };
      }
      lastPurchaseFingerprintRef.current = { sig: fingerprint, ts: nowMs };

      const unitCost = Math.round((input.totalPrice / input.quantity) * 100) / 100;
      const today = getTodayISO();

      const nextNum =
        dataRef.current.purchases.reduce((max, p) => {
          const n = parseInt(p.code.replace(/\D/g, ''), 10);
          return Number.isFinite(n) ? Math.max(max, n) : max;
        }, 0) + 1;
      const code = `COM-${String(nextNum).padStart(3, '0')}`;
      const purchaseId = generateId('pur');

      commitStateUpdate((prev) => {
        const targetItem = input.existingItemId
          ? prev.inventory.find((i) => i.id === input.existingItemId)
          : prev.inventory.find(
              (i) =>
                i.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
                i.unit.toLowerCase() === input.unit.toLowerCase()
            );

        let updatedInventory: InventoryItem[];
        let targetItemId: string;

        if (targetItem) {
          targetItemId = targetItem.id;
          const highestUnitCost = Math.max(targetItem.unitCost, unitCost);
          updatedInventory = prev.inventory.map((i) =>
            i.id === targetItemId
              ? {
                  ...i,
                  quantity: Math.round((i.quantity + input.quantity) * 1000) / 1000,
                  unitCost: highestUnitCost,
                  status: i.itemType === 'herramienta' ? 'activo' : i.status,
                  updatedAt: today,
                }
              : i
          );
        } else {
          targetItemId = generateId('inv');
          const newItem: InventoryItem = {
            id: targetItemId,
            name: trimmedName,
            category: input.category,
            itemType: input.itemType,
            quantity: input.quantity,
            unit: input.unit,
            unitCost,
            minStock: input.minStock ?? (input.itemType === 'herramienta' ? 1 : 10),
            observations: input.observations,
            estimatedWearCost: input.itemType === 'herramienta' ? 300 : 0,
            status: 'activo',
            createdAt: today,
            updatedAt: today,
          };
          updatedInventory = [newItem, ...prev.inventory];
        }

        const newPurchase: Purchase = {
          id: purchaseId,
          code,
          inventoryItemId: targetItemId,
          materialName: targetItem ? targetItem.name : trimmedName,
          category: targetItem ? targetItem.category : input.category,
          itemType: targetItem ? targetItem.itemType : input.itemType,
          quantity: input.quantity,
          unit: targetItem ? targetItem.unit : input.unit,
          purchasedQuantity: input.purchasedQuantity,
          purchasedUnit: input.purchasedUnit,
          contentPerUnit: input.contentPerUnit,
          totalPrice: input.totalPrice,
          unitCost,
          supplier: input.supplier.trim(),
          date: input.date,
          invoiceRef: input.invoiceRef.trim(),
          observations: input.observations.trim(),
          createdAt: today,
        };

        const newMovement: InventoryMovement = {
          id: generateId('mov'),
          inventoryItemId: targetItemId,
          itemName: newPurchase.materialName,
          type: 'entrada_compra',
          quantity: input.quantity,
          unit: newPurchase.unit,
          date: input.date,
          reason: input.supplier.trim()
            ? `Compra a ${input.supplier.trim()}`
            : 'Compra de material registrada',
          referenceType: 'compra',
          referenceId: purchaseId,
          referenceLabel: code,
          createdAt: today,
        };

        return {
          ...prev,
          inventory: updatedInventory,
          purchases: [newPurchase, ...prev.purchases],
          movements: [newMovement, ...prev.movements],
        };
      });

      const presentationNote =
        input.purchasedQuantity &&
        input.purchasedUnit &&
        (input.purchasedQuantity !== input.quantity || input.purchasedUnit !== input.unit)
          ? ` (${input.purchasedQuantity} ${input.purchasedUnit})`
          : '';

      addToast(
        'success',
        `Compra ${code} registrada`,
        `Se agregaron ${input.quantity} ${input.unit}${presentationNote} al inventario.`
      );
      return { ok: true, id: purchaseId };
    },
    [commitStateUpdate, addToast]
  );

  const updatePurchase = useCallback(
    (id: string, input: PurchaseInput): ActionResult => {
      const existing = dataRef.current.purchases.find((p) => p.id === id);
      if (!existing) return { ok: false, error: 'Compra no encontrada.' };
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        return { ok: false, error: 'La cantidad debe ser mayor a cero.' };
      }
      if (!Number.isFinite(input.totalPrice) || input.totalPrice <= 0) {
        return { ok: false, error: 'El precio total debe ser mayor a cero.' };
      }

      const targetInv = dataRef.current.inventory.find(
        (i) => i.id === existing.inventoryItemId
      );
      const qtyDiff = input.quantity - existing.quantity;
      if (targetInv && targetInv.quantity + qtyDiff < 0) {
        return {
          ok: false,
          error:
            'No se puede reducir tanto la cantidad porque parte de ese material ya fue consumido en inventario.',
        };
      }

      const newUnitCost = Math.round((input.totalPrice / input.quantity) * 100) / 100;
      const today = getTodayISO();

      commitStateUpdate((prev) => {
        const updatedPurchases = prev.purchases.map((p) =>
          p.id === id
            ? {
                ...p,
                materialName: input.materialName.trim() || p.materialName,
                category: input.category,
                quantity: input.quantity,
                unit: input.unit,
                purchasedQuantity: input.purchasedQuantity,
                purchasedUnit: input.purchasedUnit,
                contentPerUnit: input.contentPerUnit,
                totalPrice: input.totalPrice,
                unitCost: newUnitCost,
                supplier: input.supplier.trim(),
                date: input.date,
                invoiceRef: input.invoiceRef.trim(),
                observations: input.observations.trim(),
              }
            : p
        );

        const updatedInventory = prev.inventory.map((inv) => {
          if (inv.id !== existing.inventoryItemId) return inv;
          const highestCost = computeHighestUnitCostForItem(
            inv.id,
            updatedPurchases,
            newUnitCost
          );
          return {
            ...inv,
            quantity: Math.max(0, Math.round((inv.quantity + qtyDiff) * 1000) / 1000),
            unitCost: highestCost,
            updatedAt: today,
          };
        });

        const updatedMovements = prev.movements.map((m) =>
          m.referenceType === 'compra' && m.referenceId === id
            ? {
                ...m,
                quantity: input.quantity,
                date: input.date,
                reason: input.supplier.trim()
                  ? `Compra a ${input.supplier.trim()} (actualizada)`
                  : 'Compra actualizada',
              }
            : m
        );

        return {
          ...prev,
          purchases: updatedPurchases,
          inventory: updatedInventory,
          movements: updatedMovements,
        };
      });

      addToast('success', 'Compra actualizada', 'Se recalculó el inventario y costo más alto.');
      return { ok: true, id };
    },
    [commitStateUpdate, addToast]
  );

  const deletePurchase = useCallback(
    (id: string): ActionResult => {
      const existing = dataRef.current.purchases.find((p) => p.id === id);
      if (!existing) return { ok: false, error: 'Compra no encontrada.' };

      const targetInv = dataRef.current.inventory.find(
        (i) => i.id === existing.inventoryItemId
      );
      if (targetInv && targetInv.quantity - existing.quantity < 0) {
        return {
          ok: false,
          error:
            'No es posible eliminar esta compra porque dejaría el inventario en negativo (parte del material ya fue consumido).',
        };
      }

      const today = getTodayISO();
      commitStateUpdate((prev) => {
        const remainingPurchases = prev.purchases.filter((p) => p.id !== id);
        const updatedInventory = prev.inventory.map((inv) => {
          if (inv.id !== existing.inventoryItemId) return inv;
          const highestCost = computeHighestUnitCostForItem(
            inv.id,
            remainingPurchases,
            inv.unitCost
          );
          return {
            ...inv,
            quantity: Math.max(0, Math.round((inv.quantity - existing.quantity) * 1000) / 1000),
            unitCost: highestCost,
            updatedAt: today,
          };
        });
        const remainingMovements = prev.movements.filter(
          (m) => !(m.referenceType === 'compra' && m.referenceId === id)
        );
        return {
          ...prev,
          purchases: remainingPurchases,
          inventory: updatedInventory,
          movements: remainingMovements,
        };
      });

      addToast('info', `Compra ${existing.code} eliminada`, 'Inventario actualizado.');
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  // --- INVENTARIO ---
  const addInventoryItem = useCallback(
    (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>): ActionResult => {
      if (!item.name.trim()) {
        return { ok: false, error: 'El nombre del elemento es obligatorio.' };
      }
      if (item.quantity < 0) {
        return { ok: false, error: 'La cantidad inicial no puede ser negativa.' };
      }
      const today = getTodayISO();
      const id = generateId('inv');
      const newItem: InventoryItem = {
        ...item,
        name: item.name.trim(),
        status: 'activo',
        id,
        createdAt: today,
        updatedAt: today,
      };
      const movementsToAdd: InventoryMovement[] =
        item.quantity > 0
          ? [
              {
                id: generateId('mov'),
                inventoryItemId: id,
                itemName: newItem.name,
                type: 'ajuste_manual',
                quantity: item.quantity,
                unit: item.unit,
                date: today,
                reason: 'Registro inicial en inventario',
                referenceType: 'manual',
                createdAt: today,
              },
            ]
          : [];

      commitStateUpdate((prev) => ({
        ...prev,
        inventory: [newItem, ...prev.inventory],
        movements: [...movementsToAdd, ...prev.movements],
      }));
      addToast('success', 'Elemento agregado al inventario', newItem.name);
      return { ok: true, id };
    },
    [commitStateUpdate, addToast]
  );

  const updateInventoryItem = useCallback(
    (id: string, patch: Partial<InventoryItem>): ActionResult => {
      if (patch.name !== undefined && !patch.name.trim()) {
        return { ok: false, error: 'El nombre no puede quedar vacío.' };
      }
      const today = getTodayISO();
      commitStateUpdate((prev) => ({
        ...prev,
        inventory: prev.inventory.map((i) =>
          i.id === id ? { ...i, ...patch, updatedAt: today } : i
        ),
      }));
      addToast('success', 'Elemento actualizado');
      return { ok: true, id };
    },
    [commitStateUpdate, addToast]
  );

  const deleteInventoryItem = useCallback(
    (id: string): ActionResult => {
      const hasPurchases = dataRef.current.purchases.some((p) => p.inventoryItemId === id);
      if (hasPurchases) {
        return {
          ok: false,
          error:
            'Este material tiene compras registradas. Elimina primero sus compras o ajusta su cantidad a 0.',
        };
      }
      commitStateUpdate((prev) => ({
        ...prev,
        inventory: prev.inventory.filter((i) => i.id !== id),
      }));
      addToast('info', 'Elemento eliminado del inventario');
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  const adjustInventoryStock = useCallback(
    (
      itemId: string,
      delta: number,
      reason: string,
      date: string,
      authorizeNegative = false
    ): ActionResult => {
      const item = dataRef.current.inventory.find((i) => i.id === itemId);
      if (!item) return { ok: false, error: 'Elemento no encontrado.' };
      if (!Number.isFinite(delta) || delta === 0) {
        return { ok: false, error: 'La cantidad del ajuste debe ser diferente de cero.' };
      }
      if (!reason.trim()) {
        return { ok: false, error: 'Debes ingresar una justificación para el ajuste manual.' };
      }
      const nextQty = Math.round((item.quantity + delta) * 1000) / 1000;
      if (nextQty < 0 && !authorizeNegative) {
        return {
          ok: false,
          error: `El ajuste dejaría el inventario en ${nextQty} ${item.unit}. Activa la autorización explícita si deseas permitir saldo negativo.`,
        };
      }
      const today = getTodayISO();
      commitStateUpdate((prev) => ({
        ...prev,
        inventory: prev.inventory.map((i) =>
          i.id === itemId ? { ...i, quantity: nextQty, updatedAt: today } : i
        ),
        movements: [
          {
            id: generateId('mov'),
            inventoryItemId: itemId,
            itemName: item.name,
            type: 'ajuste_manual',
            quantity: delta,
            unit: item.unit,
            date: date || today,
            reason: reason.trim(),
            referenceType: 'manual',
            createdAt: today,
          },
          ...prev.movements,
        ],
      }));
      addToast('success', 'Ajuste registrado', `${item.name}: ${nextQty} ${item.unit}`);
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  const retireTool = useCallback(
    (itemId: string, date: string, reason: string, notes: string): ActionResult => {
      const item = dataRef.current.inventory.find((i) => i.id === itemId);
      if (!item) return { ok: false, error: 'Herramienta no encontrada.' };
      if (item.itemType !== 'herramienta') {
        return {
          ok: false,
          error: 'Solo las herramientas reutilizables pueden darse de baja aquí.',
        };
      }
      if (!reason.trim()) {
        return { ok: false, error: 'Ingresa el motivo de la baja de la herramienta.' };
      }
      const today = getTodayISO();
      commitStateUpdate((prev) => ({
        ...prev,
        inventory: prev.inventory.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: 'baja',
                quantity: 0,
                retiredAt: date || today,
                retireReason: reason.trim(),
                retireNotes: notes.trim(),
                updatedAt: today,
              }
            : i
        ),
        movements: [
          {
            id: generateId('mov'),
            inventoryItemId: itemId,
            itemName: item.name,
            type: 'baja_herramienta',
            quantity: -item.quantity,
            unit: item.unit,
            date: date || today,
            reason: `${reason.trim()}${notes.trim() ? ` · ${notes.trim()}` : ''}`,
            referenceType: 'baja',
            createdAt: today,
          },
          ...prev.movements,
        ],
      }));
      addToast('info', 'Herramienta dada de baja', item.name);
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  // --- CALCULADORA ---
  const saveCalculation = useCallback(
    (
      calc: Omit<SavedCalculation, 'id' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ): ActionResult => {
      if (!calc.productName.trim()) {
        return { ok: false, error: 'Ingresa el nombre del producto para guardar el cálculo.' };
      }
      const today = getTodayISO();
      if (existingId) {
        commitStateUpdate((prev) => ({
          ...prev,
          calculations: prev.calculations.map((c) =>
            c.id === existingId ? { ...c, ...calc, updatedAt: today } : c
          ),
        }));
        addToast('success', 'Cálculo actualizado', calc.productName);
        return { ok: true, id: existingId };
      }
      const id = generateId('calc');
      const newCalc: SavedCalculation = {
        ...calc,
        id,
        createdAt: today,
        updatedAt: today,
      };
      commitStateUpdate((prev) => ({
        ...prev,
        calculations: [newCalc, ...prev.calculations],
      }));
      addToast('success', 'Cálculo guardado', `${calc.productName} disponible para pedidos.`);
      return { ok: true, id };
    },
    [commitStateUpdate, addToast]
  );

  const deleteCalculation = useCallback(
    (id: string): ActionResult => {
      commitStateUpdate((prev) => ({
        ...prev,
        calculations: prev.calculations.filter((c) => c.id !== id),
      }));
      addToast('info', 'Cálculo eliminado');
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  // --- CLIENTES ---
  const addClient = useCallback(
    (client: Omit<Client, 'id' | 'createdAt'>): ActionResult => {
      if (!client.name.trim()) {
        return { ok: false, error: 'El nombre del cliente es obligatorio.' };
      }
      const id = generateId('cli');
      const newClient: Client = {
        ...client,
        name: client.name.trim(),
        id,
        createdAt: getTodayISO(),
      };
      commitStateUpdate((prev) => ({
        ...prev,
        clients: [newClient, ...prev.clients],
      }));
      addToast('success', 'Cliente registrado', newClient.name);
      return { ok: true, id };
    },
    [commitStateUpdate, addToast]
  );

  const updateClient = useCallback(
    (id: string, patch: Partial<Client>): ActionResult => {
      if (patch.name !== undefined && !patch.name.trim()) {
        return { ok: false, error: 'El nombre del cliente es obligatorio.' };
      }
      commitStateUpdate((prev) => ({
        ...prev,
        clients: prev.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        payments: patch.name
          ? prev.payments.map((p) =>
              p.clientId === id ? { ...p, clientName: patch.name!.trim() } : p
            )
          : prev.payments,
      }));
      addToast('success', 'Cliente actualizado');
      return { ok: true, id };
    },
    [commitStateUpdate, addToast]
  );

  const deleteClient = useCallback(
    (id: string): ActionResult => {
      const hasOrders = dataRef.current.orders.some((o) => o.clientId === id);
      if (hasOrders) {
        return {
          ok: false,
          error: 'No se puede eliminar un cliente con pedidos registrados en el historial.',
        };
      }
      commitStateUpdate((prev) => ({
        ...prev,
        clients: prev.clients.filter((c) => c.id !== id),
      }));
      addToast('info', 'Cliente eliminado');
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  // --- PEDIDOS ---
  const addOrder = useCallback(
    (input: OrderInput): ActionResult => {
      if (!input.clientId) {
        return { ok: false, error: 'Selecciona un cliente para el pedido.' };
      }
      if (input.items.length === 0) {
        return { ok: false, error: 'Agrega al menos un producto al pedido.' };
      }
      for (const item of input.items) {
        if (!item.productName.trim()) {
          return { ok: false, error: 'Todos los productos del pedido deben tener nombre.' };
        }
        if (item.quantity <= 0) {
          return { ok: false, error: 'La cantidad de cada producto debe ser mayor a cero.' };
        }
        if (item.unitSalePrice < 0) {
          return { ok: false, error: 'El precio de venta no puede ser negativo.' };
        }
      }

      const discountVal = Math.max(0, input.discount || 0);
      const itemsSubtotal = input.items.reduce(
        (sum, it) => sum + it.quantity * it.unitSalePrice,
        0
      );
      const orderTotal = Math.max(0, itemsSubtotal - discountVal);

      let initialPaymentAmount = 0;
      if (input.initialPayment && input.initialPayment.mode !== 'ninguno') {
        if (input.initialPayment.mode === 'total') {
          if (orderTotal <= 0) {
            return {
              ok: false,
              error: 'Para registrar pago total, el pedido debe tener un valor mayor a cero.',
            };
          }
          initialPaymentAmount = Math.round(orderTotal);
        } else if (input.initialPayment.mode === 'abono') {
          const abonoVal = Math.round(Number(input.initialPayment.amount) || 0);
          if (!Number.isFinite(abonoVal) || abonoVal <= 0) {
            return {
              ok: false,
              error: 'Ingresa el valor del abono recibido (mayor a cero).',
            };
          }
          if (abonoVal > orderTotal) {
            return {
              ok: false,
              error: `El abono no puede superar el total del pedido ($${orderTotal.toLocaleString('es-CO')} COP).`,
            };
          }
          initialPaymentAmount = abonoVal;
        }
      }

      const currentSnap = dataRef.current;
      const totalDeductByInvId = new Map<string, number>();
      const perItemAggregated = input.items.map((it) => {
        const map = new Map<string, number>();
        for (const row of it.materialsToDeduct || []) {
          if (!row.inventoryItemId || !Number.isFinite(row.quantity) || row.quantity <= 0) continue;
          const cleanQty = Math.round(row.quantity * 1000) / 1000;
          map.set(row.inventoryItemId, (map.get(row.inventoryItemId) || 0) + cleanQty);
          totalDeductByInvId.set(
            row.inventoryItemId,
            Math.round(((totalDeductByInvId.get(row.inventoryItemId) || 0) + cleanQty) * 1000) / 1000
          );
        }
        return map;
      });

      for (const [invId, totalQty] of totalDeductByInvId.entries()) {
        const invItem = currentSnap.inventory.find((i) => i.id === invId);
        if (!invItem) {
          return {
            ok: false,
            error: 'Uno de los elementos seleccionados ya no existe en el inventario.',
          };
        }
        if (invItem.itemType === 'herramienta') {
          return {
            ok: false,
            error: `"${invItem.name}" es una herramienta reutilizable y no se descuenta como material gastado.`,
          };
        }
        if (invItem.quantity - totalQty < 0 && !input.authorizeNegativeStock) {
          return {
            ok: false,
            error: `Existencias insuficientes de "${invItem.name}" (disponible: ${invItem.quantity} ${invItem.unit}, gastado: ${totalQty} ${invItem.unit}).`,
          };
        }
      }

      const nextNum =
        currentSnap.orders.reduce((max, o) => {
          const n = parseInt(o.orderNumber.replace(/\D/g, ''), 10);
          return Number.isFinite(n) ? Math.max(max, n) : max;
        }, 0) + 1;
      const orderNumber = `PED-${String(nextNum).padStart(3, '0')}`;
      const id = generateId('ord');
      const today = getTodayISO();

      const newMovements: InventoryMovement[] = [];
      const builtItems: OrderItem[] = input.items.map((it, idx) => {
        const itemDeductMap = perItemAggregated[idx];
        const consumedList: ConsumedMaterial[] = [];
        for (const [invId, qty] of itemDeductMap.entries()) {
          const invItem = currentSnap.inventory.find((i) => i.id === invId)!;
          const totalCost = Math.round(qty * invItem.unitCost);
          consumedList.push({
            inventoryItemId: invId,
            name: invItem.name,
            quantity: qty,
            unit: invItem.unit,
            unitCost: invItem.unitCost,
            totalCost,
          });
          newMovements.push({
            id: generateId('mov'),
            inventoryItemId: invId,
            itemName: invItem.name,
            type: 'salida_pedido',
            quantity: -qty,
            unit: invItem.unit,
            date: input.requestDate || today,
            reason: `Salida al confirmar ${orderNumber} (${it.productName.trim()})`,
            referenceType: 'pedido',
            referenceId: id,
            referenceLabel: orderNumber,
            createdAt: today,
          });
        }

        const hasDeducted = consumedList.length > 0;
        const totalMaterialsCost = consumedList.reduce((s, c) => s + c.totalCost, 0);
        const materialsPerUnit =
          it.quantity > 0 ? totalMaterialsCost / it.quantity : totalMaterialsCost;
        const realUnitCost = hasDeducted
          ? Math.round(materialsPerUnit + (it.laborAndExtrasPerUnit || 0))
          : 0;

        return {
          productName: it.productName.trim(),
          description: it.description.trim(),
          quantity: it.quantity,
          unitSalePrice: it.unitSalePrice,
          estimatedProductionCost: it.estimatedProductionCost,
          laborAndExtrasPerUnit: it.laborAndExtrasPerUnit,
          suggestedMaterials: it.suggestedMaterials,
          id: generateId('oi'),
          status: hasDeducted ? 'terminado' : 'pendiente',
          materialsDeducted: hasDeducted,
          materialsReturned: false,
          consumedMaterials: consumedList,
          actualProductionCost:
            hasDeducted && realUnitCost > 0
              ? realUnitCost
              : hasDeducted
              ? it.estimatedProductionCost
              : 0,
        };
      });

      const newOrder: Order = {
        id,
        orderNumber,
        clientId: input.clientId,
        requestDate: input.requestDate || today,
        deliveryDate: input.deliveryDate,
        status:
          builtItems.length > 0 && builtItems.every((bi) => bi.materialsDeducted)
            ? 'terminado'
            : 'pendiente',
        items: builtItems,
        discount: discountVal,
        observations: input.observations.trim(),
        createdAt: today,
        updatedAt: today,
      };

      let newPayment: Payment | null = null;
      if (initialPaymentAmount > 0 && input.initialPayment) {
        const client = currentSnap.clients.find((c) => c.id === input.clientId);
        newPayment = {
          id: generateId('pay'),
          orderId: id,
          orderNumber,
          clientId: input.clientId,
          clientName: client ? client.name : 'Cliente',
          date: input.initialPayment.date || input.requestDate || today,
          amount: initialPaymentAmount,
          method: input.initialPayment.method,
          observations:
            input.initialPayment.observations.trim() ||
            (input.initialPayment.mode === 'total'
              ? 'Pago total al registrar pedido'
              : 'Abono inicial al registrar pedido'),
          createdAt: today,
        };
      }

      commitStateUpdate((prev) => ({
        ...prev,
        inventory:
          totalDeductByInvId.size > 0
            ? prev.inventory.map((inv) => {
                const usedQty = totalDeductByInvId.get(inv.id);
                if (!usedQty) return inv;
                return {
                  ...inv,
                  quantity: Math.round((inv.quantity - usedQty) * 1000) / 1000,
                  updatedAt: today,
                };
              })
            : prev.inventory,
        movements:
          newMovements.length > 0 ? [...newMovements, ...prev.movements] : prev.movements,
        orders: [newOrder, ...prev.orders],
        payments: newPayment ? [newPayment, ...prev.payments] : prev.payments,
      }));

      const descParts: string[] = [];
      if (newPayment) {
        descParts.push(`Pago de $${initialPaymentAmount.toLocaleString('es-CO')} COP registrado.`);
      }
      if (totalDeductByInvId.size > 0) {
        descParts.push(
          `Se descontaron ${totalDeductByInvId.size} ${
            totalDeductByInvId.size === 1 ? 'elemento' : 'elementos'
          } del inventario.`
        );
      }

      addToast(
        'success',
        `Pedido ${orderNumber} confirmado`,
        descParts.length > 0
          ? descParts.join(' ')
          : 'Puedes descontar materiales después desde el detalle del pedido.'
      );
      return { ok: true, id };
    },
    [commitStateUpdate, addToast]
  );

  const updateOrder = useCallback(
    (
      orderId: string,
      patch: {
        clientId: string;
        requestDate: string;
        deliveryDate: string;
        discount: number;
        observations: string;
        items: OrderItem[];
        status: OrderStatus;
        pendingDeductions?: { itemId: string; materials: OrderConsumedMaterialInput[] }[];
        authorizeNegativeStock?: boolean;
      }
    ): ActionResult => {
      if (!patch.clientId) return { ok: false, error: 'Selecciona un cliente.' };
      if (patch.items.length === 0) return { ok: false, error: 'Debe haber al menos un producto.' };
      const currentSnap = dataRef.current;
      const existingOrder = currentSnap.orders.find((o) => o.id === orderId);
      if (!existingOrder) return { ok: false, error: 'Pedido no encontrado.' };

      const totalDeductByInvId = new Map<string, number>();
      const itemDeductMapByItemId = new Map<string, Map<string, number>>();

      for (const pd of patch.pendingDeductions || []) {
        const targetIt = patch.items.find((it) => it.id === pd.itemId);
        if (!targetIt || targetIt.materialsDeducted) continue;
        const map = new Map<string, number>();
        for (const row of pd.materials) {
          if (!row.inventoryItemId || !Number.isFinite(row.quantity) || row.quantity <= 0) continue;
          const cleanQty = Math.round(row.quantity * 1000) / 1000;
          map.set(row.inventoryItemId, (map.get(row.inventoryItemId) || 0) + cleanQty);
          totalDeductByInvId.set(
            row.inventoryItemId,
            Math.round(((totalDeductByInvId.get(row.inventoryItemId) || 0) + cleanQty) * 1000) / 1000
          );
        }
        if (map.size > 0) {
          itemDeductMapByItemId.set(pd.itemId, map);
        }
      }

      for (const [invId, totalQty] of totalDeductByInvId.entries()) {
        const invItem = currentSnap.inventory.find((i) => i.id === invId);
        if (!invItem) {
          return {
            ok: false,
            error: 'Uno de los elementos seleccionados ya no existe en el inventario.',
          };
        }
        if (invItem.itemType === 'herramienta') {
          return {
            ok: false,
            error: `"${invItem.name}" es una herramienta reutilizable y no se descuenta como material gastado.`,
          };
        }
        if (invItem.quantity - totalQty < 0 && !patch.authorizeNegativeStock) {
          return {
            ok: false,
            error: `Existencias insuficientes de "${invItem.name}" (disponible: ${invItem.quantity} ${invItem.unit}, gastado: ${totalQty} ${invItem.unit}).`,
          };
        }
      }

      const today = getTodayISO();
      const newMovements: InventoryMovement[] = [];
      const finalItems: OrderItem[] = patch.items.map((it) => {
        const deductMap = itemDeductMapByItemId.get(it.id);
        if (!deductMap || it.materialsDeducted) return it;

        const consumedList: ConsumedMaterial[] = [];
        for (const [invId, qty] of deductMap.entries()) {
          const invItem = currentSnap.inventory.find((i) => i.id === invId)!;
          const totalCost = Math.round(qty * invItem.unitCost);
          consumedList.push({
            inventoryItemId: invId,
            name: invItem.name,
            quantity: qty,
            unit: invItem.unit,
            unitCost: invItem.unitCost,
            totalCost,
          });
          newMovements.push({
            id: generateId('mov'),
            inventoryItemId: invId,
            itemName: invItem.name,
            type: 'salida_pedido',
            quantity: -qty,
            unit: invItem.unit,
            date: patch.requestDate || today,
            reason: `Consumo en ${existingOrder.orderNumber} (${it.productName})`,
            referenceType: 'pedido',
            referenceId: orderId,
            referenceLabel: existingOrder.orderNumber,
            createdAt: today,
          });
        }

        const totalMaterialsCost = consumedList.reduce((s, c) => s + c.totalCost, 0);
        const materialsPerUnit =
          it.quantity > 0 ? totalMaterialsCost / it.quantity : totalMaterialsCost;
        const realUnitCost = Math.round(materialsPerUnit + (it.laborAndExtrasPerUnit || 0));

        return {
          ...it,
          status: 'terminado',
          materialsDeducted: true,
          consumedMaterials: consumedList,
          actualProductionCost:
            realUnitCost > 0 ? realUnitCost : it.estimatedProductionCost,
        };
      });

      commitStateUpdate((prev) => ({
        ...prev,
        inventory:
          totalDeductByInvId.size > 0
            ? prev.inventory.map((inv) => {
                const usedQty = totalDeductByInvId.get(inv.id);
                if (!usedQty) return inv;
                return {
                  ...inv,
                  quantity: Math.round((inv.quantity - usedQty) * 1000) / 1000,
                  updatedAt: today,
                };
              })
            : prev.inventory,
        movements:
          newMovements.length > 0 ? [...newMovements, ...prev.movements] : prev.movements,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                clientId: patch.clientId,
                requestDate: patch.requestDate,
                deliveryDate: patch.deliveryDate,
                discount: patch.discount,
                observations: patch.observations,
                items: finalItems,
                status: patch.status,
                updatedAt: today,
              }
            : o
        ),
      }));
      addToast(
        'success',
        'Pedido actualizado',
        totalDeductByInvId.size > 0
          ? 'Se descontaron los materiales seleccionados del inventario.'
          : undefined
      );
      return { ok: true, id: orderId };
    },
    [commitStateUpdate, addToast]
  );

  const deleteOrder = useCallback(
    (orderId: string): ActionResult => {
      const order = dataRef.current.orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, error: 'Pedido no encontrado.' };
      const hasPayments = dataRef.current.payments.some((p) => p.orderId === orderId);
      if (hasPayments) {
        return {
          ok: false,
          error:
            'Este pedido tiene pagos o abonos registrados. Elimina primero sus pagos para poder borrar el pedido.',
        };
      }

      const restoreByInvId = new Map<string, number>();
      for (const item of order.items) {
        if (item.materialsDeducted && !item.materialsReturned) {
          for (const c of item.consumedMaterials) {
            restoreByInvId.set(
              c.inventoryItemId,
              Math.round(((restoreByInvId.get(c.inventoryItemId) || 0) + c.quantity) * 1000) / 1000
            );
          }
        }
      }

      const today = getTodayISO();
      commitStateUpdate((prev) => ({
        ...prev,
        inventory:
          restoreByInvId.size > 0
            ? prev.inventory.map((inv) => {
                const addBack = restoreByInvId.get(inv.id);
                if (!addBack) return inv;
                return {
                  ...inv,
                  quantity: Math.round((inv.quantity + addBack) * 1000) / 1000,
                  updatedAt: today,
                };
              })
            : prev.inventory,
        movements: prev.movements.filter(
          (m) => !(m.referenceType === 'pedido' && m.referenceId === orderId)
        ),
        orders: prev.orders.filter((o) => o.id !== orderId),
      }));
      addToast(
        'info',
        `Pedido ${order.orderNumber} eliminado`,
        restoreByInvId.size > 0
          ? 'Los materiales descontados regresaron al inventario.'
          : undefined
      );
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  const setOrderStatus = useCallback(
    (orderId: string, status: OrderStatus): ActionResult => {
      const order = dataRef.current.orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, error: 'Pedido no encontrado.' };
      if (status === 'entregado') {
        const unfinished = order.items.some((i) => i.status !== 'terminado');
        if (unfinished) {
          return {
            ok: false,
            error:
              'Marca todos los productos del pedido como terminados (registrando sus materiales) antes de marcar el pedido como entregado.',
          };
        }
      }
      const today = getTodayISO();
      commitStateUpdate((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId ? { ...o, status, updatedAt: today } : o
        ),
      }));
      addToast('success', `Pedido ${order.orderNumber} actualizado`);
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  const finishOrderItemWithMaterials = useCallback(
    (
      orderId: string,
      itemId: string,
      materialsUsed: { inventoryItemId: string; quantity: number }[],
      extraLaborAndWearPerUnit = 0,
      authorizeNegative = false
    ): ActionResult => {
      const currentSnap = dataRef.current;
      const order = currentSnap.orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, error: 'Pedido no encontrado.' };
      if (order.status === 'cancelado') {
        return { ok: false, error: 'No se pueden terminar productos de un pedido cancelado.' };
      }
      const targetItem = order.items.find((i) => i.id === itemId);
      if (!targetItem) return { ok: false, error: 'Producto no encontrado en el pedido.' };
      if (targetItem.materialsDeducted) {
        return {
          ok: false,
          error: 'Los materiales de este producto ya fueron descontados del inventario anteriormente.',
        };
      }

      const aggregated = new Map<string, number>();
      for (const row of materialsUsed) {
        if (!row.inventoryItemId || row.quantity <= 0) continue;
        aggregated.set(
          row.inventoryItemId,
          (aggregated.get(row.inventoryItemId) || 0) + row.quantity
        );
      }

      const consumedList: ConsumedMaterial[] = [];
      for (const [invId, totalQty] of aggregated.entries()) {
        const invItem = currentSnap.inventory.find((i) => i.id === invId);
        if (!invItem) {
          return { ok: false, error: 'Uno de los materiales seleccionados ya no existe en inventario.' };
        }
        if (invItem.itemType === 'herramienta') {
          return {
            ok: false,
            error: `"${invItem.name}" es una herramienta reutilizable y no debe descontarse como material consumible.`,
          };
        }
        if (invItem.quantity - totalQty < 0 && !authorizeNegative) {
          return {
            ok: false,
            error: `Existencias insuficientes de "${invItem.name}" (disponible: ${invItem.quantity} ${invItem.unit}, requerido: ${totalQty} ${invItem.unit}).`,
          };
        }
        const totalCost = Math.round(totalQty * invItem.unitCost);
        consumedList.push({
          inventoryItemId: invId,
          name: invItem.name,
          quantity: totalQty,
          unit: invItem.unit,
          unitCost: invItem.unitCost,
          totalCost,
        });
      }

      const today = getTodayISO();
      const totalMaterialsCost = consumedList.reduce((s, c) => s + c.totalCost, 0);
      const materialsPerUnit =
        targetItem.quantity > 0 ? totalMaterialsCost / targetItem.quantity : totalMaterialsCost;
      const realUnitProductionCost = Math.round(
        materialsPerUnit +
          (extraLaborAndWearPerUnit || targetItem.laborAndExtrasPerUnit || 0)
      );

      commitStateUpdate((prev) => {
        const updatedInventory = prev.inventory.map((inv) => {
          const usedQty = aggregated.get(inv.id);
          if (!usedQty) return inv;
          return {
            ...inv,
            quantity: Math.round((inv.quantity - usedQty) * 1000) / 1000,
            updatedAt: today,
          };
        });

        const newMovements: InventoryMovement[] = consumedList.map((c) => ({
          id: generateId('mov'),
          inventoryItemId: c.inventoryItemId,
          itemName: c.name,
          type: 'salida_pedido',
          quantity: -c.quantity,
          unit: c.unit,
          date: today,
          reason: `Consumo real en ${targetItem.productName} (${targetItem.quantity} uds)`,
          referenceType: 'pedido',
          referenceId: order.id,
          referenceLabel: order.orderNumber,
          createdAt: today,
        }));

        const updatedOrders: Order[] = prev.orders.map((o) => {
          if (o.id !== orderId) return o;
          const updatedItems: OrderItem[] = o.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  status: 'terminado',
                  materialsDeducted: true,
                  consumedMaterials: consumedList,
                  actualProductionCost:
                    realUnitProductionCost > 0
                      ? realUnitProductionCost
                      : it.estimatedProductionCost,
                  laborAndExtrasPerUnit:
                    extraLaborAndWearPerUnit || it.laborAndExtrasPerUnit || 0,
                }
              : it
          );
          const allFinished = updatedItems.every((it) => it.status === 'terminado');
          const nextStatus: OrderStatus =
            o.status === 'entregado'
              ? 'entregado'
              : allFinished
              ? 'terminado'
              : 'en_proceso';
          return {
            ...o,
            items: updatedItems,
            status: nextStatus,
            updatedAt: today,
          };
        });

        return {
          ...prev,
          inventory: updatedInventory,
          movements: [...newMovements, ...prev.movements],
          orders: updatedOrders,
        };
      });

      addToast(
        'success',
        'Producto terminado y materiales descontados',
        `${targetItem.productName} en ${order.orderNumber}.`
      );
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  const cancelOrderWithReturns = useCallback(
    (orderId: string, returns: ReturnMaterialInput[]): ActionResult => {
      const order = dataRef.current.orders.find((o) => o.id === orderId);
      if (!order) return { ok: false, error: 'Pedido no encontrado.' };
      if (order.status === 'cancelado') {
        return { ok: false, error: 'El pedido ya se encuentra cancelado.' };
      }

      const today = getTodayISO();
      const validReturns = returns.filter((r) => r.quantity > 0);
      const returnTotalsByInv = new Map<string, number>();

      for (const ret of validReturns) {
        const item = order.items.find((i) => i.id === ret.itemId);
        if (!item || !item.materialsDeducted || item.materialsReturned) continue;
        const consumed = item.consumedMaterials.find(
          (c) => c.inventoryItemId === ret.inventoryItemId
        );
        if (!consumed) continue;
        const clampedQty = Math.min(ret.quantity, consumed.quantity);
        if (clampedQty > 0) {
          returnTotalsByInv.set(
            ret.inventoryItemId,
            (returnTotalsByInv.get(ret.inventoryItemId) || 0) + clampedQty
          );
        }
      }

      commitStateUpdate((prev) => {
        const updatedInventory = prev.inventory.map((inv) => {
          const addBack = returnTotalsByInv.get(inv.id);
          if (!addBack) return inv;
          return {
            ...inv,
            quantity: Math.round((inv.quantity + addBack) * 1000) / 1000,
            updatedAt: today,
          };
        });

        const newMovements: InventoryMovement[] = Array.from(
          returnTotalsByInv.entries()
        ).map(([invId, qty]) => {
          const inv = prev.inventory.find((i) => i.id === invId);
          return {
            id: generateId('mov'),
            inventoryItemId: invId,
            itemName: inv ? inv.name : 'Material devuelto',
            type: 'devolucion_material',
            quantity: qty,
            unit: inv ? inv.unit : 'unidades',
            date: today,
            reason: `Devolución de material recuperable por cancelación de ${order.orderNumber}`,
            referenceType: 'pedido',
            referenceId: order.id,
            referenceLabel: order.orderNumber,
            createdAt: today,
          };
        });

        const updatedOrders = prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'cancelado' as OrderStatus,
                items: o.items.map((it) =>
                  it.materialsDeducted ? { ...it, materialsReturned: true } : it
                ),
                updatedAt: today,
              }
            : o
        );

        return {
          ...prev,
          inventory: updatedInventory,
          movements: [...newMovements, ...prev.movements],
          orders: updatedOrders,
        };
      });

      addToast(
        'info',
        `Pedido ${order.orderNumber} cancelado`,
        returnTotalsByInv.size > 0
          ? 'Se registró la devolución de los materiales recuperables.'
          : 'No se generaron salidas ni devoluciones de inventario.'
      );
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  // --- PAGOS ---
  const addPayment = useCallback(
    (input: {
      orderId: string;
      date: string;
      amount: number;
      method: PaymentMethod;
      observations: string;
    }): ActionResult => {
      const currentSnap = dataRef.current;
      const order = currentSnap.orders.find((o) => o.id === input.orderId);
      if (!order) return { ok: false, error: 'Selecciona un pedido válido.' };
      if (order.status === 'cancelado') {
        return { ok: false, error: 'No se pueden registrar pagos a un pedido cancelado.' };
      }
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        return { ok: false, error: 'El valor recibido debe ser mayor a cero.' };
      }
      const pending = getOrderPending(order);
      if (input.amount > pending) {
        return {
          ok: false,
          error: `El abono supera el saldo pendiente del pedido ($${pending.toLocaleString('es-CO')} COP).`,
        };
      }
      const client = currentSnap.clients.find((c) => c.id === order.clientId);
      const id = generateId('pay');
      const today = getTodayISO();

      const newPayment: Payment = {
        id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        clientId: order.clientId,
        clientName: client ? client.name : 'Cliente',
        date: input.date || today,
        amount: Math.round(input.amount),
        method: input.method,
        observations: input.observations.trim(),
        createdAt: today,
      };

      commitStateUpdate((prev) => ({
        ...prev,
        payments: [newPayment, ...prev.payments],
      }));
      addToast('success', 'Pago registrado', `${order.orderNumber} actualizado.`);
      return { ok: true, id };
    },
    [commitStateUpdate, getOrderPending, addToast]
  );

  const updatePayment = useCallback(
    (
      paymentId: string,
      patch: { date: string; amount: number; method: PaymentMethod; observations: string }
    ): ActionResult => {
      const currentSnap = dataRef.current;
      const existing = currentSnap.payments.find((p) => p.id === paymentId);
      if (!existing) return { ok: false, error: 'Pago no encontrado.' };
      if (!Number.isFinite(patch.amount) || patch.amount <= 0) {
        return { ok: false, error: 'El valor del pago debe ser mayor a cero.' };
      }
      const order = currentSnap.orders.find((o) => o.id === existing.orderId);
      if (order) {
        const otherPaid = currentSnap.payments
          .filter((p) => p.orderId === order.id && p.id !== paymentId)
          .reduce((s, p) => s + p.amount, 0);
        const maxAllowed = Math.max(0, getOrderTotal(order) - otherPaid);
        if (patch.amount > maxAllowed) {
          return {
            ok: false,
            error: `El monto supera el total pendiente disponible ($${maxAllowed.toLocaleString('es-CO')} COP).`,
          };
        }
      }
      commitStateUpdate((prev) => ({
        ...prev,
        payments: prev.payments.map((p) =>
          p.id === paymentId ? { ...p, ...patch, amount: Math.round(patch.amount) } : p
        ),
      }));
      addToast('success', 'Pago actualizado');
      return { ok: true, id: paymentId };
    },
    [commitStateUpdate, getOrderTotal, addToast]
  );

  const deletePayment = useCallback(
    (paymentId: string): ActionResult => {
      commitStateUpdate((prev) => ({
        ...prev,
        payments: prev.payments.filter((p) => p.id !== paymentId),
      }));
      addToast('info', 'Pago eliminado', 'El saldo pendiente fue recalculado.');
      return { ok: true };
    },
    [commitStateUpdate, addToast]
  );

  // --- GESTIÓN DE DATOS ---
  const resetToSeedData = useCallback(() => {
    commitStateUpdate(() => createSeedData());
    addToast('info', 'Datos de ejemplo restaurados');
  }, [commitStateUpdate, addToast]);

  const clearAllData = useCallback(() => {
    commitStateUpdate(() => createEmptyData());
    addToast('info', 'Todos los registros han sido vaciados');
  }, [commitStateUpdate, addToast]);

  const importJsonData = useCallback(
    (rawJson: string): ActionResult => {
      try {
        const parsed = JSON.parse(rawJson) as Partial<AppStateData>;
        if (
          !parsed ||
          !Array.isArray(parsed.inventory) ||
          !Array.isArray(parsed.purchases) ||
          !Array.isArray(parsed.orders)
        ) {
          return { ok: false, error: 'El archivo JSON no tiene el formato válido de Dinemelly.' };
        }
        const cleanData: AppStateData = {
          inventory: (parsed.inventory || []).map((d) =>
            normalizeCollectionDoc('inventory', d as unknown as Record<string, unknown>) as unknown as InventoryItem
          ),
          purchases: (parsed.purchases || []).map((d) =>
            normalizeCollectionDoc('purchases', d as unknown as Record<string, unknown>) as unknown as Purchase
          ),
          movements: (parsed.movements || []).map((d) =>
            normalizeCollectionDoc('movements', d as unknown as Record<string, unknown>) as unknown as InventoryMovement
          ),
          calculations: (parsed.calculations || []).map((d) =>
            normalizeCollectionDoc('calculations', d as unknown as Record<string, unknown>) as unknown as SavedCalculation
          ),
          clients: (parsed.clients || []).map((d) =>
            normalizeCollectionDoc('clients', d as unknown as Record<string, unknown>) as unknown as Client
          ),
          orders: (parsed.orders || []).map((d) =>
            normalizeCollectionDoc('orders', d as unknown as Record<string, unknown>) as unknown as Order
          ),
          payments: (parsed.payments || []).map((d) =>
            normalizeCollectionDoc('payments', d as unknown as Record<string, unknown>) as unknown as Payment
          ),
        };
        commitStateUpdate(() => cleanData);
        addToast('success', 'Respaldo importado correctamente');
        return { ok: true };
      } catch {
        return { ok: false, error: 'No se pudo leer el archivo JSON.' };
      }
    },
    [commitStateUpdate, addToast]
  );

  return (
    <DinemellyContext.Provider
      value={{
        user,
        authReady,
        dataLoading,
        monthlyBudget,
        updateMonthlyBudget,
        signOutUser,
        data,
        activeModule,
        setActiveModule,
        calculatorDraftCalculation,
        setCalculatorDraftCalculation,
        pendingOrderDraftFromCalc,
        setPendingOrderDraftFromCalc,
        preselectedPurchaseMaterialId,
        setPreselectedPurchaseMaterialId,
        autoOpenCreateFor,
        setAutoOpenCreateFor,
        toasts,
        addToast,
        dismissToast,
        getOrderTotal,
        getOrderPaid,
        getOrderPending,
        getOrderPaymentStatus,
        getOrderCost,
        getOrderProfit,
        addPurchase,
        updatePurchase,
        deletePurchase,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        adjustInventoryStock,
        retireTool,
        saveCalculation,
        deleteCalculation,
        addClient,
        updateClient,
        deleteClient,
        addOrder,
        updateOrder,
        deleteOrder,
        setOrderStatus,
        finishOrderItemWithMaterials,
        cancelOrderWithReturns,
        addPayment,
        updatePayment,
        deletePayment,
        resetToSeedData,
        clearAllData,
        importJsonData,
      }}
    >
      {children}
    </DinemellyContext.Provider>
  );
};

export function useDinemelly(): DinemellyContextValue {
  const ctx = useContext(DinemellyContext);
  if (!ctx) throw new Error('useDinemelly must be used inside DinemellyProvider');
  return ctx;
}
