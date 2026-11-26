/** Pick one of three values by whether `value` is above, below or exactly zero. */
export function bySign<T>(value: number, choices: { positive: T; negative: T; zero: T }): T {
  if (value > 0) return choices.positive;
  if (value < 0) return choices.negative;
  return choices.zero;
}
