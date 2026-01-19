import "dotenv/config";
import { Client } from "@langchain/langgraph-sdk";
import {
  SKIP_CONTENT_RELEVANCY_CHECK,
  SKIP_USED_URLS_CHECK,
  TEXT_ONLY_MODE,
} from "../src/agents/generate-post/constants.js";

/**
 * Generate posts from multiple URLs.
 * Processes each URL sequentially, creating a separate thread and run for each.
 * Includes error handling to continue processing remaining URLs if one fails.
 */
async function invokeGraph() {
  // Array of test URLs to process
  const testUrls = [
    "https://en.wikipedia.org/wiki/Anaconda_(2025_film)",
    "https://www.youtube.com/watch?v=iFWRZ3U_P5k",
    "https://github.com/alsonpr/Henley-Passport-Index-Dataset.git",
    "https://www.tvanouvelles.ca/2026/01/11/homicide-avec-une-fourchette-a-bbq-encore-trop-dangereux-pour-etre-libere",
    "https://dinnerdoneyesterday.blogspot.com/2011/08/beef-and-berry-stew.html",
  ];

  const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
  });

  // Agent Inbox URL - use local if running locally, otherwise use deployed version
  const agentInboxUrl =
    process.env.AGENT_INBOX_URL || "http://localhost:3000";

  console.log(`🚀 Starting to process ${testUrls.length} URLs...\n`);

  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    const urlNumber = i + 1;

    try {
      console.log(`📝 [${urlNumber}/${testUrls.length}] Processing: ${url}`);

      const { thread_id } = await client.threads.create();
      await client.runs.create(thread_id, "generate_post", {
        input: {
          links: [url],
        },
        config: {
          configurable: {
            // By default, the graph will read these values from the environment
            // [TWITTER_USER_ID]: process.env.TWITTER_USER_ID,
            // [LINKEDIN_USER_ID]: process.env.LINKEDIN_USER_ID,
            // This ensures the graph runs in a basic text only mode.
            // If you followed the full setup instructions, you may remove this line.
            [TEXT_ONLY_MODE]: true,
            // These will skip content relevancy checks and used URLs checks
            [SKIP_CONTENT_RELEVANCY_CHECK]: true,
            [SKIP_USED_URLS_CHECK]: true,
          },
        },
      });

      console.log(`✅ [${urlNumber}/${testUrls.length}] Successfully created thread: ${thread_id}`);
      console.log(`   View in Agent Inbox: ${agentInboxUrl}/?thread=${thread_id}\n`);

      // Add delay between requests to prevent rate limiting (except for the last URL)
      if (i < testUrls.length - 1) {
        console.log("⏳ Waiting 2 seconds before processing next URL...\n");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ [${urlNumber}/${testUrls.length}] Error processing ${url}:`, error);
      console.log("   Continuing with next URL...\n");
      // Continue processing remaining URLs even if one fails
    }
  }

  console.log("✨ All URLs processed! Check Agent Inbox to review and approve posts.");
}

invokeGraph().catch(console.error);
