export default function FlashError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger py-2 small">{decodeURIComponent(error)}</div>
  );
}
