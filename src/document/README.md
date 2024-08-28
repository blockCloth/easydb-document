---
title: EasyDB使用文档
icon: file
order: -1
headerDepth: 1

footer: 使用 <a href="http://db.blockcloth.cn/" target="_blank">EasyDB</a> | MIT 协议, 版权所有
---

本使用文档旨在帮助用户快速上手使用本数据库系统。文档内容主要围绕常见的 SQL 语句和数据库操作，适合初学者和希望快速掌握数据库基本功能的用户。

## 核心功能指南

### **表的创建与管理**

- 说明如何在数据库中创建、查看和删除表，介绍表的基本结构和数据类型。
- 支持的数据类型：**int、long、float、double、varchar、datetime**

示例：
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR NOT NULL,
    email VARCHAR UNIQUE
); // 创建表的语句
SHOW TABLES; // 查看数据库拥有哪些表
SHOW USER; // 查看表结构
DROP TABLE users; // 删除表
```

### **数据操作（CRUD）**

- 介绍增（INSERT）、查（SELECT）、改（UPDATE）、删（DELETE）等基本数据操作的 SQL 语句。

示例：
```sql
INSERT INTO users (username, email) VALUES ('Alice', 'alice@example.com'); // 指定插入
INSERT INTO users VALUES (10,'Alice', 'alice@example.com'); //全部插入

SELECT * FROM users; // 查询所有字段
SELECT name,email FROM users; //指定查找

UPDATE users SET email = 'alice@newdomain.com' WHERE username = 'Alice'; // 修改用户数据

DELETE FROM users WHERE username = 'Alice'; // 删除用户数据
```

### **事务管理**

- 介绍事务的基本概念及其在数据库中的应用，说明如何使用事务控制命令。

示例：
```sql
BEGIN; // 开启默认事务，读已提交
BEGIN ISOLATION LEVEL <ISOLATION_LEVEL>; 开启指定事务的隔离级别
ISOLATION_LEVEL：
- READ UNCOMMITTED: 读未提交
- READ COMMITTED: 读已提交
- REPEATABLE READ: 可重复读
- SERIALIZABLE: 串行化

COMMIT; //提交事务
ABORT; //回滚事务
```
### **注意事项**

- 进行数据库操作之间必须输入`init`命令进行初始化
- 通过本使用文档，用户可以快速掌握数据库的基础操作，并有效地进行数据管理和查询。
- 体验地址：[http://db.blockcloth.cn/](http://db.blockcloth.cn/)
- 项目地址：[https://github.com/blockCloth/EasyDB](https://github.com/blockCloth/EasyDB)
