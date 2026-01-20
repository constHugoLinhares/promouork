'use client';

import Layout from '@/components/Layout';
import ProductAutocomplete from '@/components/ProductAutocomplete';
import api from '@/lib/api';
import { useEffect, useState } from 'react';

interface Channel {
  id: string;
  name: string;
  type: string;
  category?: {
    id: string;
    name: string;
  };
}

interface IntegrationChannelConfig {
  id: string;
  integrationId: string;
  channelId: string;
  config: {
    keywords?: string[]; // Para Shopee
    [key: string]: any; // Outros parâmetros específicos da integração
  };
  isActive: boolean;
  channel: Channel;
}

interface Product {
  id: string;
  name: string;
  category?: {
    id: string;
    name: string;
  };
  subcategory?: {
    id: string;
    name: string;
  };
}

interface PostScheduler {
  id: string;
  name: string;
  integrationId: string;
  intervalMinutes: number;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  config: {
    keywords?: string[]; // Mantido para compatibilidade
    productIds?: string[]; // IDs dos Products
    category?: string;
    subcategory?: string;
    limit?: number;
    minCommission?: number;
    minScore?: number;
    minRatingStar?: number; // Rating mínimo (0-5)
    blockedKeywords?: string[]; // Palavras bloqueadas
  };
  channels: Array<{
    id: string;
    channelId: string;
    channel: Channel;
  }>;
}

