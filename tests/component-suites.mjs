export const componentSuites = {
  toaster: { tests: ['tests/toaster-csp.mjs'], slow: ['tests/toaster-package.mjs'] },
  input: { tests: ['tests/input-csp.mjs'], slow: ['tests/input-package.mjs'] },
  banner: { tests: ['tests/banner-csp.mjs'], slow: ['tests/banner-package.mjs'] },
  calendar: { tests: ['tests/calendar-controlled.mjs'] },
  expander: { tests: ['tests/expander-csp.mjs'], slow: ['tests/expander-package.mjs'] },
  card: { tests: ['tests/card-csp.mjs'] },
  progress: { tests: ['tests/progress-csp.mjs'] },
  tooltip: { tests: ['tests/tooltip-csp.mjs'], slow: ['tests/tooltip-package.mjs'] },
  text: { tests: ['tests/text-csp.mjs'] },
}
