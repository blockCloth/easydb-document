---
icon: lock
title: 数据页管理
order: 4
category:
  - DM
tag:
  - 页面管理
---

> 本章涉及代码：com/dyx/simpledb/backend/dm/page/*

## 数据库页面管理

在数据库系统中，页面（Page）是数据存储和管理的基本单位。在EasyDB中，页面管理的设计目标之一是确保系统在启动时能够正确恢复，并且在运行过程中有效管理页面的空闲空间。本文将深入探讨EasyDB中页面管理的具体实现，包括第一页的特殊用途和普通页的空闲空间管理。

### 第一页的特殊用途

数据库文件的第一页通常被用于存储元数据和执行启动检查。在EasyDB中，第一页的作用非常简单，但至关重要，它仅用于执行启动检查，以确保数据库在上次关闭时是正常的。

#### 页面数据校验机制

每次数据库启动时，系统会生成一串随机字节并存储在第一页的 **100~107** 字节。正常关闭时，这串字节会被复制到第一页的 **108~115** 字节。每次数据库启动时，系统会比较这两处的字节，如果相同，则表明上次关闭是正常的；如果不同，则意味着需要执行数据恢复流程。
以下是实现代码：

```java
// 设置启动时的校验字节
public static void setVcOpen(Page pg) {
    pg.setDirty(true);
    setVcOpen(pg.getData());
}

private static void setVcOpen(byte[] raw) {
    // 生成并设置随机校验字节
    System.arraycopy(RandomUtil.randomBytes(LEN_VC), 0, raw, OF_VC, LEN_VC);
}

// 设置关闭时的校验字节
public static void setVcClose(Page pg) {
    pg.setDirty(true);
    setVcClose(pg.getData());
}

private static void setVcClose(byte[] raw) {
    // 将启动时的校验字节复制到关闭时的存储位置
    System.arraycopy(raw, OF_VC, raw, OF_VC + LEN_VC, LEN_VC);
}

// 校验字节是否一致
public static boolean checkVc(Page pg) {
    return checkVc(pg.getData());
}

private static boolean checkVc(byte[] raw) {
    // 比较启动和关闭时的校验字节
    return Arrays.equals(Arrays.copyOfRange(raw, OF_VC, OF_VC + LEN_VC),
                         Arrays.copyOfRange(raw, OF_VC + LEN_VC, OF_VC + 2 * LEN_VC));
}
```

### 普通页的管理

普通页面（普通页）是用于实际存储数据的页面。在EasyDB中，每个普通页以一个2字节的无符号数开头，表示该页的空闲位置的偏移量。由于页面的最大容量为8K，因此2字节的偏移量足以表达这一页的所有可能偏移。

#### 空闲空间偏移量（FSO）的管理

普通页的管理核心在于管理空闲空间偏移量（FSO）。FSO指示了页面中第一个可用的空闲字节的位置。每次插入数据时，FSO会更新为新插入数据的末尾位置，以便后续插入操作可以准确地找到空闲位置。
以下是FSO管理的代码示例：

```java
// 设置空闲空间偏移量
private static void setFSO(byte[] raw, short ofData) {
    System.arraycopy(Parser.short2Byte(ofData), 0, raw, OF_FREE, OF_DATA);
}

// 获取页面的空闲空间偏移量
public static short getFSO(Page pg) {
    return getFSO(pg.getData());
}

private static short getFSO(byte[] raw) {
    return Parser.parseShort(Arrays.copyOfRange(raw, 0, 2));
}

// 获取页面的空闲空间大小
public static int getFreeSpace(Page pg) {
    return PageCache.PAGE_SIZE - (int) getFSO(pg.getData());
}
```

### 数据插入

在普通页中插入数据时，系统首先根据当前的FSO确定插入位置，然后将数据写入该位置，最后更新FSO。插入完成后，页面被标记为脏页面，以便在需要时将其写回磁盘。
以下是插入操作的代码示例：

```java
// 将数据插入页面，返回插入位置
public static short insert(Page pg, byte[] raw) {
    pg.setDirty(true); // 标记页面为脏页面
    short offset = getFSO(pg.getData()); // 获取当前空闲空间偏移量
    System.arraycopy(raw, 0, pg.getData(), offset, raw.length); // 将数据写入页面
    setFSO(pg.getData(), (short) (offset + raw.length)); // 更新空闲空间偏移量
    return offset; // 返回数据插入位置
}
```

通过以上机制，EasyDB能够有效地管理页面的空闲空间，并确保数据的一致性与完整性。第一页的校验机制确保了数据库在启动时能够检测并处理未正常关闭的情况，而普通页的FSO管理则确保了数据插入和存储的高效与准确。
:::tip
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb3](https://shinya.click/projects/mydb/mydb3)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::

