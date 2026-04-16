Executive Summary Report

Project Name: Borderless Economics - PNWER Tariff Impact Dashboard  
Prepared for: Pacific Northwest Economic Region (PNWER)  
Report Date: April 14, 2026  
Project Repository: https://github.com/MadaoShall-1/Borderless-Economics  
Live Deployment: https://pnwer-trade.vercel.app/

1. Project Charter Review & Evolution

Problem Statement - Validation and Refinement  
The original project charter identified a clear policy gap: PNWER did not have a unified, accessible tool to show how recent U.S. tariff actions were affecting cross-border trade with Canada and Mexico at the regional level. That problem was validated throughout the engagement. As the team worked with the data, the problem statement was refined in two important ways. First, Canadian energy exports required separate treatment because they were subject to a different tariff structure than general goods. Second, U.S.-Mexico trade could not be modeled using a blanket tariff assumption because a significant share of imports remained USMCA-exempt. These refinements did not change the core problem; they made the final analysis more accurate and more useful for policymakers.

Goal Statements - Achievement and Modifications  
The major goals in the original charter were achieved by the end of the semester. The team delivered an interactive dashboard, integrated official trade data from the U.S. Census Bureau and Statistics Canada, enabled custom tariff scenario forecasting, generated AI-assisted policy reports, and covered all 10 PNWER jurisdictions. In addition, two goals expanded beyond the original charter. The team added oil-price decomposition to separate tariff effects from energy price movements, and it introduced DID and Triple-DID analysis to provide stronger evidence of the regional benefits associated with USMCA.

Scope Changes  
The approved scope changes improved the usefulness of the final product without changing its purpose. First, the analysis expanded from sector-level views to include HS4 product-level detail, allowing users to examine specific commodities such as crude oil, lumber, wheat, and auto parts. Second, the project expanded from one-direction import analysis to a broader bilateral framework that also captured U.S. exports and Canadian retaliatory tariff effects. These changes made the dashboard more relevant for advocacy and policy communication.

Updates to Stakeholder Engagement  
Stakeholder engagement remained consistent throughout the project. Brandon Hardenbrook served as the primary client contact through biweekly meetings focused on requirements validation, feedback, and demos. Faculty mentor Oscar Veliz provided technical guidance on architecture and implementation decisions. This structure helped the team keep the project aligned with both client needs and academic expectations.

Milestones  
Milestones were largely met according to the original semester timeline. The team first established the user interface and backend structure, then expanded the data pipeline, calibrated the econometric model, integrated the forecast API, and completed report generation and deployment. While some technical decisions evolved during development, the final deliverables were completed within the semester and remained consistent with the charter's intent.

2. Client Organization Overview

Organization Overview  
The Pacific Northwest Economic Region (PNWER) is a statutory public-private nonprofit organization that promotes regional cooperation across five U.S. states and five Canadian provinces and territories. Its work focuses on trade policy, regional economic development, and cross-border governance. Because the PNWER region functions as an integrated economic corridor, changes in tariffs can have immediate effects across energy, forestry, agriculture, and manufacturing on both sides of the border.

Industry Context and Challenges  
At the start of the engagement, PNWER faced two major challenges. The first was policy volatility: tariff changes in 2025 created uncertainty for member jurisdictions that needed fast, region-specific analysis. The second was a workflow challenge: staff had to collect data manually from multiple public sources, interpret it, and convert it into policy briefings. This process was slow, labor-intensive, and difficult to scale across all 10 jurisdictions.

Specific Problem Addressed  
The team was engaged to build a platform that could automate data collection, estimate tariff impacts, present results in an accessible dashboard, and generate policy-ready narrative reports. In short, PNWER did not lack raw data. It lacked an efficient and defensible system for converting that data into timely insight for decision-makers.

3. Deliverables Summary

Deliverable 1: Interactive Tariff Impact Dashboard  
The team delivered a publicly accessible web application that presents key trade indicators, jurisdiction-level impacts, sector breakdowns, model outputs, and report-generation tools. This dashboard gives PNWER staff and partner offices a centralized way to view and communicate trade impacts without relying on manual spreadsheet analysis.

