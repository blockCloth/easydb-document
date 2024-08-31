---
icon: fluent:table-stack-left-20-regular
title: 字段与表管理
order: 2
category:
  - TBM
tag:
  - table
  - field
---
> 本章涉及代码：com/dyx/simpledb/backend/tbm/Table、Field.java

## 数据库表结构与字段约束的实现

在数据库管理系统中，表结构和字段是数据存储的核心组成部分。本文将介绍如何在我们的数据库系统中定义、创建和管理表结构和字段，同时讲解如何处理字段的各种约束条件，例如自增、唯一性和非空约束。为了确保数据库操作的正确性和数据的一致性，我们还将讨论隐藏字段和查询操作中涉及的约束验证。

### 数据存储结构

数据库中的表和字段信息以二进制形式存储在称为 `Entry` 的数据结构中。

#### 表的存储结构

在我们的系统中，每个表的信息都按照一定的结构存储。这个结构包含了表名、指向下一个表的链接以及表中各个字段的唯一标识符（UID）。这类似于一本书的目录，其中记录了每章的名称以及它们的位置。
具体结构如下：

- **[TableName] [NextTable] [Field1Uid][Field2Uid]...[FieldNUid]**
- **TableName:** 表的名称，例如“用户表”或“订单表”。
- **NextTable:** 如果数据库中有多个表，那么每个表会链接到下一个表。这个字段保存下一个表的唯一标识符。
- **FieldUIDs:** 这是表中所有字段的唯一标识符的列表。这些标识符用于快速定位字段信息。

**Java 实现示例：**

```java
public class Table {
    TableManager tbm; // 表管理器，用于管理数据库表
    long uid; // 表的唯一标识符
    String name; // 表的名称
    byte status; // 表的状态
    long nextUid; // 下一个表的唯一标识符
    List<Field> fields = new ArrayList<>(); // 表的字段列表
}
```

#### 字段的存储结构

字段是数据库表中的基本单元，每个字段都具有一个名称、一个类型（例如整数或字符串）以及一个可能的索引（用于加快查询速度）。
字段的存储结构如下：

- **[FieldName] [TypeName] [IndexUid]**
- **FieldName:** 这个字段的名字，例如“用户名”或“订单ID”。
- **TypeName:** 字段的数据类型，目前支持`int,long,float,double,varchar,datetime`
- **IndexUid:** 如果这个字段被建立了索引，那么这个标识符指向该索引的根节点。否则，它的值为 `0`。

**Java 实现示例：**

```java
public class Field {
    long uid; // 字段的唯一标识符
    private Table tb; // 字段所属的表
    String fieldName; // 字段名称
    String fieldType; // 字段类型
    private long index; // 索引的唯一标识符
    private BPlusTree bt; // B+树，用于索引字段值
}
```

### 表的创建与持久化

在数据库中，创建一张表并不仅仅是指定表名和字段那么简单。我们还需要考虑字段的约束条件，例如字段是否必须唯一、是否允许为空，以及是否需要自动增长（通常用于主键字段）。

#### 创建表

当我们调用 `createTable` 方法时，我们指定了表名和字段的详细信息。系统会根据用户的输入自动处理每个字段的约束条件，并将这些信息存储在数据库中。
举个例子，如果我们希望创建一个包含用户信息的表，我们可能会希望“用户ID”字段是唯一的且自动增长，而“用户名”字段则必须是唯一的且不能为空。
**创建表的 Java 代码示例：**

