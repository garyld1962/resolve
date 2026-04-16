/* Pill-shaped outlined tags per DESIGN.md §4 Technology Tags.
   M1 keeps them uniform; category colors arrive with tag management in a later milestone. */
export function TechnologyTag({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-steel-edge bg-transparent px-[0.625rem] py-1 text-xs text-silver-mist">
      {name}
    </span>
  );
}

export function TechnologyTagList({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <TechnologyTag key={t} name={t} />
      ))}
    </div>
  );
}
