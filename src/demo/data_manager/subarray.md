---
icon: material-symbols-light:view-array-outline
title: 共享内存数组
order: 2
category:
  - DM
tag:
  - SubArray
---

> 本章涉及代码：com/dyx/simpledb/backend/common/SubArray.java

### Java 的数组存储

在 Java 中，数组被视为对象，并且在内存中以对象的形式存储。这与 C、C++ 和 Go 语言有所不同，这些语言中的数组是通过指针实现的。在这些语言中，数组的某一部分可以直接指向原数组的内存区域，实现内存共享。例如，Go 语言中的代码：

```go
var array1 [10]int64
array2 := array1[5:]
```

在这种情况下，`array2` 和 `array1` 的第五个元素到最后一个元素共享同一片内存，即使这两个数组的长度不同。而在 Java 中，当你执行类似的 `subArray` 操作时，Java 底层会进行一次数组复制，这就无法实现同一片内存的共享。
为了克服这个限制，可以通过自定义的 `SubArray` 类来松散地规定数组的可使用范围，从而模拟共享数组的效果。

### SubArray 类的实现

以下是 `SubArray` 类的简单实现：

```java
public class SubArray {
    public byte[] raw;
    public int start;
    public int end;

    public SubArray(byte[] raw, int start, int end) {
        this.raw = raw;
        this.start = start;
        this.end = end;
    }
}
```

在这个类中，`raw` 表示原始的字节数组，`start` 和 `end` 则规定了 `SubArray` 所代表的数组的有效范围。通过这个类，我们可以在不复制数组的情况下，共享同一片内存区域的不同部分。

### 案例演示

为了更好地理解 `SubArray` 类的用途，下面我们通过一个实际的案例来展示其效果。

#### 案例代码

```java
@Test
public void testSubArray() {
    // 创建一个1到10的数组
    byte[] subArray = new byte[10];
    for (int i = 0; i < subArray.length; i++) {
        subArray[i] = (byte) (i + 1);
    }

    // 创建两个 SubArray 实例，分别引用原数组的不同部分
    SubArray sub1 = new SubArray(subArray, 3, 7);
    SubArray sub2 = new SubArray(subArray, 6, 9);

    // 修改共享数组中的某个数据
    sub1.raw[4] = (byte) 44;

    // 打印原始数组的内容
    System.out.println("Original Array: ");
    printArray(subArray);

    // 打印两个 SubArray 的内容
    System.out.println("SubArray1: ");
    printSubArray(sub1);
    System.out.println("SubArray2: ");
    printSubArray(sub2);
}

private void printArray(byte[] array) {
    System.out.println(Arrays.toString(array));
}

private void printSubArray(SubArray subArray) {
    for (int i = subArray.start; i <= subArray.end; i++) {
        System.out.print(subArray.raw[i] + "\t");
    }
    System.out.println();
}
```

在这个示例中，我们首先创建了一个包含 1 到 10 的数组 `subArray`，然后使用 `SubArray` 类创建了两个子数组 `sub1` 和 `sub2`。这两个子数组分别引用了原始数组的不同部分。
接下来，我们修改了原始数组中的某个元素，然后打印出原始数组和两个 `SubArray` 的内容。通过这种方式，我们可以看到，`SubArray` 实际上是共享了同一片内存，因此对原始数组的修改会直接反映在 `SubArray` 中。

#### 演示结果

```latex
Original Array: 
[1, 2, 3, 4, 44, 6, 7, 8, 9, 10]

SubArray1: 
4	44	6	7	8	

SubArray2: 
7	8	9	10	
```

从输出结果可以看出，当我们修改了原数组中的某个元素后，这一修改在 `SubArray1` 中得到了反映，因为它们共享同一片内存区域。而 `SubArray2` 中的内容也反映了相应的部分，这说明我们可以通过 `SubArray` 类来实现类似 Go 语言中共享数组的效果。

### 总结

通过这个简单的 `SubArray` 类，我们能够在 Java 中模拟 C、C++ 或 Go 语言中的数组内存共享功能。虽然 Java 不允许直接共享数组的内存部分，但通过定义子数组的方式，我们可以高效地管理和操作数组的不同部分，而不必担心多余的内存开销或数据复制。这种方法在需要频繁处理大型数组或在多线程环境下操作共享数据时特别有用。
:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**部分内容转载自：**[https://shinya.click/projects/mydb/mydb2](https://shinya.click/projects/mydb/mydb2)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::