```java
public static Table createTable(TableManager tbm, long nextUid, long xid, Create create) throws Exception {
    // 创建表对象
    Table tb = new Table(tbm, create.tableName, nextUid);

    // 处理主键、自增、非空、唯一约束
    String primaryKey = create.primaryKey;
    Set<String> notNullFields = new HashSet<>(Arrays.asList(create.notNull));
    Set<String> autoIncrementFields = new HashSet<>(Arrays.asList(create.autoIncrement));
    Set<String> uniqueFields = new HashSet<>(Arrays.asList(create.unique));

    boolean isIndexed = false;
    for (int i = 0; i < create.fieldName.length; i++) {
        String fieldName = create.fieldName[i];
        String fieldType = create.fieldType[i];

        // 判断字段的各类约束
        boolean isPrimaryKey = primaryKey != null && primaryKey.equalsIgnoreCase(fieldName);
        boolean isNotNull = notNullFields.contains(fieldName) || isPrimaryKey;
        boolean isUnique = uniqueFields.contains(fieldName) || isPrimaryKey;
        boolean isAutoIncrement = autoIncrementFields.contains(fieldName);

        // 检查自增字段的类型
        if (isAutoIncrement && !"int".equalsIgnoreCase(fieldType)) {
            throw new IllegalArgumentException("自增字段类型必须为int");
        }

        boolean indexed = isPrimaryKey || (!isIndexed && isNotNull);
        if (indexed) {
            isIndexed = true;
        }

        // 创建字段
        tb.fields.add(Field.createField(tb, xid, fieldName, fieldType, indexed, isAutoIncrement, isNotNull, isUnique));
    }

    // 如果没有显式索引字段，创建隐藏字段
    if (!isIndexed) {
        tb.fields.add(Field.createField(tb, xid, "GEN_CLUST_INDEX", "int", true, true, true, true));
        autoIncrementFields.add("GEN_CLUST_INDEX");
    }

    // 持久化表对象
    return tb.persistSelf(xid);
}
```

### 字段的创建与约束实现

在创建字段时，我们需要为每个字段配置它的特定约束条件，比如是否允许为空、是否必须唯一、以及是否自动增长。我们通过以下代码来实现这些约束：
**创建字段的 Java 代码示例：**

```java
public static Field createField(Table tb, long xid, String fieldName, String fieldType, boolean indexed, boolean isAutoIncrement, boolean isNotNull, boolean isUnique) throws Exception {
    // 检查字段类型有效性
    typeCheck(fieldType);

    Field f = new Field(tb, fieldName, fieldType, 0, isAutoIncrement, isNotNull, isUnique);
    if (indexed) {
        long index = BPlusTree.create(((TableManagerImpl) tb.tbm).dm);
        BPlusTree bt = BPlusTree.load(index, ((TableManagerImpl) tb.tbm).dm);
        f.index = index;
        f.bt = bt;
    }
    f.persistSelf(xid);
    return f;
}
```

#### 字段约束的实现

在插入数据时，我们需要确保字段的值满足所有设置的约束条件，这里就以唯一约束为例。例如，若某个字段设置了唯一性约束，我们必须在插入新数据之前检查这个值是否已经存在于数据库中。
**插入数据时的约束检查：**

```java
public void insert(long xid, InsertObj insertObj) throws Exception {
    Map<String, Object> entry = string2Entry(insertObj);
    byte[] raw = entry2Raw(entry);
    long uid = ((TableManagerImpl) tbm).vm.insert(xid, raw);

    for (Field field : fields) {
        if (field.isIndexed()) {
            field.insert(entry.get(field.fieldName), uid);
        }
    }

    // 更新唯一约束值集合
    updateUniqueValues(entry);
}

private void updateUniqueValues(Map<String, Object> entry) {
    for (Field field : fields) {
        if (field.isUnique && entry.containsKey(field.fieldName)) {
            field.uniqueValues.add(entry.get(field.fieldName));
        }
    }
}
```

### 隐藏字段的实现

有时用户在创建表时可能没有显式指定主键或索引字段。这种情况下，系统会自动生成一个隐藏字段来作为表的主键或索引字段。这个隐藏字段不会展示给用户，但它在确保数据的唯一性和加快查询速度方面起到了关键作用。
**隐藏字段的 Java 实现：**

```java
// 检查并创建隐藏字段
if (!isIndexed) {
    tb.fields.add(Field.createField(tb, xid, "GEN_CLUST_INDEX", "int", true, true, true, true));
    autoIncrementFields.add("GEN_CLUST_INDEX");
}
```

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb9](https://shinya.click/projects/mydb/mydb9)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::