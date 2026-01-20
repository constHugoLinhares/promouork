'use client';

import { useEffect, useRef, useState } from 'react';

// Importação dinâmica do Fabric.js apenas no cliente
let fabric: any = null;
if (typeof window !== 'undefined') {
  import('fabric').then((fabricModule) => {
    fabric = fabricModule.fabric;
  });
}

import api from '@/lib/api';
import FabricTemplateEditor from './FabricTemplateEditor';

interface PostPreviewProps {
  title: string;
  message: string;
  template?: {
    id?: string;
    background?: string;
    width?: number;
    height?: number;
    elements?: any[];
  };
  imageUrl?: string;
  overlayImage?: {
    url: string;
    left: number;
    top: number;
    width: number;
    height: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
  } | null;
  onOverlayImageChange?: (overlayImage: {
    url: string;
    left: number;
    top: number;
    width: number;
    height: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
  } | null) => void;
  markupType?: 'html' | 'markdown' | 'plain';
  onTemplateUpdate?: (updatedTemplate: any) => void;
}

export default function PostPreview({ title, message, template, imageUrl, overlayImage, onOverlayImageChange, markupType = 'html', onTemplateUpdate }: PostPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [templateData, setTemplateData] = useState(template);
  const [tempTemplateData, setTempTemplateData] = useState(template); // Estado temporário para edições não salvas
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const [fabricLoaded, setFabricLoaded] = useState(false);
  const [previewDimensions, setPreviewDimensions] = useState({ width: 400, height: 600, scale: 1 });

  // Atualizar templateData quando template mudar
  useEffect(() => {
    setTemplateData(template);
    setTempTemplateData(template); // Também atualizar o estado temporário
  }, [template]);

  const handleSaveTemplate = async () => {
    if (!tempTemplateData || !tempTemplateData.id) {
      alert('Template não encontrado');
      return;
    }

    setSaving(true);
    try {
      // Garantir que elements seja um array válido
      const elements = Array.isArray(tempTemplateData.elements) 
        ? tempTemplateData.elements 
        : (tempTemplateData.elements ? [tempTemplateData.elements] : []);

      const response = await api.patch(`/templates/${tempTemplateData.id}`, {
        background: tempTemplateData.background,
        width: tempTemplateData.width,
        height: tempTemplateData.height,
        elements: elements, // Enviar como array
      });
      
      // Atualizar template local (apenas após salvar com sucesso)
      setTemplateData(response.data);
      setTempTemplateData(response.data); // Sincronizar estado temporário
      
      // Notificar componente pai
      if (onTemplateUpdate) {
        onTemplateUpdate(response.data);
      }
      
      setIsEditing(false);
      alert('Template atualizado com sucesso!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Restaurar estado temporário para o estado original (descartar alterações não salvas)
    setTempTemplateData(templateData);
    setIsEditing(false);
  };

  // Carregar Fabric.js dinamicamente
  useEffect(() => {
    if (typeof window !== 'undefined' && !fabric) {
      import('fabric').then((fabricModule) => {
        fabric = fabricModule.fabric;
        setFabricLoaded(true);
      });
    } else if (fabric) {
      setFabricLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !fabricLoaded || !fabric || isEditing) {
      return;
    }

    // Se não há template, não criar canvas
    // Usar templateData (não tempTemplateData) para o preview, pois queremos mostrar o estado salvo
    if (!templateData) {
      return;
    }

    // Full HD: 1920x1080 (largura x altura)
    const width = templateData.width || 1920;
    const height = templateData.height || 1080;
    const background = templateData.background || '#FFFFFF';

    // Limpar canvas anterior se existir
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    // Calcular dimensões disponíveis para o preview (EXATAMENTE como no FabricTemplateEditor)
    // Usar os mesmos valores padrão do FabricTemplateEditor
    const maxPreviewWidth = 400; // Largura máxima do preview (mesmo valor padrão do editor)
    const maxPreviewHeight = 600; // Altura máxima do preview (mesmo valor padrão do editor)
    
    // Calcular escala da mesma forma que o FabricTemplateEditor
    const scale = Math.min(maxPreviewWidth / width, maxPreviewHeight / height); // Mesma fórmula do editor (sem o ", 1" no final)
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    
    // Atualizar dimensões do preview no estado
    setPreviewDimensions({ width: scaledWidth, height: scaledHeight, scale });

    // Criar canvas do Fabric.js para preview (exatamente como no FabricTemplateEditor)
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: scaledWidth,
      height: scaledHeight,
      backgroundColor: background,
      preserveObjectStacking: true, // Mesma configuração do editor
    });

    fabricCanvasRef.current = canvas;
    
    // Configurar comportamento padrão para Textbox - permitir redimensionamento (mesma configuração do editor)
    if (fabric.Textbox) {
      fabric.Textbox.prototype.lockUniScaling = false;
      fabric.Textbox.prototype.lockScalingFlip = false;
    }

    // Forçar renderização inicial do background (mesma lógica do editor)
    canvas.setBackgroundColor(background, () => {
      canvas.renderAll();
    });

    // Carregar elementos
    let elements = templateData.elements;
    
    // Se elements é uma string JSON, fazer parse
    if (typeof elements === 'string') {
      try {
        elements = JSON.parse(elements);
      } catch (e) {
        console.error('Error parsing elements:', e);
        elements = [];
      }
    }
    
    // Se elements não é array, tentar converter
    if (!Array.isArray(elements)) {
      elements = elements ? [elements] : [];
    }

    if (elements && Array.isArray(elements) && elements.length > 0) {
      let loadedCount = 0;
      let imageCount = 0;
      const totalElements = elements.length;

      // Rastrear posições para inserir elementos na ordem correta
      let currentPosition = 0;
      const loadPromises: Promise<void>[] = [];
      
      elements.forEach((elementData: any, originalIndex: number) => {
        try {
          // Suportar formato antigo (type: "text" com position.x/y e content)
          // e formato novo (type: "textbox" com left/top e text)
          if (elementData.type === 'textbox' || elementData.type === 'i-text' || elementData.type === 'text') {
            // Determinar conteúdo do texto
            const textContent = elementData.text || elementData.content || '';
            
            // IMPORTANTE: Usar EXATAMENTE a mesma lógica do FabricTemplateEditor
            // Os elementos vêm do banco com coordenadas REAIS
            // No preview, sempre aplicar escala (equivalente a previewMode = true)
            const baseLeft = elementData.left !== undefined ? elementData.left : (elementData.position?.x || 0);
            const baseTop = elementData.top !== undefined ? elementData.top : (elementData.position?.y || 0);
            const baseWidth = elementData.width || 200;
            const baseFontSize = elementData.fontSize || 24;
            
            // Determinar cor (suportar fill e color)
            const fill = elementData.fill || elementData.color || '#000000';
            
            const obj = new fabric.Textbox(textContent, {
              left: baseLeft * scale, // Sempre aplicar escala no preview (previewMode = true)
              top: baseTop * scale, // Sempre aplicar escala no preview (previewMode = true)
              width: baseWidth * scale, // Sempre aplicar escala no preview (previewMode = true)
              fontSize: baseFontSize * scale, // Sempre aplicar escala no preview (previewMode = true)
              fill: fill,
              fontFamily: elementData.fontFamily || 'Arial',
              lockUniScaling: false, // Mesma configuração do editor
              lockScalingFlip: false, // Mesma configuração do editor
              lockMovementX: false, // Mesma configuração do editor
              lockMovementY: false, // Mesma configuração do editor
              hasControls: true, // Mesma configuração do editor
              hasBorders: true, // Mesma configuração do editor
              // Desabilitar interação no preview
              evented: false,
              selectable: false,
              hoverCursor: 'default',
              moveCursor: 'default',
            });
            // Restaurar propriedades customizadas
            if (elementData.linkUrl) {
              obj.set('linkUrl', elementData.linkUrl);
              obj.set('isLink', true);
            }
            // Aplicar scaleX e scaleY se existirem (mesma lógica do editor quando em previewMode)
            if (elementData.scaleX !== undefined && elementData.scaleX !== 1) {
              obj.set('scaleX', elementData.scaleX * scale); // Sempre aplicar escala no preview (previewMode = true)
            }
            if (elementData.scaleY !== undefined && elementData.scaleY !== 1) {
              obj.set('scaleY', elementData.scaleY * scale); // Sempre aplicar escala no preview (previewMode = true)
            }
            if (elementData.angle !== undefined) obj.set('angle', elementData.angle);
            if (elementData.opacity !== undefined) obj.set('opacity', elementData.opacity);
            
            // Inserir na posição correta para preservar ordem
            canvas.insertAt(obj, currentPosition);
            currentPosition++;
            loadedCount++;
          } else if (elementData.type === 'image') {
            imageCount++;
            const imageSrc = elementData.src || elementData.url;
            if (imageSrc) {
              const imagePosition = currentPosition;
              currentPosition++;
              
              const imagePromise = new Promise<void>((resolve, reject) => {
                fabric.Image.fromURL(imageSrc, (img: any) => {
                  try {
                    // IMPORTANTE: Usar EXATAMENTE a mesma lógica do FabricTemplateEditor
                    // Os elementos vêm do banco com coordenadas REAIS
                    // No preview, sempre aplicar escala (equivalente a previewMode = true)
                    const baseLeft = elementData.left || 0;
                    const baseTop = elementData.top || 0;
                    const baseScaleX = elementData.scaleX || 1;
                    const baseScaleY = elementData.scaleY || 1;
                    
                    img.set({
                      left: baseLeft * scale, // Sempre aplicar escala no preview (previewMode = true)
                      top: baseTop * scale, // Sempre aplicar escala no preview (previewMode = true)
                      scaleX: baseScaleX * scale, // Sempre aplicar escala no preview (previewMode = true)
                      scaleY: baseScaleY * scale, // Sempre aplicar escala no preview (previewMode = true)
                      // Desabilitar interação no preview
                      evented: false,
                      selectable: false,
                      hoverCursor: 'default',
                      moveCursor: 'default',
                    });
                    if (elementData.opacity !== undefined) img.set('opacity', elementData.opacity);
                    
                    // Inserir na posição correta para preservar ordem
                    canvas.insertAt(img, imagePosition);
                    canvas.renderAll(); // Mesma lógica do editor
                    loadedCount++;
                    resolve();
                  } catch (error) {
                    console.error('Error loading image element:', error, elementData);
                    reject(error);
                  }
                }, { crossOrigin: 'anonymous' });
              });
              
              loadPromises.push(imagePromise);
            } else {
              console.warn('Image element without src:', elementData);
              loadedCount++;
            }
          } else {
            console.warn('Unknown element type:', elementData.type, elementData);
            loadedCount++;
          }
        } catch (error) {
          console.error('Error loading element:', error, elementData);
          loadedCount++;
        }
      });
      
      // Aguardar todas as imagens carregarem antes de renderizar final
      if (loadPromises.length > 0) {
        Promise.all(loadPromises).then(() => {
          canvas.renderAll();
        }).catch((error) => {
          console.error('Error loading images:', error);
          canvas.renderAll();
        });
      }

      // Renderizar após carregar todos os elementos (mesma lógica do editor)
      canvas.renderAll();
    }

    // Carregar imagem sobreposta se existir
    if (overlayImage && overlayImage.url) {
      fabric.Image.fromURL(overlayImage.url, (img: any) => {
        const imgElement = img.getElement();
        const naturalWidth = imgElement.width;
        const naturalHeight = imgElement.height;
        
        // Converter coordenadas reais para coordenadas escaladas do preview
        const scaledLeft = overlayImage.left * scale;
        const scaledTop = overlayImage.top * scale;
        
        // overlayImage.width e overlayImage.height já são as dimensões desejadas em coordenadas reais
        // Calcular a escala do Fabric.js baseada nas dimensões desejadas
        // Primeiro, calcular a escala base (sem o scale do preview)
        const baseScaleX = overlayImage.width / naturalWidth;
        const baseScaleY = overlayImage.height / naturalHeight;
        
        // Aplicar a escala do preview para o canvas
        const fabricScaleX = baseScaleX * scale;
        const fabricScaleY = baseScaleY * scale;

        // Se houver callback para mudanças, tornar editável
        const isEditable = !!onOverlayImageChange;

        img.set({
          left: scaledLeft,
          top: scaledTop,
          scaleX: fabricScaleX,
          scaleY: fabricScaleY,
          angle: overlayImage.angle || 0,
          evented: isEditable,
          selectable: isEditable,
          hasControls: isEditable,
          hasBorders: isEditable,
          hoverCursor: isEditable ? 'move' : 'default',
          moveCursor: isEditable ? 'move' : 'default',
        });

        canvas.add(img);
        
        // Se editável, adicionar listener para mudanças
        if (isEditable) {
          img.on('modified', () => {
            const obj = img;
            const currentLeft = obj.left || 0;
            const currentTop = obj.top || 0;
            const currentScaleX = obj.scaleX || 1;
            const currentScaleY = obj.scaleY || 1;
            const currentAngle = obj.angle || 0;

            // Converter de volta para coordenadas reais
            // currentScaleX já está em coordenadas do canvas (inclui scale do preview)
            // Para obter a escala real, dividir pelo scale do preview
            const realScaleX = currentScaleX / scale;
            const realScaleY = currentScaleY / scale;
            
            // Calcular dimensões reais
            const realWidth = naturalWidth * realScaleX;
            const realHeight = naturalHeight * realScaleY;
            
            // Converter posição de volta para coordenadas reais
            const realLeft = currentLeft / scale;
            const realTop = currentTop / scale;

            if (onOverlayImageChange) {
              onOverlayImageChange({
                url: overlayImage.url,
                left: realLeft,
                top: realTop,
                width: realWidth,
                height: realHeight,
                scaleX: realScaleX,
                scaleY: realScaleY,
                angle: currentAngle,
              });
            }
          });
          
          canvas.setActiveObject(img);
        }
        
        canvas.renderAll();
      }, { crossOrigin: 'anonymous' });
    }

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateData, fabricLoaded, isEditing, overlayImage]);

  // Modal de edição de template
  if (isEditing && templateData) {
    // Usar os mesmos valores de maxPreviewWidth e maxPreviewHeight do preview
    // para garantir que os elementos tenham o mesmo tamanho no editor e no preview
    const maxPreviewWidth = 400; // Mesmo valor usado no preview
    const maxPreviewHeight = 600; // Mesmo valor usado no preview
    
    return (
      <>
        {/* Overlay escuro */}
        <div 
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={handleCancelEdit}
        >
          {/* Modal - tamanho fixo */}
          <div 
            className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="flex justify-between items-center p-6 border-b border-dark-border flex-shrink-0">
              <h3 className="text-xl font-semibold text-dark-text">Editar Template</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 border border-dark-border rounded-md text-dark-text hover:bg-dark-surface/50 transition-colors text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 transition-all text-sm"
                >
                  {saving ? 'Salvando...' : 'Salvar Template'}
                </button>
              </div>
            </div>
            
            {/* Conteúdo do Modal */}
            <div className="flex-1 overflow-hidden p-6 flex items-center justify-center">
              <FabricTemplateEditor
                template={tempTemplateData || templateData}
                onChange={(updated) => setTempTemplateData(updated)} // Atualizar apenas estado temporário
                previewMode={true} // Sempre usar previewMode no modal para escalar
                maxPreviewWidth={maxPreviewWidth} // Usar os mesmos valores do preview
                maxPreviewHeight={maxPreviewHeight} // Usar os mesmos valores do preview
              />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="lg:sticky lg:top-6 lg:h-fit bg-dark-surface/50 rounded-lg shadow-lg p-6 border border-dark-border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-dark-text">Preview do Post</h3>
        {templateData && templateData.id && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-md hover:from-purple-600 hover:to-purple-700 transition-all text-sm font-medium"
            title="Editar Template"
          >
            ✏️ Editar Template
          </button>
        )}
      </div>
      
      <div className="border-2 border-dark-border rounded-lg overflow-hidden bg-dark-bg/30">
        {/* Simulação de Canal de Comunicação */}
        <div className="bg-gradient-to-r from-dark-border/50 to-purple-900/20 px-4 py-2 border-b border-dark-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-dark-text">Canal de Comunicação</p>
              <p className="text-xs text-dark-muted">Agora</p>
            </div>
          </div>
        </div>

        {/* Preview do template ou imagem */}
        {imageUrl ? (
          <div className="flex items-center justify-center overflow-auto" style={{ maxHeight: '80vh' }}>
            <img
              src={imageUrl}
              alt="Preview do post"
              className="max-w-full h-auto object-contain"
            />
          </div>
        ) : !fabricLoaded ? (
          <div className="border border-dark-border rounded-lg p-8 bg-dark-bg/30 flex items-center justify-center min-h-[400px] w-full">
            <p className="text-dark-muted">Carregando preview...</p>
          </div>
        ) : templateData ? (
          <div className="flex items-center justify-center overflow-auto" style={{ maxHeight: '80vh' }}>
            <div className="inline-block" style={{ backgroundColor: templateData.background || '#FFFFFF' }}>
              <canvas
                ref={canvasRef}
                style={{ display: 'block' }}
              />
            </div>
          </div>
        ) : (
          <div className="border border-dark-border rounded-lg p-8 bg-dark-bg/30 flex items-center justify-center min-h-[400px] w-full">
            <p className="text-dark-muted">Nenhum template selecionado</p>
          </div>
        )}

        {/* Mensagem do post */}
        <div className="bg-dark-surface/30 p-4">
          {markupType === 'html' ? (
            <div className="text-dark-text">
              <strong className="text-base block mb-4">{title}</strong>
              <div
                className="text-sm text-dark-muted whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    // Processar mensagem: adicionar 4 espaços em TODAS as linhas
                    const lines = message.split('\n');
                    const processedLines = lines.map((line) => {
                      // Adicionar 4 espaços no início de cada linha (incluindo a primeira)
                      return '    ' + line;
                    });
                    const processedMessage = processedLines.join('\n');
                    
                    // Processar HTML: primeiro escapar tudo, depois processar tags permitidas
                    let htmlContent = processedMessage
                      .replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;');
                    
                    // Converter os 4 espaços iniciais para &nbsp; ANTES de processar tags HTML
                    // (todas as linhas começam com 4 espaços após o processamento)
                    htmlContent = htmlContent.replace(/^    /gm, '&nbsp;&nbsp;&nbsp;&nbsp;');
                    
                    // Restaurar tags HTML permitidas
                    htmlContent = htmlContent
                      .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gi, '<strong>$1</strong>')
                      .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/gi, '<strong>$1</strong>')
                      .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gi, '<em>$1</em>')
                      .replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/gi, '<em>$1</em>')
                      .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u>$1</u>')
                      .replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/gi, '<s>$1</s>')
                      .replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/gi, '<code class="bg-dark-bg px-1 rounded">$1</code>');
                    
                    // Converter quebras de linha para <br>
                    htmlContent = htmlContent.replace(/\n/g, '<br>');
                    
                    return htmlContent;
                  })(),
                }}
              />
            </div>
          ) : (
            <>
              <h4 className="font-semibold text-dark-text mb-4">{title}</h4>
              <p className="text-dark-muted whitespace-pre-wrap">
                {message
                  .split('\n')
                  .map((line) => '    ' + line) // Adicionar 4 espaços em TODAS as linhas
                  .join('\n')}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

