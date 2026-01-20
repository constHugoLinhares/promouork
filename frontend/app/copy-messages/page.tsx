'use client';

import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useEffect, useState } from 'react';

interface CopyMessage {
  id: string;
  message: string;
  categoryId?: string;
  subcategoryId?: string;
  isActive: boolean;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  subcategory?: {
    id: string;
    name: string;
    slug: string;
  };
}


export default function CopyMessagesPage() {
  const [copyMessages, setCopyMessages] = useState<CopyMessage[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCopy, setEditingCopy] = useState<CopyMessage | null>(null);
  const [formData, setFormData] = useState({
    message: '',
    categoryId: '',
    subcategoryId: '',
    isActive: true,
  });
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.categoryId) {
      loadSubcategories(formData.categoryId);
    } else {
      setSubcategories([]);
    }
  }, [formData.categoryId]);

  useEffect(() => {
    loadCopyMessages();
  }, [filterCategoryId, filterSubcategoryId]);

  const loadData = async () => {
    try {
      const [categoriesRes] = await Promise.all([api.get('/categories')]);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSubcategories = async (categoryId: string) => {
    try {
      const response = await api.get(`/categories/subcategories/category/${categoryId}`);
      setSubcategories(response.data);
    } catch (error) {
      console.error('Error loading subcategories:', error);
      setSubcategories([]);
    }
  };

  const loadCopyMessages = async () => {
    try {
      const params = new URLSearchParams();
      if (filterCategoryId) params.append('categoryId', filterCategoryId);
      if (filterSubcategoryId) params.append('subcategoryId', filterSubcategoryId);
      
      const response = await api.get(`/copy-messages?${params.toString()}`);
      setCopyMessages(response.data);
    } catch (error) {
      console.error('Error loading copy messages:', error);
    }
  };


  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/copy-messages', {
        ...formData,
        categoryId: formData.categoryId || undefined,
        subcategoryId: formData.subcategoryId || undefined,
      });
      setFormData({ message: '', categoryId: '', subcategoryId: '', isActive: true });
      setShowForm(false);
      loadCopyMessages();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao criar copy');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCopy) return;
    try {
      await api.patch(`/copy-messages/${editingCopy.id}`, {
        ...formData,
        categoryId: formData.categoryId || undefined,
        subcategoryId: formData.subcategoryId || undefined,
      });
      setEditingCopy(null);
      setFormData({ message: '', categoryId: '', subcategoryId: '', isActive: true });
      setShowForm(false);
      loadCopyMessages();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao atualizar copy');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta copy?')) {
      return;
    }
    try {
      await api.delete(`/copy-messages/${id}`);
      loadCopyMessages();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao excluir copy');
    }
  };

  const handleEdit = (copy: CopyMessage) => {
    setEditingCopy(copy);
    setFormData({
      message: copy.message,
      categoryId: copy.categoryId || '',
      subcategoryId: copy.subcategoryId || '',
      isActive: copy.isActive,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingCopy(null);
    setFormData({ message: '', categoryId: '', subcategoryId: '', isActive: true });
    setShowForm(false);
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
          <h1 className="text-3xl font-bold text-dark-text">Mensagens de Copy</h1>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingCopy(null);
              setFormData({ message: '', categoryId: '', subcategoryId: '', isActive: true });
            }}
            className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all"
          >
            + Nova Copy
          </button>
        </div>

        {/* Filtros */}
        <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">
                Filtrar por Categoria
              </label>
              <select
                value={filterCategoryId}
                onChange={(e) => {
                  setFilterCategoryId(e.target.value);
                  setFilterSubcategoryId('');
                }}
                className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Todas as categorias</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">
                Filtrar por Subcategoria
              </label>
              <select
                value={filterSubcategoryId}
                onChange={(e) => setFilterSubcategoryId(e.target.value)}
                disabled={!filterCategoryId}
                className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <option value="">Todas as subcategorias</option>
                {filterCategoryId &&
                  subcategories
                    .filter((sub) => sub.categoryId === filterCategoryId)
                    .map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
              </select>
            </div>
          </div>
        </div>

        {/* Formulário de Criação */}
        {showForm && !editingCopy && (
          <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-dark-text mb-4">Nova Copy</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Mensagem (Hook) *
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) =>
                    setFormData({ ...formData, message: e.target.value })
                  }
                  required
                  rows={3}
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Processador fraco é gargalo disfarçado."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Categoria (Opcional)
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        categoryId: e.target.value,
                        subcategoryId: '',
                      })
                    }
                    className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Geral (sem categoria)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Subcategoria (Opcional)
                  </label>
                  <select
                    value={formData.subcategoryId}
                    onChange={(e) =>
                      setFormData({ ...formData, subcategoryId: e.target.value })
                    }
                    disabled={!formData.categoryId}
                    className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    <option value="">Geral (sem subcategoria)</option>
                    {subcategories
                      .filter((sub) => sub.categoryId === formData.categoryId)
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="copyActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="w-4 h-4 text-primary-500 bg-dark-bg border-dark-border rounded focus:ring-primary-500"
                />
                <label htmlFor="copyActive" className="text-sm text-dark-text">
                  Ativa
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all"
                >
                  Criar Copy
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-dark-border rounded-md text-dark-text hover:bg-dark-border/30 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Copies */}
        <div className="space-y-3">
          {copyMessages.map((copy) => (
            <div key={copy.id} className="space-y-3">
              <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-dark-text mb-2">{copy.message}</p>
                    <div className="flex gap-2 flex-wrap">
                      {copy.category && (
                        <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs border border-primary-500/30">
                          {copy.category.name}
                        </span>
                      )}
                      {copy.subcategory && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs border border-purple-500/30">
                          {copy.subcategory.name}
                        </span>
                      )}
                      {!copy.category && !copy.subcategory && (
                        <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs border border-gray-500/30">
                          Geral
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          copy.isActive
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {copy.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(copy)}
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
                      onClick={() => handleDelete(copy.id)}
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
              </div>

              {/* Formulário de Edição inline */}
              {editingCopy && editingCopy.id === copy.id && (
                <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-dark-text mb-4">Editar Copy</h2>
                  <form onSubmit={handleUpdate} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-text mb-1">
                        Mensagem (Hook) *
                      </label>
                      <textarea
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        required
                        rows={3}
                        className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Ex: Processador fraco é gargalo disfarçado."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-dark-text mb-1">
                          Categoria (Opcional)
                        </label>
                        <select
                          value={formData.categoryId}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              categoryId: e.target.value,
                              subcategoryId: '',
                            })
                          }
                          className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Geral (sem categoria)</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-dark-text mb-1">
                          Subcategoria (Opcional)
                        </label>
                        <select
                          value={formData.subcategoryId}
                          onChange={(e) =>
                            setFormData({ ...formData, subcategoryId: e.target.value })
                          }
                          disabled={!formData.categoryId}
                          className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <option value="">Geral (sem subcategoria)</option>
                          {subcategories
                            .filter((sub) => sub.categoryId === formData.categoryId)
                            .map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`copyActive-${copy.id}`}
                        checked={formData.isActive}
                        onChange={(e) =>
                          setFormData({ ...formData, isActive: e.target.checked })
                        }
                        className="w-4 h-4 text-primary-500 bg-dark-bg border-dark-border rounded focus:ring-primary-500"
                      />
                      <label htmlFor={`copyActive-${copy.id}`} className="text-sm text-dark-text">
                        Ativa
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all"
                      >
                        Salvar Alterações
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 border border-dark-border rounded-md text-dark-text hover:bg-dark-border/30 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>

        {copyMessages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-dark-muted">
              Nenhuma copy cadastrada ainda.{' '}
              {filterCategoryId || filterSubcategoryId
                ? 'Tente ajustar os filtros.'
                : 'Crie uma copy para começar.'}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

