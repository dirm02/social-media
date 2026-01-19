// @ts-expect-error - The type is used in the JSDoc comment, but not defined in the code.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { interrupt, type NodeInterrupt } from "@langchain/langgraph";
import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";
import Arcade from "@arcadeai/arcadejs";
import { TwitterClient } from "../../../clients/twitter/client.js";
import { useArcadeAuth } from "../../utils.js";
import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
const DEBUG_LOG = join("c:", "Users", "HPProdesk", "Desktop", "NewSaaS", ".cursor", "debug.log");
const debugLog = (data: any) => { try { mkdirSync(dirname(DEBUG_LOG), {recursive:true}); appendFileSync(DEBUG_LOG, JSON.stringify({...data,timestamp:Date.now()})+"\n"); console.log("[DEBUG]", data.message, data.data); } catch(e){console.error("[DEBUG ERROR]", e);} };

/**
 * Checks Twitter authorization status and triggers an interrupt if authorization is needed.
 * This function attempts to authorize both tweet lookup and posting capabilities.
 * If either authorization is missing, it will interrupt the flow to request user authorization.
 *
 * @param twitterUserId - The user ID for Twitter authorization
 * @param arcade - The Arcade instance used for tool authorization
 * @throws {NodeInterrupt} When authorization is needed, throws an interrupt to request user action
 * @returns {Promise<HumanInterrupt | undefined>} A promise that resolves to the interrupt if `options.returnInterrupt` is true, or undefined if `options.returnInterrupt` is false
 *
 * @example
 * ```typescript
 * await getArcadeTwitterAuthOrInterrupt("user123", arcadeInstance);
 * ```
 */
