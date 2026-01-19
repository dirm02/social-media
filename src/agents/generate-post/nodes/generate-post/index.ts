import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { ChatAnthropic } from "@langchain/anthropic";
import { GENERATE_POST_PROMPT } from "./prompts.js";
import { formatPrompt, parseGeneration } from "./utils.js";
import {
  getReflectionsPrompt,
  REFLECTIONS_PROMPT,
} from "../../../../utils/reflections.js";
// #region agent log
import { join, dirname } from "path";
import { appendFileSync, mkdirSync } from "fs";
const DEBUG_LOG = join("c:", "Users", "HPProdesk", "Desktop", "NewSaaS", ".cursor", "debug.log");
function debugLog(location: string, message: string, data: Record<string, unknown>) {
  try {
    mkdirSync(dirname(DEBUG_LOG), { recursive: true });
    appendFileSync(DEBUG_LOG, JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: "debug-session", runId: "run1", hypothesisId: "Q" }) + "\n");
  } catch (e) {
    console.log(`[${location}] ${message}`, data);
  }
}
// #endregion

export async function generatePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.report) {
    throw new Error("No report found");
  }
  if (!state.relevantLinks?.length) {
    throw new Error("No relevant links found");
  }
  const postModel = new ChatAnthropic({
    model: "claude-sonnet-4-5",
    temperature: 0.5,
  });

  const prompt = formatPrompt(state.report, state.relevantLinks);

  const reflections = await getReflectionsPrompt(config);
  const reflectionsPrompt = REFLECTIONS_PROMPT.replace(
    "{reflections}",
    reflections,
  );

  const generatePostPrompt = GENERATE_POST_PROMPT.replace(
    "{reflectionsPrompt}",
    reflectionsPrompt,
  );

  // #region agent log
  debugLog("generate-post/index.ts:39", "Before LLM call", {
    reportLength: state.report?.length || 0,
    userPromptLength: prompt.length,
    systemPromptLength: generatePostPrompt.length,
    reportPreview: state.report?.substring(0, 200) || "",
  });
  // #endregion

  const postResponse = await postModel.invoke([
    {
      role: "system",
      content: generatePostPrompt,
    },
    {
      role: "user",
      content: prompt,
    },
  ]);

  const parsedPost = parseGeneration(postResponse.content as string);

  // #region agent log
  debugLog("generate-post/index.ts:59", "After LLM call", {
    rawResponseLength: (postResponse.content as string)?.length || 0,
    parsedPostLength: parsedPost.length,
    parsedPostPreview: parsedPost.substring(0, 200),
  });
  // #endregion

  // Removed automatic scheduling - posts will be immediate by default
  // Users can set a schedule date via Agent Inbox if desired
  // const [postHour, postMinute] = ALLOWED_TIMES[
  //   Math.floor(Math.random() * ALLOWED_TIMES.length)
  // ]
  //   .split(" ")[0]
  //   .split(":");
  // const postDate = getNextSaturdayDate(Number(postHour), Number(postMinute));

  return {
    post: parsedPost,
    // scheduleDate: postDate, // Removed - now posts immediately
  };
}
