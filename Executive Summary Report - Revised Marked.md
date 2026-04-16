# Executive Summary Report

**Project Name:** Borderless Economics - PNWER Tariff Impact Dashboard  
**Prepared for:** Pacific Northwest Economic Region (PNWER)  
**Report Date:** April 14, 2026  
**Project Repository:** https://github.com/MadaoShall-1/Borderless-Economics  
**Live Deployment:** https://pnwer-trade.vercel.app/

**修改标记说明**

- `[简化]`：把原文压缩、去重复
- `[补充]`：建议你补进最终版
- `[核实]`：建议提交前确认数据或表述

## 1. Project Charter Review & Evolution

`[简化]` 原项目章程提出的核心问题是：PNWER 缺少一个统一、易用的工具，用来展示 2025 年美国关税政策如何影响其与加拿大、墨西哥之间的跨境贸易。项目推进过程中，这一问题得到验证，但也被进一步细化。团队发现，加拿大能源产品适用不同于一般商品的关税结构，因此需要单独建模；同时，美墨贸易中相当一部分商品符合 USMCA 豁免条件，不能用统一税率假设进行估计。这些发现没有改变项目方向，而是让最终模型更准确、更贴近政策分析的实际需求。

`[简化]` 项目大部分原始目标均在学期末前完成，包括：搭建交互式仪表板、接入美国 Census Bureau 与 Statistics Canada 数据、支持自定义关税情景预测、生成 AI 辅助政策报告，以及覆盖全部 10 个 PNWER 辖区。除此之外，团队还在原章程之外增加了两项扩展成果：一是油价分解，用于区分关税影响与 WTI 价格波动；二是 DID 与 Triple-DID 分析，用于更有力地识别 USMCA 对 PNWER 地区的相对收益。

`[简化]` 经批准的范围调整主要有两项。第一，项目从行业级分析扩展到了 HS4 产品级分析，使用户能够查看原油、木材、小麦和汽车零部件等具体商品。第二，项目从单向进口分析扩展到了双边贸易分析，将美国出口和加拿大报复性关税也纳入平台，从而提供更完整的跨境影响视角。

`[简化]` 利益相关方参与较为稳定。Brandon Hardenbrook 通过双周会议持续提供需求确认、优先级建议和演示反馈；Oscar Veliz 则在技术架构和实现层面提供指导。这样的协作机制确保项目既满足客户使用场景，也符合课程的技术与研究要求。

`[简化]` 里程碑总体按计划推进。团队先完成前端界面和后端框架，再逐步扩展数据管道、校准模型、接入 API，并最终完成报告生成功能与部署。虽然系统架构在过程中有所调整，但最终交付物仍在学期时间范围内完成。

## 2. Client Organization Overview

`[简化]` PNWER 是一个促进太平洋西北地区跨境合作的法定公私合营非营利组织，覆盖美国五个州和加拿大五个省或地区。其工作重点位于贸易政策、区域经济发展与跨境治理的交叉点。由于该区域在能源、林业、农业和制造业方面高度互联，关税变化往往会同时影响边境两侧的经济活动。

`[简化]` 项目启动时，PNWER 面临两类核心挑战。第一是政策环境变化快，2025 年关税调整使成员辖区急需更及时、更具有地区针对性的分析。第二是数据与工作流程低效：工作人员需要从多个公开来源手动收集数据、整合信息，并转化为政策简报。这一流程耗时长、难扩展，也不利于快速响应政策变化。

`[简化]` 团队的任务是搭建一个端到端分析平台，能够自动采集数据、估算关税影响、以可视化方式展示结果，并生成面向政策沟通的叙述性报告。换言之，客户并不缺少原始数据，真正缺少的是一个能将数据快速转化为可行动洞察的系统。

## 3. Deliverables Summary

`[简化]` 为了避免这一节过长，建议按“交付物 + 对客户价值”的格式保留。

1. **Interactive Tariff Impact Dashboard**  
   团队交付了一个公开可访问的 Web 仪表板，展示关键贸易指标、辖区级影响、行业分解、模型结果和报告生成功能。它帮助 PNWER 将原本分散的信息整合到一个界面中，减少手工分析时间。

2. **Automated Monthly Data Pipeline**  
   团队搭建了自动刷新流程，用于拉取最新的 Census Bureau 与 Statistics Canada 数据并更新平台结果。这直接减轻了人工收集和整理数据的负担。

3. **Econometric Tariff Impact Model**  
   团队实现了包含 DID、Triple-DID 和 CES/Armington 在内的多层经济计量框架，为平台提供了方法上更有说服力的预测基础。

4. **AI-Assisted Policy Report Generator**  
   团队将报告生成集成到系统中，使用户能够基于最新模型输出快速生成可用于简报或内部沟通的政策文本。

5. **Technical Documentation and Deployment Guide**  
   团队提供了部署、配置和本地运行说明，降低了客户或后续学生团队接手系统的门槛。

## 4. Outcomes

`[简化]` 这一节建议只保留“完全达成 / 部分达成 / 留给后续团队”三类，不需要每点都写成长段。

### Fully Met Outcomes

- 仪表板已成功部署并可公开访问，覆盖全部 10 个 PNWER 辖区。
- 情景预测功能已实现，用户可以通过调整加拿大和墨西哥税率进行实时分析。
- AI 辅助报告生成已实现，并可根据实时模型结果输出政策文本。
- 双边贸易分析功能已纳入平台，能够展示更完整的区域贸易影响。

### Partially Met Outcomes

