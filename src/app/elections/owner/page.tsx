"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ElectionsWorkspace } from '@/modules/elections';
import { useAppStore } from '@/stores';

export default function OwnerElectionsWorkspacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { credentials, isAuthenticated, setActiveApp, setSelectedNav } = useAppStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const startInNewDraftMode = searchParams.get('mode') === 'new';

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCheckingAuth(false);
      if (
        !isAuthenticated ||
        !credentials?.signingPublicKey ||
        !credentials?.signingPrivateKey ||
        !credentials?.encryptionPublicKey ||
        !credentials?.encryptionPrivateKey
      ) {
        router.replace('/auth');
        return;
      }

      setActiveApp('voting');
      setSelectedNav('open-voting');
    }, 100);

    return () => clearTimeout(timer);
  }, [
    credentials?.encryptionPublicKey,
    credentials?.encryptionPrivateKey,
    credentials?.signingPrivateKey,
    credentials?.signingPublicKey,
    isAuthenticated,
    router,
    setActiveApp,
    setSelectedNav,
  ]);

  if (
    isCheckingAuth ||
    !isAuthenticated ||
    !credentials?.signingPublicKey ||
    !credentials?.signingPrivateKey ||
    !credentials?.encryptionPublicKey ||
    !credentials?.encryptionPrivateKey
  ) {
    return (
      <div className="flex flex-1 items-center justify-center bg-hush-bg-dark">
        <Loader2 className="h-8 w-8 animate-spin text-hush-purple" />
      </div>
    );
  }

  return (
    <ElectionsWorkspace
      ownerPublicAddress={credentials.signingPublicKey}
      ownerEncryptionPublicKey={credentials.encryptionPublicKey}
      ownerEncryptionPrivateKey={credentials.encryptionPrivateKey}
      ownerSigningPrivateKey={credentials.signingPrivateKey}
      startInNewDraftMode={startInNewDraftMode}
    />
  );
}
