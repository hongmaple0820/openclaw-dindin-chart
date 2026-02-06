# Diagram Generator

使用 Mermaid 生成专业的架构图、流程图、时序图等。

## 激活场景

- 用户说"画图"、"架构图"、"流程图"、"时序图"
- 需要可视化系统设计
- 文档需要配图

## 工具

### Mermaid CLI

```bash
# 安装
npm install -g @mermaid-js/mermaid-cli

# 使用
mmdc -i input.mmd -o output.png
mmdc -i input.mmd -o output.svg
mmdc -i input.mmd -o output.pdf
```

### 在线编辑器

https://mermaid.live/ - 实时预览和导出

---

## 图表类型

### 1. 流程图 (Flowchart)

```mermaid
flowchart TD
    A[开始] --> B{条件判断}
    B -->|是| C[处理A]
    B -->|否| D[处理B]
    C --> E[结束]
    D --> E
```

**语法**：
- `A[文字]` 矩形
- `A(文字)` 圆角矩形
- `A{文字}` 菱形（判断）
- `A((文字))` 圆形
- `-->` 箭头
- `---` 线条
- `-->|文字|` 带标签的箭头

**方向**：
- `TD` 上到下
- `LR` 左到右
- `BT` 下到上
- `RL` 右到左

---

### 2. 时序图 (Sequence Diagram)

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端
    participant D as 数据库
    
    U->>F: 点击登录
    F->>B: POST /api/login
    B->>D: 查询用户
    D-->>B: 返回用户信息
    B-->>F: 返回 token
    F-->>U: 跳转首页
```

**语法**：
- `participant A as 别名` 定义参与者
- `A->>B: 消息` 实线箭头
- `A-->>B: 消息` 虚线箭头
- `A-xB: 消息` 异步消息
- `Note over A,B: 备注` 添加备注

---

### 3. 架构图 (Architecture)

```mermaid
flowchart TB
    subgraph 前端
        A[Web App]
        B[Mobile App]
    end
    
    subgraph 后端
        C[API Gateway]
        D[Auth Service]
        E[Chat Service]
    end
    
    subgraph 存储
        F[(MySQL)]
        G[(Redis)]
        H[MinIO]
    end
    
    A --> C
    B --> C
    C --> D
    C --> E
    D --> F
    E --> F
    E --> G
    E --> H
```

---

### 4. 类图 (Class Diagram)

```mermaid
classDiagram
    class User {
        +String id
        +String name
        +String avatar
        +login()
        +logout()
    }
    
    class Message {
        +String id
        +String content
        +Date createdAt
        +send()
    }
    
    User "1" --> "*" Message : sends
```

---

### 5. 状态图 (State Diagram)

```mermaid
stateDiagram-v2
    [*] --> 待处理
    待处理 --> 处理中: 开始处理
    处理中 --> 已完成: 处理成功
    处理中 --> 失败: 处理失败
    失败 --> 待处理: 重试
    已完成 --> [*]
```

---

### 6. ER 图 (Entity Relationship)

```mermaid
erDiagram
    USER ||--o{ MESSAGE : sends
    USER {
        string id PK
        string name
        string avatar
    }
    MESSAGE {
        string id PK
        string content
        string sender_id FK
        datetime created_at
    }
```

---

### 7. 甘特图 (Gantt)

```mermaid
gantt
    title 项目进度
    dateFormat YYYY-MM-DD
    
    section 设计
    需求分析     :done,    des1, 2024-01-01, 3d
    架构设计     :done,    des2, after des1, 5d
    
    section 开发
    后端开发     :active,  dev1, 2024-01-09, 10d
    前端开发     :         dev2, 2024-01-09, 10d
    
    section 测试
    集成测试     :         test1, after dev1, 5d
```

---

### 8. 饼图 (Pie)

```mermaid
pie title 技术栈分布
    "JavaScript" : 45
    "Python" : 25
    "Go" : 15
    "其他" : 15
```

---

## 样式美化

### 主题

```bash
# 使用主题
mmdc -i input.mmd -o output.png -t dark
mmdc -i input.mmd -o output.png -t forest
mmdc -i input.mmd -o output.png -t neutral
```

### 自定义样式

```mermaid
flowchart LR
    A[开始]:::green --> B[处理]:::blue --> C[结束]:::green
    
    classDef green fill:#10B981,color:white
    classDef blue fill:#2563EB,color:white
```

### 配置文件

```json
// mermaid-config.json
{
  "theme": "base",
  "themeVariables": {
    "primaryColor": "#2563EB",
    "primaryTextColor": "#fff",
    "primaryBorderColor": "#1d4ed8",
    "lineColor": "#64748b",
    "secondaryColor": "#f1f5f9",
    "tertiaryColor": "#fff"
  }
}
```

```bash
mmdc -i input.mmd -o output.png -c mermaid-config.json
```

---

## 操作流程

1. **理解需求**：用户想表达什么关系/流程
2. **选择图表类型**：流程图、时序图、架构图等
3. **编写 Mermaid 代码**：写到 `.mmd` 文件
4. **生成图片**：`mmdc -i xx.mmd -o xx.png`
5. **调整样式**：根据需要调整颜色、布局

---

## 示例：AI 聊天室架构图

```mermaid
flowchart TB
    subgraph 用户层
        U1[👤 鸿枫]
        U2[🌸 小琳]
        U3[🐷 小猪]
    end
    
    subgraph 接入层
        DD[钉钉群]
        WEB[Web 聊天室]
    end
    
    subgraph 服务层
        HUB[Chat-Hub<br/>消息中转]
        OC1[OpenClaw<br/>小琳实例]
        OC2[OpenClaw<br/>小猪实例]
    end
    
    subgraph 存储层
        DB[(SQLite)]
        RD[(Redis)]
        FS[文件存储]
    end
    
    U1 --> DD
    U2 --> OC1
    U3 --> OC2
    
    DD <--> HUB
    WEB <--> HUB
    OC1 <--> HUB
    OC2 <--> HUB
    
    HUB --> DB
    HUB --> RD
    HUB --> FS
    
    style HUB fill:#2563EB,color:white
    style OC1 fill:#10B981,color:white
    style OC2 fill:#F472B6,color:white
```

---

## 注意事项

1. **保持简洁**：一张图不要超过 15-20 个节点
2. **分层清晰**：用 subgraph 组织相关元素
3. **颜色适度**：2-3 个主色即可
4. **中文支持**：需要系统有中文字体
5. **导出格式**：SVG 最清晰，PNG 兼容性好

---

*让文档更生动，让架构更清晰*
