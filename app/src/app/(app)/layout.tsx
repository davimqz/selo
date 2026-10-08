export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-wash flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {children}
      </div>
    </div>
  );
}
