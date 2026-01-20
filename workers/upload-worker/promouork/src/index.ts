/**
 * Cloudflare Worker para upload e serviço de imagens do R2
 *
 * Este worker atua como proxy para upload e serviço de imagens, resolvendo:
 * - Problemas de CORS ao fazer upload direto do frontend para R2
 * - Problemas de acesso público ao R2 (bucket privado)
 *
 * Funcionalidades:
 * - POST /: Faz upload de imagens para R2 (com validação de token JWT)
 * - GET /{key}: Serve imagens do R2 publicamente (sem autenticação)
 *
 * Fluxo de Upload:
 * 1. Frontend solicita URL de upload ao backend
 * 2. Backend retorna URL do worker + token de autenticação
 * 3. Frontend faz POST para o worker com a imagem
 * 4. Worker valida token e faz upload para R2
 * 5. Worker retorna URL pública da imagem (URL do próprio worker)
 *
 * Fluxo de Serviço:
 * 1. Frontend/Telegram solicita imagem via URL do worker
 * 2. Worker busca imagem no R2 usando binding
 * 3. Worker retorna imagem com headers apropriados (CORS, Cache-Control)
 */

interface UploadRequest {
	userId: string;
	type: 'post' | 'template';
	fileName: string;
	contentType: string;
	token: string; // Token JWT para autenticação
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// CORS headers para permitir requisições do frontend
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		};

		// Handle preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		const url = new URL(request.url);
		const method = request.method;

		// Endpoint GET para servir imagens do R2
		if (method === 'GET') {
			// Extrair o path da imagem (ex: /users/xxx/posts/xxx.png)
			let imagePath = url.pathname.substring(1); // Remove a barra inicial

			// Se a URL tiver query params, remover
			if (imagePath.includes('?')) {
				imagePath = imagePath.split('?')[0];
			}

			if (!imagePath || imagePath.length === 0) {
				return new Response(JSON.stringify({ error: 'Image path required' }), {
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			try {
				// Buscar objeto do R2
				const object = await env.BUCKET.get(imagePath);

				if (!object) {
					return new Response(JSON.stringify({ error: 'Image not found', path: imagePath }), {
						status: 404,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					});
				}

				// Obter conteúdo e metadata
				const body = await object.arrayBuffer();
				const contentType = object.httpMetadata?.contentType || 'image/png';

				// Retornar imagem com headers apropriados
				return new Response(body, {
					status: 200,
					headers: {
						...corsHeaders,
						'Content-Type': contentType,
						'Cache-Control': 'public, max-age=31536000', // Cache por 1 ano
					},
				});
			} catch (error) {
				console.error('Error serving image:', error);
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				return new Response(
					JSON.stringify({
						error: 'Internal server error',
						details: errorMessage,
						path: imagePath,
					}),
					{
						status: 500,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					}
				);
			}
		}

		// Endpoint POST para upload de imagens
		if (method === 'POST') {
			try {
				// Parse do body da requisição
				const formData = await request.formData();
				const file = formData.get('file') as File;
				const userId = formData.get('userId') as string;
				const type = formData.get('type') as 'post' | 'template';
				const fileName = formData.get('fileName') as string;
				const contentType = formData.get('contentType') as string;
				const token = formData.get('token') as string;

				// Validações básicas
				if (!file || !userId || !type || !fileName || !contentType || !token) {
					return new Response(JSON.stringify({ error: 'Missing required fields' }), {
						status: 400,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					});
				}

				// Validar token JWT
				// Nota: Para validação completa do JWT com verificação de assinatura,
				// você pode usar uma biblioteca como @cloudflare/workers-jwt
				// Por enquanto, validação básica - verifica formato e extrai userId
				if (!token || token.length < 10 || !token.includes('.')) {
					return new Response(JSON.stringify({ error: 'Invalid token' }), {
						status: 401,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					});
				}

				// Extrair userId do token (decodificar payload do JWT)
				// Nota: Esta é uma validação básica. Para produção, considere validar
				// a assinatura do JWT usando o JWT_SECRET
				try {
					const tokenParts = token.split('.');
					if (tokenParts.length !== 3) {
						return new Response(JSON.stringify({ error: 'Invalid token format' }), {
							status: 401,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}

					// Decodificar payload (base64url)
					const payloadBase64 = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
					const payloadJson = atob(payloadBase64);
					const payload = JSON.parse(payloadJson);
					const decodedUserId = payload.sub || payload.userId;

					// Verificar se o userId do token corresponde ao userId enviado
					if (!decodedUserId || decodedUserId !== userId) {
						return new Response(JSON.stringify({ error: 'Token userId mismatch' }), {
							status: 401,
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						});
					}
				} catch (error) {
					return new Response(JSON.stringify({ error: 'Invalid token format' }), {
						status: 401,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					});
				}

				// Gerar nome único para o arquivo
				const fileExtension = fileName.split('.').pop() || 'png';
				const uniqueFileName = `${crypto.randomUUID()}.${fileExtension}`;

				// Construir path: users/{userId}/{type}/{fileName}
				const key = `users/${userId}/${type}/${uniqueFileName}`;

				// Converter File para ArrayBuffer
				const fileBuffer = await file.arrayBuffer();

				// Fazer upload para R2 usando o binding
				await env.BUCKET.put(key, fileBuffer, {
					httpMetadata: {
						contentType: contentType,
					},
				});

				// Construir URL pública usando o próprio worker (resolve problemas de acesso)
				// A URL será: https://worker-url.workers.dev/users/xxx/posts/xxx.png
				const workerPublicUrl = `${url.origin}/${key}`;

				// Retornar URL pública do worker (não a URL direta do R2)
				return new Response(
					JSON.stringify({
						publicUrl: workerPublicUrl,
						key,
					}),
					{
						status: 200,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					}
				);
			} catch (error) {
				console.error('Upload error:', error);
				return new Response(
					JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }),
					{
						status: 500,
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					}
				);
			}
		}

		// Se chegou aqui, método não suportado
		return new Response(JSON.stringify({ error: 'Method not allowed', method }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	},
} satisfies ExportedHandler<Env>;
