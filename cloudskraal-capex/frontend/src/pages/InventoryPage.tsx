import { useState, useEffect, useCallback } from 'react';
import { Package, ArrowLeft, X, AlertTriangle, Plus } from 'lucide-react';
import { getProducts, getProductById, getInventorySummary, getStock, getTransactions, recordTransaction } from '../api/inventory';
import type { InputProduct, InventorySummary, InventoryTransaction } from '../types/phase3';
import { INVENTORY_CATEGORY_COLORS } from '../types/phase3';

function formatCurrency(val: number | null): string {
  if (val == null) return '-';
  return `R${val.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const LOW_STOCK_THRESHOLD = 10;

export default function InventoryPage() {
  const [products, setProducts] = useState<InputProduct[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<InputProduct | null>(null);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<'purchase' | 'usage' | null>(null);
  const [txForm, setTxForm] = useState({ date: '', quantity: '', unit_cost: '', notes: '' });

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getProducts(categoryFilter ? { category: categoryFilter } : undefined),
      getInventorySummary(),
      getStock(),
    ])
      .then(([prods, sum, stockRecords]) => {
        // Merge stock into products
        const stockByProduct = new Map<string, typeof stockRecords>();
        for (const s of stockRecords) {
          if (!stockByProduct.has(s.product_id)) stockByProduct.set(s.product_id, []);
          stockByProduct.get(s.product_id)!.push(s);
        }
        const prodsWithStock = prods.map(p => ({
          ...p,
          stock: stockByProduct.get(p.id) ?? [],
        }));
        setProducts(prodsWithStock);
        setSummary(sum);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load inventory:', err);
        setLoading(false);
      });
  }, [categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!selectedId) { setSelectedProduct(null); setTransactions([]); return; }
    setDetailLoading(true);
    Promise.all([
      getProductById(selectedId),
      getTransactions(selectedId),
    ])
      .then(([prod, txs]) => {
        setSelectedProduct(prod);
        setTransactions(txs);
        setDetailLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load product detail:', err);
        setDetailLoading(false);
      });
  }, [selectedId]);

  async function handleTxSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !showModal) return;
    try {
      await recordTransaction({
        product_id: selectedId,
        type: showModal,
        date: txForm.date,
        quantity: Number(txForm.quantity),
        unit_cost: txForm.unit_cost ? Number(txForm.unit_cost) : null,
        notes: txForm.notes || null,
      });
      setShowModal(null);
      setTxForm({ date: '', quantity: '', unit_cost: '', notes: '' });
      // Refresh detail and list
      const [prod, txs] = await Promise.all([
        getProductById(selectedId),
        getTransactions(selectedId),
      ]);
      setSelectedProduct(prod);
      setTransactions(txs);
      fetchData();
    } catch (err) {
      console.error('Failed to record transaction:', err);
    }
  }

  // Compute current stock for each product
  function totalStock(prod: InputProduct): number {
    if (!prod.stock) return 0;
    return prod.stock.reduce((acc, s) => acc + s.quantity_on_hand, 0);
  }

  const lowStockProducts = products.filter((p) => totalStock(p) < LOW_STOCK_THRESHOLD && totalStock(p) >= 0);
  const categoryKeys = summary ? Object.keys(summary.byCategory) : [];

  return (
    <div className="h-[calc(100vh-5rem)] md:h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-stone-200 px-4 py-3 bg-white">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-emerald-700" />
            <h1 className="text-lg font-bold text-stone-900">Inventory</h1>
          </div>
          <div className="flex-1" />
          {summary && (
            <div className="flex items-center gap-4 text-xs">
              <div className="text-center">
                <p className="text-stone-400">Products</p>
                <p className="text-lg font-bold text-stone-800">{summary.totalProducts}</p>
              </div>
              <div className="text-center">
                <p className="text-stone-400">Stock Value</p>
                <p className="text-lg font-bold text-stone-800">{formatCurrency(summary.totalValue)}</p>
              </div>
              <div className="text-center">
                <p className="text-stone-400">Low Stock</p>
                <p className={`text-lg font-bold ${summary.lowStockCount > 0 ? 'text-amber-600' : 'text-stone-800'}`}>
                  {summary.lowStockCount}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Category filter pills */}
        {categoryKeys.length > 0 && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                categoryFilter === null ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All
            </button>
            {categoryKeys.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={
                  categoryFilter === c
                    ? { backgroundColor: INVENTORY_CATEGORY_COLORS[c] ?? '#6b7280', color: '#fff' }
                    : undefined
                }
              >
                {c.charAt(0).toUpperCase() + c.slice(1)} ({(summary!.byCategory as Record<string, {products: number; value: number}>)[c]?.products ?? 0})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">{lowStockProducts.length} product{lowStockProducts.length !== 1 ? 's' : ''}</span> with low stock:{' '}
            {lowStockProducts.slice(0, 3).map((p) => p.name).join(', ')}
            {lowStockProducts.length > 3 && ` +${lowStockProducts.length - 3} more`}
          </p>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-stone-400 text-sm">Loading inventory...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-stone-400 text-sm">No products found.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-stone-600">Product</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600 hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600 hidden md:table-cell">Unit</th>
                  <th className="text-right px-4 py-2 font-medium text-stone-600 hidden md:table-cell">Cost/Unit</th>
                  <th className="text-right px-4 py-2 font-medium text-stone-600">Stock</th>
                  <th className="text-left px-4 py-2 font-medium text-stone-600 hidden lg:table-cell">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => {
                  const stock = totalStock(prod);
                  const isLow = stock < LOW_STOCK_THRESHOLD;
                  return (
                    <tr
                      key={prod.id}
                      onClick={() => setSelectedId(prod.id)}
                      className={`border-b border-stone-100 cursor-pointer transition-colors ${
                        selectedId === prod.id ? 'bg-emerald-50' : 'hover:bg-stone-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-stone-800">{prod.name}</p>
                        {prod.active_ingredients && (
                          <p className="text-[10px] text-stone-400 truncate max-w-[200px]">{prod.active_ingredients}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                          style={{ backgroundColor: INVENTORY_CATEGORY_COLORS[prod.category] ?? '#6b7280' }}
                        >
                          {prod.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-stone-600">{prod.unit_of_measure ?? '-'}</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell text-stone-600">
                        {prod.cost_per_unit != null ? formatCurrency(prod.cost_per_unit) : '-'}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${isLow ? 'text-amber-600' : 'text-stone-800'}`}>
                        {stock}
                        {isLow && ' !'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-stone-600">{prod.supplier ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selectedId && (
          <div className="md:w-[420px] md:flex-shrink-0 border-t md:border-t-0 md:border-l border-stone-200 bg-white overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-stone-400 text-sm">Loading...</p>
              </div>
            ) : selectedProduct ? (
              <div className="p-4">
                {/* Close + title */}
                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1 text-stone-400 hover:text-stone-600 md:hidden"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="text-lg font-bold text-stone-900 flex-1">{selectedProduct.name}</h2>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1 text-stone-400 hover:text-stone-600 hidden md:block"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Info card */}
                <div className="bg-stone-50 rounded-lg p-4 mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Category</span>
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                      style={{ backgroundColor: INVENTORY_CATEGORY_COLORS[selectedProduct.category] ?? '#6b7280' }}
                    >
                      {selectedProduct.category}
                    </span>
                  </div>
                  {selectedProduct.unit_of_measure && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Unit</span>
                      <span className="text-stone-800">{selectedProduct.unit_of_measure}</span>
                    </div>
                  )}
                  {selectedProduct.cost_per_unit != null && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Cost / Unit</span>
                      <span className="text-stone-800 font-medium">{formatCurrency(selectedProduct.cost_per_unit)}</span>
                    </div>
                  )}
                  {selectedProduct.supplier && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Supplier</span>
                      <span className="text-stone-800">{selectedProduct.supplier}</span>
                    </div>
                  )}
                  {selectedProduct.active_ingredients && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Active Ingredients</span>
                      <span className="text-stone-800 text-right max-w-[200px]">{selectedProduct.active_ingredients}</span>
                    </div>
                  )}
                  {selectedProduct.withholding_period_days != null && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Withholding</span>
                      <span className="text-stone-800">{selectedProduct.withholding_period_days} days</span>
                    </div>
                  )}
                  {selectedProduct.notes && (
                    <div className="pt-2 border-t border-stone-200">
                      <p className="text-stone-500 text-xs mb-1">Notes</p>
                      <p className="text-stone-700 text-xs">{selectedProduct.notes}</p>
                    </div>
                  )}
                </div>

                {/* Stock levels by location */}
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  Stock Levels
                </h3>
                {selectedProduct.stock && selectedProduct.stock.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {selectedProduct.stock.map((s) => (
                      <div key={s.id} className="flex items-center justify-between bg-stone-50 rounded-lg p-3 text-sm">
                        <div>
                          <p className="text-stone-800 font-medium">{s.location ?? 'Default'}</p>
                          {s.expiry_date && (
                            <p className="text-[10px] text-stone-400">Expires: {formatDate(s.expiry_date)}</p>
                          )}
                        </div>
                        <p className={`font-bold ${s.quantity_on_hand < LOW_STOCK_THRESHOLD ? 'text-amber-600' : 'text-stone-800'}`}>
                          {s.quantity_on_hand}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 mb-4">No stock records.</p>
                )}

                {/* Transaction buttons */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setShowModal('purchase')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition-colors"
                  >
                    <Plus size={12} />
                    Purchase
                  </button>
                  <button
                    onClick={() => setShowModal('usage')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    <Plus size={12} />
                    Usage
                  </button>
                </div>

                {/* Transaction modal (inline) */}
                {showModal && (
                  <form onSubmit={handleTxSubmit} className="bg-stone-50 rounded-lg p-3 mb-4 space-y-2 border border-stone-200">
                    <p className="text-xs font-semibold text-stone-700">
                      Record {showModal === 'purchase' ? 'Purchase' : 'Usage'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={txForm.date}
                        onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
                        required
                        className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Quantity"
                        value={txForm.quantity}
                        onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })}
                        required
                        className="px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                    </div>
                    {showModal === 'purchase' && (
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Unit cost (R)"
                        value={txForm.unit_cost}
                        onChange={(e) => setTxForm({ ...txForm, unit_cost: e.target.value })}
                        className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                      />
                    )}
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={txForm.notes}
                      onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                      className="w-full px-2 py-1.5 text-xs border border-stone-300 rounded-lg"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowModal(null)}
                        className="px-3 py-1 text-xs text-stone-600 hover:text-stone-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className={`px-3 py-1 text-white text-xs font-medium rounded-lg ${
                          showModal === 'purchase' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-600 hover:bg-amber-700'
                        }`}
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}

                {/* Recent transactions */}
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  Recent Transactions ({transactions.length})
                </h3>
                {transactions.length > 0 ? (
                  <div className="space-y-0">
                    {transactions.slice(0, 15).map((tx, idx) => (
                      <div key={tx.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                            style={{ backgroundColor: tx.type === 'purchase' ? '#047857' : '#d97706' }}
                          />
                          {idx < Math.min(transactions.length, 15) - 1 && (
                            <div className="w-px flex-1 bg-stone-200" />
                          )}
                        </div>
                        <div className="pb-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-stone-800">{formatDate(tx.date)}</span>
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              tx.type === 'purchase' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {tx.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-stone-500">
                            <span>Qty: {tx.quantity}</span>
                            {tx.unit_cost != null && <span>@ {formatCurrency(tx.unit_cost)}</span>}
                            {tx.total_cost != null && <span className="font-medium">Total: {formatCurrency(tx.total_cost)}</span>}
                          </div>
                          {tx.notes && <p className="text-[10px] text-stone-400 mt-0.5">{tx.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">No transactions yet.</p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
