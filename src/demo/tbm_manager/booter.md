---
icon: gravity-ui:layout-footer
title: Booter
order: 1
category:
  - TBM
tag:
  - Booter
---
> 本章涉及代码：com/dyx/simpledb/backend/tbm/Booter.java

在 EasyDB 中，启动信息管理是数据库初始化和运行时的重要组成部分。启动信息存储在 `bt` 文件中，该文件主要记录了数据库的头表 UID。这些信息对于数据库的正常启动至关重要。为确保启动信息的一致性和正确性，EasyDB 使用了一种保证原子性的更新策略。

### 启动信息管理

- **启动信息存储**：EasyDB 的启动信息存储在 `.bt` 文件中，主要记录数据库的头表 UID。
- **Booter 类**：`Booter` 类提供了加载（`load`）和更新（`update`）启动信息的方法。
- **原子性更新**：为了确保启动信息的修改是原子的，`update` 方法首先将数据写入一个临时文件 `.bt_tmp`，然后通过操作系统的文件重命名操作将临时文件重命名为 `.bt` 文件。这种方式利用了操作系统重命名文件的原子性，确保了对 `.bt` 文件的更新操作的原子性，从而保证了启动信息的一致性。

### 基本定义

`Booter` 类的主要字段和定义如下：

```java
public class Booter {
    // 数据库启动信息文件的后缀
    public static final String BOOTER_SUFFIX = ".bt";
    // 数据库启动信息文件的临时后缀
    public static final String BOOTER_TMP_SUFFIX = ".bt_tmp";
    // 数据库启动信息文件的路径
    String path;
    // 数据库启动信息文件
    File file;
}
```

### 创建与打开启动信息文件

`create` 和 `open` 方法用于创建或打开启动信息文件，并进行必要的校验。

```java
// 创建一个新的Booter对象
public static Booter create(String path) {
    removeBadTmp(path); // 删除可能存在的临时文件
    File f = new File(path + BOOTER_SUFFIX);
    try {
        if (!f.createNewFile()) {
            Panic.panic(Error.FileExistsException); // 文件已存在，抛出异常
        }
    } catch (Exception e) {
        Panic.panic(e); // 创建文件过程中出现异常，处理异常
    }
    if (!f.canRead() || !f.canWrite()) {
        Panic.panic(Error.FileCannotRWException); // 文件不可读写，抛出异常
    }
    return new Booter(path, f); // 返回新创建的Booter对象
}

// 打开一个已存在的Booter对象
public static Booter open(String path) {
    removeBadTmp(path); // 删除可能存在的临时文件
    File f = new File(path + BOOTER_SUFFIX);
    if (!f.exists()) {
        Panic.panic(Error.FileNotExistsException); // 文件不存在，抛出异常
    }
    if (!f.canRead() || !f.canWrite()) {
        Panic.panic(Error.FileCannotRWException); // 文件不可读写，抛出异常
    }
    return new Booter(path, f); // 返回打开的Booter对象
}

// 删除可能存在的临时文件
private static void removeBadTmp(String path) {
    new File(path + BOOTER_TMP_SUFFIX).delete(); // 删除临时文件
}
```

### 加载启动信息

`load` 方法用于加载 `.bt` 文件中的启动信息。

```java
public byte[] load() {
    try {
        return Files.readAllBytes(file.toPath()); // 读取文件的所有字节
    } catch (IOException e) {
        Panic.panic(e); // 读取文件过程中出现异常，处理异常
    }
    return null;
}
```

### 更新启动信息

`update` 方法用于更新 `.bt` 文件中的启动信息，并确保操作的原子性。

```java
public void update(byte[] data) {
    File tmp = new File(path + BOOTER_TMP_SUFFIX);
    try {
        tmp.createNewFile(); // 创建新的临时文件
    } catch (Exception e) {
        Panic.panic(e); // 创建临时文件过程中出现异常，处理异常
    }
    if (!tmp.canRead() || !tmp.canWrite()) {
        Panic.panic(Error.FileCannotRWException); // 临时文件不可读写，抛出异常
    }
    try (FileOutputStream out = new FileOutputStream(tmp)) {
        out.write(data); // 将数据写入临时文件
        out.flush(); // 刷新输出流，确保数据写入文件
    } catch (IOException e) {
        Panic.panic(e); // 写入文件过程中出现异常，处理异常
    }
    try {
        Files.move(tmp.toPath(), new File(path + BOOTER_SUFFIX).toPath(), StandardCopyOption.REPLACE_EXISTING); // 将临时文件移动并替换原文件
    } catch (IOException e) {
        Panic.panic(e); // 移动文件过程中出现异常，处理异常
    }
    file = new File(path + BOOTER_SUFFIX); // 更新file字段为新的启动信息文件
    if (!file.canRead() || !file.canWrite()) {
        Panic.panic(Error.FileCannotRWException); // 新的启动信息文件不可读写，抛出异常
    }
}
```

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb9](https://shinya.click/projects/mydb/mydb9)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::