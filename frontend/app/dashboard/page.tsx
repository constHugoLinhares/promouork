'use client';

import Layout from '@/components/Layout';
import api from '@/lib/api';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    posts: 0,
    channels: 0,
    templates: 0,
    published: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [postsRes, channelsRes, templatesRes] = await Promise.all([
          api.get('/posts'),
          api.get('/channels'),
          api.get('/templates'),
        ]);

        const posts = postsRes.data;
        setStats({
          posts: posts.length,
          channels: channelsRes.data.length,
          templates: templatesRes.data.length,
          published: posts.filter((p: any) => p.isPublished).length,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };

    loadStats();
  }, []);

  return (
    <Layout>
      <div>
        <h1 className="text-3xl font-bold text-dark-text mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-gradient-to-br from-dark-surface via-purple-900/20 to-dark-surface overflow-hidden shadow-xl rounded-lg border border-dark-border">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-dark-muted truncate">Total de Posts</dt>
                    <dd className="text-lg font-medium text-dark-text">{stats.posts}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-dark-surface via-purple-900/20 to-dark-surface overflow-hidden shadow-xl rounded-lg border border-dark-border">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-dark-muted truncate">Canais</dt>
                    <dd className="text-lg font-medium text-dark-text">{stats.channels}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-dark-surface via-purple-900/20 to-dark-surface overflow-hidden shadow-xl rounded-lg border border-dark-border">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-dark-muted truncate">Templates</dt>
                    <dd className="text-lg font-medium text-dark-text">{stats.templates}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-dark-surface via-purple-900/20 to-dark-surface overflow-hidden shadow-xl rounded-lg border border-dark-border">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-dark-muted truncate">Publicados</dt>
                    <dd className="text-lg font-medium text-dark-text">{stats.published}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

