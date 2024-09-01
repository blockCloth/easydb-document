---
icon: tabler:binary-tree
title: 索引管理
order: 1
category:
  - IM
tag:
  - Index
---

> 本章涉及代码：com/dyx/simpledb/backend/im/*

### 前言

IM（Index Manager，索引管理器）是 EasyDB 中用于管理 B+ 树索引的模块。它为 EasyDB 提供了基于 B+ 树的聚簇索引功能。
在 EasyDB 的依赖关系图中可以看到，IM 直接基于 DM（Data Manager）实现，而没有依赖 VM（Version Manager）。这意味着索引数据直接存储在数据库文件中，而无需经过版本管理。本节不深入探讨 B+ 树的算法实现，而是重点描述其在 EasyDB 中的具体实现。

### 二叉树索引结构

B+ 树由多个节点（Node）组成，每个节点都存储在一条 DataItem 中。其数据结构如下：

```
[LeafFlag][KeyNumber][SiblingUid]
[Son0][Key0][Son1][Key1]...[SonN][KeyN]
```

- **LeafFlag**：标记该节点是否为叶子节点。
- **KeyNumber**：该节点中键的数量。
- **SiblingUid**：指向兄弟节点在 DM 中的 UID。
- **SonN 和 KeyN**：交替存储子节点和键值对。最后一个键值始终为 `MAX_VALUE`，以便于查找。

Node 类持有其所属的 B+ 树的引用，DataItem 的引用和 SubArray 的引用，用于方便快速修改和释放数据。

```java
public class Node {
    BPlusTree tree;
    DataItem dataItem;
    SubArray raw;
    long uid;
    ...
}
```

### 根节点的初始化

在 B+ 树中，生成根节点数据的方法如下：

```java
static byte[] newRootRaw(long left, long right, long key)  {
    SubArray raw = new SubArray(new byte[NODE_SIZE], 0, NODE_SIZE);
    setRawIsLeaf(raw, false);
    setRawNoKeys(raw, 2);
    setRawSibling(raw, 0);
    setRawKthSon(raw, left, 0);
    setRawKthKey(raw, key, 0);
    setRawKthSon(raw, right, 1);
    setRawKthKey(raw, Long.MAX_VALUE, 1);
    return raw.raw;
}
```

这个方法生成的根节点包含两个初始子节点 `left` 和 `right`，以及一个初始键值 `key`。
生成一个空的根节点数据的方法如下：

```java
static byte[] newNilRootRaw()  {
    SubArray raw = new SubArray(new byte[NODE_SIZE], 0, NODE_SIZE);
    setRawIsLeaf(raw, true);
    setRawNoKeys(raw, 0);
    setRawSibling(raw, 0);
    return raw.raw;
}
```

### 搜索与插入操作

Node 类提供了两个主要方法，用于辅助 B+ 树执行插入和搜索操作：`searchNext` 和 `leafSearchRange`。

- `searchNext` **方法**：根据给定的键值，查找对应的 UID。如果未找到，则返回兄弟节点的 UID。

```java
public SearchNextRes searchNext(long key) {
    dataItem.rLock();
    try {
        SearchNextRes res = new SearchNextRes();
        int noKeys = getRawNoKeys(raw);
        for(int i = 0; i < noKeys; i ++) {
            long ik = getRawKthKey(raw, i);
            if(key < ik) {
                res.uid = getRawKthSon(raw, i);
                res.siblingUid = 0;
                return res;
            }
        }
        res.uid = 0;
        res.siblingUid = getRawSibling(raw);
        return res;
    } finally {
        dataItem.rUnLock();
    }
}
```

- `leafSearchRange`**方法**：在当前节点内进行范围查找，范围为 `[leftKey, rightKey]`。如果 `rightKey` 大于等于该节点的最大键值，则返回兄弟节点的 UID，方便继续搜索下一个节点。

```java
public LeafSearchRangeRes leafSearchRange(long leftKey, long rightKey) {
    dataItem.rLock();
    try {
        int noKeys = getRawNoKeys(raw);
        int kth = 0;
        while(kth < noKeys) {
            long ik = getRawKthKey(raw, kth);
            if(ik >= leftKey) {
                break;
            }
            kth ++;
        }
        List<Long> uids = new ArrayList<>();
        while(kth < noKeys) {
            long ik = getRawKthKey(raw, kth);
            if(ik <= rightKey) {
                uids.add(getRawKthSon(raw, kth));
                kth ++;
            } else {
                break;
            }
        }
        long siblingUid = 0;
        if(kth == noKeys) {
            siblingUid = getRawSibling(raw);
        }
        LeafSearchRangeRes res = new LeafSearchRangeRes();
        res.uids = uids;
        res.siblingUid = siblingUid;
        return res;
    } finally {
        dataItem.rUnLock();
    }
}
```

### 根节点的管理

由于 B+ 树在插入和删除操作时会动态调整，根节点并不是固定的。为此，系统设置了一个 `bootDataItem`，其中存储了根节点的 UID。操作 DM 时，IM 使用的事务 ID 为 `SUPER_XID`。

```java
public class BPlusTree {
    DataItem bootDataItem;

    private long rootUid() {
        bootLock.lock();
        try {
            SubArray sa = bootDataItem.data();
            return Parser.parseLong(Arrays.copyOfRange(sa.raw, sa.start, sa.start+8));
        } finally {
            bootLock.unlock();
        }
    }

    private void updateRootUid(long left, long right, long rightKey) throws Exception {
        bootLock.lock();
        try {
            byte[] rootRaw = Node.newRootRaw(left, right, rightKey);
            long newRootUid = dm.insert(TransactionManagerImpl.SUPER_XID, rootRaw);
            bootDataItem.before();
            SubArray diRaw = bootDataItem.data();
            System.arraycopy(Parser.long2Byte(newRootUid), 0, diRaw.raw, diRaw.start, 8);
            bootDataItem.after(TransactionManagerImpl.SUPER_XID);
        } finally {
            bootLock.unlock();
        }
    }
}
```

### 错误处理与恢复

在 B+ 树的操作过程中，可能会出现两种主要错误：节点内部错误和节点间关系错误。

- **节点内部错误**：发生在事务 Ti 对节点的数据进行更改时，EasyDB 突然崩溃。由于 IM 依赖 DM，数据库重启后，Ti 会被撤销（undo），节点内部的错误影响将被消除。
- **节点间关系错误**：可能发生在某次对 u 节点的插入操作中，创建了新节点 v，此时 u 的兄弟节点指向 v，但 v 未被插入到父节点中。这会导致无法直接通过父节点找到 v，虽然可以通过兄弟节点间接找到，但这并不是理想状态。

### 结语

通过上述设计与实现，IM 提供了 EasyDB 的索引管理功能，尽管目前不支持删除索引操作，但可以通过 XMAX 标记来避免数据的不一致性。在后续操作中，如果某个节点发生故障，系统仍然可以通过兄弟节点恢复大部分操作。

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb8](https://shinya.click/projects/mydb/mydb8)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::