Deliverable 2: Automated Monthly Data Pipeline  
The team delivered an automated data-refresh workflow that pulls the latest available releases from the U.S. Census Bureau and Statistics Canada and updates the dashboard outputs. This significantly reduces the manual effort previously required to gather and reconcile data for policy briefs.

Deliverable 3: Econometric Tariff Impact Model  
The team implemented a multi-layer econometric framework using DID, Triple-DID, and CES/Armington modeling. This model provides a more defensible analytical foundation for scenario forecasting and supports the dashboard's role as a policy-facing decision tool.

Deliverable 4: AI-Assisted Policy Report Generator  
The team integrated a report-generation system that converts live data and model outputs into readable narrative reports. This allows users to move from quantitative analysis to briefing-ready text in a matter of seconds.

Deliverable 5: Technical Documentation and Deployment Guide  
The team provided setup instructions, deployment guidance, environment-variable references, and local development support. This documentation reduces the handoff burden for PNWER and makes it easier for future student teams to maintain or extend the project.

4. Outcomes

Fully Met Outcomes  
Several charter outcomes were fully achieved. The dashboard was successfully deployed and made publicly accessible. It covers all 10 PNWER jurisdictions and supports both current and forecast views. Scenario-based forecasting was implemented through interactive tariff inputs connected to the backend forecast model. AI-assisted report generation was completed and integrated into the platform. The final system also supports bilateral trade analysis and provides stronger quantitative evidence of USMCA-related regional benefits.

Partially Met Outcomes  
Some outcomes were only partially met. Model accuracy at the aggregate level did not fully reach the ideal threshold described in the charter, largely because energy trade was strongly affected by oil-price movements that tariff variables alone could not explain. However, the model still performed well enough to support policy analysis, especially outside the energy sector. In addition, the refresh pipeline functions successfully, but the current deployment still relies on Railway's ephemeral file system rather than a fully persistent storage solution.

Outcomes Left for Future Teams  
Several items were identified as appropriate for future phases of work. These include migrating refreshed data to persistent cloud storage, extending Mexico-side analysis to a finer regional level, adding real-time tariff alerting features, and implementing user authentication for restricted-access scenarios. These items were deferred in order to protect delivery quality on the project's core commitments.

Additional Value Delivered Beyond Original Criteria  
The team delivered several high-value additions beyond the original charter. These include oil-price decomposition, HS4 commodity-level analysis, transparent model disclosure, and a more rigorous causal framework than originally proposed. Together, these additions improved the dashboard's credibility and practical value for policy advocacy.

5. Stakeholder Management & Engagement

Communication Strategies Employed  
The team relied primarily on biweekly meetings with Brandon Hardenbrook to share progress, demonstrate working versions of the platform, and align on priorities. Rather than presenting only wireframes or static mockups, the team regularly shared live builds so stakeholders could give feedback based on real data and actual user interactions.

How Stakeholder Feedback Shaped the Work  
Stakeholder feedback directly influenced the project's direction. Requests for state-level visibility led the team to prioritize Census state-level data integration. Concerns about API cost and accessibility led to the creation of a no-key Demo Mode. Interest in "what-if" policy analysis led to the development of interactive tariff scenario controls. These examples show that stakeholder input materially shaped both feature prioritization and usability decisions.

Challenges in Stakeholder Management  
The main challenges involved expectation-setting and scope control. The team had to clearly communicate the unavoidable publication lag in official trade data, manage requests for additional features that could not be completed within the semester, and prepare for handoff in a context where the client did not have dedicated engineering staff. These challenges were addressed through transparent documentation, clear prioritization, and a design that minimized the technical burden on end users.

Formal Client Feedback on Deliverables and Perceived Value  
[Insert one formal client quote, email summary, or meeting-based feedback statement here. This section should briefly state how the client perceived the usefulness of the dashboard, scenario modeling, or report-generation features.]

6. Best Practices

Project Management Insights  
One of the clearest lessons from this engagement was the value of deploying early and iterating continuously. Working versions of the platform made it easier to gather practical feedback and detect usability issues quickly. Separating the project into clear modules for data collection, modeling, API logic, and frontend presentation also improved parallel development and reduced bottlenecks.

