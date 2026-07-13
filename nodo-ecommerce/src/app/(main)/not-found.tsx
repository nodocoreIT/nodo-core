import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-gold text-xs tracking-[0.5em] uppercase mb-4">Error 404</p>
        <h1 className="font-serif text-5xl text-black mb-4">Página no encontrada</h1>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          La fragancia que buscás no existe o fue movida. Explorá nuestro catálogo completo.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="bg-gold text-black font-bold px-8 py-3 text-sm tracking-wider uppercase hover:bg-gold-light transition-colors"
          >
            Ir al Inicio
          </Link>
          <Link
            href="/productos"
            className="border border-gold/40 text-gold font-semibold px-8 py-3 text-sm hover:bg-gold/10 transition-colors"
          >
            Ver Catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
