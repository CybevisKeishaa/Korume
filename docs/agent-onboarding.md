# Agent onboarding — Korume

Tài liệu này dành cho người hoặc coding agent mới làm việc trong repo. Mục tiêu là tách rõ
context dùng chung trong Git khỏi công cụ và credential riêng trên từng máy.

## Đọc để hiểu app

Đọc theo thứ tự này ở đầu session:

1. `AGENTS.md` — luật sản phẩm, bảo mật, accessibility, testing và Definition of Done.
2. `japanese-learning-app-spec.md` — product source of truth cho modules, schema và API.
3. `docs/product/business-model.md` — source of truth cho market/monetization; thắng khi xung đột
   với spec về business model.
4. `docs/lessons.md` — các bài học vận hành bắt buộc phải áp dụng.
5. `docs/superpowers/run-state/README.md` — quy ước run-state cho nhánh dài.
6. Run-state cụ thể trong `docs/superpowers/run-state/` của nhánh đang làm.
7. `.serena/memories/project_status.md` — context sản phẩm và các gotcha kỹ thuật.
8. `.serena/memories/feature_backlog_deferred.md` — các tính năng đã brainstorm nhưng chưa ship.

Khi các memory tổng quan và run-state mâu thuẫn, run-state canonical, Git history và spec/plan
được trích dẫn trong đó là nguồn mới hơn. Không suy ra trạng thái branch từ một memory cũ.

Prompt mở đầu hữu ích cho agent:

```text
Activate the current directory as a Serena project. Read AGENTS.md, japanese-learning-app-spec.md,
docs/product/business-model.md, docs/lessons.md, the canonical run-state for this branch, and the
relevant Serena project memories before coding.
```

## Những gì được chia sẻ qua Git

- `AGENTS.md`, `README.md`, `docs/lessons.md` và `docs/superpowers/run-state/`.
- `.codex/agents/`, `.codex/commands/` và `.codex/docs/workflow.md`.
- `.serena/memories/*.md` — project memories dạng Markdown, dùng chung cho cả team.
- `.serena/project.yml` — cấu hình Serena theo project, không chứa secret.

`.serena/project.local.yml`, `.serena/cache/` và log/index của Serena vẫn là local. Không commit
`.env.local`, OAuth/token, recording, `~/.codex`, `~/.claude` hoặc plugin cache.

## Cài Serena và kết nối MCP

### Codex CLI/App

Cài Serena theo môi trường của bạn, sau đó chạy trong repo:

```bash
serena setup codex
```

Kiểm tra MCP bằng `/mcp`. Nếu project chưa tự activate, dùng prompt:

```text
Activate the current dir as project using serena.
```

Manual fallback trong `~/.codex/config.toml`:

```toml
[mcp_servers.serena]
command = "serena"
args = ["start-mcp-server", "--project-from-cwd", "--context=codex"]
```

Config này là user-level vì mỗi người có binary/path/permission khác nhau; không copy nguyên
`~/.codex/config.toml` vào repo.

### Claude Code

```bash
serena setup claude-code
```

Hoặc thêm Serena theo project bằng lệnh MCP của Claude Code. Xác nhận bằng `/mcp`. Figma,
Pyright và các plugin khác cũng cần được cài/đăng nhập riêng trên máy của từng người.

## Tooling baseline

Repo không yêu cầu mọi người có cùng plugin cache. Baseline hữu ích là:

- Serena MCP — semantic navigation, symbols và project memories.
- Superpowers — brainstorming, TDD, review và verification workflow.
- Pyright LSP — hỗ trợ phân tích TypeScript/Python nếu cần.
- Figma — chỉ cần cho task có Figma source và phải có quyền truy cập file.

Codex/Claude còn có thể có browser, computer-use, documents, PDF, spreadsheet hoặc MCP khác
ở cấp user. Chúng không phải product dependency của Korume. `figma-mcp-go`, Blender và
`node_repl` là các server cục bộ hiện có trong môi trường người maintain repo; chỉ cấu hình chúng
khi task thực sự cần và không chia sẻ credential của chúng.

## Khởi động app

```bash
npm install
cp .env.local.example .env.local
npm run typecheck
npm test
npm run dev
```

Các key trong `.env.local` là local-only. App yêu cầu provider được chọn tường minh; nếu chỉ
đang đọc code hoặc chạy test không cần tích hợp ngoài, dùng các giá trị `none`/dev được tài liệu
hóa trong `.env.local.example`.

## Git và worktree

- Làm việc trên branch riêng; không sửa trực tiếp `master`.
- Chỉ những commit đã push mới xuất hiện trong clone của người khác.
- Worktree và thay đổi chưa commit không phải context dùng chung.
- Không dùng `git reset --hard`, `git checkout --` hoặc stash để khôi phục file khi chưa kiểm tra
  thay đổi của người khác.
