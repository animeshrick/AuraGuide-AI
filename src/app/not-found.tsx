import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="text-slate-700">That page does not exist.</p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-semibold"
        >
          Back to AuraGuide AI
        </Link>
      </div>
    </main>
  );
}
