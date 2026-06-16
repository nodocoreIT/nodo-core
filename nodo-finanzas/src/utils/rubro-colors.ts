// Paleta de colores pastel para rubros (igual que categorías)
const rubroColors = [
  { bg: 'bg-blue-100', text: 'text-blue-800' },
  { bg: 'bg-green-100', text: 'text-green-800' },
  { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  { bg: 'bg-pink-100', text: 'text-pink-800' },
  { bg: 'bg-purple-100', text: 'text-purple-800' },
  { bg: 'bg-orange-100', text: 'text-orange-800' },
  { bg: 'bg-teal-100', text: 'text-teal-800' },
  { bg: 'bg-red-100', text: 'text-red-800' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  { bg: 'bg-lime-100', text: 'text-lime-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800' },
  { bg: 'bg-rose-100', text: 'text-rose-800' },
  { bg: 'bg-violet-100', text: 'text-violet-800' },
  { bg: 'bg-red-100', text: 'text-emerald-800' },
  { bg: 'bg-sky-100', text: 'text-sky-800' },
  { bg: 'bg-stone-100', text: 'text-stone-800' },
  { bg: 'bg-neutral-100', text: 'text-neutral-800' },
];

// Asigna un color a cada rubro de forma determinística
export function getRubroColor(rubroId: string) {
  let hash = 0;
  for (let i = 0; i < rubroId.length; i++) {
    hash = rubroId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % rubroColors.length;
  return rubroColors[idx];
}
