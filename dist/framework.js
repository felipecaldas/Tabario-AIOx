export const RUNTIMES = ['claude', 'codex', 'both'];

const generated = (title, body) => `# ${title}\n\n${body.trim()}\n`;

const bulletList = (items) => items.map((item) => `- ${item}`).join('\n');

const section = (heading, body) => `## ${heading}\n\n${body.trim()}\n`;

const storyTemplate = `# TAB-XXX - Short Title

Status: Draft

## 1. Context
- Origin: Linear issue
- Business goal
- User impact

## 2. Requirements
- Functional requirements
- Non-functional requirements
- Constraints

## 3. Acceptance Criteria
- Clear, testable conditions
- Must match Linear

## 4. Repo Impact Analysis
- frontend: yes/no + details
- edit-videos: yes/no + details
- video-compositor: yes/no + details
- runpod-serverless: yes/no + details
- workflows: yes/no + details

## 5. Graph Preparation (MANDATORY)
Steps to run before coding:
1. get_minimal_context
2. semantic_search_nodes / query_graph
3. get_impact_radius
4. get_affected_flows

## 6. Implementation Plan
- Step-by-step breakdown
- File/module targets
- Dependencies

## 7. Execution Tasks

### Claude Code Task
- Instructions tailored for Claude

### Codex Task
- Instructions tailored for Codex

## 8. QA Checklist
- Functional validation
- Edge cases
- Regression checks

## 9. Risks & Rollback
- Known risks
- Rollback approach

## 10. Definition of Done
- Code implemented
- Tests passing
- Graph updated
- Linear updated
`;

const sharedRules = {
  ticketing: 'Do not begin implementation without the relevant Linear issue and an approved story file.',
  quality: "Use the repository's local conventions first, and keep changes focused on the current task.",
  review: 'Before handing off, verify the work and summarize what changed with the relevant files.'
};

const tabarioSkill = ({ name, description, body }) => `---
name: ${name}
description: ${description}
---

# ${name}

${body.trim()}
`;

