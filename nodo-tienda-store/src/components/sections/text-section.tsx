export function TextSection({
  title,
  content,
}: {
  title?: string | null;
  content: string;
}) {
  return (
    <section className="max-w-2xl mx-auto text-center">
      {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
      {content && <p className="text-slate-600 leading-relaxed">{content}</p>}
    </section>
  );
}
