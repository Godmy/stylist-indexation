import { SourceText } from '../../../class/adapter/source-text/index.ts';
import { IndexationSettings } from '../../../class/registry/indexation-settings/index.ts';

/** Final index.ts text: generated block plus the preserved protected section. */
export class IndexContentBuilder {
  static buildIndexContent(
    buildData: { raw_content?: string },
    readData: { raw_content?: string },
  ): string {
    const generated = buildData.raw_content ?? '';
    const lines = SourceText.splitLines(generated);
    if (lines.length) lines[0] = IndexationSettings.marker('AUTO-GENERATED');
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    const block = lines.join('\n');
    const raw = readData.raw_content ?? '';
    let protectedLines =
      raw &&
      !raw.includes(IndexationSettings.marker('AUTO-GENERATED')) &&
      !raw.includes(IndexationSettings.marker('AUTO-PROTECTED'))
        ? SourceText.splitLines(raw)
        : raw
          ? IndexContentBuilder.extractProtectedSection(
              SourceText.splitLines(raw),
            )
          : [];
    const lineSet = new Set(lines.filter((line) => line.trim()));
    protectedLines = IndexContentBuilder.filterProtected(
      protectedLines.filter((line) => !line.trim() || !lineSet.has(line)),
      generated,
    );
    if (!protectedLines.length) return block + '\n';
    const protectedBlock =
      IndexationSettings.marker('AUTO-PROTECTED') +
      '\n\n' +
      protectedLines.join('\n');
    return (block ? block + '\n\n' : '') + protectedBlock + '\n';
  }

  static extractProtectedSection(readLines: string[]): string[] {
    let exportEndIndex: number | null = null;

    for (let idx = 0; idx < readLines.length; idx++) {
      if (idx === 0) continue;
      if (readLines[idx].trim() === '') {
        exportEndIndex = idx;
        break;
      }
    }

    if (exportEndIndex === null) {
      return [];
    }

    let protected_ = readLines.slice(exportEndIndex + 1);

    while (protected_.length > 0 && protected_[0].trim() === '') {
      protected_ = protected_.slice(1);
    }

    if (
      protected_.length > 0 &&
      protected_[0].trim() === IndexationSettings.marker('AUTO-PROTECTED')
    ) {
      protected_ = protected_.slice(1);
      while (protected_.length > 0 && protected_[0].trim() === '') {
        protected_ = protected_.slice(1);
      }
    }

    return protected_;
  }

  private static exportedNames(content: string): Set<string> {
    const names = new Set<string>();
    for (const match of content.matchAll(
      /export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]+['"]/gs,
    )) {
      for (const part of match[1].split(','))
        if (part.trim()) names.add(part.trim().split(' as ').pop()!.trim());
    }
    for (const match of content.matchAll(
      /export\s+const\s+([A-Za-z_$][\w$]*)/g,
    ))
      names.add(match[1]);
    return names;
  }

  private static filterProtected(lines: string[], generated: string): string[] {
    const names = IndexContentBuilder.exportedNames(generated);
    const filtered = lines.filter((line) => {
      const stripped = line.trim();
      if (
        IndexationSettings.config.retiredMarkers.some((label) =>
          stripped.startsWith(`/** AREA: ${label} -> AUTO-GENERATED`),
        )
      )
        return false;
      if (
        stripped === '}' ||
        stripped.startsWith('} from ') ||
        stripped.startsWith('from ') ||
        stripped.endsWith(',')
      )
        return false;
      if (/^\s*[A-Za-z_$][\w$]*\s*$/.test(line)) return false;
      const match = line.match(
        /^\s*export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/,
      );
      if (match) {
        const exports = match[1]
          .split(',')
          .filter((part) => part.trim())
          .map((part) => part.trim().split(' as ').pop()!.trim());
        if (exports.length && exports.every((name) => names.has(name)))
          return false;
      }
      if (/^\s*export\s+const\s+([A-Za-z_$][\w$]*)\b/.test(line)) return false;
      return true;
    });
    while (filtered.length && !filtered[filtered.length - 1].trim())
      filtered.pop();
    return filtered;
  }
}
