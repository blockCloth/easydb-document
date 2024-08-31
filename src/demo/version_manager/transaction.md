---
icon: tdesign:undertake-transaction
title: 事务的隔离级别
order: 2
category:
  - VM
tag:
  - transaction
  - isolation
---
> 本章涉及代码：com/dyx/simpledb/backend/vm/Visibility、IsolationLevel、Transaction.java

## 事务隔离级别实现

在数据库系统中，不同的事务隔离级别提供了不同的并发控制和数据一致性保障。EasyDB 实现了四种常见的事务隔离级别：**读未提交（Read Uncommitted）**、**读提交（Read Committed）**、**可重复读（Repeatable Read）和串行化（Serializable）**。每种隔离级别都有其特定的可见性规则和应用场景。

### 读未提交

<strong>读未提交（Read Uncommitted）</strong>是最低级别的事务隔离级别。在这种隔离级别下，事务可以读取其他事务未提交的数据。这意味着可能会读取到未提交的数据变化，这种情况被称为“脏读”。在 EasyDB 中，读未提交级别实现最为简单，所有数据版本对事务都是可见的，包括那些尚未提交的数据版本，也对数据进行了一个简单的过滤，已删除的数据时不可见的

```java
private static boolean readUnCommitted(TransactionManager tm, Transaction t, Entry e) {
    long xmax = e.getXmax();
    // 检查数据是否被删除，如果未删除则可见
    return xmax == 0;
}
```

### 读提交
<strong>读提交（Read Committed）</strong>是一种较为常用的事务隔离级别，保证事务只能读取已经提交的数据版本。它可以避免读取未提交的数据，从而防止脏读。在 EasyDB 中，读提交通过维护两个关键字段来实现：**XMIN和XMAX**。其中，**XMIN**记录了创建版本的事务编号，**XMAX**记录了删除版本的事务编号。

#### 读提交的事务可见性逻辑

1. **XMIN == Ti and XMAX == NULL**：
   - 这个条件表示，当前版本的数据是由当前事务 Ti 创建的，并且尚未被删除。因此，这个版本对当前事务 Ti 是可见的。
2. **XMIN is committed and (XMAX == NULL or (XMAX != Ti and XMAX is not committed))**：
   - **XMIN is committed** 表示，版本是由一个已提交的事务创建的，因此对其他事务是可见的。
   - **XMAX == NULL** 表示该版本尚未被删除，因此仍然是可见的。
   - **(XMAX != Ti and XMAX is not committed)** 这一部分是说，如果这个版本被其他事务删除了，但该删除操作尚未提交，这意味着删除操作对当前事务不可见，所以当前版本仍然是可见的
:::note
(XMIN == Ti and                             // 由Ti创建且</br>
XMAX == NULL                            // 还未被删除</br>
)</br>
or                                          // 或</br>
(XMIN is commited and                       // 由一个已提交的事务创建且</br>
(XMAX == NULL or                        // 尚未删除或</br>
(XMAX != Ti and XMAX is not commited)   // 由一个未提交的事务删除</br>
))</br>
:::

```java
private static boolean readCommitted(TransactionManager tm, Transaction t, Entry e) {
    long xid = t.xid;
    long xmin = e.getXmin();
    long xmax = e.getXmax();

    // 当前事务创建且未删除的数据版本是可见的
    if (xmin == xid && xmax == 0) return true;

    // 由已提交事务创建的版本是可见的
    if (tm.isCommitted(xmin)) {
        // 如果记录未被删除，或删除版本未提交，则该版本可见
        if (xmax == 0 || (xmax != xid && !tm.isCommitted(xmax))) {
            return true;
        }
    }
    return false;
}
```

### 可重复读

**可重复读（Repeatable Read）**解决了读提交级别下的不可重复读问题。在该级别下，事务在其生命周期内多次读取同一数据项时，读取到的结果是一致的，即使其他事务并发地修改了数据。EasyDB 通过事务的快照机制实现这一点，确保事务只能读取到事务开始时已经提交的数据版本。

