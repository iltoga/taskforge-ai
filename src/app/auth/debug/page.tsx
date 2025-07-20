import { redirect } from "next/navigation";
import { auth } from "../../../../auth";

export default async function AuthDebugPage() {
  const session = await auth();

  // Only show this page in development or to authenticated users
  if (process.env.NODE_ENV === "production" && !session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Auth Debug Information</h1>

        <div className="grid gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
            <div className="space-y-2 font-mono text-sm">
              <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
              <p><strong>NEXTAUTH_URL:</strong> {process.env.NEXTAUTH_URL || 'NOT SET'}</p>
              <p><strong>NEXT_PUBLIC_BACKEND_URL:</strong> {process.env.NEXT_PUBLIC_BACKEND_URL || 'NOT SET'}</p>
              <p><strong>BYPASS_GOOGLE_AUTH:</strong> {process.env.BYPASS_GOOGLE_AUTH || 'false'}</p>
              <p><strong>GOOGLE_CLIENT_ID:</strong> {process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.slice(0, 20)}...` : 'NOT SET'}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Current URLs</h2>
            <div className="space-y-2 font-mono text-sm">
              <p><strong>Current Host:</strong> {typeof window !== 'undefined' ? window.location.origin : 'Server-side'}</p>
              <p><strong>Expected Callback:</strong> {process.env.NEXTAUTH_URL}/api/auth/callback/google</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Session Information</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Google OAuth URLs</h2>
            <div className="space-y-2 text-sm">
              <p><strong>What should be in Google Console:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li><strong>Authorized JavaScript origins:</strong></li>
                <ul className="list-disc list-inside ml-8">
                  <li>https://www.calendar-assistant.revisbali.com</li>
                  <li>http://localhost:3000 (for development)</li>
                </ul>
                <li><strong>Authorized redirect URIs:</strong></li>
                <ul className="list-disc list-inside ml-8">
                  <li>https://www.calendar-assistant.revisbali.com/api/auth/callback/google</li>
                  <li>http://localhost:3000/api/auth/callback/google (for development)</li>
                </ul>
              </ul>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Test URLs</h2>
            <div className="space-y-2 text-sm font-mono">
              <p><strong>Sign In URL:</strong> /api/auth/signin</p>
              <p><strong>Sign Out URL:</strong> /api/auth/signout</p>
              <p><strong>Callback URL:</strong> /api/auth/callback/google</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