interface Integration {
  id: string;
  type: string;
  name: string;
  description?: string;
  isActive: boolean;
  credentials?: Record<string, any>;
  channels: Channel[];
  channelConfigs: IntegrationChannelConfig[];
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [configData, setConfigData] = useState<{
    keywords: string[];
    [key: string]: any;
  }>({
    keywords: [],
  });
  const [newKeyword, setNewKeyword] = useState('');
  const [newBlockedKeyword, setNewBlockedKeyword] = useState('');
  const [schedulers, setSchedulers] = useState<PostScheduler[]>([]);
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [schedulerData, setSchedulerData] = useState({
    name: '',
    intervalMinutes: 5,
    isActive: true,
    keywords: [] as string[], // Mantido para compatibilidade
    productIds: [] as string[],
    limit: 1,
    minRatingStar: 4.5, // Valor padrão 4.5
    blockedKeywords: [] as string[],
  });
  const [schedulerProducts, setSchedulerProducts] = useState<Product[]>([]);
  const [showShopeeCredentialsModal, setShowShopeeCredentialsModal] = useState(false);
  const [shopeeCredentials, setShopeeCredentials] = useState({
    appId: '',
    password: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [integrationsRes, channelsRes, schedulersRes] = await Promise.all([
        api.get('/integrations'),
        api.get('/channels'),
        api.get('/schedulers').catch(() => ({ data: [] })), // Ignorar erro se não existir
      ]);
      setIntegrations(integrationsRes.data);
      setChannels(channelsRes.data);
      setSchedulers(schedulersRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChannel = async (integrationId: string, channelId: string) => {
    try {
      await api.post(`/integrations/${integrationId}/channels/${channelId}`);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao adicionar canal');
    }
  };

  const handleRemoveChannel = async (integrationId: string, channelId: string) => {
    if (!confirm('Tem certeza que deseja remover este canal da integração?')) return;

    try {
      await api.delete(`/integrations/${integrationId}/channels/${channelId}`);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao remover canal');
    }
  };

  const handleOpenConfigModal = async (integration: Integration, channel: Channel) => {
    setSelectedIntegration(integration);
    setSelectedChannel(channel);

    // Buscar configuração existente
    try {
      const config = await api.get(
        `/integrations/${integration.id}/channels/${channel.id}/config`,
      );
      if (config.data) {
        setConfigData(config.data.config || { keywords: [] });
      } else {
        setConfigData({ keywords: [] });
      }
    } catch (error) {
      // Se não houver configuração, usar padrão
      setConfigData({ keywords: [] });
    }

    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedIntegration || !selectedChannel) return;

    try {
      await api.post(
        `/integrations/${selectedIntegration.id}/channels/${selectedChannel.id}/config`,
        {
          config: configData,
          isActive: true,
        },
      );
      setShowConfigModal(false);
      setSelectedIntegration(null);
      setSelectedChannel(null);
      setConfigData({ keywords: [] });
      setNewKeyword('');
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao salvar configuração');
    }
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !configData.keywords?.includes(newKeyword.trim())) {
      setConfigData({
        ...configData,
        keywords: [...(configData.keywords || []), newKeyword.trim()],
      });
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setConfigData({
      ...configData,
      keywords: configData.keywords?.filter((k) => k !== keyword) || [],
    });
  };

  const handleClearCache = async (integrationId: string, integrationName: string) => {
    if (
      !confirm(
        `Tem certeza que deseja limpar o cache da integração "${integrationName}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    try {
      const response = await api.delete(`/integrations/${integrationId}/cache`);
      alert(response.data.message || `Cache limpo com sucesso! ${response.data.deletedKeys} chaves removidas.`);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao limpar cache');
    }
  };

  const handleOpenSchedulerModal = async (integration: Integration, channel: Channel) => {
    setSelectedIntegration(integration);
    setSelectedChannel(channel);
    
    // Verificar se já existe scheduler para este canal
    const existingScheduler = schedulers.find(
      (s) =>
        s.integrationId === integration.id &&
        s.channels.some((sc) => sc.channelId === channel.id),
    );

    if (existingScheduler) {
      const productIds = existingScheduler.config.productIds || [];
      
      // Buscar Products se houver productIds
      let products: Product[] = [];
      if (productIds.length > 0) {
        try {
          const productsResponse = await Promise.all(
            productIds.map((id) => api.get(`/products/${id}`)),
          );
          products = productsResponse.map((res) => res.data);
        } catch (error) {
          console.error('Error loading products:', error);
        }
      }

      setSchedulerData({
        name: existingScheduler.name,
        intervalMinutes: existingScheduler.intervalMinutes,
        isActive: existingScheduler.isActive,
        keywords: existingScheduler.config.keywords || [],
        productIds: productIds,
        limit: existingScheduler.config.limit || 1,
        minRatingStar: existingScheduler.config.minRatingStar ?? 4.5,
        blockedKeywords: existingScheduler.config.blockedKeywords || [],
      });
      setSchedulerProducts(products);
    } else {
      // Usar configuração do canal se existir
      const channelConfig = integration.channelConfigs?.find(
        (c) => c.channelId === channel.id,
      );
      setSchedulerData({
        name: `Agendador - ${channel.name}`,
        intervalMinutes: 5,
        isActive: true,
        keywords: channelConfig?.config?.keywords || [],
        productIds: [],
        limit: 1,
        minRatingStar: 4.5,
        blockedKeywords: [],
      });
      setSchedulerProducts([]);
    }

    setShowSchedulerModal(true);
  };

  const handleSaveScheduler = async () => {
    if (!selectedIntegration || !selectedChannel) return;

    if (schedulerProducts.length === 0) {
      alert('Adicione pelo menos um produto para busca');
      return;
    }

    try {
      // Verificar se já existe scheduler
      const existingScheduler = schedulers.find(
        (s) =>
          s.integrationId === selectedIntegration.id &&
          s.channels.some((sc) => sc.channelId === selectedChannel.id),
      );

      // Converter Products para productIds e keywords (para compatibilidade)
      const productIds = schedulerProducts.map((p) => p.id);
      const keywords = schedulerProducts.map((p) => p.name); // Usar nomes como keywords para Shopee

      const schedulerPayload = {
        name: schedulerData.name,
        integrationId: selectedIntegration.id,
        intervalMinutes: schedulerData.intervalMinutes,
        isActive: schedulerData.isActive,
        channelIds: [selectedChannel.id],
        config: {
          productIds: productIds,
          keywords: keywords, // Manter para compatibilidade
          limit: schedulerData.limit,
          minRatingStar: schedulerData.minRatingStar,
          blockedKeywords: schedulerData.blockedKeywords,
        },
      };

      if (existingScheduler) {
        await api.patch(`/schedulers/${existingScheduler.id}`, schedulerPayload);
      } else {
        await api.post('/schedulers', schedulerPayload);
      }

      setShowSchedulerModal(false);
      setSelectedIntegration(null);
      setSelectedChannel(null);
      setSchedulerData({
        name: '',
        intervalMinutes: 5,
        isActive: true,
        keywords: [],
        productIds: [],
        limit: 1,
        minRatingStar: 4.5,
        blockedKeywords: [],
      });
      setSchedulerProducts([]);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao salvar agendador');
    }
  };


  const handleConnectOAuth = async (integrationType: string, integration: Integration) => {
    if (integrationType === 'shopee') {
      // Para Shopee, mostrar modal de credenciais
      setSelectedIntegration(integration);
      setShowShopeeCredentialsModal(true);
      return;
    }

    // Para outras integrações, usar OAuth normal
    try {
      let response;
      if (integrationType === 'aliexpress') {
        response = await api.get('/aliexpress/authorize');
      } else {
        return;
      }

      const { url, state } = response.data;
      localStorage.setItem(`${integrationType}_oauth_state`, state);
      
      // Abrir em nova aba
      window.open(url, '_blank');

      // Usar BroadcastChannel para comunicação entre abas
      const channel = new BroadcastChannel('oauth_callback');
      
      channel.onmessage = (event) => {
        if (event.data.type === 'oauth_success') {
          channel.close();
          loadData();
        } else if (event.data.type === 'oauth_error') {
          channel.close();
          alert(`Erro na autorização: ${event.data.error || 'Erro desconhecido'}`);
        }
      };

      // Fallback: verificar localStorage periodicamente (caso BroadcastChannel não funcione)
      const checkInterval = setInterval(() => {
        const oauthComplete = localStorage.getItem(`${integrationType}_oauth_complete`);
        if (oauthComplete === 'true') {
          localStorage.removeItem(`${integrationType}_oauth_complete`);
          clearInterval(checkInterval);
          channel.close();
          loadData();
        }
      }, 1000);

      // Limpar após 5 minutos (timeout)
      setTimeout(() => {
        clearInterval(checkInterval);
        channel.close();
      }, 300000);
    } catch (error: any) {
      alert(
        error.response?.data?.message ||
          'Erro ao gerar URL de autorização. Verifique as configurações do backend.',
      );
    }
  };

  const handleSaveShopeeCredentials = async () => {
    if (!selectedIntegration) return;

    if (!shopeeCredentials.appId || !shopeeCredentials.password) {
      alert('Por favor, preencha o AppID e a Senha');
      return;
    }

    try {
      await api.patch(`/integrations/${selectedIntegration.id}/credentials`, {
        partnerId: shopeeCredentials.appId,
        partnerKey: shopeeCredentials.password,
      });

      setShowShopeeCredentialsModal(false);
      setSelectedIntegration(null);
      setShopeeCredentials({ appId: '', password: '' });
      loadData();
      alert('Credenciais salvas com sucesso!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao salvar credenciais');
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'aliexpress':
        return (
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">AE</span>
          </div>
        );
      case 'shopee':
        return (
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">S</span>
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center">
            <span className="text-gray-400 font-bold text-lg">?</span>
          </div>
        );
    }
  };

  const getConfigFields = (integrationType: string) => {
    switch (integrationType) {
      case 'shopee':
  return (
          <div className="space-y-4">
      <div>
              <label className="block text-sm font-medium text-dark-text mb-2">
                Palavras-chave para busca
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="Ex: bola de basquete"
                  className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={handleAddKeyword}
                  className="bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-600 transition-colors"
                >
                  Adicionar
                </button>
              </div>
              {configData.keywords && configData.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {configData.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded-md text-sm"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="text-primary-400 hover:text-primary-300"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-dark-muted mt-2">
                As buscas serão feitas usando cada keyword. Produtos duplicados serão removidos automaticamente.
                </p>
              </div>
            </div>
        );
      default:
        return (
          <div className="text-sm text-dark-muted">
            Esta integração não requer configurações específicas de canal.
          </div>
        );
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-dark-text mb-2">Integrações</h1>
          <p className="text-dark-muted">
            Gerencie suas integrações com marketplaces. Configure canais e parâmetros de busca para cada integração.
          </p>
        </div>

        <div className="space-y-6">
          {integrations.map((integration) => {
            const connectedChannels = integration.channels || [];
            const channelConfigs = integration.channelConfigs || [];

            return (
              <div
                key={integration.id}
                className="bg-dark-surface border border-dark-border shadow-lg rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    {getIntegrationIcon(integration.type)}
                    <div>
                      <h2 className="text-xl font-semibold text-dark-text">
                        {integration.name}
                      </h2>
                      {integration.description && (
                        <p className="text-sm text-dark-muted mt-1">
                          {integration.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleClearCache(integration.id, integration.name)}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-md hover:bg-red-500/30 transition-colors text-xs font-medium"
                      title={`Limpar cache da integração ${integration.name}`}
                    >
                      🗑️ Limpar Cache
                    </button>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        integration.isActive
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}
                    >
                      {integration.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                </div>

                {/* Botão de conexão OAuth (se aplicável) */}
                {(integration.type === 'aliexpress' || integration.type === 'shopee') && (
                  <div className="mb-4">
                    <button
                      onClick={() => handleConnectOAuth(integration.type, integration)}
                      className="bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-600 transition-colors text-sm"
                    >
                      {integration.type === 'shopee' && integration.credentials
                        ? 'Atualizar Credenciais'
                        : `Conectar ${integration.name}`}
                    </button>
                    {integration.type === 'shopee' && integration.credentials && (
                      <p className="text-xs text-green-400 mt-2">
                        ✓ Credenciais configuradas
                      </p>
                    )}
                  </div>
                )}

                {/* Canais conectados */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-dark-text">
                      Canais Conectados ({connectedChannels.length})
                  </h3>
                    <button
                      onClick={() => {
                        setSelectedIntegration(integration);
                        setShowChannelModal(true);
                      }}
                      className="text-primary-400 hover:text-primary-300 text-sm font-medium"
                    >
                      + Adicionar Canal
                    </button>
                </div>

                  {connectedChannels.length === 0 ? (
                    <p className="text-sm text-dark-muted">
                      Nenhum canal conectado. Adicione um canal para começar a usar esta integração.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {connectedChannels.map((channel) => {
                        const config = channelConfigs.find(
                          (c) => c.channelId === channel.id,
                        );
                        const needsConfig =
                          integration.type === 'shopee' && !config;

                        return (
                          <div
                            key={channel.id}
                            className="bg-dark-bg/50 border border-dark-border rounded-lg p-4 relative"
                          >
                            {/* Botões fixados no canto superior direito */}
                            <div className="absolute top-2 right-2 flex gap-2">
                              <button
                                onClick={() => handleOpenSchedulerModal(integration, channel)}
                                className="w-7 h-7 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 hover:text-gray-300 border border-gray-500/30 rounded-md flex items-center justify-center transition-all hover:scale-105"
                                title="Configurar Agendador"
                              >
                                <span className="text-lg leading-none">⚙</span>
                              </button>
                              <button
                                onClick={() =>
                                  handleRemoveChannel(integration.id, channel.id)
                                }
                                className="w-7 h-7 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30 rounded-md flex items-center justify-center transition-all hover:scale-105"
                                title="Remover canal"
                              >
                                <span className="text-base leading-none">×</span>
                              </button>
                            </div>
                            <div className="pr-20">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-dark-text">
                                  {channel.name}
                                </span>
                                <span className="text-xs text-dark-muted">
                                  ({channel.type})
                                </span>
                                {channel.category && (
                                  <span className="text-xs text-dark-muted">
                                    • {channel.category.name}
                                  </span>
                                )}
                              </div>
                              {config && integration.type === 'shopee' && (
                                <div className="mt-2">
                                  <p className="text-xs text-dark-muted mb-1">
                                    Keywords configuradas:
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {config.config.keywords?.map((keyword: string) => (
                                      <span
                                        key={keyword}
                                        className="px-2 py-0.5 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded text-xs"
                                      >
                                        {keyword}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {needsConfig && (
                                <p className="text-xs text-yellow-400 mt-2">
                                  ⚠ Configuração necessária: Adicione keywords para este canal
                                </p>
                              )}
                              {/* Mostrar informações do scheduler se existir */}
                              {(() => {
                                const scheduler = schedulers.find(
                                  (s) =>
                                    s.integrationId === integration.id &&
                                    s.channels.some((sc) => sc.channelId === channel.id),
                                );
                                if (scheduler) {
                                  return (
                                    <div className="mt-3 p-2 bg-primary-500/10 border border-primary-500/20 rounded-md">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-primary-400">
                                          ⏰ Agendador Ativo
                                        </span>
                                        <span
                                          className={`text-xs px-2 py-0.5 rounded ${
                                            scheduler.isActive
                                              ? 'bg-green-500/20 text-green-400'
                                              : 'bg-gray-500/20 text-gray-400'
                                          }`}
                                        >
                                          {scheduler.isActive ? 'Ativo' : 'Inativo'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-dark-muted">
                                        Executa a cada {scheduler.intervalMinutes} minutos
                                      </p>
                                      {scheduler.nextRunAt && (
                                        <p className="text-xs text-dark-muted mt-1">
                                          Próxima execução:{' '}
                                          {new Date(scheduler.nextRunAt).toLocaleString('pt-BR')}
                                        </p>
                                      )}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
          </div>
            );
          })}
        </div>

        {/* Modal para adicionar canal */}
        {showChannelModal && selectedIntegration && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-dark-text mb-4">
                Adicionar Canal à {selectedIntegration.name}
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {channels
                  .filter(
                    (channel) =>
                      !selectedIntegration.channels.some((c) => c.id === channel.id),
                  )
                  .map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => {
                        handleAddChannel(selectedIntegration.id, channel.id);
                        setShowChannelModal(false);
                        setSelectedIntegration(null);
                      }}
                      className="w-full text-left p-3 bg-dark-bg/50 border border-dark-border rounded-md hover:bg-dark-bg transition-colors"
                    >
                      <div className="font-medium text-dark-text">{channel.name}</div>
                      <div className="text-xs text-dark-muted">
                        {channel.type}
                        {channel.category && ` • ${channel.category.name}`}
                      </div>
                    </button>
                  ))}
              </div>
              {channels.filter(
                (channel) =>
                  !selectedIntegration.channels.some((c) => c.id === channel.id),
              ).length === 0 && (
                <p className="text-sm text-dark-muted text-center py-4">
                  Todos os canais já estão conectados
                </p>
              )}
              <button
                onClick={() => {
                  setShowChannelModal(false);
                  setSelectedIntegration(null);
                }}
                className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* Modal para credenciais da Shopee */}
        {showShopeeCredentialsModal && selectedIntegration && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-dark-text mb-2">
                Configurar Credenciais da Shopee
              </h3>
              <p className="text-sm text-dark-muted mb-6">
                Informe suas credenciais de API da Shopee. Você pode encontrá-las no painel de
                afiliados, em &quot;Meu API&quot;.
              </p>

              <div className="space-y-4">
                {/* AppID */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    AppID (Partner ID)
                  </label>
                  <input
                    type="text"
                    value={shopeeCredentials.appId}
                    onChange={(e) =>
                      setShopeeCredentials({ ...shopeeCredentials, appId: e.target.value })
                    }
                    placeholder="Seu AppID da Shopee"
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Senha (Partner Key)
                  </label>
                  <input
                    type="password"
                    value={shopeeCredentials.password}
                    onChange={(e) =>
                      setShopeeCredentials({ ...shopeeCredentials, password: e.target.value })
                    }
                    placeholder="Sua senha de API da Shopee"
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                    <p className="text-xs text-yellow-400 font-medium mb-1">
                      ⚠️ Atenção Importante
                    </p>
                      <p className="text-xs text-dark-muted">
                        Esta <strong>NÃO é a senha da sua conta Shopee</strong>. É a senha de API
                        que fica localizada <strong>abaixo do AppID</strong> na seção &quot;Meu API&quot; do
                        painel de afiliados da Shopee.
                      </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSaveShopeeCredentials}
                  className="flex-1 bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-600 transition-colors"
                >
                  Salvar Credenciais
                </button>
                <button
                  onClick={() => {
                    setShowShopeeCredentialsModal(false);
                    setSelectedIntegration(null);
                    setShopeeCredentials({ appId: '', password: '' });
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para configurar agendador */}
        {showSchedulerModal && selectedIntegration && selectedChannel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-dark-text mb-4">
                Configurar Agendador Automático
              </h3>
              <p className="text-sm text-dark-muted mb-6">
                Configure o agendador para publicar produtos automaticamente no canal{' '}
                <strong>{selectedChannel.name}</strong> da integração{' '}
                <strong>{selectedIntegration.name}</strong>.
              </p>

              <div className="space-y-6">
                {/* Nome do agendador */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Nome do Agendador
                  </label>
                  <input
                    type="text"
                    value={schedulerData.name}
                    onChange={(e) =>
                      setSchedulerData({ ...schedulerData, name: e.target.value })
                    }
                    placeholder="Ex: Agendador Shopee - Canal Tech"
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Intervalo */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Intervalo de Execução (minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={schedulerData.intervalMinutes}
                    onChange={(e) =>
                      setSchedulerData({
                        ...schedulerData,
                        intervalMinutes: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-dark-muted mt-1">
                    O agendador buscará novos produtos neste intervalo (em minutos).
                  </p>
                </div>

                {/* Produtos */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Produtos a serem pesquisados
                  </label>
                  <ProductAutocomplete
                    value={schedulerProducts}
                    onChange={setSchedulerProducts}
                    placeholder="Digite o nome do produto (ex: fone bluetooth)"
                    channelIds={selectedChannel ? [selectedChannel.id] : []}
                  />
                  <p className="text-xs text-dark-muted mt-2">
                    O sistema buscará produtos na Shopee usando o nome de cada produto cadastrado.
                    Se um produto tiver copies relacionadas, elas serão usadas nas mensagens.
                    Produtos já enviados serão ignorados, exceto se entrarem em promoção melhor.
                  </p>
                </div>

                {/* Palavras bloqueadas */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Palavras Bloqueadas
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Digite uma palavra (ex: capa)"
                      value={newBlockedKeyword}
                      onChange={(e) => setNewBlockedKeyword(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newBlockedKeyword.trim()) {
                            setSchedulerData({
                              ...schedulerData,
                              blockedKeywords: [
                                ...schedulerData.blockedKeywords,
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
                          setSchedulerData({
                            ...schedulerData,
                            blockedKeywords: [
                              ...schedulerData.blockedKeywords,
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
                  {schedulerData.blockedKeywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {schedulerData.blockedKeywords.map((keyword, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded text-sm"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => {
                              setSchedulerData({
                                ...schedulerData,
                                blockedKeywords:
                                  schedulerData.blockedKeywords.filter(
                                    (_: string, i: number) => i !== index,
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
                  <p className="text-xs text-dark-muted mt-2">
                    Produtos que contenham essas palavras no nome serão bloqueados e não serão publicados.
                    A comparação é feita de forma normalizada (sem acentos, case-insensitive).
                  </p>
                </div>

                {/* Limite de produtos */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Produtos por Execução
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={schedulerData.limit}
                    onChange={(e) =>
                      setSchedulerData({
                        ...schedulerData,
                        limit: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-dark-muted mt-1">
                    Quantos produtos serão publicados a cada execução.
                  </p>
                </div>

                {/* Rating mínimo */}
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Rating Mínimo (0-5)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={schedulerData.minRatingStar}
                    onChange={(e) =>
                      setSchedulerData({
                        ...schedulerData,
                        minRatingStar: Math.max(
                          0,
                          Math.min(5, parseFloat(e.target.value) || 4.5),
                        ),
                      })
                    }
                    className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-dark-muted mt-1">
                    Apenas produtos com avaliação igual ou superior a este valor serão publicados. Valor padrão: 4.5
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="schedulerActive"
                    checked={schedulerData.isActive}
                    onChange={(e) =>
                      setSchedulerData({ ...schedulerData, isActive: e.target.checked })
                    }
                    className="w-4 h-4 text-primary-500 bg-dark-bg border-dark-border rounded focus:ring-primary-500"
                  />
                  <label
                    htmlFor="schedulerActive"
                    className="text-sm font-medium text-dark-text"
                  >
                    Agendador Ativo
                  </label>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSaveScheduler}
                  className="flex-1 bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-600 transition-colors"
                >
                  Salvar Agendador
                </button>
                <button
                  onClick={() => {
                    setShowSchedulerModal(false);
                    setSelectedIntegration(null);
                    setSelectedChannel(null);
                    setSchedulerData({
                      name: '',
                      intervalMinutes: 5,
                      isActive: true,
                      keywords: [],
                      productIds: [],
                      limit: 1,
                      minRatingStar: 4.5,
                      blockedKeywords: [],
                    });
                    setSchedulerProducts([]);
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal para configurar integração-canal */}
        {showConfigModal && selectedIntegration && selectedChannel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-surface border border-dark-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-dark-text mb-4">
                Configurar {selectedIntegration.name} - {selectedChannel.name}
              </h3>

              {getConfigFields(selectedIntegration.type)}

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSaveConfig}
                  className="flex-1 bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-600 transition-colors"
                >
                  Salvar Configuração
                </button>
                <button
                  onClick={() => {
                    setShowConfigModal(false);
                    setSelectedIntegration(null);
                    setSelectedChannel(null);
                    setConfigData({ keywords: [] });
                    setNewKeyword('');
                  }}
                  className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
