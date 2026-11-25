import { useState } from "react";

export default function ChatAvatarPhoto({ url, initials }: { url?: string | null; initials: string }) {
  if (!url) return <>{initials}</>;
  return <ProfilePhoto key={url} url={url} initials={initials} />;
}

function ProfilePhoto({ url, initials }: { url: string; initials: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{initials}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(image) => {
        if (image?.complete && image.naturalWidth === 0) setFailed(true);
      }}
      src={url}
      alt=""
      className="absolute inset-0 size-full rounded-[inherit] object-cover"
      onError={() => setFailed(true)}
    />
  );
}
