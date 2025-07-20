'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function AuthErrorContent() {
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Only access search params on the client side after mounting
    const searchParams = new URLSearchParams(window.location.search);
    setError(searchParams.get('error'));
    setIsLoaded(true);
  }, []);

  // Show consistent content until client-side hydration is complete
  if (!isLoaded) {
    return (
      <>
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Loading error details...
          </p>
        </div>
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Home
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Authentication Error
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {error === 'Configuration' && 'There is a problem with the server configuration.'}
          {error === 'AccessDenied' && 'Access denied. You do not have permission to sign in.'}
          {error === 'Verification' && 'The verification token has expired or has already been used.'}
          {!error && 'An unexpected error occurred during authentication.'}
        </p>
      </div>
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Go to Home
        </Link>
      </div>
    </>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <AuthErrorContent />
      </div>
    </div>
  );
}