export async function getArcadeTwitterAuthOrInterrupt(
  twitterUserId: string,
  arcade: Arcade,
  options?: {
    returnInterrupt?: boolean;
  },
) {
  // #region agent log
  debugLog({location:'twitter.ts:28',message:'getArcadeTwitterAuthOrInterrupt entry',data:{twitterUserId,returnInterrupt:options?.returnInterrupt},sessionId:'debug-session',runId:'run1',hypothesisId:'B,E,F'});
  // #endregion
  let authResponse;
  try {
    authResponse = await TwitterClient.authorizeUser(twitterUserId, arcade);
    // #region agent log
    debugLog({location:'twitter.ts:40',message:'TwitterClient.authorizeUser result',data:{hasAuthResponse:!!authResponse,hasAuthUrl:!!authResponse?.authorizationUrl,authUrl:authResponse?.authorizationUrl},sessionId:'debug-session',runId:'run1',hypothesisId:'E,F'});
    // #endregion
  } catch (error: any) {
    // #region agent log
    debugLog({location:'twitter.ts:44',message:'ERROR in TwitterClient.authorizeUser',data:{error:error?.message,errorStack:error?.stack},sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
    // #endregion
    throw error;
  }

  const authUrl = authResponse.authorizationUrl;

  if (authUrl) {
    // #region agent log
    debugLog({location:'twitter.ts:53',message:'Creating Twitter interrupt',data:{authUrl},sessionId:'debug-session',runId:'run1',hypothesisId:'F'});
    // #endregion
    const description = `# Authorization Required
  
Please visit the following URL to authorize reading & posting Tweets.

${authUrl}

----

If you have already authorized reading/posting on Twitter, please accept this interrupt event.`;

    const authInterrupt: HumanInterrupt = {
      action_request: {
        action: "[AUTHORIZATION REQUIRED]: Twitter",
        args: {
          authorizeTwitterURL: authUrl,
        },
      },
      config: {
        allow_ignore: true,
        allow_accept: true,
        allow_edit: false,
        allow_respond: false,
      },
      description,
    };

    if (options?.returnInterrupt) {
      // #region agent log
      debugLog({location:'twitter.ts:83',message:'Returning Twitter interrupt',data:{interruptAction:authInterrupt.action_request.action,interruptArgs:authInterrupt.action_request.args},sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'});
      // #endregion
      return authInterrupt;
    }

    const res = interrupt<HumanInterrupt[], HumanResponse[]>([
      authInterrupt,
    ])[0];
    if (res.type === "accept") {
      // This means that the user has accepted, however the
      // authorization is still needed. Throw an error.
      throw new Error(
        "User accepted authorization, but authorization is still needed.",
      );
    } else if (res.type === "ignore") {
      // Throw an error to end the graph.
      throw new Error("Authorization denied by user.");
    }
  }
  // #region agent log
  debugLog({location:'twitter.ts:105',message:'No authUrl, returning undefined',data:{hasAuthResponse:!!authResponse},sessionId:'debug-session',runId:'run1',hypothesisId:'F'});
  // #endregion
  return undefined;
}

export async function getBasicTwitterAuthOrInterrupt(options?: {
  returnInterrupt?: boolean;
}) {
  const authInterrupt: HumanInterrupt = {
    action_request: {
      action: "[AUTHORIZATION REQUIRED]: Twitter",
      args: {},
    },
    config: {
      allow_ignore: true,
      allow_accept: true,
      allow_edit: false,
      allow_respond: false,
    },
    description:
      "Failed to fetch user authorization status.\n\nPlease ensure the proper Twitter credentials and user secrets are set in the environment.",
  };

  try {
    const client = TwitterClient.fromBasicTwitterAuth();
    const authed = await client.testAuthentication();
    if (authed) {
      // User is successfully authed. Return undefined.
      return undefined;
    }
  } catch (error: any) {
    if (typeof error === "object" && error?.message) {
      // Use error message in interrupt description
      authInterrupt.description = `Failed to fetch user authorization status.\n\n${error.message}`;
    }
  }

  if (options?.returnInterrupt) {
    return authInterrupt;
  }

  const res = interrupt<HumanInterrupt[], HumanResponse[]>([authInterrupt])[0];
  if (res.type === "accept") {
    // This means that the user has accepted, however the
    // authorization is still needed. Throw an error.
    throw new Error(
      "User accepted authorization, but authorization is still needed.",
    );
  } else if (res.type === "ignore") {
    // Throw an error to end the graph.
    throw new Error("Authorization denied by user.");
  }

  return undefined;
}

export async function getTwitterAuthOrInterrupt(fields?: {
  twitterUserId?: string;
  returnInterrupt?: boolean;
}) {
  // #region agent log
  debugLog({location:'twitter.ts:159',message:'getTwitterAuthOrInterrupt entry',data:{hasTwitterUserId:!!fields?.twitterUserId,useArcade:useArcadeAuth(),hasArcadeKey:!!process.env.ARCADE_API_KEY},sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'});
  // #endregion
  if (useArcadeAuth()) {
    if (!fields?.twitterUserId) {
      throw new Error("Must provide Twitter User ID when using Arcade auth.");
    }

    // #region agent log
    debugLog({location:'twitter.ts:174',message:'Calling Arcade Twitter auth',data:{twitterUserId:fields.twitterUserId},sessionId:'debug-session',runId:'run1',hypothesisId:'B,E,F'});
    // #endregion
    const result = await getArcadeTwitterAuthOrInterrupt(
      fields.twitterUserId,
      new Arcade({ apiKey: process.env.ARCADE_API_KEY }),
      {
        returnInterrupt: fields?.returnInterrupt,
      },
    );
    // #region agent log
    debugLog({location:'twitter.ts:181',message:'Arcade Twitter auth result',data:{hasResult:!!result,resultArgs:result?.action_request?.args,resultAction:result?.action_request?.action},sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'});
    // #endregion
    return result;
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8f0f911b-6156-4958-a56a-aee3253e18f1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'twitter.ts:155',message:'Calling basic Twitter auth',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'})}).catch(()=>{});
  // #endregion
  const result = await getBasicTwitterAuthOrInterrupt({
    returnInterrupt: fields?.returnInterrupt,
  });
  // #region agent log
  debugLog({location:'twitter.ts:194',message:'Basic Twitter auth result',data:{hasResult:!!result,resultArgs:result?.action_request?.args},sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
  // #endregion
  return result;
}
