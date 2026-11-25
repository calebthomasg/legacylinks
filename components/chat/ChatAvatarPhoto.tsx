export default function ChatAvatarPhoto({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={url} src={url} alt="" className="absolute inset-0 size-full rounded-[inherit] object-cover"
      onError={(event) => { event.currentTarget.style.display = "none"; }} />
  );
}
