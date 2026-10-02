# engineering-ladder-th

[ภาษาไทย](README.md) | English

A Thai-language career ladder for software engineers, covering both the IC and manager tracks, plus a tech lead playbook and a self-assessment page that runs in the browser. A company can adapt it in an afternoon.

[![CI](https://github.com/nuttakulsv/engineering-ladder-th/actions/workflows/ci.yml/badge.svg)](https://github.com/nuttakulsv/engineering-ladder-th/actions/workflows/ci.yml)
[![License: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey.svg)](LICENSE)
[![Code: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](LICENSE-CODE)

[![Self-assessment result for an Engineer aiming for L3](docs/preview.png)](https://nuttakulsv.github.io/engineering-ladder-th/#t=ic&l=L3&v=1u9j4pm&c=____f75kCAAAAAAA)

**[Try the self-assessment](https://nuttakulsv.github.io/engineering-ladder-th/)**. Pick a track and a target level, tick what you do consistently, and see the gaps per dimension. Your answers live only in the URL, so you can send the link to your manager before a 1:1.

The ladder text itself is in Thai. This page explains what is in the repo for non-Thai readers, for example regional managers of Thai teams.

## Why

Most Thai companies with 10 to 200 engineers have no written definition of what separates an Engineer from a Senior, or a Senior from a Tech Lead. Titles end up tied to tenure or to counter-offers, strong engineers move into management because it is the only way to a raise, and promotion outcomes depend on how well a manager argues in calibration.

There are good English ladders already. Translating one is not enough, because Thai teams have their own dynamics: deference to seniority, avoiding public criticism, indirect communication (kreng jai), and team leads who are expected to do both the technical work and the people work. This ladder was written from scratch in Thai with those in mind.

## What's inside

| | |
|---|---|
| [IC ladder](ladder/ic.md) | L1 Junior to L5 Principal |
| [Manager ladder](ladder/em.md) | Engineering Manager, Senior EM, Head of Engineering |
| [Levels, titles and the two tracks](guides/levels-and-titles.md) | Senior vs Tech Lead vs Staff, switching between IC and manager |
| [Using the ladder](guides/using-the-ladder.md) | How to read it without turning it into a checklist |
| Process | [Calibration](guides/calibration.md), [promotion](guides/promotion.md), [adapting it to your company](guides/adapting.md) |
| Tech lead playbook | [First 90 days](guides/first-90-days.md), [1:1s](guides/one-on-ones.md), [feedback](guides/feedback.md), [design reviews and RFCs](guides/design-reviews.md), [tech debt](guides/tech-debt.md), [delegation](guides/delegation.md), [incidents](guides/incidents.md), [onboarding](guides/onboarding.md), [hiring](guides/hiring.md) |
| [Templates](templates/) | Self-review, manager review, promotion packet, 1:1 doc, postmortem, onboarding checklist, interview scorecard |

Every level has six dimensions: technical skill, delivery, scope and impact, collaboration, leadership, and ownership. Each cell lists behaviors you would actually see in a sprint, "not yet at this level if…" counter-examples, the evidence a manager can point to in a review, and a concrete next step.

| IC | Scope | Manager | Scope |
|---|---|---|---|
| L1 Junior Engineer | Tasks someone else broke down | | |
| L2 Engineer | A feature | | |
| L3 Senior Engineer | A project or part of a system | | |
| L4 Staff Engineer / Tech Lead | A team or several teams | M1 Engineering Manager | One team, 4–8 people |
| L5 Principal Engineer | The organization | M2 Senior Engineering Manager | Several teams, 15–40 people |
| | | M3 Head of Engineering | All of engineering |

Rows on the same line have comparable scope. Moving into management is a change of job, not a promotion.

## Fork it for your company

All content comes from one file, `data/ladder.json`. The Markdown ladders and the self-assessment page are generated from it.

```bash
npm run build   # validate data, regenerate ladder/*.md, build the site into _site/
npm run check   # fail if data is incomplete, ladder/*.md is stale, or a relative link is broken
npm test        # level calculation, share links, and the page script against a fake DOM
npm run dev     # build and serve on http://localhost:8080
```

Node.js 20 or newer, no dependencies to install.

```console
$ npm run check
ok (ic: 5 levels, 90 behaviors; em: 3 levels, 54 behaviors)
```

If a cell is incomplete the build names it, for example `ic/L3/delivery: growth is empty`. Enable GitHub Pages with the included workflow and you have your own ladder site. Rewording a behavior keeps old share links working. Adding, removing or reordering behaviors invalidates them, and the page says so instead of misreading them.

## How the page scores you

In each dimension a level counts as reached when two thirds of its behaviors are ticked and every level below it is reached too. The threshold is deliberately coarse. The result is meant to start a conversation, not to replace one.

## Salary

There are no salary numbers in this repo on purpose. They vary too much by industry, company size and year, and stale numbers do more harm than none. [adapting.md](guides/adapting.md) explains how to pair the levels with your own bands.

## References

All text is original. Ideas came from Jorge Fioranelli's [Engineering Ladders](https://github.com/jorgef/engineeringladders), [progression.fyi](https://progression.fyi/), Will Larson's [StaffEng](https://staffeng.com/), Camille Fournier's *The Manager's Path*, Charity Majors' [The Engineer/Manager Pendulum](https://charity.wtf/2017/05/11/the-engineer-manager-pendulum/), Google's [Postmortem Culture](https://sre.google/sre-book/postmortem-culture/), and the Situation-Behavior-Impact model from the [Center for Creative Leadership](https://www.ccl.org/).

## Contributing

Wording fixes, sharper behaviors and stories from companies that adopted it are all welcome, in Thai or English. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Content (data, ladder, guides, templates and the READMEs): [CC BY 4.0](LICENSE), © 2026 nuttakulsv.
Site and script code: [MIT](LICENSE-CODE).
