'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthErrorPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home after 1 second
    const timer = setTimeout(() => {
      router.push('/');
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Redirecting...
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Taking you to the home page
          </p>
        </div>
      </div>
    </div>
  );
}
