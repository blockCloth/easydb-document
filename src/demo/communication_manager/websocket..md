---
icon: mdi:web-sync
title: 基于WebSocket通信协议
order: 2
category:
  - communication
tag:
  - websocket
---
> 本章涉及代码：com/dyx/simpledb/websocket/*

### WebSocket 通信与数据库管理系统整合教程

在本教程中，我们将讲解如何使用 Spring 框架实现一个基于 WebSocket 的数据库管理系统。这套系统允许客户端通过 WebSocket 连接到服务器，执行 SQL 命令并实时获取结果。整个实现涵盖了 WebSocket 通信、用户会话管理、数据库初始化与销毁等多个重要功能模块。

#### WebSocket 通信基础

WebSocket 是一种全双工通信协议，它允许服务器和客户端之间进行实时、双向的数据交换。在我们的系统中，WebSocket 用于接收客户端的 SQL 命令并返回执行结果。

#### WebSocket 处理器：`TerminalWebSocketHandler`

`TerminalWebSocketHandler` 是处理 WebSocket 消息的核心类。它负责解析客户端发送的 SQL 命令，执行数据库操作，并返回执行结果。

- **线程池管理：** 每个 WebSocket 会话都有一个独立的线程池，用于处理该会话的 SQL 命令，保证并发操作的独立性。
- **SQL 命令解析与执行：** 根据客户端发送的 SQL 命令选择相应的处理方法，如数据库初始化或执行具体的 SQL 语句。

```java
@Slf4j
@Component
public class TerminalWebSocketHandler extends TextWebSocketHandler {

    @Autowired
    private UserManager userManager;

    @Value("${custom.db.path}")
    private String dbPath;
    private final Map<String, ExecutorService> sessionExecutorMap = new ConcurrentHashMap<>();

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String payload = message.getPayload();
        JSONObject jsonObject = new JSONObject(payload);
        String sql = jsonObject.getStr("command");
        String clientIp = (String) session.getAttributes().get("clientIp");
        String sessionId = session.getId(); // 每个 WebSocket 会话的唯一标识符

        log.info("User with IP: {}, session ID: {} executed SQL: {}", clientIp, sessionId, sql);
        ExecutorService executorService = sessionExecutorMap.computeIfAbsent(sessionId, key -> Executors.newSingleThreadExecutor());

        executorService.submit(() -> {
            try {
                if ("init".equalsIgnoreCase(sql.trim()) || "init;".equalsIgnoreCase(sql.trim())) {
                    handleInitCommand(session, clientIp, sessionId);
                } else {
                    UserSession userSession = userManager.getUserSession(clientIp);
                    if (userSession == null || userSession.getExecutor(sessionId) == null) {
                        session.sendMessage(new TextMessage(createMessage("Please init database", "error")));
                    } else {
                        userSession.updateLastAccessedTime(); // 更新最后访问时间
                        handleSqlCommand(session, userSession, sessionId, sql);
                    }
                }
            } catch (IOException e) {
                e.printStackTrace();
            }
        });
    }
```

#### 初始化与销毁数据库

`handleInitCommand()` 方法负责初始化数据库。如果数据库文件尚未存在，该方法将创建新的数据库文件，并在后续操作中加载它。

- **数据库文件管理：** 系统根据客户端 IP 地址为每个用户创建一个独立的数据库文件目录。
- **初始化与加载：** 根据数据库文件是否存在，决定是创建新的数据库还是加载现有的数据库。

```java
private void handleInitCommand(WebSocketSession session, String clientIp, String sessionId) throws IOException {
    UserSession userSession = userManager.getUserSession(clientIp);
    if (userSession != null && userSession.getExecutor(sessionId) != null) {
        session.sendMessage(new TextMessage(createMessage("Database is already initialized in this session.", "success")));
        return;
    }

    if (userSession == null) {
        userSession = new UserSession(clientIp, System.currentTimeMillis());
        userManager.addUserSession(clientIp, userSession);
    }

    String directoryPath = dbPath + File.separator + clientIp;
    String dbFilePath = directoryPath + File.separator + clientIp;

    File ipDirectory = new File(directoryPath);
    if (!ipDirectory.exists() && !ipDirectory.mkdirs()) {
        session.sendMessage(new TextMessage(createMessage("Database init failed: cannot create directory.", "error")));
        return;
    }
    boolean databaseExists = checkIfDatabaseFilesExist(directoryPath, clientIp);

    if (databaseExists) {
        initializeDatabase(userSession, dbFilePath, sessionId);
    } else {
        createDatabase(dbFilePath);
        initializeDatabase(userSession, dbFilePath, sessionId);
    }

    session.sendMessage(new TextMessage(createMessage("Database init and load success!", "success")));
}
```

#### WebSocket 握手拦截器：`HttpSessionHandshakeInterceptor`

`HttpSessionHandshakeInterceptor` 用于在 WebSocket 握手阶段获取客户端的 IP 地址，并将其存储在 WebSocket 会话的属性中。这在后续操作中用于标识用户和管理会话。

- **获取客户端 IP 地址：** 通过解析 HTTP 请求头信息，获取客户端的真实 IP 地址，支持多重代理的情况下正确识别 IP。
- **拦截握手请求：** 在 WebSocket 握手阶段添加自定义逻辑，以便后续处理使用。

```java
@Component
public class HttpSessionHandshakeInterceptor implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        if (request instanceof ServletServerHttpRequest) {
            HttpServletRequest servletRequest = ((ServletServerHttpRequest) request).getServletRequest();
            String clientIp = getClientIp(servletRequest);
            attributes.put("clientIp", clientIp);
        }
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
    }

    private String getClientIp(HttpServletRequest request) {
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp != null && !clientIp.isEmpty() && !"unknown".equalsIgnoreCase(clientIp)) {
            clientIp = clientIp.split(",")[0];
        } else {
            clientIp = request.getRemoteAddr();
        }

        if ("0:0:0:0:0:0:0:1".equals(clientIp)) {
            clientIp = "127.0.0.1";
        }

        return clientIp;
    }
}
```

#### 用户会话管理：`UserManager` 与 `UserSession`

`UserManager` 负责管理所有活跃用户的会话，包括会话的创建、维护和销毁。同时，它还负责定期检查并清理过期的会话及其相关的数据库文件。

- **最大用户限制：** 限制同时活跃的用户数量，确保系统的稳定性。
- **定期检查与清理：** 通过 `@Scheduled` 注解定期检查用户会话，并清理过期的会话及其数据库文件。

```java
@Component
public class UserManager {
    private static final int MAX_USERS = 20;
    private static final int SESSION_EXPIRY_CHECK_INTERVAL = 10 * 60 * 1000;
    private static final int MAX_SESSION_DURATION = 2 * 60 * 60 * 1000;

    private ConcurrentHashMap<String, UserSession> activeUsers = new ConcurrentHashMap<>();
    private AtomicInteger userCount = new AtomicInteger(0);

    @Value("${custom.db.path}")
    private String dbPath;

    public boolean canInit(String userId) {
        if (userCount.get() >= MAX_USERS) {
            return false;
        }
        activeUsers.put(userId, new UserSession(userId, System.currentTimeMillis()));
        userCount.incrementAndGet();
        return true;
    }

    public UserSession getUserSession(String userId) {
        return activeUsers.get(userId);
    }

    public void addUserSession(String userId, UserSession userSession) {
        activeUsers.put(userId, userSession);
        userCount.incrementAndGet();
    }

    public void removeUserSession(String userId) {
        UserSession session = activeUsers.get(userId);
        if (session != null) {
            session.close();
        }
        activeUsers.remove(userId);
        userCount.decrementAndGet();
    }

    @Scheduled(fixedRate = 60000)
    public void checkSessions() {
        long currentTime = System.currentTimeMillis();
        activeUsers.forEach((userId, session) -> {
            if (currentTime - session.getLastAccessedTime() >= SESSION_EXPIRY_CHECK_INTERVAL ||
                    currentTime - session.getStartTime() >= MAX_SESSION_DURATION) {
                removeUserSession(userId);
                destroyDatabase(userId);
            }
        });
    }

    public void destroyDatabase(String userId) {
        String directoryPath = dbPath + File.separator + userId;
        Path directory = Paths.get(directoryPath);
        try {
            deleteDirectory(directory);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private void deleteDirectory(Path directory) throws IOException {
        Files.walkFileTree(directory, new SimpleFileVisitor<Path>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Files.delete(file);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                if (exc == null) {
                    Files.delete(dir);
                    return FileVisitResult.CONTINUE;
                } else {
                    throw exc;
                }
            }
        });
    }
}
```

`UserSession` 类用于表示单个用户的会话信息，包括数据库连接、事务管理器和表管理器等。

- **会话管理：** `UserSession` 管理每个用户的数据库连接和事务，支持多个 WebSocket 会话。
- **资源释放：** 当用户会话结束时，确保正确关闭数据库连接和释放资源。

```java
@Setter
@Getter
public class UserSession {
    private String userId;
    private long startTime;
    private long lastAccessedTime;
    private TableManager tableManager;
    private TransactionManager transactionManager;
    private DataManager dataManager;
    private Map<String,Executor> executorMap;
    private final Set<String> sessionIds = ConcurrentHashMap.newKeySet();

    public UserSession(String userId, long startTime) {
        this.userId = userId;
        this.startTime = startTime;
        this.lastAccessedTime = startTime;
        executorMap = new HashMap<>();
    }

    public void updateLastAccessedTime() {
        this.lastAccessedTime = System.currentTimeMillis();
    }

    public void close() {
        if (dataManager != null) {
            dataManager.close();
        }
        if (transactionManager != null) {
            transactionManager.close();
        }
    }

    public Executor getExecutor(String sessionId) {
        return executorMap.get(sessionId);
    }

    public Executor removeExecutor(String sessionId) {
        return executorMap.remove(sessionId);
    }

    public void setExecutor(String sessionId, Executor executor) {
        executorMap.put(sessionId,executor);
    }

    public void addSession(String sessionId) {
        sessionIds.add(sessionId);
    }

    public void removeSession(String sessionId) {
        sessionIds.remove(sessionId);
    }

    public boolean hasActiveSessions() {
        return !sessionIds.isEmpty();
    }
}
```

:::note
**本文作者：**[blockCloth](https://github.com/blockCloth)  
**版权声明：** 本博客所有文章除特别声明外，均采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans)许可协议。转载请注明来自 [blockCloth](https://github.com/blockCloth)
:::