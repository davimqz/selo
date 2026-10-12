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
      {step && <p className="badge badge-free mb-3">Step {step} of 3</p>}
      <h1 className="heading-3">{title}</h1>
      <p className="text-muted mt-2 text-base leading-relaxed">{children}</p>
    </header>
  );
}
