/** Count Chinese characters and English words. Ignore HTML tags in the count. */
export function getDocumentStats(text: string): { wordCount: number; language: "zh" | "en" } {
  const language = /[\u3400-\u4DBF\u4E00-\u9FFF]/.test(text) ? "zh" : "en";
  const content = text.replace(/<[^>]+>/g, "");
  const characters = content.match(/[\u3400-\u4DBF\u4E00-\u9FFF]/g);
  const words = content.match(/[a-zA-Z]+/g);
  return { wordCount: (characters?.length ?? 0) + (words?.length ?? 0), language };
}
