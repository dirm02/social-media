import { interrupt, LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../generate-post-state.js";
import { getLinkedInAuthOrInterrupt } from "../../shared/auth/linkedin.js";
import { getTwitterAuthOrInterrupt } from "../../shared/auth/twitter.js";
import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";
import { shouldPostToLinkedInOrg } from "../../utils.js";
import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
const DEBUG_LOG = join("c:", "Users", "HPProdesk", "Desktop", "NewSaaS", ".cursor", "debug.log");
const debugLog = (data: any) => { try { mkdirSync(dirname(DEBUG_LOG), {recursive:true}); appendFileSync(DEBUG_LOG, JSON.stringify({...data,timestamp:Date.now()})+"\n"); console.log("[DEBUG]", data.message, data.data); } catch(e){console.error("[DEBUG ERROR]", e);} };

export async function authSocialsPassthrough(
  _state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
) {
  // #region agent log
  debugLog({location:'auth-socials.ts:8',message:'authSocialsPassthrough entry',data:{hasLinkedInUserId:!!process.env.LINKEDIN_USER_ID,hasTwitterUserId:!!process.env.TWITTER_USER_ID},sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'});
  // #endregion
  let linkedInHumanInterrupt: HumanInterrupt | undefined = undefined;
  const linkedInUserId = process.env.LINKEDIN_USER_ID;
  if (linkedInUserId) {
    const postToLinkedInOrg = shouldPostToLinkedInOrg(config);
    // #region agent log
    debugLog({location:'auth-socials.ts:16',message:'Before LinkedIn auth call',data:{linkedInUserId,postToLinkedInOrg},sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'});
    // #endregion
    linkedInHumanInterrupt = await getLinkedInAuthOrInterrupt({
      linkedInUserId,
      returnInterrupt: true,
      postToOrg: postToLinkedInOrg,
    });
    // #region agent log
    debugLog({location:'auth-socials.ts:21',message:'After LinkedIn auth call',data:{hasInterrupt:!!linkedInHumanInterrupt,interruptArgs:linkedInHumanInterrupt?.action_request?.args,interruptAction:linkedInHumanInterrupt?.action_request?.action},sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'});
    // #endregion
  }

  let twitterHumanInterrupt: HumanInterrupt | undefined = undefined;
  const twitterUserId = process.env.TWITTER_USER_ID;
  if (twitterUserId) {
    // #region agent log
    debugLog({location:'auth-socials.ts:26',message:'Before Twitter auth call',data:{twitterUserId},sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'});
    // #endregion
    twitterHumanInterrupt = await getTwitterAuthOrInterrupt({
      twitterUserId,
      returnInterrupt: true,
    });
    // #region agent log
    debugLog({location:'auth-socials.ts:30',message:'After Twitter auth call',data:{hasInterrupt:!!twitterHumanInterrupt,interruptArgs:twitterHumanInterrupt?.action_request?.args,interruptAction:twitterHumanInterrupt?.action_request?.action},sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'});
    // #endregion
  }

  if (!twitterHumanInterrupt && !linkedInHumanInterrupt) {
    // #region agent log
    debugLog({location:'auth-socials.ts:32',message:'No interrupts needed, returning early',data:{},sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
    // #endregion
    // User has already authorized. Return early
    return {};
  }

  // Safely combine args from both interrupts, ensuring we handle undefined cases
  const combinedArgs: Record<string, any> = {};
  
  if (twitterHumanInterrupt?.action_request?.args) {
    Object.assign(combinedArgs, twitterHumanInterrupt.action_request.args);
  }
  
  if (linkedInHumanInterrupt?.action_request?.args) {
    Object.assign(combinedArgs, linkedInHumanInterrupt.action_request.args);
  }

  // #region agent log
  debugLog({location:'auth-socials.ts:46',message:'Combined args created',data:{combinedArgs,keys:Object.keys(combinedArgs),hasTwitterURL:!!combinedArgs.authorizeTwitterURL,hasLinkedInURL:!!combinedArgs.authorizeLinkedInURL,hasDocs:!!combinedArgs.authorizationDocs},sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'});
  // #endregion

  // Build description with available URLs
  const urlParts: string[] = [];
  if (combinedArgs.authorizeTwitterURL) {
    urlParts.push(`Twitter: ${combinedArgs.authorizeTwitterURL}`);
  }
  if (combinedArgs.authorizeLinkedInURL) {
    urlParts.push(`LinkedIn: ${combinedArgs.authorizeLinkedInURL}`);
  }
  if (combinedArgs.authorizationDocs) {
    urlParts.push(`LinkedIn Authorization Docs: ${combinedArgs.authorizationDocs}`);
  }

  const description = `# Authorization Required

Please visit the following URL(s) to authorize your social media accounts:

${urlParts.join("\n\n")}

Once done, please 'accept' this interrupt event.`;

  // Ensure we have at least one URL or docs, otherwise something went wrong
  if (urlParts.length === 0) {
    // #region agent log
    debugLog({location:'auth-socials.ts:69',message:'ERROR: No URLs generated',data:{combinedArgs,urlParts},sessionId:'debug-session',runId:'run1',hypothesisId:'A,F'});
    // #endregion
    throw new Error(
      "Authorization required but no authorization URLs were generated. Please check your environment variables and Arcade configuration."
    );
  }

  // Validate that args is not empty and has at least one URL
  if (Object.keys(combinedArgs).length === 0) {
    // #region agent log
    debugLog({location:'auth-socials.ts:104',message:'ERROR: combinedArgs is empty',data:{combinedArgs,twitterInterrupt:!!twitterHumanInterrupt,linkedInInterrupt:!!linkedInHumanInterrupt},sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'});
    // #endregion
    throw new Error(
      "Authorization required but interrupt args are empty. Please check your environment variables and Arcade configuration."
    );
  }

  const interruptEvent: HumanInterrupt = {
    description,
    action_request: {
      action: "Authorize Social Media Accounts",
      args: combinedArgs,
    },
    config: {
      allow_accept: true,
      allow_ignore: true,
      allow_respond: false,
      allow_edit: false,
    },
  };

  // Validate interrupt structure before calling interrupt()
  if (!interruptEvent.action_request || !interruptEvent.action_request.action || !interruptEvent.config) {
    // #region agent log
    debugLog({location:'auth-socials.ts:120',message:'ERROR: Invalid interrupt structure',data:{interruptEvent:JSON.stringify(interruptEvent)},sessionId:'debug-session',runId:'run1',hypothesisId:'C'});
    // #endregion
    throw new Error("Invalid interrupt structure: missing required fields");
  }

  // #region agent log
  debugLog({location:'auth-socials.ts:125',message:'Before interrupt() call',data:{interruptEvent:JSON.stringify(interruptEvent),descriptionLength:description.length,argsKeys:Object.keys(combinedArgs),argsCount:Object.keys(combinedArgs).length},sessionId:'debug-session',runId:'run1',hypothesisId:'C,D'});
  // #endregion

  try {
    const interruptRes = interrupt<HumanInterrupt[], HumanResponse[]>([
      interruptEvent,
    ])[0];

    // #region agent log
    debugLog({location:'auth-socials.ts:133',message:'After interrupt() call',data:{interruptResType:interruptRes?.type,interruptRes:JSON.stringify(interruptRes)},sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
    // #endregion

    if (interruptRes?.type === "ignore") {
      // Throw an error to end the graph.
      throw new Error("Authorization denied by user.");
    }
  } catch (error: any) {
    // #region agent log
    debugLog({location:'auth-socials.ts:140',message:'ERROR in interrupt() call',data:{error:error?.message,errorStack:error?.stack},sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'});
    // #endregion
    // If it's an interrupt exception, that's expected - the graph will pause
    // Re-throw other errors
    if (error?.message?.includes("interrupt") || error?.name === "NodeInterrupt") {
      throw error;
    }
    throw new Error(`Interrupt failed: ${error?.message || "Unknown error"}`);
  }

  return {};
}
