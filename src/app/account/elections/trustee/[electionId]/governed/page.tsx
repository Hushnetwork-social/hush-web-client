"use client";

import { use, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type LegacyTrusteeGovernedPageProps = {
  params: Promise<{
    electionId: string;
  }>;
};

export default function LegacyTrusteeGovernedPage({
  params,
}: LegacyTrusteeGovernedPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/elections/${resolvedParams.electionId}/trustee/governed`);
  }, [resolvedParams.electionId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-hush-bg-dark">
      <Loader2 className="h-8 w-8 animate-spin text-hush-purple" />
    </div>
  );
}
