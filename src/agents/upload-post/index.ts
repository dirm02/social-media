import {
  Annotation,
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { TwitterClient } from "../../clients/twitter/client.js";
import {
  imageUrlToBuffer,
  isTextOnly,
  shouldPostToLinkedInOrg,
  useArcadeAuth,
  useTwitterApiOnly,
} from "../utils.js";
import { CreateMediaRequest } from "../../clients/twitter/types.js";
import { LinkedInClient } from "../../clients/linkedin.js";
import {
  LINKEDIN_ACCESS_TOKEN,
  LINKEDIN_ORGANIZATION_ID,
  LINKEDIN_PERSON_URN,
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../generate-post/constants.js";
import { SlackClient } from "../../clients/slack/client.js";
import { ComplexPost } from "../shared/nodes/generate-post/types.js";
import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
const DEBUG_LOG = join("c:", "Users", "HPProdesk", "Desktop", "NewSaaS", ".cursor", "debug.log");
const debugLog = (data: any) => { try { mkdirSync(dirname(DEBUG_LOG), {recursive:true}); appendFileSync(DEBUG_LOG, JSON.stringify({...data,timestamp:Date.now()})+"\n"); console.log("[DEBUG]", data.message, data.data); } catch(e){console.error("[DEBUG ERROR]", e);} };

async function getMediaFromImage(image?: {
  imageUrl: string;
  mimeType: string;
}): Promise<CreateMediaRequest | undefined> {
  if (!image) return undefined;
  const { buffer, contentType } = await imageUrlToBuffer(image.imageUrl);
  return {
    media: buffer,
    mimeType: contentType,
  };
}

function ensureSignature(text: string): string {
  const signature = "Made by the LangChain Community";
  if (text.toLowerCase().includes(signature.toLowerCase())) {
    return text;
  }
  return `${text}\n${signature}`;
}

const UploadPostAnnotation = Annotation.Root({
  post: Annotation<string>,
  /**
   * The complex post, if the user decides to split the URL from the main body.
   *
   * TODO: Refactor the post/complexPost state interfaces to use a single shared interface
   * which includes images too.
   * Tracking issue: https://github.com/langchain-ai/social-media-agent/issues/144
   */
  complexPost: Annotation<ComplexPost | undefined>,
  image: Annotation<
    | {
        imageUrl: string;
        mimeType: string;
      }
    | undefined
  >,
});

const UploadPostGraphConfiguration = Annotation.Root({
  [POST_TO_LINKEDIN_ORGANIZATION]: Annotation<boolean | undefined>,
  /**
   * Whether or not to use text only mode throughout the graph.
   * If true, it will not try to extract, validate, or upload images.
   * Additionally, it will not be able to handle validating YouTube videos.
   * @default false
   */
  [TEXT_ONLY_MODE]: Annotation<boolean | undefined>({
    reducer: (_state, update) => update,
    default: () => false,
  }),
});

interface PostUploadFailureToSlackArgs {
  uploadDestination: "twitter" | "linkedin";
  error: any;
  threadId: string;
  postContent: string | ComplexPost;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
}

async function postUploadFailureToSlack({
  uploadDestination,
  error,
  threadId,
  postContent,
  image,
}: PostUploadFailureToSlackArgs) {
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

  const slackMessageContent = `❌ FAILED TO UPLOAD POST TO ${uploadDestination.toUpperCase()} ❌

Error message:
\`\`\`
${error}
\`\`\`

Thread ID: *${threadId}*

${postStr}

${image ? `Image:\nURL: ${image.imageUrl}\nMIME type: ${image.mimeType}` : ""}
`;
  await slackClient.sendMessage(
    process.env.SLACK_CHANNEL_ID,
    slackMessageContent,
  );
}

export async function uploadPost(
  state: typeof UploadPostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof UploadPostAnnotation.State>> {
  // #region agent log
  debugLog({location:'upload-post.ts:145',message:'uploadPost entry',data:{hasPost:!!state.post,hasComplexPost:!!state.complexPost,hasImage:!!state.image,postLength:state.post?.length},sessionId:'debug-session',runId:'run1',hypothesisId:'K,L,N'});
  // #endregion
  if (!state.post) {
    throw new Error("No post text found");
  }
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  // #region agent log
  debugLog({location:'upload-post.ts:155',message:'Upload config',data:{isTextOnly:isTextOnlyMode,postToLinkedInOrg,useArcade:useArcadeAuth(),useTwitterApiOnly:useTwitterApiOnly(),hasTwitterUserId:!!process.env.TWITTER_USER_ID},sessionId:'debug-session',runId:'run1',hypothesisId:'L,N'});
  // #endregion

  try {
    let twitterClient: TwitterClient;

    if (useTwitterApiOnly() || !useArcadeAuth()) {
      // #region agent log
      debugLog({location:'upload-post.ts:165',message:'Using basic Twitter auth',data:{},sessionId:'debug-session',runId:'run1',hypothesisId:'N'});
      // #endregion
      twitterClient = TwitterClient.fromBasicTwitterAuth();
    } else {
      const twitterUserId = process.env.TWITTER_USER_ID;
      if (!twitterUserId) {
        throw new Error("Twitter user ID not found in configurable fields.");
      }

      const twitterToken = process.env.TWITTER_USER_TOKEN;
      const twitterTokenSecret = process.env.TWITTER_USER_TOKEN_SECRET;

      // #region agent log
      debugLog({location:'upload-post.ts:180',message:'Using Arcade Twitter auth',data:{twitterUserId,hasToken:!!twitterToken,hasTokenSecret:!!twitterTokenSecret},sessionId:'debug-session',runId:'run1',hypothesisId:'N,O'});
      // #endregion

      twitterClient = await TwitterClient.fromArcade(
        twitterUserId,
        {
          twitterToken,
          twitterTokenSecret,
        },
        {
          textOnlyMode: isTextOnlyMode,
        },
      );
      // #region agent log
      debugLog({location:'upload-post.ts:195',message:'Twitter client created from Arcade',data:{hasClient:!!twitterClient},sessionId:'debug-session',runId:'run1',hypothesisId:'O'});
      // #endregion
    }

    let mediaBuffer: CreateMediaRequest | undefined = undefined;
    if (!isTextOnlyMode) {
      mediaBuffer = await getMediaFromImage(state.image);
    }

    // #region agent log
    debugLog({location:'upload-post.ts:205',message:'Before Twitter upload',data:{hasComplexPost:!!state.complexPost,hasMediaBuffer:!!mediaBuffer,postPreview:state.post.substring(0,100)},sessionId:'debug-session',runId:'run1',hypothesisId:'O,P'});
    // #endregion

    if (state.complexPost) {
      await twitterClient.uploadThread([
        {
          text: ensureSignature(state.complexPost.main_post),
          ...(mediaBuffer && { media: mediaBuffer }),
        },
        {
          text: state.complexPost.reply_post,
        },
      ]);
    } else {
      await twitterClient.uploadTweet({
        text: ensureSignature(state.post),
        ...(mediaBuffer && { media: mediaBuffer }),
      });
    }

    // #region agent log
    debugLog({location:'upload-post.ts:225',message:'Twitter upload SUCCESS',data:{},sessionId:'debug-session',runId:'run1',hypothesisId:'P'});
    // #endregion
    console.log("✅ Successfully uploaded Tweet ✅");
  } catch (e: any) {
    // #region agent log
    debugLog({location:'upload-post.ts:230',message:'ERROR uploading to Twitter',data:{error:e instanceof Error ? e.message : String(e),stack:e instanceof Error ? e.stack : undefined},sessionId:'debug-session',runId:'run1',hypothesisId:'P'});
    // #endregion
    console.error("Failed to upload post:", e);
    let errorString = "";
    if (typeof e === "object" && "message" in e) {
      errorString = e.message;
    } else {
      errorString = e;
    }
    await postUploadFailureToSlack({
      uploadDestination: "twitter",
      error: errorString,
      threadId:
        config.configurable?.thread_id || "no thread id found in configurable",
      postContent: state.complexPost || state.post,
      image: state.image,
    });
  }

  try {
    let linkedInClient: LinkedInClient;

    if (useArcadeAuth()) {
      const linkedInUserId = process.env.LINKEDIN_USER_ID;
      if (!linkedInUserId) {
        throw new Error("LinkedIn user ID not found in configurable fields.");
      }

      linkedInClient = await LinkedInClient.fromArcade(linkedInUserId, {
        postToOrganization: postToLinkedInOrg,
      });
    } else {
      const accessToken =
        process.env.LINKEDIN_ACCESS_TOKEN ||
        config.configurable?.[LINKEDIN_ACCESS_TOKEN];
      if (!accessToken) {
        throw new Error(
          "LinkedIn access token not found in environment or configurable fields. Either set it, or use Arcade Auth.",
        );
      }

      const personUrn =
        process.env.LINKEDIN_PERSON_URN ||
        config.configurable?.[LINKEDIN_PERSON_URN];
      const organizationId =
        process.env.LINKEDIN_ORGANIZATION_ID ||
        config.configurable?.[LINKEDIN_ORGANIZATION_ID];
      linkedInClient = new LinkedInClient({
        accessToken: accessToken,
        personUrn: personUrn,
        organizationId: organizationId,
      });
    }

    if (!isTextOnlyMode && state.image) {
      await linkedInClient.createImagePost(
        {
          text: ensureSignature(state.post),
          imageUrl: state.image.imageUrl,
        },
        {
          postToOrganization: postToLinkedInOrg,
        },
      );
    } else {
      await linkedInClient.createTextPost(ensureSignature(state.post), {
        postToOrganization: postToLinkedInOrg,
      });
    }

    console.log("✅ Successfully uploaded post to LinkedIn ✅");
  } catch (e: any) {
    console.error("Failed to upload post:", e);
    let errorString = "";
    if (typeof e === "object" && "message" in e) {
      errorString = e.message;
    } else {
      errorString = e;
    }
    await postUploadFailureToSlack({
      uploadDestination: "linkedin",
      error: errorString,
      threadId:
        config.configurable?.thread_id || "no thread id found in configurable",
      postContent: state.complexPost || state.post,
      image: state.image,
    });
  }

  return {};
}

const uploadPostWorkflow = new StateGraph(
  UploadPostAnnotation,
  UploadPostGraphConfiguration,
)
  .addNode("uploadPost", uploadPost)
  .addEdge(START, "uploadPost")
  .addEdge("uploadPost", END);

export const uploadPostGraph = uploadPostWorkflow.compile();
uploadPostGraph.name = "Upload Post Graph";
