---
title: EasyDB
index: false
icon: icon-park-outline:database-sync
category:
  - 使用指南
---

**项目地址：**

1. **EasyDB：**[**https://github.com/blockCloth/EasyDB**](https://github.com/blockCloth/EasyDB)
2. **MYDB：**[**https://github.com/CN-GuoZiyang/MYDB**](https://github.com/CN-GuoZiyang/MYDB)
3. **React Teriminal：**[**https://github.com/Tomotoes/react-terminal**](https://github.com/Tomotoes/react-terminal)
4. **知识星球：**[**https://www.javabetter.cn/zhishixingqiu/**](https://www.javabetter.cn/zhishixingqiu/)
## 前言
在一次偶然的机会，通过[二哥星球](https://www.javabetter.cn/zhishixingqiu/)得知了 [MYDB ](https://github.com/CN-GuoZiyang/MYDB)项目。该项目凭借其独特的设计理念和简洁的实现方式，引起了我的极大兴趣。作为一名热衷于数据库技术的开发者，我不仅深刻学习了 MYDB 的核心功能，还萌生了对其进行二次开发的想法。
在深入研究 MYDB 项目的过程中，我发现了该项目的许多亮点，同时也注意到一些可以进一步优化和扩展的地方。因此，我决定在保留其原有设计优势的基础上，增加一些实用的新功能，以满足更多应用场景的需求。通过这些改进，我希望能够让 EasyDB 项目在更多场合下展现出其强大的功能性和灵活性。
## 整体结构
EasyDB 的架构分为前端和后端两个部分，各自承担不同的职责：
### 前端
前端的职责相对简单，主要任务是读取用户的输入，并将其发送到后端进行处理。处理完成后，前端接收并显示执行结果，等待用户的下一次输入。EasyDB 的前端采用了基于 React Terminal 项目二次开发的解决方案以及基于Socket交互，提供了一个直观的命令行界面，用户可以方便地与数据库进行交互。
### 后端
后端则承担了更多的任务，负责解析并执行用户提交的 SQL 语句。如果输入的 SQL 语句合法，后端会尝试执行并返回结果；如果不合法，则会提示用户 SQL 语法错误。在 EasyDB 中，后端支持两种启动方式：

1. **基于 Socket 交互的启动**：提供轻量级、低延迟的网络交互。
2. **基于 SpringBoot + React 的启动**：集成了现代 Web 框架，为前后端提供更强大的支持和灵活性。
## EasyDB 模块依赖与职责概述
EasyDB 的模块设计遵循一定的依赖关系，通过拓扑排序可以清晰地看到各个模块的实现顺序。在本教程中，模块的实现顺序为：**Transaction Manager (TM) -> Data Manager (DM) -> Version Manager (VM) -> Index Manager (IM) -> Table Manager (TBM)**。  
![image.png](https://blockcloth.cn/codingblog/mydb0.jpg)
### 模块职责

1. **Transaction Manager (TM)**：
- **职责**：TM 负责管理事务的状态，通过维护 `XID` 文件来跟踪每个事务的状态。它提供接口，供其他模块查询特定事务的状态，从而确保事务的一致性和数据的完整性。
2. **Data Manager (DM)**：
- **职责**：DM 直接管理数据库的 `DB` 文件和日志文件，其主要任务包括：
   - **分页管理**：管理 `DB` 文件并对其进行分页缓存，以提高数据访问的效率。
   - **日志管理**：管理日志文件，确保在发生错误时，系统能够根据日志恢复数据，保证数据的一致性。
   - **数据抽象**：将 `DB` 文件抽象为 `DataItem`，供上层模块使用，同时提供相应的缓存机制。
3. **Version Manager (VM)**：
- **职责**：VM 通过实现两阶段锁协议，确保调度序列的可串行化，并通过多版本并发控制（MVCC）消除读写阻塞。VM 支持两种事务隔离级别，以满足不同的并发需求。
4. **Index Manager (IM)**：
- **职责**：IM 负责实现基于 B+ 树的数据索引，提升数据检索的效率。目前，`where` 子句仅支持已建立索引的字段。
5. **Table Manager (TBM)**：
- **职责**：TBM 负责管理数据库中的表和字段信息。它还负责解析 SQL 语句，并根据解析结果执行相应的表操作，确保数据的正确性和结构的一致性。
## 开发环境与运行示例
### 开发环境

1. `JDK >= 1.8`
2. `Maven >= 3.5`
### 运行示例
#### SpringBoot
如果你希望在 Spring Boot 环境下运行 EasyDB，下面是操作步骤：  

1. **克隆项目并进入项目目录**：
```bash
git clone https://github.com/blockCloth/EasyDB.git
cd EasyDB
```

2. **配置数据库路径**： 在 `application-dev.yml` 文件中配置数据库路径，并且在`application.yml`中切换配置文件，例如：
```yaml
custom:
  db:
    path: D:/JavaCount/mydb/windows/
```

3. **启动 Spring Boot 应用**： 直接在 IDE 中运行 Spring Boot 应用：
```java
@EnableScheduling
@SpringBootApplication
public class SimpleSqlDatabaseApplication {

    public static void main(String[] args) {
        SpringApplication.run(SimpleSqlDatabaseApplication.class, args);
    }
}
```

4. **访问数据库服务**： Spring Boot 应用启动后，数据库服务将会运行在指定的端口（默认为 `8081`）。你可以通过发送 HTTP 请求或使用 REST 客户端来访问数据库服务。
5. **通过前端客户端进行交互**： 你可以在浏览器中访问：
```
http://localhost:8081/index.html
```
在页面中你可以输入 SQL 语句，前端会将其发送到后端 Spring Boot 服务进行处理，并显示执行结果。
#### 使用maven编译项目

1. 首先执行一下命令编译源码：
```shell
mvn compile
```

2.  编译完成后，使用以下命令创建数据库。此命令会在指定路径下创建一个新的数据库实例：  
```shell
mvn exec:java '-Dexec.mainClass="com.dyx.simpledb.backend.Launcher"' '-Dexec.args="-create D:\JavaCount\mydb\windows"'
```

3.  数据库创建后，使用以下命令启动数据库服务。该服务会在本地机器的 `9999` 端口运行：  
```shell
mvn exec:java '-Dexec.mainClass="com.dyx.simpledb.backend.Launcher"' '-Dexec.args="-open D:\JavaCount\mydb\windows\test\test"'
```

4.  打开一个新的终端窗口，执行以下命令启动数据库客户端。这将启动一个交互式命令行界面，用户可以在此输入类 SQL 语法，并将语句发送到数据库服务进行处理，随后返回执行结果：  
```shell
mvn exec:java '-Dexec.mainClass="com.dyx.simpledb.client.Launcher"'
```
执行示例：  
![socket.png](https://blockcloth.cn/codingblog/socket.png)
#### 通过 IntelliJ IDEA 配置和启动 EasyDB 项目
在通过 IntelliJ IDEA 启动 EasyDB 项目时，你可以利用启动配置来自动化数据库的创建和启动过程。以下步骤将指导你如何配置 IntelliJ IDEA，使其在启动 `com.dyx.simpledb.backend.Launcher` 类时，先创建数据库并打开它，随后只需启动 `com.dyx.simpledb.client.Launcher` 类即可进行交互。
##### 步骤一：配置 `com.dyx.simpledb.backend.Launcher` 启动项

1. **创建启动配置**：
   - 在 IntelliJ IDEA 中，打开 `Run --> Edit Configurations`。
   - 点击左上角的 `+` 按钮，选择 `Application` 以创建一个新的启动配置。
2. **配置数据库创建**：
   - 在 `Name` 字段中输入合适的名称，例如 `LauncherStart`。
   - 在 `Main class` 字段中，选择 `com.dyx.simpledb.backend.Launcher` 作为主类。
   - 在 `Program arguments` 字段中，输入以下内容以创建数据库：
```
-create D:/JavaCount/mydb/windows/mydb
```

   - 设置 `Working directory` 为项目的根目录，确保所有路径都能正确解析。
3. **配置数据库打开**：
   - 重复以上步骤，创建另一个启动配置。将 `Program arguments` 字段修改为：
```
-open D:/JavaCount/mydb/windows/mydb
```

4. **运行启动配置**：
   - 首先运行创建数据库的启动配置，等待数据库创建成功。
   - 然后运行打开数据库的启动配置，启动数据库服务。
##### 步骤二：启动 `com.dyx.simpledb.client.Launcher` 进行交互

1. **运行客户端**：
   - 运行 `com.dyx.simpledb.client.Launcher` 启动配置，启动客户端。
   - 客户端启动后，将进入交互式命令行，你可以在其中输入 SQL 语句，与数据库进行交互。  
![image.png](https://blockcloth.cn/codingblog/idea.png)


::: note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb0](https://shinya.click/projects/mydb/mydb0)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::
