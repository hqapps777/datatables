'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for error parameters
  const urlError = searchParams.get('error');
  
  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'invalid_token':
        return 'Der Magic Link ist ungültig.';
      case 'invalid_or_expired':
        return 'Der Magic Link ist ungültig oder abgelaufen.';
      case 'server_error':
        return 'Ein Server-Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';
      default:
        return 'Ein unbekannter Fehler ist aufgetreten.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');

    if (!email.includes('@')) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Magic Link wurde gesendet! Prüfen Sie Ihre E-Mails oder die Konsole (Development-Modus).');
        
        // In development, show the magic link URL
        if (data.magicLinkUrl) {
          console.log('🔗 Magic Link URL:', data.magicLinkUrl);
          setMessage(
            `Magic Link wurde gesendet! In Development-Modus: Öffnen Sie die Browser-Konsole für den direkten Link.`
          );
        }
      } else {
        setError(data.error || 'Ein Fehler ist aufgetreten.');
      }
    } catch (err) {
      setError('Netzwerkfehler. Bitte versuchen Sie es erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'demo@example.com' }),
      });

      const data = await response.json();

      if (response.ok && data.magicLinkUrl) {
        // Automatically redirect to the magic link URL in demo mode
        window.location.href = data.magicLinkUrl;
      } else {
        setError(data.error || 'Demo-Login fehlgeschlagen.');
      }
    } catch (err) {
      setError('Netzwerkfehler beim Demo-Login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Anmelden</CardTitle>
          <CardDescription>
            Geben Sie Ihre E-Mail-Adresse ein, um einen Magic Link zu erhalten
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {urlError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {getErrorMessage(urlError)}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {message}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                placeholder="ihre.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email}
            >
              {isLoading ? 'Sende Magic Link...' : 'Magic Link senden'}
            </Button>

            {/* Demo User Button - only show in development with flag */}
            {process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_ENABLE_DEMO === 'true' && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleDemoLogin}
                disabled={isLoading}
              >
                {isLoading ? 'Anmelden...' : 'Als Demo User anmelden'}
              </Button>
            )}

            <p className="text-sm text-gray-600 text-center">
              Nach dem Klick erhalten Sie eine E-Mail mit einem sicheren Link zum Anmelden.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}