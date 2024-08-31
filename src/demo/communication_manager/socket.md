---
icon: fluent:server-surface-multiple-16-regular
title: 服务端与客户端通信协议
order: 1
category:
  - communication
tag:
  - socket
---
> 本章涉及代码：com/dyx/simpledb/backend/Launcher.java；com/dyx/simpledb/client/*；

EasyDB 是一个基于 C/S 结构（Client/Server）的数据库系统，类似于 MySQL。它支持启动服务器并允许多个客户端通过 socket 通信连接到服务器，执行 SQL 查询并返回结果。本文将介绍 EasyDB 的通信机制、核心类的实现以及服务器与客户端的工作原理。

### C/S 通信机制

EasyDB 使用了一种自定义的二进制格式用于客户端和服务端之间的通信。虽然这种格式增加了通信的效率，但如果需要，也可以使用明文传输。通信的基本结构是 `Package` 类，它封装了传输的数据和可能发生的异常。

#### Package 类

```java
public class Package {
    byte[] data;
    Exception err;
}
```

在传输数据之前，每个 `Package` 实例会通过 `Encoder` 类编码为字节数组。对方收到后，同样会通过 `Encoder` 进行解码。编码和解码的规则如下：

- `[Flag][data]`
  - `flag = 0`：表示数据正常，`data` 为传输的实际数据。
  - `flag = 1`：表示发生错误，`data` 为 `Exception.getMessage()` 返回的错误提示信息。

#### Encoder 类

```java
public class Encoder {
    public byte[] encode(Package pkg) {
        if(pkg.getErr() != null) {
            Exception err = pkg.getErr();
            String msg = "Internal server error!";
            if(err.getMessage() != null) {
                msg = err.getMessage();
            }
            return Bytes.concat(new byte[]{1}, msg.getBytes());
        } else {
            return Bytes.concat(new byte[]{0}, pkg.getData());
        }
    }

    public Package decode(byte[] data) throws Exception {
        if(data.length < 1) {
            throw Error.InvalidPkgDataException;
        }
        if(data[0] == 0) {
            return new Package(Arrays.copyOfRange(data, 1, data.length), null);
        } else if(data[0] == 1) {
            return new Package(null, new RuntimeException(new String(Arrays.copyOfRange(data, 1, data.length))));
        } else {
            throw Error.InvalidPkgDataException;
        }
    }
}
```

#### Transporter 类

`Transporter` 类负责将编码后的数据通过输出流发送出去。为了避免特殊字符的问题，数据会被转换为十六进制字符串并在末尾加上换行符，这样可以使用 `BufferedReader` 和 `Writer` 进行按行读写。

```java
public class Transporter {
    private Socket socket;
    private BufferedReader reader;
    private BufferedWriter writer;

    public Transporter(Socket socket) throws IOException {
        this.socket = socket;
        this.reader = new BufferedReader(new InputStreamReader(socket.getInputStream()));
        this.writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream()));
    }

    public void send(byte[] data) throws Exception {
        String raw = hexEncode(data);
        writer.write(raw);
        writer.flush();
    }

    public byte[] receive() throws Exception {
        String line = reader.readLine();
        if(line == null) {
            close();
        }
        return hexDecode(line);
    }

    public void close() throws IOException {
        writer.close();
        reader.close();
        socket.close();
    }

    private String hexEncode(byte[] buf) {
        return Hex.encodeHexString(buf, true) + "\n";
    }

    private byte[] hexDecode(String buf) throws DecoderException {
        return Hex.decodeHex(buf);
    }
}
```

#### Packager 类

`Packager` 类将 `Encoder` 和 `Transporter` 结合在一起，提供了更高级别的 `send` 和 `receive` 方法。

```java
public class Packager {
    private Transporter transporter;
    private Encoder encoder;

    public Packager(Transporter transporter, Encoder encoder) {
        this.transporter = transporter;
        this.encoder = encoder;
    }

    public void send(Package pkg) throws Exception {
        byte[] data = encoder.encode(pkg);
        transporter.send(data);
    }

    public Package receive() throws Exception {
        byte[] data = transporter.receive();
        return encoder.decode(data);
    }

    public void close() throws Exception {
        transporter.close();
    }
}
```

---

### 服务器与客户端实现

#### 服务器实现

服务器通过 `ServerSocket` 启动并监听端口，当有请求到来时，会启动一个新线程处理请求。`HandleSocket` 类实现了 `Runnable` 接口，在建立连接后初始化 `Packager`，并循环接收来自客户端的数据进行处理。

```java
Packager packager = null;
try {
    Transporter t = new Transporter(socket);
    Encoder e = new Encoder();
    packager = new Packager(t, e);
} catch(IOException e) {
    e.printStackTrace();
    try {
        socket.close();
    } catch (IOException e1) {
        e1.printStackTrace();
    }
    return;
}

Executor exe = new Executor(tbm);
while(true) {
    Package pkg = null;
    try {
        pkg = packager.receive();
    } catch(Exception e) {
        break;
    }
    byte[] sql = pkg.getData();
    byte[] result = null;
    Exception e = null;
    try {
        result = exe.execute(sql);
    } catch (Exception e1) {
        e = e1;
        e.printStackTrace();
    }
    pkg = new Package(result, e);
    try {
        packager.send(pkg);
    } catch (Exception e1) {
        e1.printStackTrace();
        break;
    }
}
```

#### 客户端实现

客户端通过 `Socket` 连接到服务器，并实现了一个简单的 Shell，读取用户输入并调用 `Client.execute()` 方法发送 SQL 语句。

```java
public byte[] execute(byte[] stat) throws Exception {
    Package pkg = new Package(stat, null);
    Package resPkg = rt.roundTrip(pkg);
    if(resPkg.getErr() != null) {
        throw resPkg.getErr();
    }
    return resPkg.getData();
}
```

`RoundTripper` 类实现了单次的收发动作：

```java
public Package roundTrip(Package pkg) throws Exception {
    packager.send(pkg);
    return packager.receive();
}
```

客户端的启动入口如下：

```java
public class Launcher {
    public static void main(String[] args) throws UnknownHostException, IOException {
        Socket socket = new Socket("127.0.0.1", 9999);
        Encoder e = new Encoder();
        Transporter t = new Transporter(socket);
        Packager packager = new Packager(t, e);

        Client client = new Client(packager);
        Shell shell = new Shell(client);
        shell.run();
    }
}
```

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**本文内容转载自：**[https://shinya.click/projects/mydb/mydb10](https://shinya.click/projects/mydb/mydb10)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::