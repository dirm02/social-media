import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { ChatAnthropic } from "@langchain/anthropic";
import { GENERATE_REPORT_PROMPT } from "./prompts.js";
// #region agent log
import { join, dirname } from "path";
import { appendFileSync, mkdirSync } from "fs";
const DEBUG_LOG = join("c:", "Users", "HPProdesk", "Desktop", "NewSaaS", ".cursor", "debug.log");
function debugLog(location: string, message: string, data: Record<string, unknown>) {
  try {
    mkdirSync(dirname(DEBUG_LOG), { recursive: true });
    appendFileSync(DEBUG_LOG, JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "R" }) + "\n");
  } catch (e) {
    console.log(`[${location}] ${message}`, data);
  }
}
// #endregion

/**
 * Parse the LLM generation to extract the report from inside the <report> tag.
 * If the report can not be parsed, the original generation is returned.
 * @param generation The text generation to parse
 * @returns The parsed generation, or the unmodified generation if it cannot be parsed
 */
function parseGeneration(generation: string): string {
  const reportMatch = generation.match(/<report>([\s\S]*?)<\/report>/);
  if (!reportMatch) {
    console.warn(
      "Could not parse report from generation:\nSTART OF GENERATION\n\n",
      generation,
      "\n\nEND OF GENERATION",
    );
  }
  return reportMatch ? reportMatch[1].trim() : generation;
}

const formatReportPrompt = (pageContents: string[]): string => {
  return `The following text contains summaries, or entire pages from the content I submitted to you. Please review the content and generate a report on it.
${pageContents.map((content, index) => `<Content index={${index + 1}}>\n${content}\n</Content>`).join("\n\n")}`;
};

export async function generateContentReport(
  state: typeof GeneratePostAnnotation.State,
  _config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.pageContents?.length) {
    throw new Error(
      "No page contents found. pageContents must be defined to generate a content report.",
    );
  }

  const reportModel = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0,
  });

  const userPrompt = formatReportPrompt(state.pageContents);

  // #region agent log
  debugLog("generate-report/index.ts:44", "Before report generation", {
    pageContentsCount: state.pageContents?.length || 0,
    totalPageContentLength: state.pageContents?.reduce((sum, c) => sum + c.length, 0) || 0,
    userPromptLength: userPrompt.length,
    systemPromptLength: GENERATE_REPORT_PROMPT.length,
  });
  // #endregion

  const result = await reportModel.invoke([
    {
      role: "system",
      content: GENERATE_REPORT_PROMPT,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ]);

  const parsedReport = parseGeneration(result.content as string);

  // #region agent log
  debugLog("generate-report/index.ts:66", "After report generation", {
    rawResponseLength: (result.content as string)?.length || 0,
    parsedReportLength: parsedReport.length,
    parsedReportPreview: parsedReport.substring(0, 300),
  });
  // #endregion

  return {
    report: parsedReport,
  };
}
