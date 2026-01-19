import {
  BUSINESS_CONTEXT as LANGCHAIN_BUSINESS_CONTEXT,
  TWEET_EXAMPLES as LANGCHAIN_TWEET_EXAMPLES,
  POST_STRUCTURE_INSTRUCTIONS as LANGCHAIN_POST_STRUCTURE_INSTRUCTIONS,
  POST_CONTENT_RULES as LANGCHAIN_POST_CONTENT_RULES,
  CONTENT_VALIDATION_PROMPT as LANGCHAIN_CONTENT_VALIDATION_PROMPT,
} from "./prompts.langchain.js";
import { EXAMPLES } from "./examples.js";
import { useLangChainPrompts } from "../../utils.js";

export const TWEET_EXAMPLES = EXAMPLES.map(
  (example, index) => `<example index="${index}">\n${example}\n</example>`,
).join("\n");

/**
 * This prompt details the structure the post should follow.
 * Updating this will change the sections and structure of the post.
 * If you want to make changes to how the post is structured, you
 * should update this prompt, along with the `EXAMPLES` list.
 */
export const POST_STRUCTURE_INSTRUCTIONS = `<section key="1">
The first part should be the introduction or hook. This should be engaging and to the point, ideally no more than 5-8 words. If appropriate, you can include one emoji in the header. You should not include emojis if the post is more casual, however if you're making an announcement or highlighting something exciting, an emoji can add impact.
</section>

<section key="2">
This section will contain the main content of the post. The post body should contain a COMPREHENSIVE, DEEPLY INFORMATIVE breakdown of the content/product/service/findings outlined in the marketing report.
It should focus on:
- What the content does, shows off, or the problem it solves - with SPECIFIC DETAILS
- WHY it matters or what makes it unique/valuable - with CONTEXT and IMPLICATIONS
- MULTIPLE KEY INSIGHTS, interesting details, facts, numbers, or context that adds substantial educational value
- DEEP ANALYSIS or perspective that helps readers understand the significance and broader picture
- Specific techniques, methodologies, features, or approaches used
- How it compares to alternatives or what gap it fills
- What readers will learn or gain from engaging with the content

This may include technical details if the marketing report is very technical, however you should keep in mind your audience includes both technical and non-technical readers.
This section MUST be AT LEAST 6-10 sentences providing SUBSTANTIVE information, analysis, and insight. More sentences are better if they add value. Each sentence should contribute meaningful information - avoid filler. If the content is technical, you may include bullet points covering key aspects to make it more engaging and easier to follow.
CRITICAL: This is NOT a summary. You must provide DEEP ANALYSIS, MULTIPLE INSIGHTS, and EDUCATIONAL CONTENT. A simple overview or brief description is NOT acceptable. Readers should learn something substantial from your post.
Remember: DEPTH, ANALYSIS, and EDUCATIONAL VALUE are the top priorities. Provide comprehensive insight that makes readers smarter.
The content/product/service/findings outlined in the marketing report is the main focus of this post.
</section>

<section key="3">
The final section of the post should contain a call to action. This should contain a few words that encourage the reader to click the link to the content being promoted.
Optionally, you can include an emoji here.
Ensure you do not make this section more than 3-8 words.
</section>`;

/**
 * This prompt is used when generating, condensing, and re-writing posts.
 * You should make this prompt very specific to the type of content you
 * want included/focused on in the posts.
 */
