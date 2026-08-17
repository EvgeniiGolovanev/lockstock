function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
}

function summarizeAssets(entries) {
  const largest = [...entries]
    .sort((left, right) => right.bytes - left.bytes || left.path.localeCompare(right.path))
    .slice(0, 10);

  return {
    fileCount: entries.length,
    totalBytes: entries.reduce((total, entry) => total + entry.bytes, 0),
    largest
  };
}

function extractLocalMarkdownLinks(markdown) {
  const directMatches = markdown.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g);
  const referenceDefinitions = new Map(
    [...markdown.matchAll(/^\s*\[([^\]]+)\]:\s*(\S+)/gm)].map((match) => [match[1].trim().toLowerCase(), match[2]])
  );
  const referenceMatches = [...markdown.matchAll(/!?\[[^\]]+\]\[([^\]]+)\]/g)]
    .map((match) => referenceDefinitions.get(match[1].trim().toLowerCase()) ?? `__missing_reference__/${match[1]}`);

  return [...directMatches]
    .map((match) => match[1])
    .concat(referenceMatches)
    .filter((target) => !/^(?:https?:|mailto:|tel:)/i.test(target));
}

function findUnexpectedFiles(expected, actual) {
  const expectedSet = new Set(expected);
  return actual.filter((file) => !expectedSet.has(file)).sort();
}

module.exports = { extractLocalMarkdownLinks, findUnexpectedFiles, formatBytes, summarizeAssets };
