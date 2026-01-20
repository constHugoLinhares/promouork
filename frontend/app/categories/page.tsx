'use client';

import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useEffect, useState } from 'react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  subcategories: Subcategory[];
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  categoryId: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showSubcategoryForm, setShowSubcategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });
  const [subcategoryFormData, setSubcategoryFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    isActive: true,
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/categories', categoryFormData);
      setCategoryFormData({ name: '', description: '', isActive: true });
      setShowCategoryForm(false);
      loadCategories();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao criar categoria');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      await api.patch(`/categories/${editingCategory.id}`, categoryFormData);
      setEditingCategory(null);
      setCategoryFormData({ name: '', description: '', isActive: true });
      loadCategories();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao atualizar categoria');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria? Todas as subcategorias serão excluídas também.')) {
      return;
    }
    try {
      await api.delete(`/categories/${id}`);
      loadCategories();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao excluir categoria');
    }
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      isActive: category.isActive,
    });
    setShowCategoryForm(true);
  };

  const handleCancelCategoryEdit = () => {
    setEditingCategory(null);
    setCategoryFormData({ name: '', description: '', isActive: true });
    setShowCategoryForm(false);
  };

  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/categories/subcategories', subcategoryFormData);
      setSubcategoryFormData({ name: '', description: '', categoryId: '', isActive: true });
      setShowSubcategoryForm(false);
      setSelectedCategoryId('');
      loadCategories();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao criar subcategoria');
    }
  };

  const handleUpdateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubcategory) return;
    try {
      await api.patch(`/categories/subcategories/${editingSubcategory.id}`, subcategoryFormData);
      setEditingSubcategory(null);
      setSubcategoryFormData({ name: '', description: '', categoryId: '', isActive: true });
      setShowSubcategoryForm(false);
      loadCategories();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao atualizar subcategoria');
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta subcategoria?')) {
      return;
    }
    try {
      await api.delete(`/categories/subcategories/${id}`);
      loadCategories();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao excluir subcategoria');
    }
  };

  const handleEditSubcategory = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryFormData({
      name: subcategory.name,
      description: subcategory.description || '',
      categoryId: subcategory.categoryId,
      isActive: subcategory.isActive,
    });
    setShowSubcategoryForm(true);
  };

  const handleCancelSubcategoryEdit = () => {
    setEditingSubcategory(null);
    setSubcategoryFormData({ name: '', description: '', categoryId: '', isActive: true });
    setShowSubcategoryForm(false);
    setSelectedCategoryId('');
  };

  const handleAddSubcategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSubcategoryFormData({
      name: '',
      description: '',
      categoryId,
      isActive: true,
    });
    setShowSubcategoryForm(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto">
          <p className="text-dark-text">Carregando...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-dark-text">Categorias e Subcategorias</h1>
          <button
            onClick={() => {
              setShowCategoryForm(true);
              setEditingCategory(null);
              setCategoryFormData({ name: '', description: '', isActive: true });
            }}
            className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all"
          >
            + Nova Categoria
          </button>
        </div>

        {/* Formulário de Categoria */}
        {showCategoryForm && (
          <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-dark-text mb-4">
              {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
            </h2>
            <form
              onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={categoryFormData.name}
                  onChange={(e) =>
                    setCategoryFormData({ ...categoryFormData, name: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Descrição
                </label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) =>
                    setCategoryFormData({ ...categoryFormData, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="categoryActive"
                  checked={categoryFormData.isActive}
                  onChange={(e) =>
                    setCategoryFormData({ ...categoryFormData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-500 bg-dark-bg border-dark-border rounded focus:ring-primary-500"
                />
                <label htmlFor="categoryActive" className="text-sm text-dark-text">
                  Ativa
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all"
                >
                  {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelCategoryEdit}
                  className="px-4 py-2 border border-dark-border rounded-md text-dark-text hover:bg-dark-border/30 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Formulário de Subcategoria */}
        {showSubcategoryForm && (
          <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-dark-text mb-4">
              {editingSubcategory ? 'Editar Subcategoria' : 'Nova Subcategoria'}
            </h2>
            <form
              onSubmit={editingSubcategory ? handleUpdateSubcategory : handleCreateSubcategory}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Categoria *
                </label>
                <select
                  value={subcategoryFormData.categoryId}
                  onChange={(e) =>
                    setSubcategoryFormData({ ...subcategoryFormData, categoryId: e.target.value })
                  }
                  required
                  disabled={!!editingSubcategory}
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={subcategoryFormData.name}
                  onChange={(e) =>
                    setSubcategoryFormData({ ...subcategoryFormData, name: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Descrição
                </label>
                <textarea
                  value={subcategoryFormData.description}
                  onChange={(e) =>
                    setSubcategoryFormData({
                      ...subcategoryFormData,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="subcategoryActive"
                  checked={subcategoryFormData.isActive}
                  onChange={(e) =>
                    setSubcategoryFormData({
                      ...subcategoryFormData,
                      isActive: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-primary-500 bg-dark-bg border-dark-border rounded focus:ring-primary-500"
                />
                <label htmlFor="subcategoryActive" className="text-sm text-dark-text">
                  Ativa
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all"
                >
                  {editingSubcategory ? 'Salvar Alterações' : 'Criar Subcategoria'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelSubcategoryEdit}
                  className="px-4 py-2 border border-dark-border rounded-md text-dark-text hover:bg-dark-border/30 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Categorias */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-dark-text">{category.name}</h3>
                  {category.description && (
                    <p className="text-sm text-dark-muted mt-1">{category.description}</p>
                  )}
                  <span
                    className={`inline-block mt-2 px-2 py-1 rounded text-xs ${
                      category.isActive
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {category.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="p-2 hover:bg-dark-bg/50 rounded transition-colors"
                    title="Editar"
                  >
                    <svg
                      className="w-5 h-5 text-primary-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="p-2 hover:bg-dark-bg/50 rounded transition-colors"
                    title="Excluir"
                  >
                    <svg
                      className="w-5 h-5 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="border-t border-dark-border pt-4 mt-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-dark-text">
                    Subcategorias ({category.subcategories.length})
                  </h4>
                  <button
                    onClick={() => handleAddSubcategory(category.id)}
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    + Adicionar
                  </button>
                </div>

                {category.subcategories.length > 0 ? (
                  <div className="space-y-2">
                    {category.subcategories.map((subcategory) => (
                      <div
                        key={subcategory.id}
                        className="flex justify-between items-center p-2 bg-dark-bg/30 rounded"
                      >
                        <div className="flex-1">
                          <p className="text-sm text-dark-text">{subcategory.name}</p>
                          {subcategory.description && (
                            <p className="text-xs text-dark-muted">{subcategory.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEditSubcategory(subcategory)}
                            className="p-1 hover:bg-dark-bg/50 rounded transition-colors"
                            title="Editar"
                          >
                            <svg
                              className="w-4 h-4 text-primary-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteSubcategory(subcategory.id)}
                            className="p-1 hover:bg-dark-bg/50 rounded transition-colors"
                            title="Excluir"
                          >
                            <svg
                              className="w-4 h-4 text-red-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-dark-muted text-center py-2">
                    Nenhuma subcategoria
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-dark-muted">Nenhuma categoria cadastrada ainda.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

