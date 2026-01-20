'use client';

import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processando autorização...');
  const isPopup = typeof window !== 'undefined' && window.opener !== null;

  useEffect(() => {
    // Usar BroadcastChannel para comunicação entre abas
    const channel = typeof window !== 'undefined' ? new BroadcastChannel('oauth_callback') : null;

    const processCallback = async () => {
      try {
        // Obtém os parâmetros da URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        const shopId = searchParams.get('shop_id'); // Para Shopee

        // Determina o tipo de integração baseado no state ou URL
        const integrationType = state?.includes('shopee') || shopId ? 'shopee' : 'aliexpress';

        // Verifica se houve erro na autorização
        if (error) {
          setStatus('error');
          setMessage(
            errorDescription ||
              'Erro ao autorizar. Por favor, tente novamente.',
          );
          
          // Comunicar erro via BroadcastChannel
          if (channel) {
            channel.postMessage({ type: 'oauth_error', error: errorDescription });
          }
          
          // Se for popup, fecha a janela
          if (isPopup && window.opener) {
            setTimeout(() => window.close(), 2000);
            return;
          }
          
          setTimeout(() => {
            router.push('/integrations');
          }, 3000);
          return;
        }

        // Verifica se o código foi recebido
        if (!code && !shopId) {
          setStatus('error');
          setMessage('Código de autorização não recebido.');
          
          // Comunicar erro via BroadcastChannel
          if (channel) {
            channel.postMessage({ type: 'oauth_error', error: 'Código não recebido' });
          }
          
          // Se for popup, fecha a janela
          if (isPopup && window.opener) {
            setTimeout(() => window.close(), 2000);
            return;
          }
          
          setTimeout(() => {
            router.push('/integrations');
          }, 3000);
          return;
        }

        // Verifica o state (opcional, mas recomendado para segurança)
        const savedState = localStorage.getItem(`${integrationType}_oauth_state`);
        if (state && savedState && state !== savedState) {
          setStatus('error');
          setMessage('State inválido. Por favor, tente novamente.');
          localStorage.removeItem(`${integrationType}_oauth_state`);
          
          // Comunicar erro via BroadcastChannel
          if (channel) {
            channel.postMessage({ type: 'oauth_error', error: 'State inválido' });
          }
          
          // Se for popup, fecha a janela
          if (isPopup && window.opener) {
            setTimeout(() => window.close(), 2000);
            return;
          }
          
          setTimeout(() => {
            router.push('/integrations');
          }, 3000);
          return;
        }

        // Remove o state do localStorage
        localStorage.removeItem(`${integrationType}_oauth_state`);

        // Envia o código para o backend para trocar por access_token
        try {
          let response;
          if (integrationType === 'shopee') {
            response = await api.post('/shopee/callback', {
              code,
              shopId,
              redirectUri: window.location.origin + '/integrations/callback',
            });
          } else {
            response = await api.post('/aliexpress/callback', {
              code,
              redirectUri: window.location.origin + '/integrations/callback',
            });
          }

          // TODO: Salvar o access_token e refresh_token no backend/banco de dados
          setStatus('success');
          setMessage('Autorização realizada com sucesso!');
          
          // Comunicar com outras abas via BroadcastChannel
          if (channel) {
            channel.postMessage({ type: 'oauth_success', integrationType });
          }
          
          // Também usar localStorage como fallback
          localStorage.setItem(`${integrationType}_oauth_complete`, 'true');
          
          // Se for popup, fecha a janela
          if (isPopup && window.opener) {
            setTimeout(() => window.close(), 1500);
            return;
          }
          
          // Se não for popup, redireciona normalmente
          setTimeout(() => {
            router.push('/integrations');
          }, 2000);
        } catch (error: any) {
          console.error('Erro ao trocar código por token:', error);
          setStatus('error');
          setMessage(
            error.response?.data?.message ||
              'Erro ao processar autorização. Por favor, tente novamente.',
          );
          
          // Comunicar erro via BroadcastChannel
          if (channel) {
            channel.postMessage({ 
              type: 'oauth_error', 
              error: error.response?.data?.message || 'Erro ao processar autorização' 
            });
          }
          
          // Se for popup, fecha a janela
          if (isPopup && window.opener) {
            setTimeout(() => window.close(), 2000);
            return;
          }
          
          setTimeout(() => {
            router.push('/integrations');
          }, 3000);
          return;
        }
      } catch (error: any) {
        console.error('Erro ao processar callback:', error);
        setStatus('error');
        setMessage(
          error.response?.data?.message ||
            'Erro ao processar autorização. Por favor, tente novamente.',
        );
        
        // Comunicar erro via BroadcastChannel
        if (channel) {
          channel.postMessage({ 
            type: 'oauth_error', 
            error: error.response?.data?.message || 'Erro ao processar autorização' 
          });
        }
        
        // Se for popup, fecha a janela
        if (isPopup && window.opener) {
          setTimeout(() => window.close(), 2000);
          return;
        }
        
        setTimeout(() => {
          router.push('/integrations');
        }, 3000);
      }
    };

    processCallback();

    // Cleanup: fechar o channel quando o componente desmontar
    return () => {
      if (channel) {
        channel.close();
      }
    };
  }, [searchParams, router, isPopup]);

  return (
    <Layout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-8 max-w-md w-full text-center">
          {status === 'processing' && (
            <>
              <div className="flex justify-center mb-4">
                <svg
                  className="animate-spin h-12 w-12 text-primary-500"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-dark-text mb-2">
                Processando autorização
              </h2>
              <p className="text-dark-muted">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                  <svg
                    className="w-8 h-8 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-dark-text mb-2">
                Autorização realizada com sucesso!
              </h2>
              <p className="text-dark-muted">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                  <svg
                    className="w-8 h-8 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-dark-text mb-2">
                Erro na autorização
              </h2>
              <p className="text-dark-muted mb-4">{message}</p>
              <button
                onClick={() => router.push('/integrations')}
                className="bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2 px-4 rounded-md hover:from-primary-600 hover:to-primary-700 transition-all"
              >
                Voltar para Integrações
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

