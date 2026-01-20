'use client';

import { useEffect } from 'react';

/**
 * Componente que garante que atalhos de teclado padrão funcionem corretamente
 * especialmente Ctrl+A (ou Cmd+A no Mac) para selecionar todo o texto em inputs
 */
export default function KeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Permitir Ctrl+A (ou Cmd+A no Mac) em inputs e textareas
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const target = e.target as HTMLElement;
        
        // Se o foco está em um input ou textarea
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          const input = target as HTMLInputElement | HTMLTextAreaElement;
          
          // Usar setTimeout para garantir que seja executado após outros listeners
          // Isso permite que o comportamento padrão funcione mesmo se outros listeners
          // tentarem prevenir
          setTimeout(() => {
            // Verificar se o input ainda está focado
            if (document.activeElement === input) {
              // Selecionar todo o texto
              input.select();
            }
          }, 0);
        }
      }
    };

    // Adicionar listener no documento na fase de captura
    // Use capture: true para garantir que seja executado antes de outros handlers
    document.addEventListener('keydown', handleKeyDown, true);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  return null; // Este componente não renderiza nada
}

