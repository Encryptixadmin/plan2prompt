import type { IdeaInput, IdeaPurpose } from "@shared/types/ideas";
import { consensusService } from "./ai";
import type { UsageModule } from "@shared/schema";

interface ResearchResult {
  brief: string;
  queries: string[];
  timestamp: string;
}

const researchCache = new Map<string, ResearchResult>();

function buildCacheKey(title: string, description: string): string {
  const normalized = `${title.toLowerCase().trim()}::${description.toLowerCase().trim().substring(0, 200)}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `research_${Math.abs(hash).toString(36)}`;
}

function buildResearchPrompt(input: IdeaInput): string {
  const purposeLabel = input.purpose || "commercial";

  const researchFocus = getResearchFocus(input.purpose);

  return `You are a product research analyst. Your task is to provide a concise research brief about the domain, market, and practical considerations for the following product idea. This research will be used by another AI to perform a deeper analysis.

IDEA TITLE: ${input.title}
IDEA DESCRIPTION: ${input.description}
PROJECT TYPE: ${purposeLabel}

${researchFocus}

Produce a research brief covering these areas (be specific and factual, not generic):

1. DOMAIN CONTEXT
- What industry/domain is this in? What are the key terms, regulations, standards, or certifications relevant to this space?
- What specific technical or regulatory requirements apply? (e.g., FAA Part 91/135 for aviation, HIPAA for healthcare, PCI-DSS for payments)
- What domain-specific knowledge would a builder need?

2. EXISTING SOLUTIONS & COMPETITORS
- What products, tools, or approaches currently exist in this space? Name specific products, companies, or open-source projects.
- What are their strengths and weaknesses? What do users complain about?
- What price points are common in this market?

3. TARGET USER SPECIFICS
- Who specifically uses products like this? What is their typical workflow?
- What specific sub-categories or variations exist? (e.g., for a helicopter app: different helicopter types like Robinson R44 vs Bell 206 vs Airbus H125, each with different weight/balance requirements)
- What pain points do these users face with existing solutions?

4. TECHNICAL CONSIDERATIONS
- What APIs, data sources, or integrations would be relevant?
- What are known technical challenges specific to this domain?
- Are there industry-standard data formats, protocols, or interfaces to consider?

5. MARKET SIGNALS
- Is this market growing, shrinking, or stable?
- Are there recent trends, regulatory changes, or technology shifts affecting this space?
- What is the approximate market size or user base?

IMPORTANT RULES:
- Be SPECIFIC to this exact idea. Do not give generic startup advice.
- Name real products, real companies, real regulations where applicable.
- If you're uncertain about specific facts, say so rather than inventing them.
- Keep each section to 3-5 bullet points maximum.
- Focus on information that would change how someone evaluates this idea's feasibility.

Respond in plain text (not JSON), using the section headers above.`;
}

function getResearchFocus(purpose?: IdeaPurpose): string {
  switch (purpose) {
    case "developer_tool":
      return `RESEARCH FOCUS: This is a developer tool. Focus on:
- Existing developer tooling ecosystem (CLI tools, IDE plugins, libraries, SaaS devtools)
- Developer community discussions (GitHub issues, HackerNews, Reddit r/programming, Dev.to)
- Integration points with existing development workflows
- Open-source alternatives and their adoption levels`;

    case "internal":
      return `RESEARCH FOCUS: This is an internal/personal tool. Focus on:
- Existing commercial tools that solve similar problems (even if overpriced/overbuilt)
- Common workflows and time sinks in this problem area
- Integration requirements with existing enterprise tools
- Build-vs-buy considerations specific to this domain`;

    case "open_source":
      return `RESEARCH FOCUS: This is an open-source project. Focus on:
- Existing open-source projects in this space and their adoption/maintenance status
- Community demand signals (GitHub stars, issues, discussions)
- Ecosystem fit and integration with popular open-source tools
- Maintenance burden and sustainability considerations`;

    case "learning":
      return `RESEARCH FOCUS: This is a learning project. Focus on:
- What skills/technologies this would teach
- Complexity assessment for a learning context
- Relevant tutorials, courses, or example projects that cover similar ground
- Incremental learning milestones this project could provide`;

    case "commercial":
    default:
      return `RESEARCH FOCUS: This is a commercial product. Focus on:
- Market size and growth trajectory
- Competitive landscape with specific named competitors
- Pricing models and revenue benchmarks in this space
- Customer acquisition strategies used by similar products
- Regulatory requirements that could affect go-to-market`;
  }
}

export class ResearchService {
  async generateResearchBrief(
    input: IdeaInput,
    projectId?: string,
    userId?: string
  ): Promise<string> {
    const cacheKey = buildCacheKey(input.title, input.description);

    const cached = researchCache.get(cacheKey);
    if (cached) {
      const ageMs = Date.now() - new Date(cached.timestamp).getTime();
      if (ageMs < 30 * 60 * 1000) {
        console.log(`[Research] Cache hit for "${input.title}"`);
        return cached.brief;
      }
    }

    console.log(`[Research] Generating research brief for "${input.title}"`);

    const prompt = buildResearchPrompt(input);

    const usageContext = projectId
      ? { projectId, module: "ideas" as UsageModule, userId }
      : undefined;

    try {
      const consensus = await consensusService.getConsensus({
        prompt: {
          system: "You are a product research analyst with deep knowledge across industries, regulations, and technology markets. Provide factual, specific research — not generic advice. When you reference products, regulations, or standards, use their real names.",
          user: prompt,
        },
        providers: ["openai"],
      }, usageContext);

      const brief = consensus.providerResponses
        .sort((a, b) => b.confidence - a.confidence)[0]?.content
        || consensus.unifiedContent;

      researchCache.set(cacheKey, {
        brief,
        queries: [input.title],
        timestamp: new Date().toISOString(),
      });

      if (researchCache.size > 50) {
        const oldestKey = researchCache.keys().next().value;
        if (oldestKey) researchCache.delete(oldestKey);
      }

      return brief;
    } catch (error) {
      console.error(`[Research] Failed to generate research brief: ${error}`);
      return "";
    }
  }
}

export const researchService = new ResearchService();
