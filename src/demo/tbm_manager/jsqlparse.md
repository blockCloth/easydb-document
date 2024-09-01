---
icon: tabler:sql
title: 使用JSQLParser进行SQL解析
order: 3
category:
  - TBM
tag:
  - JSQLParser
---
JSQLParser 是一个强大的 Java 库，用于解析 SQL 语句并将其转换为易于处理的 Java 对象。本文将通过解析 `Parser` 类，讲解如何使用 JSQLParser 解析和处理不同类型的 SQL 语句。

### 简介

`Parser` 类是一个用于解析 SQL 语句的核心组件。它基于 JSQLParser 库，能够解析各种 SQL 语句并将其转换为 Java 对象，便于在应用程序中进行后续处理。类中的主要方法 `Parse` 是解析 SQL 语句的入口点，根据不同的 SQL 语句类型，调用相应的解析方法。

### `Parse` 方法

`Parse` 方法是解析 SQL 语句的入口。它首先将 SQL 语句转换为字符串，然后基于语句的类型调用不同的解析方法。

```java
public static Object Parse(byte[] statement) throws Exception {
    String sql = new String(statement).trim();

    // 处理事务控制语句
    if (sql.toUpperCase().startsWith("BEGIN")) {
        return parseBegin(sql);
    } else if (sql.equalsIgnoreCase("ABORT") || sql.equalsIgnoreCase("ABORT;")) {
        return parseAbort();
    } else if (sql.equalsIgnoreCase("COMMIT") || sql.equalsIgnoreCase("COMMIT;")) {
        return parseCommit();
    }

    Statement parsedStatement;
    try {
        parsedStatement = CCJSqlParserUtil.parse(sql);
    } catch (JSQLParserException e) {
        // 处理 SQL 语句解析异常
        String message = e.getMessage();
        String result = null;
        int startIndex = message.indexOf("Encountered unexpected token:");
        int endIndex = message.indexOf("\nWas expecting one of:");
        if (startIndex != -1 && endIndex != -1) {
            result = message.substring(startIndex, endIndex);
        }
        throw new RuntimeException("Invalid statement: " + (result == null ? sql : result), e);
    }

    // 调用相应的解析方法
    if (parsedStatement instanceof CreateTable) {
        return parseCreate((CreateTable) parsedStatement);
    } else if (parsedStatement instanceof Select) {
        return parseSelect((Select) parsedStatement);
    } else if (parsedStatement instanceof Insert) {
        return parseInsert((Insert) parsedStatement);
    } else if (parsedStatement instanceof Update) {
        return parseUpdate((Update) parsedStatement);
    } else if (parsedStatement instanceof Delete) {
        return parseDelete((Delete) parsedStatement);
    } else if (parsedStatement instanceof Drop) {
        return parseDrop((Drop) parsedStatement);
    } else if (parsedStatement instanceof ShowStatement) {
        return parseShow((ShowStatement) parsedStatement);
    } else {
        throw new RuntimeException("Unsupported statement: " + sql);
    }
}
```

### 解析不同类型的 SQL 语句

#### 解析 `SELECT` 语句

`parseSelect` 方法解析 `SELECT` 语句，提取查询的字段、表名、`ORDER BY` 子句和 `WHERE` 条件。

```java
private static SelectObj parseSelect(Select select) {
    SelectObj read = new SelectObj();
    List<String> fields = new ArrayList<>();
    List<String> orderFields = new ArrayList<>();
    List<Boolean> orderAscFields = new ArrayList<>();

    select.getSelectBody().accept(new SelectVisitorAdapter() {
        @Override
        public void visit(PlainSelect plainSelect) {
            // 处理 SELECT 字段
            plainSelect.getSelectItems().forEach(selectItem -> {
                String fieldName = selectItem instanceof SelectExpressionItem
                        ? ((SelectExpressionItem) selectItem).getExpression().toString()
                        : selectItem.toString();
                fields.add(fieldName);
            });

            // 处理 ORDER BY 字段
            if (plainSelect.getOrderByElements() != null) {
                plainSelect.getOrderByElements().forEach(orderByElement -> {
                    String orderField = orderByElement.getExpression().toString();
                    orderFields.add(orderField);
                    orderAscFields.add(orderByElement.isAsc());
                });
            }

            // 设置查询字段和表名
            read.fields = fields.toArray(new String[0]);
            read.tableName = plainSelect.getFromItem().toString();

            // 初始化 ORDER BY 表达式
            read.orderByExpression = new OrderByExpression();
            // 设置 ORDER BY 表达式
            read.orderByExpression.fields = orderFields.toArray(new String[0]);
            read.orderByExpression.order = orderAscFields.toArray(new Boolean[0]);

            // 设置 WHERE 子句
            if (plainSelect.getWhere() != null) {
                read.where = parseWhere(plainSelect.getWhere().toString());
            }
        }
    });

    return read;
}
```

#### 解析 `INSERT` 语句

`parseInsert` 方法解析 `INSERT` 语句，提取插入的数据表名、列名和值。

