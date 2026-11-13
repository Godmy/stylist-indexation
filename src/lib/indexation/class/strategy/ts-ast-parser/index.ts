import ts from 'typescript';
import type { ExportBucket } from '../../../type/alias/export-bucket/index.ts';
import type { ExportEntry } from '../../../interface/contract/export-entry/index.ts';
import type { ImportEntry } from '../../../interface/contract/import-entry/index.ts';
import type { ModuleEdge } from '../../../interface/contract/module-edge/index.ts';
import type { ParsedExports } from '../../../interface/contract/parsed-exports/index.ts';
import type { ParsedImports } from '../../../interface/contract/parsed-imports/index.ts';
import type { TsParser } from '../../../interface/contract/ts-parser/index.ts';

/** Exports and imports of TS code, parsed with the TypeScript compiler API. */
export class TsAstParser implements TsParser {
  /** Top-level exports of TS code. */
  parseExports(content: string, fileName?: string): ParsedExports {
    const source = TsAstParser.createTsSource(content, fileName);
    const result: ParsedExports = {
      default: [],
      type: [],
      transit: [],
      interface: [],
    };
    const localBuckets = TsAstParser.collectLocalBuckets(source);
    const seen = new Set<string>();

    const push = (bucket: ExportBucket, entry: ExportEntry) => {
      const key = `${bucket}\0${entry.name}\0${entry.from ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      result[bucket].push(entry);
    };

    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement)) {
        const from = TsAstParser.moduleSpecifierText(statement.moduleSpecifier);
        const clause = statement.exportClause;

        if (!clause) {
          // `export * from` re-exports values; `export type * from` has no value barrel equivalent.
          if (from && !statement.isTypeOnly) result.transit.push({ from });
          continue;
        }
        // `export * as ns from` publishes a name the target module does not have.
        if (!ts.isNamedExports(clause)) continue;

        for (const element of clause.elements) {
          const name = element.name.text;
          const localName = (element.propertyName ?? element.name).text;
          if (name === 'default') continue;

          if (statement.isTypeOnly || element.isTypeOnly) {
            push('type', { name, from: from ?? 'local' });
          } else if (from) {
            push(
              localName === 'default'
                ? 'default'
                : TsAstParser.bucketByName(name),
              { name, from },
            );
          } else {
            push(
              localBuckets.get(localName) ?? TsAstParser.bucketByName(name),
              { name, from: 'local' },
            );
          }
        }
        continue;
      }

      if (ts.isExportAssignment(statement)) {
        if (
          !statement.isExportEquals &&
          ts.isIdentifier(statement.expression)
        ) {
          push('default', { name: statement.expression.text, from: 'default' });
        }
        continue;
      }

      if (!TsAstParser.hasModifier(statement, ts.SyntaxKind.ExportKeyword))
        continue;
      const isDefault = TsAstParser.hasModifier(
        statement,
        ts.SyntaxKind.DefaultKeyword,
      );

      if (ts.isTypeAliasDeclaration(statement)) {
        push('type', {
          name: statement.name.text,
          assign: statement.type.getText(source),
        });
      } else if (ts.isInterfaceDeclaration(statement)) {
        if (isDefault)
          push('default', { name: statement.name.text, from: 'default' });
        else
          push('interface', {
            name: statement.name.text,
            assign: TsAstParser.blockText(
              content,
              statement.members,
              statement.end,
            ),
          });
      } else if (ts.isEnumDeclaration(statement)) {
        push('interface', {
          name: statement.name.text,
          assign: TsAstParser.blockText(
            content,
            statement.members,
            statement.end,
          ),
        });
      } else if (
        ts.isClassDeclaration(statement) ||
        ts.isFunctionDeclaration(statement)
      ) {
        if (!statement.name) continue;
        const marker = isDefault
          ? 'default'
          : ts.isClassDeclaration(statement)
            ? 'class'
            : 'function';
        push('default', { name: statement.name.text, from: marker });
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) {
            for (const name of TsAstParser.bindingNames(declaration.name))
              push('default', { name });
            continue;
          }
          const assign = TsAstParser.variableAssign(content, declaration);
          push(
            'default',
            assign
              ? { name: declaration.name.text, assign }
              : { name: declaration.name.text },
          );
        }
      } else if (
        ts.isModuleDeclaration(statement) &&
        ts.isIdentifier(statement.name)
      ) {
        push('default', { name: statement.name.text, from: 'namespace' });
      }
    }

    return result;
  }

  /** Local names bound by top-level static imports; side-effect imports bind nothing. */
  parseImports(content: string, fileName?: string): ParsedImports {
    const importTypes: ImportEntry[] = [];
    const importData: ImportEntry[] = [];

    for (const statement of TsAstParser.createTsSource(content, fileName)
      .statements) {
      if (!ts.isImportDeclaration(statement) || !statement.importClause)
        continue;
      const from = TsAstParser.moduleSpecifierText(statement.moduleSpecifier);
      if (!from) continue;

      const clause = statement.importClause;
      const push = (name: string, isType: boolean) =>
        (isType ? importTypes : importData).push({ name, from });

      if (clause.name) push(clause.name.text, clause.isTypeOnly);

      const bindings = clause.namedBindings;
      if (!bindings) continue;
      if (ts.isNamespaceImport(bindings)) {
        push(bindings.name.text, clause.isTypeOnly);
        continue;
      }
      for (const element of bindings.elements) {
        push(element.name.text, clause.isTypeOnly || element.isTypeOnly);
      }
    }

    return { type: importTypes, data: importData };
  }

  static createTsSource(
    content: string,
    fileName: string = 'index.ts',
  ): ts.SourceFile {
    return ts.createSourceFile(
      fileName,
      content,
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TS,
    );
  }

  /** Static import / `export ... from` edges of TS code or of every `<script>` block of a Svelte file. */
  static collectModuleEdges(content: string, filePath: string): ModuleEdge[] {
    const sources = filePath.endsWith('.svelte')
      ? TsAstParser.svelteScriptBlocks(content)
      : [content];
    const edges: ModuleEdge[] = [];

    for (const code of sources) {
      for (const statement of TsAstParser.createTsSource(code, filePath)
        .statements) {
        if (ts.isImportDeclaration(statement)) {
          const specifier = TsAstParser.moduleSpecifierText(
            statement.moduleSpecifier,
          );
          const namedBindings = statement.importClause?.namedBindings;
          if (!specifier || !statement.importClause) continue;
          const requested =
            namedBindings && ts.isNamedImports(namedBindings)
              ? namedBindings.elements.map(
                  (element) => (element.propertyName ?? element.name).text,
                )
              : [];
          edges.push({
            origin: 'import',
            specifier,
            requested_names: requested,
            exported_names: [],
          });
        } else if (ts.isExportDeclaration(statement)) {
          const specifier = TsAstParser.moduleSpecifierText(
            statement.moduleSpecifier,
          );
          if (!specifier) continue;
          const clause = statement.exportClause;
          const exported =
            clause && ts.isNamedExports(clause)
              ? clause.elements.map((element) => element.name.text)
              : [];
          edges.push({
            origin: 'reexport',
            specifier,
            requested_names: [],
            exported_names: exported,
          });
        }
      }
    }

    return edges;
  }

  private static hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    return (ts.getModifiers(node) ?? []).some(
      (modifier) => modifier.kind === kind,
    );
  }

  private static moduleSpecifierText(
    specifier: ts.Expression | undefined,
  ): string | undefined {
    return specifier && ts.isStringLiteral(specifier)
      ? specifier.text
      : undefined;
  }

  /** `{ ... }` body of an interface or enum, exactly as written in the source. */
  private static blockText(
    content: string,
    members: ts.NodeArray<ts.Node>,
    end: number,
  ): string {
    return content.slice(members.pos - 1, end).trim();
  }

  private static bindingNames(name: ts.BindingName): string[] {
    if (ts.isIdentifier(name)) return [name.text];
    const names: string[] = [];
    for (const element of name.elements) {
      if (ts.isBindingElement(element))
        names.push(...TsAstParser.bindingNames(element.name));
    }
    return names;
  }

  private static svelteScriptBlocks(content: string): string[] {
    return [...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(
      (match) => match[1],
    );
  }

  /** Re-exported names can't be resolved without the target file; keep the naming convention. */
  private static bucketByName(name: string): ExportBucket {
    return name.endsWith('Props') ||
      name.endsWith('Context') ||
      name.endsWith('Interface')
      ? 'interface'
      : 'default';
  }

  /** Bucket of every top-level name, for `export { a, b }` without `from`. */
  private static collectLocalBuckets(
    source: ts.SourceFile,
  ): Map<string, ExportBucket> {
    const buckets = new Map<string, ExportBucket>();

    for (const statement of source.statements) {
      if (ts.isTypeAliasDeclaration(statement)) {
        buckets.set(statement.name.text, 'type');
      } else if (
        ts.isInterfaceDeclaration(statement) ||
        ts.isEnumDeclaration(statement)
      ) {
        buckets.set(statement.name.text, 'interface');
      } else if (
        (ts.isClassDeclaration(statement) ||
          ts.isFunctionDeclaration(statement) ||
          ts.isModuleDeclaration(statement)) &&
        statement.name &&
        ts.isIdentifier(statement.name)
      ) {
        buckets.set(statement.name.text, 'default');
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          for (const name of TsAstParser.bindingNames(declaration.name))
            buckets.set(name, 'default');
        }
      } else if (ts.isImportDeclaration(statement) && statement.importClause) {
        const clause = statement.importClause;
        const imported = (name: string, isType: boolean) =>
          buckets.set(name, isType ? 'type' : TsAstParser.bucketByName(name));
        if (clause.name) imported(clause.name.text, clause.isTypeOnly);
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings))
          imported(bindings.name.text, clause.isTypeOnly);
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements)
            imported(
              element.name.text,
              clause.isTypeOnly || element.isTypeOnly,
            );
        }
      }
    }

    return buckets;
  }

  /** `: T = value` / `= value` after the binding name, as the regex parser stored it. */
  private static variableAssign(
    content: string,
    declaration: ts.VariableDeclaration,
  ): string {
    return content
      .slice(declaration.name.end, declaration.end)
      .trim()
      .replace(/^[:=]/, '')
      .trim();
  }
}
