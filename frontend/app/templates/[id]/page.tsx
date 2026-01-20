'use client';

import FabricTemplateEditor from '@/components/FabricTemplateEditor';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const [name, setName] = useState('');
  const [templateData, setTemplateData] = useState({
    background: '#FFFFFF',
    width: 1080,
    height: 1080,
    elements: [] as any[],
  });
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      const response = await api.get(`/templates/${templateId}`);
      const template = response.data;
      setName(template.name);
      setIsDefault(template.isDefault);
      setTemplateData({
        background: template.background || '#FFFFFF',
        // Preservar as dimensões do template, usar valores padrão apenas se não existirem
        width: template.width !== undefined && template.width !== null ? template.width : 1080,
        height: template.height !== undefined && template.height !== null ? template.height : 1080,
        elements: template.elements || [],
      });
    } catch (error) {
      console.error('Error loading template:', error);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Por favor, informe um nome para o template');
      return;
    }

    setLoading(true);
    try {
      await api.patch(`/templates/${templateId}`, {
        name,
        ...templateData,
        isDefault,
      });
      router.push('/templates');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao salvar template');
    } finally {
      setLoading(false);
    }
  };

  if (loadingTemplate) {
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
          <h1 className="text-3xl font-bold text-dark-text">Editar Template</h1>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-dark-border text-primary-500 focus:ring-primary-500 bg-dark-bg/50"
              />
              <span className="ml-2 text-sm text-dark-text">Template Padrão</span>
            </label>
            <button
              onClick={() => router.push('/templates')}
              className="px-4 py-2 border border-dark-border rounded-md text-dark-text hover:bg-dark-surface/50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-2 rounded-md hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition-all"
            >
              {loading ? 'Salvando...' : 'Salvar Template'}
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium text-dark-text mb-2">
            Nome do Template
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Template Promoção Verão"
            className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text placeholder-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <FabricTemplateEditor 
          template={templateData} 
          onChange={setTemplateData}
          previewMode={true}
          maxPreviewWidth={400}
          maxPreviewHeight={600}
        />
      </div>
    </Layout>
  );
}

