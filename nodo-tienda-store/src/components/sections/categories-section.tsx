import type { CategoryData } from "@/lib/get-categories";

export function CategoriesSection({
  title,
  categories,
  slug,
}: {
  title?: string | null;
  categories: CategoryData[];
  slug: string;
}) {
  if (categories.length === 0) return null;

  return (
    <section>
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <a
            key={cat.id}
            href={`/${slug}/catalog?category=${cat.slug}`}
            className="flex items-center justify-center rounded-xl border border-slate-200 p-6 text-center font-medium text-slate-700 hover:shadow-md hover:border-slate-300 transition"
          >
            {cat.name}
          </a>
        ))}
      </div>
    </section>
  );
}
