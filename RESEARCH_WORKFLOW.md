# Research Workflow

Model-agnostic workflow for company and opportunity research in LocalBase.

This is the durable version of workflows that previously lived mostly in Claude slash commands such as `/research`. Commands can still be useful as shortcuts, but the real contract is the files this workflow produces and the order of work.

## Purpose

Use this workflow when researching:
- a company for SDR outreach
- a company and stakeholders for a job application
- a target account that needs a markdown brief, shareable HTML, and contact list

## Inputs

Start from one of:
- company name
- company domain
- HubSpot contact URL
- HubSpot company URL
- job description paired with company name or domain

## Core Outputs

The stable outputs are:

For jobs workflows:
- `research/briefing.md`
- `research/briefing.html` or `research/index.html`
- `research/contacts.json`

For SDR and account research workflows:
- `research-<slug>.md` or equivalent markdown briefing
- `viz/company-profile-<slug>.html`

## Output Contract

### 1. Markdown briefing

The markdown file is the source of truth. HTML can be regenerated from it or derived from the same research, but the briefing should contain the full reasoning and source trail.

Common sections across strong existing examples:
- title and date
- company overview or snapshot
- leadership and key people
- services, products, or business model
- technology stack or operating environment
- recent news, growth, or strategic changes
- culture or reputation when relevant
- competitive landscape when relevant
- relationship context when relevant
- talking points
- sources

Job-oriented briefs often also include:
- hiring manager or stakeholder context
- implications for the role
- why the role exists now
- where the company is likely investing or under pressure

SDR-oriented briefs often also include:
- intent signals
- existing deal history
- qualification checks
- likely job to be done
- relevant case studies

### 2. Contacts JSON

Use a simple array of contact records:

```json
[
  {
    "firstName": "",
    "lastName": "",
    "title": "",
    "company": "",
    "linkedin": "",
    "relationship": "",
    "notes": ""
  }
]
```

This file is a structured handoff for follow-up workflows such as HubSpot enrichment, outreach, and resume/application tailoring.

### 3. HTML artifact

The HTML file is the shareable presentation layer. It should not be the only durable research artifact.

For jobs work, the common pattern is:
- `research/briefing.html`
- sometimes `research/index.html`
- sometimes extra supporting artifacts like a digital audit or send page

For SDR work, the common pattern is:
- `viz/company-profile-<slug>.html`

## Recommended Process

### Phase 1: Identify the target

Normalize the target first:
- canonical company name
- domain
- slug
- source URL if there is one
- target contact or hiring manager if known

If the input is a HubSpot URL, extract the object ID and resolve the local record before doing outside research.

### Phase 2: Pull local context

Check LocalBase data sources before broad web research:
- HubSpot contacts, companies, deals, meetings
- G2 intent or buyer-behavior sources
- internal notes and prior project files
- existing research folders for the same company or related opportunities

Goal:
- avoid rediscovering facts already present locally
- anchor outside research against internal context

### Phase 3: Verify people

Do not trust CRM titles blindly.

For important contacts:
- verify current role
- determine whether they are an employee, consultant, contractor, advisor, or other external party
- capture likely seniority and budget relevance
- note prior companies or relevant background

### Phase 4: Research the company

Collect enough signal to answer:
- what the company actually does
- how it makes money
- what has changed recently
- where it is growing, hiring, or under pressure
- what systems, channels, or organizational realities shape the opportunity

Prefer:
- company site
- leadership pages
- job postings
- earnings, filings, or regulatory records where relevant
- reputable press
- LinkedIn for role verification

### Phase 5: Synthesize for the use case

The brief should not just be a fact dump.

Translate research into:
- outreach angles
- interview talking points
- stakeholder hypotheses
- likely pain points
- likely reasons the role exists now
- likely metrics or outcomes expected from the work

### Phase 6: Save outputs

Always produce the durable files:
- markdown briefing
- contacts JSON if stakeholders matter
- HTML if the work benefits from a shareable artifact

## Writing Standard

Aim for:
- concise facts in tables
- interpretation in short paragraphs or bullets
- explicit separation between confirmed facts and inference
- a clear sources section

## Inference Rules

You can infer:
- likely stakeholder priorities
- likely organizational pressures
- likely job-to-be-done
- likely talking points

But label interpretation clearly and support it with observed evidence.

## Relationship to Model-Specific Commands

Older slash commands such as `/research` remain useful as convenience wrappers, but they should be treated as one possible interface to this workflow, not the workflow itself.

The durable, model-agnostic parts are:
- where inputs come from
- what local data is checked first
- what files get written
- how the output is structured
