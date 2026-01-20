'use client';

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

interface TemplateOverlayEditorProps {
  template: {
    background?: string;
    width?: number;
    height?: number;
    elements?: any;
  };
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
  onChange: (overlayImage: {
    url: string;
    left: number;
    top: number;
    width: number;
    height: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
  } | null) => void;
  onGenerateImage: (imageDataUrl: string) => void;
  maxPreviewWidth?: number;
  maxPreviewHeight?: number;
}

export default function TemplateOverlayEditor({
  template,
  overlayImage,
  onChange,
  onGenerateImage,
  maxPreviewWidth = 400,
  maxPreviewHeight = 600,
}: TemplateOverlayEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const [fabricLoaded, setFabricLoaded] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Full HD: 1920x1080 (largura x altura)
  const realWidth = template.width || 1920;
  const realHeight = template.height || 1080;
  const background = template.background || '#FFFFFF';

  // Calcular escala para preview
  const scale = Math.min(maxPreviewWidth / realWidth, maxPreviewHeight / realHeight);
  const canvasWidth = realWidth * scale;
  const canvasHeight = realHeight * scale;

  // Carregar Fabric.js
  useEffect(() => {
    loadFabric().then(() => {
      setFabricLoaded(true);
    });
  }, []);

  // Inicializar canvas e carregar template + imagem sobreposta
  useEffect(() => {
    if (!canvasRef.current || !fabricLoaded || !fabric) return;

    // Limpar canvas anterior
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    // Criar canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: background,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;

    // Configurar Textbox
    if (fabric.Textbox) {
      fabric.Textbox.prototype.lockUniScaling = false;
      fabric.Textbox.prototype.lockScalingFlip = false;
    }

    // Carregar background
    canvas.setBackgroundColor(background, () => {
      canvas.renderAll();
    });

    // Carregar elementos do template
    let elements = template.elements;
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

    if (elements && Array.isArray(elements) && elements.length > 0) {
      // Rastrear posições para inserir elementos na ordem correta
      let currentPosition = 0;
      const loadPromises: Promise<void>[] = [];
      
      elements.forEach((elementData: any, originalIndex: number) => {
        try {
          if (elementData.type === 'textbox' || elementData.type === 'i-text' || elementData.type === 'text') {
            const textContent = elementData.text || elementData.content || '';
            const baseLeft = elementData.left !== undefined ? elementData.left : (elementData.position?.x || 0);
            const baseTop = elementData.top !== undefined ? elementData.top : (elementData.position?.y || 0);
            const baseWidth = elementData.width || 200;
            const baseFontSize = elementData.fontSize || 24;
            const fill = elementData.fill || elementData.color || '#000000';

            const obj = new fabric.Textbox(textContent, {
              left: baseLeft * scale,
              top: baseTop * scale,
              width: baseWidth * scale,
              fontSize: baseFontSize * scale,
              fill: fill,
              fontFamily: elementData.fontFamily || 'Arial',
              lockUniScaling: false,
              lockScalingFlip: false,
              evented: false,
              selectable: false,
              hoverCursor: 'default',
              moveCursor: 'default',
            });

            if (elementData.scaleX !== undefined && elementData.scaleX !== 1) {
              obj.set('scaleX', elementData.scaleX * scale);
            }
            if (elementData.scaleY !== undefined && elementData.scaleY !== 1) {
              obj.set('scaleY', elementData.scaleY * scale);
            }
            if (elementData.angle !== undefined) obj.set('angle', elementData.angle);
            if (elementData.opacity !== undefined) obj.set('opacity', elementData.opacity);

            // Inserir na posição correta para preservar ordem
            canvas.insertAt(obj, currentPosition);
            currentPosition++;
          } else if (elementData.type === 'image') {
            const imageSrc = elementData.src || elementData.url;
            if (imageSrc) {
              const imagePosition = currentPosition;
              currentPosition++;
              
              const imagePromise = new Promise<void>((resolve, reject) => {
                fabric.Image.fromURL(imageSrc, (img: any) => {
                  try {
                    const baseLeft = elementData.left || 0;
                    const baseTop = elementData.top || 0;
                    const baseScaleX = elementData.scaleX || 1;
                    const baseScaleY = elementData.scaleY || 1;

                    img.set({
                      left: baseLeft * scale,
                      top: baseTop * scale,
                      scaleX: baseScaleX * scale,
                      scaleY: baseScaleY * scale,
                      evented: false,
                      selectable: false,
                      hoverCursor: 'default',
                      moveCursor: 'default',
                    });
                    if (elementData.opacity !== undefined) img.set('opacity', elementData.opacity);
                    
                    // Inserir na posição correta para preservar ordem
                    canvas.insertAt(img, imagePosition);
                    resolve();
                  } catch (error) {
                    console.error('Error loading image element:', error, elementData);
                    reject(error);
                  }
                }, { crossOrigin: 'anonymous' });
              });
              
              loadPromises.push(imagePromise);
            }
          }
        } catch (error) {
          console.error('Error loading element:', error);
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
      } else {
        canvas.renderAll();
      }
    }

    // Carregar imagem sobreposta se existir
    if (overlayImage && overlayImage.url) {
      fabric.Image.fromURL(overlayImage.url, (img: any) => {
        // Converter coordenadas reais para coordenadas escaladas
        const scaledLeft = overlayImage.left * scale;
        const scaledTop = overlayImage.top * scale;
        const scaledWidth = overlayImage.width * scale;
        const scaledHeight = overlayImage.height * scale;

        // Calcular escala baseada na largura/altura desejada
        const imgElement = img.getElement();
        const naturalWidth = imgElement.width;
        const naturalHeight = imgElement.height;
        const scaleX = scaledWidth / naturalWidth;
        const scaleY = scaledHeight / naturalHeight;

        img.set({
          left: scaledLeft,
          top: scaledTop,
          scaleX: (overlayImage.scaleX || 1) * scaleX,
          scaleY: (overlayImage.scaleY || 1) * scaleY,
          angle: overlayImage.angle || 0,
          evented: true,
          selectable: true,
          hasControls: true,
          hasBorders: true,
        });

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();

        // Listener para mudanças na imagem sobreposta
        img.on('modified', () => {
          const obj = img;
          const currentLeft = obj.left || 0;
          const currentTop = obj.top || 0;
          const currentScaleX = obj.scaleX || 1;
          const currentScaleY = obj.scaleY || 1;
          const currentAngle = obj.angle || 0;

          // Converter de volta para coordenadas reais
          const realLeft = currentLeft / scale;
          const realTop = currentTop / scale;
          
          // Calcular largura/altura reais
          const realWidth = (naturalWidth * currentScaleX) / scale;
          const realHeight = (naturalHeight * currentScaleY) / scale;

          // Calcular scaleX e scaleY relativos
          const baseScaleX = realWidth / naturalWidth;
          const baseScaleY = realHeight / naturalHeight;

          onChange({
            url: overlayImage.url,
            left: realLeft,
            top: realTop,
            width: realWidth,
            height: realHeight,
            scaleX: baseScaleX,
            scaleY: baseScaleY,
            angle: currentAngle,
          });
        });
      }, { crossOrigin: 'anonymous' });
    }

    canvas.renderAll();

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [template, overlayImage, fabricLoaded, scale, canvasWidth, canvasHeight, background, onChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Imagem muito grande. Por favor, escolha uma imagem menor que 10MB.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      
      // Adicionar imagem ao canvas
      if (fabricCanvasRef.current && fabric) {
        fabric.Image.fromURL(result, (img: any) => {
          const canvas = fabricCanvasRef.current;
          
          // Posicionar no centro do canvas
          const imgElement = img.getElement();
          const naturalWidth = imgElement.width;
          const naturalHeight = imgElement.height;
          
          // Calcular posição central (em coordenadas escaladas)
          // Começar com 30% do tamanho natural da imagem
          const initialWidth = naturalWidth * 0.3;
          const initialHeight = naturalHeight * 0.3;
          
          // Escalar para o preview
          const scaledWidth = initialWidth * scale;
          const scaledHeight = initialHeight * scale;
          
          // Calcular posição central
          const centerX = (canvasWidth / 2) - (scaledWidth / 2);
          const centerY = (canvasHeight / 2) - (scaledHeight / 2);
          
          // Calcular escala do Fabric.js (baseada no tamanho natural)
          const fabricScaleX = scaledWidth / naturalWidth;
          const fabricScaleY = scaledHeight / naturalHeight;
          
          img.set({
            left: centerX,
            top: centerY,
            scaleX: fabricScaleX,
            scaleY: fabricScaleY,
            evented: true,
            selectable: true,
            hasControls: true,
            hasBorders: true,
          });

          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();

          // Converter para coordenadas reais
          const realLeft = centerX / scale;
          const realTop = centerY / scale;
          const realWidth = initialWidth; // Já está em coordenadas reais
          const realHeight = initialHeight; // Já está em coordenadas reais

          onChange({
            url: result,
            left: realLeft,
            top: realTop,
            width: realWidth,
            height: realHeight,
            scaleX: 0.3, // 30% do tamanho natural
            scaleY: 0.3, // 30% do tamanho natural
            angle: 0,
          });

          // Listener para mudanças
          img.on('modified', () => {
            const obj = img;
            const currentLeft = obj.left || 0;
            const currentTop = obj.top || 0;
            const currentScaleX = obj.scaleX || 1;
            const currentScaleY = obj.scaleY || 1;
            const currentAngle = obj.angle || 0;

            const realLeft = currentLeft / scale;
            const realTop = currentTop / scale;
            const realWidth = (naturalWidth * currentScaleX) / scale;
            const realHeight = (naturalHeight * currentScaleY) / scale;
            const baseScaleX = realWidth / naturalWidth;
            const baseScaleY = realHeight / naturalHeight;

            onChange({
              url: result,
              left: realLeft,
              top: realTop,
              width: realWidth,
              height: realHeight,
              scaleX: baseScaleX,
              scaleY: baseScaleY,
              angle: currentAngle,
            });
          });
        }, { crossOrigin: 'anonymous' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveOverlay = () => {
    if (fabricCanvasRef.current) {
      const canvas = fabricCanvasRef.current;
      const objects = canvas.getObjects();
      
      // Remover todas as imagens selecionáveis (que são as sobrepostas)
      // As imagens do template não são selecionáveis
      const overlayImgs = objects.filter((obj: any) => obj.selectable && obj.type === 'image');
      overlayImgs.forEach((img: any) => {
        canvas.remove(img);
      });
      canvas.renderAll();
    }
    
    setImagePreview(null);
    setSelectedFile(null);
    onChange(null);
  };

  const handleGenerateImage = async () => {
    if (!fabricCanvasRef.current || !fabric) return;

    const canvas = fabricCanvasRef.current;
    
    // Criar um canvas temporário com dimensões reais
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = realWidth;
    tempCanvas.height = realHeight;
    const tempFabricCanvas = new fabric.Canvas(tempCanvas, {
      width: realWidth,
      height: realHeight,
      backgroundColor: background,
    });

    // Carregar background
    tempFabricCanvas.setBackgroundColor(background, () => {
      // Carregar elementos do template em tamanho real
      let elements = template.elements;
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

      if (elements && Array.isArray(elements)) {
        elements.forEach((elementData: any) => {
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
            });

            if (elementData.scaleX !== undefined) obj.set('scaleX', elementData.scaleX);
            if (elementData.scaleY !== undefined) obj.set('scaleY', elementData.scaleY);
            if (elementData.angle !== undefined) obj.set('angle', elementData.angle);
            if (elementData.opacity !== undefined) obj.set('opacity', elementData.opacity);

            tempFabricCanvas.add(obj);
          } else if (elementData.type === 'image') {
            const imageSrc = elementData.src || elementData.url;
            if (imageSrc) {
              const promise = new Promise<void>((resolve) => {
                fabric.Image.fromURL(imageSrc, (img: any) => {
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
                  tempFabricCanvas.add(img);
                  resolve();
                }, { crossOrigin: 'anonymous' });
              });
              loadPromises.push(promise);
            }
          }
        });
      }

      // Carregar imagem sobreposta em tamanho real
      if (overlayImage && overlayImage.url) {
        const promise = new Promise<void>((resolve) => {
          fabric.Image.fromURL(overlayImage.url, (img: any) => {
            const imgElement = img.getElement();
            const naturalWidth = imgElement.width;
            const naturalHeight = imgElement.height;
            
            // Calcular escala baseada nas dimensões desejadas
            const scaleX = overlayImage.width / naturalWidth;
            const scaleY = overlayImage.height / naturalHeight;

            img.set({
              left: overlayImage.left,
              top: overlayImage.top,
              scaleX: (overlayImage.scaleX || 1) * scaleX,
              scaleY: (overlayImage.scaleY || 1) * scaleY,
              angle: overlayImage.angle || 0,
            });

            tempFabricCanvas.add(img);
            resolve();
          }, { crossOrigin: 'anonymous' });
        });
        loadPromises.push(promise);
      }

      // Aguardar todas as imagens carregarem
      Promise.all(loadPromises).then(() => {
        tempFabricCanvas.renderAll();
        
        // Gerar data URL em Full HD (1920x1080)
        // Usar multiplicador para garantir alta qualidade
        const multiplier = 1; // 1 = resolução nativa Full HD
        const dataUrl = tempFabricCanvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: multiplier, // Garante exportação na resolução correta
        });
        
        onGenerateImage(dataUrl);
        
        // Limpar canvas temporário
        tempFabricCanvas.dispose();
      });
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-dark-text">Imagem Sobreposta</h4>
        {overlayImage && (
          <button
            type="button"
            onClick={handleRemoveOverlay}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Remover
          </button>
        )}
      </div>

      {!overlayImage && (
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-500 file:text-white hover:file:bg-primary-600 file:cursor-pointer cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-dark-muted">
            Selecione uma imagem para sobrepor ao template. Você poderá redimensionar e posicionar após o upload.
          </p>
        </div>
      )}

      {fabricLoaded ? (
        <div className="border border-dark-border rounded-lg overflow-hidden bg-dark-bg/30">
          <div className="flex items-center justify-center overflow-auto" style={{ maxHeight: '600px' }}>
            <div className="inline-block" style={{ backgroundColor: background }}>
              <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-dark-border rounded-lg p-8 bg-dark-bg/30 flex items-center justify-center min-h-[400px]">
          <p className="text-dark-muted">Carregando editor...</p>
        </div>
      )}

      {overlayImage && (
        <div className="space-y-2">
          <p className="text-xs text-dark-muted">
            💡 Arraste a imagem para reposicionar. Use as alças para redimensionar.
          </p>
          <button
            type="button"
            onClick={handleGenerateImage}
            className="w-full px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-md hover:from-primary-600 hover:to-primary-700 transition-all text-sm font-medium"
          >
            Gerar Imagem Final
          </button>
        </div>
      )}
    </div>
  );
}

