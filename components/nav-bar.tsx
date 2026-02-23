"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const navLinks = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/flows", label: "Flows", icon: "🔀" },
  { href: "/uploads", label: "Contacts", icon: "📋" },
  { href: "/caller", label: "Call Center", icon: "📞" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold text-indigo-400 mr-4">Aloxi</span>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {link.icon} {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">
            {user.name}
            {user.role === "admin" && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-400 text-[10px]">ADMIN</span>
            )}
          </span>
          <button
            onClick={logout}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
