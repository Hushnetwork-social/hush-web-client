"use client";

import { use, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ElectionEligibilityPanel } from '@/modules/elections/ElectionEligibilityPanel';
import { useAppStore } from '@/stores';

type ElectionEligibilityPageProps = {
  params: Promise<{
    electionId: string;
  }>;
};

export default function ElectionEligibilityPage({ params }: ElectionEligibilityPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { credentials, isAuthenticated, setActiveApp, setSelectedNav } = useAppStore();
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
        return;
      }

      setActiveApp('voting');
      setSelectedNav('open-voting');
    }, 100);

    return () => clearTimeout(timer);
  }, [
    credentials?.encryptionPrivateKey,
    credentials?.encryptionPublicKey,
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
    <ElectionEligibilityPanel
      electionId={resolvedParams.electionId}
      actorPublicAddress={credentials.signingPublicKey}
      actorEncryptionPublicKey={credentials.encryptionPublicKey}
      actorEncryptionPrivateKey={credentials.encryptionPrivateKey}
      actorSigningPrivateKey={credentials.signingPrivateKey}
    />
  );
}
