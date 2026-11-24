export function createSearchHighlighter(query: string) {
  const q = query.trim();
  const matchPattern = q ? new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'giu') : null;
  return (text: string) => {
    if (!matchPattern) return text;
    return text.split(matchPattern).map((part, index) =>
      index % 2 ? <span key={index} className="text-red-700">{part}</span> : part,
    );
  };
}
