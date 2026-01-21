'use client';

import { useEffect, useRef, useState } from 'react';

interface TextFormattingToolbarProps {
  textareaId?: string;
  onFormat: (formattedText: string) => void;
  value: string;
}

export default function TextFormattingToolbar({
  textareaId,
  onFormat,
  value,
}: TextFormattingToolbarProps) {
  const [selection, setSelection] = useState<{
    start: number;
    end: number;
    text: string;
  } | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const textarea = textareaId
      ? document.getElementById(textareaId) as HTMLTextAreaElement | null
      : document.querySelector('textarea[data-formatting-toolbar]') as HTMLTextAreaElement | null;

    if (!textarea) return;

    const handleSelection = () => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value.substring(start, end);

      if (start !== end && text.trim().length > 0) {
        setSelection({ start, end, text });
        
        // Calcular posição da toolbar acima do texto selecionado
        const textBeforeSelection = textarea.value.substring(0, start);
        const lines = textBeforeSelection.split('\n');
        const lineNumber = lines.length - 1;
        const lineHeight = 24; // Altura aproximada de uma linha
        const padding = 8;
        
        // Posicionar acima do texto selecionado
        const top = Math.max(0, lineNumber * lineHeight - 50);
        const left = textarea.offsetLeft + textarea.offsetWidth - 200; // Alinhar à direita
        
        setPosition({ top, left });
      } else {
        setSelection(null);
        setPosition(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Se clicar fora do textarea, esconder toolbar
      if (!textarea.contains(e.target as Node) && !toolbarRef.current?.contains(e.target as Node)) {
        setSelection(null);
        setPosition(null);
      }
    };

    textarea.addEventListener('mouseup', handleSelection);
    textarea.addEventListener('keyup', handleSelection);
    textarea.addEventListener('select', handleSelection);
    document.addEventListener('click', handleClick);

    return () => {
      textarea.removeEventListener('mouseup', handleSelection);
      textarea.removeEventListener('keyup', handleSelection);
      textarea.removeEventListener('select', handleSelection);
      document.removeEventListener('click', handleClick);
    };
  }, [textareaId, value]);

  const applyFormat = (tag: string, closingTag: string) => {
    if (!selection) return;

    const textarea = textareaId
      ? document.getElementById(textareaId) as HTMLTextAreaElement | null
      : document.querySelector('textarea[data-formatting-toolbar]') as HTMLTextAreaElement | null;

    if (!textarea) return;

    const { start, end, text } = selection;
    const formattedText = `${tag}${text}${closingTag}`;

    // Criar novo valor com o texto formatado
    const newValue =
      value.substring(0, start) + formattedText + value.substring(end);

    // Atualizar o valor
    onFormat(newValue);

    // Restaurar seleção após um pequeno delay
    setTimeout(() => {
      const newStart = start + tag.length;
      const newEnd = newStart + text.length;
      textarea.setSelectionRange(newStart, newEnd);
      textarea.focus();
    }, 0);
  };

  const formatButtons = [
    {
      label: 'Bold',
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"
          />
        </svg>
      ),
      onClick: () => applyFormat('<b>', '</b>'),
    },
    {
      label: 'Italic',
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 4h4M9 20h4M12 4v16"
          />
        </svg>
      ),
      onClick: () => applyFormat('<i>', '</i>'),
    },
    {
      label: 'Underline',
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 19h14M5 5h14M5 12h14"
          />
        </svg>
      ),
      onClick: () => applyFormat('<u>', '</u>'),
    },
    {
      label: 'Strikethrough',
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 12h14"
          />
        </svg>
      ),
      onClick: () => applyFormat('<s>', '</s>'),
    },
    {
      label: 'Code',
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      ),
      onClick: () => applyFormat('<code>', '</code>'),
    },
  ];

  if (!selection || !position) {
    return null;
  }

  return (
    <div
      ref={toolbarRef}
      className="absolute bg-dark-surface border border-dark-border rounded-md shadow-lg p-2 flex gap-1 z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {formatButtons.map((button, index) => (
        <button
          key={index}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            button.onClick();
          }}
          className="p-2 hover:bg-dark-bg/50 rounded transition-colors text-dark-text"
          title={button.label}
        >
          {button.icon}
        </button>
      ))}
    </div>
  );
}

