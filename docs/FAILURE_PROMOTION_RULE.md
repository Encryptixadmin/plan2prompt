# Failure Pattern Promotion Rule

## Overview

This document describes the governance process for promoting unknown failures to known failure patterns in the feedback classification taxonomy.

## Promotion Criteria (ALL MUST BE MET)

A failure may only be promoted from `unknown` → `known` if:

1. **Frequency Threshold**: The failure appears **3 or more times** in the feedback event log
2. **Cross-Project Occurrence**: The failure has occurred across **at least 2 different projects**
3. **Hash Cluster Match**: Events share matching `rawOutputHash` clusters, indicating identical or near-identical error outputs

## Verification Process

1. Query `feedbackMetricsService.getHashClusters()` to identify hash values with count >= 3
2. For each candidate hash, verify cross-project occurrence using `feedbackMetricsService.getProjectsForHash(hash)`
3. If both criteria are met, the hash is eligible for pattern definition

## Pattern Definition Requirements

When defining a new known failure pattern, provide:

- `id`: Unique identifier (format: `{CATEGORY}_{SHORT_NAME}`)
- `category`: One of: environment, dependency, configuration, syntax, runtime, tooling, permission, network
- `name`: Human-readable name
- `detectionHints`: Array of string/regex patterns for matching
- `cause`: Brief explanation of why this occurs
- `recoverySteps`: Ordered list of fixed recovery instructions
- `retryAllowed`: Boolean indicating if retry is safe
- `regenerateSuggested`: Boolean indicating if prompt regeneration may help
- `appliesTo`: Scope - single_step, multiple_steps, or environment_wide

## What This Document Does NOT Authorize

- Automated promotion (promotion requires manual review and code change)
- AI-based pattern inference (all patterns must be human-defined)
- Speculative failure matching (unknown failures remain unknown)
- Conversational debugging assistance (responses are deterministic)

## Implementation Notes

- This is a DOCUMENT ONLY specification
- No automation exists for this process
- Pattern changes require code deployment
- All promotions should be logged in `server/services/failure-taxonomy.ts`