const coreFiles = [
  {
    path: '.aiox-core/README.md',
    content: generated('AIOx Framework', `
AIOx is Tabario's repo-local agentic SDLC layer. It keeps story generation, execution, and QA consistent across supported AI runtimes.

## Commands

- \`aiox init --runtime claude|codex|both\` - bootstrap the current workspace
- \`aiox sync --runtime claude|codex|both\` - re-render managed files
- \`aiox doctor --runtime claude|codex|both\` - check files and prerequisites
- \`aiox upgrade --runtime claude|codex|both\` - refresh generated artifacts

## Managed File Groups

- core: .aiox-core/, docs/stories/_template.md, and .aiox/manifest.json
- claude: .claude/commands, .claude/skills, .claude/rules, and CLAUDE.md
- codex: .codex/AGENTS.md and .agents/skills/tabario-*
`)
  },
  {
    path: '.aiox-core/tabario-product-map.md',
    content: generated('Tabario Product Map', `
Tabario is a V-CaaS platform. The current workspace is a meta-repo that coordinates multiple application repos.

${section('Primary Repos', bulletList([
  '`frontend` - UI and product flows',
  '`edit-videos` - API and orchestration logic',
  '`video-compositor` - Remotion-based composition',
  '`runpod-serverless` - GPU and ComfyUI execution',
  '`workflows` - legacy n8n surface and migration context'
]))}

${section('Core Flows', bulletList([
  'Brief intake -> generation -> approval -> composition -> output',
  'Linear issue -> story file -> execution task pack -> code change -> QA -> commit',
  'Repo-local editor instructions should remain synchronized through AIOx'
]))}
`)
  },
  {
    path: '.aiox-core/tabario-repo-routing.md',
    content: generated('Tabario Repo Routing', `
Use this table to choose the target repository before editing.

| Concern | Target repo |
| --- | --- |
| User interface, product copy, dashboards | \`frontend\` |
| API endpoints, business logic, orchestration | \`edit-videos\` |
| Render pipeline, composition, motion graphics | \`video-compositor\` |
| GPU workers, ComfyUI, model orchestration | \`runpod-serverless\` |
| Cross-cutting docs, rules, and workflows | \`./\` workspace-level AIOx files |
`)
  },
  {
    path: '.aiox-core/tabario-linear-workflow.md',
    content: generated('Tabario Linear Workflow', `
1. Create or identify a Linear issue.
2. Generate a story file in \`docs/stories/\`.
3. Review and approve the story before implementation.
4. Execute the story in the order defined by the implementation plan.
5. Run QA, fix gaps, and repeat until approved.
6. Commit the result and update Linear in the same turn.
`)
  },
  {
    path: '.aiox-core/tabario-quality-gates.md',
    content: generated('Tabario Quality Gates', `
${section('Pre-code', bulletList([
  'Read the story and identify the affected repositories.',
  'Check impact before editing shared code.',
  "Use the repository's local conventions and patterns first."
]))}

${section('Post-code', bulletList([
  'Validate the changed files.',
  'Run the relevant tests or checks.',
  'Update the manifest and record the new state.',
  'Summarize what changed before finishing.'
]))}
`)
  },
  {
    path: '.aiox-core/agents/pm-agent.md',
    content: generated('PM Agent', `
Role: turn a Linear issue into a concise, testable requirements summary.

${bulletList([
  sharedRules.ticketing,
  'Extract the user goal, user impact, and measurable success criteria.',
  'Separate functional requirements from constraints.',
  'Keep assumptions explicit when the issue is ambiguous.'
])}
`)
  },
  {
    path: '.aiox-core/agents/architect-agent.md',
    content: generated('Architect Agent', `
Role: map the requirements to repositories, files, dependencies, and risks.

${bulletList([
  'Choose the correct repository for each part of the work.',
  'Call out any cross-repo contract that must remain stable.',
  'List the files or modules likely to change.',
  'Flag rollback considerations and blast-radius risks.'
])}
`)
  },
  {
    path: '.aiox-core/agents/qa-agent.md',
    content: generated('QA Agent', `
Role: validate the delivered work against the story's acceptance criteria.

${bulletList([
  'Check the acceptance criteria one by one.',
  'Confirm the relevant tests or manual checks were run.',
  'Report any mismatch between the story and the implementation.',
  'Approve only when the delivery is complete and stable.'
])}
`)
  },
  {
    path: '.aiox-core/templates/story.md',
    content: storyTemplate
  },
  {
    path: '.aiox-core/templates/implementation-plan.md',
    content: generated('Implementation Plan', `
## Repo Impact
- Which repositories are affected

## Files
- Which files or modules change

## Dependencies
- What must happen first

## Risks
- What could go wrong
`)
  },
  {
    path: '.aiox-core/templates/qa-checklist.md',
    content: generated('QA Checklist', `
${bulletList([
  'Acceptance criteria are covered.',
  'Relevant tests pass.',
  'No unrelated files changed.',
  'Any follow-up risk is documented.'
])}
`)
  },
  {
    path: '.aiox-core/workflows/story-generation.md',
    content: generated('Story Generation Workflow', `
1. Read the Linear issue.
2. Summarize requirements with the PM Agent.
3. Map repos, files, and risks with the Architect Agent.
4. Write the story file in \`docs/stories/\`.
5. Ask for approval before execution.
`)
  },
  {
    path: 'docs/stories/_template.md',
    content: storyTemplate
  }
];

