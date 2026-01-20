'use client';

import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  background?: string;
  isDefault: boolean;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await api.get('/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      await api.delete(`/templates/${id}`);
      loadTemplates();
    } catch (error) {
      alert('Erro ao excluir template');
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
          <h1 className="text-3xl font-bold text-dark-text">Templates</h1>
          <Link
            href="/templates/new"
            className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-2 rounded-md hover:from-primary-600 hover:to-primary-700 transition-all"
          >
            Novo Template
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="bg-gradient-to-br from-dark-surface via-purple-900/20 to-dark-surface border border-dark-border shadow-xl rounded-lg overflow-hidden">
              <div
                className="h-48"
                style={{ backgroundColor: template.background || '#FFFFFF' }}
              />
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-dark-text">{template.name}</h3>
                  {template.isDefault && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-500/20 text-primary-400 border border-primary-500/30">
                      Padrão
                    </span>
                  )}
                </div>
                <div className="mt-4 flex space-x-2">
                  <Link
                    href={`/templates/${template.id}`}
                    className="flex-1 text-center text-sm text-primary-500 hover:text-primary-400 font-medium transition-colors"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="flex-1 text-center text-sm text-red-400 hover:text-red-300 font-medium transition-colors"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

