import { Range, type TextDocument, type TextDocumentChangeEvent } from "vscode";

interface DocumentStats {
  readonly wordCount: number;
  readonly language: string;
}

interface LanguageAnalysis {
  readonly version: number;
  readonly sample: string;
  readonly value: string;
}

interface Analysis {
  version: number;
  wordCount: number;
  // Present when each line can be counted independently.
  lines?: number[];
  // Previous text is needed because change events omit deleted text.
  plainLongLine?: string;
  language?: LanguageAnalysis;
  stats?: DocumentStats;
}

const windowSize = 512;
const workBlockSize = 8192;
const dailyHeading = /^#[ \t]+\d{4}-\d{1,2}-\d{1,2}[ \t]+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[ \t]*\r?$/m;
const htmlTag = /<\/?[a-z][\w:-]*(?=[\s/>])(?:[^<>"']|"[^"]*"|'[^']*')*>/gi;

/** Sample the beginning, middle and end without copying the entire note. */
function getLanguageSample(document: TextDocument): string {
  const length = document.offsetAt(document.positionAt(Number.MAX_SAFE_INTEGER));
  if (length <= windowSize * 3) {
    return document.getText();
  }
  const lastStart = length - windowSize;
  return [0, Math.floor(lastStart / 2), lastStart].map(start => {
    const range = new Range(document.positionAt(start), document.positionAt(start + windowSize));
    const excerpt = document.getText(range);
    // A window may start or end halfway through an HTML tag.
    return excerpt.replace(/^[^<>]*>/, "").replace(/<[^<>]*$/, "");
  }).join(".\n");
}

function detectLanguage(sample: string): string {
  const prose = sample.replace(dailyHeading, "").replace(htmlTag, " ");
  const letters = prose.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 4) {
    return "und";
  }

  // Load the profiles on first use, when a visible note has text to classify.
  const { detectAll } = require("tinyld/light") as typeof import("tinyld/light");
  const [first, second] = detectAll(prose);
  // TinyLD scores rank candidates. Treat a short or close contest as inconclusive.
  if (!first || (second && (letters < 10 || first.accuracy < 1.3 * second.accuracy))) {
    return "und";
  }
  return first.lang;
}

const unfinishedTag = /<\/?[A-Za-z][\w:-]*(?=\s|\/?>|$)/;
const ideograph = /\p{Unified_Ideograph}/u;
const highSurrogate = /[\uD800-\uDBFF]/;
const letter = /\p{L}/u;
const longLineLength = 8192;
const editContextLength = 256;

export class DocumentAnalyzer {
  private words?: Intl.Segmenter;
  private readonly documents = new WeakMap<TextDocument, Analysis>();

  analyze(document: TextDocument, refreshLanguage = true): DocumentStats {
    let analysis = this.documents.get(document);
    if (!analysis || analysis.version !== document.version) {
      const scan = this.scan(document);
      let step = scan.next();
      while (!step.done) {
        step = scan.next();
      }
      analysis = step.value;
      this.cache(document, analysis);
    }
    if (refreshLanguage && analysis.language?.version !== document.version) {
      const sample = getLanguageSample(document);
      const value = sample === analysis.language?.sample ? analysis.language.value : detectLanguage(sample);
      analysis.language = { version: document.version, sample, value };
    }
    const language = analysis.language?.value ?? "…";
    if (analysis.stats?.wordCount !== analysis.wordCount || analysis.stats.language !== language) {
      analysis.stats = { wordCount: analysis.wordCount, language };
    }
    return analysis.stats;
  }

  private cache(document: TextDocument, analysis: Analysis): void {
    analysis.language = this.documents.get(document)?.language;
    this.documents.set(document, analysis);
  }

  /** Fill a cold cache in short slices so closing or hiding a large note can interrupt it. */
  prepare(document: TextDocument, signal: AbortSignal): Promise<void> | undefined {
    if (this.documents.get(document)?.version === document.version ||
      document.offsetAt(document.positionAt(Number.MAX_SAFE_INTEGER)) < 48_000) {
      return;
    }
    return this.scanInBackground(document, signal);
  }

  private async scanInBackground(document: TextDocument, signal: AbortSignal): Promise<void> {
    const version = document.version;
    const scan = this.scan(document);
    while (!signal.aborted && document.version === version) {
      await new Promise<void>(resolve => setImmediate(resolve));
      if (signal.aborted || document.version !== version) {
        return;
      }
      const deadline = performance.now() + 5;
      do {
        const step = scan.next();
        if (step.done) {
          this.cache(document, step.value);
          return;
        }
      } while (performance.now() < deadline);
    }
  }

  recordChanges({ document, contentChanges }: TextDocumentChangeEvent): void {
    const analysis = this.documents.get(document);
    if (!analysis?.lines || analysis.version !== document.version - 1 || !contentChanges.length) {
      return;
    }

    const previous = analysis.plainLongLine;
    const current = document.lineCount === 1 ? document.lineAt(0).text : undefined;
    if (previous !== undefined || (current !== undefined && current.length >= longLineLength)) {
      const [change] = contentChanges;
      // Defer edits without a bounded cost to analyze() after typing settles.
      if (previous === undefined || current === undefined || contentChanges.length !== 1 ||
        change.rangeLength > editContextLength || change.text.length > editContextLength || change.text.includes("<")) {
        return;
      }
      const start = change.rangeOffset;
      const end = start + change.rangeLength;
      const before = previous.slice(Math.max(0, start - editContextLength), start);
      const after = previous.slice(end, end + editContextLength);
      // Widen to the complete non-Han words on both sides. An apostrophe or a
      // combining mark can join its neighbors. Whitespace and full Han characters
      // are hard boundaries for countWords, including supplementary-plane Han.
      const left = /[^\s\p{Unified_Ideograph}]*$/u.exec(before)![0];
      const right = /^[^\s\p{Unified_Ideograph}]*/u.exec(after)![0];
      if ((left.length === before.length && start > before.length) ||
        (right.length === after.length && end + after.length < previous.length) ||
        /[\uD800-\uDBFF]$/.test(before) || /^[\uDC00-\uDFFF]/.test(after)) {
        return;
      }
      const removed = this.countWords(left + previous.slice(start, end) + right);
      const inserted = this.countWords(left + change.text + right);
      analysis.wordCount += inserted - removed;
      analysis.lines[0] = analysis.wordCount;
      analysis.plainLongLine = current.length >= longLineLength ? current : undefined;
      analysis.version = document.version;
      return;
    }

    // VS Code supplies ranges in the old document. Lines outside this span retain their counts.
    let first = analysis.lines.length;
    let last = 0;
    for (const { range } of contentChanges) {
      first = Math.min(first, range.start.line);
      last = Math.max(last, range.end.line);
    }
    const removed = last - first + 1;
    const inserted = removed + document.lineCount - analysis.lines.length;
    // Large pastes and widely separated edits get one full scan after typing settles.
    if (Math.max(removed, inserted) > 256) {
      return;
    }

    const counts: number[] = [];
    let difference = 0;
    let length = 0;
    for (let i = 0; i < inserted; i++) {
      const line = document.lineAt(first + i).text;
      length += line.length;
      if (length >= workBlockSize) {
        return;
      }
      const plain = this.visibleLine(line);
      if (plain === undefined) {
        return;
      }
      const count = this.countWords(plain);
      counts.push(count);
      difference += count;
    }
    for (let i = first; i <= last; i++) {
      difference -= analysis.lines[i];
    }
    analysis.lines.splice(first, removed, ...counts);
    analysis.wordCount += difference;
    analysis.version = document.version;
  }

  private *scan(document: TextDocument): Generator<void, Analysis> {
    const version = document.version;
    const lines: number[] = [];
    let plainLongLine: string | undefined;
    let wordCount = 0;
    let blockLength = 0;
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i).text;
      const plain = this.visibleLine(line);
      if (plain === undefined) {
        // Multiline tags require their surrounding text to identify visible words.
        const content = document.getText().replace(htmlTag, "");
        return { version, wordCount: yield* this.countBlocks(content) };
      }
      const count = plain.length > workBlockSize ? yield* this.countBlocks(plain) : this.countWords(plain);
      lines.push(count);
      wordCount += count;
      if (document.lineCount === 1 && line.length >= longLineLength && !line.includes("<")) {
        plainLongLine = line;
      }
      blockLength += line.length + 1;
      if (blockLength >= workBlockSize || (i + 1) % 256 === 0) {
        blockLength = 0;
        yield;
      }
    }
    return { version, wordCount, lines, plainLongLine };
  }

  private visibleLine(line: string): string | undefined {
    if (!line.includes("<")) {
      return line;
    }
    const plain = line.replace(htmlTag, "");
    return unfinishedTag.test(plain) ? undefined : plain;
  }

  private *countBlocks(text: string): Generator<void, number> {
    // A space or a completed ideograph is a safe place to interrupt either counting rule.
    const boundary = /[\s\p{Unified_Ideograph}]/gu;
    let count = 0;
    let start = 0;
    while (start + workBlockSize < text.length) {
      boundary.lastIndex = start + workBlockSize;
      if (!boundary.exec(text)) {
        break;
      }
      count += this.countWords(text.slice(start, boundary.lastIndex));
      start = boundary.lastIndex;
      yield;
    }
    return count + this.countWords(text.slice(start));
  }

  private countWords(text: string): number {
    let count = 0;
    // Han uses written characters in this notebook. ICU handles word boundaries elsewhere.
    for (const [run] of text.matchAll(/\p{Unified_Ideograph}+|[^\s\p{Unified_Ideograph}]+/gu)) {
      if (ideograph.test(run)) {
        if (highSurrogate.test(run)) {
          for (const _character of run) {
            count++;
          }
        } else {
          count += run.length;
        }
      } else if (/^[A-Za-z]+[.,;:!?]?$/.test(run)) {
        count++;
      } else if (letter.test(run)) {
        const words = this.words ??= new Intl.Segmenter("en", { granularity: "word" });
        for (const { segment, isWordLike } of words.segment(run)) {
          if (isWordLike && letter.test(segment)) {
            count++;
          }
        }
      }
    }
    return count;
  }
}
