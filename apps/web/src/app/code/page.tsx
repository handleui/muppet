export default function CodeHome() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="font-semibold text-xl">Start a new code session</h1>
      <p className="text-muted text-sm">Select a worktree or start fresh.</p>
      <div className="w-full max-w-2xl px-8">
        <textarea
          className="w-full resize-none rounded-lg border border-subtle bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-foreground"
          placeholder="Describe what you want to build..."
          rows={3}
        />
      </div>
    </div>
  );
}
