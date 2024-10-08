---
home: true
icon: home
title: 主页
heroImage: https://blockcloth.cn/codingblog/logo_transparent.png
bgImageStyle:
  background-attachment: fixed
heroText: EasyDB
tagline: 轻量级、高性能的自定义数据库解决方案
actions:
  - text: 项目体验
    icon: rocket
    link: http://db.blockcloth.cn/
    type: primary

  - text: 使用指南
    icon: lightbulb
    link: ./document/

  - text: 项目文档
    icon: book
    link: ./demo/

features:
  - title: 🛠️ 核心功能
    details: EasyDB 采用 MySQL、PostgreSQL 和 SQLite 的部分原理，并参考 MYDB 的设计，具备数据的可靠性、两阶段锁协议（2PL）实现的串行化调度、MVCC、多种事务隔离级别以及死锁处理和超时检测等功能，提供了轻量级且高效的数据库解决方案。

  - title: 🌐 WebSocket 实时通信
    details: EasyDB 使用 WebSocket 实现实时通信功能，每个用户拥有独立的数据区，以确保数据安全性和互不干扰。项目还通过线程管理和自动销毁机制优化了多页面访问体验，提升了用户操作的流畅度。

  - title: 🔍 高效 SQL 解析
    details: 引入 JSQLParser 库，EasyDB 能够将 SQL 语句解析为抽象语法树 (AST)，极大简化了 SQL 查询的分析与修改。开发者无需手动解析 SQL 字符串，即可高效处理复杂的 SQL 操作。

  - title: ⚙️ 数据管理与优化
    details: EasyDB 支持全表扫描与索引处理，即使在字段未建立索引的情况下，依然可以进行条件筛选操作。同时，系统内置丰富的条件约束与主键索引功能，支持唯一性、非空性、自增性等多种约束条件。

  - title: 🚦 事务控制与死锁检测
    details: EasyDB 提供完善的事务隔离机制，支持从读未提交到串行化的多种隔离级别。通过全局锁实现事务的串行化处理，并通过超时检测功能防止系统资源长期占用，增强了系统的可靠性。

  - title: 📝 日志管理与故障恢复
    details: EasyDB 内置了强大的日志管理机制，确保所有数据库操作的可追溯性。通过日志记录实现数据一致性保障，支持故障恢复功能，增强系统的容错能力和数据的安全性。

# footer: |
#   <a href="http://db.blockcloth.cn/" target="_blank">EasyDB</a> | MIT 协议, 版权所有 | <a href="https://beian.miit.gov.cn" target="_blank">赣ICP备2024025197号</a>

---
## 🎉 欢迎使用 EasyDB

**EasyDB** 是一个轻量级、高性能的 Java 实现数据库，灵感来源于 MySQL、PostgreSQL 和 SQLite。它旨在为开发者提供一个便捷且功能丰富的数据库解决方案，特别适用于那些需要灵活控制数据管理和优化数据库操作的应用场景。

### 🚀 核心功能与主要特性

**轻量化构建**  
EasyDB 基于 Spring Boot 框架构建，简化了启动和配置流程，使其可以轻松集成到现有项目中。通过简洁的配置，开发者可以快速启动并部署 EasyDB，极大地提升开发效率。

**高效的数据管理**  
EasyDB 支持 B+ 树索引结构，提供快速的数据检索与管理能力，即使在大数据量环境下也能保持高效的查询性能。系统内置了丰富的条件约束与主键索引功能，支持唯一性、非空性、自增性等多种约束条件。

**并发与事务控制**  
通过 MVCC（多版本并发控制）和两阶段锁协议（2PL），EasyDB 优化了并发操作，支持多种事务隔离级别，如读未提交、读提交、可重复读和串行化。这些功能确保了高并发环境下的数据一致性与系统性能。

**日志与恢复机制**  
内置的日志管理功能确保了所有数据库操作的可追溯性。通过详细的日志记录，EasyDB 实现了数据一致性保障，并支持故障恢复，增强了系统的容错能力和数据的安全性。
