import {
  interrupt,
  // @ts-expect-error - The type is used in the JSDoc comment, but not defined in the code.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type NodeInterrupt,
} from "@langchain/langgraph";
import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";
import Arcade from "@arcadeai/arcadejs";
import { useArcadeAuth } from "../../utils.js";
import { appendFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
const DEBUG_LOG = join("c:", "Users", "HPProdesk", "Desktop", "NewSaaS", ".cursor", "debug.log");
const debugLog = (data: any) => { try { mkdirSync(dirname(DEBUG_LOG), {recursive:true}); appendFileSync(DEBUG_LOG, JSON.stringify({...data,timestamp:Date.now()})+"\n"); console.log("[DEBUG]", data.message, data.data); } catch(e){console.error("[DEBUG ERROR]", e);} };

const LINKEDIN_AUTHORIZATION_DOCS_URL =
  "https://github.com/langchain-ai/social-media-agent?tab=readme-ov-file#setup";

/**
 * Checks LinkedIn authorization status and triggers an interrupt if authorization is needed.
 * This function verifies the presence of required LinkedIn credentials (access token and either person URN or organization ID).
 * If credentials are missing, it will interrupt the flow to request user authorization.
 *
 * @param linkedInUserId - The user ID for LinkedIn authorization
 * @param config - Configuration object containing LinkedIn credentials and other settings
 * @param options - Optional configuration for interrupt handling
 * @param options.returnInterrupt - If true, returns the interrupt object instead of throwing it
 * @returns A promise that resolves to a HumanInterrupt object if returnInterrupt is true and authorization is needed,
 *          otherwise resolves to undefined
 * @throws {NodeInterrupt} When authorization is needed and returnInterrupt is false
 * @throws {Error} When user denies authorization by ignoring the interrupt
 *
 * @example
 * ```typescript
 * await getLinkedInAuthOrInterrupt("user123", config);
 * ```
 */
export async function getBasicLinkedInAuthOrInterrupt(fields?: {
  linkedInUserId?: string;
  returnInterrupt?: boolean;
}) {
  const { accessToken, personUrn, organizationId } = {
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    organizationId: process.env.LINKEDIN_ORGANIZATION_ID,
    personUrn: process.env.LINKEDIN_PERSON_URN,
  };

  if (!accessToken || (!personUrn && !organizationId)) {
    const description = `# Authorization Required
    
${fields?.linkedInUserId ? `Missing LinkedIn authorization for user: ${fields.linkedInUserId}` : ""}.

Please follow the authorization instructions [here](${LINKEDIN_AUTHORIZATION_DOCS_URL}).

Once completed, please mark this interrupt as resolved to end this task, and restart with the proper configuration fields or environment variables set.

----

If you have already authorized and set the required configuration fields or environment variables for posting on LinkedIn, please accept this interrupt event to continue the task.`;

    const authInterrupt: HumanInterrupt = {
      action_request: {
        action: "[AUTHORIZATION REQUIRED]: LinkedIn",
        args: {
          authorizationDocs: LINKEDIN_AUTHORIZATION_DOCS_URL,
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

    if (fields?.returnInterrupt) {
      return authInterrupt;
    }

    const res = interrupt<HumanInterrupt[], HumanResponse[]>([
      authInterrupt,
    ])[0];
    if (res.type === "accept") {
      // The user has accepted, indicating the required fields have been set.
      // Trust this and continue with the task.
      return undefined;
    }
    if (res.type === "ignore") {
      // Throw an error to end the graph.
      throw new Error("Authorization denied by user.");
    }
  }

  return undefined;
}

async function getArcadeLinkedInAuthOrInterrupt(
  linkedInUserId: string,
  arcade: Arcade,
  fields?: {
    returnInterrupt?: boolean;
    postToOrg?: boolean;
  },
) {
  // #region agent log
  debugLog({location:'linkedin.ts:101',message:'getArcadeLinkedInAuthOrInterrupt entry',data:{linkedInUserId,postToOrg:fields?.postToOrg,returnInterrupt:fields?.returnInterrupt},sessionId:'debug-session',runId:'run1',hypothesisId:'B,E,F'});
  // #endregion
  const scopes = fields?.postToOrg
    ? ["w_member_social", "w_organization_social"]
    : ["w_member_social"];
  let authResponse;
  try {
    authResponse = await arcade.auth.start(linkedInUserId, "linkedin", {
      scopes,
    });
    // #region agent log
    debugLog({location:'linkedin.ts:113',message:'arcade.auth.start result',data:{hasAuthResponse:!!authResponse,hasAuthUrl:!!authResponse?.url,authUrl:authResponse?.url},sessionId:'debug-session',runId:'run1',hypothesisId:'E,F'});
    // #endregion
  } catch (error: any) {
    // #region agent log
    debugLog({location:'linkedin.ts:119',message:'ERROR in arcade.auth.start',data:{error:error?.message,errorStack:error?.stack},sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
    // #endregion
    throw error;
  }
  const authUrl = authResponse.url;

  if (authUrl) {
    // #region agent log
    debugLog({location:'linkedin.ts:125',message:'Creating LinkedIn interrupt',data:{authUrl},sessionId:'debug-session',runId:'run1',hypothesisId:'F'});
    // #endregion
    const description = `# Authorization Required
  
Please visit the following URL to authorize reading & posting to LinkedIn.

${authUrl}

----

If you have already authorized reading/posting on Twitter, please accept this interrupt event.`;

    const authInterrupt: HumanInterrupt = {
      action_request: {
        action: "[AUTHORIZATION REQUIRED]: LinkedIn",
        args: {
          authorizeLinkedInURL: authUrl,
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

    if (fields?.returnInterrupt) {
      // #region agent log
      debugLog({location:'linkedin.ts:155',message:'Returning LinkedIn interrupt',data:{interruptAction:authInterrupt.action_request.action,interruptArgs:authInterrupt.action_request.args},sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'});
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
  debugLog({location:'linkedin.ts:179',message:'No authUrl, returning undefined',data:{hasAuthResponse:!!authResponse},sessionId:'debug-session',runId:'run1',hypothesisId:'F'});
  // #endregion
  return undefined;
}

export async function getLinkedInAuthOrInterrupt(fields?: {
  linkedInUserId?: string;
  returnInterrupt?: boolean;
  postToOrg?: boolean;
}) {
  // #region agent log
  debugLog({location:'linkedin.ts:186',message:'getLinkedInAuthOrInterrupt entry',data:{hasLinkedInUserId:!!fields?.linkedInUserId,useArcade:useArcadeAuth(),hasArcadeKey:!!process.env.ARCADE_API_KEY,postToOrg:fields?.postToOrg},sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'});
  // #endregion
  const linkedInUserId = fields?.linkedInUserId || process.env.LINKEDIN_USER_ID;
  if (useArcadeAuth()) {
    if (!fields?.linkedInUserId) {
      throw new Error("Must provide LinkedIn User ID when using Arcade auth.");
    }

    // #region agent log
    debugLog({location:'linkedin.ts:199',message:'Calling Arcade LinkedIn auth',data:{linkedInUserId:fields.linkedInUserId,postToOrg:fields?.postToOrg},sessionId:'debug-session',runId:'run1',hypothesisId:'B,E,F'});
    // #endregion
    const result = await getArcadeLinkedInAuthOrInterrupt(
      fields.linkedInUserId,
      new Arcade({ apiKey: process.env.ARCADE_API_KEY }),
      {
        returnInterrupt: fields?.returnInterrupt,
        postToOrg: fields?.postToOrg,
      },
    );
    // #region agent log
    debugLog({location:'linkedin.ts:206',message:'Arcade LinkedIn auth result',data:{hasResult:!!result,resultArgs:result?.action_request?.args,resultAction:result?.action_request?.action},sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'});
    // #endregion
    return result;
  }

  // #region agent log
  debugLog({location:'linkedin.ts:216',message:'Calling basic LinkedIn auth',data:{linkedInUserId},sessionId:'debug-session',runId:'run1',hypothesisId:'B,E'});
  // #endregion
  const result = await getBasicLinkedInAuthOrInterrupt({
    linkedInUserId,
    returnInterrupt: fields?.returnInterrupt,
  });
  // #region agent log
  debugLog({location:'linkedin.ts:219',message:'Basic LinkedIn auth result',data:{hasResult:!!result,resultArgs:result?.action_request?.args},sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
  // #endregion
  return result;
}
