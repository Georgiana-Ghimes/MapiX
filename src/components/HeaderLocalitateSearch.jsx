import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '@/api/client';
import { Input } from '@/components/ui/input';
import { contineFaraDiacritice, faraDiacritice } from '@/lib/format';

let cacheLocalitati = null;
let cachePromise = null;

function incarcaCatalog() {
  if (cacheLocalitati) return Promise.resolve(cacheLocalitati);
  if (cachePromise) return cachePromise;
  cachePromise = api.entities.Localitate.filter(
    { archived: { $ne: true } },
    { sort: 'nume', limit: 500, fields: ['nume', 'judet'] }
  )
    .then((page) => {
      cacheLocalitati = page.items || [];
      return cacheLocalitati;
    })
    .catch((e) => {
      cachePromise = null;
      throw e;
    });
  return cachePromise;
}

/**
 * Căutare header: sugestii locale; navigare doar când există match clar.
 * Folosește ?localitate=id (stabil) + q=nume (afișare).
 */
export default function HeaderLocalitateSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const wrapRef = useRef(null);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [catalog, setCatalog] = useState(cacheLocalitati || []);
  const [deschis, setDeschis] = useState(false);
  const [activ, setActiv] = useState(0);
  const [mesaj, setMesaj] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const peClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setDeschis(false);
    };
    document.addEventListener('mousedown', peClick);
    return () => document.removeEventListener('mousedown', peClick);
  }, []);

  // Sync text din URL când e pe Caută taxe
  useEffect(() => {
    if (!location.pathname.startsWith('/cauta-taxe')) return;
    const q = new URLSearchParams(location.search).get('q');
    if (q) setText(q);
  }, [location.pathname, location.search]);

  const sugestii = useMemo(() => {
    if (debounced.length < 2) return [];
    const exact = [];
    const partial = [];
    const q = faraDiacritice(debounced);
    for (const l of catalog) {
      const n = faraDiacritice(l.nume);
      if (n === q) exact.push(l);
      else if (contineFaraDiacritice(l.nume, debounced)) partial.push(l);
    }
    return [...exact, ...partial].slice(0, 8);
  }, [catalog, debounced]);

  const asiguraCatalog = () => {
    if (cacheLocalitati) {
      setCatalog(cacheLocalitati);
      return;
    }
    incarcaCatalog()
      .then(setCatalog)
      .catch(() => setCatalog([]));
  };

  const duLaLocalitate = (loc) => {
    if (!loc?.id) return;
    setDeschis(false);
    setMesaj('');
    setText(loc.nume);
    const params = new URLSearchParams();
    params.set('localitate', loc.id);
    params.set('q', loc.nume);
    // păstrează durata/masa dacă ești deja pe pagina de căutare
    if (location.pathname.startsWith('/cauta-taxe')) {
      const cur = new URLSearchParams(location.search);
      if (cur.get('masa')) params.set('masa', cur.get('masa'));
      if (cur.get('durata')) params.set('durata', cur.get('durata'));
    }
    navigate(`/cauta-taxe?${params.toString()}`, { replace: location.pathname.startsWith('/cauta-taxe') });
  };

  const potriviriPentru = (qRaw) => {
    const q = qRaw.trim();
    if (q.length < 2) return [];
    const exact = [];
    const partial = [];
    const qn = faraDiacritice(q);
    for (const l of catalog) {
      const n = faraDiacritice(l.nume);
      if (n === qn) exact.push(l);
      else if (contineFaraDiacritice(l.nume, q)) partial.push(l);
    }
    return [...exact, ...partial];
  };

  const trimite = (optiuni = {}) => {
    const q = text.trim();
    if (q.length < 2) {
      setMesaj('Tastează cel puțin 2 caractere.');
      setDeschis(true);
      return;
    }
    // Folosim textul curent (nu debounce) — Enter pe „test” nu trebuie să ia sugestia veche.
    const lista = potriviriPentru(q);
    const evidentiata = optiuni.folosesteActiv ? lista[activ] : null;
    const match =
      (evidentiata && contineFaraDiacritice(evidentiata.nume, q) ? evidentiata : null) ||
      lista.find((l) => faraDiacritice(l.nume) === faraDiacritice(q)) ||
      catalog.find((l) => faraDiacritice(l.nume) === faraDiacritice(q)) ||
      (lista.length === 1 ? lista[0] : null);
    if (!match) {
      setMesaj(`Nicio localitate pentru „${q}”. Alege din listă.`);
      setDeschis(true);
      // Nu naviga — fără refresh / fără ?q=test
      return;
    }
    duLaLocalitate(match);
  };

  return (
    <form
      ref={wrapRef}
      role="search"
      className="relative hidden w-full max-w-xs sm:block"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        trimite({ folosesteActiv: true });
      }}
    >
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActiv(0);
            setMesaj('');
            setDeschis(true);
          }}
          onFocus={() => {
            asiguraCatalog();
            setDeschis(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDeschis(false);
              return;
            }
            if (!deschis || !sugestii.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiv((i) => Math.min(i + 1, sugestii.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiv((i) => Math.max(i - 1, 0));
            }
          }}
          placeholder="Caută o localitate…"
          aria-label="Caută o localitate"
          aria-autocomplete="list"
          aria-expanded={deschis && (sugestii.length > 0 || !!mesaj)}
          className="pl-8"
          autoComplete="off"
        />
      </div>
      {deschis && (debounced.length >= 2 || mesaj) ? (
        <ul
          className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-72 overflow-auto rounded-lg border-2 border-slate-300/80 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {mesaj && !sugestii.length ? (
            <li className="px-3 py-2 text-xs text-amber-800">{mesaj}</li>
          ) : null}
          {sugestii.length === 0 && !mesaj ? (
            <li className="px-3 py-2 text-xs text-slate-500">Nicio localitate în catalog pentru „{debounced}”.</li>
          ) : (
            sugestii.map((l, i) => (
              <li key={l.id} role="option" aria-selected={i === activ}>
                <button
                  type="button"
                  className={`flex w-full flex-col px-3 py-2 text-left text-sm ${
                    i === activ ? 'bg-blue-50 text-blue-900' : 'text-slate-800 hover:bg-slate-50'
                  }`}
                  onMouseEnter={() => setActiv(i)}
                  onClick={() => duLaLocalitate(l)}
                >
                  <span className="font-medium">{l.nume}</span>
                  {l.judet ? <span className="text-xs text-slate-500">{l.judet}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </form>
  );
}
