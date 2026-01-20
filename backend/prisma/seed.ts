import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import * as path from 'path';

// Resolve o caminho do Prisma Client gerado
const prismaGeneratedPath = path.resolve(__dirname, './generated');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require(prismaGeneratedPath);

const connectionUrl = process.env.DATABASE_URL;

if (!connectionUrl) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.error(
    'Please make sure you have a .env file with DATABASE_URL configured',
  );
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: connectionUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 Starting seed...');

  // Criar usuário administrador padrão
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@promouork.com' },
    update: {},
    create: {
      email: 'admin@promouork.com',
      password: hashedPassword,
      name: 'Administrador',
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Criar template padrão (verificar se já existe)
  const existingTemplate = await prisma.template.findFirst({
    where: { isDefault: true },
  });

  if (!existingTemplate) {
    await prisma.template.create({
      data: {
        name: 'Template Padrão',
        background: '#FFFFFF',
        isDefault: true,
        elements: [
          {
            type: 'text',
            content: 'Promoção Especial!',
            position: { x: 50, y: 50 },
            fontSize: 24,
            color: '#000000',
          },
        ],
      },
    });
    console.log('✅ Default template created');
  } else {
    console.log('✅ Default template already exists');
  }

  // Criar categorias e subcategorias
  const techCategory = await prisma.category.upsert({
    where: { slug: 'tech' },
    update: {},
    create: {
      name: 'Tech',
      slug: 'tech',
      description: 'Produtos de tecnologia',
      isActive: true,
    },
  });

  const techSubcategories = [
    { name: 'CPU', slug: 'cpu' },
    { name: 'GPU', slug: 'gpu' },
    { name: 'Monitor', slug: 'monitor' },
    { name: 'Teclado', slug: 'teclado' },
    { name: 'Mouse', slug: 'mouse' },
    { name: 'Fones', slug: 'fones' },
    { name: 'SSD', slug: 'ssd' },
  ];

  for (const sub of techSubcategories) {
    await prisma.subcategory.upsert({
      where: {
        categoryId_slug: {
          categoryId: techCategory.id,
          slug: sub.slug,
        },
      },
      update: {},
      create: {
        ...sub,
        categoryId: techCategory.id,
        isActive: true,
      },
    });
  }

  const esporteCategory = await prisma.category.upsert({
    where: { slug: 'esporte' },
    update: {},
    create: {
      name: 'Esporte',
      slug: 'esporte',
      description: 'Produtos de esporte',
      isActive: true,
    },
  });

  const casaCategory = await prisma.category.upsert({
    where: { slug: 'casa' },
    update: {},
    create: {
      name: 'Casa',
      slug: 'casa',
      description: 'Produtos para casa',
      isActive: true,
    },
  });

  console.log('✅ Categories and subcategories created');

  // Criar copies iniciais para Tech
  const techCopies = {
    cpu: [
      'Processador fraco é gargalo disfarçado.',
      'Não adianta GPU forte com CPU cansada.',
      'Performance começa no cérebro do setup.',
    ],
    gpu: [
      'Seu FPS não cai sozinho.',
      'Gráfico no médio é escolha ou limitação?',
      'Depois da GPU certa, tudo muda.',
    ],
    monitor: [
      '144Hz não é luxo. É padrão.',
      'Depois que vê fluido, não volta atrás.',
      'Seu PC entrega mais do que sua tela mostra.',
    ],
    teclado: [
      'Teclado ruim entrega sua gameplay.',
      'Precisão começa nos dedos.',
      'Quem joga sério sente a diferença.',
    ],
    mouse: [
      'Mouse pesado mata reflexo.',
      'Precisão não é só skill.',
      'Setup bom começa na mira.',
    ],
    fones: [
      'Ouvir antes de ver faz diferença.',
      'Áudio ruim te deixa sempre atrasado.',
      'Imersão também é vantagem.',
    ],
    ssd: [
      'PC rápido começa no armazenamento.',
      'Loading infinito não é normal.',
      'Depois do SSD, nada parece lento.',
    ],
  };

  // Buscar subcategorias criadas
  const createdSubcategories = await prisma.subcategory.findMany({
    where: { categoryId: techCategory.id },
  });

  for (const subcategory of createdSubcategories) {
    const copies = techCopies[subcategory.slug as keyof typeof techCopies];
    if (copies) {
      for (const copyText of copies) {
        // Verificar se já existe uma copy com a mesma mensagem para esta subcategoria
        const existing = await prisma.copyMessage.findFirst({
          where: {
            message: copyText,
            categoryId: techCategory.id,
            subcategoryId: subcategory.id,
          },
        });

        if (!existing) {
          await prisma.copyMessage.create({
            data: {
              message: copyText,
              categoryId: techCategory.id,
              subcategoryId: subcategory.id,
              isActive: true,
            },
          });
        }
      }
    }
  }

  // Copies gerais para casa e esporte
  const casaCopies = [
    'Qualidade que transforma seu espaço.',
    'Praticidade e estilo em um só produto.',
    'Solução inteligente para sua casa.',
  ];

  const esporteCopies = [
    'Equipamento que eleva seu jogo.',
    'Performance e estilo em um só produto.',
    'Qualidade profissional para seu treino.',
  ];

  for (const copyText of casaCopies) {
    const existing = await prisma.copyMessage.findFirst({
      where: {
        message: copyText,
        categoryId: casaCategory.id,
        subcategoryId: null,
      },
    });

    if (!existing) {
      await prisma.copyMessage.create({
        data: {
          message: copyText,
          categoryId: casaCategory.id,
          isActive: true,
        },
      });
    }
  }

  for (const copyText of esporteCopies) {
    const existing = await prisma.copyMessage.findFirst({
      where: {
        message: copyText,
        categoryId: esporteCategory.id,
        subcategoryId: null,
      },
    });

    if (!existing) {
      await prisma.copyMessage.create({
        data: {
          message: copyText,
          categoryId: esporteCategory.id,
          isActive: true,
        },
      });
    }
  }

  console.log('✅ Copy messages created');

  // Criar canais do Telegram padrão
  const techChannelData = {
    name: 'Tech',
    type: 'telegram',
    chatId: '@tech_channel',
    description: 'Canal de produtos de tecnologia',
    categoryId: techCategory.id,
  };

  const esporteChannelData = {
    name: 'Esporte',
    type: 'telegram',
    chatId: '@esporte_channel',
    description: 'Canal de produtos de esporte',
    categoryId: esporteCategory.id,
  };

  const casaChannelData = {
    name: 'Casa',
    type: 'telegram',
    chatId: '@casa_channel',
    description: 'Canal de produtos para casa',
    categoryId: casaCategory.id,
  };

  // Criar ou atualizar canal Tech
  const techChannel = await prisma.channel.upsert({
    where: {
      type_chatId: {
        type: techChannelData.type,
        chatId: techChannelData.chatId,
      },
    },
    update: techChannelData,
    create: techChannelData,
  });
  console.log(`✅ Channel created/updated: ${techChannel.name}`);

  // Criar ou atualizar canal Esporte
  const esporteChannel = await prisma.channel.upsert({
    where: {
      type_chatId: {
        type: esporteChannelData.type,
        chatId: esporteChannelData.chatId,
      },
    },
    update: {
      ...esporteChannelData,
    },
    create: esporteChannelData,
  });
  console.log(`✅ Channel created/updated: ${esporteChannel.name}`);

  // Criar ou atualizar canal Casa
  const casaChannel = await prisma.channel.upsert({
    where: {
      type_chatId: {
        type: casaChannelData.type,
        chatId: casaChannelData.chatId,
      },
    },
    update: {
      ...casaChannelData,
    },
    create: casaChannelData,
  });
  console.log(`✅ Channel created/updated: ${casaChannel.name}`);

  // Criar integrações iniciais (fixas, não editáveis pelo usuário)
  const aliexpressIntegration = await prisma.integration.upsert({
    where: { type: 'aliexpress' },
    update: {},
    create: {
      type: 'aliexpress',
      name: 'AliExpress',
      description:
        'Integração com AliExpress para busca de produtos e geração de links de afiliado',
      isActive: true,
      config: {
        minCommission: 0, // Comissão mínima em valor absoluto (pode ser configurado)
        minScore: 0, // Score mínimo dos produtos
        commissionRate: 0, // Taxa de comissão padrão (pode ser configurado)
      },
    },
  });

  const shopeeIntegration = await prisma.integration.upsert({
    where: { type: 'shopee' },
    update: {},
    create: {
      type: 'shopee',
      name: 'Shopee',
      description:
        'Integração com Shopee para busca de produtos e geração de links de afiliado',
      isActive: true,
      config: {
        minCommission: 0, // Comissão mínima em valor absoluto (pode ser configurado)
        minScore: 0, // Score mínimo dos produtos
        commissionRate: 0, // Taxa de comissão padrão (pode ser configurado)
      },
    },
  });

  console.log('✅ Integrations created:', {
    aliexpress: aliexpressIntegration.name,
    shopee: shopeeIntegration.name,
  });

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
