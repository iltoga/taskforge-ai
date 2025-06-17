'use client';

import { Chat } from '@/components/Chat';
import { Events } from '@/components/Events';
import { Reports } from '@/components/Reports';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useDevelopment } from '@/contexts/DevelopmentContext';
import {
    BarChart3,
    Calendar,
    CalendarIcon,
    CheckCircle,
    FileText,
    LogOut,
    Menu,
    MessageSquare,
    Sparkles,
    User
} from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useState } from 'react';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'CalendarGPT';

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'chat' | 'events' | 'reports'>('chat');
  const { isDevelopmentMode, isDebugPanelCollapsed, toggleDevelopmentMode } = useDevelopment();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="loading loading-spinner loading-lg text-primary" role="status"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20">
        <div className="hero min-h-screen">
          <div className="hero-content text-center">
            <div className="max-w-lg">
              <div className="card bg-base-100 shadow-2xl">
                <div className="card-body items-center text-center p-8">
                  <div className="avatar">
                    <div className="w-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <CalendarIcon className="w-12 h-12 text-primary" />
                    </div>
                  </div>
                  <h1 className="card-title text-4xl font-bold text-primary mt-4 mb-2">
                    {APP_NAME}
                  </h1>
                  <p className="text-base-content/70 mb-6">
                    Your intelligent assistant for seamless Google Calendar management.
                  </p>

                  <div className="card-actions justify-center w-full">
                    <button
                      onClick={() => signIn('google')}
                      className="btn btn-primary btn-lg w-full gap-3"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Sign in with Google
                    </button>
                  </div>

                  <div className="divider my-6">Features</div>

                  <div className="space-y-3 text-left w-full">
                    <div className="flex items-center gap-3">
                      <div className="badge badge-primary badge-sm">
                        <Sparkles className="w-3 h-3" />
                      </div>
                      <span className="text-sm">Natural language event creation</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="badge badge-secondary badge-sm">
                        <FileText className="w-3 h-3" />
                      </div>
                      <span className="text-sm">Automated weekly work reports</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="badge badge-accent badge-sm">
                        <CheckCircle className="w-3 h-3" />
                      </div>
                      <span className="text-sm">Smart reminders & scheduling</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }  return (
    <div className="drawer lg:drawer-open h-screen">
      <input id="drawer-toggle" type="checkbox" className="drawer-toggle" />

      {/* Page content */}
      <div className="drawer-content flex flex-col h-full">
        {/* Header/Navbar */}
        <div className="navbar bg-base-100 shadow-sm border-b border-base-300">
          <div className="navbar-start">
            <label htmlFor="drawer-toggle" className="btn btn-square btn-ghost lg:hidden">
              <Menu className="w-6 h-6" />
            </label>
            <div className="flex items-center gap-3 ml-2 lg:ml-0">
              <CalendarIcon className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-bold">{APP_NAME}</h1>
            </div>
          </div>

          <div className="navbar-end gap-2">
            {/* Development Mode Toggle */}
            {process.env.NODE_ENV === 'development' && (
              <button
                className={`btn btn-sm ${isDevelopmentMode ? 'btn-warning' : 'btn-ghost'}`}
                onClick={() => toggleDevelopmentMode()}
                title="Toggle development mode"
              >
                <span className="text-xs">DEV</span>
              </button>
            )}

            <ThemeSwitcher />

            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
                <div className="w-10 rounded-full">
                  {session.user?.image ? (
                    <Image
                      alt="User avatar"
                      src={session.user.image}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="avatar placeholder">
                      <div className="bg-neutral text-neutral-content rounded-full w-10">
                        <User className="w-5 h-5" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300">
                <li className="menu-title">
                  <span>{session.user?.name}</span>
                </li>
                <li><a className="text-sm opacity-70">{session.user?.email}</a></li>
                <li><hr className="my-1" /></li>
                <li>
                  <a onClick={() => signOut()}>
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>        {/* Main content */}
        <main className={`flex-1 p-4 ${isDevelopmentMode && !isDebugPanelCollapsed ? 'pb-[540px]' : ''}`}>
          {/* Welcome section */}
          <div className="mb-4">
            <div className="hero bg-gradient-to-r from-primary/10 to-secondary/10 rounded-box">
              <div className="hero-content text-center py-6">
                <div className="max-w-md">
                  <h1 className="text-2xl font-bold mb-3">Welcome back!</h1>
                  <p className="text-base-content/70 mb-4 text-sm">
                    Ready to manage your calendar with AI assistance?
                  </p>

                  <div className="stats stats-horizontal shadow bg-base-100 rounded-box">
                    <div className="stat py-3">
                      <div className="stat-figure text-primary">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="stat-title text-xs">Today</div>
                      <div className="stat-value text-primary text-xl">0</div>
                      <div className="stat-desc text-xs">events</div>
                    </div>
                    <div className="stat py-3">
                      <div className="stat-figure text-secondary">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                      <div className="stat-title text-xs">AI Chats</div>
                      <div className="stat-value text-secondary text-xl">0</div>
                      <div className="stat-desc text-xs">interactions</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body p-4">
              {activeTab === 'chat' && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <h2 className="card-title text-lg">AI Chat Assistant</h2>
                  </div>
                  <Chat />
                </>
              )}

              {activeTab === 'events' && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-primary" />
                    <h2 className="card-title text-lg">Calendar Events</h2>
                  </div>
                  <Events />
                </>
              )}

              {activeTab === 'reports' && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <h2 className="card-title text-lg">Analytics & Reports</h2>
                  </div>
                  <Reports />
                </>
              )}
            </div>
          </div>
        </main>
      </div>      {/* Sidebar */}
      <div className="drawer-side">
        <label htmlFor="drawer-toggle" aria-label="close sidebar" className="drawer-overlay"></label>
        <aside className="h-full w-64 bg-base-200">
          <div className="p-3">
            <div className="flex items-center gap-3 mb-6 lg:hidden">
              <CalendarIcon className="w-8 h-8 text-primary" />
              <h1 className="text-xl font-bold">{APP_NAME}</h1>
            </div>

            <ul className="menu p-0 space-y-1">
              <li>
                <a
                  className={`gap-3 ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  <MessageSquare className="w-5 h-5" />
                  AI Chat
                </a>
              </li>
              <li>
                <a
                  className={`gap-3 ${activeTab === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveTab('events')}
                >
                  <Calendar className="w-5 h-5" />
                  Events
                </a>
              </li>
              <li>
                <a
                  className={`gap-3 ${activeTab === 'reports' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reports')}
                >
                  <BarChart3 className="w-5 h-5" />
                  Reports
                </a>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
