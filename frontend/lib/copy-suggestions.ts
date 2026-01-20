/**
 * Sugestões de copy baseadas nos canais selecionados
 */

export interface Channel {
  id: string;
  type: string;
  name: string;
  category?: {
    slug: string;
    name: string;
  };
}

export function getCopySuggestions(channels: Channel[]): string[] {
  if (channels.length === 0) {
    return [];
  }

  const suggestions: string[] = [];
  const channelTypes = new Set(channels.map((c) => c.type));
  const categorySlugs = channels
    .map((c) => c.category?.slug)
    .filter((c): c is string => !!c);

  // Sugestões baseadas em categorias
  if (categorySlugs.includes("tech")) {
    suggestions.push(
      "🎮 Upgrade que faz diferença real na performance",
      "⚡ Tecnologia que entrega resultado",
      "🚀 Performance que você sente na prática"
    );
  }

  if (categorySlugs.includes("basquete")) {
    suggestions.push(
      "🏀 Equipamento que eleva seu jogo",
      "👟 Performance e estilo em um só produto",
      "🏆 Qualidade profissional para seu treino"
    );
  }

  if (categorySlugs.includes("casa")) {
    suggestions.push(
      "🏠 Transforme seu espaço com qualidade",
      "✨ Praticidade e estilo para seu lar",
      "💡 Solução inteligente para sua casa"
    );
  }

  // Sugestões baseadas em tipos de canal
  if (channelTypes.has("telegram")) {
    suggestions.push(
      "📱 Oferta exclusiva para você",
      "🔥 Promoção limitada - não perca!",
      "💎 Qualidade com o melhor preço"
    );
  }

  if (channelTypes.has("whatsapp")) {
    suggestions.push(
      "💬 Oferta especial chegou no seu WhatsApp",
      "📲 Confira essa oportunidade única"
    );
  }

  // Sugestões genéricas
  suggestions.push(
    "🛒 Oferta imperdível",
    "💰 Melhor custo-benefício do mercado",
    "⭐ Produto com excelente avaliação",
    "🎯 Exatamente o que você precisa"
  );

  // Retornar sugestões únicas
  return Array.from(new Set(suggestions)).slice(0, 5);
}
