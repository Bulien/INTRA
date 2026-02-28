import Link from "next/link";

const tools = [
  {
    href: "/tools/battlerite-draft",
    title: "Battlerite Draft Simulator",
    description: "Practice the 6-round ban/pick draft flow for Battlerite 3v3. Runs entirely offline — no game needed.",
    color: "cyan",
  },
];

export default function ToolsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Tools</h1>
      <p className="text-neutral-400 mb-8">Standalone utilities for practice and theory-crafting.</p>
      <div className="grid gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group block rounded-xl border border-white/10 bg-white/5 p-5 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-colors"
          >
            <h2 className="text-lg font-semibold text-white group-hover:text-cyan-200 transition-colors">
              {tool.title}
            </h2>
            <p className="text-sm text-neutral-400 mt-1">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
