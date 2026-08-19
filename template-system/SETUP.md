# GitHub setup — the docs check

The [docs check](../.github/workflows/docs-check.yml) fails any pull request that changes product code without updating `current_state.md` and the implementation reality log.

**The file arrives with your repo, but it does not enforce anything until you configure GitHub to require it.** Out of the box it will run and show a red ✗, and you'll still be able to merge straight past it. The steps below are what turn it into a real gate.

> **Read this first — it may not apply to you.**
>
> **Requiring a status check on a private repo needs a paid GitHub plan.** Both mechanisms that can do it — Rulesets and classic Branch protection — are documented by GitHub as available "in public repositories with GitHub Free, and in public *and private* repositories with GitHub Pro, Team, or Enterprise."
>
> So on a **free personal account with a private repo, you cannot make this check blocking.** Your options:
> - **Make the repo public** — free, and the check becomes enforceable.
> - **Upgrade to GitHub Pro** (a few dollars a month) — keeps the repo private and enforceable.
> - **Do nothing** — the check still runs and still shows a red ✗ on every offending PR. It just won't physically stop you from merging. For a solo builder who reads their own PRs, that is genuinely most of the value. **Don't let this stop you shipping.**

---

## For each new project (about 5 minutes, once)

### 1. Create the repo

Click **Use this template** → **Create a new repository**. GitHub copies every file, including `.github/workflows/`, into your new repo.

What it does **not** copy: labels, rulesets, branch protection, or Actions settings. Those are repo settings, not files — which is why the rest of this page exists and has to be redone per project.

### 2. Confirm Actions is on

Open the **Actions** tab in your new repo. Actions is enabled by default on new repositories. If you see a banner asking you to enable workflows, click it.

*(GitHub's own docs are silent on whether workflows are auto-enabled specifically in template-generated repos, and there was a known bug here in the past. Ten seconds of looking beats assuming.)*

### 3. Create the escape-hatch label

**Issues** tab → **Labels** → **New label**.

| Field | Value |
| --- | --- |
| Name | `no-docs-needed` |
| Description | This PR genuinely needs no doc updates — a typo, dependency bump, or config tweak |

The name must match exactly; the workflow looks for that string. Without this label existing, you have a gate with no override, which is how a useful check becomes a check you resent.

### 4. Make the check run once

Open any pull request — even a trivial one. The check needs to have run at least once before GitHub will offer it in the classic branch-protection picker. (Rulesets let you type the name in without waiting, so you can skip ahead if you use those.)

You should see a check named **`docs-check`** appear on the PR.

### 5. Require it

**Settings** → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**.

| Field | Value |
| --- | --- |
| Name | `Docs must ship with code` |
| Enforcement status | **Active** |
| Target branches | Add target → **Include default branch** |
| Rules | Tick **Require status checks to pass** |
| → Add checks | Type `docs-check` |

Save. GitHub now refuses to merge a PR whose `docs-check` is failing.

**Rulesets vs. classic branch protection:** use Rulesets. Both work and both exist, but Rulesets is where GitHub is investing, it lets you name a check before it has ever run, and anyone with read access can see the rules. The classic path, if you need it, is **Settings → Branches → Add branch protection rule → Require status checks to pass before merging**.

### 6. Also tick "Require a pull request before merging"

In the same ruleset. Without it, nothing stops a commit going straight to `main` and bypassing every check you just set up. A gate on the PR is worthless if the PR is optional.

---

## For this template repo itself

Nothing to do, and nothing to gain. This repo has no product code, so the check will pass on every PR by design. It's here to be inherited, not to run.

The one thing worth doing: **push it to GitHub** (`git remote add origin …`). There's no remote configured yet, so nothing here can run at all until there is.

---

## What it actually does

**It fails a PR when:** product code changed, and `docs/pm/current_state.md` and `docs/pm/implementation_reality_log.md` did not.

**It passes when:** only docs, config, or tooling changed · or code changed *and* both required docs were updated · or the `no-docs-needed` label is on the PR.

**When it fails,** it posts a comment on the PR naming the missing docs and how to override. Push the doc updates and it re-runs. Add the label and it re-runs — no new commit needed.

**Where its idea of "product code" lives:** the `grep -vE` line in [`docs-check.yml`](../.github/workflows/docs-check.yml). It treats everything as product code *except* `docs/`, `.github/`, `.claude/`, `template-system/`, root-level `.md` files, and a few dotfiles. If your project keeps source somewhere unusual, that's the line to edit.

## What it can't do

**It checks that a doc was touched, not that the doc is true.** An agent could add a junk line to `current_state.md` and sail through. In practice agents skip work far more often than they fake it, so this catches the real failure mode — but it is a floor, not a guarantee. The thing that checks whether the docs are *true* is `/reconcile`, and it's a habit rather than a gate. You need both.

**It won't post a comment on PRs from forks** — GitHub gives those a read-only token. The check itself still passes or fails correctly. If you're building solo, this will never come up.

## Why there are no third-party actions in it

The obvious way to write this check is with `tj-actions/changed-files`, the most popular action for the job. In March 2025 it was compromised (CVE-2025-30066): attackers repointed existing version tags — including ones people had pinned — at code that dumped the runner's secrets into the build log, where on a public repo anyone could read them. Roughly 23,000 repositories were exposed.

This workflow uses only `gh`, GitHub's own CLI, which is preinstalled on their runners. It's a few more lines of shell, and it removes that entire category of risk. If you ever extend this workflow, keep that property.
