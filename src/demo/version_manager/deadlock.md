---
icon: icon-park:data-lock
title: 死锁及超时检测
order: 3
category:
  - VM
tag:
  - deadlock
  - time out
---
> 本章涉及代码：com/dyx/simpledb/backend/vm/LockTable.java

### 案例背景

在学习如何使用 `LockTable` 进行锁管理、死锁检测与解决之前，先了解一下死锁是如何发生的。假设我们有三个事务 T1、T2 和 T3，它们分别要访问两个资源 R1 和 R2。事务的执行顺序如下：

1. **T1 锁定 R1**：然后尝试锁定 R2。
2. **T2 锁定 R2**：然后尝试锁定 R1。
3. **T3 尝试锁定 R1**。

这种情况下，T1 和 T2 之间会产生死锁，而 T3 将会被阻塞在等待 R1 上。

#### 执行过程

1. **T1 锁定 R1**：
   - T1 请求锁定资源 R1。
   - 因为 R1 未被占用，所以 `LockTable` 将 R1 锁定给 T1。
   - T1 继续执行，准备请求锁定 R2。
1. **T2 锁定 R2**：
   - T2 请求锁定资源 R2。
   - 因为 R2 未被占用，所以 `LockTable` 将 R2 锁定给 T2。
   - T2 继续执行，准备请求锁定 R1。
1. **T1 请求锁定 R2**：
   - T1 请求锁定 R2。
   - 由于 R2 已被 T2 锁定，T1 被加入到 R2 的等待队列中。
1. **T2 请求锁定 R1**：
   - T2 请求锁定 R1。
   - 由于 R1 已被 T1 锁定，T2 被加入到 R1 的等待队列中。
   - 现在形成了 T1 → R2 → T2 → R1 → T1 的循环等待，导致死锁。
1. **T3 尝试锁定 R1**：
   - T3 请求锁定 R1。
   - 由于 R1 已被 T1 锁定且 T2 在等待 R1，T3 被加入到 R1 的等待队列中。

## LockTable 详解与实现教程

在多事务并发的数据库系统中，锁管理是至关重要的一部分。本文将详细介绍如何通过 `LockTable` 类实现锁管理、死锁检测与解决，以及如何通过路径缓存优化死锁检测。

#### LockTable 类的概述

`LockTable` 是一个用于管理事务锁的类，旨在解决多事务并发操作时的资源竞争问题。它通过维护一系列数据结构来管理事务对资源的请求、检测死锁、处理超时等待，并在必要时回滚事务。

#### 数据结构与字段介绍

`LockTable` 主要使用了以下数据结构：

- **x2u**：`Map<Long, List<Long>>`，存储每个事务已获得的资源列表（即每个事务当前持有的资源）。
- **u2x**：`Map<Long, Long>`，存储每个资源被哪个事务持有。
- **wait**：`Map<Long, List<Long>>`，存储等待某个资源的事务队列。
- **waitLock**：`Map<Long, Lock>`，存储正在等待资源的事务的锁。
- **waitU**：`Map<Long, Long>`，存储每个事务正在等待的资源ID。
- **lock**：`Lock`，全局锁，用于保证 `LockTable` 的线程安全。
- **waitStartTime**：`Map<Long, Long>`，记录每个事务进入等待状态的时间。
- **xidStamp**：`Map<Long, Integer>`，用于死锁检测中的标记
- **pathCache**：`Map<Long, Boolean>`，路径缓存，用于优化死锁检测时的DFS。

### 锁请求与等待管理

当一个事务请求获取某个资源时，`LockTable` 首先会检查该资源是否已被其他事务持有。如果没有被持有，资源将直接分配给请求的事务。如果资源已被占用，事务将进入等待状态，并存储在相应的等待队列中。

```java
public Lock add(long xid, long uid) throws Exception {
    lock.lock();
    try {
        if (isInList(x2u, xid, uid)) {
            return null; // 已拥有资源
        }
        if (!u2x.containsKey(uid)) { // 资源未被占用
            u2x.put(uid, xid);
            putIntoList(x2u, xid, uid);
            return null;
        }
        waitU.put(xid, uid); // 资源被占用，进入等待
        putIntoList(wait, uid, xid);
        waitStartTime.put(xid, System.currentTimeMillis());

        // 死锁检测
        if (hasDeadLock()) {
            waitU.remove(xid);
            removeFromList(wait, uid, xid);
            throw Error.DeadlockException;
        }

        Lock l = new ReentrantLock();
        l.lock();
        waitLock.put(xid, l);
        return l;

    } finally {
        lock.unlock();
    }
}
```

### 死锁检测与路径缓存优化

为了避免死锁，`LockTable` 实现了基于深度优先搜索（DFS）的死锁检测机制。通过遍历事务依赖图，系统可以检测到是否存在循环依赖，从而识别死锁。

#### 死锁检测实现

```java
private boolean hasDeadLock() {
    xidStamp = new HashMap<>();
    pathCache = new HashMap<>();
    stamp = 1;
    for (long xid : x2u.keySet()) {
        if (xidStamp.getOrDefault(xid, 0) > 0) continue;
        stamp++;
        if (dfs(xid)) return true;
    }
    return false;
}

private boolean dfs(long xid) {
    // 如果路径缓存中已经有结果，直接返回缓存的值
    if (pathCache.containsKey(xid)) {
        return pathCache.get(xid);
    }

    Integer stp = xidStamp.get(xid);
    if (stp != null && stp == stamp) {
        pathCache.put(xid, true);  // 更新路径缓存
        return true;
    }
    if (stp != null && stp < stamp) {
        pathCache.put(xid, false);  // 更新路径缓存
        return false;
    }
    xidStamp.put(xid, stamp);

    Long uid = waitU.get(xid);
    if (uid == null) {
        pathCache.put(xid, false);  // 更新路径缓存
        return false;
    }
    Long x = u2x.get(uid);
    boolean hasCycle = x != null && dfs(x);
    pathCache.put(xid, hasCycle);  // 更新路径缓存
    return hasCycle;
}
```

