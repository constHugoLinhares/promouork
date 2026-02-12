'use client';

import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface WhatsAppChat {
  id: string;
  name?: string;
  type: 'chat' | 'group' | 'channel';
}

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
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showShopeeCredentialsModal, setShowShopeeCredentialsModal] = useState(false);
  const [shopeeCredentials, setShopeeCredentials] = useState({
    appId: '',
    password: '',
  });

  // Estado da conexão WhatsApp (Evolution)
  const [waQrCode, setWaQrCode] = useState<string | null>(null);
  const [waConnectionState, setWaConnectionState] = useState<string>('');
  const [waLoading, setWaLoading] = useState(false);
  const [waError, setWaError] = useState<string | null>(null);
  const [waChats, setWaChats] = useState<WhatsAppChat[]>([]);
  const [waChatsLoading, setWaChatsLoading] = useState(false);
  const [waChatsError, setWaChatsError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const fetchWaStatus = useCallback(async () => {
    try {
      const res = await api.get('/evolution/status');
      const state = res.data?.state ?? 'close';
      setWaConnectionState(state);
      if (state === 'open') setWaQrCode(null);
      return state;
    } catch {
      setWaConnectionState('close');
      return 'close';
    }
  }, []);

  const loadWaConnection = useCallback(async () => {
    setWaLoading(true);
    setWaError(null);
    try {
      const statusRes = await api.get('/evolution/status');
      const hasInstance = statusRes.data?.hasInstance ?? false;
      const state = statusRes.data?.state ?? 'close';
      setWaConnectionState(state);
      if (state === 'open') {
        setWaLoading(false);
        return;
      }
      if (hasInstance) {
        const qrRes = await api.get('/evolution/qr');
        setWaQrCode(qrRes.data?.qrCode ?? null);
      } else {
        const connectRes = await api.post('/evolution/connect');
        setWaQrCode(connectRes.data?.qrCode ?? null);
      }
    } catch (err: any) {
      setWaError(err.response?.data?.message ?? 'Erro ao conectar com Evolution');
    } finally {
      setWaLoading(false);
    }
  }, []);

  const fetchWaChats = useCallback(async () => {
    setWaChatsLoading(true);
    setWaChatsError(null);
    try {
      const res = await api.get<{ chats: WhatsAppChat[] }>('/evolution/chats');
      setWaChats(res.data?.chats ?? []);
    } catch (err: any) {
      setWaChatsError(err.response?.data?.message ?? 'Erro ao carregar lista de chats');
      setWaChats([]);
    } finally {
      setWaChatsLoading(false);
    }
  }, []);

  const handleWaLogout = useCallback(async () => {
    if (!confirm('Desconectar remove a instância do WhatsApp. Para usar de novo, será preciso gerar um novo QR code. Deseja continuar?')) return;
    setWaLoading(true);
    setWaError(null);
    try {
      await api.delete('/evolution/logout');
      setWaConnectionState('close');
      setWaQrCode(null);
      setWaChats([]);
    } catch (err: any) {
      setWaError(err.response?.data?.message ?? 'Erro ao desconectar');
    } finally {
      setWaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaStatus().catch(() => {});
  }, [fetchWaStatus]);

  useEffect(() => {
    if (waConnectionState === 'open') return;
    const interval = setInterval(fetchWaStatus, 4000);
    return () => clearInterval(interval);
  }, [waConnectionState, fetchWaStatus]);

  useEffect(() => {
    if (waConnectionState === 'open') {
      fetchWaChats();
    } else {
      setWaChats([]);
    }
  }, [waConnectionState, fetchWaChats]);

  const loadData = async () => {
    try {
      const integrationsRes = await api.get('/integrations');
      setIntegrations(integrationsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
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
            Gerencie suas integrações com marketplaces. Os canais são configurados nos Agendadores.
          </p>
        </div>

        {/* Cards de conexões e integrações — lado a lado */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card WhatsApp (Conexões) */}
          <div className="bg-dark-surface border border-dark-border shadow-lg rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-lg">WA</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-dark-text">WhatsApp</h3>
                  <p className="text-sm text-dark-muted mt-1">
                    Conecte para publicar mensagens em grupos e canais do WhatsApp.
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                  waConnectionState === 'open'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}
              >
                {waConnectionState === 'open' ? 'Conectado' : 'Desconectado'}
              </span>
            </div>

            <div className="p-4 bg-amber-500/20 border border-amber-500/40 rounded-md mb-6">
              <p className="text-sm text-amber-200 font-medium">
                Nenhum número está imune a banimento do WhatsApp. É importante evitar sempre o spam.
              </p>
            </div>

            {waError && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/40 rounded-md text-sm text-red-300">
                  {waError}
                </div>
              )}

              {waConnectionState === 'open' ? (
                <div className="space-y-4">
                  {waChatsLoading && waChats.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-dark-muted text-sm">
                      <p>Carregando grupos e contatos...</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 bg-green-500/20 border border-green-500/40 rounded-md text-center">
                        <p className="text-green-300 font-medium">Conectado</p>
                        <p className="text-xs text-dark-muted mt-1">
                          Seu número está vinculado ao WhatsApp. Você pode publicar em canais do tipo WhatsApp.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleWaLogout}
                        disabled={waLoading}
                        className="w-full bg-red-500/20 text-red-400 border border-red-500/40 py-2 px-4 rounded-md hover:bg-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {waLoading ? 'Desconectando...' : 'Desconectar'}
                      </button>
                      <div className="pt-4 border-t border-dark-border">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-dark-text">Chats disponíveis</h4>
                          <button
                            type="button"
                            onClick={fetchWaChats}
                            disabled={waChatsLoading}
                            className="text-xs text-primary-400 hover:text-primary-300 disabled:opacity-50"
                          >
                            {waChatsLoading ? 'Atualizando...' : 'Atualizar lista'}
                          </button>
                        </div>
                        <p className="text-xs text-dark-muted mb-3">
                          Use o identificador (ID) abaixo no cadastro de canais para publicar nesses chats, grupos ou canais.
                        </p>
                        {waChatsError && (
                          <div className="mb-3 p-3 bg-red-500/20 border border-red-500/40 rounded text-xs text-red-300">
                            {waChatsError}
                          </div>
                        )}
                        {waChatsLoading && waChats.length === 0 ? (
                          <div className="py-6 text-center text-dark-muted text-sm">Carregando chats...</div>
                        ) : waChats.length === 0 ? (
                          <div className="py-6 text-center text-dark-muted text-sm">
                            Nenhum chat encontrado. Abra conversas no WhatsApp e clique em Atualizar lista.
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto rounded border border-dark-border">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-dark-border/50 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-dark-muted font-medium">Tipo</th>
                                  <th className="px-3 py-2 text-dark-muted font-medium">Nome</th>
                                  <th className="px-3 py-2 text-dark-muted font-medium">Identificador (ID)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {waChats.map((c) => (
                                  <tr key={c.id} className="border-t border-dark-border hover:bg-dark-border/30">
                                    <td className="px-3 py-2 text-dark-muted">
                                      {c.type === 'group' ? 'Grupo' : c.type === 'channel' ? 'Canal' : 'Chat'}
                                    </td>
                                    <td className="px-3 py-2 text-dark-text">{c.name ?? '—'}</td>
                                    <td className="px-3 py-2 font-mono text-xs text-primary-300 break-all">{c.id}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-dark-muted">
                    Abra o WhatsApp no celular e escaneie o QR code abaixo para conectar.
                  </p>
                  {waLoading && !waQrCode && (
                    <div className="flex justify-center py-12 text-dark-muted">Carregando QR...</div>
                  )}
                  {waQrCode && (
                    <div className="flex justify-center p-4 bg-white rounded-lg">
                      <img
                        src={waQrCode.startsWith('data:') ? waQrCode : `data:image/png;base64,${waQrCode}`}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64 object-contain"
                      />
                    </div>
                  )}
                  {!waLoading && !waQrCode && waConnectionState !== 'open' && (
                    <button
                      type="button"
                      onClick={loadWaConnection}
                      className="w-full bg-primary-500 text-white py-2 px-4 rounded-md hover:bg-primary-600 transition-colors"
                    >
                      Gerar QR code
                    </button>
                  )}
                </div>
              )}
          </div>

          {/* Cards de integrações (Shopee, AliExpress, etc.) */}
          {integrations
            .filter((integration) => integration.type !== 'evolution')
            .map((integration) => (
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

                {(integration.type === 'aliexpress' || integration.type === 'shopee') && (
                  <div>
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
              </div>
            ))}
        </div>

        {/* Modal credenciais Shopee */}
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

      </div>
    </Layout>
  );
}
