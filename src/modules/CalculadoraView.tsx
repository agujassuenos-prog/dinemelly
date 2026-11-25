import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  ClipboardPlus,
  FolderOpen,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useDinemelly } from '../store/useDinemellyStore';
import {
  CALCULATOR_COST_CATEGORIES,
  CalculationMaterialRow,
  CalculatorCostCategory,
  COMMON_UNITS,
  SavedCalculation,
} from '../types';
import { formatCOP, formatNumber, generateId } from '../utils/format';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { NumberInput } from '../components/ui/NumberInput';

export const CalculadoraView: React.FC = () => {
  const {
    data,
    saveCalculation,
    deleteCalculation,
    setActiveModule,
    setPendingOrderDraftFromCalc,
    calculatorDraftCalculation,
    setCalculatorDraftCalculation,
    addToast,
  } = useDinemelly();

  const consumables = useMemo(
    () => data.inventory.filter((i) => i.status === 'activo' && i.itemType === 'consumible'),
    [data.inventory]
  );

  const activeTools = useMemo(
    () => data.inventory.filter((i) => i.status === 'activo' && i.itemType === 'herramienta'),
    [data.inventory]
  );

  const autoToolsWearTotal = useMemo(
    () => activeTools.reduce((s, t) => s + (t.estimatedWearCost || 0), 0),
    [activeTools]
  );

  const [editingCalcId, setEditingCalcId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [materials, setMaterials] = useState<CalculationMaterialRow[]>([
    {
      id: generateId('row'),
      name: '',
      categoryLabel: 'Materiales',
      quantity: 1,
      unit: 'g',
      unitCost: 0,
      totalCost: 0,
      isFromInventory: false,
    },
  ]);

  const [laborMode, setLaborMode] = useState<'tiempo' | 'fijo'>('tiempo');
  const [timeValue, setTimeValue] = useState<number>(2);
  const [timeUnit, setTimeUnit] = useState<'horas' | 'minutos'>('horas');
  const [hourlyRate, setHourlyRate] = useState<number>(10000);
  const [manualLaborCost, setManualLaborCost] = useState<number>(20000);

  const [toolsWearManual, setToolsWearManual] = useState<number | null>(null);
  const [additionalCosts, setAdditionalCosts] = useState<number>(0);
  const [desiredMarginPercent, setDesiredMarginPercent] = useState<number>(40);
  const [manualSalePrice, setManualSalePrice] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SavedCalculation | null>(null);
  const [hasCalculatorStarted, setHasCalculatorStarted] = useState(false);

  const loadCalculationIntoEditor = (calc: SavedCalculation) => {
    setHasCalculatorStarted(true);
    setEditingCalcId(calc.id);
    setProductName(calc.productName);
    setMaterials(
      calc.materials.length > 0
        ? calc.materials.map((m) => ({ ...m, id: m.id || generateId('row') }))
        : []
    );
    setLaborMode(calc.laborMode);
    setTimeValue(calc.timeValue);
    setTimeUnit(calc.timeUnit);
    setHourlyRate(calc.hourlyRate);
    setManualLaborCost(calc.laborCost);
    setToolsWearManual(calc.toolsWearCost);
    setAdditionalCosts(calc.additionalCosts);
    setDesiredMarginPercent(calc.desiredMarginPercent);
    setManualSalePrice(calc.finalSalePrice);
    setNotes(calc.notes);
    setFormError('');
  };

  useEffect(() => {
    if (calculatorDraftCalculation) {
      loadCalculationIntoEditor(calculatorDraftCalculation);
      setCalculatorDraftCalculation(null);
    }
  }, [calculatorDraftCalculation, setCalculatorDraftCalculation]);

  const resetCalculator = () => {
    setEditingCalcId(null);
    setProductName('');
    setMaterials([
      {
        id: generateId('row'),
        name: '',
        categoryLabel: 'Materiales',
        quantity: 1,
        unit: 'g',
        unitCost: 0,
        totalCost: 0,
        isFromInventory: false,
      },
    ]);
    setLaborMode('tiempo');
    setTimeValue(2);
    setTimeUnit('horas');
    setHourlyRate(10000);
    setManualLaborCost(20000);
    setToolsWearManual(null);
    setAdditionalCosts(0);
    setDesiredMarginPercent(40);
    setManualSalePrice(null);
    setNotes('');
    setFormError('');
    setHasCalculatorStarted(false);
  };

  // Cálculos en vivo
  const materialsSubtotal = useMemo(
    () => materials.reduce((s, m) => s + (Number(m.totalCost) || 0), 0),
    [materials]
  );

  const laborCost = useMemo(() => {
    if (laborMode === 'fijo') return Math.max(0, Number(manualLaborCost) || 0);
    const hours =
      timeUnit === 'minutos'
        ? (Number(timeValue) || 0) / 60
        : Number(timeValue) || 0;
    return Math.round(Math.max(0, hours * (Number(hourlyRate) || 0)));
  }, [laborMode, manualLaborCost, timeUnit, timeValue, hourlyRate]);

  const toolsWearCost =
    toolsWearManual !== null ? Math.max(0, toolsWearManual) : autoToolsWearTotal;

  const totalProductionCost = Math.round(
    materialsSubtotal + laborCost + toolsWearCost + Math.max(0, Number(additionalCosts) || 0)
  );

  const safeMargin = Math.min(95, Math.max(0, Number(desiredMarginPercent) || 0));
  const suggestedPrice =
    safeMargin >= 100
      ? totalProductionCost
      : Math.round(totalProductionCost / (1 - safeMargin / 100));

  const finalSalePrice =
    manualSalePrice !== null ? Math.max(0, Math.round(manualSalePrice)) : suggestedPrice;

  const estimatedProfit = finalSalePrice - totalProductionCost;
  const actualMarginPercent =
    finalSalePrice > 0
      ? Math.round(((finalSalePrice - totalProductionCost) / finalSalePrice) * 10000) / 100
      : 0;
  const markupOnCostPercent =
    totalProductionCost > 0
      ? Math.round(((finalSalePrice - totalProductionCost) / totalProductionCost) * 10000) / 100
      : 0;

  // Manipulación de filas de materiales
  const addMaterialRow = (defaultCategory: CalculatorCostCategory = 'Materiales') => {
    setHasCalculatorStarted(true);
    setMaterials((prev) => [
      ...prev,
      {
        id: generateId('row'),
        name: '',
        categoryLabel: defaultCategory,
        quantity: 1,
        unit: defaultCategory === 'Materiales' ? 'g' : 'unidades',
        unitCost: 0,
        totalCost: 0,
        isFromInventory: false,
      },
    ]);
  };

  const removeMaterialRow = (rowId: string) => {
    setMaterials((prev) => prev.filter((r) => r.id !== rowId));
  };

  const updateRowInventorySelection = (rowId: string, invId: string) => {
    setHasCalculatorStarted(true);
    const inv = consumables.find((i) => i.id === invId);
    setMaterials((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (!inv) {
          return {
            ...row,
            inventoryItemId: undefined,
            isFromInventory: false,
          };
        }
        const qty = row.quantity > 0 ? row.quantity : 1;
        return {
          ...row,
          inventoryItemId: inv.id,
          name: inv.name,
          unit: inv.unit,
          unitCost: inv.unitCost,
          totalCost: Math.round(qty * inv.unitCost),
          isFromInventory: true,
        };
      })
    );
  };

  const updateRowField = (
    rowId: string,
    patch: Partial<CalculationMaterialRow>
  ) => {
    setHasCalculatorStarted(true);
    setMaterials((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        next.totalCost = Math.round((Number(next.quantity) || 0) * (Number(next.unitCost) || 0));
        return next;
      })
    );
  };

  const buildCurrentCalculationObject = (): Omit<
    SavedCalculation,
    'id' | 'createdAt' | 'updatedAt'
  > => ({
    productName: productName.trim(),
    materials: materials.filter((m) => m.name.trim() !== '' || m.totalCost > 0),
    laborMode,
    timeValue,
    timeUnit,
    hourlyRate,
    laborCost,
    toolsWearAuto: autoToolsWearTotal,
    toolsWearCost,
    additionalCosts: Math.max(0, Number(additionalCosts) || 0),
    totalProductionCost,
    desiredMarginPercent: safeMargin,
    suggestedPrice,
    finalSalePrice,
    estimatedProfit,
    actualMarginPercent,
    notes: notes.trim(),
  });

  const handleSave = () => {
    setFormError('');
    if (!productName.trim()) {
      setFormError('Ingresa el nombre del producto antes de guardar el cálculo.');
      return;
    }
    const res = saveCalculation(
      buildCurrentCalculationObject(),
      editingCalcId || undefined
    );
    if (!res.ok) {
      setFormError(res.error || 'Error al guardar.');
      return;
    }
    if (res.id) setEditingCalcId(res.id);
  };

  const handleUseInOrder = () => {
    if (!productName.trim()) {
      addToast('error', 'Falta el nombre del producto', 'Escribe el nombre del producto para enviarlo a un pedido.');
      return;
    }
    const calcObj: SavedCalculation = {
      ...buildCurrentCalculationObject(),
      id: editingCalcId || generateId('draft'),
      createdAt: '',
      updatedAt: '',
    };
    setPendingOrderDraftFromCalc(calcObj);
    setActiveModule('pedidos');
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Columna izquierda: Constructor flexible */}
        <div className="xl:col-span-7 space-y-5">
          <div className="bg-white border border-[#E7E3DC] rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E7E3DC]">
              <div>
                <h2 className="text-base font-semibold text-[#1F1C19]">
                  Datos del producto y materiales
                </h2>
                <p className="text-xs text-[#6E675F]">
                  Selecciona insumos del inventario o ingresa costos manualmente sin crear recetas fijas.
                </p>
              </div>
              <button
                type="button"
                onClick={resetCalculator}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#5A5550] bg-[#FAF9F7] border border-[#D9D3CA] hover:bg-[#F3F0EB] rounded-lg whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs font-medium text-[#B91C1C]">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Nombre del producto *
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  if (e.target.value.trim()) setHasCalculatorStarted(true);
                }}
                placeholder="Ej. Conejita amigurumi con vestido, Ramo 5 girasoles..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />
            </div>

            {/* Listado dinámico de materiales, empaques, etiquetas y accesorios */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#1F1C19]">
                  Materiales, empaques, etiquetas y accesorios
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => addMaterialRow('Materiales')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#7C3A52] bg-[#FAF9F7] border border-[#D9D3CA] hover:bg-[#F3F0EB] rounded-lg whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar material / costo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addMaterialRow('Empaques')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#5A5550] bg-white border border-[#D9D3CA] hover:bg-[#F3F0EB] rounded-lg whitespace-nowrap"
                  >
                    + Empaque / bolsa
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {materials.map((row, idx) => (
                  <div
                    key={row.id}
                    className="p-3.5 rounded-lg border border-[#E7E3DC] bg-[#FAF9F7] space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#6E675F]">
                        Elemento #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={row.categoryLabel}
                          onChange={(e) =>
                            updateRowField(row.id, {
                              categoryLabel: e.target.value as CalculatorCostCategory,
                            })
                          }
                          aria-label="Tipo de costo"
                          className="px-2 py-1 text-xs bg-white border border-[#D9D3CA] rounded-md"
                        >
                          {CALCULATOR_COST_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMaterialRow(row.id)}
                          aria-label="Quitar fila"
                          className="p-1 text-[#6E675F] hover:text-[#B91C1C]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-[#6E675F] mb-0.5">
                          Tomar de inventario (opcional)
                        </label>
                        <select
                          value={row.inventoryItemId || ''}
                          onChange={(e) =>
                            updateRowInventorySelection(row.id, e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D9D3CA] rounded-md focus:outline-none focus:border-[#7C3A52]"
                        >
                          <option value="">-- Ingreso manual sin inventario --</option>
                          {consumables.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name} ({formatCOP(inv.unitCost)}/{inv.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#6E675F] mb-0.5">
                          Nombre del material o elemento
                        </label>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) =>
                            updateRowField(row.id, { name: e.target.value })
                          }
                          placeholder="Ej. Cinta satinada, botón madera..."
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D9D3CA] rounded-md focus:outline-none focus:border-[#7C3A52]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                      <div>
                        <label className="block text-[11px] text-[#6E675F] mb-0.5">
                          Cantidad usada
                        </label>
                        <NumberInput
                          allowDecimal
                          value={row.quantity}
                          onChangeValue={(val) =>
                            updateRowField(row.id, { quantity: val })
                          }
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#6E675F] mb-0.5">
                          Unidad
                        </label>
                        <select
                          value={row.unit}
                          onChange={(e) =>
                            updateRowField(row.id, { unit: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-[#D9D3CA] rounded-md"
                        >
                          {COMMON_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#6E675F] mb-0.5">
                          Costo unit. (COP)
                        </label>
                        <NumberInput
                          allowDecimal
                          value={row.unitCost}
                          onChangeValue={(val) =>
                            updateRowField(row.id, { unitCost: val })
                          }
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-md"
                        />
                      </div>
                      <div className="text-right">
                        <span className="block text-[11px] text-[#6E675F]">Costo total</span>
                        <span className="font-mono text-xs font-bold tabular-nums text-[#1F1C19]">
                          {formatCOP(row.totalCost)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mano de obra */}
            <div className="pt-4 border-t border-[#E7E3DC] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#1F1C19]">
                  Mano de obra artesanal
                </span>
                <div className="flex items-center gap-1 p-0.5 bg-[#F3F0EB] rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setHasCalculatorStarted(true);
                      setLaborMode('tiempo');
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      laborMode === 'tiempo'
                        ? 'bg-white text-[#1F1C19] shadow-sm'
                        : 'text-[#6E675F]'
                    }`}
                  >
                    Por tiempo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasCalculatorStarted(true);
                      setLaborMode('fijo');
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      laborMode === 'fijo'
                        ? 'bg-white text-[#1F1C19] shadow-sm'
                        : 'text-[#6E675F]'
                    }`}
                  >
                    Valor fijo directo
                  </button>
                </div>
              </div>

              {laborMode === 'tiempo' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-1">
                      Tiempo de elaboración
                    </label>
                    <NumberInput
                      allowDecimal
                      value={timeValue}
                      onChangeValue={(val) => {
                        setHasCalculatorStarted(true);
                        setTimeValue(val);
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-1">
                      Unidad de tiempo
                    </label>
                    <select
                      value={timeUnit}
                      onChange={(e) => {
                        setHasCalculatorStarted(true);
                        setTimeUnit(e.target.value as 'horas' | 'minutos');
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
                    >
                      <option value="horas">Horas</option>
                      <option value="minutos">Minutos</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-1">
                      Valor por hora (COP)
                    </label>
                    <NumberInput
                      allowDecimal={false}
                      value={hourlyRate}
                      onChangeValue={(val) => {
                        setHasCalculatorStarted(true);
                        setHourlyRate(val);
                      }}
                      placeholder="Ej. 10000"
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div className="sm:w-1/2">
                  <label className="block text-[11px] text-[#6E675F] mb-1">
                    Valor directo de mano de obra (COP)
                  </label>
                  <NumberInput
                    allowDecimal={false}
                    value={manualLaborCost}
                    onChangeValue={(val) => {
                      setHasCalculatorStarted(true);
                      setManualLaborCost(val);
                    }}
                    placeholder="Ej. 25000"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Desgaste de herramientas + costos adicionales */}
            <div className="pt-4 border-t border-[#E7E3DC] grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#1F1C19]">
                    Desgaste de herramientas (COP)
                  </label>
                  {toolsWearManual !== null && (
                    <button
                      type="button"
                      onClick={() => setToolsWearManual(null)}
                      className="text-[11px] text-[#7C3A52] hover:underline"
                    >
                      Usar sugerido ({formatCOP(autoToolsWearTotal)})
                    </button>
                  )}
                </div>
                <NumberInput
                  allowDecimal={false}
                  value={toolsWearCost}
                  onChangeValue={(val) => {
                    setHasCalculatorStarted(true);
                    setToolsWearManual(val);
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
                />
                <p className="text-[11px] text-[#6E675F] mt-1">
                  Calculado desde {activeTools.length} herramientas activas (editable; no descuenta herramientas).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                  Otros costos adicionales (COP)
                </label>
                <NumberInput
                  allowDecimal={false}
                  value={additionalCosts}
                  onChangeValue={(val) => {
                    setHasCalculatorStarted(true);
                    setAdditionalCosts(val);
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg"
                />
                <p className="text-[11px] text-[#6E675F] mt-1">
                  Energía, transporte de envío, almidón, etc.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1C19] mb-1">
                Notas del cálculo (opcional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalles de tamaño, calibre de aguja o presentación..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#D9D3CA] rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Columna derecha: Resumen de costos, margen y precio sugerido */}
        <div className="xl:col-span-5 space-y-5 xl:sticky xl:top-24">
          <div className="bg-white border border-[#E7E3DC] rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#E7E3DC]">
              <Calculator className="w-4 h-4 text-[#AF8064]" />
              <h2 className="text-base font-semibold text-[#1F1C19]">
                Resumen de costo y precio de venta
              </h2>
            </div>

            {!hasCalculatorStarted && !editingCalcId ? (
              <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F4E7DE] text-[#9E7358] flex items-center justify-center mb-3.5">
                  <Calculator className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-semibold text-[#3B281E]">
                  Aquí se ve el aproximado de lo que vas a cobrar
                </h3>
                <p className="mt-1.5 text-xs text-[#7D6659] max-w-xs leading-relaxed">
                  Ingresa el nombre del producto, sus materiales o el tiempo de elaboración para calcular el costo y precio sugerido.
                </p>
              </div>
            ) : (
              <>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-[#5A5550]">
                <span>Materiales, empaques y accesorios</span>
                <span className="font-mono tabular-nums text-[#1F1C19]">
                  {formatCOP(materialsSubtotal)}
                </span>
              </div>
              <div className="flex justify-between text-[#5A5550]">
                <span>Mano de obra</span>
                <span className="font-mono tabular-nums text-[#1F1C19]">
                  {formatCOP(laborCost)}
                </span>
              </div>
              <div className="flex justify-between text-[#5A5550]">
                <span>Desgaste proporcional de herramientas</span>
                <span className="font-mono tabular-nums text-[#1F1C19]">
                  {formatCOP(toolsWearCost)}
                </span>
              </div>
              <div className="flex justify-between text-[#5A5550]">
                <span>Costos adicionales</span>
                <span className="font-mono tabular-nums text-[#1F1C19]">
                  {formatCOP(additionalCosts)}
                </span>
              </div>

              <div className="pt-3 border-t border-[#E7E3DC] flex justify-between items-baseline">
                <span className="font-semibold text-[#1F1C19]">Costo total de producción</span>
                <span className="text-xl font-bold font-mono tabular-nums text-[#1F1C19]">
                  {formatCOP(totalProductionCost)}
                </span>
              </div>
            </div>

            {/* Margen sobre venta */}
            <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E7E3DC] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold text-[#1F1C19]">
                  Margen de ganancia esperado (%)
                </label>
                <div className="flex items-center gap-1.5">
                  <NumberInput
                    allowDecimal
                    value={desiredMarginPercent}
                    onChangeValue={(val) => {
                      setDesiredMarginPercent(val);
                      setManualSalePrice(null);
                    }}
                    placeholder="0"
                    className="w-20 px-2.5 py-1 text-right text-sm font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-md"
                  />
                  <span className="text-xs font-semibold text-[#6E675F]">%</span>
                </div>
              </div>
              <input
                type="range"
                min="5"
                max="75"
                step="1"
                value={Math.min(75, Math.max(5, safeMargin))}
                onChange={(e) => {
                  setDesiredMarginPercent(parseFloat(e.target.value));
                  setManualSalePrice(null);
                }}
                className="w-full accent-[#7C3A52]"
              />
              <p className="text-[11px] text-[#6E675F] leading-relaxed">
                Fórmula sobre precio de venta: <span className="font-mono">Costo ÷ (1 − Margen)</span>.
              </p>

              <div className="pt-2 border-t border-[#E7E3DC] flex items-baseline justify-between">
                <span className="text-xs font-medium text-[#5A5550]">
                  Precio de venta sugerido
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-[#7C3A52]">
                  {formatCOP(suggestedPrice)}
                </span>
              </div>
            </div>

            {/* Precio final editable manualmente */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#1F1C19]">
                  Precio de venta final (editable en COP)
                </label>
                {manualSalePrice !== null && (
                  <button
                    type="button"
                    onClick={() => setManualSalePrice(null)}
                    className="text-[11px] text-[#7C3A52] hover:underline"
                  >
                    Restablecer al sugerido
                  </button>
                )}
              </div>
              <NumberInput
                allowDecimal={false}
                value={finalSalePrice}
                onChangeValue={(val) => setManualSalePrice(val)}
                placeholder="Ej. 35000"
                className="w-full px-3.5 py-2.5 text-lg font-bold font-mono tabular-nums bg-white border border-[#D9D3CA] rounded-lg focus:outline-none focus:border-[#7C3A52]"
              />

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#E7E3DC]">
                  <span className="block text-[11px] text-[#6E675F]">Ganancia estimada</span>
                  <span
                    className={`text-base font-bold font-mono tabular-nums ${
                      estimatedProfit >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                    }`}
                  >
                    {formatCOP(estimatedProfit)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#FAF9F7] border border-[#E7E3DC]">
                  <span className="block text-[11px] text-[#6E675F]">Margen real sobre venta</span>
                  <span
                    className={`text-base font-bold font-mono tabular-nums ${
                      actualMarginPercent >= 0 ? 'text-[#1F1C19]' : 'text-[#B91C1C]'
                    }`}
                  >
                    {formatNumber(actualMarginPercent, 1)}%
                  </span>
                  <span className="block text-[10px] text-[#6E675F] tabular-nums">
                    Equivale a {formatNumber(markupOnCostPercent, 1)}% sobre costo
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-[#E7E3DC]">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#7C3A52] hover:bg-[#642D41] rounded-lg transition-colors whitespace-nowrap"
              >
                <Save className="w-4 h-4" />
                <span>{editingCalcId ? 'Actualizar cálculo' : 'Guardar cálculo'}</span>
              </button>
              <button
                type="button"
                onClick={handleUseInOrder}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[#1F1C19] bg-[#F3F0EB] hover:bg-[#E7E3DC] rounded-lg transition-colors whitespace-nowrap"
              >
                <ClipboardPlus className="w-4 h-4 text-[#7C3A52]" />
                <span>Usar en pedido</span>
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Biblioteca opcional de cálculos guardados */}
      <section className="bg-white border border-[#E7E3DC] rounded-xl p-5 sm:p-6">
        <div className="pb-4 border-b border-[#E7E3DC]">
          <h3 className="text-base font-semibold text-[#1F1C19]">
            Cálculos guardados ({data.calculations.length})
          </h3>
          <p className="text-xs text-[#6E675F]">
            Referencias guardadas opcionalmente para consultar o reutilizar rápidamente en nuevos pedidos.
          </p>
        </div>

        {data.calculations.length === 0 ? (
          <div className="py-10 px-4 text-center flex flex-col items-center justify-center">
            <div className="w-11 h-11 rounded-2xl bg-[#F4E7DE] text-[#9E7358] flex items-center justify-center mb-3">
              <FolderOpen className="w-5 h-5" />
            </div>
            <h4 className="font-display text-base font-semibold text-[#3B281E]">
              Aquí vas a guardar cálculos que necesites recordar
            </h4>
            <p className="mt-1 text-xs text-[#7D6659] max-w-md">
              Cuando guardes un cálculo desde el resumen superior, aparecerá aquí para consultarlo o enviarlo a un pedido.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E7E3DC] text-xs font-semibold text-[#5A5550]">
                  <th className="py-2.5 pr-4">Producto</th>
                  <th className="py-2.5 pr-4 text-right">Costo prod.</th>
                  <th className="py-2.5 pr-4 text-right">Precio final</th>
                  <th className="py-2.5 pr-4 text-right">Ganancia</th>
                  <th className="py-2.5 pr-4 text-right">Margen</th>
                  <th className="py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E3DC] text-sm">
                {data.calculations.map((calc) => (
                  <tr key={calc.id} className="hover:bg-[#FAF9F7]">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-[#1F1C19]">{calc.productName}</p>
                      <p className="text-xs text-[#6E675F]">
                        {calc.materials.length} insumos · Mano de obra {formatCOP(calc.laborCost)}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs tabular-nums text-[#5A5550] whitespace-nowrap">
                      {formatCOP(calc.totalProductionCost)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-sm font-semibold tabular-nums text-[#1F1C19] whitespace-nowrap">
                      {formatCOP(calc.finalSalePrice)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs font-semibold tabular-nums text-[#15803D] whitespace-nowrap">
                      {formatCOP(calc.estimatedProfit)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs tabular-nums text-[#1F1C19] whitespace-nowrap">
                      {formatNumber(calc.actualMarginPercent, 1)}%
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => loadCalculationIntoEditor(calc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#1F1C19] bg-[#FAF9F7] border border-[#D9D3CA] hover:bg-[#F3F0EB] rounded-md"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Cargar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPendingOrderDraftFromCalc(calc);
                            setActiveModule('pedidos');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#7C3A52] bg-[#FAF9F7] border border-[#D9D3CA] hover:bg-[#F3F0EB] rounded-md"
                        >
                          <ClipboardPlus className="w-3.5 h-3.5" />
                          <span>A pedido</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(calc)}
                          aria-label={`Eliminar cálculo ${calc.productName}`}
                          className="p-1.5 text-[#6E675F] hover:text-[#B91C1C] rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteCalculation(deleteTarget.id);
            if (editingCalcId === deleteTarget.id) setEditingCalcId(null);
          }
        }}
        title="¿Eliminar cálculo guardado?"
        message={
          deleteTarget
            ? `Se eliminará "${deleteTarget.productName}" de tus cálculos guardados.`
            : ''
        }
        confirmLabel="Eliminar"
      />
    </div>
  );
};
