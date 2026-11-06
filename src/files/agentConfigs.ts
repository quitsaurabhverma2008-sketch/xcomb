import type {GuestFileRoot, GuestFilePath} from './fileExplorer';

export type AgentConfig = Readonly<{
  /** Matches the harness home key on the native side. */
  key: 'claude' | 'codex' | 'opencode' | 'freebuff' | 'gemini' | 'omniroute';
  /** What the user sees: the dot-folder name. */
  label: string;
  /** Where each tool keeps its settings, most likely first. Falls back to the agent's whole home. */
  startCandidates: readonly GuestFilePath[];
}>;

export const AGENT_CONFIGS: readonly AgentConfig[] = [
  {key: 'opencode', label: '.opencode', startCandidates: [['.config', 'opencode'], ['.opencode']]},
  {key: 'claude', label: '.claude', startCandidates: [['.claude']]},
  {key: 'codex', label: '.codex', startCandidates: [['.codex']]},
  {key: 'freebuff', label: '.freebuff', startCandidates: [['.config', 'manicode'], ['.freebuff']]},
  {key: 'gemini', label: '.gemini', startCandidates: [['.gemini']]},
  {key: 'omniroute', label: '.omniroute', startCandidates: [['.omniroute'], ['.config', 'omniroute'], ['.local', 'share', 'omniroute']]},
];

export function agentRoot(config: AgentConfig): GuestFileRoot {
  return `agent:${config.key}`;
}

/** Text files only, up to the 64 KiB the native side reads and writes. */
export function isValidNewFileName(name: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(name) && name !== '.' && name !== '..';
}
