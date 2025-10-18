import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Download, CheckCircle, WifiOff, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event (Android/Desktop)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-primary rounded-full mb-4">
            <Smartphone className="h-12 w-12 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Install MatchPlay</h1>
          <p className="text-xl text-muted-foreground">
            Track your golf scores even when offline on the course
          </p>
        </div>

        {isInstalled ? (
          <Card className="bg-success/10 border-success">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-3 text-success">
                <CheckCircle className="h-8 w-8" />
                <div>
                  <p className="text-lg font-semibold">Already Installed!</p>
                  <p className="text-sm">MatchPlay is ready to use offline</p>
                </div>
              </div>
              <Button onClick={() => navigate('/')} className="w-full mt-6">
                Go to Matches
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <WifiOff className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Works Offline</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Keep scoring even when you lose connection on the course. Scores sync automatically when back online.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Zap className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Lightning Fast</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Loads instantly and runs smoothly. No app store required - install directly from your browser.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Smartphone className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">Home Screen</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Add to your home screen for quick access. Works just like a native app.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            {isIOS ? (
              <Card>
                <CardHeader>
                  <CardTitle>Install on iPhone/iPad</CardTitle>
                  <CardDescription>Follow these steps to add MatchPlay to your home screen</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      1
                    </div>
                    <p>Tap the <strong>Share</strong> button (square with arrow) at the bottom of Safari</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      2
                    </div>
                    <p>Scroll down and tap <strong>"Add to Home Screen"</strong></p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      3
                    </div>
                    <p>Tap <strong>"Add"</strong> in the top right corner</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      4
                    </div>
                    <p>MatchPlay will now appear on your home screen!</p>
                  </div>
                </CardContent>
              </Card>
            ) : deferredPrompt ? (
              <Card>
                <CardHeader>
                  <CardTitle>Install MatchPlay</CardTitle>
                  <CardDescription>Click the button below to install the app</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleInstallClick} size="lg" className="w-full">
                    <Download className="mr-2 h-5 w-5" />
                    Install App
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Install on Android/Desktop</CardTitle>
                  <CardDescription>Follow these steps to install MatchPlay</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      1
                    </div>
                    <p>Tap the <strong>menu (⋮)</strong> in the top right of your browser</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      2
                    </div>
                    <p>Look for <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      3
                    </div>
                    <p>Confirm the installation</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      4
                    </div>
                    <p>MatchPlay will now work offline!</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-8 text-center">
              <Button variant="outline" onClick={() => navigate('/')}>
                Skip for now
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
