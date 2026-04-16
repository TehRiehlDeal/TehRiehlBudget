import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { X, RefreshCw } from 'lucide-react';

export function PWAUpdatePrompt() {
  const [visible, setVisible] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Check for updates every hour
      if (registration) {
        setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000,
        );
      }
    },
  });

  useEffect(() => {
    if (needRefresh) setVisible(true);
  }, [needRefresh]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border bg-card p-3 shadow-lg">
      <RefreshCw className="size-4 text-primary" />
      <p className="text-sm">A new version is available.</p>
      <Button
        size="sm"
        onClick={() => {
          updateServiceWorker(true);
        }}
      >
        Reload
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => {
          setNeedRefresh(false);
          setVisible(false);
        }}
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