const claudeFiles = [
  {
    path: '.claude/commands/story.md',
    content: generated('Story Command', `
Use this command to generate a story file from a Linear issue.

${bulletList([
  'Fetch the issue.',
  'Summarize requirements.',
  'Write the story in docs/stories/.',
  'Stop and wait for approval.'
])}
`)
  },
  {
    path: '.claude/commands/execute.md',
    content: generated('Execute Command', `
Use this command to implement an approved story.

${bulletList([
  'Load the story file.',
  'Follow the implementation plan.',
  'Run verification and QA.',
  'Commit only after approval.'
])}
`)
  },
  {
    path: '.claude/commands/tabario-spec.md',
    content: generated('Tabario Spec', `
Create or refresh the product/spec source of truth for a Tabario requirement. Use this for discovery and specification only.

${bulletList([
  'Resolve or create the parent Linear issue.',
  'Create or select the matching GSD workstream.',
  'Produce the AIOx story in docs/stories/.',
  'Create phase sub-issues when the work spans multiple phases.',
  'Stop after reporting the spec artifacts; do not implement code.'
])}
`)
  },
  {
    path: '.claude/commands/tabario-plan.md',
    content: generated('Tabario Plan', `
Turn an approved Tabario spec into an executable phase graph before implementation.

${bulletList([
  'Load the AIOx story, GSD workstream, and Linear parent.',
  'Run GSD phase planning for each phase.',
  'Run the mandatory GStack plan engineering review.',
  'Apply accepted review findings back into the story, plans, and Linear tasks.',
  'Stop after planning; Ralph starts only after explicit confirmation.'
])}
`)
  },
  {
    path: '.claude/commands/tabario-ralph.md',
    content: generated('Tabario Ralph', `
Lock an already planned Tabario requirement and run the execution loop.

${bulletList([
  'Verify the story, GSD plans, Linear tasks, review results, and repo state.',
  'Ask for exact approval before starting execution.',
  'Execute only approved planned phases.',
  'Run required tests and review before completion.',
  'Report blockers instead of inventing product decisions.'
])}
`)
  },
  {
    path: '.claude/skills/story.md',
    content: generated('Story Skill', `
---
description: Generate an AIOx story file from a Linear issue.
---

The skill follows the same flow as \`/story\`: read the issue, summarize it, map the repositories, and write the story file.
`)
  },
  {
    path: '.claude/skills/execute.md',
    content: generated('Execute Skill', `
---
description: Execute an approved AIOx story file.
---

The skill follows the approved story and implementation plan, then records the result after verification.
`)
  },
  {
    path: '.claude/rules/commit-workflow.md',
    content: generated('Commit Workflow', `
${bulletList([
  'Ask before committing.',
  'Stage only files that belong to the current task.',
  'Use a commit message that includes the Linear ticket identifier.',
  'After commit, update Linear with the outcome.'
])}
`)
  },
  {
    path: '.claude/rules/linear-sync.md',
    content: generated('Linear Sync', `
${bulletList([
  'Every implementation task needs a Linear issue.',
  'Move the issue to In Progress before editing.',
  'Update the issue to Done after verification.',
  'If the work is partial, keep the issue In Progress and note the remaining scope.'
])}
`)
  },
  {
    path: '.claude/rules/typescript-guidelines.md',
    content: generated('TypeScript Guidelines', `
${bulletList([
  'Use explicit prop and function types.',
  'Keep components and utilities focused.',
  'Prefer readable code over clever abstractions.',
  'Run the type checker before finishing.'
])}
`)
  },
  {
    path: 'CLAUDE.md',
    content: generated('Tabario Claude Rules', `
${section('AIOx Framework', bulletList([
  'Every feature implementation must have a story file in `docs/stories/` before any code is written.',
  'The framework lives in `.aiox-core/` and the story file is the execution contract.',
  'Use the matching agent role file before changing code in a repo.',
  'Do not route new work back into legacy workflow systems.'
]))}

${section('Execution', bulletList([
  'Read the issue, write the story, and wait for approval before implementation.',
  'Keep changes focused on the current task.',
  'Commit only after QA is complete and Linear has been updated.'
]))}
`)
  }
];

