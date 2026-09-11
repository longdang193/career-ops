const DEFAULT_PLACEHOLDER_RE = /\{\{[A-Z_]+\}\}/g;

export function renderTemplate(source, replacements, placeholderRe = DEFAULT_PLACEHOLDER_RE) {
  const unresolved = new Set();
  const rendered = source.replace(placeholderRe, (token) => {
    const value = replacements[token];
    if (value == null) {
      unresolved.add(token);
      return token;
    }
    return value;
  });
  if (unresolved.size) throw new Error(`Unresolved placeholders: ${[...unresolved].join(', ')}`);
  return rendered;
}
