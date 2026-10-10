# Cloud Plan v2

更新：2026-10-10。

Cloud Plan 是 Wenyan 的 **明确任务 / commitment 层**。它不承担日常动态学习编排；日常策略由 Learning Intent 表达，具体下一小段由 Smart Session 根据最新事实实时生成。

核心边界：

> Fact = 过去真实发生的学习；Intent = 未来策略；Smart Session = 动态下一段；Cloud Plan = 少量明确、持久、可追踪的任务。

Cloud Plan 不能替代学习事实，也不能自行声明完成。完成状态永远由匹配的 immutable learning event 推导。

## 当前真实用途

适合 Cloud Plan 的任务应同时具备较强的显式身份，例如：

- 指定词书的指定章节；
- 明确 due date；
- 需要跨设备持久存在；
- 需要 plan/task identity 与真实 completion evidence；
- ChatGPT 需要后续读取任务状态。

“不超过 30 分钟”“今天复习优先”“少学新词”“多做词义回想”属于 Learning Intent，不应冻结成 Cloud Plan。

## 当前生产合同

数据库：

- `public.study_plans`
- `public.plan_tasks`
- `public.study_plan_revisions`
- `public.plan_mutation_receipts`
- `public.oauth_client_capabilities`
- `public.get_plan_status(uuid)`（SECURITY INVOKER）

当前网站与 MCP **唯一可执行的 task kind 是 `chapter`**。

底层表的历史 check constraint 可能仍包含 `smart_review / word_set / dictation / weak_words / mixed_session` 等早期预留名字；这些不是当前产品能力。网站会把非 `chapter` task 视为 deferred，MCP 写工具也不会创建它们。不要根据数据库预留枚举宣称功能已实现。

## 生命周期

2026-10-10 `plan_lifecycle_closure` 已上线：

- 同一 owner 最多一个 `status='active'` 的 Cloud Plan；
- create 使用 owner 级 transaction advisory lock；
- 新建显式 Plan 会 supersede 旧 active Plan：旧 Plan archive、revision +1，并保留 revision snapshot；
- `get_plan_status(null)` 只返回仍有网站可执行且尚未完成的 active chapter task 的 Plan；
- `get_plan_status(explicitPlanId)` 仍可读取 archived / exhausted 历史；
- 没有删除历史 Plan，也没有修改任何 Learning Fact。

如果未来引入第二个真实学习域（例如 Literature）并确实需要并行 commitment，可再把 single-active 边界升级为 owner + domain/lane；当前不要提前复杂化。

## Completion 规则

`plan_tasks.state` 只表示计划层状态：

- `active`
- `cancelled`

没有 `completed` 状态。

当前 chapter completion 必须来自真实 `chapter_completed` event，并精确匹配：

- owner；
- `planId`；
- `taskId`；
- 实际 dict/chapter；
- 对新 run，还必须匹配 task execution fingerprint。

### Run execution identity

新 run 在启动时记录：

- `ownerUserId`（Cloud Plan）；
- `planRevision`；
- `taskFingerprint`。

当前 fingerprint 只描述执行目标：

`chapter:<dictId>:<chapterIndex>`

它故意不包含 title / reason / dueDate / estimatedMinutes：这些规划元数据变化不应该作废仍指向同一学习目标的 run。

`planRevision` 用于 provenance；是否还能完成当前 task 由 fingerprint 决定。这样可以允许“只改截止日期”而不丢掉正在进行的学习，同时阻止“任务已改成另一章”后旧 run 误完成新任务。

服务端 `get_plan_status` 对带 `taskFingerprint` 的新 completion fact 会重新与当前 task config 比对。历史 completion fact 早于 fingerprint 合同，继续按旧 plan/task identity 兼容读取；已有 completion evidence 的 task 本身仍受计划写合同保护，不允许静默改写历史。

启动任务本身永远不等于完成；Command Bus 的 completed receipt 也只代表网页动作执行成功。

## 本机缓存与账号边界

Cloud Plan 拉到 Dexie 后只是 **owner-bound execution cache**：

- 写入 `ownerUserId`；
- 旧的无 owner cloud cache 不自动继承当前账号；
- Today 手动开始 cloud task 前按 planId 重新向 Supabase 读取，通过 RLS 验证 owner / active 状态 / task；
- 新 Cloud Plan run 再次绑定 owner / revision / fingerprint；
- 换账号或缓存过期不能把旧计划上下文附到新的学习事实。

网络失败仍不能阻止普通本地学习。若 Cloud Plan 身份无法可靠确认，学习事实可以正常保存，但不得伪造 Plan completion。

## OAuth capability

- `plans:read`：读取计划；
- `plans:write`：创建 / 修订 / 归档显式计划；
- `session:control`：启动明确任务；
- `coach:auto_adjust` 属于 Learning Intent，不等于 Cloud Plan write。

OAuth client 不能自授权，不能修改 `learning_events`。

## 当前工具

- `get_plan_status`
- `create_study_plan`
- `revise_study_plan`
- `archive_study_plan`
- `start_task`（Command Bus，启动不等于完成）

写操作使用 requestId 幂等；revision 更新使用 optimistic concurrency。

## 不做

- 不开放任意 SQL / JavaScript / URL；
- 不允许 AI 修改历史学习事实；
- 不把 Cloud Plan 重新扩成第二套 Smart Session；
- 不为了“支持更多 task kind”机械实现数据库里早期预留的枚举；
- 不把页面打开、任务启动、Command receipt 当作学习完成。
