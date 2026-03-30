"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ElectionsWorkspace } from '@/modules/elections';
import { useAppStore } from '@/stores';

export default function OwnerElectionsWorkspacePage() {
  const router = useRouter();
  const { credentials, isAuthenticated } = useAppStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [
    credentials?.encryptionPublicKey,
    credentials?.encryptionPrivateKey,
    credentials?.signingPrivateKey,
    credentials?.signingPublicKey,
    isAuthenticated,
    router,
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
      <div className="flex min-h-screen items-center justify-center bg-hush-bg-dark">
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
    />
  );
}