#### 可重复读的事务可见性逻辑

1. **XMIN == Ti and XMAX == NULL**：
   - 这个条件表示，当前版本的数据是由当前事务 Ti 创建的，并且尚未被删除。因此，这个版本对当前事务 Ti 是可见的。
2. **XMIN is committed and XMIN < Ti and XMIN is not in SP(Ti)**：
   - **XMIN is committed** 表示该版本是由一个已提交的事务创建的。
   - **XMIN < Ti** 表示该版本是在当前事务 Ti 开始之前创建的。
   - **XMIN is not in SP(Ti)** 表示该版本的创建事务不在当前事务 Ti 开始时的活跃事务集合中，因此该版本对当前事务是可见的。
3. **XMAX == NULL or (XMAX != Ti and (XMAX is not committed or XMAX > Ti or XMAX is in SP(Ti)))**：
   - **XMAX == NULL** 表示该版本尚未被删除。
   - **XMAX != Ti** 表示删除该版本的事务不是当前事务 Ti。
   - **XMAX is not committed** 表示删除操作尚未提交。
   - **XMAX > Ti** 表示删除操作发生在当前事务 Ti 之后。
   - **XMAX is in SP(Ti)** 表示删除操作发生在当前事务 Ti 开始之前但未提交。
     :::notes
     // 可重复读隔离级别下的事务可见性逻辑
     (XMIN == Ti and                 // 由当前事务 Ti 创建且
      (XMAX == NULL))                // 尚未被删除
     or                              // 或
     (XMIN is committed and           // 由一个已提交的事务创建且
      XMIN < Ti and                  // 该事务在当前事务 Ti 之前提交
      XMIN is not in SP(Ti) and      // 该事务不在当前事务 Ti 的快照中
      (XMAX == NULL or               // 尚未删除或
     (XMAX != Ti and               // 删除操作由其他事务执行但不是当前事务 Ti
     (XMAX is not committed or    // 删除操作尚未提交或
      XMAX > Ti or                // 删除操作在当前事务 Ti 之后执行或
      XMAX is in SP(Ti)))))       // 删除操作在当前事务 Ti 开始时未提交
     :::

```java
private static boolean repeatableRead(TransactionManager tm, Transaction t, Entry e) {
    long xid = t.xid;
    long xmin = e.getXmin();
    long xmax = e.getXmax();

    // 当前事务创建且未删除的数据版本是可见的
    if (xmin == xid && xmax == 0) return true;

    // 已提交事务创建的版本，且不在当前事务快照中的版本是可见的
    if (tm.isCommitted(xmin) && xmin < xid && !t.isInSnapshot(xmin)) {
        // 如果记录未被删除，或删除版本未提交或不在快照中，则该版本可见
        if (xmax == 0 || (xmax != xid && (!tm.isCommitted(xmax) || xmax > xid || t.isInSnapshot(xmax)))) {
            return true;
        }
    }
    return false;
}
```

### 串行化

**串行化（Serializable）**是最高级别的事务隔离，确保事务像是按顺序一个接一个执行的，从而避免了所有的并发问题。在这个级别下，事务之间不会相互影响，彻底解决了脏读、不可重复读和幻读问题。
 在 EasyDB 中，串行化通过强制事务之间的完全隔离来实现。在串行化隔离级别下，每个事务只能看到它开始之前已经提交的版本，以及它自己创建或修改的版本。此逻辑与可重复读的一致性逻辑相似。  

```java
private static boolean serializable(TransactionManager tm, Transaction t, Entry e) {
    long xid = t.xid;
    long xmin = e.getXmin();
    long xmax = e.getXmax();

    // 当前事务创建且尚未删除的版本是可见的
    if (xmin == xid && xmax == 0) return true;

    // 已提交事务创建且在当前事务之前提交的版本是可见的
    if (tm.isCommitted(xmin) && xmin < xid && !t.isInSnapshot(xmin)) {
        // 如果记录未被删除，或删除版本未提交或不在快照中，则该版本可见
        if (xmax == 0 || (xmax != xid && (!tm.isCommitted(xmax) || xmax > xid || t.isInSnapshot(xmax)))) {
            return true;
        }
    }
    return false;
}
```

