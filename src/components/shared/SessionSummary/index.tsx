export default function SessionSummary({
  heading,
  subheading,
  actionLabel,
  onAction,
}: {
  heading: string;
  subheading: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mx-auto flex flex-col items-center gap-6 py-12 text-center">
      <div>
        <p className="text-4xl font-semibold">{heading}</p>
        <p className="text-base-content/60 mt-1">{subheading}</p>
      </div>
      <button onClick={onAction} className="btn btn-primary">
        {actionLabel}
      </button>
    </div>
  );
}
