import { split } from "sentence-splitter";

export interface IndexedSentence {
  text: string;
  start: number;
  end: number;
  index: number;
}

export interface SentenceIndex {
  sentences: IndexedSentence[];
  count: number;
  texts(): string[];
  wordCounts(): number[];
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function buildSentenceIndex(text: string): SentenceIndex {
  const nodes = split(text);
  const sentences: IndexedSentence[] = [];

  for (const node of nodes) {
    if (node.type !== "Sentence") continue;
    sentences.push({
      text: node.raw,
      start: node.range[0],
      end: node.range[1],
      index: sentences.length,
    });
  }

  return {
    sentences,
    count: sentences.length,
    texts() {
      return sentences.map((s) => s.text);
    },
    wordCounts() {
      return sentences.map((s) => countWords(s.text));
    },
  };
}
