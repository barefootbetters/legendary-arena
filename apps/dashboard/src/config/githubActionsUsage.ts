// why: manually-maintained GitHub Actions minutes snapshot, read from GitHub's
// usage alert and each repo's run history (no billing API is wired; the `gh`
// token lacks the `user` scope GitHub's billing endpoint needs). It feeds the
// Monetization page's GitHub Actions panel, which labels it CACHED. Two
// allowances are tracked because they bill separately: the `legendary-arena`
// organization (the game's own repos) and the `barefootbetters` user account
// (the studio's private repos). Full write-up:
// https://ewiki.legendary-arena.com/render-migration-analysis/#github-actions-minutes-october-2026
// Refresh workflow: re-read the alert / run history, update the figures and
// GITHUB_ACTIONS_USAGE_AS_OF together.

/**
 * One GitHub billing account's Actions minutes for the current billing cycle,
 * as of GITHUB_ACTIONS_USAGE_AS_OF.
 */
export interface GitHubActionsAllowance {
  readonly account: string;
  readonly description: string;
  readonly minutesUsed: number;
  readonly includedMinutes: number;
  // why: the monthly Actions spending budget set in GitHub's billing settings,
  // in integer cents; `null` when no budget has been recorded for the account.
  readonly budgetCents: number | null;
  readonly isLegendaryArenaCost: boolean;
}

/**
 * The end-of-cycle projection for one allowance. Cents are integers (D-19601
 * integer-cents discipline).
 */
export interface GitHubActionsProjection {
  readonly projectedMinutes: number;
  readonly overageMinutes: number;
  readonly overageCents: number;
}

// why: the snapshot date, the day count it covers, and the cycle length are
// stated here rather than read from a clock, so the projection is
// deterministic and testable. October 1–19 is 19 days of a 31-day cycle.
export const GITHUB_ACTIONS_USAGE_AS_OF = '2026-10-19';
export const GITHUB_ACTIONS_DAYS_ELAPSED = 19;
export const GITHUB_ACTIONS_DAYS_IN_CYCLE = 31;

// why: GitHub's standard Linux 2-core hosted-runner rate since 2026-01-01 is
// $0.006 a minute (it was $0.008). Kept as cents per 1,000 minutes so the
// arithmetic stays in integers: $6.00 per 1,000 minutes = 600 cents.
// Source: https://docs.github.com/en/billing/reference/actions-runner-pricing
export const GITHUB_ACTIONS_CENTS_PER_THOUSAND_MINUTES = 600;

// why: sourcing, per allowance —
//   legendary-arena  — run history of the private `legendary-arena-lab` repo
//                      (CI, provision smoke, host deploys), Oct 1–19. The engine
//                      and website repos are public, so their runs are free.
//   barefootbetters  — run history of the studio's private repos, Oct 1–19
//                      (GitHub's 2026-10-19 alert said 1,800 of 2,000, 90%).
//                      herbs-vs-ailments was 1,174 of the 1,815 minutes.
//                      Actions budget set to $20 a month on 2026-10-19.
export const GITHUB_ACTIONS_ALLOWANCES: readonly GitHubActionsAllowance[] = [
  {
    account: 'legendary-arena (org)',
    description:
      'The game. Engine and website repos are public (free); the private lab repo bills here.',
    minutesUsed: 210,
    includedMinutes: 2000,
    budgetCents: null,
    isLegendaryArenaCost: true,
  },
  {
    account: 'barefootbetters (account)',
    description:
      'Studio private repos, led by herbs-vs-ailments (1,174 of 1,815 minutes). Not a game cost.',
    minutesUsed: 1815,
    includedMinutes: 2000,
    budgetCents: 2000,
    isLegendaryArenaCost: false,
  },
];

/**
 * Project one allowance to the end of the billing cycle at its average daily
 * rate so far, and price the minutes over the included amount.
 */
export function projectGitHubActionsAllowance(
  allowance: GitHubActionsAllowance,
): GitHubActionsProjection {
  const minutesPerDay = allowance.minutesUsed / GITHUB_ACTIONS_DAYS_ELAPSED;
  const projectedMinutes = Math.round(minutesPerDay * GITHUB_ACTIONS_DAYS_IN_CYCLE);
  const overageMinutes = Math.max(0, projectedMinutes - allowance.includedMinutes);
  const overageCents = Math.round(
    (overageMinutes * GITHUB_ACTIONS_CENTS_PER_THOUSAND_MINUTES) / 1000,
  );
  return { projectedMinutes, overageMinutes, overageCents };
}
