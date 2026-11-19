import axe from "axe-core";

/**
 * Run axe on part of the page and return readable problems. Colour contrast is
 * skipped because jsdom has no layout or styles. The Playwright tests check it in a real browser.
 */
export async function accessibilityProblems(
  container: Element,
  options: { landmarks?: boolean } = {}
): Promise<string[]> {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
      // A single component is not a whole page, so landmark rules only apply to full pages.
      region: { enabled: options.landmarks ?? false },
    },
  });
  return results.violations.map(
    (v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`
  );
}