- `[简化]` 模型在总体准确度上未完全达到章程中最理想的阈值，但在排除能源价格扰动后表现明显更好。建议这里保留“模型具备政策分析价值，但能源部分受外部价格因素影响较大”这一核心判断即可，不必重复过多技术细节。
- `[简化]` 数据刷新已可运行，但生产环境仍依赖 Railway 的临时文件系统，持久化存储尚未完成。
- `[简化]` 加拿大部分地区的数据粒度受 Statistics Canada 公布范围限制，因此某些小辖区无法像主要省份那样细分。

### Outcomes Left for Future Teams

- 持久化数据存储（如 PostgreSQL 或云对象存储）
- 更细的墨西哥州级分析
- 实时关税政策提醒
- 用户认证与访问控制

### Additional Value Delivered

`[简化]` 除章程原始要求外，项目还提供了油价分解、HS4 商品级分析、更透明的模型披露，以及更强的因果识别框架。这些扩展提升了平台在政策倡导场景中的可信度和可解释性。

`[核实]` 如果你准备保留诸如 “58.81% more” 或 “63,899 jobs at risk” 这类强数字，建议确保它们在 dashboard、README 或附录中能被一致对应。

## 5. Stakeholder Management & Engagement

`[简化]` 团队主要通过与 Brandon Hardenbrook 的双周会议开展沟通。这些会议用于展示工作版本、确认优先级，并根据反馈迭代系统。与其仅展示线框图，团队更倾向于直接提供可用原型，使利益相关方能够基于真实数据和实际交互提出意见。

`[简化]` 利益相关方反馈对项目方向产生了直接影响。例如，对州级分析的需求推动团队优先接入 Census 州级数据；对 API 成本的担忧促成了 Demo Mode；对政策情景模拟的需求则推动了税率滑块和预测 API 的开发。这说明项目不仅是在完成技术任务，也是在持续响应客户真实使用情境。

`[简化]` 项目中的主要利益相关方管理挑战包括：需要反复解释政府贸易数据发布滞后的现实限制、控制中期新增需求对核心交付的冲击，以及在客户缺乏技术维护人员的情况下提前考虑交接方案。团队通过透明说明、清晰记录限制条件，以及尽量降低日常操作门槛来应对这些挑战。

`[补充]` 这里最好加入一条**正式客户反馈**。哪怕是一句来自邮件、会议纪要或展示反馈的原话/转述，也会更符合作业要求。

## 6. Best Practices

`[简化]` 这部分建议写成“给后续团队的可执行经验”，而不是长篇总结。

- **Project management:** 尽早部署可运行版本，并将数据采集、建模、API 和前端展示拆分为清晰模块，能显著提高团队并行协作效率。
- **Client engagement:** 面向政策类客户时，应优先展示“jobs at risk”“trade lost”“sector exposure”这类决策相关结果，而不是先讲方法细节。
- **Technical learning:** 公开贸易数据源结构复杂、限制不同，不能当成单一数据源处理；模型参数也必须结合真实观测数据进行校准。
- **Recommendation:** 后续团队应先解决持久化存储和运维责任，再扩展更复杂的分析功能。

## 7. Knowledge Transfer & Hand-Off

`[简化]` 这一节建议更像“交接清单”，不要把 README 里的全部技术细节再抄一遍。

**Repository and live system**

- Repository: https://github.com/MadaoShall-1/Borderless-Economics
- Frontend: https://pnwer-trade.vercel.app/
- Backend configuration and deployment files are included in the repository

**Core handoff materials**

- `pnwer-dashboard/`: frontend source code
- `server.py` and `report_server.py`: backend services
- `refresh_pipeline.py`: monthly refresh workflow
- `Data Collector/`: source data collection scripts
- `Tariff Impact/` and `USMCA Impact/`: modeling logic
- `README.md`: setup, deployment, and environment guidance

**Recommended next steps**

- Move refreshed data to persistent storage
- Identify an operational owner for maintenance
- Verify API key and hosting documentation
- Decide whether the platform should remain public or move to restricted access
- Evaluate Mexico-side expansion and policy alert features

**Troubleshooting guidance**

- Trade data is published with an inherent time lag
- Railway may lose refreshed files on restart without persistent storage
- AI report generation requires provider API keys unless Demo Mode is used

`[补充]` 如果你们有培训材料、交接文档、操作手册、录屏或 slide deck，建议明确列在这里。

`[核实]` 如果老师要求“external resources contact information”，这一节目前还偏弱，建议补上相关平台或维护联系人。

## 8. Group Photo

`[补充]` 这一节目前缺失。提交前需要加入：

- 一张全组合照
- 每位成员的姓名标注
- 最好加一句简短角色说明（如 data pipeline, modeling, frontend, deployment）

## Final Editing Suggestions

`[简化]` 你这版原稿最大的问题不是内容不够，而是**同一信息反复出现**。最常重复的点有：

- Census / Statistics Canada 的两个月数据滞后
- Railway / Vercel 的部署说明
- 模型是 DID + Triple-DID + CES/Armington
- “manual process reduced from 40+ hours” 这类价值表述

`[简化]` 这些信息保留一次就够，建议：

1. 数据滞后主要放在 Section 2 或 Section 4 一次讲清楚。
2. 部署和环境变量细节主要放在 Section 7，不要在前文反复写。
3. 模型结构主要放在 Deliverables 或 Outcomes，不要在多个章节重复展开。
4. 所有“客户价值”表述尽量合并成更短、更有力的句子。

`[简化]` 如果你愿意进一步压缩，我建议把全文目标控制在 **2500-3200 词** 左右；你现在原文大约 **4700+ 词**，确实偏长。
