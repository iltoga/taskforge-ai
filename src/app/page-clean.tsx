'use client';

import { Chat } from '@/components/Chat';
import { Events } from '@/components/Events';
import { Reports } from '@/components/Reports';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Calendar, CalendarIcon, CheckCircle, FileText, LogOut, Sparkles, User } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useState } from 'react';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'CalendarGPT';

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<'chat' | 'events' | 'reports'>('chat');

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="loading loading-spinner loading-lg text-primary" data-testid="loading-spinner"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-accent to-secondary flex flex-col items-center justify-center p-6">
        <div className="hero min-h-[calc(100vh-4rem)] bg-transparent">
          <div className="hero-content text-center">
            <div className="max-w-lg bg-base-100 p-8 sm:p-12 rounded-2xl shadow-2xl">
              <div className="flex justify-center mb-6">
                <CalendarIcon className="w-20 h-20 text-primary animate-bounce" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold mb-3 text-primary">
                {APP_NAME}
              </h1>
              <p className="text-lg text-base-content/80 mb-8">
                Your intelligent assistant for seamless Google Calendar management.
              </p>
              <button
                onClick={() => signIn('google')}
                className="btn btn-primary btn-lg w-full flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
              <div className="divider my-8 text-base-content/70">Key Features</div>
              <ul className="space-y-3 text-left text-base-content/90">
                <li className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-accent" />
                  <span>Natural language event creation</span>
                </li>
                <li className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-accent" />
                  <span>Automated weekly work reports</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-accent" />
                  <span>Smart reminders & scheduling</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <footer className="footer footer-center p-4 text-base-content/70">
          <div>
            <p>Powered by AI ✨ - Streamline your schedule effortlessly.</p>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <div className="navbar bg-base-200 shadow-lg">
        <div className="navbar-start">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold">{APP_NAME}</span>
          </div>
        </div>

        <div className="navbar-end">
          <div className="flex items-center gap-2">
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
                      referrerPolicy="no-referrer"
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
              <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
                <li className="menu-title">
                  <span>{session.user?.name}</span>
                </li>
                <li><a className="text-sm opacity-70">{session.user?.email}</a></li>
                <li><hr /></li>
                <li>
                  <a onClick={() => signOut()}>
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto p-4">
        {/* Navigation Tabs */}
        <div className="tabs tabs-boxed justify-center mb-6">
          <button
            className={`tab ${activeTab === 'chat' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Chat Assistant
          </button>
          <button
            className={`tab ${activeTab === 'events' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Events
          </button>
          <button
            className={`tab ${activeTab === 'reports' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <FileText className="w-4 h-4 mr-2" />
            Reports
          </button>
        </div>

        {/* Content Area */}
        <div className="max-w-4xl mx-auto">
          {activeTab === 'chat' && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">AI Chat Assistant</h2>
                <Chat />
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Calendar Events</h2>
                <Events />
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="card bg-base-100 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">Analytics & Reports</h2>
                <Reports />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
