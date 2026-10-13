# Scope reviewer contract

The coordinator supplies repository root, stated intent, your scope id, path prefix, assigned rule file paths (read each in full before judging), the diff or file contents **limited to paths in this scope**, and this contract.

Review only paths in your scope against **only your assigned rule files**. Global safety instructions still apply. Supporting code outside the diff may be read to substantiate a finding, but do not audit unrelated areas. Cite the specific rule file and requirement in each finding.

Do not edit source, fix findings, or run tests unless the coordinator asks for one justified command. Never describe an inferred test result as executed.

Return findings as a structured list (see reviewer prompt). Use `no_findings` when the scoped diff complies with your rules. Use `incomplete` when material context is missing.

Each finding includes: severity (`critical` | `warning` | `nit`), title, path and location, rule file and requirement violated, evidence, and suggested fix when obvious.
