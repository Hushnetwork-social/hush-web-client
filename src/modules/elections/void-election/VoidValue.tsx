export function VoidValue({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-2xl bg-black/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-hush-text-accent">
        {label}
      </div>
      <div className={`mt-2 break-words text-sm font-medium ${accentClass ?? 'text-hush-text-primary'}`}>
        {value || 'Not recorded'}
      </div>
    </div>
  );
}
