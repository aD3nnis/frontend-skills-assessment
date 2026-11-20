# Notes

## A note on length

The instructions ask me to jot notes as I go but also to hand back a short file, and I made a lot of decisions. Because the instructions say to keep the notes short, and this is already lengthy, I left out most of the detail. The full reasoning is in the decision files in `docs/workflow/` on the `main` branch: one each for the bug fix (`total-processed`), pagination and search, the detail page and the new-transaction form. Each also has a spec and a plan, except the form, which has only a decisions file because I took it through the workflow after the code was already written. Those files record the options considered, what I turned down and why, the code review findings and what I did about each, and how each change was verified. They are dated working logs: a few test counts in them are from the moment they were written, not today.

## What I changed and why

Five PRs of work (#1 to #5) are merged to `main`, plus one follow-up (#6) that I reverted (#7). API 61 and web 53 tests pass, lint is clean. Specs, plans and decisions for each are in `docs/workflow/`.

**Task 1, pagination and search**
- **What changed:** the server now filters, sorts, pages and totals, and the UI loads 25 rows at a time with a debounced search. The search and page are in the URL (`?q=&page=`).
- **Why:** the server holds all the data, and the total has to cover every match, not one page. Keeping the search and page in the URL means refreshing, clicking Back, or sending someone the link keeps you on the same results.

**Task 2, summary total**
- **What changed:** the total now counts only approved transactions, and the rule lives in one place, the API.
- **Why:** it was adding up every status, so declined and pending rows were counted. Details are in the Task 2 section below.

**Task 3, New Transaction form**
- **What changed:** amounts were truncated by `parseInt` (`12.99` became `12`) and error responses were treated as success. The amount is now checked on both sides, with inline errors, a loading state and a success toast. Claude wrote the tests. To check them, Claude broke the code one place at a time, and I predicted whether a test would catch each break and compared that with the result.
- **Why:** the web gives instant feedback and the API is the source of truth. The amount is a text field with a pattern check, so `12.345` and `1e3` are rejected instead of silently accepted. There are only three fields, so I kept the checks as a small function instead of adding a validation library.

**Task 4, detail page**
- **What changed:** `/transactions/:id` shows one transaction's details, with loading, not-found and error states. List rows are now links, and the old modal is gone.
- **Why:** a page gives a shareable link, a working Back button and a reload that keeps you on the same transaction. It fetches by id, so opening a link directly works, and links work from the keyboard or in a new tab.

**Also**
- **What changed:** moved the hardcoded processor key and webhook secret to environment variables.
- **Why:** leaked secrets are dangerous. They are still in git history, so they need rotating. See Task 5.

**How I worked.** My Claude workflow is the guardrail for every coding decision. Claude wrote the code, and I took it through the workflow. Each task gets a type and moves through phases (spec, plan, build, verify, my own walkthrough, then `/code-review`), and Claude has to show evidence and wait for my OK before each phase change. Decisions and detours are written to committed files in `docs/workflow/`. My [Claude Workflow Map · Working Guide](https://avadennisportfolio.netlify.app/aichats/workflow-map/) is a good visualization of how I work in the different workflows, based on the guardrails my Claude setup (claude-workflow) has. It combines Claude Code's built-in features (permissions, hooks, subagents, `/code-review`, `/simplify`) with custom ones I wrote (rules, skills, slash commands and decision files). Part of it is enforced by the tooling: permissions block pushes to `main` and reading `.env`, and hooks run lint after every edit and tests when Claude finishes. The phase rules and skills are instructions, so I still reviewed the work myself.

**How I approached the code.** I started with my workflow's Explore step, so Claude read the repo and reported back with file and line references, marking what it had only read as a hypothesis to verify. It found the Task 2 root cause in both the web and the API, along with the secrets problem and the `VOIDED` status, and it recommended doing Task 2 before any other task. That task is small, has a clear way to reproduce the bug, and forces a decision on what counts as "processed", which Task 1's server-side summary would reuse. Before changing any code, I asked whether testing was set up, so I'd know how to verify my work. It wasn't: `npm test` found no test files in either workspace. So the first step of Task 2 was adding tests in both the web app and the API, and every later task could be checked the same way. When I decided to run tasks in parallel, I also ran `/map`, a custom command of mine that writes up the software design and system flow, with a diagram and descriptions of the file structure and what each part does, because I'd be touching many parts at once and wanted the architecture in front of me.

**How I weighed time against depth.** The guardrails are meant for in-depth learning, so I tested them on Task 2, the bug fix, which needed the most understanding. I took my full walkthrough there: Claude asked me questions about specific files, and then broke the code one place at a time. For each break I guessed whether a test would catch it, then checked the actual result. That took longest, so for Tasks 1, 3 and 4 I ran them in parallel with the same steps, reviewed the diffs in the PRs, and spent the saved time on testing the UI and the results. This isn't a live production site, so I judged that fine, though I'd go slower with more time.

**Final verification, and what I left out.** At the end Claude ran the repo's tests plus its own checks on the combined code, I clicked through the flows together on `main`, and I reviewed the added frontend code myself. I felt that was sufficient. I then ran another code review on High, and it raised more critiques, mostly extra tests and minor maintainability fixes. For a project not asking for perfection I judged them overkill, and I didn't have time to check them myself: I couldn't review the extra tests and fixes or re-run my own UI tests against them. Claude's tests passed, but I wasn't comfortable keeping changes in `main` that I hadn't verified, so I reverted them and their PR. With more time I would check those fixes properly and keep the worthwhile ones, review at the slower pace, let Claude quiz me on the code even without further code changes, and rerun the full click-through on `main` after any follow-up fixes.

## Task 2 bug

"Total processed" summed every transaction regardless of status, so declined, pending, refunded and unknown-status rows were counted (about $25.4M instead of $6.49M). It now sums only `APPROVED` rows, in integer cents. I used `total` (amount + surcharge), not `amount`, because that matches what the client's processor statement shows. This is an assumption: if the product means sales only, it is a one-word change.

## Task 5 improvements

1. **Rotate the leaked secrets** (security). This one I implemented even though Task 5 didn't require it, because leaked secrets are dangerous: I moved the key and webhook secret out of the source and into environment variables (#2). They are still in git history, so the rest of the fix is to rotate them, load them from a secrets manager, and add secret scanning in CI.
2. **Define the surcharge rule** (correctness). In the seed data each card brand is spread evenly across 2.5%, 3% and 3.5%, so the rate doesn't follow any visible rule. Money is derived from it, and new transactions get a rate of 0. Decide the rule, compute it server-side and test it.
3. **Persist the data** (correctness). Transactions load from `transactions.json` into memory and new ones are only added to that array, so everything created through the form is lost when the API restarts. Move to a database.
4. **Add CI and UI tests** (developer experience, testing). There is no CI, so tests and lint only run on my machine. Add a job that runs `npm test`, `npm run lint` and the typechecks on every PR. The web app also has no jsdom or Testing Library, so the form, the debounce and the detail page states were checked by hand only; add component tests for those so CI covers them.
5. **Finish the keyboard and screen-reader work** (accessibility). The list rows weren't reachable by keyboard and triggered two lint warnings, so Claude suggested in the plan that each row become a real link. Now a row can be reached with Tab and opened with Enter, and the warnings are gone. The next step is to check the focus outline is clearly visible, test with a screen reader (a row is one long link, so it may read poorly as a table), and label the pagination controls.

## Q1 Data flow

You type a letter in the search box and the box updates right away. The page waits 300 ms to see if you type another letter, so it doesn't send a request on every keystroke. Pausing puts the search text in the URL. The URL change makes the page ask the server for results. The server finds the matching transactions, sorts them, and returns the 25 for the page requested, along with the match count and total processed.

Before my changes, the browser held all 10,000 transactions and filtered them on every keystroke, which made it laggy. Now the server does the filtering and sorting and only sends back the page the frontend asks for, so the browser only has to render 25 rows. I made this change because loading and processing every transaction in the browser for each search was slow and wouldn't scale.

The server still scans every transaction on each search. That's fine at 10,000 rows but not at a much larger size, so the next step would be a database with an index on the searchable fields.

## Q2 Task 1 call

The server filters by the search, sorts, picks which 25 rows to send, and counts the matches and the total processed. The browser shows the search box, waits 300 ms before searching, keeps the search and page in the URL, and renders the rows. I put the heavy work on the server because it has all the data, and if the browser did the filtering the server would have to send every row first. The "Total processed" figure also covers every match, not just the 25 on screen, so only the server can add it up without sending everything.

To page through results, the browser asks for a page number (like `page=3`) and the server skips the earlier matches and returns the next 25. That is easy, and people can jump to any page.

With 10 million rows I would change four things:
1. **Use a database** instead of a list in memory, so the data isn't lost on restart.
2. **Add a search index**, so a search doesn't have to check every row.
3. **Page differently.** Skipping millions of rows to reach a deep page is slow. Instead the browser would ask for "the 25 after this row", which is fast on any page. The cost is that you can't jump to a specific page.
4. **Save the totals** instead of adding up millions of rows on every request.

## Q3 Ship/no-ship

The first thing I would refuse to ship is the hardcoded processor secrets. They were committed in plain text, and moving them to environment variables isn't enough because they're still in git history. I would rotate both keys, store the new ones in a secrets manager, and add secret scanning to CI. At my last job we used Vaultwarden to store our secrets and kept a `.env.example` file listing the variables each service needs, so I'd follow that approach here. Right behind that, I wouldn't ship with transactions that vanish when the server restarts or is redeployed, which is in my improvements list above, or with no login on the API.

## What I'd do with more time

- Re-verify after follow-up fixes: I clicked through the flows together on `main` before the reverted PR (#6), but did not recheck them or rerun my UI tests against its fixes. With more time I would review those fixes properly and keep the worthwhile ones.
- Set up a staging environment that mirrors production, so merged changes get tested there before going to prod. For this assessment I only had local runs, which is fine for a take-home but not for a real payments product.
- Re-read the Task 1, 3 and 4 diffs. I didn't have enough time to use my walkthrough command properly.
- Pagination UX: a page-size selector, a "1-25 of N" label and a second pager.
- Add a way to void a mistaken transaction (it keeps a record with a `VOIDED` status instead of deleting it). The API only reads and creates, and new rows are created `APPROVED`, so a typo permanently inflates Total processed.
