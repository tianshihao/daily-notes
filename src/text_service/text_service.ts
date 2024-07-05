/**
 * TextService is a singleton class that provides functionalities to count words in a text,
 * detect and cache the language of the text, and retrieve the language for a given filename.
 * It supports English and Chinese languages, with special handling for Chinese text.
 */
class TextService {
  private static instance: TextService; // Singleton instance of TextService
  private languageCache: Map<string, string>; // Cache mapping filenames to their detected languages
  private chineseCharacterPattern: RegExp = /[\u4e00-\u9fff\u3400-\u4DBF]/g;
  private englishWordPattern: RegExp = /[a-zA-Z]+/g;
  // private japaneseCharacterPattern: RegExp = /[\u3040-\u309F\u30A0-\u30FF]/;
  // private koreanCharacterPattern: RegExp = /[\uAC00-\uD7AF]/;

  /**
   * Returns the singleton instance of the TextService class.
   * If an instance does not exist, it creates a new one.
   * @returns The singleton instance of the TextService class.
   */
  public static getInstance(): TextService {
    if (!TextService.instance) {
      TextService.instance = new TextService();
    }
    return TextService.instance;
  }

  /**
   * The constructor is private to prevent instantiation outside the class.
   * Initializes the language cache.
   */
  private constructor() {
    this.languageCache = new Map<string, string>();
  }

  /**
   * Counts the number of words in the given text.
   * If the language of the text is Chinese (zh), it counts the number of characters without spaces.
   * Otherwise, it counts the number of words separated by spaces.
   * @param text - The text to analyze.
   * @param filename - The name of the file containing the text.
   * @returns The number of words in the text.
   */
  public countWords(text: string, filename: string): number {
    this.detectAndCacheLanguage(text, filename);

    // const language = this.languageCache.get(filename);
    text = text.replace(/(<([^>]+)>)/gi, ""); // Remove HTML tags

    const chineseWordCount =
      text.match(this.chineseCharacterPattern)?.length ?? 0;
    const englishWordCount = text.match(this.englishWordPattern)?.length ?? 0;
    return chineseWordCount + englishWordCount; // Count characters for Chinese (including spaces)
  }

  /**
   * Retrieves the language associated with the specified filename from the cache.
   * @param filename - The name of the file.
   * @returns The language associated with the filename, or undefined if not found.
   */
  public getLanguage(filename: string): string | undefined {
    return this.languageCache.get(filename);
  }

  /**
   * Detects the language of the given text and stores it in the cache.
   * Currently, it can detect English and Chinese based on the presence of Chinese characters.
   * @param text The text to detect the language of.
   * @param filename The name of the file the text is associated with.
   */
  private detectAndCacheLanguage(text: string, filename: string): void {
    const detectedLanguage = this.detectLanguage(text);
    this.languageCache.set(filename, detectedLanguage);
  }

  /**
   * Detects the language of the given text. This is a simplified version.
   * If the text contains Chinese characters, it assumes the language is Chinese.
   * Otherwise, it assumes English.
   * @param text The text to detect the language of.
   * @returns The detected language ('en' or 'zh').
   */
  private detectLanguage(text: string): string {
    if (this.chineseCharacterPattern.test(text)) {
      return "zh"; // Chinese
    } else {
      return "en"; // Default to English
    }
  }
}

// Export the singleton instance of the TextService
export const textService = TextService.getInstance();
