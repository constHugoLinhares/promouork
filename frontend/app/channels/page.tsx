'use client';

import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useEffect, useState } from 'react';

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  chatId: string;
  description?: string;
  categoryId?: string;
  category?: Category;
  isActive: boolean;
  products?: Product[];
}

interface Product {
  id: string;
  name: string;
  channelId: string;
  categoryId?: string;
  subcategoryId?: string;
  isActive: boolean;
  category?: Category;
  subcategory?: Subcategory;
  copyMessages?: Array<{
    copyMessage: {
      id: string;
      message: string;
    };
  }>;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'telegram',
    chatId: '',
    description: '',
    categoryId: '',
    isActive: true,
  });
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [productsByChannel, setProductsByChannel] = useState<Record<string, Product[]>>({});
  const [productSearchTerm, setProductSearchTerm] = useState<Record<string, string>>({});
  const [productSuggestions, setProductSuggestions] = useState<Record<string, Product[]>>({});
  const [editingProduct, setEditingProduct] = useState<{ channelId: string; product: Product } | null>(null);
  const [showProductForm, setShowProductForm] = useState<Record<string, boolean>>({});
  const [copyMessages, setCopyMessages] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    loadCopyMessages();
  }, []);

  const loadCopyMessages = async () => {
    try {
      const response = await api.get('/copy-messages');
      setCopyMessages(response.data);
    } catch (error) {
      console.error('Error loading copy messages:', error);
    }
  };

  useEffect(() => {
    if (formData.categoryId) {
      loadSubcategories(formData.categoryId);
    } else {
      setSubcategories([]);
    }
  }, [formData.categoryId]);

  const loadData = async () => {
    try {
      const [channelsRes, categoriesRes] = await Promise.all([
        api.get('/channels'),
        api.get('/categories'),
      ]);
      setChannels(channelsRes.data);
      setCategories(categoriesRes.data);
      
      // Carregar produtos de cada canal
      for (const channel of channelsRes.data) {
        await loadChannelProducts(channel.id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChannelProducts = async (channelId: string) => {
    try {
      const response = await api.get(`/channels/${channelId}/products`);
      setProductsByChannel((prev) => ({ ...prev, [channelId]: response.data }));
    } catch (error) {
      console.error('Error loading channel products:', error);
    }
  };

  const toggleChannelExpansion = (channelId: string) => {
    setExpandedChannels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(channelId)) {
        newSet.delete(channelId);
      } else {
        newSet.add(channelId);
        // Carregar produtos se ainda não foram carregados
        if (!productsByChannel[channelId]) {
          loadChannelProducts(channelId);
        }
      }
      return newSet;
    });
  };

  const searchProducts = async (channelId: string, term: string) => {
    if (term.trim().length < 2) {
      setProductSuggestions((prev) => ({ ...prev, [channelId]: [] }));
      return;
    }

    try {
      // Buscar produtos de todos os canais para sugestão
      const response = await api.get(`/products?search=${encodeURIComponent(term)}`);
      // Filtrar produtos que já estão relacionados ao canal
      const relatedProductIds = (productsByChannel[channelId] || []).map((p) => p.id);
      const filtered = response.data.filter((p: Product) => !relatedProductIds.includes(p.id));
      setProductSuggestions((prev) => ({ ...prev, [channelId]: filtered }));
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  const handleCreateProduct = async (channelId: string, productName: string) => {
    try {
      await api.post(`/channels/${channelId}/products`, {
        name: productName.trim(),
        isActive: true,
      });
      await loadChannelProducts(channelId);
      setProductSearchTerm((prev) => ({ ...prev, [channelId]: '' }));
      setProductSuggestions((prev) => ({ ...prev, [channelId]: [] }));
      setShowProductForm((prev) => ({ ...prev, [channelId]: false }));
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao criar produto');
    }
  };

  const handleDeleteProduct = async (channelId: string, productId: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    
    try {
      await api.delete(`/channels/${channelId}/products/${productId}`);
      await loadChannelProducts(channelId);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao excluir produto');
    }
  };

  const handleLinkCopy = async (channelId: string, productId: string, copyMessageId: string) => {
    try {
      await api.post(`/channels/${channelId}/products/${productId}/copies`, {
        copyMessageId,
      });
      await loadChannelProducts(channelId);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao relacionar copy');
    }
  };

  const handleUnlinkCopy = async (channelId: string, productId: string, copyId: string) => {
    try {
      await api.delete(`/channels/${channelId}/products/${productId}/copies/${copyId}`);
      await loadChannelProducts(channelId);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao desrelacionar copy');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingChannel) {
        await api.patch(`/channels/${editingChannel.id}`, formData);
        setEditingChannel(null);
      } else {
        await api.post('/channels', formData);
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao salvar canal');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'telegram',
      chatId: '',
      description: '',
      categoryId: '',
      isActive: true,
    });
  };

  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name,
      type: channel.type,
      chatId: channel.chatId,
      description: channel.description || '',
      categoryId: channel.categoryId || '',
      isActive: channel.isActive,
    });
    if (channel.categoryId) {
      loadSubcategories(channel.categoryId);
    }
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingChannel(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este canal?')) return;

    try {
      await api.delete(`/channels/${id}`);
      loadData();
    } catch (error: any) {
      console.error('Error deleting channel:', error);
      alert(error.response?.data?.message || 'Erro ao excluir canal');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-8 text-dark-text">Carregando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-dark-text">Canais de Comunicação</h1>
          <button
            onClick={() => {
              if (showForm) {
                handleCancel();
              } else {
                setShowForm(true);
              }
            }}
            className="bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-600 transition-colors"
          >
            {showForm ? 'Cancelar' : 'Novo Canal'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-dark-surface border border-dark-border shadow-lg rounded-lg p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">
                Nome
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">
                Tipo de Canal *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="telegram">Telegram</option>
                <option value="instagram_stories">Instagram Stories</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="facebook">Facebook</option>
                <option value="twitter">Twitter</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">
                ID do Canal *
              </label>
              <input
                type="text"
                value={formData.chatId}
                onChange={(e) => setFormData({ ...formData, chatId: e.target.value })}
                required
                placeholder={
                  formData.type === 'telegram'
                    ? '@channelname ou -1001234567890'
                    : formData.type === 'instagram_stories'
                    ? 'ID da conta Instagram'
                    : formData.type === 'whatsapp'
                    ? 'Número do WhatsApp (ex: 5511999999999)'
                    : 'ID do canal'
                }
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-text mb-1">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="border-t border-dark-border pt-4">
              <h3 className="text-lg font-medium text-dark-text mb-4">Configurações do Canal</h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Categoria *
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      categoryId: e.target.value,
                    })
                  }
                  required
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Selecione uma categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.categoryId && subcategories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Subcategorias disponíveis
                  </label>
                  <div className="text-sm text-dark-muted">
                    {subcategories.map((subcat) => subcat.name).join(', ')}
                  </div>
                  <p className="text-xs text-dark-muted/70 mt-1">
                    Todas as subcategorias desta categoria estarão disponíveis para este canal
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-primary-500 bg-dark-bg border-dark-border rounded focus:ring-primary-500 focus:ring-2"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-dark-text">
                Canal ativo
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-600 transition-colors"
            >
              {editingChannel ? 'Atualizar' : 'Criar'} Canal
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="bg-dark-surface border border-dark-border shadow-lg rounded-lg p-6 hover:bg-dark-bg/50 transition-colors flex flex-col"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-medium text-dark-text">{channel.name}</h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    {channel.type === 'telegram'
                      ? 'Telegram'
                      : channel.type === 'instagram_stories'
                      ? 'Instagram'
                      : channel.type === 'whatsapp'
                      ? 'WhatsApp'
                      : channel.type === 'facebook'
                      ? 'Facebook'
                      : channel.type === 'twitter'
                      ? 'Twitter'
                      : channel.type}
                  </span>
                </div>
                <p className="text-sm text-dark-muted mb-2">{channel.chatId}</p>
                {channel.description && (
                  <p className="text-sm text-dark-muted/70 mb-3">{channel.description}</p>
                )}
                {channel.category && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {channel.category.name}
                    </span>
                    {channel.category.subcategories && channel.category.subcategories.length > 0 && (
                      <span className="text-xs text-dark-muted">
                        {channel.category.subcategories.length} subcategoria(s)
                      </span>
                    )}
                  </div>
                )}
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    channel.isActive
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-dark-border/50 text-dark-muted border border-dark-border'
                  }`}
                >
                  {channel.isActive ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-dark-border">
                <button
                  onClick={() => toggleChannelExpansion(channel.id)}
                  className="flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
                  title="Gerenciar Produtos"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 transition-transform ${expandedChannels.has(channel.id) ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  Produtos
                </button>
                <button
                  onClick={() => handleEdit(channel)}
                  className="flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
                  title="Editar canal"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(channel.id)}
                  className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors ml-auto"
                  title="Excluir canal"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Excluir
                </button>
              </div>

              {/* Seção de Produtos */}
              {expandedChannels.has(channel.id) && (
                <div className="mt-4 pt-4 border-t border-dark-border">
                  <h3 className="text-sm font-semibold text-dark-text mb-3">
                    Produtos do Canal
                  </h3>
                  
                  {/* Lista de produtos */}
                  <div className="space-y-2 mb-3">
                    {(productsByChannel[channel.id] || []).map((product) => (
                      <div
                        key={product.id}
                        className="bg-dark-bg/50 border border-dark-border rounded p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-dark-text">{product.name}</div>
                            {product.copyMessages && product.copyMessages.length > 0 && (
                              <div className="text-xs text-dark-muted mt-1">
                                {product.copyMessages.length} copy(s) relacionada(s)
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteProduct(channel.id, product.id)}
                            className="text-red-400 hover:text-red-300 text-sm ml-2"
                            title="Excluir produto"
                          >
                            ×
                          </button>
                        </div>
                        
                        {/* Copies relacionadas */}
                        {product.copyMessages && product.copyMessages.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {product.copyMessages.map((pcm) => (
                              <span
                                key={pcm.copyMessage.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded text-xs"
                              >
                                {pcm.copyMessage.message.substring(0, 30)}...
                                <button
                                  onClick={() => handleUnlinkCopy(channel.id, product.id, pcm.copyMessage.id)}
                                  className="hover:text-primary-300"
                                  title="Remover copy"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Adicionar copy */}
                        <div className="mt-2 relative">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                handleLinkCopy(channel.id, product.id, e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-xs text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                            defaultValue=""
                          >
                            <option value="">Adicionar copy...</option>
                            {copyMessages
                              .filter((copy) => {
                                // Filtrar copies que já estão relacionadas
                                const alreadyLinked = product.copyMessages?.some(
                                  (pcm) => pcm.copyMessage.id === copy.id
                                );
                                if (alreadyLinked || !copy.isActive) {
                                  return false;
                                }
                                
                                // Filtrar pela categoria do canal
                                const channelCategoryId = channel.categoryId || channel.category?.id;
                                
                                // Se o canal tem categoria, mostrar apenas copies sem categoria (geral) ou com a mesma categoria
                                if (channelCategoryId) {
                                  // Copy sem categoria (geral) ou com a mesma categoria do canal
                                  return !copy.categoryId || copy.categoryId === channelCategoryId;
                                }
                                
                                // Se o canal não tem categoria, mostrar apenas copies sem categoria (geral)
                                return !copy.categoryId;
                              })
                              .map((copy) => {
                                const copyText = copy.message.substring(0, 40);
                                let prefix = '';
                                if (copy.subcategory) {
                                  prefix = `${copy.subcategory.name} - `;
                                } else if (copy.category) {
                                  prefix = `${copy.category.name} - `;
                                }
                                return (
                                  <option key={copy.id} value={copy.id}>
                                    {prefix}{copyText}
                                  </option>
                                );
                              })}
                          </select>
                        </div>
                      </div>
                    ))}
                    {(!productsByChannel[channel.id] || productsByChannel[channel.id].length === 0) && (
                      <p className="text-sm text-dark-muted">Nenhum produto cadastrado</p>
                    )}
                  </div>

                  {/* Adicionar produto */}
                  <div className="relative">
                    <input
                      type="text"
                      value={productSearchTerm[channel.id] || ''}
                      onChange={(e) => {
                        const term = e.target.value;
                        setProductSearchTerm((prev) => ({ ...prev, [channel.id]: term }));
                        searchProducts(channel.id, term);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && productSearchTerm[channel.id]?.trim()) {
                          e.preventDefault();
                          handleCreateProduct(channel.id, productSearchTerm[channel.id]);
                        }
                      }}
                      placeholder="Digite o nome do produto..."
                      className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    {productSuggestions[channel.id] && productSuggestions[channel.id].length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-dark-surface border border-dark-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {productSuggestions[channel.id].map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => handleCreateProduct(channel.id, suggestion.name)}
                            className="w-full text-left px-3 py-2 hover:bg-dark-bg transition-colors border-b border-dark-border last:border-b-0 text-dark-text text-sm"
                          >
                            {suggestion.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {productSearchTerm[channel.id]?.trim() && (
                      <button
                        onClick={() => handleCreateProduct(channel.id, productSearchTerm[channel.id])}
                        className="mt-2 w-full px-3 py-1.5 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-sm"
                      >
                        Adicionar Produto
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

