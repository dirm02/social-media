import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  BaseGeneratePostState,
  BaseGeneratePostUpdate,
  ComplexPost,
} from "./types.js";
import { Client } from "@langchain/langgraph-sdk";
import {
  getScheduledDateSeconds,
  getFutureDate,
} from "../../../../utils/schedule-date/index.js";
import { SlackClient } from "../../../../clients/slack/client.js";
import { isTextOnly, shouldPostToLinkedInOrg } from "../../../utils.js";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../../../generate-post/constants.js";
import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
const DEBUG_LOG = join("c:", "Users", "HPProdesk", "Desktop", "NewSaaS", ".cursor", "debug.log");
const debugLog = (data: any) => { try { mkdirSync(dirname(DEBUG_LOG), {recursive:true}); appendFileSync(DEBUG_LOG, JSON.stringify({...data,timestamp:Date.now()})+"\n"); console.log("[DEBUG]", data.message, data.data); } catch(e){console.error("[DEBUG ERROR]", e);} };

interface SendSlackMessageArgs {
  isTextOnlyMode: boolean;
  afterSeconds: number | undefined;
  threadId: string;
  runId: string;
  postContent: string | ComplexPost;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
}

async function sendSlackMessage({
  isTextOnlyMode,
  afterSeconds,
  threadId,
  runId,
  postContent,
  image,
}: SendSlackMessageArgs) {
  if (!process.env.SLACK_CHANNEL_ID) {
    console.warn(
      "No SLACK_CHANNEL_ID found in environment variables. Can not send error message to Slack.",
    );
    return;
  }

  const slackClient = new SlackClient();

  const postStr =
    typeof postContent === "string"
      ? `Post:
\`\`\`
${postContent}
\`\`\``
      : `Main post:
\`\`\`
${postContent.main_post}
\`\`\`
Reply post:
\`\`\`
${postContent.reply_post}
\`\`\``;

  const imageString = image?.imageUrl
    ? `Image:
${image?.imageUrl}`
    : "No image provided";

  const messageString = `*New Post Scheduled*
    
Scheduled post for: *${afterSeconds ? getFutureDate(afterSeconds) : "now"}*
Run ID: *${runId}*
Thread ID: *${threadId}*

${postStr}

${!isTextOnlyMode ? imageString : "Text only mode enabled. Image support has been disabled."}`;

  await slackClient.sendMessage(process.env.SLACK_CHANNEL_ID, messageString);
}

export async function schedulePost<
  State extends BaseGeneratePostState = BaseGeneratePostState,
  Update extends BaseGeneratePostUpdate = BaseGeneratePostUpdate,
>(state: State, config: LangGraphRunnableConfig): Promise<Update> {
  // #region agent log
  debugLog({location:'schedule-post.ts:85',message:'schedulePost entry',data:{hasPost:!!state.post,hasComplexPost:!!state.complexPost,hasImage:!!state.image,postLength:state.post?.length},sessionId:'debug-session',runId:'run1',hypothesisId:'K,L'});
  // #endregion
  if (!state.post) {
    throw new Error("No post to schedule found");
  }
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL,
    apiKey: process.env.LANGCHAIN_API_KEY,
  });

  let afterSeconds: number | undefined;
  if (state.scheduleDate) {
    afterSeconds = await getScheduledDateSeconds({
      scheduleDate: state.scheduleDate,
      config,
    });
  }

  // #region agent log
  debugLog({location:'schedule-post.ts:105',message:'Before upload_post creation',data:{afterSeconds,isTextOnly:isTextOnlyMode,postToLinkedInOrg,hasApiUrl:!!process.env.LANGGRAPH_API_URL,hasApiKey:!!process.env.LANGCHAIN_API_KEY},sessionId:'debug-session',runId:'run1',hypothesisId:'K,L,M'});
  // #endregion

  let runId: string | undefined;
  let threadId: string | undefined;
  try {
    const thread = await client.threads.create();
    threadId = thread.thread_id;
    // #region agent log
    debugLog({location:'schedule-post.ts:115',message:'Created upload_post thread',data:{threadId},sessionId:'debug-session',runId:'run1',hypothesisId:'L'});
    // #endregion
    const run = await client.runs.create(thread.thread_id, "upload_post", {
      input: {
        post: state.post,
        complexPost: state.complexPost,
        image: state.image,
      },
      config: {
        configurable: {
          [POST_TO_LINKEDIN_ORGANIZATION]: postToLinkedInOrg,
          [TEXT_ONLY_MODE]: isTextOnlyMode,
        },
      },
      ...(afterSeconds ? { afterSeconds } : {}),
    });
    runId = run.run_id;
    // #region agent log
    debugLog({location:'schedule-post.ts:130',message:'Created upload_post run',data:{runId,threadId,afterSeconds},sessionId:'debug-session',runId:'run1',hypothesisId:'L,M'});
    // #endregion
  } catch (e) {
    // #region agent log
    debugLog({location:'schedule-post.ts:135',message:'ERROR creating upload_post',data:{error:e instanceof Error ? e.message : String(e),stack:e instanceof Error ? e.stack : undefined},sessionId:'debug-session',runId:'run1',hypothesisId:'M'});
    // #endregion
    console.error("Failed to create upload_post run", e);
    throw e;
  }

  if (!runId || !threadId) {
    throw new Error("Failed to create upload_post run");
  }

  try {
    await sendSlackMessage({
      isTextOnlyMode,
      afterSeconds,
      threadId,
      runId,
      postContent: state.complexPost || state.post,
      image: state.image,
    });
  } catch (e) {
    console.error("Failed to send schedule post Slack message", e);
  }

  return {} as Update;
}
