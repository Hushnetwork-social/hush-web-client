"use client";

import { use, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TrusteeElectionCeremonyPanel } from '@/modules/elections/TrusteeElectionCeremonyPanel';
import { useAppStore } from '@/stores';

type TrusteeCeremonyPageProps = {
  params: Promise<{
    electionId: string;
  }>;
};

export default function TrusteeCeremonyPage({ params }: TrusteeCeremonyPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { credentials, isAuthenticated } = useAppStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCheckingAuth(false);
      if (!isAuthenticated || !credentials?.signingPublicKey) {
        router.replace('/auth');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [credentials?.signingPublicKey, isAuthenticated, router]);

  if (isCheckingAuth || !isAuthenticated || !credentials?.signingPublicKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hush-bg-dark">
        <Loader2 className="h-8 w-8 animate-spin text-hush-purple" />
      </div>
    );
  }

  return (
    <TrusteeElectionCeremonyPanel
      electionId={resolvedParams.electionId}
      actorPublicAddress={credentials.signingPublicKey}
    />
  );
}
