"use client";

import { use, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores';

type LegacyElectionVotingPageProps = {
  params: Promise<{
    electionId: string;
  }>;
};

export default function LegacyElectionVotingPage({ params }: LegacyElectionVotingPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { credentials, isAuthenticated, setActiveApp, setSelectedNav } = useAppStore();

  useEffect(() => {
    const timer = setTimeout(() => {
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
      router.replace(`/elections/${resolvedParams.electionId}`);
    }, 100);

    return () => clearTimeout(timer);
  }, [
    credentials?.encryptionPrivateKey,
    credentials?.encryptionPublicKey,
    credentials?.signingPrivateKey,
    credentials?.signingPublicKey,
    isAuthenticated,
    resolvedParams.electionId,
    router,
    setActiveApp,
    setSelectedNav,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hush-bg-dark">
      <Loader2 className="h-8 w-8 animate-spin text-hush-purple" />
    </div>
  );
}
