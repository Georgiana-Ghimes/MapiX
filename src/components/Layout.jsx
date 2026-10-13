import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
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
import HeaderLocalitateSearch from '@/components/HeaderLocalitateSearch';
import { Button } from '@/components/ui/button';
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
import AppVersion from '@/components/AppVersion';
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

function Navigatie({ onNavigat, nrAlerte = 0 }) {
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
              'flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-800 hover:bg-slate-100 hover:text-slate-950'
            )
          }
        >
          <Icon className="h-5 w-5 shrink-0" strokeWidth={2.35} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{nume}</span>
          {cale === '/alerte' && nrAlerte > 0 ? (
            <span
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold tabular-nums text-white"
              aria-label={`${nrAlerte} alerte nerezolvate`}
            >
              {nrAlerte > 99 ? '99+' : nrAlerte}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [alerteDeschise, setAlerteDeschise] = useState(0);
  const [meniuMobil, setMeniuMobil] = useState(false);

  useEffect(() => {
    api.entities.Alerta.count({
      status: { $in: ['Nouă', 'În lucru'] },
      severitate: { $in: ['Critică', 'Ridicată'] },
    })
      .then(setAlerteDeschise)
      .catch(() => setAlerteDeschise(0));
  }, []);

  const organizatie = user?.nume_organizatie || user?.full_name || 'Organizația mea';

  return (
    <div className="bg-app-canvas min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r-2 border-slate-400 bg-white lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b-2 border-slate-300 px-5">
          <MarcaAplicatie />
        </div>
        <Navigatie nrAlerte={alerteDeschise} />
        <div className="shrink-0 space-y-2 border-t-2 border-slate-300 px-4 py-3">
          <p className="text-[11px] leading-relaxed text-slate-700">
            Datele juridice nu înlocuiesc verificarea la sursa oficială.
          </p>
          <AppVersion />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="relative flex h-16 items-center gap-3 px-4 lg:px-6">
            <Sheet open={meniuMobil} onOpenChange={setMeniuMobil}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Deschide meniul">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col p-0">
                <SheetTitle className="flex h-16 items-center border-b border-slate-200 px-5 text-left">
                  <MarcaAplicatie />
                </SheetTitle>
                <Navigatie nrAlerte={alerteDeschise} onNavigat={() => setMeniuMobil(false)} />
                <div className="mt-auto border-t border-slate-200 px-4 py-3">
                  <AppVersion />
                </div>
              </SheetContent>
            </Sheet>

            <span className="font-heading text-sm font-semibold tracking-tight text-slate-900 lg:hidden">
              {NUME_APLICATIE}
            </span>

            <div className="pointer-events-none absolute inset-x-0 hidden flex-col items-center justify-center md:flex">
              <span className="max-w-[min(20rem,40vw)] truncate text-center font-heading text-sm font-semibold text-slate-900">
                {organizatie}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                <Building2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
                {user?.role === 'admin' ? 'Administrator' : 'Operator / Dispecer'}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <HeaderLocalitateSearch />

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
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
