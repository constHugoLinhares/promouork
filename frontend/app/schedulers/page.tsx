'use client';

import Layout from '@/components/Layout';
import ProductAutocomplete from '@/components/ProductAutocomplete';
import api from '@/lib/api';
import { useEffect, useState } from 'react';

interface Channel {
  id: string;
  name: string;
  type: string;
  chatId?: string;
  isActive: boolean;
  category?: { name: string };
}

interface Integration {
  id: string;
  name: string;
  type: string;
  channels: Channel[];
}

interface Product {
  id: string;
  name: string;
  channelId?: string;
  category?: { id: string; name: string };
  subcategory?: { id: string; name: string };
}

interface PostScheduler {
  id: string;
  name: string;
  integrationId: string;
  intervalMinutes: number;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  config?: {
    productIds?: string[];
    keywords?: string[];
    limit?: number;
    minRatingStar?: number;
    blockedKeywords?: string[];
  };
  integration?: Integration;
  channels: Array<{
    id: string;
    channelId: string;
    channel: Channel;
  }>;
}

const defaultSchedulerForm = {
  name: '',
  integrationId: '',
  intervalMinutes: 5,
  isActive: true,
  limit: 1,
  minRatingStar: 4.5,
  blockedKeywords: [] as string[],
};

export default function SchedulersPage() {
  const [schedulers, setSchedulers] = useState<PostScheduler[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [addChannelSchedulerId, setAddChannelSchedulerId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(defaultSchedulerForm);
  const [createChannelIds, setCreateChannelIds] = useState<string[]>([]);
  const [createProducts, setCreateProducts] = useState<Product[]>([]);
  const [newBlockedKeyword, setNewBlockedKeyword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingScheduler, setEditingScheduler] = useState<PostScheduler | null>(null);
  const [editForm, setEditForm] = useState(defaultSchedulerForm);
  const [editChannelIds, setEditChannelIds] = useState<string[]>([]);
  const [editProducts, setEditProducts] = useState<Product[]>([]);
  const [editNewBlockedKeyword, setEditNewBlockedKeyword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [linkingChannel, setLinkingChannel] = useState<string | null>(null);
  const [manageChannelsIntegrationId, setManageChannelsIntegrationId] = useState<string | null>(null);
  const [showManageChannelsModal, setShowManageChannelsModal] = useState(false);

  const loadData = async () => {
    try {
      const [schedulersRes, integrationsRes, channelsRes] = await Promise.all([
        api.get<PostScheduler[]>('/schedulers').catch(() => ({ data: [] })),
        api.get<Integration[]>('/integrations').catch(() => ({ data: [] })),
        api.get<Channel[]>('/channels').catch(() => ({ data: [] })),
      ]);
      setSchedulers(schedulersRes.data || []);
      setIntegrations(integrationsRes.data || []);
      setChannels(channelsRes.data || []);
    } catch (e) {
      console.error('Error loading schedulers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getAvailableChannels = (scheduler: PostScheduler): Channel[] => {
    const integration = integrations.find((i) => i.id === scheduler.integrationId);
    const connectedChannels = integration?.channels ?? [];
    const linkedIds = new Set(scheduler.channels.map((sc) => sc.channelId));
    return connectedChannels.filter((c) => !linkedIds.has(c.id));
  };

  const updateSchedulerChannels = async (
    schedulerId: string,
    channelIds: string[],
  ) => {
    setUpdatingId(schedulerId);
    setAddChannelSchedulerId(null);
    try {
      await api.patch(`/schedulers/${schedulerId}`, { channelIds });
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao atualizar canais');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddChannel = (scheduler: PostScheduler, channel: Channel) => {
    const currentIds = scheduler.channels.map((sc) => sc.channelId);
    if (currentIds.includes(channel.id)) return;
    updateSchedulerChannels(scheduler.id, [...currentIds, channel.id]);
  };

  const handleRemoveChannel = (scheduler: PostScheduler, channelId: string) => {
    if (!confirm('Remover este canal do agendador? O agendador deixará de publicar nele.')) return;
    const newIds = scheduler.channels
      .map((sc) => sc.channelId)
      .filter((id) => id !== channelId);
    updateSchedulerChannels(scheduler.id, newIds);
  };

  const handleCreateScheduler = async () => {
    if (!createForm.integrationId) {
      alert('Selecione uma integração.');
      return;
    }
    if (createForm.name.trim() === '') {
      alert('Informe o nome do agendador.');
      return;
    }
    if (createProducts.length === 0) {
      alert('Adicione pelo menos um produto para busca.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/schedulers', {
        name: createForm.name.trim(),
        integrationId: createForm.integrationId,
        intervalMinutes: createForm.intervalMinutes,
        isActive: createForm.isActive,
        channelIds: createChannelIds,
        config: {
          productIds: createProducts.map((p) => p.id),
          keywords: createProducts.map((p) => p.name),
          limit: createForm.limit,
          minRatingStar: createForm.minRatingStar,
          blockedKeywords: createForm.blockedKeywords,
        },
      });
      setShowCreateModal(false);
      setCreateForm(defaultSchedulerForm);
      setCreateChannelIds([]);
      setCreateProducts([]);
      setNewBlockedKeyword('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao criar agendador');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScheduler = async (scheduler: PostScheduler) => {
    if (!confirm(`Excluir o agendador "${scheduler.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(scheduler.id);
    try {
      await api.delete(`/schedulers/${scheduler.id}`);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao excluir agendador');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenEdit = async (scheduler: PostScheduler) => {
    setEditingScheduler(scheduler);
    setEditForm({
      name: scheduler.name,
      integrationId: scheduler.integrationId,
      intervalMinutes: scheduler.intervalMinutes,
      isActive: scheduler.isActive,
      limit: scheduler.config?.limit ?? 1,
      minRatingStar: scheduler.config?.minRatingStar ?? 4.5,
      blockedKeywords: scheduler.config?.blockedKeywords ?? [],
    });
    setEditChannelIds(scheduler.channels.map((sc) => sc.channelId));
    setEditNewBlockedKeyword('');
    let products: Product[] = [];
    const productIds = scheduler.config?.productIds ?? [];
    if (productIds.length > 0) {
      try {
        const res = await Promise.all(
          productIds.map((id) => api.get(`/products/${id}`)),
        );
        products = res.map((r) => r.data);
      } catch (e) {
        console.error('Error loading products for edit:', e);
      }
    }
    setEditProducts(products);
  };

  const handleSaveEdit = async () => {
    if (!editingScheduler) return;
    if (editChannelIds.length === 0) {
      alert('Selecione pelo menos um canal.');
      return;
    }
    if (editForm.name.trim() === '') {
      alert('Informe o nome do agendador.');
      return;
    }
    if (editProducts.length === 0) {
      alert('Adicione pelo menos um produto para busca.');
      return;
    }
    setSavingEdit(true);
    try {
      await api.patch(`/schedulers/${editingScheduler.id}`, {
        name: editForm.name.trim(),
        intervalMinutes: editForm.intervalMinutes,
        isActive: editForm.isActive,
        channelIds: editChannelIds,
        config: {
          productIds: editProducts.map((p) => p.id),
          keywords: editProducts.map((p) => p.name),
          limit: editForm.limit,
          minRatingStar: editForm.minRatingStar,
          blockedKeywords: editForm.blockedKeywords,
        },
      });
      setEditingScheduler(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao atualizar agendador');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleCreateChannel = (channelId: string) => {
    setCreateChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId],
    );
  };

  const handleLinkChannelToIntegration = async (
    integrationId: string,
    channelId: string,
  ) => {
    const key = `${integrationId}-${channelId}`;
    setLinkingChannel(key);
    try {
      await api.post(`/integrations/${integrationId}/channels/${channelId}`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao vincular canal');
    } finally {
      setLinkingChannel(null);
    }
  };

  const handleUnlinkChannelFromIntegration = async (
    integrationId: string,
    channelId: string,
  ) => {
    const key = `unlink-${integrationId}-${channelId}`;
    setLinkingChannel(key);
    try {
      await api.delete(`/integrations/${integrationId}/channels/${channelId}`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao desvincular canal');
    } finally {
      setLinkingChannel(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="px-4 py-6 sm:px-0">
          <p className="text-dark-muted">Carregando agendadores...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-dark-text mb-2">Agendadores</h1>
            <p className="text-dark-muted">
              Visualize os agendadores e gerencie os canais que recebem publicações automáticas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowManageChannelsModal(true)}
              className="px-4 py-2 rounded-md border border-dark-border bg-dark-bg/50 text-dark-text hover:bg-dark-border/50 transition-colors font-medium"
            >
              Gerenciar canais
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-600 transition-colors font-medium"
            >
              + Novo agendador
            </button>
          </div>
        </div>

        {schedulers.length === 0 ? (
          <div className="bg-dark-surface border border-dark-border rounded-lg p-8 text-center">
            <p className="text-dark-muted mb-2">Nenhum agendador cadastrado.</p>
            <p className="text-sm text-dark-muted mb-4">
              Crie um agendador clicando em <strong>Novo agendador</strong> acima.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="text-primary-400 hover:text-primary-300 font-medium"
            >
              + Novo agendador
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {schedulers.map((scheduler) => {
              const integration = integrations.find(
                (i) => i.id === scheduler.integrationId,
              );
              const availableChannels = getAvailableChannels(scheduler);
              const isUpdating = updatingId === scheduler.id;
              const showAddDropdown = addChannelSchedulerId === scheduler.id;

              return (
                <div
                  key={scheduler.id}
                  className="bg-dark-surface border border-dark-border rounded-lg p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-dark-text">
                        {scheduler.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-dark-muted">
                        <span>
                          Integração: <strong className="text-dark-text">{integration?.name ?? scheduler.integrationId}</strong>
                        </span>
                        <span>•</span>
                        <span>A cada {scheduler.intervalMinutes} min</span>
                        <span>•</span>
                        <span
                          className={
                            scheduler.isActive
                              ? 'text-green-400'
                              : 'text-gray-400'
                          }
                        >
                          {scheduler.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        {scheduler.nextRunAt && (
                          <>
                            <span>•</span>
                            <span>
                              Próxima: {new Date(scheduler.nextRunAt).toLocaleString('pt-BR')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(scheduler)}
                        className="px-3 py-1.5 text-sm font-medium rounded-md border border-dark-border bg-dark-bg/50 text-dark-text hover:bg-dark-border/50 transition-colors"
                        title="Editar agendador"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteScheduler(scheduler)}
                        disabled={deletingId === scheduler.id}
                        className="px-3 py-1.5 text-sm font-medium rounded-md border border-red-500/40 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
                        title="Excluir agendador"
                      >
                        {deletingId === scheduler.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-dark-border pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-dark-text">
                        Canais vinculados ({scheduler.channels.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        {availableChannels.length > 0 && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setAddChannelSchedulerId(
                                  showAddDropdown ? null : scheduler.id,
                                )
                              }
                              disabled={isUpdating}
                              className="px-2.5 py-1 text-sm font-medium rounded border border-primary-500/40 bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 disabled:opacity-50"
                            >
                              + Adicionar canal
                            </button>
                            {showAddDropdown && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  aria-hidden
                                  onClick={() => setAddChannelSchedulerId(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 py-1 min-w-[200px] bg-dark-surface border border-dark-border rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                                  {availableChannels.map((ch) => (
                                    <button
                                      key={ch.id}
                                      type="button"
                                      onClick={() => handleAddChannel(scheduler, ch)}
                                      className="w-full text-left px-3 py-2 text-sm text-dark-text hover:bg-dark-border/50"
                                    >
                                      {ch.name}
                                      {ch.type && (
                                        <span className="text-dark-muted text-xs ml-1">
                                          ({ch.type})
                                        </span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {isUpdating ? (
                      <p className="text-sm text-dark-muted py-2">
                        Atualizando...
                      </p>
                    ) : scheduler.channels.length === 0 ? (
                      <p className="text-sm text-dark-muted py-2">
                        Nenhum canal vinculado. Adicione um canal para este agendador publicar.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {scheduler.channels.map((sc) => (
                          <li
                            key={sc.id}
                            className="flex items-center justify-between gap-2 py-2 px-3 bg-dark-bg/50 rounded-md border border-dark-border/50"
                          >
                            <div className="min-w-0">
                              <span className="text-dark-text font-medium">
                                {sc.channel?.name ?? sc.channelId}
                              </span>
                              {sc.channel?.type && (
                                <span className="text-dark-muted text-xs ml-2">
                                  {sc.channel.type}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveChannel(scheduler, sc.channelId)
                              }
                              disabled={isUpdating}
                              className="px-2.5 py-1 text-sm font-medium rounded border border-red-500/40 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 shrink-0"
                              title="Remover canal do agendador"
                            >
                              Remover
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Novo agendador */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-dark-text mb-4">Novo agendador</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">Nome</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Ex: Agendador Shopee"
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">Integração</label>
                  <select
                    value={createForm.integrationId}
                    onChange={(e) => {
                      setCreateForm({ ...createForm, integrationId: e.target.value });
                      setCreateChannelIds([]);
                    }}
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Selecione...</option>
                    {integrations
                      .filter((i) => i.type !== 'evolution')
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                  </select>
                </div>

                {createForm.integrationId && (() => {
                  const createIntegration = integrations.find(
                    (i) => i.id === createForm.integrationId,
                  );
                  const createIntegrationChannels = createIntegration?.channels ?? [];
                  return (
                    <div className="border border-dark-border rounded-md overflow-hidden">
                      <div className="px-3 py-2.5 bg-dark-bg/50 border-b border-dark-border">
                        <p className="text-sm font-medium text-dark-text">Canais vinculados a este agendador</p>
                        <p className="text-xs text-dark-muted mt-0.5">
                          Marque &quot;Recebe envios&quot; para os canais da integração que este agendador enviará. Para adicionar canais à integração, use a tela de Integrações.
                        </p>
                      </div>
                      <div className="p-3 bg-dark-bg/20 max-h-56 overflow-y-auto">
                        {createIntegrationChannels.length === 0 ? (
                          <p className="text-sm text-dark-muted py-2">
                            Nenhum canal vinculado à integração. Vincule canais na tela de Integrações.
                          </p>
                        ) : (
                          <table className="w-full text-left text-sm">
                            <thead className="bg-dark-bg/80">
                              <tr>
                                <th className="px-2 py-1.5 text-dark-muted font-medium text-xs">Canal</th>
                                <th className="px-2 py-1.5 text-dark-muted font-medium text-xs">Tipo</th>
                                <th className="px-2 py-1.5 text-dark-muted font-medium text-xs w-20">Recebe envios</th>
                              </tr>
                            </thead>
                            <tbody>
                              {createIntegrationChannels.map((ch) => {
                                const receivesFromScheduler = createChannelIds.includes(ch.id);
                                return (
                                  <tr
                                    key={ch.id}
                                    className="border-t border-dark-border/50 hover:bg-dark-bg/30"
                                  >
                                    <td className="px-2 py-1.5 text-dark-text font-medium text-xs">
                                      {ch.name}
                                    </td>
                                    <td className="px-2 py-1.5 text-dark-muted text-xs">
                                      {ch.type ?? '—'}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={receivesFromScheduler}
                                          onChange={() => toggleCreateChannel(ch.id)}
                                          className="w-3.5 h-3.5 text-primary-500 bg-dark-bg border-dark-border rounded"
                                        />
                                        <span className="text-xs text-dark-muted">Sim</span>
                                      </label>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Intervalo (minutos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.intervalMinutes}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        intervalMinutes: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Produtos a serem pesquisados
                  </label>
                  <ProductAutocomplete
                    value={createProducts}
                    onChange={setCreateProducts}
                    placeholder="Digite o nome do produto (ex: fone bluetooth)"
                    channelIds={createChannelIds}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Palavras bloqueadas
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: capa"
                      value={newBlockedKeyword}
                      onChange={(e) => setNewBlockedKeyword(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newBlockedKeyword.trim()) {
                            setCreateForm({
                              ...createForm,
                              blockedKeywords: [
                                ...createForm.blockedKeywords,
                                newBlockedKeyword.trim(),
                              ],
                            });
                            setNewBlockedKeyword('');
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newBlockedKeyword.trim()) {
                          setCreateForm({
                            ...createForm,
                            blockedKeywords: [
                              ...createForm.blockedKeywords,
                              newBlockedKeyword.trim(),
                            ],
                          });
                          setNewBlockedKeyword('');
                        }
                      }}
                      className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
                  {createForm.blockedKeywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {createForm.blockedKeywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => {
                              setCreateForm({
                                ...createForm,
                                blockedKeywords: createForm.blockedKeywords.filter(
                                  (_, i) => i !== index,
                                ),
                              });
                            }}
                            className="hover:text-red-300"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-dark-text mb-1">
                      Produtos por execução
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={createForm.limit}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          limit: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-dark-text mb-1">
                      Rating mínimo (0-5)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={createForm.minRatingStar}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          minRatingStar: Math.max(
                            0,
                            Math.min(5, parseFloat(e.target.value) || 4.5),
                          ),
                        })
                      }
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createForm.isActive}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-primary-500 bg-dark-bg border-dark-border rounded"
                  />
                  <span className="text-sm text-dark-text">Agendador ativo</span>
                </label>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={handleCreateScheduler}
                  disabled={saving}
                  className="flex-1 bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Criando...' : 'Criar agendador'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateForm(defaultSchedulerForm);
                    setCreateChannelIds([]);
                    setCreateProducts([]);
                    setNewBlockedKeyword('');
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Editar agendador */}
        {editingScheduler && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-dark-text mb-4">Editar agendador</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">Nome</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Ex: Agendador Shopee"
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Intervalo (minutos)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.intervalMinutes}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        intervalMinutes: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Produtos a serem pesquisados
                  </label>
                  <ProductAutocomplete
                    value={editProducts}
                    onChange={setEditProducts}
                    placeholder="Digite o nome do produto (ex: fone bluetooth)"
                    channelIds={editChannelIds}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Palavras bloqueadas
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ex: capa"
                      value={editNewBlockedKeyword}
                      onChange={(e) => setEditNewBlockedKeyword(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (editNewBlockedKeyword.trim()) {
                            setEditForm({
                              ...editForm,
                              blockedKeywords: [
                                ...editForm.blockedKeywords,
                                editNewBlockedKeyword.trim(),
                              ],
                            });
                            setEditNewBlockedKeyword('');
                          }
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editNewBlockedKeyword.trim()) {
                          setEditForm({
                            ...editForm,
                            blockedKeywords: [
                              ...editForm.blockedKeywords,
                              editNewBlockedKeyword.trim(),
                            ],
                          });
                          setEditNewBlockedKeyword('');
                        }
                      }}
                      className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
                  {editForm.blockedKeywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {editForm.blockedKeywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => {
                              setEditForm({
                                ...editForm,
                                blockedKeywords: editForm.blockedKeywords.filter(
                                  (_, i) => i !== index,
                                ),
                              });
                            }}
                            className="hover:text-red-300"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-dark-text mb-1">
                      Produtos por execução
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.limit}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          limit: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-dark-text mb-1">
                      Rating mínimo (0-5)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={editForm.minRatingStar}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          minRatingStar: Math.max(
                            0,
                            Math.min(5, parseFloat(e.target.value) || 4.5),
                          ),
                        })
                      }
                      className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) =>
                      setEditForm({ ...editForm, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-primary-500 bg-dark-bg border-dark-border rounded"
                  />
                  <span className="text-sm text-dark-text">Agendador ativo</span>
                </label>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  {savingEdit ? 'Salvando...' : 'Salvar alterações'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingScheduler(null)}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Gerenciar canais (visão por canal: integrações em cada canal) */}
        {showManageChannelsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col">
              <h3 className="text-lg font-semibold text-dark-text mb-2">
                Gerenciar canais
              </h3>
              <p className="text-sm text-dark-muted mb-4">
                Para cada canal, veja em quais integrações está vinculado e vincule ou desvincule.
              </p>
              <div className="flex-1 overflow-y-auto border border-dark-border rounded-md min-h-0">
                {channels.length === 0 ? (
                  <p className="py-6 text-center text-dark-muted text-sm">
                    Nenhum canal cadastrado. Cadastre canais em Canais.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-dark-bg/80 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-dark-muted font-medium">Canal</th>
                        <th className="px-3 py-2 text-dark-muted font-medium">Tipo</th>
                        <th className="px-3 py-2 text-dark-muted font-medium">Integrações vinculadas</th>
                        <th className="px-3 py-2 text-dark-muted font-medium w-40">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((ch) => {
                        const integrationsWithChannel = integrations.filter(
                          (i) => i.type !== 'evolution' && i.channels?.some((c) => c.id === ch.id),
                        );
                        const integrationsWithoutChannel = integrations.filter(
                          (i) => i.type !== 'evolution' && !i.channels?.some((c) => c.id === ch.id),
                        );
                        return (
                          <tr
                            key={ch.id}
                            className="border-t border-dark-border hover:bg-dark-bg/30"
                          >
                            <td className="px-3 py-2 text-dark-text font-medium">
                              {ch.name}
                            </td>
                            <td className="px-3 py-2 text-dark-muted">
                              {ch.type ?? '—'}
                            </td>
                            <td className="px-3 py-2">
                              {integrationsWithChannel.length === 0 ? (
                                <span className="text-dark-muted text-xs">Nenhuma</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {integrationsWithChannel.map((int) => {
                                    const unlinkKey = `unlink-${int.id}-${ch.id}`;
                                    const isBusy = linkingChannel === unlinkKey;
                                    return (
                                      <span
                                        key={int.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-dark-bg/80 text-xs text-dark-text border border-dark-border"
                                      >
                                        {int.name}
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          onClick={() =>
                                            handleUnlinkChannelFromIntegration(int.id, ch.id)
                                          }
                                          className="text-red-400 hover:underline disabled:opacity-50"
                                          title="Desvincular desta integração"
                                        >
                                          {linkingChannel === unlinkKey ? '...' : '×'}
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {integrationsWithoutChannel.length === 0 ? (
                                <span className="text-dark-muted text-xs">—</span>
                              ) : (
                                <select
                                  key={`link-${ch.id}-${integrationsWithChannel.map((i) => i.id).sort().join('-')}`}
                                  className="mr-1 px-2 py-1 text-xs bg-dark-bg border border-dark-border rounded text-dark-text"
                                  defaultValue=""
                                  onChange={async (e) => {
                                    const integrationId = e.target.value;
                                    if (!integrationId) return;
                                    await handleLinkChannelToIntegration(integrationId, ch.id);
                                  }}
                                >
                                  <option value="">Vincular a...</option>
                                  {integrationsWithoutChannel.map((i) => (
                                    <option key={i.id} value={i.id}>
                                      {i.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowManageChannelsModal(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-dark-border bg-dark-bg/50 text-dark-text hover:bg-dark-border/50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Gerenciar canais da integração */}
        {manageChannelsIntegrationId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
              <h3 className="text-lg font-semibold text-dark-text mb-2">
                Gerenciar canais da integração
              </h3>
              <p className="text-sm text-dark-muted mb-4">
                {integrations.find((i) => i.id === manageChannelsIntegrationId)
                  ?.name ?? 'Integração'}{' '}
                — Vincule ou desvincule canais à integração. Depois, em cada agendador, marque &quot;Recebe envios&quot; para os canais que receberão os envios.
              </p>
              <div className="flex-1 overflow-y-auto border border-dark-border rounded-md min-h-0">
                {channels.length === 0 ? (
                  <p className="py-6 text-center text-dark-muted text-sm">
                    Nenhum canal cadastrado. Cadastre canais em Canais para
                    vinculá-los às integrações.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-dark-bg/80 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-dark-muted font-medium">
                          Canal
                        </th>
                        <th className="px-3 py-2 text-dark-muted font-medium">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-dark-muted font-medium">
                          Status
                        </th>
                        <th className="px-3 py-2 text-dark-muted font-medium w-32">
                          Ação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((ch) => {
                      const integration = integrations.find(
                        (i) => i.id === manageChannelsIntegrationId,
                      );
                      const isLinked =
                        integration?.channels?.some((c) => c.id === ch.id) ?? false;
                      const linkKey = `${manageChannelsIntegrationId}-${ch.id}`;
                      const unlinkKey = `unlink-${manageChannelsIntegrationId}-${ch.id}`;
                      const isBusy =
                        linkingChannel === linkKey || linkingChannel === unlinkKey;
                      return (
                        <tr
                          key={ch.id}
                          className="border-t border-dark-border hover:bg-dark-bg/30"
                        >
                          <td className="px-3 py-2 text-dark-text font-medium">
                            {ch.name}
                          </td>
                          <td className="px-3 py-2 text-dark-muted">
                            {ch.type ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            {isLinked ? (
                              <span className="text-green-400 text-xs font-medium">
                                Vinculado
                              </span>
                            ) : (
                              <span className="text-dark-muted text-xs">
                                Não vinculado
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isLinked ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleUnlinkChannelFromIntegration(
                                    manageChannelsIntegrationId,
                                    ch.id,
                                  )
                                }
                                className="px-2.5 py-1 text-xs font-medium rounded border border-red-500/40 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                              >
                                {linkingChannel === unlinkKey
                                  ? 'Desvinculando...'
                                  : 'Desvincular'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() =>
                                  handleLinkChannelToIntegration(
                                    manageChannelsIntegrationId,
                                    ch.id,
                                  )
                                }
                                className="px-2.5 py-1 text-xs font-medium rounded border border-primary-500/40 bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 disabled:opacity-50"
                              >
                                {linkingChannel === linkKey
                                  ? 'Vinculando...'
                                  : 'Vincular'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setManageChannelsIntegrationId(null)}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-dark-border bg-dark-bg/50 text-dark-text hover:bg-dark-border/50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
