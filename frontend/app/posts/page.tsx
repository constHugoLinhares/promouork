'use client';

import Layout from '@/components/Layout';
import api from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Post {
  id: string;
  title: string;
  message: string;
  isPublished: boolean;
  createdAt: string;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const response = await api.get('/posts');
      setPosts(response.data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (postId: string, isRepost: boolean = false) => {
    try {
      await api.post(`/posts/${postId}/publish`);
      alert(isRepost ? 'Post republicado com sucesso!' : 'Post publicado com sucesso!');
      loadPosts();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao publicar post');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Tem certeza que deseja excluir este post?')) return;

    try {
      await api.delete(`/posts/${postId}`);
      loadPosts();
    } catch (error) {
      alert('Erro ao excluir post');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-8 text-dark-text">Carregando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-dark-text">Posts</h1>
          <Link
            href="/posts/new"
            className="bg-primary-500 text-white px-4 py-2 rounded-md hover:bg-primary-600 transition-colors"
          >
            Novo Post
          </Link>
        </div>

        <div className="bg-dark-surface border border-dark-border shadow-lg overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-dark-border">
            {posts.map((post) => (
              <li key={post.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-dark-bg/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-medium text-dark-text">{post.title}</h3>
                        {post.isPublished && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                            Publicado
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-dark-muted line-clamp-2 mb-2">{post.message}</p>
                      <p className="text-xs text-dark-muted/70">
                        {new Date(post.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!post.isPublished ? (
                        <button
                          onClick={() => handlePublish(post.id, false)}
                          className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1"
                          title="Publicar post"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Publicar
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublish(post.id, true)}
                          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1"
                          title="Republicar este post"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Repostar
                        </button>
                      )}
                      <Link
                        href={`/posts/${post.id}`}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1"
                        title="Editar post"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                      </Link>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-md transition-colors flex items-center gap-1"
                        title="Excluir post"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
}