```java
private static InsertObj parseInsert(Insert insertStmt) throws Exception {
    InsertObj insertObj = new InsertObj();
    insertObj.tableName = insertStmt.getTable().getName();
    List<String> values = new ArrayList<>();
    List<String> columnNames = new ArrayList<>();

    // 获取列名
    if (insertStmt.getColumns() != null && !insertStmt.getColumns().isEmpty()) {
        insertStmt.getColumns().forEach(column -> columnNames.add(column.getColumnName()));
    }

    // 获取值
    insertStmt.getItemsList().accept(new ItemsListVisitorAdapter() {
        @Override
        public void visit(ExpressionList expressionList) {
            expressionList.getExpressions().forEach(expression -> {
                // 将表达式转换为字符串并去掉单引号
                String value = expression.toString().replace("'", "");
                // 去掉前后的括号
                value = value.replaceAll("^\\(|\\)$", "");
                values.add(value);
            });
        }
    });

    // 检查列名与值的数量是否匹配
    if (!columnNames.isEmpty() && columnNames.size() != values.size()) {
        throw new Exception("Column count does not match value count.");
    }

    insertObj.fields = columnNames.toArray(new String[0]);
    insertObj.values = values.toArray(new String[0]);

    return insertObj;
}
```

#### 解析 `UPDATE` 语句

`parseUpdate` 方法解析 `UPDATE` 语句，提取更新的表名、列名、更新值和 `WHERE` 条件。

```java
private static UpdateObj parseUpdate(Update updateStmt) {
    UpdateObj updateObj = new UpdateObj();
    updateObj.tableName = updateStmt.getTable().getName();
    updateObj.fieldName = updateStmt.getColumns().get(0).getColumnName();
    updateObj.value = updateStmt.getExpressions().get(0).toString();
    if (updateStmt.getWhere() != null) {
        updateObj.where = parseWhere(updateStmt.getWhere().toString());
    }
    return updateObj;
}
```

#### 解析 `DELETE` 语句

`parseDelete` 方法解析 `DELETE` 语句，提取删除操作的表名和 `WHERE` 条件。

```java
private static DeleteObj parseDelete(Delete deleteStmt) {
    DeleteObj deleteObj = new DeleteObj();
    deleteObj.tableName = deleteStmt.getTable().getName();
    if (deleteStmt.getWhere() != null) {
        deleteObj.where = parseWhere(deleteStmt.getWhere().toString());
    }
    return deleteObj;
}
```

#### 解析 `CREATE TABLE` 语句

`parseCreate` 方法解析 `CREATE TABLE` 语句，提取表名、列定义和索引等信息。

```java
private static Create parseCreate(CreateTable createTable) {
    Create create = new Create();
    create.tableName = createTable.getTable().getName();
    List<String> fieldNames = new ArrayList<>();
    List<String> fieldTypes = new ArrayList<>();
    List<String> indexes = new ArrayList<>();
    List<String> autoIncrement = new ArrayList<>();
    List<String> notNull = new ArrayList<>();
    List<String> unique = new ArrayList<>();

    for (ColumnDefinition columnDefinition : createTable.getColumnDefinitions()) {
        fieldNames.add(columnDefinition.getColumnName());
        fieldTypes.add(columnDefinition.getColDataType().toString());

        if (columnDefinition.getColumnSpecs() != null) {
            for (String columnSpec : columnDefinition.getColumnSpecs()) {
                if (columnSpec.equalsIgnoreCase("PRIMARY")) {
                    create.primaryKey = columnDefinition.getColumnName();
                } else if (columnSpec.equalsIgnoreCase("AUTO_INCREMENT")) {
                    autoIncrement.add(columnDefinition.getColumnName());
                } else if (columnSpec.equalsIgnoreCase("NOT")) {
                    notNull.add(columnDefinition.getColumnName());
                } else if (columnSpec.equalsIgnoreCase("UNIQUE")) {
                    unique.add(columnDefinition.getColumnName());
                }
            }
        }
    }

    if (createTable.getIndexes() != null) {
        for (Index index : createTable.getIndexes()) {
            // 只处理单列索引
            if (index.getColumnsNames().size() == 1) {
                indexes.add(index.getColumnsNames

().get(0));
            }
        }
    }

    create.fieldName = fieldNames.toArray(new String[0]);
    create.fieldType = fieldTypes.toArray(new String[0]);
    create.index = indexes.toArray(new String[0]);
    create.autoIncrement = autoIncrement.toArray(new String[0]);
    create.notNull = notNull.toArray(new String[0]);
    create.unique = unique.toArray(new String[0]);

    return create;
}
```

### 处理事务语句

除了常见的 SQL 操作，`Parser` 类还处理事务控制语句，如 `BEGIN`、`COMMIT` 和 `ABORT`。这些方法会解析 SQL 字符串并返回相应的事务操作对象。

```java
private static Abort parseAbort() {
    return new Abort();
}

private static Commit parseCommit() {
    return new Commit();
}

private static Begin parseBegin(String sql) throws Exception {
    sql = sql.trim();
    if (sql.endsWith(";")){
        sql = sql.substring(0,sql.length() - 1).trim();
    }

    Tokenizer tokenizer = new Tokenizer(sql.getBytes());
    tokenizer.peek();
    tokenizer.pop();

    String isolation = tokenizer.peek();
    Begin begin = new Begin();
    if ("".equals(isolation)) {
        begin.isolationLevel = IsolationLevel.READ_COMMITTED;
        return begin;
    }
    // 处理事务隔离级别的解析
    // ...

    return begin;
}
```

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::