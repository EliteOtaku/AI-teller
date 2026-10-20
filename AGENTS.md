# AGENTS.md

本文件是本仓库的 agent 指令入口。

## OpenSpec（规格驱动 · 决策档案）

本项目已初始化 OpenSpec 1.8.0。**这是跨会话的决策档案，可靠性高于会话记忆与压缩摘要。**

- **规格即当前真相**：`openspec/specs/<capability>/spec.md`（现有 1 个 capability）
- **变更与决策理由**：`openspec/changes/<name>/` → `proposal.md`（为什么/改什么）+ `design.md`（决策与实证锚点，存在时必读）+ `tasks.md`（进度勾选）
- **历史决策**：`openspec/changes/archive/<YYYY-MM-DD>-<name>/`（已归档 0 个）
- **接手/恢复上下文顺序**：`openspec list` → 当前 change 的 proposal.md + design.md → 源码（本仓库无 `.agent-handoff/`，进度靠 `tasks.md` 与 git 历史）
- **校验**：`npx @fission-ai/openspec validate --all`（结构校验）。
  `--strict` 额外要求英文 RFC-2119 措辞（SHALL/MUST），中文规格基本过不了，当**风格提示**看，不当门禁。
  change 若确属纯文档/工具类、不涉及 spec 变更，在 `openspec/changes/<name>/.openspec.yaml` 写 `skip_specs: true` 即可通过。

当前活跃变更：`cross-page-support`、`multi-provider`、`multi-site-support`