## 事务结构

由于可重复读和串行化隔离级别的特殊要求，EasyDB 为事务提供了一个结构，用来保存事务开始时的快照数据。

```java
public class Transaction {
    public long xid; // 事务的ID
    public int level; // 事务的隔离级别
    public Map<Long, Boolean> snapshot; // 事务的快照，用于存储活跃事务的ID
    public Exception err; // 事务执行过程中的错误
    public boolean autoAborted; // 标志事务是否自动中止
    public long startTime; // 添加开始时间属性

    public static Transaction newTransaction(long xid, IsolationLevel isolationLevel, Map<Long, Transaction> active) {
        Transaction t = new Transaction();
        t.xid = xid;
        t.isolationLevel = isolationLevel;
        t.startTime = System.currentTimeMillis();
        // 当隔离级别等于可重复读和串行化时需要创建快照
        if(isolationLevel != IsolationLevel.READ_COMMITTED && isolationLevel != IsolationLevel.READ_UNCOMMITTED) {
            t.snapshot = new HashMap<>();
            for(Long x : active.keySet()) {
                t.snapshot.put(x, true);
            }
        }
        return t;
    }

    public boolean isInSnapshot(long xid) {
        if(xid == TransactionManagerImpl.SUPER_XID) {
            return false;
        }
        return snapshot.containsKey(xid);
    }
}

```

## 版本跳跃问题

版本跳跃问题是指在多版本并发控制（MVCC）中，一个事务在修改数据项时可能会跳过中间版本，直接修改最新版本，这可能导致逻辑上的错误。具体来说，版本跳跃会在以下情况下发生：

1. 一个事务（Ti）试图修改数据项X，而在Ti开始之前，另一个事务（Tj）已经对X进行了修改，但由于隔离级别的原因，Ti看不到Tj的修改，这种情况下Ti直接修改X，可能会导致数据不一致。
2. 如果Ti在试图修改数据项X时，Tj的修改对Ti不可见，这意味着Ti并不真正了解X的最新状态。如果允许Ti继续修改X，可能会跳过Tj的修改，从而导致逻辑错误。

版本跳跃问题与事务的隔离级别密切相关。在**读未提交**隔离级别下，版本跳跃是被允许的，因为该隔离级别不保证数据的可见性和一致性。然而，在**读提交**及以上的隔离级别，版本跳跃是不被允许的，系统必须进行检查并在必要时强制事务回滚。

### 版本跳跃的检查

为了避免版本跳跃，系统需要在Ti修改X之前检查是否存在版本跳跃的风险。具体来说：

- 如果**Tj的事务ID（XID）大于Ti的事务ID**，这意味着Tj在时间上晚于Ti开始，因此Ti应该回滚，避免版本跳跃。
- 如果**Tj在Ti的快照集合（SP(Ti)）中**，则Tj在Ti开始之前已经提交，但Ti在开始之前并不能看到Tj的修改，因此Ti也应该回滚。

代码示例：

```java
public static boolean isVersionSkip(TransactionManager tm, Transaction t, Entry e) {
    long xmax = e.getXmax();

    // 读未提交隔离级别下不考虑版本跳跃问题
    if (t.level == IsolationLevel.READ_UNCOMMITTED) {
        return false;
    } 
        // 读提交及以上隔离级别需要检查版本跳跃
    else if (t.level == IsolationLevel.READ_COMMITTED || t.level == IsolationLevel.REPEATABLE_READ || t.level == IsolationLevel.SERIALIZABLE) {
        return tm.isCommitted(xmax) && (xmax > t.xid || t.isInSnapshot(xmax));
    } 
    else {
        throw new IllegalArgumentException("Unknown isolation level: " + t.isolationLevel);
    }
}
```

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb6](https://shinya.click/projects/mydb/mydb6)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::