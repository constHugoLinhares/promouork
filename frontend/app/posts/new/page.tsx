'use client';

import Layout from '@/components/Layout';
import PostPreview from '@/components/PostPreview';
import TextFormattingToolbar from '@/components/TextFormattingToolbar';
import api from '@/lib/api';
import { getCopySuggestions } from '@/lib/copy-suggestions';
import { loadFabric } from '@/lib/fabric-client';
import {
  getChannelMarkupInfo,
  MarkupType
} from '@/lib/markup';
import {
  generateProductMessage,
  getRandomHook,
} from '@/lib/product-message';
import { uploadImageToR2 } from '@/lib/storage';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function NewPostPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [messageMode, setMessageMode] = useState<'product' | 'free'>('product');
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    templateId: '',
    channelIds: [] as string[],
    imageUrl: '',
    // Campos de produto
    product: {
      name: '',
      price: '',
      originalPrice: '',
      link: '',
      categoryId: '',
      subcategoryId: '',
      marketplace: '',
    },
  });
  const [markupType, setMarkupType] = useState<MarkupType>('html');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [overlayImage, setOverlayImage] = useState<{
    url: string;
    left: number;
    top: number;
    width: number;
    height: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [showCopySuggestions, setShowCopySuggestions] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: '',
    type: 'telegram',
    chatId: '',
    description: '',
  });
  const [creatingChannel, setCreatingChannel] = useState(false);
  
  // Histórico para undo/redo da mensagem
  const messageHistoryRef = useRef<string[]>(['']);
  const messageHistoryIndexRef = useRef<number>(0);
  const isUndoRedoRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (formData.product.categoryId) {
      loadSubcategories(formData.product.categoryId);
    } else {
      setSubcategories([]);
    }
  }, [formData.product.categoryId]);

  const generateMessageFromProduct = async (product: typeof formData.product) => {
    if (!product.name || !product.price || !product.link || !product.categoryId) {
      return;
    }
    const category = categories.find(c => c.id === product.categoryId);
    const subcategory = subcategories.find(s => s.id === product.subcategoryId);
    const hook = await getRandomHook(
      category?.slug || undefined,
      subcategory?.slug || undefined,
    );
    const generated = generateProductMessage(
      {
        name: product.name,
        price: parseFloat(product.price),
        originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : undefined,
        link: product.link,
        category: category?.slug || undefined,
        subcategory: subcategory?.slug || undefined,
      },
      { hook },
    );
    setFormData(prev => ({ ...prev, message: generated }));
    // Adicionar ao histórico quando gerar mensagem
    const history = messageHistoryRef.current;
    const index = messageHistoryIndexRef.current;
    const newHistory = history.slice(0, index + 1);
    newHistory.push(generated);
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      messageHistoryIndexRef.current = newHistory.length - 1;
    }
    messageHistoryRef.current = newHistory;
  };

  useEffect(() => {
    if (formData.templateId) {
      const template = templates.find((t) => t.id === formData.templateId);
      setSelectedTemplate(template || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [formData.templateId, templates]);

  const loadData = async () => {
    try {
      const [channelsRes, templatesRes, categoriesRes] = await Promise.all([
        api.get('/channels'),
        api.get('/templates'),
        api.get('/categories'),
      ]);
      setChannels(channelsRes.data);
      setTemplates(templatesRes.data);
      setCategories(categoriesRes.data);
      
      // Carregar subcategorias se houver categoria selecionada
      if (formData.product.categoryId) {
        loadSubcategories(formData.product.categoryId);
      }
    } catch (error) {
      console.error('Error loading data:', error);
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

  const generateFinalImage = async (): Promise<string | null> => {
    if (!selectedTemplate || !overlayImage) return null;

    // Carregar fabric usando o wrapper que garante client-side only
    let fabric: any;
    try {
      fabric = await loadFabric();
    } catch (error) {
      console.error('Error loading fabric:', error);
      return null;
    }

    // Full HD: 1920x1080 (largura x altura)
    const width = selectedTemplate.width || 1920;
    const height = selectedTemplate.height || 1080;
    const background = selectedTemplate.background || '#FFFFFF';

    // Criar um canvas temporário com dimensões reais
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempFabricCanvas = new fabric.Canvas(tempCanvas, {
      width: width,
      height: height,
      backgroundColor: background,
    });

    return new Promise((resolve) => {
      // Carregar background
      tempFabricCanvas.setBackgroundColor(background, async () => {
        // Carregar elementos do template em tamanho real
        let elements = selectedTemplate.elements;
        if (typeof elements === 'string') {
          try {
            elements = JSON.parse(elements);
          } catch (e) {
            elements = [];
          }
        }
        if (!Array.isArray(elements)) {
          elements = elements ? [elements] : [];
        }

        const loadPromises: Promise<void>[] = [];
        
        // Rastrear posições para inserir elementos na ordem correta
        let currentPosition = 0;

        if (elements && Array.isArray(elements)) {
          elements.forEach((elementData: any, originalIndex: number) => {
            if (elementData.type === 'textbox' || elementData.type === 'i-text' || elementData.type === 'text') {
              const textContent = elementData.text || elementData.content || '';
              const baseLeft = elementData.left !== undefined ? elementData.left : (elementData.position?.x || 0);
              const baseTop = elementData.top !== undefined ? elementData.top : (elementData.position?.y || 0);
              const baseWidth = elementData.width || 200;
              const baseFontSize = elementData.fontSize || 24;
              const fill = elementData.fill || elementData.color || '#000000';

              const obj = new fabric.Textbox(textContent, {
                left: baseLeft,
                top: baseTop,
                width: baseWidth,
                fontSize: baseFontSize,
                fill: fill,
                fontFamily: elementData.fontFamily || 'Arial',
                // IMPORTANTE: NUNCA aplicar scaleX/scaleY para elementos de texto na geração final
                // O fontSize já está correto e aplicar scale causaria tamanho incorreto
                scaleX: 1,
                scaleY: 1,
              });

              // Para elementos de texto, NUNCA aplicar scaleX/scaleY
              // O fontSize já reflete o tamanho correto
              // Aplicar scaleX/scaleY causaria duplicação do tamanho
              if (elementData.angle !== undefined) obj.set('angle', elementData.angle);
              if (elementData.opacity !== undefined) obj.set('opacity', elementData.opacity);

              // Inserir na posição correta para preservar ordem
              tempFabricCanvas.insertAt(obj, currentPosition);
              currentPosition++;
            } else if (elementData.type === 'image') {
              const imageSrc = elementData.src || elementData.url;
              if (imageSrc) {
                const imagePosition = currentPosition;
                currentPosition++;
                
                const promise = new Promise<void>((resolveImg) => {
                  fabric.Image.fromURL(imageSrc, (img: any) => {
                    try {
                      const baseLeft = elementData.left || 0;
                      const baseTop = elementData.top || 0;
                      const baseScaleX = elementData.scaleX || 1;
                      const baseScaleY = elementData.scaleY || 1;

                      img.set({
                        left: baseLeft,
                        top: baseTop,
                        scaleX: baseScaleX,
                        scaleY: baseScaleY,
                      });
                      if (elementData.opacity !== undefined) img.set('opacity', elementData.opacity);
                      
                      // Inserir na posição correta para preservar ordem
                      tempFabricCanvas.insertAt(img, imagePosition);
                      resolveImg();
                    } catch (error) {
                      console.error('Error loading image element:', error, elementData);
                      resolveImg(); // Resolver mesmo em caso de erro para não bloquear
                    }
                  }, { crossOrigin: 'anonymous' });
                });
                loadPromises.push(promise);
              }
            }
          });
        }

        // Carregar imagem sobreposta em tamanho real
        if (overlayImage && overlayImage.url) {
          const promise = new Promise<void>((resolveImg) => {
            fabric.Image.fromURL(overlayImage.url, (img: any) => {
              const imgElement = img.getElement();
              const naturalWidth = imgElement.width;
              const naturalHeight = imgElement.height;
              
              // overlayImage.scaleX e overlayImage.scaleY já são as escalas corretas
              // relativas ao tamanho natural da imagem
              // Não precisamos calcular a partir de width/height pois isso aplicaria a escala duas vezes
              const scaleX = overlayImage.scaleX || (overlayImage.width / naturalWidth);
              const scaleY = overlayImage.scaleY || (overlayImage.height / naturalHeight);

              img.set({
                left: overlayImage.left,
                top: overlayImage.top,
                scaleX: scaleX,
                scaleY: scaleY,
                angle: overlayImage.angle || 0,
              });

              tempFabricCanvas.add(img);
              resolveImg();
            }, { crossOrigin: 'anonymous' });
          });
          loadPromises.push(promise);
        }

        // Aguardar todas as imagens carregarem
        await Promise.all(loadPromises);
        tempFabricCanvas.renderAll();
        
        // Gerar data URL em Full HD (1920x1080)
        // Usar multiplicador para garantir alta qualidade
        const multiplier = 1; // 1 = resolução nativa, 2 = 2x (3840x2160), etc.
        const dataUrl = tempFabricCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: multiplier, // Garante exportação na resolução correta
        });
        
        // Limpar canvas temporário
        tempFabricCanvas.dispose();
        
        resolve(dataUrl);
      });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.channelIds.length === 0) {
      alert('Selecione pelo menos um canal para publicar o post');
      return;
    }

    setLoading(true);

    try {
      // Se houver template e overlayImage, gerar a imagem final automaticamente
      let finalImageUrl = formData.imageUrl;
      if (formData.templateId && overlayImage) {
        const generatedImage = await generateFinalImage();
        if (generatedImage) {
          // Upload da imagem gerada para R2
          try {
            finalImageUrl = await uploadImageToR2(generatedImage, 'post');
          } catch (uploadError: any) {
            console.error('Erro no upload da imagem:', uploadError);
            alert(`Erro ao fazer upload da imagem: ${uploadError.message || 'Erro desconhecido'}`);
            setLoading(false);
            return;
          }
        }
      } else if (finalImageUrl && finalImageUrl.startsWith('data:image/')) {
        // Se houver imagem em base64 (sem template), fazer upload também
        try {
          finalImageUrl = await uploadImageToR2(finalImageUrl, 'post');
        } catch (uploadError: any) {
          console.error('Erro no upload da imagem:', uploadError);
          alert(`Erro ao fazer upload da imagem: ${uploadError.message || 'Erro desconhecido'}`);
          setLoading(false);
          return;
        }
      }

      // Preparar dados para envio (apenas URL, nunca base64)
      const payload: any = {
        title: formData.title,
        message: formData.message,
        templateId: formData.templateId || undefined,
        imageUrl: finalImageUrl || undefined, // Agora sempre será uma URL
        channelIds: formData.channelIds,
        // Incluir overlayImage se houver template e imagem sobreposta (para referência futura)
        ...(formData.templateId && overlayImage ? { overlayImage } : {}),
        // Campos de produto (apenas se modo produto e preenchidos)
        ...(messageMode === 'product' && formData.product.name && formData.product.price && formData.product.link && formData.product.categoryId
          ? {
              product: {
                name: formData.product.name,
                price: parseFloat(formData.product.price),
                originalPrice: formData.product.originalPrice
                  ? parseFloat(formData.product.originalPrice)
                  : undefined,
                link: formData.product.link,
                categoryId: formData.product.categoryId,
                subcategoryId: formData.product.subcategoryId || undefined,
                marketplace: formData.product.marketplace || undefined,
              },
            }
          : {}),
      };
      
      await api.post('/posts', payload);
      router.push('/posts');
    } catch (error: any) {
      console.error('Erro ao criar post:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao criar post';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChannelToggle = (channelId: string) => {
    setFormData((prev) => ({
      ...prev,
      channelIds: prev.channelIds.includes(channelId)
        ? prev.channelIds.filter((id) => id !== channelId)
        : [...prev.channelIds, channelId],
    }));
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingChannel(true);

    try {
      const response = await api.post('/channels', {
        ...newChannel,
        isActive: true,
      });
      
      // Adicionar o novo canal à lista e selecioná-lo automaticamente
      setChannels([...channels, response.data]);
      setFormData((prev) => ({
        ...prev,
        channelIds: [...prev.channelIds, response.data.id],
      }));
      
      // Limpar formulário e fechar
      setNewChannel({ name: '', type: 'telegram', chatId: '', description: '' });
      setShowChannelForm(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao criar canal');
    } finally {
      setCreatingChannel(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-dark-text mb-6">Novo Post</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text placeholder-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Digite o título do post"
                />
              </div>

              {/* Seletor de modo: Produto ou Texto Livre */}
                <div className="mb-4 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setMessageMode('product');
                      // Gerar mensagem automaticamente se houver dados de produto
                      if (
                        formData.product.name &&
                        formData.product.price &&
                        formData.product.link &&
                        formData.product.categoryId
                      ) {
                        const category = categories.find(c => c.id === formData.product.categoryId);
                        const subcategory = subcategories.find(s => s.id === formData.product.subcategoryId);
                        const hook = await getRandomHook(
                          category?.slug || undefined,
                          subcategory?.slug || undefined,
                        );
                        const generated = generateProductMessage(
                          {
                            name: formData.product.name,
                            price: parseFloat(formData.product.price),
                            originalPrice: formData.product.originalPrice
                              ? parseFloat(formData.product.originalPrice)
                              : undefined,
                            link: formData.product.link,
                            category: category?.slug || undefined,
                            subcategory: subcategory?.slug || undefined,
                          },
                          { hook },
                        );
                        setFormData({ ...formData, message: generated });
                        // Adicionar ao histórico quando gerar mensagem
                        const history = messageHistoryRef.current;
                        const index = messageHistoryIndexRef.current;
                        const newHistory = history.slice(0, index + 1);
                        newHistory.push(generated);
                        if (newHistory.length > 50) {
                          newHistory.shift();
                        } else {
                          messageHistoryIndexRef.current = newHistory.length - 1;
                        }
                        messageHistoryRef.current = newHistory;
                      }
                    }}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      messageMode === 'product'
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-bg/50 text-dark-text border border-dark-border hover:bg-dark-bg'
                    }`}
                  >
                    📦 Modo Produto
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessageMode('free')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      messageMode === 'free'
                        ? 'bg-primary-500 text-white'
                        : 'bg-dark-bg/50 text-dark-text border border-dark-border hover:bg-dark-bg'
                    }`}
                  >
                    ✏️ Texto Livre
                  </button>
                </div>

                {/* Campos de produto (quando modo Produto) */}
                {messageMode === 'product' && (
                  <div className="mb-4 p-4 bg-dark-bg/30 border border-dark-border rounded-md space-y-4">
                    <h4 className="text-sm font-medium text-dark-text mb-3">
                      Informações do Produto
                    </h4>

                    <div>
                      <label className="block text-xs font-medium text-dark-text mb-1">
                        Nome do Produto *
                      </label>
                      <input
                        type="text"
                        value={formData.product.name}
                        onChange={async (e) => {
                          const newProduct = { ...formData.product, name: e.target.value };
                          const newData = { ...formData, product: newProduct };
                          setFormData(newData);
                          await generateMessageFromProduct(newProduct);
                        }}
                        className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Ex: Teclado Mecânico RGB"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-dark-text mb-1">
                          Preço *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.product.price}
                          onChange={async (e) => {
                            const newProduct = { ...formData.product, price: e.target.value };
                            const newData = { ...formData, product: newProduct };
                            setFormData(newData);
                            await generateMessageFromProduct(newProduct);
                          }}
                          className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-dark-text mb-1">
                          Preço Original (Opcional)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.product.originalPrice}
                          onChange={async (e) => {
                            const newProduct = { ...formData.product, originalPrice: e.target.value };
                            const newData = { ...formData, product: newProduct };
                            setFormData(newData);
                            await generateMessageFromProduct(newProduct);
                          }}
                          className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-dark-text mb-1">
                        Link do Produto *
                      </label>
                      <input
                        type="text"
                        value={formData.product.link}
                        onChange={async (e) => {
                          const newProduct = { ...formData.product, link: e.target.value };
                          const newData = { ...formData, product: newProduct };
                          setFormData(newData);
                          await generateMessageFromProduct(newProduct);
                        }}
                        className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="mercadolivre.com ou https://mercadolivre.com"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-dark-text mb-1">
                          Categoria
                        </label>
                        <select
                          value={formData.product.categoryId}
                          onChange={async (e) => {
                            const newProduct = {
                              ...formData.product,
                              categoryId: e.target.value,
                              subcategoryId: '', // Reset subcategoria
                            };
                            const newData = { ...formData, product: newProduct };
                            setFormData(newData);
                            await generateMessageFromProduct(newProduct);
                          }}
                          className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Selecione</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-dark-text mb-1">
                          Subcategoria
                        </label>
                        <select
                          value={formData.product.subcategoryId}
                          onChange={async (e) => {
                            const newProduct = { ...formData.product, subcategoryId: e.target.value };
                            const newData = { ...formData, product: newProduct };
                            setFormData(newData);
                            await generateMessageFromProduct(newProduct);
                          }}
                          disabled={!formData.product.categoryId}
                          className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <option value="">Selecione</option>
                          {subcategories.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Campo de mensagem - sempre visível, mas com contexto diferente */}
                <div className="space-y-2 relative">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-medium text-dark-text">
                      {messageMode === 'product'
                        ? 'Mensagem Gerada (você pode editar) *'
                        : 'Mensagem para os Canais *'}
                    </label>
                    {messageMode === 'product' && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            formData.product.name &&
                            formData.product.price &&
                            formData.product.link &&
                            formData.product.categoryId
                          ) {
                            const category = categories.find(c => c.id === formData.product.categoryId);
                            const subcategory = subcategories.find(s => s.id === formData.product.subcategoryId);
                            const hook = await getRandomHook(
                              category?.slug || undefined,
                              subcategory?.slug || undefined,
                            );
                            const generated = generateProductMessage(
                              {
                                name: formData.product.name,
                                price: parseFloat(formData.product.price),
                                originalPrice: formData.product.originalPrice
                                  ? parseFloat(formData.product.originalPrice)
                                  : undefined,
                                link: formData.product.link,
                                category: category?.slug || undefined,
                                subcategory: subcategory?.slug || undefined,
                              },
                              { hook },
                            );
                            setFormData({ ...formData, message: generated });
                            // Adicionar ao histórico quando gerar mensagem
                            const history = messageHistoryRef.current;
                            const index = messageHistoryIndexRef.current;
                            const newHistory = history.slice(0, index + 1);
                            newHistory.push(generated);
                            if (newHistory.length > 50) {
                              newHistory.shift();
                            } else {
                              messageHistoryIndexRef.current = newHistory.length - 1;
                            }
                            messageHistoryRef.current = newHistory;
                          }
                        }}
                        className="p-1.5 hover:bg-dark-bg/50 rounded transition-colors text-dark-text hover:text-primary-400"
                        title="Gerar nova mensagem de copy"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {messageMode === 'product' && (
                    <p className="text-xs text-dark-muted mb-2">
                      💡 A mensagem foi gerada automaticamente. Você pode editar
                      livremente. Use o botão 🔄 para gerar uma nova mensagem.
                    </p>
                  )}
                  {!messageMode && (
                    <p className="text-xs text-dark-muted mb-2">
                      💡 Selecione texto e use os botões de formatação que aparecem acima.
                    </p>
                  )}
                  <div className="relative">
                    <TextFormattingToolbar
                      textareaId="post-message-textarea"
                      onFormat={(formattedText) =>
                        setFormData({ ...formData, message: formattedText })
                      }
                      value={formData.message}
                    />
                    <textarea
                      id="post-message-textarea"
                      data-formatting-toolbar
                      value={formData.message}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        if (!isUndoRedoRef.current) {
                          // Adicionar ao histórico apenas se não for uma operação de undo/redo
                          const history = messageHistoryRef.current;
                          const index = messageHistoryIndexRef.current;
                          
                          // Remover estados futuros se estamos no meio do histórico
                          const newHistory = history.slice(0, index + 1);
                          newHistory.push(newValue);
                          
                          // Limitar histórico a 50 estados
                          if (newHistory.length > 50) {
                            newHistory.shift();
                          } else {
                            messageHistoryIndexRef.current = newHistory.length - 1;
                          }
                          
                          messageHistoryRef.current = newHistory;
                        }
                        setFormData({ ...formData, message: newValue });
                      }}
                      onKeyDown={(e) => {
                        // Detectar Ctrl+Z (ou Cmd+Z no Mac) para desfazer
                        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                          e.preventDefault();
                          
                          // Salvar estado atual antes de fazer undo (se houver mudanças pendentes)
                          if (debounceTimerRef.current) {
                            clearTimeout(debounceTimerRef.current);
                            debounceTimerRef.current = null;
                            
                            const history = messageHistoryRef.current;
                            const index = messageHistoryIndexRef.current;
                            const currentValue = formData.message;
                            
                            // Adicionar estado atual se for diferente do último no histórico
                            if (history[index] !== currentValue) {
                              const newHistory = history.slice(0, index + 1);
                              newHistory.push(currentValue);
                              if (newHistory.length > 50) {
                                newHistory.shift();
                              } else {
                                messageHistoryIndexRef.current = newHistory.length - 1;
                              }
                              messageHistoryRef.current = newHistory;
                            }
                          }
                          
                          const history = messageHistoryRef.current;
                          const index = messageHistoryIndexRef.current;
                          
                          if (index > 0) {
                            isUndoRedoRef.current = true;
                            const newIndex = index - 1;
                            messageHistoryIndexRef.current = newIndex;
                            setFormData({ ...formData, message: history[newIndex] });
                            setTimeout(() => {
                              isUndoRedoRef.current = false;
                            }, 0);
                          }
                        }
                        // Detectar Ctrl+Shift+Z (ou Cmd+Shift+Z no Mac) para refazer
                        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                          e.preventDefault();
                          
                          // Limpar qualquer debounce pendente antes de fazer redo
                          if (debounceTimerRef.current) {
                            clearTimeout(debounceTimerRef.current);
                            debounceTimerRef.current = null;
                          }
                          
                          const history = messageHistoryRef.current;
                          const index = messageHistoryIndexRef.current;
                          
                          if (index < history.length - 1) {
                            isUndoRedoRef.current = true;
                            const newIndex = index + 1;
                            messageHistoryIndexRef.current = newIndex;
                            setFormData({ ...formData, message: history[newIndex] });
                            setTimeout(() => {
                              isUndoRedoRef.current = false;
                            }, 0);
                          }
                        }
                        // Também suportar Ctrl+Y para refazer (padrão Windows)
                        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                          e.preventDefault();
                          
                          // Limpar qualquer debounce pendente antes de fazer redo
                          if (debounceTimerRef.current) {
                            clearTimeout(debounceTimerRef.current);
                            debounceTimerRef.current = null;
                          }
                          
                          const history = messageHistoryRef.current;
                          const index = messageHistoryIndexRef.current;
                          
                          if (index < history.length - 1) {
                            isUndoRedoRef.current = true;
                            const newIndex = index + 1;
                            messageHistoryIndexRef.current = newIndex;
                            setFormData({ ...formData, message: history[newIndex] });
                            setTimeout(() => {
                              isUndoRedoRef.current = false;
                            }, 0);
                          }
                        }
                      }}
                      required
                      rows={messageMode === 'product' ? 8 : 5}
                      className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text placeholder-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder={
                        messageMode === 'product'
                          ? 'A mensagem será gerada automaticamente quando você preencher os campos do produto...'
                          : 'Digite a mensagem que será enviada para os canais selecionados. Selecione texto e use os botões de formatação que aparecem.'
                      }
                    />
                  </div>
                  {formData.channelIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCopySuggestions(!showCopySuggestions)}
                      className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      {showCopySuggestions ? 'Ocultar' : 'Ver'} sugestões de copy
                    </button>
                  )}
                  {showCopySuggestions && formData.channelIds.length > 0 && (
                    <div className="bg-dark-bg/50 border border-dark-border rounded-md p-3 space-y-2">
                      <p className="text-xs font-medium text-dark-text mb-2">
                        💡 Sugestões baseadas nos canais selecionados:
                      </p>
                      <div className="space-y-1">
                        {getCopySuggestions(
                          channels.filter((c) => formData.channelIds.includes(c.id)),
                        ).map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, message: suggestion });
                              setShowCopySuggestions(false);
                            }}
                            className="w-full text-left text-xs text-dark-muted hover:text-dark-text hover:bg-dark-border/30 p-2 rounded transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-dark-muted">
                    💡 <strong>Dica:</strong> Selecione texto e use os botões de formatação que aparecem acima para aplicar negrito, itálico, etc.
                  </p>
                </div>

              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Template (Opcional)
                </label>
                <select
                  value={formData.templateId}
                  onChange={(e) => {
                    setFormData({ ...formData, templateId: e.target.value });
                    // Limpar overlayImage quando mudar template
                    if (!e.target.value) {
                      setOverlayImage(null);
                      setFormData({ ...formData, templateId: '', imageUrl: '' });
                    }
                  }}
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Nenhum template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-dark-muted">
                  Selecione um template para personalizar a aparência do post
                </p>
              </div>

              {/* Campo de imagem sobreposta - apenas quando template estiver selecionado */}
              {selectedTemplate && (
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Imagem Sobreposta (Opcional)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Limitar tamanho do arquivo (10MB)
                          if (file.size > 10 * 1024 * 1024) {
                            alert('Imagem muito grande. Por favor, escolha uma imagem menor que 10MB.');
                            return;
                          }
                          
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const result = reader.result as string;
                            // Calcular posição inicial (centro do template)
                            // Full HD: 1920x1080
                            const templateWidth = selectedTemplate.width || 1920;
                            const templateHeight = selectedTemplate.height || 1080;
                            
                            // Criar uma imagem temporária para obter dimensões
                            const img = new Image();
                            img.onload = () => {
                              const naturalWidth = img.width;
                              const naturalHeight = img.height;
                              
                              // Começar com 30% do tamanho natural
                              const initialWidth = naturalWidth * 0.3;
                              const initialHeight = naturalHeight * 0.3;
                              
                              // Posicionar no centro
                              const centerX = (templateWidth / 2) - (initialWidth / 2);
                              const centerY = (templateHeight / 2) - (initialHeight / 2);
                              
                              setOverlayImage({
                                url: result,
                                left: centerX,
                                top: centerY,
                                width: initialWidth,
                                height: initialHeight,
                                scaleX: 0.3,
                                scaleY: 0.3,
                                angle: 0,
                              });
                            };
                            img.src = result;
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-500 file:text-white hover:file:bg-primary-600 file:cursor-pointer cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    {overlayImage && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400">✓ Imagem adicionada</span>
                        <button
                          type="button"
                          onClick={() => {
                            setOverlayImage(null);
                            setFormData({ ...formData, imageUrl: '' });
                            setImagePreview(null);
                          }}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-dark-muted">
                    Adicione uma imagem para sobrepor ao template. Você poderá posicionar e redimensionar no preview ao lado.
                  </p>
                </div>
              )}

              {/* Campo de imagem simples - apenas quando NÃO houver template */}
              {!selectedTemplate && (
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Imagem (Opcional)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Limitar tamanho do arquivo (10MB)
                          if (file.size > 10 * 1024 * 1024) {
                            alert('Imagem muito grande. Por favor, escolha uma imagem menor que 10MB.');
                            return;
                          }
                          
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const result = reader.result as string;
                            setFormData({ ...formData, imageUrl: result });
                            setImagePreview(result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-500 file:text-white hover:file:bg-primary-600 file:cursor-pointer cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    {imagePreview && (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-48 object-contain rounded-md border border-dark-border"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, imageUrl: '' });
                            setImagePreview(null);
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                          title="Remover imagem"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-dark-muted">
                    Adicione uma imagem para acompanhar o post
                  </p>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-dark-text">
                    Canais de Publicação * (Selecione pelo menos um)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowChannelForm(!showChannelForm)}
                    className="text-sm text-primary-500 hover:text-primary-400 font-medium flex items-center transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {showChannelForm ? 'Cancelar' : 'Novo Canal'}
                  </button>
                </div>

                {showChannelForm && (
                  <div className="mb-4 p-4 bg-gradient-to-br from-dark-bg/80 to-purple-900/20 border border-dark-border rounded-md">
                    <h3 className="text-sm font-medium text-dark-text mb-3">Criar Novo Canal</h3>
                    <form onSubmit={handleCreateChannel} className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-dark-text mb-1">
                          Nome do Canal *
                        </label>
                        <input
                          type="text"
                          value={newChannel.name}
                          onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                          required
                          className="w-full px-3 py-2 text-sm bg-dark-bg/50 border border-dark-border rounded-md text-dark-text placeholder-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Ex: Canal de Promoções"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-dark-text mb-1">
                          Tipo de Canal *
                        </label>
                        <select
                          value={newChannel.type}
                          onChange={(e) => setNewChannel({ ...newChannel, type: e.target.value })}
                          required
                          className="w-full px-3 py-2 text-sm bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="telegram">Telegram</option>
                          <option value="instagram_stories">Instagram Stories</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="facebook">Facebook</option>
                          <option value="twitter">Twitter</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-dark-text mb-1">
                          ID do Canal *
                        </label>
                        <input
                          type="text"
                          value={newChannel.chatId}
                          onChange={(e) => setNewChannel({ ...newChannel, chatId: e.target.value })}
                          required
                          className="w-full px-3 py-2 text-sm bg-dark-bg/50 border border-dark-border rounded-md text-dark-text placeholder-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder={
                            newChannel.type === 'telegram'
                              ? '@channelname ou -1001234567890'
                              : newChannel.type === 'instagram_stories'
                              ? 'ID da conta Instagram'
                              : newChannel.type === 'whatsapp'
                              ? 'Número do WhatsApp (ex: 5511999999999)'
                              : 'ID do canal'
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-dark-text mb-1">
                          Descrição
                        </label>
                        <textarea
                          value={newChannel.description}
                          onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 text-sm bg-dark-bg/50 border border-dark-border rounded-md text-dark-text placeholder-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Descrição opcional do canal"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={creatingChannel}
                        className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2 px-4 rounded-md hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 text-sm font-medium transition-all"
                      >
                        {creatingChannel ? 'Criando...' : 'Criar e Selecionar Canal'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="border border-dark-border rounded-md p-4 max-h-64 overflow-y-auto bg-dark-bg/30">
                  {channels.length === 0 ? (
                    <p className="text-sm text-dark-muted text-center py-4">
                      Nenhum canal disponível. Crie canais primeiro.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {channels.map((channel) => (
                        <label
                          key={channel.id}
                          className="flex items-center p-3 rounded-lg hover:bg-dark-border/30 cursor-pointer border border-transparent hover:border-dark-border transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={formData.channelIds.includes(channel.id)}
                            onChange={() => handleChannelToggle(channel.id)}
                            className="rounded border-dark-border text-primary-500 focus:ring-primary-500 bg-dark-bg/50"
                          />
                          <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-dark-text">
                                {channel.name}
                              </span>
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
                            {channel.description && (
                              <p className="text-xs text-dark-muted mt-1">
                                {channel.description}
                              </p>
                            )}
                            {(() => {
                              const markupInfo = getChannelMarkupInfo(channel.type);
                              return (
                                <div className="mt-2 flex items-start gap-1">
                                  <span className="text-xs">{markupInfo.icon}</span>
                                  <p className="text-xs text-dark-muted/80 flex-1">
                                    <strong>Formato:</strong> {markupInfo.description}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                          <span
                            className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              channel.isActive
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-dark-border/50 text-dark-muted border border-dark-border'
                            }`}
                          >
                            {channel.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {formData.channelIds.length > 0 && (
                  <p className="mt-2 text-sm text-green-400">
                    {formData.channelIds.length} canal(is) selecionado(s)
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-4 pt-4 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 py-2 border border-dark-border rounded-md text-dark-text hover:bg-dark-border/30 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || formData.channelIds.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Salvando...' : 'Salvar Post'}
                </button>
              </div>
            </form>
          </div>

          {/* Preview */}
          <PostPreview
            title={formData.title || 'Título do Post'}
            message={formData.message || 'Digite a mensagem para ver o preview...'}
            template={selectedTemplate}
            imageUrl={formData.imageUrl || undefined}
            overlayImage={overlayImage}
            onOverlayImageChange={(newOverlayImage) => {
              setOverlayImage(newOverlayImage);
            }}
            markupType={markupType}
            onTemplateUpdate={(updatedTemplate) => {
              // Atualizar template na lista e selecionar
              setTemplates(templates.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
              setSelectedTemplate(updatedTemplate);
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
