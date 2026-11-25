export type MaterialCategory =
  | 'Hilos y lanas'
  | 'Rellenos'
  | 'Accesorios y adornos'
  | 'Botones y cierres'
  | 'Empaques'
  | 'Etiquetas'
  | 'Herramientas'
  | 'Otros materiales';

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'Hilos y lanas',
  'Rellenos',
  'Accesorios y adornos',
  'Botones y cierres',
  'Empaques',
  'Etiquetas',
  'Herramientas',
  'Otros materiales',
];

export const COMMON_UNITS = [
  'g',
  'm',
  'ovillos',
  'unidades',
  'pares',
  'paquetes',
  'bolsas',
  'rollos',
];

export type InventoryItemType = 'consumible' | 'herramienta';

export interface InventoryItem {
  id: string;
  name: string;
  category: MaterialCategory;
  itemType: InventoryItemType;
  quantity: number;
  unit: string;
  unitCost: number; // Valorado al costo más alto histórico
  minStock: number;
  observations: string;
  // Campos exclusivos para herramientas reutilizables
  estimatedWearCost: number; // Costo estimado de desgaste proporcional por producto
  status: 'activo' | 'baja';
  retiredAt?: string;
  retireReason?: string;
  retireNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  code: string;
  inventoryItemId: string;
  materialName: string;
  category: MaterialCategory;
  itemType: InventoryItemType;
  quantity: number; // Cantidad real en la unidad de inventario (ej. 150 g)
  unit: string; // Unidad real en inventario (ej. g)
  purchasedQuantity?: number; // Cantidad comprada en presentación (ej. 3 rollos)
  purchasedUnit?: string; // Presentación comprada (ej. rollos, paquetes)
  contentPerUnit?: number; // Contenido real por cada unidad comprada (ej. 50 g)
  totalPrice: number;
  unitCost: number; // totalPrice / quantity
  supplier: string;
  date: string; // YYYY-MM-DD
  invoiceRef: string;
  observations: string;
  createdAt: string;
}

export type MovementType =
  | 'entrada_compra'
  | 'salida_pedido'
  | 'ajuste_manual'
  | 'devolucion_material'
  | 'baja_herramienta';

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  itemName: string;
  type: MovementType;
  quantity: number; // positivo = entrada, negativo = salida (o magnitud con tipo)
  unit: string;
  date: string;
  reason: string;
  referenceType?: 'compra' | 'pedido' | 'manual' | 'baja';
  referenceId?: string;
  referenceLabel?: string;
  createdAt: string;
}

export type CalculatorCostCategory =
  | 'Materiales'
  | 'Empaques'
  | 'Etiquetas'
  | 'Bolsas'
  | 'Botones'
  | 'Adornos y accesorios'
  | 'Otros';

export const CALCULATOR_COST_CATEGORIES: CalculatorCostCategory[] = [
  'Materiales',
  'Empaques',
  'Etiquetas',
  'Bolsas',
  'Botones',
  'Adornos y accesorios',
  'Otros',
];

export interface CalculationMaterialRow {
  id: string;
  inventoryItemId?: string;
  name: string;
  categoryLabel: CalculatorCostCategory;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  isFromInventory: boolean;
}

export interface SavedCalculation {
  id: string;
  productName: string;
  materials: CalculationMaterialRow[];
  laborMode: 'tiempo' | 'fijo';
  timeValue: number;
  timeUnit: 'horas' | 'minutos';
  hourlyRate: number;
  laborCost: number;
  toolsWearAuto: number;
  toolsWearCost: number;
  additionalCosts: number;
  totalProductionCost: number;
  desiredMarginPercent: number;
  suggestedPrice: number;
  finalSalePrice: number;
  estimatedProfit: number;
  actualMarginPercent: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  observations: string;
  createdAt: string;
}

export interface ConsumedMaterial {
  inventoryItemId: string;
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export type OrderItemStatus = 'pendiente' | 'en_proceso' | 'terminado';

export interface OrderItem {
  id: string;
  productName: string;
  description: string;
  quantity: number;
  unitSalePrice: number;
  estimatedProductionCost: number; // costo unitario estimado de producción
  actualProductionCost: number; // costo unitario real tras registrar materiales
  status: OrderItemStatus;
  materialsDeducted: boolean;
  materialsReturned: boolean;
  consumedMaterials: ConsumedMaterial[];
  suggestedMaterials?: CalculationMaterialRow[]; // opcional si viene de calculadora
  laborAndExtrasPerUnit?: number; // mano de obra + desgaste + extras para sumar al costo real
}

export type OrderStatus =
  | 'pendiente'
  | 'en_proceso'
  | 'terminado'
  | 'entregado'
  | 'cancelado';

export interface Order {
  id: string;
  orderNumber: string; // PED-001
  clientId: string;
  requestDate: string;
  deliveryDate: string;
  status: OrderStatus;
  items: OrderItem[];
  discount: number;
  observations: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Otro';

export const PAYMENT_METHODS: PaymentMethod[] = ['Efectivo', 'Transferencia', 'Otro'];

export type PaymentStatus = 'Pendiente' | 'Parcialmente pagado' | 'Pagado';

export interface Payment {
  id: string;
  orderId: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  observations: string;
  createdAt: string;
}

export type ActiveModule =
  | 'dashboard'
  | 'compras'
  | 'inventario'
  | 'calculadora'
  | 'pedidos'
  | 'clientes'
  | 'ventas'
  | 'estadisticas';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}
