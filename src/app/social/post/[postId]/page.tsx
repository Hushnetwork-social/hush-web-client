import SocialPostPermalinkClient from "./SocialPostPermalinkClient";

const isStaticExport = process.env.STATIC_EXPORT === "true";

export function generateStaticParams(): Array<{ postId: string }> {
  if (isStaticExport) {
    return [{ postId: "_placeholder" }];
  }

  return [];
}

export default function SocialPostPermalinkPage() {
  return <SocialPostPermalinkClient />;
}