const codexFiles = [
  {
    path: '.codex/AGENTS.md',
    content: generated('Tabario Codex Rules', `
${section('AIOx Framework', bulletList([
  'Every feature implementation must have a story file in `docs/stories/` before code changes.',
  'Use the framework files under `.aiox-core/` as the source for planning and execution guidance.',
  'Keep commits and Linear updates aligned with the story lifecycle.'
]))}

${section('Tabario Skills', bulletList([
  'Use `$tabario-spec` for specification only.',
  'Use `$tabario-plan` for phase planning only.',
  'Use `$tabario-ralph` only after the plan is approved and locked.',
  'Use `$tabario-cancel-ralph` to stop an active Ralph loop.'
]))}

${section('Core Rules', bulletList([
  'Do not route new work into deprecated workflow systems.',
  'Preserve user edits where possible.',
  'Keep changes focused and verifiable.'
]))}
`)
  },
  {
    path: '.agents/skills/tabario-spec/SKILL.md',
    content: tabarioSkill({
      name: 'tabario-spec',
      description: 'Start or refresh a Tabario GSD plus AIOx requirement spec from a Linear TAB issue or plain-English idea. This is planning/specification only; do not implement code.',
      body: `
Create the product and planning source of truth for a Tabario requirement.

Required flow:
1. Resolve or create the parent Linear requirement.
2. Create or select the matching GSD workstream.
3. Produce or refresh GSD milestone, requirements, roadmap, and phase artifacts.
4. Write or update \`docs/stories/TAB-XXX-kebab-title.md\` from \`.aiox-core/templates/story.md\`.
5. Create phase sub-issues for multi-phase work.
6. Report the story path, workstream, phase list, affected repos, complexity, and open questions.

Stop after this report. Do not begin planning or implementation without explicit user approval.
`
    })
  },
  {
    path: '.agents/skills/tabario-plan/SKILL.md',
    content: tabarioSkill({
      name: 'tabario-plan',
      description: 'Plan every phase for a Tabario GSD plus AIOx requirement before Ralph execution. This does not implement code.',
      body: `
Turn an existing Tabario spec into an executable phase graph.

Required flow:
1. Load the AIOx story, GSD workstream, Linear parent, and phase tasks.
2. Refuse to continue if the story or workstream is missing.
3. Run the GSD planning sequence for each phase.
4. Record affected repos, file scope, graph requirements, verification commands, rollback, and Linear task IDs.
5. Run the mandatory engineering review and apply accepted findings.
6. Update the story with the final phase graph and review outcome.

Stop after planning. Ralph starts only through \`$tabario-ralph\` after explicit confirmation.
`
    })
  },
  {
    path: '.agents/skills/tabario-ralph/SKILL.md',
    content: tabarioSkill({
      name: 'tabario-ralph',
      description: 'Lock a planned Tabario GSD plus AIOx requirement and run the Codex-native Ralph execution loop.',
      body: `
Lock an already planned Tabario requirement and run execution.

Before starting, verify the story, GSD plans, Linear parent/tasks, engineering review result, repo state, and credentials. Ask the user for exact approval before changing state or executing phases.

Execution rules:
- Execute only approved, already-planned phases.
- Use serial execution when phases share repos, files, contracts, or dependency risk.
- Use parallel work only when the plan proves disjoint scope.
- Run each phase's required tests.
- Update GSD, AIOx story progress, Linear, and graph state after each phase.
- Run the required review gate before completion.

Report a blocker if a prerequisite, test, review, graph, contract, credential, worktree, commit, or Linear sync step fails.
`
    })
  },
  {
    path: '.agents/skills/tabario-cancel-ralph/SKILL.md',
    content: tabarioSkill({
      name: 'tabario-cancel-ralph',
      description: 'Cancel the active Codex-native Tabario Ralph loop.',
      body: `
Cancel an active Tabario Ralph execution loop.

Required flow:
1. Read \`.codex/tabario-ralph.local.md\` if present.
2. Report the ticket, workstream, current iteration, and partial progress.
3. Leave completed commits intact.
4. Mark incomplete work as blocked or paused in the relevant AIOx/GSD/Linear artifacts when possible.
5. Remove only the active local Ralph state file after reporting the cancellation.
`
    })
  }
];

const filesByTarget = {
  core: coreFiles,
  claude: claudeFiles,
  codex: codexFiles
};

export function normalizeRuntime(runtime = 'both') {
  if (!RUNTIMES.includes(runtime)) {
    throw new Error(`Invalid runtime "${runtime}". Expected one of: ${RUNTIMES.join(', ')}`);
  }
  return runtime;
}

export function runtimeTargets(runtime = 'both') {
  const normalized = normalizeRuntime(runtime);
  return normalized === 'both' ? ['core', 'claude', 'codex'] : ['core', normalized];
}

export function getFrameworkFiles({ runtime = 'both' } = {}) {
  return runtimeTargets(runtime).flatMap((target) =>
    filesByTarget[target].map((file) => ({ ...file, target }))
  );
}

export const frameworkFiles = getFrameworkFiles({ runtime: 'both' });

export function frameworkSummary({ runtime = 'both' } = {}) {
  const files = getFrameworkFiles({ runtime });
  return {
    version: '0.1.0',
    runtime: normalizeRuntime(runtime),
    targets: runtimeTargets(runtime),
    fileCount: files.length,
    generatedStart: '<!-- AIOX:START -->',
    generatedEnd: '<!-- AIOX:END -->'
  };
}

export function contentHashable(file) {
  return `${file.path}\n${file.content}`;
}