export const POST_CONTENT_RULES = `- CRITICAL: This is NOT a summary. You must write an ANALYTICAL, INFORMATIVE post with DEEP INSIGHTS. Simple overviews or brief descriptions are NOT acceptable.
- Focus your post on what the content covers, aims to achieve, or the findings of the marketing report. Provide COMPREHENSIVE, DETAILED information and deep analysis.
- Include MULTIPLE KEY INSIGHTS (at least 3-5 distinct insights), interesting details, specific facts, numbers, or context that makes the content valuable and informative
- Explain WHY this content matters, what makes it unique, what problem it solves, and what readers will gain from it - with SPECIFIC EXAMPLES and CONTEXT
- Provide DEEP ANALYSIS and PERSPECTIVE with explanations, comparisons, or broader context - not just surface-level summaries
- Think like a journalist or subject matter expert providing a thoughtful, informative breakdown that teaches readers something new
- Make posts DEEPLY INFORMATIVE and EDUCATIONAL - readers should gain substantial knowledge and insight they didn't have before
- Aim for 400-550 characters of substantive content (excluding the link) to provide proper depth and analysis. This is a MINIMUM target - longer is better if it adds value
- Include specific details like: techniques used, numbers/data, key features, unique approaches, methodologies, implications, or interesting background
- Connect concepts and explain relationships - help readers understand the bigger picture
- Do not make the post overly technical, but include enough detail to be genuinely useful, interesting, and educational
- Limit the use of emojis to the post header, and optionally in the call to action (1-2 emojis total)
- NEVER use hashtags in the post.
- ALWAYS use present tense to make announcements feel immediate (e.g., "Microsoft just launched..." instead of "Microsoft launches...").
- ALWAYS include the link to the content being promoted in the call to action section of the post.
- You're acting as a human expert, posting for other humans who want to learn. Keep your tone casual and friendly, but DEEPLY INFORMATIVE and VALUABLE. Don't make it too formal.
- Depth and educational value are MORE important than brevity - provide real insight and analysis in every post.`;

/**
 * This should contain "business content" into the type of content you care
 * about, and want to post/focus your posts on. This prompt is used widely
 * throughout the agent in steps such as content validation, and post generation.
 * It should be generalized to the type of content you care about, or if using
 * for a business, it should contain details about your products/offerings/business.
 */
export const BUSINESS_CONTEXT = `
Here is some context about the types of content you should be interested in prompting:
<business-context>
You are interested in a wide variety of engaging and informative content. This includes but is not limited to:
- Science and technology articles, research, and developments
- Entertainment and media content (movies, TV shows, games, etc.)
- Software development and coding projects
- AI applications, research, and developments
- UI/UX design and development
- News articles and current events
- Food, recipes, and lifestyle content
- General interesting articles from various domains
- Open source projects, tools, and frameworks
- Any engaging, informative, and shareable content that would be valuable to your audience

The goal is to share diverse, interesting, and valuable content with your audience across many topics and domains.
</business-context>`;

/**
 * A prompt to be used in conjunction with the business context prompt when
 * validating content for social media posts. This prompt should outline the
 * rules for what content should be approved/rejected.
 */
export const CONTENT_VALIDATION_PROMPT = `This content will be used to generate engaging, informative and educational social media posts.
The following are rules to follow when determining whether or not to approve content as valid, or not:
<validation-rules>
- The content may be about a new product, tool, service, article, blog post, video, research, news story, recipe, or any other interesting and informative content.
- The content should be engaging and suitable for generating a high quality social media post.
- The goal of the final social media post should be to educate your users, inform them about interesting content, products, services, findings, news, or entertainment.
- You should approve any content that is informative, engaging, and can be used to create a valuable social media post.
- You should NOT approve content from users who are requesting help, giving feedback, or otherwise not clearly about shareable content.
- You should approve content which can be used as marketing material, educational content, or other content to promote and share interesting information with your audience.
- Content can be about any topic including but not limited to: technology, science, entertainment, food, news, lifestyle, software development, AI, or any other engaging subject matter.
</validation-rules>`;

export function getPrompts() {
  // NOTE: you should likely not have this set, unless you want to use the LangChain prompts
  if (useLangChainPrompts()) {
    return {
      businessContext: LANGCHAIN_BUSINESS_CONTEXT,
      tweetExamples: LANGCHAIN_TWEET_EXAMPLES,
      postStructureInstructions: LANGCHAIN_POST_STRUCTURE_INSTRUCTIONS,
      postContentRules: LANGCHAIN_POST_CONTENT_RULES,
      contentValidationPrompt: LANGCHAIN_CONTENT_VALIDATION_PROMPT,
    };
  }

  return {
    businessContext: BUSINESS_CONTEXT,
    tweetExamples: TWEET_EXAMPLES,
    postStructureInstructions: POST_STRUCTURE_INSTRUCTIONS,
    postContentRules: POST_CONTENT_RULES,
    contentValidationPrompt: CONTENT_VALIDATION_PROMPT,
  };
}
