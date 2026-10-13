import { createFileRoute, Link } from "@tanstack/react-router";
import { ChefHat, ClipboardList, Settings, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Restaurant Pro — Tacos el Faro" },
      { name: "description", content: "Elige tu estación: Mesero, Cocina, Caja o Administración." },
      { property: "og:title", content: "Smart Restaurant Pro — Tacos el Faro" },
      { property: "og:description", content: "Elige tu estación: Mesero, Cocina, Caja o Administración." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Inicio,
});

const roles = [
  { to: "/mesero", titulo: "Mesero", desc: "Toma de comandas desde el celular", Icon: ClipboardList },
  { to: "/cocina", titulo: "Cocina", desc: "Pantalla de comandas en tiempo real", Icon: ChefHat },
  { to: "/caja", titulo: "Caja", desc: "Cuentas, cobro y corte del día", Icon: Wallet },
  { to: "/admin", titulo: "Admin", desc: "Productos, empleados, turnos y bitácora", Icon: Settings },
] as const;

function Inicio() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 sm:px-6 sm:py-12">
      <p className="text-sm tracking-[0.3em] uppercase text-primary">Smart Restaurant Pro</p>
      <h1 className="font-display text-6xl sm:text-7xl md:text-8xl leading-none mt-2">Tacos el Faro</h1>
      <p className="text-muted-foreground mt-2">Carne asada · Monterrey</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-5xl mt-10">
        {roles.map(({ to, titulo, desc, Icon }) => (
          <Link key={to} to={to} className="group rounded-2xl border bg-card p-5 sm:p-6 hover:border-primary transition-colors">
            <Icon className="size-10 text-primary" />
            <h2 className="font-display text-4xl mt-4">{titulo}</h2>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
