'use client';

import { deleteImageFromR2, uploadImageToR2 } from '@/lib/storage';
import { useEffect, useRef, useState } from 'react';

// Importação dinâmica do Fabric.js apenas no cliente
let fabric: any = null;
const loadFabric = async () => {
  if (typeof window !== 'undefined' && !fabric) {
    const fabricModule = await import('fabric');
    fabric = fabricModule.fabric;
  }
  return fabric;
};

interface FabricTemplateEditorProps {
  template: {
    background?: string;
    width?: number;
    height?: number;
    elements?: any;
  };
  onChange: (template: any) => void;
  previewMode?: boolean;
  maxPreviewWidth?: number;
  maxPreviewHeight?: number;
}

export default function FabricTemplateEditor({
  template,
  onChange,
  previewMode = false,
  maxPreviewWidth = 400,
  maxPreviewHeight = 600,
}: FabricTemplateEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const saveCanvasStateRef = useRef<(() => void) | null>(null);
  const lastDimensionsRef = useRef<{ width: number; height: number } | null>(null);
  // Referência para rastrear as dimensões atuais do template (sem fallback)
  // Isso garante que preservamos as dimensões reais, não valores padrão
  const currentTemplateDimensionsRef = useRef<{ width?: number; height?: number } | null>(null);
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [fabricLoaded, setFabricLoaded] = useState(false);
  const [editingBackground, setEditingBackground] = useState(false);
  const [tempBackground, setTempBackground] = useState<string>('');
  const [elements, setElements] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Inicializar referência das dimensões do template quando o template mudar
  // Usar comparação mais robusta que lida com undefined/null
  const widthChanged = currentTemplateDimensionsRef.current?.width !== template.width;
  const heightChanged = currentTemplateDimensionsRef.current?.height !== template.height;
  
  if (!currentTemplateDimensionsRef.current || widthChanged || heightChanged) {
    // Preservar as dimensões exatas do template (pode ser undefined se não existirem)
    currentTemplateDimensionsRef.current = {
      width: template.width,
      height: template.height,
    };
  }

  // Usar as dimensões do template se existirem, caso contrário usar valores padrão apenas para renderização
  const realWidth = template.width !== undefined && template.width !== null ? template.width : 1080;
  const realHeight = template.height !== undefined && template.height !== null ? template.height : 1080;
  const background = template.background || '#FFFFFF';

  // Calcular dimensões do canvas (escaladas se previewMode, reais caso contrário)
  const scale = previewMode
    ? Math.min(maxPreviewWidth / realWidth, maxPreviewHeight / realHeight)
    : 1;
  const canvasWidth = previewMode ? realWidth * scale : realWidth;
  const canvasHeight = previewMode ? realHeight * scale : realHeight;

  // Carregar Fabric.js
  useEffect(() => {
    loadFabric().then(() => {
      setFabricLoaded(true);
    });
  }, []);

  // Função para limpar e filtrar apenas propriedades essenciais do elemento
  // IMPORTANTE: Sempre salva valores REAIS (não escalados), independente do modo
  const cleanElementData = (
    objData: any,
    obj: any, // Fabric.js object
    isPreviewMode: boolean,
    previewScale: number,
  ) => {
    // Obter valores atuais do objeto no canvas (podem estar escalados se em previewMode)
    const canvasLeft = obj.left || 0;
    const canvasTop = obj.top || 0;
    const canvasWidth = obj.width || 200;
    const canvasFontSize = obj.fontSize || 24;
    const canvasScaleX = obj.scaleX || 1;
    const canvasScaleY = obj.scaleY || 1;

    // SEMPRE converter para valores reais (dividir por scale se estiver em previewMode)
    const realLeft = isPreviewMode && previewScale !== 1 
      ? canvasLeft / previewScale 
      : canvasLeft;
    const realTop = isPreviewMode && previewScale !== 1 
      ? canvasTop / previewScale 
      : canvasTop;
    const realWidth = isPreviewMode && previewScale !== 1 
      ? canvasWidth / previewScale 
      : canvasWidth;
    const realFontSize = isPreviewMode && previewScale !== 1 
      ? canvasFontSize / previewScale 
      : canvasFontSize;
    const realScaleX = isPreviewMode && previewScale !== 1 
      ? (canvasScaleX !== 1 ? canvasScaleX / previewScale : 1)
      : (canvasScaleX !== 1 ? canvasScaleX : 1);
    const realScaleY = isPreviewMode && previewScale !== 1 
      ? (canvasScaleY !== 1 ? canvasScaleY / previewScale : 1)
      : (canvasScaleY !== 1 ? canvasScaleY : 1);

    const cleaned: any = {
      type: objData.type,
      left: realLeft,
      top: realTop,
    };

    // Propriedades específicas por tipo
    if (
      objData.type === 'textbox' ||
      objData.type === 'i-text' ||
      objData.type === 'text'
    ) {
      cleaned.text = objData.text || '';
      cleaned.width = realWidth;
      cleaned.fontSize = realFontSize;
      // Só salvar scaleX/scaleY se forem diferentes de 1
      // Para elementos de texto, o fontSize já reflete o tamanho correto
      if (realScaleX !== 1) {
        cleaned.scaleX = realScaleX;
      }
      if (realScaleY !== 1) {
        cleaned.scaleY = realScaleY;
      }

      cleaned.fontFamily = objData.fontFamily || 'Arial';
      cleaned.fill = objData.fill || '#000000';
      cleaned.angle = objData.angle || 0;
      cleaned.opacity = objData.opacity !== undefined ? objData.opacity : 1;
      cleaned.textAlign = objData.textAlign || 'left';
      cleaned.fontStyle = objData.fontStyle || 'normal';
      cleaned.fontWeight = objData.fontWeight || 'normal';
      cleaned.lineHeight = objData.lineHeight || 1.16;
    } else if (objData.type === 'image') {
      cleaned.scaleX = realScaleX;
      cleaned.scaleY = realScaleY;
      cleaned.angle = objData.angle || 0;
      cleaned.opacity = objData.opacity !== undefined ? objData.opacity : 1;

      // Para imagens, garantir que src seja salvo (URL do R2, não base64)
      const customProps = obj as any;
      if (customProps.getElement) {
        const imgElement = customProps.getElement();
        if (imgElement && imgElement.src) {
          // Se for base64, não salvar (deve ser URL do R2)
          if (!imgElement.src.startsWith('data:image/')) {
            cleaned.src = imgElement.src;
          }
        }
      }
      // Também verificar se há src salvo no objeto
      if (objData.src && !objData.src.startsWith('data:image/')) {
        cleaned.src = objData.src;
      }
    }

    // Propriedades customizadas (links)
    const customProps = obj as any;
    if (customProps.linkUrl) {
      cleaned.linkUrl = customProps.linkUrl;
    }
    if (customProps.isLink) {
      cleaned.isLink = customProps.isLink;
    }

    return cleaned;
  };

  // Função para salvar estado do canvas
  const saveCanvasState = () => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    
    // Forçar atualização das coordenadas antes de serializar
    objects.forEach((obj: any) => {
      obj.setCoords();
    });
    
    const serialized = objects.map((obj: any) => {
      const objData = obj.toObject(['linkUrl', 'isLink', 'src']);
      return cleanElementData(objData, obj, previewMode, scale);
    });
    
    // IMPORTANTE: Preservar EXATAMENTE as dimensões que estão no template atual
    // NÃO usar valores calculados com fallback (realWidth/realHeight) para evitar resetar
    // Usar a referência que rastreia as dimensões originais do template
    const updatedTemplate: any = {
      ...template,
      elements: serialized,
      background: canvas.backgroundColor as string,
    };
    
    // Usar as dimensões da referência (que preserva o estado original)
    // Se a referência não foi inicializada, usar as dimensões do template prop atual
    const dimensionsToUse = currentTemplateDimensionsRef.current;
    
    if (dimensionsToUse) {
      // Se width/height existiam originalmente, preservar esses valores
      // Se não existiam, não adicionar (deixar undefined)
      if (dimensionsToUse.width !== undefined && dimensionsToUse.width !== null) {
        updatedTemplate.width = dimensionsToUse.width;
      } else if (template.width === undefined || template.width === null) {
        // Se o template original não tinha width, não adicionar
        delete updatedTemplate.width;
      }
      
      if (dimensionsToUse.height !== undefined && dimensionsToUse.height !== null) {
        updatedTemplate.height = dimensionsToUse.height;
      } else if (template.height === undefined || template.height === null) {
        // Se o template original não tinha height, não adicionar
        delete updatedTemplate.height;
      }
    } else {
      // Se a referência não foi inicializada, usar as dimensões do template prop
      // Mas só incluir se já existirem (não adicionar valores padrão)
      if (template.width !== undefined && template.width !== null) {
        updatedTemplate.width = template.width;
      }
      if (template.height !== undefined && template.height !== null) {
        updatedTemplate.height = template.height;
      }
    }
    
    onChange(updatedTemplate);
  };

  // Inicializar canvas
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current || !fabricLoaded || !fabric)
      return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: background,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;

    if (fabric.Textbox) {
      fabric.Textbox.prototype.lockUniScaling = false;
      fabric.Textbox.prototype.lockScalingFlip = false;
    }

    // Inicializar referência das dimensões quando o canvas é criado
    lastDimensionsRef.current = { width: realWidth, height: realHeight };

    saveCanvasStateRef.current = saveCanvasState;

    // Event listeners
    const updateSelectedObject = () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.setCoords();
        // Criar uma cópia do objeto para garantir que o React detecte a mudança
        setSelectedObject({ ...activeObject });
      } else {
        // Só limpar seleção se realmente não houver objeto ativo
        // Não limpar durante movimento/transformação
        setSelectedObject(null);
      }
    };

    canvas.on('selection:created', (e: any) => {
      const selectedObj = e.selected?.[0] || null;
      setSelectedObject(selectedObj);
      updateElementsList();
    });

    canvas.on('selection:updated', (e: any) => {
      const selectedObj = e.selected?.[0] || null;
      setSelectedObject(selectedObj);
      updateElementsList();
    });

    canvas.on('selection:cleared', () => {
      // Verificar se realmente não há objeto ativo antes de limpar
      // Isso evita que a seleção seja limpa durante movimento/transformação
      const activeObject = canvas.getActiveObject();
      if (!activeObject) {
        setSelectedObject(null);
      } else {
        // Se ainda há objeto ativo, manter selecionado
        // Usar a mesma referência se possível para evitar re-renderização desnecessária
        setSelectedObject((prevSelected: any) => {
          if (prevSelected === activeObject) {
            return prevSelected;
          }
          return activeObject;
        });
      }
    });

    canvas.on('object:modified', () => {
      // Após modificação completa, atualizar selectedObject e lista de elementos
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.setCoords();
        // Manter a mesma referência do objeto para que a lista de elementos continue funcionando
        setSelectedObject((prevSelected: any) => {
          // Se o objeto ativo é o mesmo que estava selecionado, manter referência
          if (prevSelected === activeObject) {
            return prevSelected;
          }
          // Caso contrário, atualizar para o novo objeto
          return activeObject;
        });
        updateElementsList();
      }
      // Usar setTimeout para evitar salvar estado durante transformação
      setTimeout(() => {
        saveCanvasState();
      }, 0);
    });

    // Durante movimento, manter o objeto selecionado e atualizar propriedades
    // IMPORTANTE: Não atualizar selectedObject durante movimento para manter a mesma referência
    // Isso garante que a comparação na lista de elementos continue funcionando
    canvas.on('object:moving', () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.setCoords();
        // Não atualizar selectedObject aqui - manter a mesma referência
        // Apenas atualizar coordenadas para que o objeto seja renderizado corretamente
        canvas.renderAll();
      }
    });
    
    // Durante scaling, manter o objeto selecionado e atualizar propriedades
    canvas.on('object:scaling', () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.setCoords();
        // Não atualizar selectedObject aqui - manter a mesma referência
        canvas.renderAll();
      }
    });
    
    canvas.on('object:rotating', () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.setCoords();
        // Não atualizar selectedObject aqui - manter a mesma referência
        canvas.renderAll();
      }
    });
    
    canvas.on('object:changed', () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        activeObject.setCoords();
        // Não atualizar selectedObject aqui - manter a mesma referência
        canvas.renderAll();
      }
    });

    canvas.on('before:transform', () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        setSelectedObject(activeObject);
      }
    });

    canvas.on('object:added', () => {
      updateElementsList();
      // Usar setTimeout para evitar salvar estado antes do objeto estar totalmente inicializado
      setTimeout(() => {
        saveCanvasState();
      }, 0);
    });

    canvas.on('object:removed', () => {
      updateElementsList();
      setSelectedObject(null);
      saveCanvasState();
    });

    updateElementsList();

    // Carregar elementos salvos na ordem correta
    // IMPORTANTE: Preservar a ordem do array para manter a ordem de renderização (z-index)
    // No Fabric.js, a ordem dos objetos no canvas determina a ordem de renderização
    // Primeiro objeto = fundo, último objeto = frente
    if (
      template.elements &&
      Array.isArray(template.elements) &&
      template.elements.length > 0 &&
      fabric
    ) {
      // Rastrear posições para inserir elementos na ordem correta
      let currentPosition = 0;
      const loadPromises: Promise<void>[] = [];
      
      template.elements.forEach((elementData: any, originalIndex: number) => {
        try {
          if (elementData.type === 'textbox' || elementData.type === 'text') {
            // Elementos de texto são síncronos, adicionar imediatamente na posição correta
            const textContent = elementData.text || elementData.content || '';
            const baseLeft =
              elementData.left !== undefined
                ? elementData.left
                : elementData.position?.x || 0;
            const baseTop =
              elementData.top !== undefined
                ? elementData.top
                : elementData.position?.y || 0;
            const baseWidth = elementData.width || 200;
            const baseFontSize = elementData.fontSize || 24;
            const fill = elementData.fill || elementData.color || '#000000';

            const obj = new fabric.Textbox(textContent, {
              left: previewMode ? baseLeft * scale : baseLeft,
              top: previewMode ? baseTop * scale : baseTop,
              width: previewMode ? baseWidth * scale : baseWidth,
              fontSize: previewMode ? baseFontSize * scale : baseFontSize,
              fill: fill,
              fontFamily: elementData.fontFamily || 'Arial',
              lockUniScaling: false,
              lockScalingFlip: false,
              lockMovementX: false,
              lockMovementY: false,
              hasControls: true,
              hasBorders: true,
            });
            
            // IMPORTANTE: Armazenar fontSize REAL (não escalado) para uso em redimensionamento
            // O __baseFontSize sempre armazena o valor REAL, não o valor escalado do canvas
            (obj as any).__baseFontSize = baseFontSize;

            if (elementData.linkUrl) {
              obj.set('linkUrl', elementData.linkUrl);
              obj.set('isLink', true);
            }

            if (elementData.scaleX !== undefined && elementData.scaleX !== 1) {
              obj.set(
                'scaleX',
                previewMode ? elementData.scaleX * scale : elementData.scaleX,
              );
            }
            if (elementData.scaleY !== undefined && elementData.scaleY !== 1) {
              obj.set(
                'scaleY',
                previewMode ? elementData.scaleY * scale : elementData.scaleY,
              );
            }
            
            if (elementData.angle) obj.set('angle', elementData.angle);
            if (elementData.opacity !== undefined)
              obj.set('opacity', elementData.opacity);
            
            // Inserir na posição correta para preservar ordem
            canvas.insertAt(obj, currentPosition);
            currentPosition++;
          } else if (elementData.type === 'image' && elementData.src) {
            // Imagens são assíncronas, criar promise para carregar na ordem correta
            const imagePosition = currentPosition;
            currentPosition++;
            
            const imagePromise = new Promise<void>((resolve, reject) => {
              fabric.Image.fromURL(
                elementData.src,
                (img: any) => {
                  try {
                    const baseLeft = elementData.left || 0;
                    const baseTop = elementData.top || 0;
                    const baseScaleX = elementData.scaleX || 1;
                    const baseScaleY = elementData.scaleY || 1;

                    img.set({
                      left: previewMode ? baseLeft * scale : baseLeft,
                      top: previewMode ? baseTop * scale : baseTop,
                      scaleX: previewMode ? baseScaleX * scale : baseScaleX,
                      scaleY: previewMode ? baseScaleY * scale : baseScaleY,
                    });
                    if (elementData.opacity !== undefined)
                      img.set('opacity', elementData.opacity);
                    
                    // Inserir na posição correta para preservar ordem
                    canvas.insertAt(img, imagePosition);
                    resolve();
                  } catch (error) {
                    console.error('Error loading image element:', error, elementData);
                    reject(error);
                  }
                },
                { crossOrigin: 'anonymous' },
              );
            });
            
            loadPromises.push(imagePromise);
          }
        } catch (error) {
          console.error('Error loading element:', error, elementData);
        }
      });
      
      // Aguardar todas as imagens carregarem e então renderizar
      if (loadPromises.length > 0) {
        Promise.all(loadPromises)
          .then(() => {
            canvas.renderAll();
            updateElementsList();
          })
          .catch((error) => {
            console.error('Error loading images:', error);
            canvas.renderAll();
            updateElementsList();
          });
      } else {
        // Se não há imagens, renderizar imediatamente
        canvas.renderAll();
        updateElementsList();
      }
    } else {
      canvas.renderAll();
      updateElementsList();
    }

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabricLoaded]);

  // Atualizar quando template mudar externamente
  // IMPORTANTE: Este useEffect só deve atualizar quando as dimensões realmente mudarem
  // Não deve ser disparado quando apenas os elementos mudarem
  useEffect(() => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    // Usar realWidth e realHeight que já foram calculados no início do componente
    // Isso garante consistência e evita usar valores padrão incorretos
    const currentRealWidth = realWidth;
    const currentRealHeight = realHeight;

    // Verificar se as dimensões realmente mudaram comparando com a última referência
    // Isso evita atualizações desnecessárias quando apenas elementos mudam
    // IMPORTANTE: Se lastDimensionsRef não foi inicializado ainda, não fazer nada
    // (a inicialização acontece quando o canvas é criado)
    if (!lastDimensionsRef.current) {
      // Canvas ainda não foi inicializado, não fazer nada aqui
      // A inicialização das dimensões acontece no useEffect de inicialização do canvas
      if (template.background !== undefined) {
        const currentBg = canvas.backgroundColor as string;
        const newBg = template.background || '#FFFFFF';
        if (newBg !== currentBg) {
          canvas.setBackgroundColor(newBg, () => {
            canvas.renderAll();
          });
        }
        if (newBg !== tempBackground && !editingBackground) {
          setTempBackground(newBg);
        }
      }
      return;
    }

    const dimensionsChanged = 
        lastDimensionsRef.current.width !== currentRealWidth ||
        lastDimensionsRef.current.height !== currentRealHeight;

    // Se as dimensões não mudaram, apenas atualizar background se necessário e retornar
    if (!dimensionsChanged) {
      if (template.background !== undefined) {
        const currentBg = canvas.backgroundColor as string;
        const newBg = template.background || '#FFFFFF';
        if (newBg !== currentBg) {
          canvas.setBackgroundColor(newBg, () => {
            canvas.renderAll();
          });
        }
        if (newBg !== tempBackground && !editingBackground) {
          setTempBackground(newBg);
        }
      }
      return;
    }

    // Atualizar dimensões do canvas quando a resolução mudar
    if (previewMode) {
      // Em previewMode, recalcular scale e dimensões do canvas
      const newScale = Math.min(
        maxPreviewWidth / currentRealWidth,
        maxPreviewHeight / currentRealHeight,
      );
      const newCanvasWidth = currentRealWidth * newScale;
      const newCanvasHeight = currentRealHeight * newScale;

      // Verificar se as dimensões do canvas precisam ser atualizadas
      // Usar uma tolerância maior para evitar atualizações desnecessárias
      if (
        Math.abs(canvas.width! - newCanvasWidth) > 1 ||
        Math.abs(canvas.height! - newCanvasHeight) > 1
      ) {
        const oldScale = scale;

        // Atualizar posições dos objetos mantendo tamanhos absolutos
        canvas.getObjects().forEach((obj: any) => {
          // Obter coordenadas reais atuais (desescaladas)
          const currentRealLeft = (obj.left || 0) / oldScale;
          const currentRealTop = (obj.top || 0) / oldScale;
          const currentRealScaleX = (obj.scaleX || 1) / oldScale;
          const currentRealScaleY = (obj.scaleY || 1) / oldScale;

          // Manter os tamanhos absolutos (não escalar)
          // Apenas converter para o novo scale do canvas
          obj.set({
            left: currentRealLeft * newScale,
            top: currentRealTop * newScale,
            scaleX: currentRealScaleX * newScale,
            scaleY: currentRealScaleY * newScale,
          });
          obj.setCoords();
        });

        canvas.setWidth(newCanvasWidth);
        canvas.setHeight(newCanvasHeight);
        canvas.renderAll();
      }
    } else {
      // Em modo normal, apenas atualizar dimensões do canvas
      // Os elementos mantêm seus tamanhos absolutos (não escalam)
      // Só atualizar se realmente mudou (tolerância de 1px)
      if (Math.abs(currentRealWidth - canvas.width!) > 1) {
        canvas.setWidth(currentRealWidth);
        canvas.renderAll();
      }
      if (Math.abs(currentRealHeight - canvas.height!) > 1) {
        canvas.setHeight(currentRealHeight);
        canvas.renderAll();
      }
    }

    // Atualizar referência das dimensões após qualquer mudança
    lastDimensionsRef.current = { width: currentRealWidth, height: currentRealHeight };

    if (template.background !== undefined) {
      const currentBg = canvas.backgroundColor as string;
      const newBg = template.background || '#FFFFFF';
      if (newBg !== currentBg) {
        canvas.setBackgroundColor(newBg, () => {
          canvas.renderAll();
        });
      }
      if (newBg !== tempBackground && !editingBackground) {
        setTempBackground(newBg);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realWidth, realHeight, template.background, previewMode, maxPreviewWidth, maxPreviewHeight]);

  useEffect(() => {
    if (
      template.background !== undefined &&
      template.background !== tempBackground &&
      !editingBackground
    ) {
      setTempBackground(template.background);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.background]);

  const addText = () => {
    if (!fabricCanvasRef.current || !fabric || !fabricLoaded) return;

    const text = new fabric.Textbox('Clique para editar', {
      left: canvasWidth / 2 - 100 * scale,
      top: canvasHeight / 2 - 15 * scale,
      width: 200 * scale,
      fontSize: 24 * scale,
      fill: '#000000',
      fontFamily: 'Arial',
      lockUniScaling: false,
      lockScalingFlip: false,
      lockMovementX: false,
      lockMovementY: false,
      hasControls: true,
      hasBorders: true,
    });

    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    fabricCanvasRef.current.renderAll();
    setSelectedObject(text);
  };

  const processImage = (
    file: File,
    maxWidth: number,
    maxHeight: number,
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let imgWidth = img.width;
          let imgHeight = img.height;

          if (imgWidth > maxWidth || imgHeight > maxHeight) {
            const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
            imgWidth = imgWidth * ratio;
            imgHeight = imgHeight * ratio;
          }

          canvas.width = imgWidth;
          canvas.height = imgHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const addImage = async () => {
    if (!fabricCanvasRef.current || !fabric || !fabricLoaded) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        alert('Imagem muito grande. Por favor, escolha uma imagem menor que 10MB.');
        return;
      }

      setUploadingImage(true);

      try {
        // Processar imagem localmente primeiro (para preview)
        const processedDataUrl = await processImage(
          file,
          realWidth,
          realHeight,
        );

        // Fazer upload para R2 imediatamente
        const imageUrl = await uploadImageToR2(processedDataUrl, 'template');

        // Adicionar imagem ao canvas usando a URL do R2
        fabric.Image.fromURL(
          imageUrl,
          (img: any) => {
            const maxWidth = realWidth;
            const maxHeight = realHeight;
            const baseScale = Math.min(
              maxWidth / img.width!,
              maxHeight / img.height!,
              1,
            );

            const imgRealWidth = img.width! * baseScale;
            const imgRealHeight = img.height! * baseScale;
            const baseLeft = (realWidth - imgRealWidth) / 2;
            const baseTop = (realHeight - imgRealHeight) / 2;

            img.set({
              scaleX: previewMode ? baseScale * scale : baseScale,
              scaleY: previewMode ? baseScale * scale : baseScale,
              left: previewMode ? baseLeft * scale : baseLeft,
              top: previewMode ? baseTop * scale : baseTop,
            });

            // Salvar URL do R2 no objeto para serialização
            img.set('src', imageUrl);

            fabricCanvasRef.current!.add(img);
            fabricCanvasRef.current!.setActiveObject(img);
            fabricCanvasRef.current!.renderAll();
            setElements(fabricCanvasRef.current!.getObjects());
            setSelectedObject(img);
            setUploadingImage(false);
          },
          { crossOrigin: 'anonymous' },
        );
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Erro ao fazer upload da imagem. Por favor, tente novamente.');
        setUploadingImage(false);
      }
    };
    input.click();
  };

  const addLink = () => {
    if (!fabricCanvasRef.current || !fabric || !fabricLoaded) return;
    setShowLinkInput(true);
  };

  const confirmAddLink = () => {
    if (!fabricCanvasRef.current || !linkUrl.trim() || !fabric || !fabricLoaded)
      return;

    const baseWidth = 200;
    const baseFontSize = 18;
    const baseLeft = realWidth / 2 - baseWidth / 2;
    const baseTop = realHeight / 2 - baseFontSize / 2;

    const text = new fabric.Textbox(linkUrl, {
      left: previewMode ? baseLeft * scale : baseLeft,
      top: previewMode ? baseTop * scale : baseTop,
      width: previewMode ? baseWidth * scale : baseWidth,
      fontSize: previewMode ? baseFontSize * scale : baseFontSize,
      fill: '#0066CC',
      fontFamily: 'Arial',
      underline: true,
      lockUniScaling: false,
      lockScalingFlip: false,
      lockMovementX: false,
      lockMovementY: false,
      hasControls: true,
      hasBorders: true,
    });

    text.set('linkUrl', linkUrl);
    text.set('isLink', true);

    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    fabricCanvasRef.current.renderAll();
    setSelectedObject(text);
    setElements(fabricCanvasRef.current.getObjects());
    setLinkUrl('');
    setShowLinkInput(false);
  };

  const updateElementsList = () => {
    if (!fabricCanvasRef.current) return;
    // Obter objetos na ordem correta (do fundo para a frente)
    // No Fabric.js, objetos são renderizados na ordem do array
    // Primeiro objeto = fundo, último objeto = frente
    const objects = fabricCanvasRef.current.getObjects();
    setElements([...objects]);
  };

  const moveElementUp = (obj: any) => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    // Mover para frente (mais próximo do topo)
    obj.bringForward();
    canvas.renderAll();
    updateElementsList();
    if (saveCanvasStateRef.current) {
      saveCanvasStateRef.current();
    }
  };

  const moveElementDown = (obj: any) => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    // Mover para trás (mais próximo do fundo)
    obj.sendBackwards();
    canvas.renderAll();
    updateElementsList();
    if (saveCanvasStateRef.current) {
      saveCanvasStateRef.current();
    }
  };

  const moveElementToTop = (obj: any) => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    // Mover para o topo (último na lista)
    obj.bringToFront();
    canvas.renderAll();
    updateElementsList();
    if (saveCanvasStateRef.current) {
      saveCanvasStateRef.current();
    }
  };

  const moveElementToBottom = (obj: any) => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    // Mover para o fundo (primeiro na lista)
    obj.sendToBack();
    canvas.renderAll();
    updateElementsList();
    if (saveCanvasStateRef.current) {
      saveCanvasStateRef.current();
    }
  };

  const deleteSelected = async () => {
    if (!fabricCanvasRef.current || !selectedObject) return;

    // Se for uma imagem, deletar do R2
    if (selectedObject.type === 'image') {
      const customProps = selectedObject as any;
      let imageUrl: string | null = null;

      // Tentar obter URL do elemento da imagem
      if (customProps.getElement) {
        const imgElement = customProps.getElement();
        if (imgElement && imgElement.src && !imgElement.src.startsWith('data:image/')) {
          imageUrl = imgElement.src;
        }
      }

      // Tentar obter URL salva no objeto
      if (!imageUrl && customProps.src && !customProps.src.startsWith('data:image/')) {
        imageUrl = customProps.src;
      }

      // Deletar do R2 se for uma URL válida
      if (imageUrl) {
        await deleteImageFromR2(imageUrl);
      }
    }

    fabricCanvasRef.current.remove(selectedObject);
    fabricCanvasRef.current.renderAll();
    setSelectedObject(null);
    updateElementsList();
  };

  const updateBackground = (color: string) => {
    if (!fabricCanvasRef.current) return;

    fabricCanvasRef.current.setBackgroundColor(color, () => {
      fabricCanvasRef.current!.renderAll();
      onChange({
        ...template,
        background: color,
      });
    });
  };

  const updateDimensions = (newWidth: number, newHeight: number) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const oldScale = scale;

    if (previewMode) {
      // Em previewMode, recalcular o scale e atualizar o canvas visual
      // Os elementos mantêm seus tamanhos absolutos (não escalam)
      const newScale = Math.min(
        maxPreviewWidth / newWidth,
        maxPreviewHeight / newHeight,
      );
      const newCanvasWidth = newWidth * newScale;
      const newCanvasHeight = newHeight * newScale;

      // Atualizar posições dos objetos mantendo tamanhos absolutos
      canvas.getObjects().forEach((obj: any) => {
        // Obter coordenadas reais atuais (desescaladas do scale antigo)
        const currentRealLeft = (obj.left || 0) / oldScale;
        const currentRealTop = (obj.top || 0) / oldScale;
        const currentRealScaleX = (obj.scaleX || 1) / oldScale;
        const currentRealScaleY = (obj.scaleY || 1) / oldScale;

        // Manter os tamanhos absolutos (não escalar)
        // Apenas converter para o novo scale do canvas
        obj.set({
          left: currentRealLeft * newScale,
          top: currentRealTop * newScale,
          scaleX: currentRealScaleX * newScale,
          scaleY: currentRealScaleY * newScale,
        });
        obj.setCoords();
      });

      // Atualizar dimensões do canvas
      canvas.setWidth(newCanvasWidth);
      canvas.setHeight(newCanvasHeight);
      canvas.renderAll();
    } else {
      // Em modo normal, apenas atualizar dimensões do canvas
      // Os elementos mantêm seus tamanhos absolutos (não escalam)
      canvas.setWidth(newWidth);
      canvas.setHeight(newHeight);
      canvas.renderAll();
    }

    // Atualizar a referência das dimensões do template quando alteradas manualmente
    currentTemplateDimensionsRef.current = {
      width: newWidth,
      height: newHeight,
    };

    // Atualizar estado - isso vai disparar o useEffect que atualiza o canvas
    onChange({
      ...template,
      width: newWidth,
      height: newHeight,
    });
  };

  return (
    <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border rounded-lg">
      {/* Barra de Controles Superior */}
      <div className="p-4 border-b border-dark-border bg-dark-bg/30">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-dark-text whitespace-nowrap">
              Resolução:
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={realWidth}
                onChange={(e) =>
                  updateDimensions(parseInt(e.target.value) || 1080, realHeight)
                }
                min={100}
                max={4000}
                className="w-20 px-2 py-1 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Largura"
              />
              <span className="text-dark-muted">x</span>
              <input
                type="number"
                value={realHeight}
                onChange={(e) =>
                  updateDimensions(realWidth, parseInt(e.target.value) || 1080)
                }
                min={100}
                max={4000}
                className="w-20 px-2 py-1 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Altura"
              />
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => updateDimensions(1080, 1920)}
                className="px-2 py-1 text-xs bg-dark-bg/50 border border-dark-border rounded-md text-dark-text hover:bg-dark-bg transition-colors"
                title="Vertical (1080x1920)"
              >
                Vertical
              </button>
              <button
                type="button"
                onClick={() => updateDimensions(1080, 1080)}
                className="px-2 py-1 text-xs bg-dark-bg/50 border border-dark-border rounded-md text-dark-text hover:bg-dark-bg transition-colors"
                title="Quadrado (1080x1080)"
              >
                Quadrado
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-dark-text whitespace-nowrap">
              Fundo:
            </label>
            <input
              type="color"
              value={editingBackground ? tempBackground : background}
              onChange={(e) => {
                setTempBackground(e.target.value);
                if (!editingBackground) {
                  setEditingBackground(true);
                }
              }}
              onClick={(e) => {
                // Garantir que o seletor de cor apareça no lugar correto
                if (!editingBackground) {
                  setTempBackground(background);
                  setEditingBackground(true);
                }
              }}
              className="w-10 h-10 border border-dark-border rounded cursor-pointer"
              style={{
                // Garantir que o input de cor seja visível e posicionado corretamente
                position: 'relative',
                zIndex: 10,
              }}
              title="Selecionar cor do fundo"
            />
            <input
              type="text"
              value={editingBackground ? tempBackground : background}
              onChange={(e) => {
                setTempBackground(e.target.value);
                if (!editingBackground) {
                  setEditingBackground(true);
                }
              }}
              onFocus={() => {
                if (!editingBackground) {
                  setTempBackground(background);
                  setEditingBackground(true);
                }
              }}
              placeholder="#FFFFFF"
              className="w-24 px-2 py-1 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            {editingBackground && (
              <>
                <button
                  onClick={() => {
                    updateBackground(tempBackground);
                    setEditingBackground(false);
                  }}
                  className="px-3 py-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all text-sm font-medium"
                >
                  Aplicar
                </button>
                <button
                  onClick={() => {
                    setTempBackground(background);
                    setEditingBackground(false);
                  }}
                  className="px-3 py-1 border border-dark-border rounded-md text-dark-text hover:bg-dark-surface/50 transition-colors text-sm"
                >
                  Cancelar
                </button>
              </>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={addText}
              disabled={!fabricLoaded}
              className="px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Adicionar Texto"
            >
              📝 Texto
            </button>
            <button
              onClick={addImage}
              disabled={!fabricLoaded || uploadingImage}
              className="px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Adicionar Imagem"
            >
              {uploadingImage ? '⏳ Enviando...' : '🖼️ Imagem'}
            </button>
            <button
              onClick={addLink}
              disabled={!fabricLoaded}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-md hover:from-purple-600 hover:to-purple-700 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Adicionar Link"
            >
              🔗 Link
            </button>
            {selectedObject && (
              <button
                onClick={deleteSelected}
                className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md hover:from-red-600 hover:to-red-700 transition-all text-sm font-medium"
                title="Remover Elemento Selecionado"
              >
                🗑️ Remover
              </button>
            )}
          </div>
        </div>

        {!fabricLoaded && (
          <div className="mt-3 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded">
            <p className="text-xs text-yellow-400">
              ⏳ Aguardando carregamento do editor...
            </p>
          </div>
        )}

        {showLinkInput && (
          <div className="mt-3 p-3 bg-dark-bg/50 rounded-lg border border-dark-border">
            <label className="block text-sm font-medium text-dark-text mb-2">
              URL do Link
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://exemplo.com"
                className="flex-1 px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text placeholder-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                onClick={confirmAddLink}
                className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setShowLinkInput(false);
                  setLinkUrl('');
                }}
                className="px-4 py-2 bg-dark-border text-dark-text rounded-md hover:bg-dark-border/80 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Área Principal: Canvas e Painel de Propriedades */}
      <div className="flex gap-4 p-4">
        {/* Lista de Elementos */}
        <div className="w-64 p-4 bg-dark-bg/30 rounded-lg border border-dark-border flex-shrink-0">
          <h3 className="text-sm font-medium text-dark-text mb-3">Elementos</h3>
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {elements.length === 0 ? (
              <p className="text-xs text-dark-muted">Nenhum elemento adicionado</p>
            ) : (
              elements.map((obj: any, index) => {
                const objType = obj.type || 'unknown';
                const objText =
                  obj.type === 'textbox'
                    ? obj.text || obj.content || 'Texto'
                    : objType === 'image'
                      ? 'Imagem'
                      : 'Elemento';
                const isSelected = selectedObject === obj;

                return (
                  <div
                    key={index}
                    onClick={() => {
                      if (fabricCanvasRef.current) {
                        fabricCanvasRef.current.setActiveObject(obj);
                        fabricCanvasRef.current.renderAll();
                        setSelectedObject(obj);
                      }
                    }}
                    className={`p-2 rounded-md cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-purple-700/30 border border-primary-500'
                        : 'bg-dark-surface/50 border border-dark-border hover:bg-dark-surface/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-dark-text truncate">
                          {objType === 'textbox'
                            ? '📝'
                            : objType === 'image'
                              ? '🖼️'
                              : '🔗'}{' '}
                          {objText}
                        </p>
                        <p className="text-xs text-dark-muted">
                          {objType === 'textbox'
                            ? 'Texto'
                            : objType === 'image'
                              ? 'Imagem'
                              : 'Link'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Controles de ordem */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveElementToBottom(obj);
                          }}
                          disabled={index === 0}
                          className="p-1 text-dark-muted hover:text-dark-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para o fundo"
                        >
                          ⏬
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveElementDown(obj);
                          }}
                          disabled={index === 0}
                          className="p-1 text-dark-muted hover:text-dark-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para trás"
                        >
                          ⬇️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveElementUp(obj);
                          }}
                          disabled={index === elements.length - 1}
                          className="p-1 text-dark-muted hover:text-dark-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para frente"
                        >
                          ⬆️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveElementToTop(obj);
                          }}
                          disabled={index === elements.length - 1}
                          className="p-1 text-dark-muted hover:text-dark-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Mover para o topo"
                        >
                          ⏫
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (fabricCanvasRef.current) {
                              // Se for imagem, deletar do R2
                              if (obj.type === 'image') {
                                const customProps = obj as any;
                                let imageUrl: string | null = null;

                                if (customProps.getElement) {
                                  const imgElement = customProps.getElement();
                                  if (
                                    imgElement &&
                                    imgElement.src &&
                                    !imgElement.src.startsWith('data:image/')
                                  ) {
                                    imageUrl = imgElement.src;
                                  }
                                }

                                if (
                                  !imageUrl &&
                                  customProps.src &&
                                  !customProps.src.startsWith('data:image/')
                                ) {
                                  imageUrl = customProps.src;
                                }

                                if (imageUrl) {
                                  await deleteImageFromR2(imageUrl);
                                }
                              }

                              fabricCanvasRef.current.remove(obj);
                              if (selectedObject === obj) {
                                setSelectedObject(null);
                              }
                              fabricCanvasRef.current.renderAll();
                              updateElementsList();
                              if (saveCanvasStateRef.current) {
                                saveCanvasStateRef.current();
                              }
                            }
                          }}
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
                          title="Deletar elemento"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center">
          {!fabricLoaded ? (
            <div className="border border-dark-border rounded-lg p-8 bg-dark-bg/30 flex items-center justify-center min-h-[400px] w-full">
              <p className="text-dark-muted">Carregando editor...</p>
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: '80vh' }}>
              <div className="inline-block" style={{ backgroundColor: background }}>
                <canvas ref={canvasRef} style={{ display: 'block' }} />
              </div>
            </div>
          )}
        </div>

        {/* Painel de Propriedades - Sempre visível com dimensões fixas */}
        <div className="w-64 p-4 bg-dark-bg/30 rounded-lg border border-dark-border flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-dark-text">Propriedades</h3>
            {selectedObject && (
              <button
                onClick={() => {
                  if (fabricCanvasRef.current) {
                    fabricCanvasRef.current.discardActiveObject();
                    fabricCanvasRef.current.renderAll();
                  }
                  setSelectedObject(null);
                }}
                className="text-dark-muted hover:text-dark-text text-sm"
              >
                ✕
              </button>
            )}
          </div>

          {selectedObject ? (
            <>
              {selectedObject.type === 'textbox' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-dark-muted mb-1">
                      Tamanho da Fonte
                    </label>
                    <input
                      type="number"
                      value={Math.round(
                        (selectedObject.fontSize || 24) * 
                        (Math.min(selectedObject.scaleX || 1, selectedObject.scaleY || 1))
                      )}
                      onChange={(e) => {
                        e.stopPropagation();
                        // O valor digitado é o valor visual (já considerando scale)
                        const visualFontSize = parseInt(e.target.value) || 24;
                        
                        // Em previewMode, precisamos converter para o valor real
                        // O valor visual = valor real * scale
                        // Então: valor real = valor visual / scale
                        const realFontSize = previewMode && scale !== 1
                          ? visualFontSize / scale
                          : visualFontSize;
                        
                        // Em previewMode, o fontSize do canvas precisa ser escalado
                        const canvasFontSize = previewMode && scale !== 1
                          ? realFontSize * scale
                          : realFontSize;
                        
                        if (fabricCanvasRef.current && selectedObject) {
                          const activeObject =
                            fabricCanvasRef.current.getActiveObject();
                          const objToUpdate =
                            activeObject === selectedObject ? activeObject : selectedObject;

                          if (objToUpdate) {
                            // Atualizar fontSize no canvas (escalado se previewMode) e resetar scale
                            objToUpdate.set({
                              fontSize: canvasFontSize,
                              scaleX: 1,
                              scaleY: 1,
                            });
                            // Armazenar fontSize REAL (não escalado) para uso futuro
                            (objToUpdate as any).__baseFontSize = realFontSize;
                            objToUpdate.setCoords();
                            
                            if (activeObject !== objToUpdate) {
                              fabricCanvasRef.current.setActiveObject(objToUpdate);
                            }
                            // Criar nova referência para forçar atualização do React
                            setSelectedObject({ ...objToUpdate });
                            fabricCanvasRef.current.renderAll();
                            if (saveCanvasStateRef.current) {
                              saveCanvasStateRef.current();
                            }
                          }
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      min={8}
                      max={200}
                      className="w-full px-2 py-1 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-muted mb-1">
                      Cor do Texto
                    </label>
                    <input
                      type="color"
                      value={(selectedObject.fill as string) || '#000000'}
                      onChange={(e) => {
                        const newFill = e.target.value;
                        selectedObject.set('fill', newFill);
                        setSelectedObject({ ...selectedObject, fill: newFill });
                        fabricCanvasRef.current?.renderAll();
                        if (saveCanvasStateRef.current) {
                          saveCanvasStateRef.current();
                        }
                      }}
                      className="w-full h-10 bg-dark-bg/50 border border-dark-border rounded-md"
                    />
                  </div>
                  {(selectedObject as any).isLink && (
                    <div>
                      <label className="block text-xs text-dark-muted mb-1">
                        URL do Link
                      </label>
                      <input
                        type="url"
                        value={(selectedObject as any).linkUrl || ''}
                        onChange={(e) => {
                          selectedObject.set('linkUrl', e.target.value);
                          selectedObject.set('text', e.target.value);
                          fabricCanvasRef.current?.renderAll();
                        }}
                        className="w-full px-2 py-1 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm placeholder-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedObject.type === 'image' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-dark-muted mb-1">Opacidade</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={selectedObject.opacity || 1}
                      onChange={(e) => {
                        const newOpacity = parseFloat(e.target.value);
                        selectedObject.set('opacity', newOpacity);
                        setSelectedObject({ ...selectedObject, opacity: newOpacity });
                        fabricCanvasRef.current?.renderAll();
                        if (saveCanvasStateRef.current) {
                          saveCanvasStateRef.current();
                        }
                      }}
                      className="w-full"
                    />
                    <span className="text-xs text-dark-muted">
                      {(selectedObject.opacity || 1) * 100}%
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-dark-muted text-center">
                Selecione um elemento para editar suas propriedades
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
