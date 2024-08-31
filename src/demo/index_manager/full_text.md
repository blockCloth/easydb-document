---
icon: clarity:tree-view-line
title: 全表扫描
order: 2
category:
  - IM
tag:
  - fullText
---

> 本章涉及代码：com/dyx/simpledb/backend/tbm/Table.java

## 具体实现

### 写前分析

全表扫描的实现思路因人而异。对我而言，我选择在以下两种情况下触发全表扫描：

1. `where`条件为空。
2. 需要查询的字段都没有建立索引，或者两个需要查询的字段中其中一个没有建立索引。

### 代码实现

全表扫描的判断逻辑发生在`Table.parseWhere()`方法中。这个方法负责返回所有数据的UID，并对数据进行运算过滤。

```java
private List<Long> parseWhere(Where where, long xid) throws Exception {
    if (where == null)
        return getAllUid();

    Field indexedField1 = findIndexedField(where.singleExp1.field); // 字段1是否存在索引
    Field indexedField2 = where.singleExp2 != null ? findIndexedField(where.singleExp2.field) : null; // 字段2是否存在索引

    List<Long> uids;

    // 如果两个条件字段都没有索引，执行全表扫描
    if (indexedField1 == null && indexedField2 == null) {
        return performFullTableScanWithCondition(where, xid);
    }

    // 如果第一个条件字段有索引，使用第一个条件字段进行初步查询
    if (indexedField1 != null) {
        CalWhereRes res = calWhere(indexedField1, where.singleExp1);
        uids = indexedField1.search(res.l0, res.r0);

        // 如果存在第二个条件字段
        if (where.singleExp2 != null) {
            // 如果第二个条件字段也有索引，进行第二次索引查询
            if (indexedField2 != null) {
                CalWhereRes res2 = calWhere(indexedField2, where.singleExp2);
                List<Long> additionalUids = indexedField2.search(res2.l0, res2.r0);

                if ("and".equals(where.logicOp)) {
                    uids.retainAll(additionalUids); // 取交集
                } else {
                    Set<Long> mergedSet = new HashSet<>(uids);
                    mergedSet.addAll(additionalUids);
                    uids = new ArrayList<>(mergedSet); // 取并集
                }
            } else {
                // 如果第二个条件字段没有索引，执行全表扫描，并取并集
                List<Long> additionalUids = performFullTableScanWithCondition(new Where(where.singleExp2), xid);
                if ("and".equals(where.logicOp)) {
                    uids.retainAll(additionalUids); // 取交集
                } else {
                    Set<Long> mergedSet = new HashSet<>(uids);
                    mergedSet.addAll(additionalUids);
                    uids = new ArrayList<>(mergedSet); // 取并集
                }
            }
        }
    } else {
        // 如果第一个条件字段没有索引但第二个条件字段有索引
        CalWhereRes res = calWhere(indexedField2, where.singleExp2);
        uids = indexedField2.search(res.l0, res.r0);

        // 因为第一个条件字段没有索引，需要全表扫描
        List<Long> additionalUids = performFullTableScanWithCondition(new Where(where.singleExp1), xid);
        if ("and".equals(where.logicOp)) {
            uids.retainAll(additionalUids); // 取交集
        } else {
            Set<Long> mergedSet = new HashSet<>(uids);
            mergedSet.addAll(additionalUids);
            uids = new ArrayList<>(mergedSet); // 取并集
        }
    }

    return uids;
}
```

### 获取所有UID

当`where`条件为空时，直接返回所有UID。在这里实现存在简化，但我设计了隐藏字段以及主键，确保拥有一个索引字段。正常情况下，需要扫描磁盘来获取UID。

```java
private List<Long> getAllUid() throws Exception {
    Field fd = null;
    for (Field field : fields) {
        if (field.isIndexed()) {
            fd = field;
            break;
        }
    }
    return fd.search(0, Integer.MAX_VALUE);
}
```

### 查找是否存在索引ID

查找字段是否存在索引，用于后续的查询优化。

```java
private Field findIndexedField(String fieldName) {
    return fields.stream()
            .filter(field -> field.fieldName.equals(fieldName) && field.isIndexed())
            .findFirst()
            .orElse(null);
}
```

### 执行全表查询

执行全表扫描，并根据条件进行过滤。

