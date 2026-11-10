import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { adminClient } from '../api/adminClient';

export const FoodDatabaseView: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState<string>('all');

  const [editingFood, setEditingFood] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    cuisine: 'INDIAN_NORTH',
    servingSize: 100,
    servingUnit: 'g',
    calories: 150,
    proteinG: 5,
    carbsG: 20,
    fatG: 5,
    fiberG: 2,
    isVerified: true,
    barcode: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'foods', page, search, cuisineFilter, verifiedFilter],
    queryFn: () =>
      adminClient.listFoods({
        page,
        limit: 15,
        search: search.trim() || undefined,
        cuisine: cuisineFilter || undefined,
        isVerified: verifiedFilter === 'all' ? undefined : verifiedFilter === 'verified',
      }),
  });

  const createMutation = useMutation({
    mutationFn: (newFood: any) => adminClient.createFood(newFood),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'foods'] });
      setIsCreating(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminClient.updateFood(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'foods'] });
      setEditingFood(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminClient.deleteFood(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'foods'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      cuisine: 'INDIAN_NORTH',
      servingSize: 100,
      servingUnit: 'g',
      calories: 150,
      proteinG: 5,
      carbsG: 20,
      fatG: 5,
      fiberG: 2,
      isVerified: true,
      barcode: '',
    });
  };

  const handleOpenEdit = (food: any) => {
    setEditingFood(food);
    setFormData({
      name: food.name,
      brand: food.brand || '',
      cuisine: food.cuisine || 'INDIAN_NORTH',
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      fiberG: food.fiberG,
      isVerified: food.isVerified,
      barcode: food.barcode || '',
    });
  };

  const foods = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Food Database Management</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Curate canonical regional and packaged food items, edit standard macronutrient profiles,
            and approve submissions.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black font-medium text-xs rounded transition-colors self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Food Item</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search food by name or brand..."
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={cuisineFilter}
            onChange={e => {
              setCuisineFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none"
          >
            <option value="">All Cuisines</option>
            <option value="INDIAN_NORTH">North Indian</option>
            <option value="INDIAN_SOUTH">South Indian</option>
            <option value="INDIAN_EAST">East Indian</option>
            <option value="INDIAN_WEST">West Indian</option>
            <option value="CONTINENTAL">Continental</option>
          </select>

          <select
            value={verifiedFilter}
            onChange={e => {
              setVerifiedFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none"
          >
            <option value="all">Verification: All</option>
            <option value="verified">Verified Only</option>
            <option value="unverified">Unverified Only</option>
          </select>

          <button
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-xs text-zinc-300"
          >
            Filter
          </button>
        </div>
      </div>

      {/* Foods Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-medium">
              <th className="py-3 px-4">Item Name</th>
              <th className="py-3 px-4">Cuisine / Brand</th>
              <th className="py-3 px-4">Calories (kcal)</th>
              <th className="py-3 px-4">Macros (P / C / F / Fib)</th>
              <th className="py-3 px-4">Verified</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-500">
                  Loading food items catalog...
                </td>
              </tr>
            ) : foods.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-zinc-500">
                  No food database items match your filter criteria.
                </td>
              </tr>
            ) : (
              foods.map((food: any) => (
                <tr key={food.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-white">{food.name}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">
                      Serving: {food.servingSize} {food.servingUnit}
                      {food.barcode ? ` • Barcode: ${food.barcode}` : ''}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-zinc-300">
                    <div>{food.cuisine}</div>
                    {food.brand && <div className="text-[11px] text-zinc-500">{food.brand}</div>}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-white">
                    {food.calories} kcal
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">
                    P: {food.proteinG}g • C: {food.carbsG}g • F: {food.fatG}g • Fib: {food.fiberG}g
                  </td>
                  <td className="py-3 px-4">
                    {food.isVerified ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-zinc-500 text-[11px]">
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Unverified</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(food)}
                      className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white transition-colors"
                      title="Edit Nutrient Data"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${food.name}?`)) {
                          deleteMutation.mutate(food.id);
                        }
                      }}
                      className="p-1.5 hover:bg-zinc-800 rounded text-red-400 hover:text-red-300 transition-colors"
                      title="Delete Food Item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 bg-zinc-950">
          <div>
            Showing page {pagination.page} of {Math.max(1, pagination.totalPages)} (
            {pagination.total} food items)
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Food Modal */}
      {(isCreating || editingFood) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-semibold text-white text-sm">
                {isCreating ? 'Create Verified Food Item' : `Edit ${editingFood?.name}`}
              </h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setEditingFood(null);
                }}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (isCreating) {
                  createMutation.mutate(formData);
                } else {
                  updateMutation.mutate({ id: editingFood.id, data: formData });
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-zinc-400 mb-1">Food Item Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Masala Dosa"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Brand Name (Optional)</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Haldiram's"
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Cuisine</label>
                  <select
                    value={formData.cuisine}
                    onChange={e => setFormData({ ...formData, cuisine: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                  >
                    <option value="INDIAN_NORTH">North Indian</option>
                    <option value="INDIAN_SOUTH">South Indian</option>
                    <option value="INDIAN_EAST">East Indian</option>
                    <option value="INDIAN_WEST">West Indian</option>
                    <option value="CONTINENTAL">Continental</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Standard Serving Size</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.servingSize}
                    onChange={e =>
                      setFormData({ ...formData, servingSize: Number(e.target.value) })
                    }
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Serving Unit</label>
                  <input
                    type="text"
                    required
                    value={formData.servingUnit}
                    onChange={e => setFormData({ ...formData, servingUnit: e.target.value })}
                    placeholder="g, ml, piece"
                    className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Nutrition Macros */}
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <label className="block text-zinc-400 mb-1">Calories</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.calories}
                    onChange={e => setFormData({ ...formData, calories: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.proteinG}
                    onChange={e => setFormData({ ...formData, proteinG: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.carbsG}
                    onChange={e => setFormData({ ...formData, carbsG: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Fat (g)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.fatG}
                    onChange={e => setFormData({ ...formData, fatG: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Fiber (g)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.fiberG}
                    onChange={e => setFormData({ ...formData, fiberG: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Barcode (EAN-13 / UPC optional)</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                  placeholder="e.g. 8901262010053"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isVerified"
                  checked={formData.isVerified}
                  onChange={e => setFormData({ ...formData, isVerified: e.target.checked })}
                  className="rounded bg-zinc-900 border-zinc-700"
                />
                <label htmlFor="isVerified" className="text-zinc-300">
                  Mark as officially verified in CAL METER database
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingFood(null);
                  }}
                  className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-1.5 rounded bg-white hover:bg-zinc-200 text-black font-medium text-xs disabled:opacity-50"
                >
                  {isCreating
                    ? createMutation.isPending
                      ? 'Saving...'
                      : 'Create Food Record'
                    : updateMutation.isPending
                      ? 'Updating...'
                      : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
