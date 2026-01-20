'use client';

import Layout from '@/components/Layout';
import { authService } from '@/lib/auth';
import { useState } from 'react';

export default function SettingsPage() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres' });
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(oldPassword, newPassword);
      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Erro ao alterar senha',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div>
        <h1 className="text-3xl font-bold text-dark-text mb-6">Configurações</h1>

        <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-6 max-w-2xl">
          <h2 className="text-xl font-semibold text-dark-text mb-4">Alterar Senha</h2>

          {message && (
            <div
              className={`mb-4 p-4 rounded-md border ${
                message.type === 'success'
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="oldPassword" className="block text-sm font-medium text-dark-text mb-1">
                Senha Atual
              </label>
              <input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-dark-text mb-1">
                Nova Senha
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-dark-text mb-1"
              >
                Confirmar Nova Senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2 px-4 rounded-md hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition-all"
            >
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

