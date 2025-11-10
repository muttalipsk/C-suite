export interface ParsedRecommendation {
  keyRecommendations: string[];
  rationale: string;
  pitfalls: string[];
  nextSteps: string;
}

export function isHtmlContent(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

export function parseRecommendation(text: string): ParsedRecommendation {
  const sections: ParsedRecommendation = {
    keyRecommendations: [],
    rationale: "",
    pitfalls: [],
    nextSteps: "",
  };

  // Use [\s\S]*? instead of /s flag for ES5+ compatibility
  const keyRecsMatch = text.match(/\*\*Key Recommendations\*\*:?\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);
  const rationaleMatch = text.match(/\*\*Rationale\s*[&and]*\s*Insights\*\*:?\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);
  const pitfallsMatch = text.match(/\*\*Potential Pitfalls\s*[&and]*\s*Mitigations\*\*:?\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);
  const nextStepsMatch = text.match(/\*\*Next Steps\s*[&and]*\s*Follow-Up\*\*:?\s*([\s\S]*?)(?=\*\*[A-Z]|$)/);

  if (keyRecsMatch) {
    const bullets = keyRecsMatch[1].match(/[-•]\s*(.+?)(?=\n[-•]|\n\n|$)/g);
    sections.keyRecommendations = bullets?.map(b => b.replace(/^[-•]\s*/, '').trim()) || [];
  }
  if (rationaleMatch) sections.rationale = rationaleMatch[1].trim();
  if (pitfallsMatch) {
    const bullets = pitfallsMatch[1].match(/[-•]\s*(.+?)(?=\n[-•]|\n\n|$)/g);
    sections.pitfalls = bullets?.map(b => b.replace(/^[-•]\s*/, '').trim()) || [];
  }
  if (nextStepsMatch) sections.nextSteps = nextStepsMatch[1].trim();

  return sections;
}
