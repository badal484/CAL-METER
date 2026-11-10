import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, ChevronLeft, ChevronRight, Clock, Flame } from 'lucide-react';
import { adminClient } from '../api/adminClient';

export const RecipesView: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  const [recipeForm, setRecipeForm] = useState({
    title: '',
    description: '',
    cuisine: 'INDIAN_NORTH',
    servings: 2,
    prepTimeMinutes: 15,
    cookTimeMinutes: 20,
    difficulty: 'EASY' as 'EASY' | 'MEDIUM' | 'HARD',
    caloriesPerServing: 280,
    proteinPerServing: 14,
    carbsPerServing: 35,
    fatPerServing: 8,
    fiberPerServing: 5,
    instructions: [
      'Prepare ingredients',
      'Cook on medium flame for 15 mins',
      'Serve warm with chutney',
    ],
    ingredients: [
      { name: 'Paneer Cubes', amount: '150g', calories: 200 },
      { name: 'Tomatoes', amount: '2 medium', calories: 40 },
      { name: 'Spices & Herbs', amount: '1 tsp', calories: 10 },
    ],
    dietaryTags: ['HIGH_PROTEIN', 'VEGETARIAN'],
    isPublished: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'recipes', page],
    queryFn: () =>
      adminClient.listRecipes({
        page,
        limit: 12,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (newRecipe: any) => adminClient.createRecipe(newRecipe),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'recipes'] });
      setIsCreating(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminClient.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'recipes'] });
    },
  });

  const recipes = data?.data || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Recipe & Meal Content Management
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Curate regional healthy recipes, calculate exact macronutrients per serving, and publish
            to user discovery feed.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black font-medium text-xs rounded transition-colors self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Publish New Recipe</span>
        </button>
      </div>

      {/* Recipes Grid */}
      {isLoading ? (
        <div className="text-center py-16 text-zinc-500 text-xs">Loading recipes catalog...</div>
      ) : recipes.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-12 text-center text-zinc-500 text-xs">
          No published recipes currently found. Click 'Publish New Recipe' to create your first
          content item.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((r: any) => (
            <div
              key={r.id}
              className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-white text-sm line-clamp-1">{r.title}</h3>
                  <button
                    onClick={() => {
                      if (confirm(`Delete recipe "${r.title}"?`)) {
                        deleteMutation.mutate(r.id);
                      }
                    }}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2 mb-4">
                  {r.description || 'Delicious and nutritionally balanced recipe.'}
                </p>

                <div className="flex items-center gap-4 text-[11px] text-zinc-400 mb-3 font-mono">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{r.prepTimeMinutes + r.cookTimeMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Flame className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{r.caloriesPerServing || '—'} kcal</span>
                  </div>
                  <div>Serves {r.servings}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-850 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500 font-mono capitalize">{r.cuisine}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.isPublished ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-400'}`}
                >
                  {r.isPublished ? 'Published' : 'Draft'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-between text-xs text-zinc-400">
        <div>
          Page {pagination.page} of {Math.max(1, pagination.totalPages)} ({pagination.total}{' '}
          recipes)
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            disabled={page >= pagination.totalPages}
            onClick={() => setPage(p => p + 1)}
            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-semibold text-white text-sm">Compose & Publish Recipe</h3>
              <button
                onClick={() => setIsCreating(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                createMutation.mutate(recipeForm);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-zinc-400 mb-1">Recipe Title *</label>
                <input
                  type="text"
                  required
                  value={recipeForm.title}
                  onChange={e => setRecipeForm({ ...recipeForm, title: e.target.value })}
                  placeholder="e.g. Palak Paneer with Brown Rice"
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Description</label>
                <textarea
                  value={recipeForm.description}
                  onChange={e => setRecipeForm({ ...recipeForm, description: e.target.value })}
                  rows={2}
                  placeholder="Brief culinary summary..."
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-zinc-400 mb-1">Calories / Serv</label>
                  <input
                    type="number"
                    value={recipeForm.caloriesPerServing}
                    onChange={e =>
                      setRecipeForm({ ...recipeForm, caloriesPerServing: Number(e.target.value) })
                    }
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    value={recipeForm.proteinPerServing}
                    onChange={e =>
                      setRecipeForm({ ...recipeForm, proteinPerServing: Number(e.target.value) })
                    }
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Servings</label>
                  <input
                    type="number"
                    value={recipeForm.servings}
                    onChange={e =>
                      setRecipeForm({ ...recipeForm, servings: Number(e.target.value) })
                    }
                    className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-1.5 rounded bg-white hover:bg-zinc-200 text-black font-medium text-xs disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Publishing...' : 'Publish Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
