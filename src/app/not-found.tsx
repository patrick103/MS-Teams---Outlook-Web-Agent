import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold">404</h2>
        <p className="text-[var(--text-secondary)]">Page not found</p>
        <Link href="/" className="btn-primary px-6 py-2 inline-block">
          Go home
        </Link>
      </div>
    </div>
  );
}