```java
private List<Long> performFullTableScanWithCondition(Where where, long xid) throws Exception {
    List<Long> uids = new ArrayList<>();
    for (Long uid : getAllUid()) { // 通过所有UID进行过滤
        byte[] data = ((TableManagerImpl) tbm).vm.read(xid, uid);
        if (data == null) continue;

        Map<String, Object> record = parseEntry(data);

        if (satisfiesCondition(record, where)) {
            uids.add(uid);
        }
    }
    return uids;
}
```

### 判断是否符合条件

判断记录是否符合条件，包括处理`where`条件中的逻辑运算。

```java
private boolean satisfiesCondition(Map<String, Object> record, Where where) throws Exception {
    // 先初始化处理singleExp1
    boolean result1 = checkSingleCondition(record, where.singleExp1);
    if (where.singleExp2 == null) {
        return result1;
    }

    // 再次处理singleExp2的结果
    boolean result2 = checkSingleCondition(record, where.singleExp2);

    switch (where.logicOp) {
        case "and":
            return result1 && result2;
        case "or":
            return result1 || result2;
        default:
            throw new IllegalArgumentException("Unsupported logical operation: " + where.logicOp);
    }
}
```

### 检查单个条件

检查记录是否满足单个条件。

```java
private boolean checkSingleCondition(Map<String, Object> record, SingleExpression singleExp) throws Exception {
    // 从记录中获取字段值
    Object valueInRecord = record.get(singleExp.field);
    if (valueInRecord == null) return false; // 记录中没有对应的字段

    // 使用 string2Value 将条件的字符串值转换为适当的对象类型
    Object conditionValue = string2Value(singleExp.value, singleExp.field);

    // 如果转换后的值为空，说明类型不匹配或字段不存在，返回 false
    if (conditionValue == null) return false;

    // 执行比较操作,将 valueInRecord 强制转换为 Comparable<Object>，以便后续可以调用 compareTo 方法进行比较
    @SuppressWarnings("unchecked")
    Comparable<Object> comparableValueInRecord = (Comparable<Object>) valueInRecord;

    switch (singleExp.compareOp.toLowerCase()) {
        case "=":
            return comparableValueInRecord.compareTo(conditionValue) == 0;
        case ">":
            return comparableValueInRecord.compareTo(conditionValue) > 0;
        case "<":
            return comparableValueInRecord.compareTo(conditionValue) < 0;
        case ">=":
            return comparableValueInRecord.compareTo(conditionValue) >= 0;
        case "<=":
            return comparableValueInRecord.compareTo(conditionValue) <= 0;
        case "!=":
            return comparableValueInRecord.compareTo(conditionValue) != 0;
        case "like":
            return ((String) valueInRecord).contains((String) conditionValue);
        // 其他比较操作
        default:
            throw new IllegalArgumentException("Unsupported comparison operation: " + singleExp.compareOp);
    }
}
```

### 字符串转换为值

将字符串值转换为字段的实际类型，起初使用的是`Field`进行处理的，但是会存在多个字段使用同一个索引的问题，会造成类型转换异常，所以这个方法也在`Table`中实现了一份。

```java
private Object string2Value(String value, String fieldName) {
    // 引入 fieldCache用于缓存字段名和 Field 对象之间的映射关系，减少多次查找同一字段的开销。
    Field field = fieldCache.computeIfAbsent(fieldName, k -> fields.stream()
            .filter(f -> f.fieldName.equals(k))
            .findFirst()
            .orElse(null));

    if (field != null) {
        Types.SupportedType type = Types.SupportedType.fromTypeName(field.fieldType);
        return type.parseValue(value);
    }
    return null;
}
```

### 计算条件

根据字段和表达式计算条件范围。

```java
class CalWhereRes {
    long l0, r0, l1, r1;
    boolean single;
}

private CalWhereRes calWhere(Field field, SingleExpression exp) throws Exception {
    CalWhereRes res = new CalWhereRes();
    FieldCalRes r = field.calExp(exp);
    res.l0 = r.left;
    res.r0 = r.right;
    res.single = true;
    return res;
}
```

通过上述实现，我们可以有效地处理全表扫描，并在条件合适的情况下进行索引查询和优化。这样不仅提高了查询效率，也确保了系统的灵活性和扩展性。希望通过本文的分享，能够对读者在全表扫描及其优化的实现上有所帮助。

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::