#### 路径缓存优化

在死锁检测过程中，DFS 可能会反复检查相同的事务路径。通过引入 `pathCache` 路径缓存，可以显著减少重复计算的开销，从而提高死锁检测的效率。

- **路径缓存**：记录每个事务的检测结果。如果在 DFS 中已经检测到某个事务的路径不形成死锁，则下次再遇到该路径时直接返回缓存结果，而无需重新计算。

### 超时检测与事务回滚

在某些情况下，事务可能会由于等待时间过长而被回滚。`LockTable` 通过后台线程定期检查每个事务的等待时间，并在超时时执行回滚操作。
超时检测与回滚机制的基本思想是：

- 每个事务在获取资源时，如果资源被其他事务占用，则需要等待。
- 为了避免长时间等待导致系统资源被锁住，我们为每个等待的事务设置一个超时时间（30S）。
- 当检测到事务等待超时后，系统将回滚这个事务，并释放它占用的所有资源，从而避免死锁或资源饥饿。

#### 超时检测线程

启动一个后台线程，定期检查每个事务的等待时间。如果超时，则执行回滚操作。

```java
private void startTimeoutDeadlockChecker() {
    new Thread(() -> {
        while (true) {
            try {
                Thread.sleep(CHECK_INTERVAL_MS); // 每秒检测一次
                checkForTimeouts(TIMEOUT_THRESHOLD_MS); // TIMEOUT_THRESHOLD_MS设置时间为30s
            } catch (InterruptedException e) {
                throw new RuntimeException(e);
            }
        }
    }).start();
}
```

#### 检查超时并回滚

`checkForTimeouts` 方法负责检查是否有事务等待超时，并触发回滚。

```java
public void checkForTimeouts(long timeout) {
    lock.lock();
    try {
        long currentTime = System.currentTimeMillis();
        Iterator<Map.Entry<Long, Long>> iterator = waitStartTime.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<Long, Long> entry = iterator.next();
            long xid = entry.getKey();
            long startTime = entry.getValue();
            if (currentTime - startTime >= timeout) {
                // 超时，执行回滚操作
                rollbackTimeoutTransaction(xid);
                iterator.remove();  // 从等待时间记录中移除
            }
        }
    } finally {
        lock.unlock();
    }
}
```

#### 回滚事务

回滚事务意味着：

- 释放该事务占用的资源。
- 将该事务从等待队列和锁表中移除。
- 通知其他等待的事务资源已经可用。

```java
private void rollbackTimeoutTransaction(long xid) {
    System.out.println("Transaction " + xid + " has timed out and will be rolled back.");

    // 解除事务等待的资源
    Long uid = waitU.remove(xid);
    if (uid != null) {
        removeFromList(wait, uid, xid);
    }

    // 释放所有已占用资源
    List<Long> resources = x2u.remove(xid);
    if (resources != null) {
        for (Long resource : resources) {
            selectNewXID(resource);
        }
    }

    // 通知等待该事务的其他线程
    Lock l = waitLock.remove(xid);
    if (l != null && ((ReentrantLock) l).isHeldByCurrentThread()) {
        l.unlock();
    }
}
```

### 资源释放与重分配

当一个事务 `commit` 或者 `abort` 时，`LockTable` 会释放该事务持有的所有资源锁，并重新分配给等待队列中的其他事务。

```java
public void remove(long xid) {
    lock.lock();
    try {
        List<Long> l = x2u.get(xid);
        if (l != null) {
            while (l.size() > 0) {
                Long uid = l.remove(0);
                selectNewXID(uid); // 重新分配资源
            }
        }
        waitU.remove(xid);
        x2u.remove(xid);
        waitLock.remove(xid);
    } finally {
        lock.unlock();
    }
}

// 从等待队列中选择一个xid来占用uid
private void selectNewXID(long uid) {
    u2x.remove(uid);
    List<Long> l = wait.get(uid);
    if (l == null) return;
    assert l.size() > 0;

    while (l.size() > 0) {
        long xid = l.remove(0);
        if (!waitLock.containsKey(xid)) {
            continue;
        } else {
            u2x.put(uid, xid);
            Lock lo = waitLock.remove(xid);
            waitU.remove(xid);
            lo.unlock(); // 解锁等待事务
            break;
        }
    }

    if (l.size() == 0) wait.remove(uid);
}
```

### 综合运作流程

1. **事务请求资源**：当事务请求资源时，`LockTable` 会检查资源是否被其他事务占用，并决定是否将资源分配给请求事务或将其放入等待队列。
2. **死锁检测**：每当一个事务进入等待状态，`LockTable` 会执行死锁检测，通过 DFS 判断是否存在循环依赖。
3. **超时回滚**：后台线程定期检查事务的等待时间，并在超时后自动回滚事务。
4. **资源释放**：在事务完成时，`LockTable` 会释放该事务持有的资源，并将资源分配给其他等待的事务。

通过这一系列操作，`LockTable` 有效地管理了资源的并发访问，防止了死锁的发生，并确保系统的高效运行。

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb7](https://shinya.click/projects/mydb/mydb7)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::