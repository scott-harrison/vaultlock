export {
  compareLoginMatchScores,
  extractLoginHostname,
  loginMatchesPageHost,
  normalizeHostname,
  scoreLoginForPageHost,
  sortLoginUrlsForPageHost,
} from "@vaultlock/shared/domain-matching";

export type {
  LoginHostMatchResult,
  LoginMatchKind,
  LoginMatchOptions,
} from "@vaultlock/shared/domain-matching";
