import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  Calculator,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  MapPin,
  Menu,
  Search,
  Settings,
  Truck,
} from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MarcaAplicatie, { NUME_APLICATIE } from '@/components/MarcaAplicatie';
import { cn } from '@/lib/utils';

const SECTIUNI = [
  { cale: '/', nume: 'Prezentare generală', Icon: LayoutDashboard },
  { cale: '/cauta-taxe', nume: 'Caută taxe', Icon: Search },
  { cale: '/harta', nume: 'Hartă taxe și restricții', Icon: MapIcon },
  { cale: '/cost-cursa', nume: 'Cost pe cursă', Icon: Calculator },
  { cale: '/localitati', nume: 'Localități', Icon: MapPin },
  { cale: '/baza-taxe', nume: 'Baza de taxe', Icon: Database },
  { cale: '/surse', nume: 'Surse și acte normative', Icon: FileText },
  { cale: '/vehicule', nume: 'Vehicule', Icon: Truck },
  { cale: '/alerte', nume: 'Alerte', Icon: Bell },
  { cale: '/setari', nume: 'Setări', Icon: Settings },
];

function Navigatie({ onNavigat }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4" aria-label="Meniu principal">
      {SECTIUNI.map(({ cale, nume, Icon }) => (
        <NavLink
          key={cale}
          to={cale}
          end={cale === '/'}
          onClick={onNavigat}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{nume}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [cautare, setCautare] = useState('');
  const [alerteDeschise, setAlerteDeschise] = useState(0);
  const [meniuDeschis, setMeniuDeschis] = useState(false);

  useEffect(() => {
    api.entities.Alerta.count({ status: { $in: ['Nouă', 'În lucru'] } })
      .then(setAlerteDeschise)
      .catch(() => setAlerteDeschise(0));
  }, []);

  const organizatie = user?.nume_organizatie || user?.full_name || 'Organizația mea';

  const trimiteCautarea = (e) => {
    e.preventDefault();
    const q = cautare.trim();
    navigate(q ? `/cauta-taxe?q=${encodeURIComponent(q)}` : '/cauta-taxe');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <MarcaAplicatie />
        </div>
        <Navigatie />
        <div className="border-t border-slate-200 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
          Datele juridice nu înlocuiesc verificarea la sursa oficială.
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <Sheet open={meniuDeschis} onOpenChange={setMeniuDeschis}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Deschide meniul">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="flex h-16 items-center border-b border-slate-200 px-5 text-left">
                  <MarcaAplicatie />
                </SheetTitle>
                <Navigatie onNavigat={() => setMeniuDeschis(false)} />
              </SheetContent>
            </Sheet>

            <span className="font-heading text-sm font-semibold tracking-tight text-slate-900 lg:hidden">{NUME_APLICATIE}</span>

            <div className="hidden min-w-0 flex-col md:flex">
              <span className="truncate font-heading text-sm font-semibold text-slate-900">{organizatie}</span>
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Building2 className="h-3 w-3" aria-hidden="true" />
                {user?.role === 'admin' ? 'Administrator' : 'Operator / Dispecer'}
              </span>
            </div>

            <form onSubmit={trimiteCautarea} className="ml-auto hidden w-full max-w-xs items-center sm:flex" role="search">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <Input
                  value={cautare}
                  onChange={(e) => setCautare(e.target.value)}
                  placeholder="Caută o localitate…"
                  aria-label="Caută o localitate"
                  className="pl-8"
                />
              </div>
            </form>

            <Link
              to="/alerte"
              className="relative ml-auto flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:ml-0"
              aria-label={`Alerte: ${alerteDeschise} nerezolvate`}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {alerteDeschise > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                  {alerteDeschise > 99 ? '99+' : alerteDeschise}
                </span>
              ) : null}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Profilul utilizatorului">
                  <span className="text-xs font-semibold uppercase">
                    {(user?.full_name || user?.email || 'U').slice(0, 1)}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate text-sm">{user?.full_name || 'Utilizator'}</span>
                  <span className="block truncate text-xs font-normal text-slate-500">{user?.email}</span>
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Rol: {user?.role === 'admin' ? 'Administrator' : 'Operator / Dispecer'}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/setari">Setări și profil</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => logout(true)} className="text-red-700 focus:text-red-800">
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Deconectare
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}