'use client';

import { useState, useRef, useEffect } from 'react';

interface TemplateEditorProps {
  template: {
    background?: string;
    elements?: any[];
  };
  onChange: (template: any) => void;
}

export default function TemplateEditor({ template, onChange }: TemplateEditorProps) {
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const elements = template.elements || [];

  useEffect(() => {
    drawCanvas();
  }, [template]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpar canvas
    ctx.fillStyle = template.background || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Desenhar elementos
    elements.forEach((element, index) => {
      if (element.type === 'text') {
        ctx.fillStyle = element.color || '#000000';
        ctx.font = `${element.fontSize || 24}px Arial`;
        ctx.fillText(element.content || '', element.position?.x || 0, element.position?.y || 0);
      }
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Verificar se clicou em um elemento existente
    const clickedElement = elements.findIndex((el) => {
      if (el.type === 'text') {
        const textWidth = 200; // Aproximação
        const textHeight = el.fontSize || 24;
        return (
          x >= el.position.x &&
          x <= el.position.x + textWidth &&
          y >= el.position.y - textHeight &&
          y <= el.position.y
        );
      }
      return false;
    });

    if (clickedElement !== -1) {
      setSelectedElement(clickedElement);
    } else {
      // Criar novo elemento de texto
      setShowTextInput(true);
      setSelectedElement(elements.length);
    }
  };

  const handleAddText = (text: string) => {
    if (!text.trim()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const newElement = {
      type: 'text',
      content: text,
      position: { x: 50, y: 50 },
      fontSize: 24,
      color: '#000000',
    };

    const newElements = [...elements, newElement];
    onChange({
      ...template,
      elements: newElements,
    });

    setShowTextInput(false);
    setSelectedElement(newElements.length - 1);
  };

  const handleUpdateElement = (index: number, updates: any) => {
    const newElements = [...elements];
    newElements[index] = { ...newElements[index], ...updates };
    onChange({
      ...template,
      elements: newElements,
    });
  };

  const handleDeleteElement = (index: number) => {
    const newElements = elements.filter((_, i) => i !== index);
    onChange({
      ...template,
      elements: newElements,
    });
    setSelectedElement(null);
  };

  return (
    <div className="bg-gradient-to-br from-dark-surface via-purple-900/30 to-dark-surface border border-dark-border shadow-xl rounded-lg p-6">
      <div className="mb-4">
        <label className="block text-sm font-medium text-dark-text mb-2">
          Cor de Fundo
        </label>
        <div className="flex items-center space-x-4">
          <div
            className="w-16 h-16 border border-dark-border rounded cursor-pointer"
            style={{ backgroundColor: template.background || '#FFFFFF' }}
            onClick={() => setShowColorPicker(!showColorPicker)}
          />
          {showColorPicker && (
            <div className="absolute z-10">
              <input
                type="color"
                value={template.background || '#FFFFFF'}
                onChange={(e) => {
                  onChange({
                    ...template,
                    background: e.target.value,
                  });
                }}
                className="h-10 w-20"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-medium text-dark-text mb-2">Canvas</h3>
        <div className="border border-dark-border rounded-lg p-4 bg-dark-bg/30">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="border border-dark-border bg-white cursor-crosshair"
            onClick={handleCanvasClick}
          />
        </div>
      </div>

      {showTextInput && (
        <div className="mb-4 p-4 bg-dark-bg/30 rounded-lg border border-dark-border">
          <input
            type="text"
            placeholder="Digite o texto"
            className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text placeholder-dark-muted/50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddText(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
            autoFocus
          />
        </div>
      )}

      {selectedElement !== null && elements[selectedElement] && (
        <div className="mt-4 p-4 bg-dark-bg/30 rounded-lg space-y-4 border border-dark-border">
          <h3 className="font-medium text-dark-text">Editar Elemento</h3>

          {elements[selectedElement].type === 'text' && (
            <>
              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Texto
                </label>
                <input
                  type="text"
                  value={elements[selectedElement].content || ''}
                  onChange={(e) =>
                    handleUpdateElement(selectedElement, { content: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Tamanho da Fonte
                </label>
                <input
                  type="number"
                  value={elements[selectedElement].fontSize || 24}
                  onChange={(e) =>
                    handleUpdateElement(selectedElement, {
                      fontSize: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-text mb-1">
                  Cor
                </label>
                <div className="flex items-center space-x-4">
                  <div
                    className="w-12 h-12 border border-dark-border rounded cursor-pointer"
                    style={{
                      backgroundColor: elements[selectedElement].color || '#000000',
                    }}
                    onClick={() => setShowColorPicker(!showColorPicker)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Posição X
                  </label>
                  <input
                    type="number"
                    value={elements[selectedElement].position?.x || 0}
                    onChange={(e) =>
                      handleUpdateElement(selectedElement, {
                        position: {
                          ...elements[selectedElement].position,
                          x: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-1">
                    Posição Y
                  </label>
                  <input
                    type="number"
                    value={elements[selectedElement].position?.y || 0}
                    onChange={(e) =>
                      handleUpdateElement(selectedElement, {
                        position: {
                          ...elements[selectedElement].position,
                          y: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <button
                onClick={() => handleDeleteElement(selectedElement)}
                className="w-full mt-4 bg-gradient-to-r from-red-500 to-red-600 text-white py-2 px-4 rounded-md hover:from-red-600 hover:to-red-700 transition-all"
              >
                Remover Elemento
              </button>
            </>
          )}
        </div>
      )}

      {showColorPicker && selectedElement !== null && (
        <div className="absolute z-10 mt-2">
          <input
            type="color"
            value={elements[selectedElement]?.color || '#000000'}
            onChange={(e) => {
              handleUpdateElement(selectedElement, { color: e.target.value });
            }}
            className="h-10 w-20"
          />
        </div>
      )}
    </div>
  );
}

