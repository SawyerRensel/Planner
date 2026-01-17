# Claude Code Instructions for Planner

## After Code Changes

After editing any Planner source code (TypeScript, CSS, etc.):

1. **Build and copy to vault**: Run `npm run build` to compile and automatically copy build files to `vault/.obsidian/plugins/planner`

2. **Run Obsidian eslint plugin**: Run `npx eslint src/` to check compliance with Obsidian's community plugin requirements

## Project Context

- This is an Obsidian plugin called "Planner"
- Build output goes to `vault/.obsidian/plugins/planner` (not example-vault)
- ESLint is configured with `eslint-plugin-obsidianmd` for Obsidian-specific rules
