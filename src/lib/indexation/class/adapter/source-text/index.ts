import * as fs from 'node:fs';

/** Line and order semantics of source text, independent of the platform. */
export class SourceText {
  /** UTF-8 text with every line ending read as `\n`. */
  static readText(target: string): string {
    return fs.readFileSync(target, 'utf8').replace(/\r\n?/g, '\n');
  }

  /** Lines without their endings; a trailing line ending adds no empty line. */
  static splitLines(content: string): string[] {
    if (!content) return [];
    const lines = content.split(/\r\n|\r|\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  /** Code point order, stable across locales. */
  static compareText(a: string, b: string): number {
    const left = Array.from(a, (char) => char.codePointAt(0)!);
    const right = Array.from(b, (char) => char.codePointAt(0)!);
    for (let i = 0; i < Math.min(left.length, right.length); i++)
      if (left[i] !== right[i]) return left[i] - right[i];
    return left.length - right.length;
  }

  /**
   * Writes `content` (with `\n` endings) keeping the line ending style of the
   * existing file; new files get `\n`.
   */
  static writeText(target: string, content: string): void {
    let crlf = false;
    try {
      crlf = fs.readFileSync(target, 'utf8').includes('\r\n');
    } catch {
      crlf = false;
    }
    fs.writeFileSync(
      target,
      crlf ? content.replace(/\r?\n/g, '\r\n') : content,
      'utf8',
    );
  }
}
