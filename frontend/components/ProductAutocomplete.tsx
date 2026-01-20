'use client';

import api from '@/lib/api';
import { useEffect, useState, useRef, useLayoutEffect } from 'react';

interface Product {
  id: string;
  name: string;
  channelId?: string;
  category?: {
    id: string;
    name: string;
  };
  subcategory?: {
    id: string;
    name: string;
  };
}

interface ProductAutocompleteProps {
  value: Product[];
  onChange: (products: Product[]) => void;
  placeholder?: string;
  channelIds?: string[]; // IDs dos canais para filtrar produtos
}

export default function ProductAutocomplete({
  value,
  onChange,
  placeholder = 'Digite o nome do produto...',
  channelIds,
}: ProductAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const shouldMaintainFocusRef = useRef(false);

  // Manter foco após atualizações de estado
  useLayoutEffect(() => {
    if (shouldMaintainFocusRef.current && inputRef.current) {
      // Forçar foco de forma mais agressiva
      inputRef.current.focus();
      shouldMaintainFocusRef.current = false;
    }
  });

  useEffect(() => {
    const searchProducts = async () => {
      // Pesquisar apenas se tiver 3 ou mais caracteres
      if (searchTerm.trim().length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      // Salvar se o input estava focado antes da busca
      const wasFocused = document.activeElement === inputRef.current;

      setIsLoading(true);
      try {
        let url = `/products?search=${encodeURIComponent(searchTerm)}`;
        // Se channelIds for fornecido, adicionar como query param
        if (channelIds && channelIds.length > 0) {
          url += `&channelIds=${channelIds.join(',')}`;
        }
        const response = await api.get(url);
        const results = response.data || [];
        setSuggestions(results);
        // Mostrar sugestões apenas se houver resultados
        setShowSuggestions(results.length > 0);
        // Resetar índice destacado quando novas sugestões chegam
        setHighlightedIndex(-1);
        
        // Marcar para manter foco após o re-render
        if (wasFocused) {
          shouldMaintainFocusRef.current = true;
        }
      } catch (error) {
        console.error('Error searching products:', error);
        setSuggestions([]);
        setShowSuggestions(false);
        
        // Marcar para manter foco mesmo em caso de erro
        if (wasFocused) {
          shouldMaintainFocusRef.current = true;
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Se tiver menos de 3 caracteres, limpar sugestões
    if (searchTerm.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Se tiver exatamente 3 caracteres, buscar imediatamente
    // Caso contrário, pesquisar após 2 segundos de inatividade
    const delay = searchTerm.trim().length === 3 ? 0 : 2000;
    const timeoutId = setTimeout(searchProducts, delay);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSelectProduct = async (product: Product) => {
    // Verificar se já está selecionado
    if (value.some((p) => p.id === product.id)) {
      setSearchTerm('');
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      // Marcar para manter foco após o re-render
      shouldMaintainFocusRef.current = true;
      return;
    }

    // Adicionar à lista
    onChange([...value, product]);
    setSearchTerm('');
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    // Marcar para manter foco após o re-render
    shouldMaintainFocusRef.current = true;
  };

  const handleAddProduct = async () => {
    if (!searchTerm.trim()) return;

    // Verificar se já existe nas sugestões
    const existing = suggestions.find(
      (p) => p.name.toLowerCase() === searchTerm.trim().toLowerCase(),
    );

    if (existing) {
      // Se já existe, apenas selecionar (não retornar erro)
      handleSelectProduct(existing);
      return;
    }

    // Verificar se já está selecionado
    const alreadySelected = value.find(
      (p) => p.name.toLowerCase() === searchTerm.trim().toLowerCase(),
    );

    if (alreadySelected) {
      // Se já está selecionado, apenas limpar o campo
      setSearchTerm('');
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      // Marcar para manter foco após o re-render
      shouldMaintainFocusRef.current = true;
      return;
    }

    // Criar novo Product ou buscar existente
    setIsLoading(true);
    try {
      // Tentar buscar primeiro (pode existir mas não estar nas sugestões)
      try {
        const searchResponse = await api.get(
          `/products?search=${encodeURIComponent(searchTerm.trim())}`,
        );
        const found = searchResponse.data?.find(
          (p: Product) => p.name.toLowerCase() === searchTerm.trim().toLowerCase(),
        );
        if (found) {
          handleSelectProduct(found);
          setIsLoading(false);
          return;
        }
      } catch (searchError) {
        // Se não encontrou, continuar para criar
      }

      // Criar novo Product
      // Se channelIds for fornecido, usar o primeiro como channelId obrigatório
      if (!channelIds || channelIds.length === 0) {
        console.error('Cannot create product: channelId is required');
        setIsLoading(false);
        return;
      }

      const response = await api.post('/products', {
        name: searchTerm.trim(),
        channelId: channelIds[0], // Usar o primeiro channelId do array
        isActive: true,
      });
      onChange([...value, response.data]);
      setSearchTerm('');
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      // Marcar para manter foco após o re-render
      shouldMaintainFocusRef.current = true;
    } catch (error: any) {
      console.error('Error creating product:', error);
      // Não mostrar erro ao usuário, apenas logar
      // Marcar para manter foco mesmo em caso de erro
      shouldMaintainFocusRef.current = true;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveProduct = (productId: string) => {
    onChange(value.filter((p) => p.id !== productId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setHighlightedIndex((prev) => {
          const next = prev < suggestions.length - 1 ? prev + 1 : prev;
          return next;
        });
        setShowSuggestions(true);
      }
      // Manter foco no input
      inputRef.current?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0) {
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : -1;
          return next;
        });
        setShowSuggestions(true);
      }
      // Manter foco no input
      inputRef.current?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Marcar para manter foco antes de qualquer ação
      shouldMaintainFocusRef.current = true;
      // Se houver um item destacado, selecioná-lo
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        const highlightedProduct = suggestions[highlightedIndex];
        if (!value.some((p) => p.id === highlightedProduct.id)) {
          handleSelectProduct(highlightedProduct);
        }
      } else if (searchTerm.trim()) {
        // Caso contrário, tentar adicionar o produto digitado
        handleAddProduct();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowSuggestions(false);
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              // Resetar índice destacado quando o usuário digita
              setHighlightedIndex(-1);
            }}
            onFocus={() => {
              if (suggestions.length > 0 && searchTerm.trim().length >= 3) {
                setShowSuggestions(true);
              }
            }}
            onBlur={(e) => {
              // Não fechar sugestões se o foco estiver nas sugestões
              const relatedTarget = e.relatedTarget as HTMLElement;
              if (suggestionsRef.current?.contains(relatedTarget)) {
                return;
              }
              // Delay para permitir clique nas sugestões
              setTimeout(() => {
                // Verificar novamente se o foco não voltou para o input
                if (document.activeElement !== inputRef.current) {
                  setShowSuggestions(false);
                  setHighlightedIndex(-1);
                }
              }, 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
            </div>
          )}

          {/* Sugestões */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-1 bg-dark-surface border border-dark-border rounded-md shadow-lg max-h-60 overflow-y-auto"
              onMouseDown={(e) => {
                // Prevenir que o input perca o foco ao clicar nas sugestões
                e.preventDefault();
              }}
            >
              {suggestions.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handleSelectProduct(product)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-3 py-2 transition-colors border-b border-dark-border last:border-b-0 ${
                    index === highlightedIndex
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'hover:bg-dark-bg text-dark-text'
                  }`}
                  disabled={value.some((p) => p.id === product.id)}
                >
                  <div className="font-medium">{product.name}</div>
                  {(product.category || product.subcategory) && (
                    <div className="text-xs text-dark-muted">
                      {product.category?.name}
                      {product.subcategory && ` • ${product.subcategory.name}`}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Não mostrar opção de criar - apenas adicionar via botão/Enter */}
        </div>
        {searchTerm.trim() && (
          <button
            type="button"
            onClick={handleAddProduct}
            disabled={isLoading}
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            Adicionar
          </button>
        )}
      </div>

      {/* Lista de produtos selecionados */}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((product) => (
            <span
              key={product.id}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-500/20 text-primary-400 border border-primary-500/30 rounded text-sm"
            >
              {product.name}
              <button
                type="button"
                onClick={() => handleRemoveProduct(product.id)}
                className="hover:text-primary-300"
                title="Remover"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
