---
icon: ant-design:field-time-outlined
title: TBM 的实现
order: 4
category:
  - TBM
tag:
  - TBM
---
> 本章涉及代码：com/dyx/simpledb/backend/tbm/*

## 基本定义

- **TableManager** 的核心作用是处理数据库表的管理，包括创建、查询、更新、删除等操作。所有操作的结果直接以字节数组的形式返回，例如错误信息或执行结果。
- **TableManager** 的方法实现主要依赖于底层的版本管理器（VM）和数据管理器（DM），从而实现对数据库的各种操作。
- 在创建新表时，系统采用了**头插法**，即每次新表创建都会插入到链表的头部。这意味着新创建的表会成为表链表的第一个元素。由于头插法的特性，每次表的创建都会导致链表头部的变化，因此需要更新 **Booter** 文件，以记录最新的表链表头部的 UID。
- 在 **TableManager** 对象初始化时，系统会自动加载并初始化表的信息。

```java
public interface TableManager {
    BeginRes begin(Begin begin);
    byte[] commit(long xid) throws Exception;
    byte[] abort(long xid);

    byte[] show(long xid);
    byte[] create(long xid, Create create) throws Exception;

    byte[] insert(long xid, Insert insert) throws Exception;
    byte[] read(long xid, Select select) throws Exception;
    byte[] update(long xid, Update update) throws Exception;
    byte[] delete(long xid, Delete delete) throws Exception;
}
```

```java
public class TableManagerImpl implements TableManager {
    VersionManager vm; // 版本管理器，用于处理事务和数据的版本控制
    DataManager dm; // 数据管理器，负责数据的存储和读取操作
    private Booter booter; // 启动信息管理器，用于管理数据库的启动信息
    private Map<String, Table> tableCache; // 表缓存，存储已加载的表对象
    private Map<Long, List<Table>> xidTableCache; // 事务表缓存，记录每个事务修改过的表
    private Lock lock; // 锁，用于确保多线程环境下的操作安全
    
    TableManagerImpl(VersionManager vm, DataManager dm, Booter booter) {
        this.vm = vm;
        this.dm = dm;
        this.booter = booter;
        this.tableCache = new HashMap<>();
        this.xidTableCache = new HashMap<>();
        this.lock = new ReentrantLock();
        loadTables();
    }
}
```

### `loadTables()`

```java
/**
 * 加载数据库中的所有表到缓存中。
 */
private void loadTables() {
    // 获取第一个表的UID
    long uid = firstTableUid();
    // 循环加载所有表，直到没有下一个表
    while (uid != 0) {
        // 通过UID加载表对象
        Table tb = Table.loadTable(this, uid);
        // 获取下一个表的UID
        uid = tb.nextUid;
        // 将表对象加入缓存
        tableCache.put(tb.name, tb);
    }
}

/**
 * 获取第一个表的UID，来自Booter文件。
 * @return 第一个表的UID
 */
private long firstTableUid() {
    byte[] raw = booter.load(); // 加载Booter文件内容
    return Parser.parseLong(raw); // 解析出第一个表的UID
}
```

### `create()`

在 `create()` 方法中，**TableManager** 负责创建新表，并在表链表中维护最新的表结构。此方法的实现强调了线程安全性，同时确保新表的正确创建和缓存更新。

```java
@Override
public byte[] create(long xid, Create create) throws Exception {
    lock.lock(); // 加锁以防止并发问题
    try {
        // 检查是否已有同名表存在，避免重复创建
        if (tableCache.containsKey(create.tableName)) {
            throw Error.DuplicatedTableException;
        }
        // 创建新的表对象
        Table table = Table.createTable(this, firstTableUid(), xid, create);
        // 更新表链表的头部UID
        updateFirstTableUid(table.uid);
        // 将新创建的表放入缓存
        tableCache.put(create.tableName, table);
        // 如果事务缓存中没有此事务ID的条目，则创建一个新的条目
        if (!xidTableCache.containsKey(xid)) {
            xidTableCache.put(xid, new ArrayList<>());
        }
        // 将新创建的表添加到当前事务的表列表中
        xidTableCache.get(xid).add(table);
        // 返回创建表的成功消息
        return ("create " + create.tableName).getBytes();
    } finally {
        lock.unlock(); // 解锁以允许其他操作
    }
}
```

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb9](https://shinya.click/projects/mydb/mydb9)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::