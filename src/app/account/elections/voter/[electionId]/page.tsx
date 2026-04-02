import { redirect } from 'next/navigation';

type LegacyVoterElectionPageProps = {
  params: Promise<{
    electionId: string;
  }>;
};

export default async function LegacyVoterElectionPage({
  params,
}: LegacyVoterElectionPageProps) {
  const resolvedParams = await params;
  redirect(`/elections/${resolvedParams.electionId}/voter`);
}
