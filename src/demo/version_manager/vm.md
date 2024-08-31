---
icon: carbon:logo-vmware
title: VM 的实现
order: 4
category:
  - VM
tag:
  - VM
---
> 本章涉及代码：com/dyx/simpledb/backend/vm/*

### VM（Version Manager）的基本定义与实现优化

VM（Version Manager）层通过 `VersionManager` 接口向上层提供了一组用于管理事务和数据操作的基本功能。这个层次主要负责事务的管理，包括事务的开始、提交、回滚，以及数据的插入、读取和删除。
以下是 `VersionManager` 接口的基本定义：

```java
public interface VersionManager {
    byte[] read(long xid, long uid) throws Exception;
    long insert(long xid, byte[] data) throws Exception;
    boolean delete(long xid, long uid) throws Exception;

    long begin(int level);
    void commit(long xid) throws Exception;
    void abort(long xid);
}
```

VM 的实现类还继承了 `AbstractCache<Entry>`，以实现对数据条目的缓存管理。以下是缓存管理方法的实现：

```java
@Override
protected Entry getForCache(long uid) throws Exception {
    // 从存储层读取 Entry 数据
    Entry entry = Entry.loadEntry(this, uid);
    if (entry == null) {
        throw Error.NullEntryException;
    }
    return entry;
}

@Override
protected void releaseForCache(Entry entry) {
    // 从缓存中释放 Entry
    entry.remove();
}
```

### 具体实现功能的优化

#### `begin()` 方法

`begin()` 方法用于启动一个新事务，并初始化事务的相关结构。为了实现串行化隔离级别，需要确保事务的串行执行。在该方法的开始部分，我们引入了一个全局锁（`globalLock`），以确保在同一时间内只有一个事务可以执行，从而达到串行化隔离的效果。  

```java
@Override
public long begin(IsolationLevel isolationLevel) {
    globalLock.lock(); // 获取全局锁
    lock.lock();
    try {
        if (isolationLevel != IsolationLevel.SERIALIZABLE) {
            globalLock.unlock(); // 非串行化需要解除全局锁
        }
        long xid = tm.begin();
        Transaction t = Transaction.newTransaction(
                xid, isolationLevel == null ? IsolationLevel.READ_COMMITTED : isolationLevel, activeTransaction);
        activeTransaction.put(xid, t);

        return xid;
    } finally {
        lock.unlock();
    }
}
```

#### `commit()` 方法

`commit()` 方法用于提交事务并释放事务持有的锁，若事务的隔离级别是串行化，还需释放全局锁。

```java
@Override
public void commit(long xid) throws Exception {
    lock.lock();
    Transaction t = activeTransaction.get(xid);
    lock.unlock();

    try {
        if (t.err != null) {
            throw t.err;
        }
    } catch (NullPointerException n) {
        System.out.println(xid);
        System.out.println(activeTransaction.keySet());
        Panic.panic(n);
    }

    lock.lock();
    activeTransaction.remove(xid);
    lock.unlock();

    lt.remove(xid);
    tm.commit(xid);

    if (t.isolationLevel == IsolationLevel.SERIALIZABLE && globalLock.tryLock()) {
        globalLock.unlock();  // 释放全局锁
    }
}
```

#### `abort()` 方法

`abort()` 方法用于中止事务，支持手动和自动回滚，若事务的隔离级别是串行化，还需释放全局锁。确保全局锁释放是在末尾，避免产生锁相关的问题。

```java
@Override
public void abort(long xid) {
    internAbort(xid, false);
}

private void internAbort(long xid, boolean autoAborted) {
    lock.lock();
    Transaction t = activeTransaction.get(xid);
    if (!autoAborted) {
        activeTransaction.remove(xid);
    }
    lock.unlock();

    if (t.autoAborted){
        if (t.isolationLevel == IsolationLevel.SERIALIZABLE) globalLock.unlock();  // 释放全局锁
        return;
    }
    lt.remove(xid);
    tm.abort(xid);

    if (t.isolationLevel == IsolationLevel.SERIALIZABLE) globalLock.unlock();  // 释放全局锁
    
}
```

#### `read()` 方法

`read()` 方法用于读取数据，确保数据对当前事务是可见的。

```java
@Override
public byte[] read(long xid, long uid) throws Exception {
    lock.lock();
    Transaction t = activeTransaction.get(xid);
    lock.unlock();

    if (t.err != null) {
        throw t.err;
    }

    Entry entry;
    try {
        entry = super.get(uid); // 获取数据项
    } catch (Exception e) {
        if (e == Error.NullEntryException) {
            return null;
        } else {
            throw e;
        }
    }

    try {
        if (Visibility.isVisible(tm, t, entry)) {
            return entry.data(); // 如果可见，返回数据
        } else {
            return null;
        }
    } finally {
        entry.release(); // 释放数据项
    }
}
```

#### `insert()` 方法

`insert()` 方法将数据包装为 `Entry` 后插入数据存储层。

```java
@Override
public long insert(long xid, byte[] data) throws Exception {
    lock.lock();
    Transaction t = activeTransaction.get(xid);
    lock.unlock();

    if (t.err != null) {
        throw t.err;
    }

    byte[] raw = Entry.wrapEntryRaw(xid, data); // 包装数据
    return dm.insert(xid, raw); // 插入数据并返回唯一标识符
}
```

#### `delete()` 方法

`delete()` 方法用于删除数据，同时确保版本的正确性。

```java
@Override
public boolean delete(long xid, long uid) throws Exception {
    // 获取锁，防止并发问题
    lock.lock();
    // 从活动事务中获取事务对象
    Transaction t = activeTransaction.get(xid);
    // 释放锁
    lock.unlock();

    // 如果事务已经出错，那么抛出错误
    if (t.err != null) {
        throw t.err;
    }
    Entry entry = null;
    try {
        // 尝试获取数据项
        entry = super.get(uid);
    } catch (Exception e) {
        // 如果数据项不存在，那么返回false
        if (e == Error.NullEntryException) {
            return false;
        } else {
            // 如果出现其他错误，那么抛出错误
            throw e;
        }
    }
    try {
        // 如果数据项对当前事务不可见，那么返回false
        if (!Visibility.isVisible(tm, t, entry)) {
            return false;
        }
        Lock l = null;
        try {
            // 尝试为数据项添加锁
            l = lt.add(xid, uid);
        } catch (Exception e) {
            // 如果出现并发更新的错误，那么中止事务，并抛出错误
            t.err = Error.ConcurrentUpdateException;
            internAbort(xid, true);
            t.autoAborted = true;
            throw t.err;
        }
        // 如果成功获取到锁，那么锁定并立即解锁
        if (l != null) {
            l.lock();
            l.unlock();
        }

        // 如果数据项已经被当前事务删除，那么返回false
        if (entry.getXmax() == xid) {
            return false;
        }

        // 如果数据项的版本被跳过，那么中止事务，并抛出错误
        if (Visibility.isVersionSkip(tm, t, entry)) {
            t.err = Error.ConcurrentUpdateException;
            internAbort(xid, true);
            t.autoAborted = true;
            throw t.err;
        }

        // 设置数据项的xmax为当前事务的ID，表示数据项被当前事务删除
        entry.setXmax(xid);
        // 返回true，表示删除操作成功
        return true;

    } finally {
        // 释放数据项
        entry.release();
    }
}
```

### 总结

通过上述优化实现，VM 层的事务管理更加高效且安全。通过锁机制确保了并发事务的正确性，通过可见性判断确保事务读取到的数据是符合隔离级别要求的。自动回滚机制也能够有效应对死锁和版本跳跃问题，保证系统的稳定性和一致性。

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb7](https://shinya.click/projects/mydb/mydb7)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::