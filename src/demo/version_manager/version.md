---
icon: fluent:slide-record-20-regular
title: 记录的版本
order: 1
category:
  - VM
tag:
  - version
---
> 本章涉及代码：com/dyx/simpledb/backend/vm/Entry.java

从这里开始，我们将深入探讨 Version Manager (VM) 的实现。VM 是 EasyDB 的事务和数据版本管理核心，类似于 Data Manager 是 EasyDB 的数据管理核心。VM 基于两段锁协议（2PL）实现了调度序列的可串行化，并通过多版本并发控制（MVCC）消除读写阻塞，同时支持多种事务隔离级别。

### 2PL 与 MVCC

#### 冲突与 2PL

在数据库中，多个事务可能会同时操作同一个数据项，这就可能导致冲突。我们暂时不讨论插入操作，只考虑更新操作（U）和读操作（R）。当以下三个条件同时满足时，两个操作之间就存在冲突：

1. 这两个操作是由不同的事务执行的；
2. 它们针对的是同一个数据项；
3. 其中至少有一个是更新操作。

这种情况下，冲突的顺序会影响最终的结果。举个简单的例子，假设有两个事务 `T1` 和 `T2`，它们同时对变量 `x` 进行操作，初始值为 0：

```
T1 开始
T2 开始
T1 读取 x（得到 0）
T2 读取 x（得到 0）
T1 更新 x（加 1，x 变为 1）
T2 更新 x（加 1，x 变为 1）
T1 提交
T2 提交
```

在这个场景中，最终 `x` 的值是 1，而不是我们期望的 2。这个问题的根源在于事务的执行顺序导致了冲突。为了解决这个问题，VM 采用了**两段锁协议**（Two-Phase Locking, 2PL）。
2PL 的基本思想是，当一个事务想要操作某个数据项时，它必须先获得这个数据项的锁。如果另一个事务已经持有了这个锁，当前事务就必须等待。例如：

- **场景 1**：假设 `T1` 对数据项 `x` 加了锁，并尝试更新它。这时，`T2` 也想读取或更新 `x`，但由于 `x` 已被 `T1` 锁定，`T2` 必须等待 `T1` 释放锁后才能继续操作。

这种机制确保了事务的顺序执行，避免了数据不一致的问题。然而，2PL 也会带来一个新的问题：**事务阻塞**。当多个事务同时争夺同一资源时，它们可能会相互等待，最终可能导致死锁。

#### MVCC

为了减少因 2PL 引起的事务阻塞，EasyDB 实现了**多版本并发控制**（Multi-Version Concurrency Control, MVCC）。在介绍 MVCC 之前，我们先明确两个概念：**记录**和**版本**。

- **记录**：在 EasyDB 中，每个记录代表数据的一项，类似于数据库表中的一行数据。
- **版本**：每当一个事务修改某条记录时，VM 会为这条记录创建一个新版本，而旧版本仍然保留，以供其他事务读取。

通过 MVCC，EasyDB 能够降低事务之间的阻塞概率。以下是一个具体的例子：

- **场景 2**：假设 `T1` 正在更新记录 `X`，创建了一个新的版本 `x3`。在 `T1` 提交之前，`T2` 也想读取 `X`。在没有 MVCC 的情况下，`T2` 会被阻塞，直到 `T1` 提交。但在 MVCC 的帮助下，`T2` 可以读取 `X` 的旧版本 `x2`，不需要等待 `T1` 完成。这意味着 `T2` 的执行结果相当于先于 `T1` 执行，从而避免了阻塞。

通过这种方式，MVCC 大大提高了系统的并发性能，减少了事务之间的等待时间。但要注意，如果 `X` 没有旧版本，那么 `T2` 还是必须等待 `T1` 释放锁。
为了保证数据的正确性，VM 层在与 DM 层交互时必须遵守以下两条规定：

1. **规定1**：正在进行的事务不会读取其他未提交事务产生的数据。（为了增强数据库体验，增加了读未提交隔离级别）
2. **规定2**：正在进行的事务不会修改其他未提交事务产生或修改的数据。

2PL 和 MVCC 都自然地满足了这两条规定，确保了数据的一致性和安全性。

### 记录的实现

在 EasyDB 中，**版本记录**是通过 `Entry` 类来管理的。每条记录会保存其创建和删除的事务信息，这些信息会被存储在 `Entry` 数据结构中，并通过特定的方式管理和访问。

#### Entry 格式数据

`Entry` 的格式如下：

> **[XMIN] [XMAX] [DATA]**

1. **XMIN**：创建该记录的事务编号。
2. **XMAX**：删除该记录的事务编号。
3. **DATA**：记录的实际数据。

#### Entry 结构

在 EasyDB 中，尽管理论上 MVCC 支持多版本控制，但在实际实现中，VM 层只保留每条记录的一个版本，更新操作由后续的表和字段管理（TBM）来处理。每条记录保存在一个 `DataItem` 中，`Entry` 结构中包含一个指向 `DataItem` 的引用。

```java
public class Entry {
    private static final int OF_XMIN = 0;     // XMIN 的偏移量
    private static final int OF_XMAX = OF_XMIN + 8;  // XMAX 的偏移量
    private static final int OF_DATA = OF_XMAX + 8;  // DATA 的偏移量

    private long uid;              // 唯一标识符
    private DataItem dataItem;     // 记录的数据项
    private VersionManager vm;     // 版本管理器

    // 加载一个 Entry 实例
    public static Entry loadEntry(VersionManager vm, long uid) throws Exception {
        DataItem di = ((VersionManagerImpl)vm).dm.read(uid);
        return newEntry(vm, di, uid);
    }

    // 移除一个 Entry 实例
    public void remove() {
        dataItem.release();
    }
}
```

### 日志格式操作

#### `wrapEntryRaw()`

这个方法用于生成日志格式的数据。当创建新版本时，事务 ID 会被作为 XMIN 存储，XMAX 预留为空，数据会附加在其后。

```java
public static byte[] wrapEntryRaw(long xid, byte[] data) {
    byte[] xmin = Parser.long2Byte(xid);  // 将事务 ID 转为 8 字节数组
    byte[] xmax = new byte[8];  // 预留 8 字节空间给 XMAX，初始为空
    return Bytes.concat(xmin, xmax, data);  // 合并为完整的 Entry 数据结构
}
```

#### `data()`

这个方法用于返回记录中的实际数据部分。由于 XMIN 和 XMAX 占据了前 16 字节，数据部分会被截取并返回。

```java
public byte[] data() {
    dataItem.rLock();  // 加锁，确保数据访问的安全性
    try {
        SubArray sa = dataItem.data();  // 获取存储的数据
        byte[] data = new byte[sa.end - sa.start - OF_DATA];  // 去除前 16 字节（XMIN 和 XMAX）
        System.arraycopy(sa.raw, sa.start + OF_DATA, data, 0, data.length);  // 复制数据部分
        return data;
    } finally {
        dataItem.rUnLock();  // 释放锁
    }
}
```

#### `setXmax()`

当记录被删除时，`XMAX` 会被设置为删除该记录的事务 ID。这是版本控制中的一个关键步骤，用于标记记录的删除状态。

```java
public void setXmax(long xid) {
    dataItem.before();  // 备份原始数据，以便支持回滚
    try {
        SubArray sa = dataItem.data();
        System.arraycopy(Parser.long2Byte(xid), 0, sa.raw, sa.start + OF_XMAX, 8);  // 设置 XMAX 为当前事务 ID
    } finally {
        dataItem.after(xid);  // 记录修改操作的日志
    }
}
```

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb6](https://shinya.click/projects/mydb/mydb6)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::