Client Engagement Best Practices  
For policy-oriented clients, the most effective communication focused on decision-relevant outputs rather than technical detail. Metrics such as jobs at risk, trade lost, and sector exposure were more useful in stakeholder conversations than model structure alone. Demonstrating working prototypes instead of static presentations also made feedback more specific and actionable.

Technical or Industry-Specific Knowledge Gained  
The project reinforced that public trade data should be treated as multiple distinct pipelines with different structures, limitations, and update schedules. It also showed that published elasticity values are only a starting point; calibration against observed data is essential for producing credible estimates. Finally, infrastructure choices matter. Temporary file systems may be acceptable for a class project, but they are not ideal for a long-term production-facing tool.

Recommendations for Future Teams  
Future teams should prioritize both operational stability and analytical depth. First, the current tariff analysis is not fully real-time. At this stage, the platform primarily supports economic analysis comparing conditions before and after tariff policy changes over a defined one-year window. A future team could improve the system by incorporating faster policy tracking, more frequent data updates where possible, and alert-based workflows so the platform becomes more responsive to current tariff developments rather than mainly retrospective.

Second, the econometric model can be further improved. Although the current model accounts for several major drivers, trade outcomes are also affected by many external economic factors such as exchange rates, commodity prices, transportation costs, seasonality, macroeconomic demand shifts, and other policy changes. Future teams should continue refining the model so more of these confounding effects can be isolated, making attribution more precise and forecasts more robust.

Third, the user interface should continue to be optimized. The current dashboard is functional and delivers the required analysis, but future teams can improve clarity, usability, and stakeholder adoption by simplifying navigation, improving visual hierarchy, refining chart presentation, and tailoring key views more directly to policymaker decision needs.

Fourth, the analytical scope can be expanded. Additional sector and product coverage would make the platform more valuable by allowing users to compare a wider range of industries and commodities across jurisdictions. Richer sector-level and product-level forecasting would also make scenario analysis more actionable for client advocacy and briefing use.

In addition to these enhancements, future teams should still complete several foundational improvements that were already identified during this project. These include migrating refreshed data to persistent storage, establishing a clear operational owner, extending Mexico-side regional analysis, adding stronger alerting features, and implementing access controls if the platform is later used for restricted or pre-publication analysis.

7. Knowledge Transfer & Hand-off

Repository of Project Files, Data, and Tools  
Primary Repository: https://github.com/MadaoShall-1/Borderless-Economics  
Frontend Deployment: https://pnwer-trade.vercel.app/  
The repository contains the frontend source code, backend services, data collection scripts, modeling logic, deployment configuration, and project documentation.

User Guides, SOPs, and Training Materials  
The repository README includes setup instructions, deployment guidance, and environment-variable requirements. Core materials for handoff include the frontend source in `pnwer-dashboard/`, backend services in `server.py` and `report_server.py`, the refresh workflow in `refresh_pipeline.py`, data collection scripts in `Data Collector/`, and modeling code in `Tariff Impact/` and `USMCA Impact/`.

Contact Information for External Resources  
Key external resources include the U.S. Census Bureau Trade API, Statistics Canada trade data portal, Railway for backend hosting, Vercel for frontend hosting, and AI providers such as Groq and Anthropic.  
[Add any specific platform owner, faculty contact, or future-team contact here if required by your instructor.]

Next Steps and Recommendations for Sustaining Momentum  
The first priority for a future team should be implementing persistent storage to replace Railway's temporary file system. The second should be identifying a clear operational owner, whether within PNWER or through a future student or technical support arrangement. After infrastructure is stabilized, the team can extend the platform through more detailed Mexico-side analysis, alerting tools, and stronger access-control features.

Resources for Troubleshooting Common Issues  
The most common operational issues are likely to involve the lag in publicly released trade data, loss of refreshed files after infrastructure restarts, and AI report generation failing when provider API keys are missing. These risks should be documented clearly so future users understand what is a platform limitation and what is a fixable configuration issue.

8. Group Photo

[Insert full team photo here.]

Team Members  
[List team members from left to right, with names and optional roles.]
