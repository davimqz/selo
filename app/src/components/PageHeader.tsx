export function PageHeader({
  step,
  title,
  children,
}: {
  /** Position in the demo flow (supplier 1 → lender 3); omitted for /verificar. */
  step?: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className="mb-8 max-w-2xl">
      {step && (
        <p className="text-brand mb-2 text-sm font-medium">Step {step} of 3</p>
      )}
      <h1 className="heading-4">{title}</h1>
      <p className="text-muted mt-2 leading-relaxed">{children}</p>
    </header>
  );
}
